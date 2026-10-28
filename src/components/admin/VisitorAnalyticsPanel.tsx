import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, CalendarRange, Eye, LoaderCircle, UsersRound } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getUtcDate,
  getVisitorAnalyticsRange,
  validateVisitorAnalyticsRange,
  type VisitorAnalyticsPeriod,
  type VisitorAnalyticsRange,
  type VisitorAnalyticsSummary,
  type VisitorPageId,
} from "@/lib/visitor-analytics";

const pageLabels: Record<VisitorPageId, string> = {
  home: "Home page",
  order_tracking: "Order tracking",
  order_status: "Order status",
};

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function formatDate(date: string): string {
  return dateFormatter.format(new Date(`${date}T00:00:00.000Z`));
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Eye;
}) {
  return (
    <article className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
        </div>
        <span className="rounded-md bg-secondary p-2 text-muted-foreground">
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
    </article>
  );
}

export function VisitorAnalyticsPanel({
  onLoadRange,
}: {
  onLoadRange: (range: VisitorAnalyticsRange) => Promise<VisitorAnalyticsSummary>;
}) {
  const [period, setPeriod] = useState<VisitorAnalyticsPeriod>("30d");
  const [analytics, setAnalytics] = useState<VisitorAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customFrom, setCustomFrom] = useState(() => getVisitorAnalyticsRange("30d").from);
  const [customTo, setCustomTo] = useState(() => getUtcDate());
  const [rangeError, setRangeError] = useState<string | null>(null);
  const requestId = useRef(0);

  const loadRange = useCallback(
    async (range: VisitorAnalyticsRange) => {
      const currentRequestId = ++requestId.current;
      setLoading(true);
      setError(null);
      try {
        const result = await onLoadRange(range);
        if (requestId.current === currentRequestId) setAnalytics(result);
      } catch (loadError) {
        if (requestId.current === currentRequestId) {
          setError(
            loadError instanceof Error ? loadError.message : "Couldn't load visitor analytics.",
          );
        }
      } finally {
        if (requestId.current === currentRequestId) setLoading(false);
      }
    },
    [onLoadRange],
  );

  useEffect(() => {
    void loadRange(getVisitorAnalyticsRange("30d"));
  }, [loadRange]);

  const selectPeriod = (value: string) => {
    const nextPeriod = value as VisitorAnalyticsPeriod;
    setPeriod(nextPeriod);
    setRangeError(null);
    if (nextPeriod !== "custom") {
      void loadRange(getVisitorAnalyticsRange(nextPeriod));
    } else if (analytics) {
      setCustomFrom(analytics.from);
      setCustomTo(analytics.to);
    }
  };

  const applyCustomRange = () => {
    try {
      const range = validateVisitorAnalyticsRange(customFrom, customTo);
      setRangeError(null);
      void loadRange(range);
    } catch (rangeValidationError) {
      setRangeError(
        rangeValidationError instanceof Error
          ? rangeValidationError.message
          : "Choose a valid date range.",
      );
    }
  };

  const pageViews = analytics?.pageViews ?? 0;
  const uniqueVisitors = analytics?.uniqueVisitors ?? 0;
  const pagesPerVisitor = uniqueVisitors > 0 ? pageViews / uniqueVisitors : 0;
  const maxPageViews = Math.max(0, ...(analytics?.pages.map((page) => page.pageViews) ?? []));

  return (
    <section
      aria-labelledby="visitor-analytics-title"
      aria-busy={loading}
      className="mb-8 rounded-xl border border-border bg-card p-5 shadow-soft sm:p-6"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="eyebrow">Store insights</p>
          <h2
            id="visitor-analytics-title"
            className="mt-1 font-display text-2xl font-semibold text-foreground"
          >
            Visitor Activity
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Anonymous traffic totals use UTC dates. Unique visitors are estimates based on
            browser-tab sessions and do not identify people across browsers or devices.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={period} onValueChange={selectPeriod}>
            <SelectTrigger aria-label="Analytics date range" className="w-full sm:w-44">
              <CalendarRange className="mr-2 size-4 text-muted-foreground" aria-hidden />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectContent>
          </Select>
          {loading && (
            <LoaderCircle
              className="size-4 animate-spin text-muted-foreground"
              aria-label="Loading analytics"
            />
          )}
        </div>
      </div>

      {period === "custom" && (
        <div className="mt-4 flex flex-col gap-3 rounded-lg border border-border bg-background p-3 sm:flex-row sm:items-end">
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            From (UTC)
            <input
              type="date"
              value={customFrom}
              max={getUtcDate()}
              onChange={(event) => setCustomFrom(event.target.value)}
              className="h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            To (UTC)
            <input
              type="date"
              value={customTo}
              max={getUtcDate()}
              onChange={(event) => setCustomTo(event.target.value)}
              className="h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground"
            />
          </label>
          <Button type="button" variant="outline" onClick={applyCustomRange} disabled={loading}>
            Apply range
          </Button>
          {rangeError && (
            <p role="alert" className="text-sm text-destructive sm:pb-2">
              {rangeError}
            </p>
          )}
        </div>
      )}

      {analytics && (
        <p className="mt-4 text-xs text-muted-foreground">
          Showing {formatDate(analytics.from)} – {formatDate(analytics.to)} (UTC)
        </p>
      )}

      {error ? (
        <div className="mt-5 rounded-md border border-destructive/30 bg-destructive/5 p-4">
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() =>
              void loadRange(
                period === "custom"
                  ? { from: customFrom, to: customTo }
                  : getVisitorAnalyticsRange(period),
              )
            }
          >
            Try again
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Total Page Views"
              value={analytics ? pageViews.toLocaleString() : "—"}
              detail="For the selected date range"
              icon={Eye}
            />
            <MetricCard
              label="Unique Visitors"
              value={analytics ? uniqueVisitors.toLocaleString() : "—"}
              detail="Estimated unique browser-tab sessions"
              icon={UsersRound}
            />
            <MetricCard
              label="Today's Visitors"
              value={analytics ? analytics.todayVisitors.toLocaleString() : "—"}
              detail="Unique sessions today (UTC)"
              icon={Activity}
            />
            <MetricCard
              label="Pages per Visitor"
              value={analytics ? pagesPerVisitor.toFixed(2) : "—"}
              detail="Selected page views ÷ estimated visitors"
              icon={CalendarRange}
            />
          </div>

          {loading && !analytics ? (
            <p className="mt-5 rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Loading visitor analytics…
            </p>
          ) : analytics ? (
            <>
              <div className="mt-6 rounded-lg border border-border bg-background p-4">
                <div className="mb-4">
                  <h3 className="font-medium text-foreground">Traffic over time</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Daily page views</p>
                </div>
                {pageViews === 0 ? (
                  <p className="flex min-h-56 items-center justify-center rounded-md border border-dashed border-border px-4 text-center text-sm text-muted-foreground">
                    No page views were recorded in this date range.
                  </p>
                ) : (
                  <div className="h-56 w-full min-w-0 sm:h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={analytics.daily}
                        margin={{ top: 8, right: 12, bottom: 4, left: -18 }}
                      >
                        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={formatDate}
                          minTickGap={24}
                          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          allowDecimals={false}
                          width={40}
                          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          labelFormatter={(value) => `${formatDate(String(value))} (UTC)`}
                          formatter={(value) => [Number(value).toLocaleString(), "Page views"]}
                          contentStyle={{
                            borderRadius: "0.5rem",
                            borderColor: "var(--border)",
                            backgroundColor: "var(--card)",
                            color: "var(--foreground)",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="pageViews"
                          name="Page views"
                          stroke="var(--primary)"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="mt-6 rounded-lg border border-border bg-background p-4">
                <div className="mb-4">
                  <h3 className="font-medium text-foreground">Most Visited Pages</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Normalized public page categories only; no order IDs or URLs are stored.
                  </p>
                </div>
                {analytics.pages.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                    Page rankings will appear as new page-level views are collected. Earlier page
                    views remain included in the totals.
                  </p>
                ) : (
                  <ul className="grid gap-4">
                    {analytics.pages.map((page) => (
                      <li
                        key={page.pageId}
                        className="grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)_5rem] sm:items-center"
                      >
                        <span className="text-sm font-medium text-foreground">
                          {pageLabels[page.pageId]}
                        </span>
                        <span
                          className="h-2 overflow-hidden rounded-full bg-secondary"
                          role="img"
                          aria-label={`${pageLabels[page.pageId]}: ${page.pageViews} page views`}
                        >
                          <span
                            className="block h-full rounded-full bg-primary"
                            style={{ width: `${(page.pageViews / maxPageViews) * 100}%` }}
                          />
                        </span>
                        <span className="text-sm tabular-nums text-muted-foreground sm:text-right">
                          {page.pageViews.toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <p className="mt-5 rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Loading visitor analytics…
            </p>
          )}
        </>
      )}
    </section>
  );
}
