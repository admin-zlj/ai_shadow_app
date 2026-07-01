/**
 * ============================================================================
 * 会话上下文摘要（滚动压缩）
 * ============================================================================
 *
 * 【存什么】Redis 会话上两个字段：
 *   - summary               大模型生成的累计摘要文本
 *   - summaryThroughIndex   messages[0..该下标] 已并进 summary，默认 -1
 *
 * 【何时触发】每轮用户发问后统计字数：
 *   len(人设 System Prompt) + len(summary) + 未摘要消息正文  >  CONTEXT_CHAR_LIMIT（默认 2000）
 *
 * 【与回答的关系 — 重要】
 *   超限时不在回答前 await 摘要，避免阻塞 SSE：
 *   1. 本轮：useSummary=false → 不带 summary，逐条传 Redis 里全部历史，立刻流式回答
 *   2. 同时：后台 runSessionContextCompaction() 写 summary（可能多轮 invoke）
 *   3. 本轮回答落库后，await 摘要任务，接口再结束
 *   4. 下一轮：useSummary=true → System 里带 summary，只传未摘要消息
 *
 * 【摘要折叠规则】
 *   - 从最早未摘要消息开始合并进 summary，可一次合并多条
 *   - 最后一条 user（当前提问）永不折叠
 *   - 前端仍展示 Redis 全量 messages，不受 summaryThroughIndex 影响
 * ============================================================================
 */

import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  type BaseMessage,
} from '@langchain/core/messages';
import type { ChatOpenAI } from '@langchain/openai';
import {
  chatRepository,
  type ChatMessage,
  type ChatSession,
} from '@/db/chat.repository';
import { getChatSystemPrompt } from './chat-system-prompt';
import type { ModelConfig } from './llm.service';
import { getChatModel } from './llm.service';
import { logger } from '@/lib/logger';

/** 默认 2000 字；环境变量 CHAT_CONTEXT_CHAR_LIMIT 可覆盖 */
export const CONTEXT_CHAR_LIMIT = Number.parseInt(
  process.env.CHAT_CONTEXT_CHAR_LIMIT ?? '2000',
  10,
);

/** 专用摘要模型提示词（与 chat-system-prompt 人设分离） */
const SUMMARIZER_SYSTEM = `你是会话摘要助手。请用中文把给定内容压缩成简洁摘要。
要求：
1. 保留与用户身份、事实、偏好、待办、已达成结论相关的信息；
2. 不要编造；
3. 尽量控制在 800 字以内；
4. 只输出摘要正文，不要加标题或前缀。`;

export function getContextCharLimit(): number {
  return Number.isFinite(CONTEXT_CHAR_LIMIT) ? CONTEXT_CHAR_LIMIT : 2000;
}

/** 兼容旧会话 JSON：补全 summary / summaryThroughIndex 默认值 */
export function normalizeSession(session: ChatSession): ChatSession {
  const idx = session.summaryThroughIndex;
  return {
    ...session,
    summary: session.summary ?? '',
    summaryThroughIndex: typeof idx === 'number' ? idx : -1,
  };
}

/** 未摘要消息在 messages 数组中的起始下标 */
export function unsummarizedStartIndex(session: ChatSession): number {
  return (session.summaryThroughIndex ?? -1) + 1;
}

export function getUnsummarizedMessages(session: ChatSession): ChatMessage[] {
  return session.messages.slice(unsummarizedStartIndex(session));
}

/**
 * 判断是否超过字数阈值（决定是否启动「后台摘要」）。
 * 注意：超限时本轮仍可能用全量 messages 回答，此函数只用于分支，不用于阻塞。
 */
export function isContextOverLimit(session: ChatSession): boolean {
  const systemPrompt = getChatSystemPrompt();
  return computeContextCharCount(systemPrompt, session) > getContextCharLimit();
}

/** 当前「若走摘要路径」时，传给模型的上下文字符数 */
export function computeContextCharCount(
  systemPrompt: string,
  session: ChatSession,
): number {
  const summary = session.summary ?? '';
  const tailLen = getUnsummarizedMessages(session).reduce(
    (n, m) => n + m.content.length,
    0,
  );
  return systemPrompt.length + summary.length + tailLen;
}

function formatMessagesForSummarizer(messages: ChatMessage[]): string {
  return messages
    .map((m) => {
      const role =
        m.role === 'user' ? '用户' : m.role === 'assistant' ? '助手' : '系统';
      return `${role}：${m.content}`;
    })
    .join('\n\n');
}

/** 单次调用大模型：旧 summary + 一批消息 → 新 summary */
async function invokeSummarizer(
  model: ChatOpenAI,
  previousSummary: string,
  batch: ChatMessage[],
): Promise<string> {
  const parts: string[] = [];
  if (previousSummary.trim()) {
    parts.push(`【已有摘要】\n${previousSummary.trim()}`);
  }
  parts.push(`【待合并的新对话】\n${formatMessagesForSummarizer(batch)}`);

  const response = await model.invoke([
    new SystemMessage(SUMMARIZER_SYSTEM),
    new HumanMessage(parts.join('\n\n')),
  ]);

  const text =
    typeof response.content === 'string'
      ? response.content
      : Array.isArray(response.content)
        ? response.content
            .map((p) =>
              typeof p === 'string'
                ? p
                : p && typeof p === 'object' && 'text' in p
                  ? String(p.text)
                  : '',
            )
            .join('')
        : String(response.content);

  return text.trim();
}

