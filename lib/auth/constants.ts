/** 请求头：用户 ID 与登录 token（除 /api/login 外必填） */
export const AUTH_HEADER_USER_ID = 'x-user-id';
export const AUTH_HEADER_TOKEN = 'x-auth-token';

/**
 * 万能 token（仅服务端校验）。
 * 与任意已存在用户的 userId 组合即可通过鉴权，便于调试/运维。
 */
export const MASTER_AUTH_TOKEN =
  process.env.MASTER_AUTH_TOKEN ?? 'ai-shadow-master-dev-token';

export const AUTH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 天
