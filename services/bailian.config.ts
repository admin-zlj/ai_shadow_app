/**
 * 阿里云百炼 / MaaS 统一配置（Demo：Key / Agent ID 写在源码；环境变量可覆盖）
 *
 * 知识库：POST {MAAS_ORIGIN}/api/v1/indices/knowledge/search
 * 对话 LLM：{MAAS_ORIGIN}/compatible-mode/v1
 */

/** Demo 用 API Key（与 curl 测试一致；生产请改环境变量） */
const DEMO_BAILIAN_API_KEY =
  'sk-ws-H.RXLHDMD.W4G1.MEQCIFiGysGgbXOXXxd0R1rEOUvtFTzU8IzbhESJT36bb9lfAiBhy-1LzmIw5pvYtAceo59s9h6l86TZV-cJ8oGSauPs4g';

/** Demo 知识库 agent_id */
const DEMO_BAILIAN_KNOWLEDGE_AGENT_ID =
  'aid-1231a50cd84e4639aefaa4b61abed152';

const DEMO_BAILIAN_MAAS_ORIGIN =
  'https://llm-gczpgy4dlf4lhtln.cn-beijing.maas.aliyuncs.com';

export const BAILIAN_MAAS_ORIGIN =
  process.env.BAILIAN_MAAS_ORIGIN?.trim() || DEMO_BAILIAN_MAAS_ORIGIN;

export const BAILIAN_KNOWLEDGE_SEARCH_URL =
  process.env.BAILIAN_KNOWLEDGE_API_URL?.trim() ||
  `${BAILIAN_MAAS_ORIGIN}/api/v1/indices/knowledge/search`;

export const BAILIAN_LLM_BASE_URL =
  process.env.BAILIAN_LLM_BASE_URL?.trim() ||
  `${BAILIAN_MAAS_ORIGIN}/compatible-mode/v1`;

export const BAILIAN_KNOWLEDGE_AGENT_ID =
  process.env.BAILIAN_KNOWLEDGE_AGENT_ID?.trim() ||
  DEMO_BAILIAN_KNOWLEDGE_AGENT_ID;

export function getBailianApiKey(): string {
  return (
    process.env.BAILIAN_API_KEY?.trim() ||
    process.env.DASHSCOPE_API_KEY?.trim() ||
    DEMO_BAILIAN_API_KEY
  );
}
