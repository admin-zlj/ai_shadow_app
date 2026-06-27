import type { RequestContext } from '@/lib/middleware/types';

export interface SuccessResponse<T = unknown> {
  data: T;
  traceId: string;
  success: true;
}

export interface ErrorResponse {
  traceId: string;
  success: false;
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

/**
 * 创建成功响应
 */
export function successResponse<T>(data: T, traceId: string, status = 200): Response {
  const body: SuccessResponse<T> = {
    data,
    traceId,
    success: true
  };
  return Response.json(body, { status });
}

/**
 * 创建失败响应
 */
export function errorResponse(
  message: string,
  traceId: string,
  status = 500,
  options?: { code?: string; details?: unknown }
): Response {
  const error: ErrorResponse['error'] = { message };
  if (options?.code) error.code = options.code;
  if (options?.details) error.details = options.details;

  const body: ErrorResponse = {
    traceId,
    success: false,
    error
  };
  return Response.json(body, { status });
}
