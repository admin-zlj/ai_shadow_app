/**
 * API 路由 — /api/sessions/:id
 *
 * GET    : 获取单个会话详情（含全部消息）
 * DELETE : 删除指定会话
 *
 * 请求头必填：X-User-Id、X-Auth-Token
 */

import type { NextRequest } from 'next/server';
import { chatRepository } from '@/db/chat.repository';
import { successResponse, errorResponse } from '@/lib/response';
import { generateTraceId } from '@/lib/trace-id';
import { authenticateRequest } from '@/lib/auth/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const traceId = generateTraceId();

  const auth = await authenticateRequest(request);
  if (!auth) {
    return errorResponse('Unauthorized', traceId, 401, { code: 'UNAUTHORIZED' });
  }

  try {
    const { id } = await params;
    const session = await chatRepository.getSession(auth.userId, id);

    if (!session) {
      return errorResponse('Session not found', traceId, 404);
    }

    return successResponse(session, traceId);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return errorResponse(msg, traceId, 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const traceId = generateTraceId();

  const auth = await authenticateRequest(request);
  if (!auth) {
    return errorResponse('Unauthorized', traceId, 401, { code: 'UNAUTHORIZED' });
  }

  try {
    const { id } = await params;
    await chatRepository.deleteSession(auth.userId, id);
    return successResponse({ deleted: true }, traceId);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return errorResponse(msg, traceId, 500);
  }
}
