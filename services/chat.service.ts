/**
 * Service 层 — 对话业务编排
 *
 * 负责：保存用户消息 → 调用大模型流式 → 持久化 AI 回复
 * 数据通过 Redis 仓库持久化，不再使用内存存储。
 */

import { HumanMessage, AIMessage, SystemMessage, type BaseMessage } from '@langchain/core/messages';
import { getChatModel, getModelConfig } from './llm.service';
import { chatRepository, type ChatMessage } from '@/db/chat.repository';
import { logger } from '@/lib/logger';

/**
 * 流式对话：接收用户消息、会话ID和模型标识，流式返回 AI 回答
 *
 * @param userMessage 用户的问题
 * @param sessionId 会话ID（由前端通过 POST /api/sessions 创建）
 * @param modelKey 模型标识（可选，默认 qwen3.7-plus）
 * @returns 异步生成器，逐块 yield 文本内容
 */
export async function* chatStream(
  userMessage: string,
  sessionId: string,
  modelKey?: string,
): AsyncGenerator<string> {
  // 1. 根据模型标识从映射表加载配置，创建 LLM 模型
  const config = getModelConfig(modelKey);
  logger.info({ modelKey, model: config.model, sessionId }, 'model config loaded');
  const model = getChatModel(config);

  // 2. 持久化用户消息到 Redis
  await chatRepository.appendMessage(sessionId, {
    role: 'user',
    content: userMessage,
    timestamp: Date.now(),
  });

  // 3. 如果是第一条消息，更新会话标题
  const session = await chatRepository.getSession(sessionId);
  if (session && session.messages.length <= 1) {
    const title = userMessage.slice(0, 20) + (userMessage.length > 20 ? '...' : '');
    await chatRepository.updateTitle(sessionId, title);
  }

  // 4. 加载历史消息，构造完整消息列表传给大模型
  const historyMessages: BaseMessage[] = (session?.messages ?? []).map(toLangChainMessage);
  historyMessages.push(new HumanMessage(userMessage));

  logger.info({ model: config.model, sessionId, historyCount: historyMessages.length }, 'LLM stream invoking');
  const stream = await model.stream(historyMessages);
  let fullContent = '';

  for await (const chunk of stream) {
    const text = chunk.content.toString();
    fullContent += text;
    yield text;
  }

  // 5. 持久化 AI 回复到 Redis
  logger.info({ sessionId, contentLength: fullContent.length }, 'LLM stream completed');
  await chatRepository.appendMessage(sessionId, {
    role: 'assistant',
    content: fullContent,
    timestamp: Date.now(),
  });
}

/** 将仓库中的 ChatMessage 转为 LangChain BaseMessage */
function toLangChainMessage(msg: ChatMessage): BaseMessage {
  switch (msg.role) {
    case 'user':
      return new HumanMessage(msg.content);
    case 'assistant':
      return new AIMessage(msg.content);
    case 'system':
      return new SystemMessage(msg.content);
    default:
      return new HumanMessage(msg.content);
  }
}
