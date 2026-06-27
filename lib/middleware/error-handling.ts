import type { NextRequest } from 'next/server';
import { logger } from '@/lib/logger';
import { errorResponse } from '@/lib/response';
import type { Middleware, RouteHandler, RequestContext } from './types';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const errorHandlingMiddleware: Middleware = (next: RouteHandler) => {
  return async (request: NextRequest, context: RequestContext) => {
    try {
      return await next(request, context);
    } catch (error) {
      const { traceId } = context;

      if (error instanceof ApiError) {
        logger.warn(
          { traceId, statusCode: error.statusCode, code: error.code, message: error.message },
          'API error'
        );
        return errorResponse(error.message, context.traceId, error.statusCode, { code: error.code });
      }

      if (error instanceof SyntaxError) {
        logger.warn({ traceId, message: error.message }, 'Invalid request format');
        return errorResponse('Invalid request format', context.traceId, 400);
      }

      logger.error(
        {
          traceId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        'Unhandled error'
      );

      return errorResponse('Internal server error', context.traceId, 500);
    }
  };
};
