/**
 * 生成唯一的 traceId，用于贯穿请求生命周期的链路追踪
 */
export function generateTraceId(): string {
  return `trace-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
