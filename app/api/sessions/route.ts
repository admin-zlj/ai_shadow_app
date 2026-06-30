/**
 * API 路由 — /api/sessions
 *
 * GET  : 获取当前用户的会话列表（不含消息内容）
 * POST : 创建新会话
 *
 * 请求头必填：X-User-Id、X-Auth-Token
 */

import type { NextRequest } from 'next/server';
import { chatRepository } from '@/db/chat.repository';
import { successResponse } from '@/lib/response';
import {
  createHandler,
  loggingMiddleware,
  errorHandlingMiddleware,
  createCorsMiddleware,
} from '@/lib/middleware';
import { createAuthMiddleware } from '@/lib/middleware/auth';
import type { RequestContext } from '@/lib/middleware';

const cors = createCorsMiddleware({ origin: '*' });
const auth = createAuthMiddleware();

async function listSessionsHandler(
  _request: NextRequest,
  context: RequestContext,
): Promise<Response> {
  const userId = context.authUserId as string;
  const sessions = await chatRepository.getAllSessions(userId);
  return successResponse(sessions, context.traceId);
}

async function createSessionHandler(
  _request: NextRequest,
  context: RequestContext,
): Promise<Response> {
  const userId = context.authUserId as string;
  const session = await chatRepository.createSession(userId);
  const { id, title, createdAt } = session;
  return successResponse({ id, title, createdAt }, context.traceId, 201);
}

export const GET = createHandler(
  [cors, loggingMiddleware, auth, errorHandlingMiddleware],
  listSessionsHandler,
);

export const POST = createHandler(
  [cors, loggingMiddleware, auth, errorHandlingMiddleware],
  createSessionHandler,
);

export const OPTIONS = createHandler(
  [cors],
  async () => new Response(null, { status: 204 }),
);
