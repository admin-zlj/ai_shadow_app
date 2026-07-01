/**
 * ============================================================================
 * 带「工具调用」的大模型流式循环
 * ============================================================================
 *
 * 背景：模型除了直接说话，还可以返回 tool_calls（例如「去查知识库」）。
 * 流程必须是：
 *
 *   用户消息 + 历史
 *        ↓
 *   模型输出 ──→ 若是 tool_calls → 服务端执行工具 → 把结果作为 ToolMessage 追加
 *        ↑                                    │
 *        └──────── 再问模型（同一轮对话）──────┘
 *        ↓
 *   若没有 tool_calls，输出里的文字就是给用户的最终答案
 *
 * 和前端 SSE 的关系：
 *   - 调工具那几轮：通常无正文，或有 tool_call chunk 时不把文字推给前端
 *   - 最终回答轮：每个文本 chunk 到达即 yield，实现打字机效果
 *
 * 相关文件：
 *   - tools/chat-tools.ts     工具定义（名字、描述、参数 schema）
 *   - tools/*.client.ts       工具真正干活的 HTTP/逻辑
 * ============================================================================
 */

import {
  AIMessage,
  AIMessageChunk,
  type BaseMessage,
  ToolMessage,
} from "@langchain/core/messages";
import type { ChatOpenAI } from "@langchain/openai";
import { chatTools, chatToolsByName } from "./tools/chat-tools";
import { logger } from "@/lib/logger";
import {
  logLlmFinalAnswerStart,
  logLlmRequest,
  logToolInvoke,
  logToolResult,
} from "@/lib/llm-console-log";

/** 防止模型无限「调工具 → 再调工具」；超过次数就停止并打日志 */
const MAX_TOOL_ROUNDS = 4;

/**
 * 从流式 chunk 里取出纯文本。
 * 有的模型 content 是 string，有的会是 [{ type:'text', text:'...' }] 数组。
 */
function extractChunkText(chunk: AIMessageChunk): string {
  const content = chunk.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "type" in part) {
          if (part.type === "text" && "text" in part) {
            return String(part.text);
          }
        }
        return "";
      })
      .join("");
  }
  return content == null ? "" : String(content);
}

/** 流式 chunk 是否携带工具调用信号（出现则本轮不应再把正文推给用户） */
function chunkHasToolCallSignal(chunk: AIMessageChunk): boolean {
  return (
    (chunk.tool_call_chunks?.length ?? 0) > 0 ||
    (chunk.tool_calls?.length ?? 0) > 0
  );
}

/**
 * @param model    已配置好 baseURL / apiKey 的 ChatOpenAI
 * @param messages 首包消息：System + 历史（来自 chat.service）
 * @param meta     仅用于日志（sessionId）
 */
export async function* streamChatWithTools(
  model: ChatOpenAI,
  messages: BaseMessage[],
  meta: { sessionId: string; model?: string },
): AsyncGenerator<string> {
  const modelWithTools = model.bindTools(chatTools);
  const boundToolNames = chatTools.map((t) => t.name);

  const workingMessages = [...messages];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    logLlmRequest({
      sessionId: meta.sessionId,
      round,
      model: meta.model,
      messages: workingMessages,
      boundToolNames,
    });

    const stream = await modelWithTools.stream(workingMessages);
    let gathered: AIMessageChunk | undefined;
    let sawToolCallSignal = false;
    let streamedAnswerChars = 0;

    for await (const chunk of stream) {
      gathered = gathered ? gathered.concat(chunk) : chunk;
      if (chunkHasToolCallSignal(chunk)) {
        sawToolCallSignal = true;
      }

      const text = extractChunkText(chunk);
      if (!text) continue;

      // 尚未出现 tool_call：视为最终回答流式输出；一旦出现 tool_call 则停止向用户推正文
      if (!sawToolCallSignal) {
        streamedAnswerChars += text.length;
        yield text;
      }
    }

    if (!gathered) {
      logger.warn(
        { sessionId: meta.sessionId, round },
        "empty LLM stream chunk",
      );
      break;
    }

    const toolCalls = gathered.tool_calls ?? [];

    // 把本轮模型的完整回复记入上下文（含 tool_calls 字段，供下一轮模型理解）
    workingMessages.push(
      new AIMessage({
        content: gathered.content,
        tool_calls: toolCalls,
      }),
    );

    // ----- 第 B 步：没有工具调用 → 本轮文本就是最终答案 -----
    if (toolCalls.length === 0) {
      if (streamedAnswerChars === 0) {
        const fallback = extractChunkText(gathered);
        if (fallback.length > 0) {
          streamedAnswerChars = fallback.length;
          yield fallback;
        }
      }
      logLlmFinalAnswerStart({
        sessionId: meta.sessionId,
        round,
        previewLength: streamedAnswerChars,
      });
      return;
    }

    logger.info(
      {
        sessionId: meta.sessionId,
        round,
        tools: toolCalls.map((c) => c.name),
      },
      "LLM tool calls",
    );

    for (const call of toolCalls) {
      logToolInvoke({
        sessionId: meta.sessionId,
        round,
        toolName: call.name,
        args: call.args,
        toolCallId: call.id,
      });

      const toolImpl = chatToolsByName[call.name];
      let content: string;

      if (!toolImpl) {
        content = JSON.stringify({
          ok: false,
          error: `未知工具: ${call.name}`,
        });
      } else {
        try {
          // call.args 是模型填的参数对象，例如 { query: "张留杰 项目经历" }
          const result = await toolImpl.invoke(call.args ?? {});
          content =
            typeof result === "string" ? result : JSON.stringify(result);
        } catch (error) {
          content = JSON.stringify({
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // tool_call_id 必须和 AIMessage 里对应 call.id 一致，模型才能把「结果」和「哪次调用」对上
      logToolResult({
        sessionId: meta.sessionId,
        toolName: call.name,
        content,
        ok: !content.includes('"ok":false'),
      });

      workingMessages.push(
        new ToolMessage({
          content,
          tool_call_id: call.id ?? `${call.name}-${round}`,
        }),
      );
    }

    // 循环进入 round+1：带着 ToolMessage 再问模型，直到某轮不再返回 tool_calls
  }

  logger.warn({ sessionId: meta.sessionId }, "tool loop max rounds reached");
}
