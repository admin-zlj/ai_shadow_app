/**
 * API 路由 — /api/login
 *
 * POST: 用户名密码登录，返回 userId + token（无需注册）
 */

import type { NextRequest } from 'next/server';
import {
  createHandler,
  loggingMiddleware,
  createValidationMiddleware,
  errorHandlingMiddleware,
  createCorsMiddleware,
} from '@/lib/middleware';
import type { RequestContext } from '@/lib/middleware';
import { loginRequestSchema } from '@/schemas/login';
import { successResponse, errorResponse } from '@/lib/response';
import { issueToken, verifyLogin } from '@/db/auth.repository';

const cors = createCorsMiddleware({ origin: '*' });

const validateLogin = createValidationMiddleware({
  schema: loginRequestSchema,
  source: 'body',
});

async function loginHandler(
  _request: NextRequest,
  context: RequestContext,
): Promise<Response> {
  const { username, password } = context.validatedData as {
    username: string;
    password: string;
  };

  const user = await verifyLogin(username, password);
  if (!user) {
    return errorResponse('Invalid username or password', context.traceId, 401, {
      code: 'INVALID_CREDENTIALS',
    });
  }

  const token = await issueToken(user.id);

  return successResponse(
    {
      userId: user.id,
      username: user.username,
      token,
    },
    context.traceId,
  );
}

export const POST = createHandler(
  [cors, loggingMiddleware, validateLogin, errorHandlingMiddleware],
  loginHandler,
);

export const OPTIONS = createHandler(
  [cors],
  async () => new Response(null, { status: 204 }),
);
