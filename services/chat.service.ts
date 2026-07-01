/**
 * ============================================================================
 * chat-ins 对话主流程（业务编排层）
 * ============================================================================
 *
 * 谁调用我？
 *   app/api/chat-ins/route.ts → chatStream() → SSE
 *
 * 步骤：
 *   1. 写 user 消息到 Redis
 *   2. 首条消息更新会话标题
 *   3. 若上下文超字数：
 *        - 后台 startSessionContextCompaction()（不 await）
 *        - 本轮 buildHistoryMessagesFromSession({ useSummary: false }) 全量回答
 *      否则：
 *        - 使用 summary + 未摘要消息
 *   4. streamChatWithTools 流式回答并 yield
 *   5. assistant 落库
 *   6. 若步骤 3 启动了摘要，await 其完成后再结束（接口依赖两者都完成）
 * ============================================================================
 */

import { getChatModel, getModelConfig } from './llm.service';
import {
  buildHistoryMessagesFromSession,
  computeContextCharCount,
  CONTEXT_CHAR_LIMIT,
  getContextCharLimit,
  isContextOverLimit,
  normalizeSession,
  startSessionContextCompaction,
} from './chat-context-summary';
import { getChatSystemPrompt } from './chat-system-prompt';
import { streamChatWithTools } from './chat-agent.stream';
import { chatRepository } from '@/db/chat.repository';
import { logger } from '@/lib/logger';

export async function* chatStream(
  userId: string,
  userMessage: string,
  sessionId: string,
  modelKey?: string,
): AsyncGenerator<string> {
  const config = getModelConfig(modelKey);
  logger.info({ modelKey, model: config.model, sessionId }, 'model config loaded');
  const model = getChatModel(config);

  await chatRepository.appendMessage(userId, sessionId, {
    role: 'user',
    content: userMessage,
    timestamp: Date.now(),
  });

  const rawSession = await chatRepository.getSession(userId, sessionId);
  if (rawSession && rawSession.messages.length <= 1) {
    const title = userMessage.slice(0, 20) + (userMessage.length > 20 ? '...' : '');
    await chatRepository.updateTitle(userId, sessionId, title);
  }

  const session = normalizeSession(rawSession!);
  const systemPrompt = getChatSystemPrompt();
  const overLimit = isContextOverLimit(session);

  /** 超限时在后台写 summary；本轮不等待，且回答时不使用 summary */
  let summaryTask: Promise<void> | null = null;
  if (overLimit) {
    logger.info(
      {
        sessionId,
        contextChars: computeContextCharCount(systemPrompt, session),
        contextLimit: getContextCharLimit(),
      },
      'context over limit: compaction runs in parallel; this round uses full history without summary',
    );
    summaryTask = startSessionContextCompaction(userId, sessionId, config);
  }

  const historyMessages = buildHistoryMessagesFromSession(session, {
    useSummary: !overLimit,
  });

  logger.info(
    {
      model: config.model,
      sessionId,
      historyCount: historyMessages.length,
      useSummary: !overLimit,
      contextChars: computeContextCharCount(systemPrompt, session),
      contextLimit: CONTEXT_CHAR_LIMIT,
    },
    'LLM stream invoking with tools',
  );

  let fullContent = '';
  for await (const chunk of streamChatWithTools(model, historyMessages, {
    sessionId,
    model: config.model,
  })) {
    fullContent += chunk;
    yield chunk;
  }

  logger.info({ sessionId, contentLength: fullContent.length }, 'LLM stream completed');
  await chatRepository.appendMessage(userId, sessionId, {
    role: 'assistant',
    content: fullContent,
    timestamp: Date.now(),
  });

  // 摘要与回答都完成后，再结束 generator（SSE [DONE]）
  if (summaryTask) {
    logger.info({ sessionId }, 'awaiting background context compaction');
    await summaryTask;
    logger.info({ sessionId }, 'background context compaction finished');
  }
}
