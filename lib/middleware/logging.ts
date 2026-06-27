import type { NextRequest } from 'next/server';
import { logger } from '@/lib/logger';
import type { RouteHandler, Middleware, RequestContext } from './types';

export const loggingMiddleware: Middleware = (next: RouteHandler) => {
  return async (request: NextRequest, context: RequestContext) => {
    const { traceId, startTime } = context;
    const method = request.method;
    const url = request.nextUrl.pathname;

    logger.info({ traceId, method, url }, 'Request received');

    try {
      const response = await next(request, context);
      const duration = Date.now() - startTime;

      logger.info(
        { traceId, method, url, status: response.status, duration },
        'Request completed'
      );

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(
        {
          traceId,
          method,
          url,
          duration,
          error: error instanceof Error ? error.message : String(error),
        },
        'Request failed'
      );
      throw error;
    }
  };
};
