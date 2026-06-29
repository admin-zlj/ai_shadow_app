import { UnorderedListOutline } from 'antd-mobile-icons';

interface ChatHeaderProps {
  onOpenHistory: () => void;
}

export function ChatHeader({ onOpenHistory }: ChatHeaderProps) {
  return (
    <header className="flex items-center justify-between h-14 bg-zinc-900 border-b border-zinc-800 shrink-0 px-4">
      <span className="w-5" />
      <h1 className="text-lg font-semibold text-zinc-100">AI影子</h1>
      <button onClick={onOpenHistory} className="p-1 text-zinc-300">
        <UnorderedListOutline color="#fff" className="text-[20px]" />
      </button>
    </header>
  );
}
