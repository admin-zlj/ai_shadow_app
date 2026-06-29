import { DotLoading } from 'antd-mobile';
import type { RefObject } from 'react';
import type { ChatMessage } from '../types';

interface MessageListProps {
  messages: ChatMessage[];
  messagesEndRef: RefObject<HTMLDivElement | null>;
}

export function MessageList({ messages, messagesEndRef }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-zinc-400">开始和 AI影子 对话吧</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
      {messages.map((msg, i) => (
        <div
          key={i}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm break-words ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white rounded-br-md'
                : 'bg-zinc-800 text-zinc-100 rounded-bl-md'
            }`}
          >
            {msg.loading ? (
              <span className="text-zinc-500">
                加载中<DotLoading color="white" />
              </span>
            ) : (
              <span className="whitespace-pre-wrap leading-relaxed">
                {msg.content}
              </span>
            )}
          </div>
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}
