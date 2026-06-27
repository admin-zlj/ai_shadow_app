import type { NextRequest } from 'next/server';
import type { Middleware, RouteHandler, RequestContext } from './types';

export interface CorsOptions {
  origin?: string | string[];
  methods?: string[];
  headers?: string[];
  credentials?: boolean;
  maxAge?: number;
}

const defaultOptions: Required<CorsOptions> = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  headers: ['Content-Type', 'Authorization'],
  credentials: false,
  maxAge: 86400,
};

/**
 * 创建 CORS 中间件
 *
 * 使用方式:
 * const cors = createCorsMiddleware({ origin: 'http://localhost:3000' });
 * export const POST = createHandler([cors, loggingMiddleware, ...], handler);
 */
export function createCorsMiddleware(options: CorsOptions = {}): Middleware {
  const config = { ...defaultOptions, ...options };

  const getAllowedOrigin = (requestOrigin: string | null): string => {
    if (Array.isArray(config.origin)) {
      return requestOrigin && config.origin.includes(requestOrigin) ? requestOrigin : '';
    }
    return config.origin;
  };

  const setCorsHeaders = (response: Response, requestOrigin: string | null): Response => {
    const allowedOrigin = getAllowedOrigin(requestOrigin);
    if (!allowedOrigin) return response;

    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', allowedOrigin);
    headers.set('Access-Control-Allow-Methods', config.methods.join(', '));
    headers.set('Access-Control-Allow-Headers', config.headers.join(', '));
    headers.set('Access-Control-Max-Age', String(config.maxAge));

    if (config.credentials) {
      headers.set('Access-Control-Allow-Credentials', 'true');
    }

    if (Array.isArray(config.origin)) {
      headers.set('Vary', 'Origin');
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };

  return (next: RouteHandler) => {
    return async (request: NextRequest, context: RequestContext) => {
      const requestOrigin = request.headers.get('origin');

      // 处理 OPTIONS 预检请求
      if (request.method === 'OPTIONS') {
        const preflightResponse = new Response(null, { status: 204 });
        return setCorsHeaders(preflightResponse, requestOrigin);
      }

      // 正常请求：执行下游中间件，然后添加 CORS 头
      const response = await next(request, context);
      return setCorsHeaders(response, requestOrigin);
    };
  };
}

