/**
 * Service 层 — LLM 服务（LangChain 模型工厂）
 *
 * 通过模型映射表管理多模型配置，前端传入模型标识（key）即可加载对应配置。
 * apiKey / baseURL / model 请在下方映射表中填写。
 */

import { ChatOpenAI } from "@langchain/openai";

/** 大模型配置项 */
export interface ModelConfig {
  apiKey: string;
  baseURL: string;
  model: string;
}

/** 默认模型标识 */
export const DEFAULT_MODEL_KEY = "qwen3.7-plus";

/**
 * 模型映射表
 * key 为模型标识（前端请求传入），value 为实际大模型配置
 * TODO: 请填写各模型的 apiKey / baseURL / model
 */
const modelRegistry: Record<string, ModelConfig> = {
  "qwen3.7-plus": {
    apiKey: "sk-5e5a16c8dc9145f59a4afff837f0b3a7",
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen3.7-plus",
  },
};

/**
 * 根据模型标识获取配置
 *
 * @param modelKey 模型标识，未传则使用默认值 qwen3.7
 * @throws 模型标识不存在时抛出错误
 */
export function getModelConfig(modelKey?: string): ModelConfig {
  const key = modelKey || DEFAULT_MODEL_KEY;
  const config = modelRegistry[key];
  if (!config) {
    throw new Error(`Model not found: ${key}`);
  }
  return config;
}

/**
 * 根据配置创建 ChatOpenAI 模型实例
 *
 * @param config 大模型配置
 */
export function getChatModel(config: ModelConfig): ChatOpenAI {
  return new ChatOpenAI({
    model: config.model,
    apiKey: config.apiKey,
    configuration: {
      baseURL: config.baseURL,
    },
  });
}
