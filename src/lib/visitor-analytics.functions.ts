import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  getVisitorAnalytics as readVisitorAnalytics,
  recordVisitorPageview,
} from "@/server/visitor-analytics.server";
import { requireAdminSession } from "@/server/admin-auth.server";
import {
  VISITOR_PAGE_IDS,
  type VisitorAnalyticsRange,
  type VisitorAnalyticsSummary,
} from "@/lib/visitor-analytics";

export const trackVisitorPageview = createServerFn({ method: "POST" })
  .validator(z.object({ sessionId: z.string().uuid(), pageId: z.enum(VISITOR_PAGE_IDS) }))
  .handler(async ({ data }) => {
    await recordVisitorPageview(data.sessionId, data.pageId);
  });

export const getAdminVisitorAnalytics = createServerFn({ method: "GET" })
  .validator(z.object({ from: z.string(), to: z.string() }))
  .handler(async ({ data }): Promise<VisitorAnalyticsSummary> => {
    await requireAdminSession();
    const range: VisitorAnalyticsRange = { from: data.from, to: data.to };
    return readVisitorAnalytics(range);
  });
