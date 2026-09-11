import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { getAdminAuthState, loginAdmin, logoutAdmin } from "@/lib/admin-auth.functions";
import { listAdminProducts } from "@/lib/catalog.functions";
import type { Product } from "@/data/products";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await listAdminProducts();
      setProducts(next);
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
    void refreshProducts();
  }, [authenticated, refreshProducts]);

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
      loading={loading}
      error={error}
      onRefresh={refreshProducts}
      onLogout={async () => {
        await logoutAdmin();
        setAuthenticated(false);
        setProducts([]);
      }}
    />
  );
}
