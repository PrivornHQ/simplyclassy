import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  getVisitorAnalytics as readVisitorAnalytics,
  recordVisitorPageview,
} from "@/server/visitor-analytics.server";
import { requireAdminSession } from "@/server/admin-auth.server";

export type VisitorAnalyticsEntry = {
  date: string;
  pageViews: number;
  sessions: number;
};

export const trackVisitorPageview = createServerFn({ method: "POST" })
  .validator(z.object({ sessionId: z.string().uuid() }))
  .handler(async ({ data }) => {
    await recordVisitorPageview(data.sessionId);
  });

export const getAdminVisitorAnalytics = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdminSession();
  return readVisitorAnalytics();
});
