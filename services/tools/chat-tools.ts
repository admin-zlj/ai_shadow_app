/**
 * ============================================================================
 * AI 工具注册表（给 LangChain / 大模型看的「函数清单」）
 * ============================================================================
 *
 * tool(...) 会做三件事：
 *   1. name        → 模型调用时的函数名（必须稳定，和 chatToolsByName 的 key 一致）
 *   2. description → 告诉模型「什么时候该用这个工具」（很重要，相当于 prompt 的一部分）
 *   3. schema      → Zod 定义参数；LangChain 会转成 JSON Schema 发给模型
 *
 * 模型决定调用后，chat-agent.stream.ts 里会：
 *   toolImpl.invoke(call.args) → 执行下面 async 函数 → 返回字符串（通常是 JSON）
 *
 * 新增工具步骤：
 *   1. 在 tools/ 下写 client（真正请求 HTTP 或算逻辑）
 *   2. 在此文件用 tool() 包一层
 *   3.  push 进 chatTools 数组
 * ============================================================================
 */

import { tool } from '@langchain/core/tools';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { z } from 'zod';
import { queryBailianKnowledge } from './bailian-knowledge.client';
import { getCurrentTimePayload } from './current-time';
import { queryCityWeather as fetchCityWeather } from './weather.client';

/** 工具 1：百炼外部知识库（HTTP，URL 在环境变量里配） */
export const queryExternalKnowledgeBase = tool(
  async ({ query }) => queryBailianKnowledge(query),
  {
    name: 'query_external_knowledge_base',
    description:
      '从阿里云百炼外部知识库检索与张留杰相关的资料。当用户询问个人信息、经历、项目、观点等且需要准确依据时，应优先调用此工具。',
    schema: z.object({
      query: z.string().describe('检索关键词或自然语言问句'),
    }),
  },
);

/** 工具 2：服务器当前时间（不联网，用 Node 本机时钟 + 时区） */
export const queryCurrentTime = tool(
  async ({ timezone }) => getCurrentTimePayload(timezone),
  {
    name: 'query_current_time',
    description:
      '查询当前日期与时间。用户问现在几点、今天几号、当前时间等时使用。可选指定 IANA 时区，如 Asia/Shanghai。',
    schema: z.object({
      timezone: z
        .string()
        .optional()
        .describe('IANA 时区，默认 Asia/Shanghai'),
    }),
  },
);

/** 工具 3：城市天气（Open-Meteo 免费 API，无需 key） */
export const queryCityWeatherTool = tool(
  async ({ city }) => fetchCityWeather(city),
  {
    name: 'query_city_weather',
    description:
      '查询指定城市的当前天气（气温、湿度、风力、天气现象）。用户问某地天气时使用；city 传中文或英文城市名。',
    schema: z.object({
      city: z.string().describe('城市名称，例如：北京、上海、杭州'),
    }),
  },
);

/** 绑定到模型上的完整工具列表（顺序无严格要求） */
export const chatTools: StructuredToolInterface[] = [
  queryExternalKnowledgeBase,
  queryCurrentTime,
  queryCityWeatherTool,
];

/** 模型返回 tool_call.name 后，用这个名字 O(1) 找到实现 */
export const chatToolsByName: Record<string, StructuredToolInterface> =
  Object.fromEntries(chatTools.map((t) => [t.name, t]));
