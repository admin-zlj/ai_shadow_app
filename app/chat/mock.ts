import type { ChatSession } from './types';

/**
 * Mock 对话数据
 * 首次进入页面且 localStorage 无缓存时使用
 */
export const mockSessions: ChatSession[] = [
  {
    id: 'mock-1',
    title: '什么是 React',
    createdAt: Date.now() - 3600000,
    messages: [
      { role: 'user', content: '什么是 React' },
      { role: 'assistant', content: 'React 是一个用于构建用户界面的 JavaScript 库，由 Meta 开发维护。' },
    ],
  },
  {
    id: 'mock-2',
    title: '如何学习 TypeScript',
    createdAt: Date.now() - 7200000,
    messages: [
      { role: 'user', content: '如何学习 TypeScript' },
      { role: 'assistant', content: '建议从官方文档入手，结合实际项目练习，逐步掌握类型系统。' },
    ],
  },
];
