/**
 * 百炼知识库检索 — POST /api/v1/indices/knowledge/search
 *
 * 请求体：{ query, agent_id }
 * 响应：data.nodes[].text / metadata（见 bailian.config.ts）
 */

import {
  BAILIAN_KNOWLEDGE_AGENT_ID,
  BAILIAN_KNOWLEDGE_SEARCH_URL,
  getBailianApiKey,
} from '@/services/bailian.config';

interface KnowledgeNode {
  score?: number;
  text?: string;
  metadata?: {
    title?: string;
    doc_name?: string;
    content?: string;
  };
}

interface KnowledgeSearchResponse {
  code?: string;
  success?: boolean;
  status?: string;
  message?: string;
  data?: {
    total?: number;
    nodes?: KnowledgeNode[];
  };
}

export async function queryBailianKnowledge(query: string): Promise<string> {
  let apiKey: string;
  try {
    apiKey = getBailianApiKey();
  } catch (error) {
    return JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const body = {
    query: query.trim(),
    agent_id: BAILIAN_KNOWLEDGE_AGENT_ID,
  };

  try {
    const res = await fetch(BAILIAN_KNOWLEDGE_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const raw = await res.text();
    let parsed: KnowledgeSearchResponse;
    try {
      parsed = JSON.parse(raw) as KnowledgeSearchResponse;
    } catch {
      return JSON.stringify({
        ok: false,
        status: res.status,
        error: '知识库返回非 JSON',
        raw,
      });
    }

    if (!res.ok) {
      return JSON.stringify({
        ok: false,
        status: res.status,
        error: parsed.message ?? parsed,
      });
    }

    const success =
      parsed.success === true ||
      parsed.code === 'Success' ||
      parsed.status === 'SUCCESS';

    if (!success) {
      return JSON.stringify({
        ok: false,
        error: parsed.message ?? '知识库检索失败',
        response: parsed,
      });
    }

    const nodes = parsed.data?.nodes ?? [];
    if (nodes.length === 0) {
      return JSON.stringify({
        ok: true,
        query,
        total: 0,
        message: '未检索到相关内容',
      });
    }

    const chunks = nodes.map((node, index) => ({
      index: index + 1,
      score: node.score,
      title: node.metadata?.title,
      doc_name: node.metadata?.doc_name,
      text:
        node.text?.trim() ||
        node.metadata?.content?.trim() ||
        '',
    }));

    return JSON.stringify({
      ok: true,
      query,
      total: parsed.data?.total ?? chunks.length,
      chunks,
    });
  } catch (error) {
    return JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
