import { Button } from "antd-mobile";

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  loading: boolean;
}

export function MessageInput({
  value,
  onChange,
  onSend,
  loading,
}: MessageInputProps) {
  return (
    <div className="shrink-0 px-4 py-3 bg-zinc-900 border-t border-zinc-800">
      <div className="flex gap-2 items-center">
        <input
          type="text"
          className="flex-1 rounded-full border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-base text-white caret-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="输入消息..."
          style={{ color: "#fff" }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={loading}
        />
        <Button
          color="primary"
          size="middle"
          onClick={onSend}
          disabled={loading || !value.trim()}
        >
          发送
        </Button>
      </div>
    </div>
  );
}
