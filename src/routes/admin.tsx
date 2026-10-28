import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { getAdminAuthState, loginAdmin, logoutAdmin } from "@/lib/admin-auth.functions";
import { listAdminProducts } from "@/lib/catalog.functions";
import { listAdminOrders } from "@/lib/order.functions";
import { listAdminReviews } from "@/lib/review.functions";
import {
  getAdminVisitorAnalytics,
  type VisitorAnalyticsEntry,
} from "@/lib/visitor-analytics.functions";
import type { Product } from "@/data/products";
import type { CustomerReview } from "@/data/reviews";
import type { OrderSnapshot } from "@/data/orders";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin | SimplyClassy" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  loader: () => getAdminAuthState(),
  component: AdminPage,
  pendingComponent: AdminPending,
});

function AdminPending() {
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      Loading admin…
    </div>
  );
}

function AdminPage() {
  const initial = Route.useLoaderData();
  const [configured, setConfigured] = useState(initial.configured);
  const [authenticated, setAuthenticated] = useState(initial.authenticated);
  const [products, setProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<CustomerReview[]>([]);
  const [orders, setOrders] = useState<OrderSnapshot[]>([]);
  const [visitorAnalytics, setVisitorAnalytics] = useState<VisitorAnalyticsEntry[]>([]);
  const [visitorAnalyticsError, setVisitorAnalyticsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshAdminData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextProducts, nextReviews, nextOrders] = await Promise.all([
        listAdminProducts(),
        listAdminReviews(),
        listAdminOrders({ data: { limit: 100 } }),
      ]);
      setProducts(nextProducts);
      setReviews(nextReviews);
      setOrders(nextOrders);
      try {
        setVisitorAnalytics(await getAdminVisitorAnalytics());
        setVisitorAnalyticsError(null);
      } catch (analyticsError) {
        setVisitorAnalyticsError(
          analyticsError instanceof Error
            ? analyticsError.message
            : "Couldn't load visitor analytics.",
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't load products.";
      if (message === "Unauthorized") {
        setAuthenticated(false);
        return;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    void refreshAdminData();
  }, [authenticated, refreshAdminData]);

  if (!authenticated) {
    return (
      <AdminLogin
        configured={configured}
        onLogin={async (password) => {
          const result = await loginAdmin({ data: { password } });
          if (!result.ok) {
            setConfigured(true);
            return result.error;
          }
          setAuthenticated(true);
          return null;
        }}
      />
    );
  }

  return (
    <AdminDashboard
      products={products}
      reviews={reviews}
      orders={orders}
      loading={loading}
      error={error}
      onRefresh={refreshAdminData}
      onLogout={async () => {
        await logoutAdmin();
        setAuthenticated(false);
        setProducts([]);
        setReviews([]);
        setOrders([]);
        setVisitorAnalytics([]);
      }}
      visitorAnalytics={visitorAnalytics}
      visitorAnalyticsError={visitorAnalyticsError}
    />
  );
}
