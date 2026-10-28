export const VISITOR_PAGE_IDS = ["home", "order_tracking", "order_status"] as const;

export type VisitorPageId = (typeof VISITOR_PAGE_IDS)[number];
export type VisitorAnalyticsRange = { from: string; to: string };
export type VisitorAnalyticsPeriod = "today" | "7d" | "30d" | "custom";
export type VisitorAnalyticsSummary = {
  from: string;
  to: string;
  today: string;
  daily: { date: string; pageViews: number; sessions: number }[];
  pageViews: number;
  uniqueVisitors: number;
  todayVisitors: number;
  pages: { pageId: VisitorPageId; pageViews: number }[];
};

const MAX_RANGE_DAYS = 45;

export function getUtcDate(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function getVisitorAnalyticsRange(
  period: Exclude<VisitorAnalyticsPeriod, "custom">,
  now = new Date(),
): VisitorAnalyticsRange {
  const to = getUtcDate(now);
  const days = period === "today" ? 1 : period === "7d" ? 7 : 30;
  const start = new Date(`${to}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - days + 1);
  return { from: getUtcDate(start), to };
}

export function validateVisitorAnalyticsRange(
  from: string,
  to: string,
  today = getUtcDate(),
): VisitorAnalyticsRange {
  const isDate = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) &&
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;

  if (!isDate(from) || !isDate(to) || from > to || to > today) {
    throw new Error("Choose a valid visitor analytics date range.");
  }
  const dayCount =
    (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86_400_000 + 1;
  if (dayCount > MAX_RANGE_DAYS) {
    throw new Error(`Visitor analytics ranges cannot exceed ${MAX_RANGE_DAYS} days.`);
  }
  return { from, to };
}

export function getVisitorPageId(pathname: string): VisitorPageId | null {
  if (pathname === "/") return "home";
  if (pathname === "/track") return "order_tracking";
  if (/^\/order\/[^/]+$/.test(pathname)) return "order_status";
  return null;
}

export function isTrackableVisitorPath(pathname: string): boolean {
  return getVisitorPageId(pathname) !== null;
}

export function getOrCreateVisitorSessionId(storage: {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}): string {
  const key = "simplyclassy_visitor_session";
  const storedId = storage.getItem(key);
  const sessionId =
    storedId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(storedId)
      ? storedId
      : crypto.randomUUID();

  storage.setItem(key, sessionId);
  return sessionId;
}

export function buildVisitorAnalyticsSummary(
  range: VisitorAnalyticsRange,
  today: string,
  keysByDate: Record<string, string[]>,
): VisitorAnalyticsSummary {
  const daily: VisitorAnalyticsSummary["daily"] = [];
  const visitorDigests = new Set<string>();
  const pageCounts = new Map<VisitorPageId, number>();
  let pageViews = 0;
  let todayVisitors = 0;

  const cursor = new Date(`${range.from}T00:00:00.000Z`);
  const end = new Date(`${range.to}T00:00:00.000Z`);
  while (cursor <= end) {
    const date = getUtcDate(cursor);
    const keys = keysByDate[date] ?? [];
    let dailyPageViews = 0;
    const dailyDigests = new Set<string>();

    for (const key of keys) {
      const prefix = `analytics:${date}:`;
      if (!key.startsWith(prefix)) continue;
      const suffix = key.slice(prefix.length);
      if (suffix.startsWith("session:")) {
        const digest = suffix.slice("session:".length);
        if (/^[0-9a-f]{64}$/.test(digest)) {
          dailyDigests.add(digest);
          visitorDigests.add(digest);
        }
        continue;
      }
      const pageMatch = /^view:(home|order_tracking|order_status):/.exec(suffix);
      if (!pageMatch && !/^view:[0-9a-f-]{36}$/i.test(suffix)) continue;
      dailyPageViews += 1;
      if (pageMatch) {
        const pageId = pageMatch[1] as VisitorPageId;
        pageCounts.set(pageId, (pageCounts.get(pageId) ?? 0) + 1);
      }
    }

    pageViews += dailyPageViews;
    if (date === today) todayVisitors = dailyDigests.size;
    daily.push({ date, pageViews: dailyPageViews, sessions: dailyDigests.size });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  todayVisitors = new Set(
    (keysByDate[today] ?? [])
      .filter((key) => key.startsWith(`analytics:${today}:session:`))
      .map((key) => key.slice(`analytics:${today}:session:`.length))
      .filter((digest) => /^[0-9a-f]{64}$/.test(digest)),
  ).size;

  return {
    ...range,
    today,
    daily,
    pageViews,
    uniqueVisitors: visitorDigests.size,
    todayVisitors,
    pages: [...pageCounts.entries()]
      .map(([pageId, count]) => ({ pageId, pageViews: count }))
      .sort(
        (left, right) =>
          right.pageViews - left.pageViews || left.pageId.localeCompare(right.pageId),
      ),
  };
}
