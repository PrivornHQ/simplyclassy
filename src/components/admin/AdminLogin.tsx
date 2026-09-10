import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AdminLogin({
  configured,
  onLogin,
}: {
  configured: boolean;
  onLogin: (password: string) => Promise<string | null>;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form
        className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-soft"
        onSubmit={async (event) => {
          event.preventDefault();
          setError(null);
          setSubmitting(true);
          try {
            const message = await onLogin(password);
            if (message) setError(message);
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <p className="eyebrow">SimplyClassy</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-foreground">Admin</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to manage the product catalogue.
        </p>

        {!configured && (
          <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            Admin access is not configured. Set ADMIN_PASSWORD (and optionally ADMIN_SESSION_SECRET)
            in the Netlify environment, then redeploy.
          </p>
        )}

        <div className="mt-6 space-y-2">
          <Label htmlFor="admin-password">Password</Label>
          <Input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={!configured || submitting}
            required
          />
        </div>

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        <Button
          type="submit"
          className="mt-6 w-full rounded-full"
          disabled={!configured || submitting}
        >
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
