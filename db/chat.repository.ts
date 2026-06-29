/**
 * DB 层 — 对话仓库（Redis 实现）
 *
 * Redis 数据结构：
 *   chat:session:{id}  → String (JSON)  存储完整会话
 *   chat:sessions      → ZSET            member=sessionId, score=createdAt
 */

import { getRedis } from './redis';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
}

/** 会话列表项（不含消息内容） */
export interface SessionListItem {
  id: string;
  title: string;
  createdAt: number;
}

const SESSION_KEY = (id: string) => `chat:session:${id}`;
const SESSIONS_KEY = 'chat:sessions';

class RedisChatRepository {
  private redis = getRedis();

  /** 创建新会话 */
  async createSession(): Promise<ChatSession> {
    const session: ChatSession = {
      id: `chat-${Date.now()}`,
      title: '新对话',
      messages: [],
      createdAt: Date.now(),
    };

    await this.redis.set(SESSION_KEY(session.id), JSON.stringify(session));
    await this.redis.zadd(SESSIONS_KEY, session.createdAt, session.id);

    return session;
  }

  /** 获取单个会话（含消息） */
  async getSession(id: string): Promise<ChatSession | null> {
    const raw = await this.redis.get(SESSION_KEY(id));
    if (!raw) return null;
    return JSON.parse(raw) as ChatSession;
  }

  /** 获取所有会话列表（不含消息，按创建时间倒序） */
  async getAllSessions(): Promise<SessionListItem[]> {
    const ids = await this.redis.zrevrange(SESSIONS_KEY, 0, -1);
    if (ids.length === 0) return [];

    const pipeline = this.redis.pipeline();
    ids.forEach((id) => pipeline.get(SESSION_KEY(id)));
    const results = await pipeline.exec();

    if (!results) return [];

    return results
      .map(([err, raw], i) => {
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
  async deleteSession(id: string): Promise<void> {
    await this.redis.del(SESSION_KEY(id));
    await this.redis.zrem(SESSIONS_KEY, id);
  }

  /** 更新会话（读取 → 修改 → 写回） */
  async updateSession(
    id: string,
    updater: (session: ChatSession) => ChatSession,
  ): Promise<void> {
    const session = await this.getSession(id);
    if (!session) throw new Error(`Session not found: ${id}`);

    const updated = updater(session);
    await this.redis.set(SESSION_KEY(id), JSON.stringify(updated));
  }

  /** 更新会话标题 */
  async updateTitle(id: string, title: string): Promise<void> {
    await this.updateSession(id, (session) => ({
      ...session,
      title,
    }));
  }

  /** 追加消息到会话 */
  async appendMessage(id: string, message: ChatMessage): Promise<void> {
    await this.updateSession(id, (session) => ({
      ...session,
      messages: [...session.messages, message],
    }));
  }
}

// 导出单例
export const chatRepository = new RedisChatRepository();
