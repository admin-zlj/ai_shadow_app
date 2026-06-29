/** 聊天消息 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  loading?: boolean;
}

/** 会话列表项（不含消息内容） */
export interface SessionListItem {
  id: string;
  title: string;
  createdAt: number;
}

/** 一次完整的对话会话 */
export interface ChatSession extends SessionListItem {
  messages: ChatMessage[];
}
