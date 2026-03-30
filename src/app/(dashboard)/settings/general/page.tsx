"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";

interface GeneralSettings {
  app_name: string;
  warranty_alert_days: string;
}

async function fetchSettings(): Promise<GeneralSettings> {
  const res = await fetch("/api/settings/general");
  if (!res.ok) throw new Error("Failed to load settings");
  const json = await res.json();
  return json.data;
}

async function saveSettings(data: GeneralSettings): Promise<void> {
  const res = await fetch("/api/settings/general", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_name: data.app_name,
      warranty_alert_days: Number(data.warranty_alert_days),
    }),
  });
  if (!res.ok) throw new Error("Failed to save settings");
}

export default function GeneralSettingsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["settings-general"], queryFn: fetchSettings });

  const [form, setForm] = useState<GeneralSettings>({ app_name: "", warranty_alert_days: "30" });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const mutation = useMutation({
    mutationFn: saveSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings-general"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(form);
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-lg border p-6 space-y-4">
        <h2 className="font-semibold text-base">Application</h2>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Application Name</label>
          <input
            className="input w-full max-w-sm"
            value={form.app_name}
            onChange={(e) => setForm({ ...form, app_name: e.target.value })}
            placeholder="AssetFlow"
          />
          <p className="text-xs text-muted-foreground">Displayed in the sidebar and browser title.</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Warranty Alert Days</label>
          <input
            type="number"
            min={1}
            max={365}
            className="input w-full max-w-sm"
            value={form.warranty_alert_days}
            onChange={(e) => setForm({ ...form, warranty_alert_days: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Show a warning badge when warranty expires within this many days.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="btn-primary flex items-center gap-2"
        >
          {mutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Changes
        </button>
        {saved && <span className="text-sm text-green-600 font-medium">Saved successfully.</span>}
        {mutation.isError && (
          <span className="text-sm text-destructive">Failed to save. Please try again.</span>
        )}
      </div>
    </form>
  );
}
