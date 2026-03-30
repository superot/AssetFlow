"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Send, CheckCircle2, AlertCircle, Bell, BellOff } from "lucide-react";

interface NotificationSettings {
  notifications_enabled: boolean;
  notification_recipient_email: string;
  notification_sender_email: string;
  notification_days_before: number;
}

interface CheckResult {
  sent: boolean;
  expired: number;
  expiringSoon: number;
  recipient?: string;
  message?: string;
}

async function fetchSettings(): Promise<NotificationSettings> {
  const res = await fetch("/api/settings/notifications");
  if (!res.ok) throw new Error("Failed to load settings");
  const json = await res.json();
  return json.data;
}

async function saveSettings(data: NotificationSettings): Promise<void> {
  const res = await fetch("/api/settings/notifications", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? "Failed to save settings");
  }
}

async function triggerCheck(): Promise<CheckResult> {
  const res = await fetch("/api/notifications/license-expiry", { method: "POST" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Failed to run check");
  return json.data;
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["settings-notifications"],
    queryFn: fetchSettings,
  });

  const [form, setForm] = useState<NotificationSettings>({
    notifications_enabled: false,
    notification_recipient_email: "",
    notification_sender_email: "",
    notification_days_before: 30,
  });
  const [saved, setSaved] = useState(false);
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [checkError, setCheckError] = useState("");

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const saveMut = useMutation({
    mutationFn: saveSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings-notifications"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const checkMut = useMutation({
    mutationFn: triggerCheck,
    onSuccess: (result) => {
      setCheckResult(result);
      setCheckError("");
    },
    onError: (e: Error) => {
      setCheckError(e.message);
      setCheckResult(null);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMut.mutate(form);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading settings…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Settings form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg border p-6 space-y-5">
          <div>
            <h2 className="font-semibold text-base">License Expiry Notifications</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Automatically send email alerts via Microsoft Graph when licenses are about to expire or have already expired.
            </p>
          </div>

          {/* Enable toggle */}
          <div className="flex items-center justify-between rounded-md border p-4">
            <div className="flex items-center gap-3">
              {form.notifications_enabled ? (
                <Bell className="h-5 w-5 text-primary" />
              ) : (
                <BellOff className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <p className="text-sm font-medium">Email Notifications</p>
                <p className="text-xs text-muted-foreground">
                  {form.notifications_enabled ? "Enabled — alerts will be sent." : "Disabled — no alerts will be sent."}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.notifications_enabled}
              onClick={() => setForm((f) => ({ ...f, notifications_enabled: !f.notifications_enabled }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                form.notifications_enabled ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                  form.notifications_enabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div className={`grid grid-cols-1 gap-4 max-w-lg transition-opacity ${!form.notifications_enabled ? "opacity-50 pointer-events-none" : ""}`}>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Recipient Email</label>
              <input
                type="email"
                className="input w-full"
                placeholder="it-admin@company.com"
                value={form.notification_recipient_email}
                onChange={(e) => setForm({ ...form, notification_recipient_email: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                The address that will receive expiry alerts.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Sender Email (UPN)</label>
              <input
                type="email"
                className="input w-full font-mono text-sm"
                placeholder="noreply@company.com"
                value={form.notification_sender_email}
                onChange={(e) => setForm({ ...form, notification_sender_email: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                A licensed mailbox in your Entra tenant. The app registration needs the{" "}
                <code className="bg-muted px-1 rounded text-xs">Mail.Send</code> application permission with admin consent.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Alert Threshold (days)</label>
              <input
                type="number"
                min={1}
                max={365}
                className="input w-full"
                value={form.notification_days_before}
                onChange={(e) => setForm({ ...form, notification_days_before: Number(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">
                Send an alert when a license expires within this many days.
              </p>
            </div>
          </div>

          <div className="rounded-md bg-muted/50 border p-3 text-xs text-muted-foreground space-y-1 max-w-lg">
            <p className="font-medium text-foreground">Required API permissions (Application):</p>
            <p>• <code>Mail.Send</code> — Send mail as any user in the tenant</p>
            <p>• <code>User.Read.All</code> — Already required for Entra ID Sync</p>
            <p>• Grant admin consent in Azure Portal after adding the permission.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saveMut.isPending}
            className="btn-primary flex items-center gap-2"
          >
            {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Settings
          </button>
          {saved && <span className="text-sm text-green-600 font-medium">Saved successfully.</span>}
          {saveMut.isError && (
            <span className="text-sm text-destructive">{(saveMut.error as Error).message}</span>
          )}
        </div>
      </form>

      {/* Manual trigger */}
      <div className="rounded-lg border p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-base">Manual Check</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Run an immediate check against all licenses and send an alert email if any are expired or expiring soon.
            Useful for testing your configuration.
          </p>
        </div>

        <button
          onClick={() => checkMut.mutate()}
          disabled={checkMut.isPending || !form.notifications_enabled}
          className="btn-primary flex items-center gap-2"
          title={!form.notifications_enabled ? "Enable notifications first" : undefined}
        >
          {checkMut.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {checkMut.isPending ? "Checking…" : "Check & Send Now"}
        </button>

        {checkError && (
          <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            {checkError}
          </div>
        )}

        {checkResult && (
          <div className="space-y-3">
            {checkResult.sent ? (
              <>
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    Email sent to <strong>{checkResult.recipient}</strong>
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 max-w-xs">
                  <div className="rounded-md border p-3 text-center">
                    <div className="text-2xl font-bold text-red-600">{checkResult.expired}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Expired</div>
                  </div>
                  <div className="rounded-md border p-3 text-center">
                    <div className="text-2xl font-bold text-amber-600">{checkResult.expiringSoon}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Expiring Soon</div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                {checkResult.message ?? "No expiring licenses — no email sent."}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
