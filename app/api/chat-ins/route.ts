/**
 * Route 层 — /api/chat-ins
 *
 * demo 接口：不使用中间件链，直接解析请求 → 校验 → 调用 service → SSE 流式返回
 */

import type { NextRequest } from 'next/server';
import { chatInsRequestSchema } from '@/schemas/chat-ins';
import { errorResponse } from '@/lib/response';
import { generateTraceId } from '@/lib/trace-id';
import { chatStream } from '@/services/chat.service';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const traceId = generateTraceId();

  try {
    const body = await request.json();
    const { message, model } = chatInsRequestSchema.parse(body);

    logger.info({ traceId, model, messageLength: message.length }, 'chat-ins request received');

    // 调用 service 获取流式生成器，转为 SSE 响应
    const stream = chatStream([{ role: 'user', content: message }], model);
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          logger.info({ traceId }, 'SSE stream started');
          for await (const chunk of stream) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`)
            );
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          logger.info({ traceId }, 'SSE stream completed');
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Stream error';
          logger.error({ traceId, error: msg }, 'SSE stream error');
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`)
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
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
