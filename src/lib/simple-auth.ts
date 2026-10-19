// Simple hardcoded authentication utility
// This bypasses Supabase auth for local development

const STORAGE_KEY = "simple_auth_user";

export interface SimpleUser {
  id: string;
  email: string;
  username: string;
}

// Get credentials from environment variables
const ADMIN_USERNAME = import.meta.env["VITE_ADMIN_USERNAME"] || "admin";
const ADMIN_PASSWORD = import.meta.env["VITE_ADMIN_PASSWORD"] || "Admin@123";

export function validateCredentials(username: string, password: string): boolean {
  return username === ADMIN_USERNAME && password === ADMIN_PASSWORD;
}

export function login(username: string): SimpleUser {
  const user: SimpleUser = {
    id: "admin-user-001",
    email: `${username}@local.dev`,
    username,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  return user;
}

export function logout(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getCurrentUser(): SimpleUser | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as SimpleUser;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return getCurrentUser() !== null;
}
