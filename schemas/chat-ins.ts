import { z } from 'zod';

// 单次对话请求：用户问题 + 会话ID + 模型标识（可选，默认 qwen3.7-plus）
export const chatInsRequestSchema = z.object({
  message: z.string().min(1, 'message is required'),
  sessionId: z.string().min(1, 'sessionId is required'),
  model: z.string().optional(),
});

export type ChatInsRequest = z.infer<typeof chatInsRequestSchema>;
