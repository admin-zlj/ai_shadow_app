"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { authHeaders, getStoredAuth } from "@/lib/auth/client";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  loading?: boolean;
}

interface SessionListItem {
  id: string;
  title: string;
  createdAt: number;
}

export function useChat() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const currentSession = sessions.find((s) => s.id === currentSessionId);

  function requireAuthHeaders(): Record<string, string> | null {
    const headers = authHeaders();
    if (!headers["x-user-id"]) {
      router.replace("/login");
      return null;
    }
    return headers;
  }

  /** 加载单个会话的消息 */
  async function loadSessionMessages(id: string) {
    const headers = requireAuthHeaders();
    if (!headers) return;
    try {
      const res = await fetch(`/api/sessions/${id}`, { headers });
      const data = await res.json();
      if (data.success) {
        setCurrentSessionId(id);
        setMessages(
          (data.data.messages || []).map(
            (m: { role: string; content: string }) => ({
              role: m.role as ChatMessage["role"],
              content: m.content,
            }),
          ),
        );
      }
    } catch {
      // 忽略网络错误
    }
  }

  /** 加载所有会话列表 */
  async function loadSessions() {
    const headers = requireAuthHeaders();
    if (!headers) return;
    try {
      const res = await fetch("/api/sessions", { headers });
      const data = await res.json();
      if (data.success) {
        const list = data.data as SessionListItem[];
        setSessions(list);
        if (list.length > 0 && !currentSessionId) {
          loadSessionMessages(list[0].id);
        }
      }
    } catch {
      // 忽略网络错误
    }
  }

  // 挂载后检查登录并加载会话列表
  useEffect(() => {
    if (!getStoredAuth()) {
      router.replace("/login");
      return;
    }
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 仅在消息列表容器内滚动，避免带动整页
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [messages]);

  /** 新建对话 */
  async function newChat() {
    const headers = requireAuthHeaders();
    if (!headers) return;
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers,
      });
      const data = await res.json();
      if (data.success) {
        const session = data.data as SessionListItem;
        setSessions((prev) => [session, ...prev]);
        setCurrentSessionId(session.id);
        setMessages([]);
        setShowHistory(false);
      }
    } catch {
      // 忽略网络错误
    }
  }

  /** 切换对话 */
  function switchSession(id: string) {
    loadSessionMessages(id);
    setShowHistory(false);
  }

  /** 删除对话 */
  async function deleteSession(id: string) {
    const headers = requireAuthHeaders();
    if (!headers) return;
    try {
      await fetch(`/api/sessions/${id}`, { method: "DELETE", headers });
      setSessions((prev) => {
        const filtered = prev.filter((s) => s.id !== id);
        if (currentSessionId === id) {
          if (filtered.length > 0) {
            loadSessionMessages(filtered[0].id);
          } else {
            setCurrentSessionId("");
            setMessages([]);
          }
        }
        return filtered;
      });
    } catch {
      // 忽略网络错误
    }
  }

  /** 发送消息（SSE 流式接收） */
  async function handleSend() {
    if (!message.trim() || loading) return;

    // 没有当前对话则先创建
    let sid = currentSessionId;
    if (!sid) {
      const headers = requireAuthHeaders();
      if (!headers) return;
      try {
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers,
        });
        const data = await res.json();
        if (data.success) {
          sid = data.data.id;
          setSessions((prev) => [data.data, ...prev]);
          setCurrentSessionId(sid);
        }
      } catch {
        return;
      }
    }

    const userMessage = message.trim();
    const sessionId = sid!;
    setMessage("");

    // 添加用户消息 + 加载中的 AI 消息
    setMessages((prev) => [
      ...prev,
      { role: "user", content: userMessage },
      { role: "assistant", content: "", loading: true },
    ]);
    setLoading(true);

    try {
      const headers = requireAuthHeaders();
      if (!headers) return;
      const res = await fetch("/api/chat-ins", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify({ message: userMessage, sessionId }),
      });

      if (!res.ok) {
        const data = await res.json();
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: data.error?.message || "请求失败",
            loading: false,
          };
          return updated;
        });
        return;
      }

      // 解析 SSE 流
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const event of events) {
          if (!event.startsWith("data: ")) continue;
          const data = event.slice(6);
          if (data === "[DONE]") break;

          const parsed = JSON.parse(data);
          if (parsed.content) {
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              updated[updated.length - 1] = {
                role: "assistant",
                content: last.content + parsed.content,
                loading: false,
              };
              return updated;
            });
          } else if (parsed.error) {
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                role: "assistant",
                content: parsed.error,
                loading: false,
              };
              return updated;
            });
          }
        }
      }

      // 刷新会话列表（获取更新后的标题）
      loadSessions();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "网络错误";
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: errMsg,
          loading: false,
        };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }

  return {
    sessions,
    currentSession,
    messages,
    message,
    loading,
    showHistory,
    scrollContainerRef,
    setMessage,
    setShowHistory,
    newChat,
    switchSession,
    deleteSession,
    handleSend,
  };
}
