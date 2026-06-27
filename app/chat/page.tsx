'use client';

import { useState, useRef, useEffect } from 'react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  loading?: boolean;
}

export default function ChatPage() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 有新消息时自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    if (!message.trim() || loading) return;

    const userMessage = message.trim();
    setMessage('');

    // 先把用户消息和加载中的 AI 气泡加入列表
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: userMessage },
      { role: 'assistant', content: '', loading: true },
    ]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat-ins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      });

      // 非流式错误（校验失败等）
      if (!res.ok) {
        const data = await res.json();
        updateLastMessage(data.error?.message || '请求失败');
        return;
      }

      // 解析 SSE 流
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE 事件以 \n\n 分隔
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const event of events) {
          if (!event.startsWith('data: ')) continue;
          const data = event.slice(6);

          if (data === '[DONE]') break;

          const parsed = JSON.parse(data);
          if (parsed.content) {
            console.log('chunk:', parsed.content);
            appendToLastMessage(parsed.content);
          } else if (parsed.error) {
            console.error('stream error:', parsed.error);
            updateLastMessage(parsed.error);
          }
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '网络错误';
      updateLastMessage(errMsg);
    } finally {
      setLoading(false);
    }
  }

  /** 更新最后一条 AI 消息（替换内容） */
  function updateLastMessage(content: string) {
    setMessages((prev) => {
      const updated = [...prev];
      updated[updated.length - 1] = {
        role: 'assistant',
        content,
        loading: false,
      };
      return updated;
    });
  }

  /** 往最后一条 AI 消息追加内容（流式逐块拼接） */
  function appendToLastMessage(chunk: string) {
    setMessages((prev) => {
      const updated = [...prev];
      const last = updated[updated.length - 1];
      updated[updated.length - 1] = {
        role: 'assistant',
        content: last.content + chunk,
        loading: false,
      };
      return updated;
    });
  }

  return (
    <div className="flex flex-col h-screen bg-zinc-100 dark:bg-zinc-950">
      {/* 顶部标题栏 */}
      <header className="flex items-center justify-center h-14 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          AI影子
        </h1>
      </header>

      {/* 消息区域 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-zinc-400 dark:text-zinc-600 text-sm">
              开始和 AI影子 对话吧
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm break-words ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-md'
                  : 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 rounded-bl-md'
              }`}
            >
              {msg.loading ? (
                <span className="text-zinc-400 dark:text-zinc-500">
                  加载中<span className="animate-pulse">...</span>
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

      {/* 底部输入栏 */}
      <div className="shrink-0 px-4 py-3 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex gap-2 items-center">
          <input
            type="text"
            className="flex-1 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="输入消息..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={loading}
          />
          <button
            className="rounded-full bg-blue-600 px-5 py-2.5 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
            onClick={handleSend}
            disabled={loading || !message.trim()}
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
