/**
 * DB 层 — 对话仓库（Repository 模式）
 *
 * 定义对话数据持久化的接口与内存实现。
 * 后续接入真实数据库时，只需实现 IChatRepository 接口即可替换。
 */

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface ConversationRecord {
  id: string;
  messages: ChatMessage[];
  createdAt: number;
}

export interface IChatRepository {
  createConversation(): ConversationRecord;
  saveMessage(conversationId: string, message: ChatMessage): void;
  getMessages(conversationId: string): ChatMessage[];
}

/**
 * 内存实现的对话仓库（demo 用途）
 * 后续可替换为 Redis / PostgreSQL / MongoDB 等真实存储
 */
class InMemoryChatRepository implements IChatRepository {
  private conversations = new Map<string, ConversationRecord>();

  createConversation(): ConversationRecord {
    const id = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const record: ConversationRecord = {
      id,
      messages: [],
      createdAt: Date.now(),
    };
    this.conversations.set(id, record);
    return record;
  }

  saveMessage(conversationId: string, message: ChatMessage): void {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }
    conversation.messages.push(message);
  }

  getMessages(conversationId: string): ChatMessage[] {
    const conversation = this.conversations.get(conversationId);
    return conversation ? conversation.messages : [];
  }
}

// 导出单例，供 service 层使用
export const chatRepository: IChatRepository = new InMemoryChatRepository();
