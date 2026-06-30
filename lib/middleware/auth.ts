import type { NextRequest } from 'next/server';
import type { Middleware } from './types';
import { authenticateRequest } from '@/lib/auth/server';
import { errorResponse } from '@/lib/response';

/**
 * 校验 X-User-Id + X-Auth-Token，通过后写入 context.authUserId
 */
export function createAuthMiddleware(): Middleware {
  return (next) => {
    return async (request: NextRequest, context) => {
      const auth = await authenticateRequest(request);
      if (!auth) {
        return errorResponse('Unauthorized', context.traceId, 401, {
          code: 'UNAUTHORIZED',
        });
      }
      context.authUserId = auth.userId;
      return next(request, context);
    };
  };
}
