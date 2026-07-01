/**
 * 认证数据（Redis）
 *
 * auth:user:{username}     → JSON { id, username, password }
 * auth:user:by-id:{id}     → username
 * auth:token:{token}       → userId
 */

import { randomUUID } from "crypto";
import { getRedis } from "./redis";
import {
  AUTH_TOKEN_TTL_SECONDS,
  MASTER_AUTH_TOKEN,
} from "@/lib/auth/constants";

export interface AuthUserRecord {
  id: string;
  username: string;
  password: string;
}

const USER_KEY = (username: string) => `auth:user:${username}`;
const USER_BY_ID_KEY = (id: string) => `auth:user:by-id:${id}`;
const TOKEN_KEY = (token: string) => `auth:token:${token}`;

/** 预置账号（写入 Redis 的种子数据） */
export const SEED_USERS: AuthUserRecord[] = [
  { id: "1", username: "admin", password: "admin886" },
  { id: "3", username: "user3", password: "user3" },
  { id: "8", username: "user8", password: "user8" },
];

export async function seedAuthUsers(): Promise<void> {
  const redis = getRedis();
  const pipeline = redis.pipeline();

  for (const user of SEED_USERS) {
    pipeline.set(USER_KEY(user.username), JSON.stringify(user));
    pipeline.set(USER_BY_ID_KEY(user.id), user.username);
  }

  await pipeline.exec();
}

export async function getUserByUsername(
  username: string,
): Promise<AuthUserRecord | null> {
  const raw = await getRedis().get(USER_KEY(username));
  if (!raw) return null;
  return JSON.parse(raw) as AuthUserRecord;
}

export async function getUserById(id: string): Promise<AuthUserRecord | null> {
  const username = await getRedis().get(USER_BY_ID_KEY(id));
  if (!username) return null;
  return getUserByUsername(username);
}

export async function verifyLogin(
  username: string,
  password: string,
): Promise<AuthUserRecord | null> {
  const user = await getUserByUsername(username);
  if (!user || user.password !== password) return null;
  return user;
}

export async function issueToken(userId: string): Promise<string> {
  const token = randomUUID();
  await getRedis().set(TOKEN_KEY(token), userId, "EX", AUTH_TOKEN_TTL_SECONDS);
  return token;
}

export async function validateTokenForUser(
  userId: string,
  token: string,
): Promise<boolean> {
  if (!userId || !token) return false;

  if (token === MASTER_AUTH_TOKEN) {
    const user = await getUserById(userId);
    return user !== null;
  }

  const storedUserId = await getRedis().get(TOKEN_KEY(token));
  return storedUserId === userId;
}
