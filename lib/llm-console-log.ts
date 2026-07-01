/**
 * 大模型 / 工具调用 — 开发期控制台日志（醒目格式）
 *
 * 使用 console.log + ANSI 颜色，便于在 yarn dev 终端里一眼看到完整入参。
 * 生产环境可通过 LLM_DEBUG_LOG=false 关闭（默认 development 开启）。
 */

import type { BaseMessage } from '@langchain/core/messages';
import { AIMessage, ToolMessage } from '@langchain/core/messages';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const MAGENTA = '\x1b[35m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';

const ROLE_LABEL: Record<string, string> = {
  system: '系统 System',
  human: '用户 User',
  ai: '助手 Assistant',
  tool: '工具结果 Tool',
};

function isEnabled(): boolean {
  const flag = process.env.LLM_DEBUG_LOG?.trim().toLowerCase();
  if (flag === 'false' || flag === '0' || flag === 'off') return false;
  if (flag === 'true' || flag === '1' || flag === 'on') return true;
  return process.env.NODE_ENV === 'development';
}

function line(char = '═', width = 72): string {
  return char.repeat(width);
}

function extractMessageText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'type' in part) {
          const p = part as { type?: string; text?: string };
          if (p.type === 'text' && p.text != null) return String(p.text);
        }
        return JSON.stringify(part);
      })
      .join('');
  }
  if (content == null) return '';
  return String(content);
}

function formatToolCalls(msg: AIMessage): string {
  const calls = msg.tool_calls ?? [];
  if (calls.length === 0) return '';
  return calls
    .map((c, i) => {
      const args =
        typeof c.args === 'string'
          ? c.args
          : JSON.stringify(c.args ?? {}, null, 2);
      return `    ${DIM}#${i + 1}${RESET} ${MAGENTA}${c.name}${RESET}\n${args}`;
    })
    .join('\n');
}

function serializeMessages(messages: BaseMessage[]): string {
  return messages
    .map((msg, index) => {
      const type = msg.getType();
      const label = ROLE_LABEL[type] ?? type;
      const header = `${BOLD}${CYAN}[${index + 1}] ${label}${RESET}`;

      if (msg instanceof ToolMessage) {
        const text = extractMessageText(msg.content);
        const id = msg.tool_call_id
          ? `${DIM}(tool_call_id: ${msg.tool_call_id})${RESET}`
          : '';
        return `${header} ${id}\n${text}`;
      }

      if (msg instanceof AIMessage) {
        const text = extractMessageText(msg.content);
        const toolsBlock = formatToolCalls(msg);
        const parts = [header];
        if (text.trim()) parts.push(text);
        if (toolsBlock) {
          parts.push(`${YELLOW}  ↳ 本轮工具调用声明:${RESET}\n${toolsBlock}`);
        }
        if (!text.trim() && !toolsBlock) parts.push(`${DIM}(空内容)${RESET}`);
        return parts.join('\n');
      }

      const text = extractMessageText(msg.content);
      return `${header}\n${text || `${DIM}(空)${RESET}`}`;
    })
    .join('\n\n');
}

/** 每次向大模型发起 stream 之前打印完整 messages */
export function logLlmRequest(input: {
  sessionId: string;
  round: number;
  model?: string;
  messages: BaseMessage[];
  boundToolNames: string[];
}): void {
  if (!isEnabled()) return;

  const { sessionId, round, model, messages, boundToolNames } = input;

  console.log('');
  console.log(`${BOLD}${GREEN}${line()}${RESET}`);
  console.log(
    `${BOLD}${GREEN}  🤖 LLM 请求${RESET}  ${DIM}│${RESET} session=${sessionId}  round=${round}${model ? `  model=${model}` : ''}`,
  );
  console.log(`${BOLD}${GREEN}${line()}${RESET}`);
  console.log(
    `${YELLOW}已绑定工具:${RESET} ${boundToolNames.length ? boundToolNames.join(', ') : '(无)'}`,
  );
  console.log(`${YELLOW}消息条数:${RESET} ${messages.length}`);
  console.log(`${DIM}${line('─')}${RESET}`);
  console.log(serializeMessages(messages));
  console.log(`${DIM}${line('─')}${RESET}`);
  console.log('');
}

/** 服务端即将 invoke 工具时打印 */
export function logToolInvoke(input: {
  sessionId: string;
  round: number;
  toolName: string;
  args: unknown;
  toolCallId?: string;
}): void {
  if (!isEnabled()) return;

  const { sessionId, round, toolName, args, toolCallId } = input;
  const argsText =
    typeof args === 'string' ? args : JSON.stringify(args ?? {}, null, 2);

  console.log('');
  console.log(`${BOLD}${MAGENTA}${line('─')}${RESET}`);
  console.log(
    `${BOLD}${MAGENTA}  🔧 执行工具${RESET}  ${DIM}│${RESET} ${toolName}  ${DIM}session=${sessionId} round=${round}${toolCallId ? ` id=${toolCallId}` : ''}${RESET}`,
  );
  console.log(`${YELLOW}传入参数:${RESET}`);
  console.log(argsText);
  console.log(`${BOLD}${MAGENTA}${line('─')}${RESET}`);
  console.log('');
}

/** 工具返回后打印结果摘要 */
export function logToolResult(input: {
  sessionId: string;
  toolName: string;
  content: string;
  ok?: boolean;
}): void {
  if (!isEnabled()) return;

  const preview =
    input.content.length > 2000
      ? `${input.content.slice(0, 2000)}\n${DIM}…(已截断，共 ${input.content.length} 字符)${RESET}`
      : input.content;

  const status =
    input.ok === false ? `${RED}失败${RESET}` : `${GREEN}完成${RESET}`;

  console.log(
    `${DIM}  ↳ 工具 ${input.toolName} ${status}${RESET} ${DIM}(session=${input.sessionId})${RESET}`,
  );
  console.log(`${DIM}${preview}${RESET}`);
  console.log('');
}

/** 最终回答开始流式输出给前端时提示 */
export function logLlmFinalAnswerStart(input: {
  sessionId: string;
  round: number;
  previewLength: number;
}): void {
  if (!isEnabled()) return;

  console.log(
    `${BOLD}${CYAN}  ✨ 最终回答开始输出${RESET} ${DIM}session=${input.sessionId} round=${input.round} 约 ${input.previewLength} 字${RESET}`,
  );
}
