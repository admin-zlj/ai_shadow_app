import type { NextRequest } from 'next/server';
import {
  AUTH_HEADER_TOKEN,
  AUTH_HEADER_USER_ID,
} from '@/lib/auth/constants';
import { validateTokenForUser } from '@/db/auth.repository';

export interface AuthenticatedUser {
  userId: string;
}

export function getAuthFromRequest(request: NextRequest): {
  userId: string | null;
  token: string | null;
} {
  const userId = request.headers.get(AUTH_HEADER_USER_ID)?.trim() ?? null;
  const token = request.headers.get(AUTH_HEADER_TOKEN)?.trim() ?? null;
  return { userId, token };
}

export async function authenticateRequest(
  request: NextRequest,
): Promise<AuthenticatedUser | null> {
  const { userId, token } = getAuthFromRequest(request);
  if (!userId || !token) return null;
  const ok = await validateTokenForUser(userId, token);
  if (!ok) return null;
  return { userId };
}
