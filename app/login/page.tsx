'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveAuth } from '@/lib/auth/client';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message || '登录失败');
        return;
      }

      saveAuth({
        userId: data.data.userId,
        token: data.data.token,
        username: data.data.username,
      });
      router.replace('/');
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl">
        <h1 className="mb-2 text-center text-2xl font-semibold text-zinc-50">
          AI Shadow
        </h1>
        <p className="mb-8 text-center text-sm text-zinc-400">登录后使用对话功能</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm text-zinc-300">
            用户名
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-zinc-50 outline-none focus:border-zinc-500"
              placeholder="admin"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-zinc-300">
            密码
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-zinc-50 outline-none focus:border-zinc-500"
            />
          </label>

          {error ? (
            <p className="text-center text-sm text-red-400">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg bg-zinc-50 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200 disabled:opacity-50"
          >
            {loading ? '登录中…' : '登录'}
          </button>
        </form>
      </div>
    </div>
  );
}
