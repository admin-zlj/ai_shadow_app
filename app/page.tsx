'use client';

import { useRouter } from 'next/navigation';
import { useChat } from './chat/hooks/use-chat';
import { ChatHeader } from './chat/components/chat-header';
import { MessageList } from './chat/components/message-list';
import { MessageInput } from './chat/components/message-input';
import { HistoryDrawer } from './chat/components/history-drawer';
import { clearAuth } from '@/lib/auth/client';

export default function ChatPage() {
  const router = useRouter();
  const chat = useChat();

  function handleLogout() {
    clearAuth();
    chat.setShowHistory(false);
    router.replace('/login');
  }

  return (
    <div className="flex flex-col h-screen bg-zinc-950">
      <ChatHeader
        onOpenHistory={() => chat.setShowHistory(true)}
        onLogout={handleLogout}
      />

      <MessageList
        messages={chat.messages}
        messagesEndRef={chat.messagesEndRef}
      />

      <MessageInput
        value={chat.message}
        onChange={chat.setMessage}
        onSend={chat.handleSend}
        loading={chat.loading}
      />

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
