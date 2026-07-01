/**
 * Route 层 — POST /api/chat-ins
 *
 * 调用链（从外到内）：
 *   浏览器 fetch(SSE) → 本文件 → chat.service.chatStream()
 *        → chat-agent.stream.streamChatWithTools()（工具循环）
 *        → llm.service + tools/*
 *
 * 本文件只做：鉴权、校验 body、把 service 吐出的文本块包成 SSE 事件。
 * 业务逻辑（Redis、System Prompt、工具）都在 services/ 里。
 */

import type { NextRequest } from 'next/server';
import { chatInsRequestSchema } from '@/schemas/chat-ins';
import { errorResponse } from '@/lib/response';
import { generateTraceId } from '@/lib/trace-id';
import { chatStream } from '@/services/chat.service';
import { logger } from '@/lib/logger';
import { authenticateRequest } from '@/lib/auth/server';
import { chatRepository } from '@/db/chat.repository';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const traceId = generateTraceId();

  const auth = await authenticateRequest(request);
  if (!auth) {
    const response = errorResponse('Unauthorized', traceId, 401, {
      code: 'UNAUTHORIZED',
    });
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  }

  try {
    const body = await request.json();
    const { message, sessionId, model } = chatInsRequestSchema.parse(body);

    const session = await chatRepository.getSession(auth.userId, sessionId);
    if (!session) {
      const response = errorResponse('Session not found', traceId, 404);
      response.headers.set('Access-Control-Allow-Origin', '*');
      return response;
    }

    logger.info(
      { traceId, model, sessionId, messageLength: message.length },
      'chat-ins request received',
    );

    const stream = chatStream(auth.userId, message, sessionId, model);
    const encoder = new TextEncoder();

    // ReadableStream：每从 chatStream yield 一段文字，就推一条 SSE data 行给前端
    const readable = new ReadableStream({
      async start(controller) {
        try {
          logger.info({ traceId }, 'SSE stream started');
          for await (const chunk of stream) {
            if (chunk.length === 0) continue;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`),
            );
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          logger.info({ traceId }, 'SSE stream completed');
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Stream error';
          logger.error({ traceId, error: msg }, 'SSE stream error');
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    const response = errorResponse(msg, traceId, 500);
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  }
}
