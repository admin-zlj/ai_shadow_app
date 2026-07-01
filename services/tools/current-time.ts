/**
 * 当前时间（工具 2 的底层实现）
 *
 * 在服务器上取 Date，按时区格式化成中文可读字符串。
 * 默认时区：参数 timezone > 环境变量 APP_TIMEZONE > Asia/Shanghai
 *
 * 返回 JSON 字符串，字段说明：
 *   iso     — UTC 时间（ISO8601）
 *   local   — 指定时区的本地时间（给用户看）
 *   unixMs  — 毫秒时间戳
 */

export function getCurrentTimePayload(timezone?: string): string {
  const tz =
    timezone?.trim() ||
    process.env.APP_TIMEZONE?.trim() ||
    'Asia/Shanghai';

  const now = new Date();
  let localFormatted: string;
  try {
    localFormatted = new Intl.DateTimeFormat('zh-CN', {
      timeZone: tz,
      dateStyle: 'full',
      timeStyle: 'long',
    }).format(now);
  } catch {
    return JSON.stringify({
      ok: false,
      error: `无效时区: ${tz}`,
      iso: now.toISOString(),
    });
  }

  return JSON.stringify({
    ok: true,
    timezone: tz,
    iso: now.toISOString(),
    local: localFormatted,
    unixMs: now.getTime(),
  });
}