/**
 * 滚动摘要主循环：超限时反复合并最老未摘要消息，直到字数合规或无法继续折叠。
 * 仅写 Redis，不返回给调用方拼 prompt（由 chat.service 决定本轮是否 useSummary）。
 */
async function runSessionContextCompaction(
  userId: string,
  sessionId: string,
  config: ModelConfig,
): Promise<void> {
  const systemPrompt = getChatSystemPrompt();
  const summarizer = getChatModel(config);
  const limit = getContextCharLimit();

  const raw = await chatRepository.getSession(userId, sessionId);
  if (!raw) {
    logger.error({ sessionId }, 'context compaction: session not found');
    return;
  }

  let session = normalizeSession(raw);
  const lastMessageIndex = session.messages.length - 1;

  while (computeContextCharCount(systemPrompt, session) > limit) {
    const through = session.summaryThroughIndex ?? -1;

    // 只剩当前 user 一条不能折，避免把正在问的问题吞进摘要
    if (through >= lastMessageIndex - 1) {
      logger.warn(
        {
          sessionId,
          charCount: computeContextCharCount(systemPrompt, session),
          limit,
        },
        'context compaction: cannot fold further, keeping latest user message',
      );
      break;
    }

    // 尽量一次多折几条，减少摘要 LLM 调用次数
    let endIdx = through + 1;
    while (
      endIdx < lastMessageIndex - 1 &&
      computeContextCharCount(systemPrompt, {
        ...session,
        summaryThroughIndex: endIdx,
      }) > limit
    ) {
      endIdx += 1;
    }

    const batch = session.messages.slice(through + 1, endIdx + 1);
    if (batch.length === 0) break;

    logger.info(
      {
        sessionId,
        foldFrom: through + 1,
        foldTo: endIdx,
        batchMessages: batch.length,
        beforeChars: computeContextCharCount(systemPrompt, session),
      },
      'context compaction: summarizing batch (background)',
    );

    const newSummary = await invokeSummarizer(
      summarizer,
      session.summary ?? '',
      batch,
    );

    session = {
      ...session,
      summary: newSummary,
      summaryThroughIndex: endIdx,
    };

    await chatRepository.updateSession(userId, sessionId, () => session);

    logger.info(
      {
        sessionId,
        summaryLength: newSummary.length,
        summaryThroughIndex: endIdx,
        afterChars: computeContextCharCount(systemPrompt, session),
      },
      'context compaction: summary saved to Redis',
    );
  }
}

/**
 * 后台摘要入口：与本轮回答并行执行，不阻塞 streamChatWithTools。
 * 失败只打日志，不影响用户已看到的回复。
 */
export function startSessionContextCompaction(
  userId: string,
  sessionId: string,
  config: ModelConfig,
): Promise<void> {
  return runSessionContextCompaction(userId, sessionId, config).catch(
    (error) => {
      logger.error(
        {
          sessionId,
          error: error instanceof Error ? error.message : String(error),
        },
        'context compaction failed',
      );
    },
  );
}

/** 阻塞版（测试或脚本用）；线上 chat 请用 startSessionContextCompaction */
export async function compactSessionContextIfNeeded(
  userId: string,
  sessionId: string,
  config: ModelConfig,
): Promise<ChatSession> {
  await runSessionContextCompaction(userId, sessionId, config);
  const session = await chatRepository.getSession(userId, sessionId);
  if (!session) throw new Error(`Session not found: ${sessionId}`);
  return normalizeSession(session);
}

export type BuildHistoryOptions = {
  /**
   * true（默认）：System 含 summary + 只传 summaryThroughIndex 之后的消息。
   * false：本轮触发了后台摘要 —— 不传 summary，逐条传全部 messages，保证回答不被摘要阻塞。
   */
  useSummary?: boolean;
};

/**
 * 把 Redis 会话转成 LangChain messages。
 * useSummary=false 时用于「超限时本轮全量回答」；下一轮改回 true 使用新 summary。
 */
export function buildHistoryMessagesFromSession(
  session: ChatSession,
  options: BuildHistoryOptions = {},
): BaseMessage[] {
  const useSummary = options.useSummary !== false;
  const normalized = normalizeSession(session);
  const messages: BaseMessage[] = [];

  const baseSystem = getChatSystemPrompt();

  if (useSummary) {
    const summary = normalized.summary?.trim() ?? '';
    const systemText = summary
      ? `${baseSystem}\n\n【此前对话摘要】\n${summary}`
      : baseSystem;
    if (systemText) {
      messages.push(new SystemMessage(systemText));
    }

    const start = unsummarizedStartIndex(normalized);
    for (let i = start; i < normalized.messages.length; i++) {
      pushChatMessage(messages, normalized.messages[i]);
    }
  } else {
    // 本轮：仅人设 System，不带 summary；历史全部逐条传入
    if (baseSystem) {
      messages.push(new SystemMessage(baseSystem));
    }
    for (const msg of normalized.messages) {
      pushChatMessage(messages, msg);
    }
  }

  return messages;
}

function pushChatMessage(out: BaseMessage[], msg: ChatMessage): void {
  if (msg.role === 'system') return;
  if (msg.role === 'user') {
    out.push(new HumanMessage(msg.content));
  } else if (msg.role === 'assistant') {
    out.push(new AIMessage(msg.content));
  } else {
    out.push(new HumanMessage(msg.content));
  }
}
