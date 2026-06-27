import type { NextRequest } from 'next/server';
import type { RouteHandler, Middleware, RequestContext } from './types';
import { generateTraceId } from '@/lib/trace-id';

/**
 * 创建一个带有中间件链的路由处理器
 *
 * 使用方式:
 * export const POST = createHandler(
 *   [loggingMiddleware, validationMiddleware, errorHandlingMiddleware],
 *   async (request, context) => {
 *     return Response.json({ data: '...' });
 *   }
 * );
 */
export function createHandler(
  middlewares: Middleware[],
  finalHandler: RouteHandler
): (request: NextRequest) => Promise<Response> {
  // 构建中间件链（从后向前组合，执行顺序从左到右）
  const chainedHandler = middlewares.reduceRight<RouteHandler>(
    (next, middleware) => middleware(next),
    finalHandler
  );

  return async (request: NextRequest) => {
    const requestContext: RequestContext = {
      traceId: generateTraceId(),
      startTime: Date.now(),
    };

    return chainedHandler(request, requestContext);
  };
}
