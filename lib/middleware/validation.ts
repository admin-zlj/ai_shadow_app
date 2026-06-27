import type { NextRequest } from 'next/server';
import type { ZodSchema } from 'zod';
import { logger } from '@/lib/logger';
import { errorResponse } from '@/lib/response';
import type { Middleware, RouteHandler, RequestContext } from './types';

interface ValidatorConfig {
  schema: ZodSchema;
  source?: 'body' | 'query';
}

/**
 * 创建校验中间件
 *
 * 使用方式:
 * const validator = createValidationMiddleware({ schema: chatRequestSchema });
 */
export function createValidationMiddleware(config: ValidatorConfig): Middleware {
  const { schema, source = 'body' } = config;

  return (next: RouteHandler) => {
    return async (request: NextRequest, context: RequestContext) => {
      let dataToValidate: unknown;

      if (source === 'query') {
        dataToValidate = Object.fromEntries(request.nextUrl.searchParams);
      } else {
        dataToValidate = await request.clone().json();
      }

      const result = schema.safeParse(dataToValidate);

      if (!result.success) {
        const fieldErrors = result.error.flatten().fieldErrors as Record<string, string[]>;
        const firstField = Object.keys(fieldErrors)[0];
        const firstError = firstField ? fieldErrors[firstField]?.[0] : 'Invalid request';
        const message = firstError || 'Invalid request';

        logger.warn(
          { traceId: context.traceId, source, errors: fieldErrors },
          'Validation failed'
        );
        return errorResponse(
          message,
          context.traceId,
          400,
          { details: fieldErrors }
        );
      }

      context.validatedData = result.data;
      return next(request, context);
    };
  };
}
