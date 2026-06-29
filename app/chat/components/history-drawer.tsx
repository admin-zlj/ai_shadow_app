import { Popup } from "antd-mobile";
import {
  MessageOutline,
  DeleteOutline,
  ChatAddOutline,
} from "antd-mobile-icons";
import type { SessionListItem } from "../types";

interface HistoryDrawerProps {
  visible: boolean;
  sessions: SessionListItem[];
  currentSessionId: string;
  onClose: () => void;
  onSwitch: (id: string) => void;
  onDelete: (id: string) => void;
  onNewChat: () => void;
}

export function HistoryDrawer({
  visible,
  sessions,
  currentSessionId,
  onClose,
  onSwitch,
  onDelete,
  onNewChat,
}: HistoryDrawerProps) {
  return (
    <Popup
      visible={visible}
      onMaskClick={onClose}
      position="right"
      bodyStyle={{ width: "18rem", height: "100%", backgroundColor: "#18181b" }}
    >
      <div className="flex flex-col h-full">
        {/* 弹层头部 */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-zinc-800 shrink-0">
          <span className="text-sm font-medium text-zinc-100">聊天记录</span>
          <div
            onClick={onNewChat}
            className="flex items-center gap-1 text-xs text-white hover:text-blue-400 transition-colors"
          >
            <ChatAddOutline color="#fff" className="text-[16px]" />
          </div>
        </div>

        {/* 会话列表 */}
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 ? (
            <p className="text-center text-sm text-zinc-400 mt-8">
              暂无聊天记录
            </p>
          ) : (
            <div>
              {sessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => onSwitch(s.id)}
                  className={`flex items-center gap-2 px-4 py-3 cursor-pointer border-b border-zinc-800 transition-colors ${
                    s.id === currentSessionId
                      ? "bg-blue-600/15"
                      : "hover:bg-zinc-800/50"
                  }`}
                >
                  <span className="text-zinc-300 shrink-0">
                    <MessageOutline className="text-[16px]" />
                  </span>
                  <span className="flex-1 text-sm text-zinc-100 truncate">
                    {s.title}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(s.id);
                    }}
                    className="p-1 text-zinc-300 hover:text-red-400 transition-colors"
                  >
                    <DeleteOutline color="#fff" className="text-[16px]" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Popup>
  );
}
