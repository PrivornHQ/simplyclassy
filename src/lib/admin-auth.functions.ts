import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  assertLoginRateLimit,
  clearAdminSession,
  createAdminSession,
  hasAdminSession,
  isAdminConfigured,
  verifyAdminPassword,
} from "@/server/admin-auth.server";

export const getAdminAuthState = createServerFn({ method: "GET" }).handler(async () => {
  return {
    configured: isAdminConfigured(),
    authenticated: await hasAdminSession(),
  };
});

export const loginAdmin = createServerFn({ method: "POST" })
  .validator(z.object({ password: z.string().min(1) }))
  .handler(async ({ data }) => {
    if (!isAdminConfigured()) {
      return { ok: false as const, error: "Admin access is not configured on this site." };
    }
    try {
      assertLoginRateLimit();
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "Too many login attempts.",
      };
    }
    const valid = await verifyAdminPassword(data.password);
    if (!valid) {
      return { ok: false as const, error: "Incorrect password." };
    }
    await createAdminSession();
    return { ok: true as const };
  });

export const logoutAdmin = createServerFn({ method: "POST" }).handler(async () => {
  clearAdminSession();
  return { ok: true as const };
});
