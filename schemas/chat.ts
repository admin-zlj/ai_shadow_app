import { z } from 'zod';

export const chatRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string().min(1),
    })
  ).min(1),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
