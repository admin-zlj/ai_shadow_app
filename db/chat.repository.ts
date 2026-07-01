/**
 * DB 层 — 对话仓库（Redis 实现，按 userId 隔离）
 *
 * Redis 数据结构：
 *   chat:session:{userId}:{id}  → String (JSON)  存储完整会话
 *   chat:sessions:{userId}      → ZSET            member=sessionId, score=createdAt
 */

import { getRedis } from './redis';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  /** 已折叠进摘要的会话内容（由大模型生成） */
  summary?: string;
  /**
   * messages 中下标 0..summaryThroughIndex 已并入 summary，不再逐条传给大模型。
   * 未设置时为 -1（表示尚未摘要任何一条）。
   */
  summaryThroughIndex?: number;
}

/** 会话列表项（不含消息内容） */
export interface SessionListItem {
  id: string;
  title: string;
  createdAt: number;
}

const SESSION_KEY = (userId: string, id: string) =>
  `chat:session:${userId}:${id}`;
const SESSIONS_KEY = (userId: string) => `chat:sessions:${userId}`;

class RedisChatRepository {
  private redis = getRedis();

  /** 创建新会话 */
  async createSession(userId: string): Promise<ChatSession> {
    const session: ChatSession = {
      id: `chat-${Date.now()}`,
      userId,
      title: '新对话',
      messages: [],
      createdAt: Date.now(),
    };

    await this.redis.set(
      SESSION_KEY(userId, session.id),
      JSON.stringify(session),
    );
    await this.redis.zadd(
      SESSIONS_KEY(userId),
      session.createdAt,
      session.id,
    );

    return session;
  }

  /** 获取单个会话（含消息） */
  async getSession(
    userId: string,
    id: string,
  ): Promise<ChatSession | null> {
    const raw = await this.redis.get(SESSION_KEY(userId, id));
    if (!raw) return null;
    const session = JSON.parse(raw) as ChatSession;
    if (session.userId && session.userId !== userId) return null;
    return session;
  }

  /** 获取用户的所有会话列表（不含消息，按创建时间倒序） */
  async getAllSessions(userId: string): Promise<SessionListItem[]> {
    const ids = await this.redis.zrevrange(SESSIONS_KEY(userId), 0, -1);
    if (ids.length === 0) return [];

    const pipeline = this.redis.pipeline();
    ids.forEach((id) => pipeline.get(SESSION_KEY(userId, id)));
    const results = await pipeline.exec();

    if (!results) return [];

    return results
      .map(([err, raw]) => {
        if (err || !raw) return null;
        const session = JSON.parse(raw as string) as ChatSession;
        return {
          id: session.id,
          title: session.title,
          createdAt: session.createdAt,
        } as SessionListItem;
      })
      .filter((item): item is SessionListItem => item !== null);
  }

  /** 删除会话 */
  async deleteSession(userId: string, id: string): Promise<void> {
    const session = await this.getSession(userId, id);
    if (!session) return;
    await this.redis.del(SESSION_KEY(userId, id));
    await this.redis.zrem(SESSIONS_KEY(userId), id);
  }

  /** 更新会话（读取 → 修改 → 写回） */
  async updateSession(
    userId: string,
    id: string,
    updater: (session: ChatSession) => ChatSession,
  ): Promise<void> {
    const session = await this.getSession(userId, id);
    if (!session) throw new Error(`Session not found: ${id}`);

    const updated = updater(session);
    await this.redis.set(
      SESSION_KEY(userId, id),
      JSON.stringify(updated),
    );
  }

  /** 更新会话标题 */
  async updateTitle(
    userId: string,
    id: string,
    title: string,
  ): Promise<void> {
    await this.updateSession(userId, id, (session) => ({
      ...session,
      title,
    }));
  }

  /** 追加消息到会话 */
  async appendMessage(
    userId: string,
    id: string,
    message: ChatMessage,
  ): Promise<void> {
    await this.updateSession(userId, id, (session) => ({
      ...session,
      messages: [...session.messages, message],
    }));
  }
}

// 导出单例
export const chatRepository = new RedisChatRepository();
