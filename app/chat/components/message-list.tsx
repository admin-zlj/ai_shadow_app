import { DotLoading } from 'antd-mobile';
import type { RefObject } from 'react';
import type { ChatMessage } from '../types';
import { ChatMarkdown } from './chat-markdown';

interface MessageListProps {
  messages: ChatMessage[];
  scrollContainerRef: RefObject<HTMLDivElement | null>;
}

function MessageContent({ msg }: { msg: ChatMessage }) {
  if (msg.loading) {
    return (
      <span className="text-zinc-500">
        加载中<DotLoading color="white" />
      </span>
    );
  }

  const variant = msg.role === 'user' ? 'user' : 'assistant';
  return <ChatMarkdown content={msg.content} variant={variant} />;
}

export function MessageList({
  messages,
  scrollContainerRef,
}: MessageListProps) {
  return (
    <div
      ref={scrollContainerRef}
      className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4"
    >
      {messages.length === 0 ? (
        <div className="flex h-full min-h-32 items-center justify-center">
          <p className="text-sm text-zinc-400">开始和 AI影子 对话吧</p>
        </div>
      ) : (
        <div className="space-y-3">
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
                {msg.loading || msg.content ? (
                  <MessageContent msg={msg} />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
