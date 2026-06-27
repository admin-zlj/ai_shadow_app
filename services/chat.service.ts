/**
 * Service 层 — 对话业务编排
 *
 * 负责：创建对话记录 → 调用大模型 → 持久化对话 → 返回结果
 * 后续扩展 tool 时，可在此层引入 LangChain 的 Agent / bindTools 能力。
 */

import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { getChatModel, getModelConfig } from './llm.service';
import { chatRepository } from '@/db/chat.repository';
import { logger } from '@/lib/logger';

export interface ChatResult {
  content: string;
  role: 'assistant';
}

/**
 * 单次对话：接收用户问题和模型标识，调用大模型返回回答
 *
 * @param userMessage 用户的问题
 * @param modelKey 模型标识（可选，默认 qwen3.7）
 * @returns AI 回答内容
 */
export async function chat(
  userMessage: string,
  modelKey?: string,
): Promise<ChatResult> {
  // 1. 创建对话记录（DB 层）
  const conversation = chatRepository.createConversation();

  // 2. 根据模型标识从映射表加载配置，创建 LLM 模型并调用
  const config = getModelConfig(modelKey);
  const model = getChatModel(config);
  const response = await model.invoke([new HumanMessage(userMessage)]);

  const aiContent = response.content.toString();

  // 3. 持久化对话记录（DB 层）
  chatRepository.saveMessage(conversation.id, {
    role: 'user',
    content: userMessage,
    timestamp: Date.now(),
  });
  chatRepository.saveMessage(conversation.id, {
    role: 'assistant',
    content: aiContent,
    timestamp: Date.now(),
  });

  // 4. 返回 AI 回答
  return { content: aiContent, role: 'assistant' };
}

/**
 * 流式对话：接收消息数组和模型标识，流式返回 AI 回答
 *
 * @param messages 消息数组（含 role 和 content）
 * @param modelKey 模型标识（可选，默认 qwen3.7-plus）
 * @returns 异步生成器，逐块 yield 文本内容
 */
export async function* chatStream(
  messages: Array<{ role: string; content: string }>,
  modelKey?: string,
): AsyncGenerator<string> {
  // 1. 创建对话记录（DB 层）
  const conversation = chatRepository.createConversation();

  // 2. 根据模型标识从映射表加载配置，创建 LLM 模型
  const config = getModelConfig(modelKey);
  logger.info({ modelKey, model: config.model }, 'model config loaded');
  const model = getChatModel(config);

  // 3. 转换为 LangChain 消息格式
  const langchainMessages = messages.map((m) => {
    switch (m.role) {
      case 'system':
        return new SystemMessage(m.content);
      case 'assistant':
        return new AIMessage(m.content);
      default:
        return new HumanMessage(m.content);
    }
  });

  // 4. 持久化用户消息（DB 层）
  for (const m of messages) {
    chatRepository.saveMessage(conversation.id, {
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
      timestamp: Date.now(),
    });
  }

  // 5. 流式调用大模型，逐块 yield
  logger.info({ model: config.model, messageCount: langchainMessages.length }, 'LLM stream invoking');
  const stream = await model.stream(langchainMessages);
  let fullContent = '';

  for await (const chunk of stream) {
    const text = chunk.content.toString();
    fullContent += text;
    yield text;
  }

  // 6. 持久化 AI 回复（DB 层）
  logger.info({ contentLength: fullContent.length }, 'LLM stream completed');
  chatRepository.saveMessage(conversation.id, {
    role: 'assistant',
    content: fullContent,
    timestamp: Date.now(),
  });
}
