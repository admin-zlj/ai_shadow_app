const STORAGE_USER_ID = 'ai_shadow_user_id';
const STORAGE_TOKEN = 'ai_shadow_auth_token';
const STORAGE_USERNAME = 'ai_shadow_username';

export interface StoredAuth {
  userId: string;
  token: string;
  username: string;
}

export function saveAuth(auth: StoredAuth): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_USER_ID, auth.userId);
  localStorage.setItem(STORAGE_TOKEN, auth.token);
  localStorage.setItem(STORAGE_USERNAME, auth.username);
}

export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_USER_ID);
  localStorage.removeItem(STORAGE_TOKEN);
  localStorage.removeItem(STORAGE_USERNAME);
}

export function getStoredAuth(): StoredAuth | null {
  if (typeof window === 'undefined') return null;
  const userId = localStorage.getItem(STORAGE_USER_ID);
  const token = localStorage.getItem(STORAGE_TOKEN);
  const username = localStorage.getItem(STORAGE_USERNAME);
  if (!userId || !token || !username) return null;
  return { userId, token, username };
}

export function authHeaders(): Record<string, string> {
  const auth = getStoredAuth();
  if (!auth) return {};
  return {
    'x-user-id': auth.userId,
    'x-auth-token': auth.token,
  };
}
