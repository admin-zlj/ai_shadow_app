'use client';

import { useChat } from './hooks/use-chat';
import { ChatHeader } from './components/chat-header';
import { MessageList } from './components/message-list';
import { MessageInput } from './components/message-input';
import { HistoryDrawer } from './components/history-drawer';

export default function ChatPage() {
  const chat = useChat();

  return (
    <div className="flex flex-col h-screen bg-zinc-950">
      {/* 顶部导航栏 */}
      <ChatHeader onOpenHistory={() => chat.setShowHistory(true)} />

      {/* 消息列表 */}
      <MessageList
        messages={chat.messages}
        messagesEndRef={chat.messagesEndRef}
      />

      {/* 底部输入栏 */}
      <MessageInput
        value={chat.message}
        onChange={chat.setMessage}
        onSend={chat.handleSend}
        loading={chat.loading}
      />

      {/* 右侧历史记录弹层 */}
      <HistoryDrawer
        visible={chat.showHistory}
        sessions={chat.sessions}
        currentSessionId={chat.currentSession?.id ?? ''}
        onClose={() => chat.setShowHistory(false)}
        onSwitch={chat.switchSession}
        onDelete={chat.deleteSession}
        onNewChat={chat.newChat}
      />
    </div>
  );
}
