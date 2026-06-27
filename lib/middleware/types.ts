import type { NextRequest } from 'next/server';

// 请求上下文：在中间件间传递的共享数据
export interface RequestContext {
  traceId: string; // 请求ID，用于标识请求
  startTime: number; // 请求开始时间
  validatedData?: unknown; // 验证后的数据
  [key: string]: unknown;
}

// 中间件处理器类型
export type RouteHandler = (
  request: NextRequest,
  context: RequestContext
) => Promise<Response>;

// 中间件类型（接收下一个处理器，返回新的处理器）
export type Middleware = (next: RouteHandler) => RouteHandler;
