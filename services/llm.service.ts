/**
 * Service 层 — LLM 服务（LangChain 模型工厂）
 *
 * apiKey / baseURL 与百炼知识库共用同一 MaaS 实例，见 bailian.config.ts
 */

import { ChatOpenAI } from '@langchain/openai';
import {
  BAILIAN_LLM_BASE_URL,
  getBailianApiKey,
} from '@/services/bailian.config';

/** 大模型配置项 */
export interface ModelConfig {
  apiKey: string;
  baseURL: string;
  model: string;
}

/** 默认模型标识 */
export const DEFAULT_MODEL_KEY = 'qwen3.7-plus';

const modelRegistry: Record<string, Omit<ModelConfig, 'apiKey' | 'baseURL'>> = {
  'qwen3.7-plus': {
    model: 'qwen3.7-plus',
  },
};

export function getModelConfig(modelKey?: string): ModelConfig {
  const key = modelKey || DEFAULT_MODEL_KEY;
  const entry = modelRegistry[key];
  if (!entry) {
    throw new Error(`Model not found: ${key}`);
  }
  return {
    apiKey: getBailianApiKey(),
    baseURL: BAILIAN_LLM_BASE_URL,
    model: entry.model,
  };
}

export function getChatModel(config: ModelConfig): ChatOpenAI {
  return new ChatOpenAI({
    model: config.model,
    apiKey: config.apiKey,
    configuration: {
      baseURL: config.baseURL,
    },
  });
}
