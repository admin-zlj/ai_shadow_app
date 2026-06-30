import { UnorderedListOutline } from 'antd-mobile-icons';

interface ChatHeaderProps {
  onOpenHistory: () => void;
  onLogout: () => void;
}

export function ChatHeader({ onOpenHistory, onLogout }: ChatHeaderProps) {
  return (
    <header className="flex items-center h-14 bg-zinc-900 border-b border-zinc-800 shrink-0 px-4">
      <button
        type="button"
        onClick={onOpenHistory}
        className="p-1 text-zinc-300 shrink-0 w-7"
        aria-label="打开聊天记录"
      >
        <UnorderedListOutline color="#fff" className="text-[20px]" />
      </button>
      <h1 className="flex-1 text-center text-lg font-semibold text-zinc-100">
        AI影子
      </h1>
      <div
        onClick={onLogout}
        className="shrink-0 text-sm text-zinc-400 cursor-pointer hover:text-zinc-100 transition-colors"
      >
        退登
      </div>
    </header>
  );
}
