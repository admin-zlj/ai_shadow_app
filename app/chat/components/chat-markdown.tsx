'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

type ChatMarkdownVariant = 'assistant' | 'user';

interface ChatMarkdownProps {
  content: string;
  variant?: ChatMarkdownVariant;
}

const assistantComponents: Components = {
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-300 underline underline-offset-2"
    >
      {children}
    </a>
  ),
  pre: ({ children }) => (
    <pre className="chat-md-pre overflow-x-auto rounded-lg bg-zinc-950/80 p-3 text-[0.8125rem] leading-relaxed">
      {children}
    </pre>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = Boolean(className);
    if (isBlock) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded bg-zinc-950/60 px-1 py-0.5 font-mono text-[0.8125rem]"
        {...props}
      >
        {children}
      </code>
    );
  },
};

const userComponents: Components = {
  ...assistantComponents,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-white underline underline-offset-2"
    >
      {children}
    </a>
  ),
  code: ({ children, ...props }) => (
    <code
      className="rounded bg-blue-700/50 px-1 py-0.5 font-mono text-[0.8125rem]"
      {...props}
    >
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="chat-md-pre overflow-x-auto rounded-lg bg-blue-700/40 p-3 text-[0.8125rem] leading-relaxed">
      {children}
    </pre>
  ),
};

export function ChatMarkdown({
  content,
  variant = 'assistant',
}: ChatMarkdownProps) {
  const components =
    variant === 'user' ? userComponents : assistantComponents;

  return (
    <div
      className={`chat-markdown break-words ${variant === 'user' ? 'chat-markdown--user' : 'chat-markdown--assistant'}`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
