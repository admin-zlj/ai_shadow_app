import type { NextRequest } from "next/server";
import {
  createHandler,
  loggingMiddleware,
  createValidationMiddleware,
  errorHandlingMiddleware,
  createCorsMiddleware,
} from "@/lib/middleware";
import type { RequestContext } from "@/lib/middleware";
import { chatRequestSchema } from "@/schemas/chat";
import { successResponse } from "@/lib/response";

const cors = createCorsMiddleware({ origin: "*" });

const validateChat = createValidationMiddleware({
  schema: chatRequestSchema,
  source: "body",
});

async function chatHandler(
  request: NextRequest,
  context: RequestContext,
): Promise<Response> {
  const { messages } = context.validatedData as {
    messages: Array<{ role: string; content: string }>;
  };

  // 模拟 AI 响应
  const response = {
    id: `msg-${Date.now()}`,
    role: "assistant" as const,
    content: "This is a sample chat response.",
  };

  return successResponse(response, context.traceId);
}

export const POST = createHandler(
  [cors, loggingMiddleware, validateChat, errorHandlingMiddleware],
  chatHandler,
);

// OPTIONS 预检请求处理
export const OPTIONS = createHandler(
  [cors],
  async () => new Response(null, { status: 204 }),
);
