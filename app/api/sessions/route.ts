/**
 * API 路由 — /api/sessions
 *
 * GET  : 获取所有会话列表（不含消息内容）
 * POST : 创建新会话
 */

import type { NextRequest } from 'next/server';
import { chatRepository } from '@/db/chat.repository';
import { successResponse, errorResponse } from '@/lib/response';
import { generateTraceId } from '@/lib/trace-id';

export async function GET() {
  const traceId = generateTraceId();

  try {
    const sessions = await chatRepository.getAllSessions();
    return successResponse(sessions, traceId);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return errorResponse(msg, traceId, 500);
  }
}

export async function POST(_request: NextRequest) {
  const traceId = generateTraceId();

  try {
    const session = await chatRepository.createSession();
    return successResponse(session, traceId, 201);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return errorResponse(msg, traceId, 500);
  }
}
