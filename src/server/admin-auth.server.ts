import { getCookie, getRequest, setCookie, deleteCookie } from "@tanstack/react-start/server";

const COOKIE_NAME = "sc_admin";
const SESSION_MS = 1000 * 60 * 60 * 24 * 7;

const env = (name: string) => (process.env[name] ?? "").trim();

const bytesToHex = (bytes: ArrayBuffer | Uint8Array) => {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(view, (b) => b.toString(16).padStart(2, "0")).join("");
};

const timingSafeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
};

export const isAdminConfigured = () => env("ADMIN_PASSWORD").length > 0;

const sessionSecret = () => {
  const secret = env("ADMIN_SESSION_SECRET");
  const password = env("ADMIN_PASSWORD");
  const material = secret || password;
  if (!material) return "";
  if (material.length >= 32) return material;
  return `${bytesToHex(new TextEncoder().encode(material))}${material}`.slice(0, 64);
};

async function hmac(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return bytesToHex(signature);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToHex(digest);
}

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: env("NODE_ENV") === "production",
};

export async function verifyAdminPassword(password: string): Promise<boolean> {
  const expected = env("ADMIN_PASSWORD");
  if (!expected) return false;
  const [left, right] = await Promise.all([sha256Hex(password), sha256Hex(expected)]);
  return timingSafeEqual(left, right);
}

export async function createAdminSession(): Promise<void> {
  const secret = sessionSecret();
  const exp = Date.now() + SESSION_MS;
  const payload = `v1.${exp}`;
  const token = `${payload}.${await hmac(payload, secret)}`;
  setCookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: SESSION_MS / 1000 });
}

export function clearAdminSession(): void {
  deleteCookie(COOKIE_NAME, { path: "/" });
}

export async function hasAdminSession(): Promise<boolean> {
  const secret = sessionSecret();
  if (!secret) return false;
  const token = getCookie(COOKIE_NAME);
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const version = parts[0];
  const expRaw = parts[1];
  const signature = parts[2];
  if (version !== "v1" || !expRaw || !signature) return false;
  const payload = `${version}.${expRaw}`;
  const expected = await hmac(payload, secret);
  if (!timingSafeEqual(signature, expected)) return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  return true;
}

export async function requireAdminSession(): Promise<void> {
  if (!(await hasAdminSession())) {
    throw new Error("Unauthorized");
  }
}

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

export function assertLoginRateLimit(): void {
  const ip = getRequest().headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const current = loginAttempts.get(ip);
  if (!current || now > current.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return;
  }
  current.count += 1;
  if (current.count > 8) {
    throw new Error("Too many login attempts. Please wait and try again.");
  }
}
