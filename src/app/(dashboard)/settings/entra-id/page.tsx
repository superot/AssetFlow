"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, RefreshCw, CheckCircle2, AlertCircle, Clock } from "lucide-react";

interface EntraSettings {
  entra_tenant_id: string;
  entra_client_id: string;
  entra_client_secret: string;
}

interface EntraFilters {
  entra_filter_active_only: boolean;
  entra_filter_require_email: boolean;
  entra_filter_require_department: boolean;
  entra_filter_skip_guests: boolean;
  entra_filter_departments: string;
  entra_sync_deactivate_removed: boolean;
}

interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  deactivated: number;
  errors: { email: string; error: string }[];
}

const DEFAULT_FILTERS: EntraFilters = {
  entra_filter_active_only: true,
  entra_filter_require_email: true,
  entra_filter_require_department: false,
  entra_filter_skip_guests: true,
  entra_filter_departments: "",
  entra_sync_deactivate_removed: false,
};

async function fetchEntraSettings(): Promise<EntraSettings> {
  const res = await fetch("/api/settings/entra-id");
  if (!res.ok) throw new Error("Failed to load settings");
  const json = await res.json();
  return json.data;
}

async function saveEntraSettings(data: EntraSettings): Promise<void> {
  const res = await fetch("/api/settings/entra-id", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? "Failed to save settings");
  }
}

async function fetchEntraFilters(): Promise<EntraFilters & { entra_last_sync_at: string | null }> {
  const res = await fetch("/api/settings/entra-id/filters");
  if (!res.ok) throw new Error("Failed to load filter settings");
  const json = await res.json();
  return json.data;
}

async function saveEntraFilters(data: EntraFilters): Promise<void> {
  const res = await fetch("/api/settings/entra-id/filters", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? "Failed to save filter settings");
  }
}

async function runSync(): Promise<SyncResult> {
  const res = await fetch("/api/settings/entra-id/sync", { method: "POST" });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Sync failed");
  return json.data;
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          checked ? "bg-primary" : "bg-muted-foreground/30"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

export default function EntraIdPage() {
  const queryClient = useQueryClient();

  const { data: credsData, isLoading: credsLoading } = useQuery({
    queryKey: ["settings-entra-id"],
    queryFn: fetchEntraSettings,
  });

  const { data: filtersData, isLoading: filtersLoading } = useQuery({
    queryKey: ["settings-entra-id-filters"],
    queryFn: fetchEntraFilters,
  });

  const [form, setForm] = useState<EntraSettings>({
    entra_tenant_id: "",
    entra_client_id: "",
    entra_client_secret: "",
  });
  const [filters, setFilters] = useState<EntraFilters>(DEFAULT_FILTERS);
  const [credsSaved, setCredsSaved] = useState(false);
  const [filtersSaved, setFiltersSaved] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState("");

  useEffect(() => {
    if (credsData) setForm(credsData);
  }, [credsData]);

  useEffect(() => {
    if (filtersData) {
      const { entra_last_sync_at: _ignored, ...filterFields } = filtersData;
      setFilters(filterFields);
    }
  }, [filtersData]);

  const saveMut = useMutation({
    mutationFn: saveEntraSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings-entra-id"] });
      setCredsSaved(true);
      setTimeout(() => setCredsSaved(false), 3000);
    },
  });

  const saveFiltersMut = useMutation({
    mutationFn: saveEntraFilters,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings-entra-id-filters"] });
      setFiltersSaved(true);
      setTimeout(() => setFiltersSaved(false), 3000);
    },
  });

  const syncMut = useMutation({
    mutationFn: runSync,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["settings-entra-id-filters"] });
      setSyncResult(result);
      setSyncError("");
    },
    onError: (e: Error) => {
      setSyncError(e.message);
      setSyncResult(null);
    },
  });

  const handleCredsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMut.mutate(form);
  };

  const handleFiltersSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveFiltersMut.mutate(filters);
  };

  const credentialsSet =
    form.entra_tenant_id && form.entra_client_id && form.entra_client_secret;

  const lastSyncAt = filtersData?.entra_last_sync_at
    ? new Date(filtersData.entra_last_sync_at).toLocaleString("en-GB", {
        dateStyle: "long",
        timeStyle: "short",
      })
    : null;

  if (credsLoading || filtersLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading settings…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Credentials form */}
      <form onSubmit={handleCredsSubmit} className="space-y-4">
        <div className="rounded-lg border p-6 space-y-4">
          <div>
            <h2 className="font-semibold text-base">Microsoft Entra ID (Azure AD)</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Configure app registration credentials to sync users from your directory.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 max-w-lg">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tenant ID</label>
              <input
                className="input w-full font-mono text-sm"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={form.entra_tenant_id}
                onChange={(e) => setForm({ ...form, entra_tenant_id: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Client ID (Application ID)</label>
              <input
                className="input w-full font-mono text-sm"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={form.entra_client_id}
                onChange={(e) => setForm({ ...form, entra_client_id: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Client Secret</label>
              <input
                type="password"
                className="input w-full font-mono text-sm"
                placeholder={form.entra_client_secret ? "Leave unchanged to keep existing secret" : "Enter client secret"}
                value={form.entra_client_secret}
                onChange={(e) => setForm({ ...form, entra_client_secret: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Stored securely. The secret is never returned after saving.
              </p>
            </div>
          </div>

          <div className="rounded-md bg-muted/50 border p-3 text-xs text-muted-foreground space-y-1 max-w-lg">
            <p className="font-medium text-foreground">Required API permissions (Application):</p>
            <p>• <code>User.Read.All</code> — Read all users from the directory</p>
            <p>• Grant admin consent after adding the permission.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saveMut.isPending}
            className="btn-primary flex items-center gap-2"
          >
            {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Credentials
          </button>
          {credsSaved && <span className="text-sm text-green-600 font-medium">Saved successfully.</span>}
          {saveMut.isError && (
            <span className="text-sm text-destructive">{(saveMut.error as Error).message}</span>
          )}
        </div>
      </form>

      {/* Sync Filters */}
      <form onSubmit={handleFiltersSubmit} className="space-y-4">
        <div className="rounded-lg border p-6 space-y-2">
          <div className="mb-4">
            <h2 className="font-semibold text-base">Sync Filters</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Control which Entra ID accounts are imported into AssetFlow.
            </p>
          </div>

          <ToggleRow
            label="Active accounts only"
            description="Skip accounts where accountEnabled = false. Uses Graph server-side filtering for efficiency."
            checked={filters.entra_filter_active_only}
            onChange={(v) => setFilters({ ...filters, entra_filter_active_only: v })}
          />
          <ToggleRow
            label="Require email address"
            description="Skip accounts with no email or UPN. Excludes service principals and resource mailboxes."
            checked={filters.entra_filter_require_email}
            onChange={(v) => setFilters({ ...filters, entra_filter_require_email: v })}
          />
          <ToggleRow
            label="Skip guest accounts"
            description="Skip external B2B collaborators whose UPN contains #EXT#."
            checked={filters.entra_filter_skip_guests}
            onChange={(v) => setFilters({ ...filters, entra_filter_skip_guests: v })}
          />
          <ToggleRow
            label="Require department"
            description="Skip accounts that have no department set. Useful to exclude shared or system accounts."
            checked={filters.entra_filter_require_department}
            onChange={(v) => setFilters({ ...filters, entra_filter_require_department: v })}
          />
          <ToggleRow
            label="Deactivate users removed from Entra"
            description="After sync, mark any local user not returned by Entra as inactive. Enable only if Entra is your single source of truth."
            checked={filters.entra_sync_deactivate_removed}
            onChange={(v) => setFilters({ ...filters, entra_sync_deactivate_removed: v })}
          />

          <div className="pt-3 space-y-1.5">
            <label className="text-sm font-medium">Department allow-list</label>
            <input
              className="input w-full max-w-lg text-sm"
              placeholder="IT, Engineering, Finance  (leave empty to sync all departments)"
              value={filters.entra_filter_departments}
              onChange={(e) => setFilters({ ...filters, entra_filter_departments: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated. Only users in these departments will be imported. Leave blank to import all.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saveFiltersMut.isPending}
            className="btn-primary flex items-center gap-2"
          >
            {saveFiltersMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Filters
          </button>
          {filtersSaved && <span className="text-sm text-green-600 font-medium">Saved successfully.</span>}
          {saveFiltersMut.isError && (
            <span className="text-sm text-destructive">{(saveFiltersMut.error as Error).message}</span>
          )}
        </div>
      </form>

      {/* Sync section */}
      <div className="rounded-lg border p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-base">User Sync</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Pull users from Entra ID and create or update them in AssetFlow based on the filters above.
            Departments are created automatically.
          </p>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={() => syncMut.mutate()}
            disabled={syncMut.isPending || !credentialsSet}
            className="btn-primary flex items-center gap-2"
            title={!credentialsSet ? "Save credentials first" : undefined}
          >
            {syncMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {syncMut.isPending ? "Syncing…" : "Run Sync Now"}
          </button>

          {lastSyncAt && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Last synced: {lastSyncAt}
            </span>
          )}
        </div>

        {syncError && (
          <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            {syncError}
          </div>
        )}

        {syncResult && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm font-medium">Sync completed</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Created", value: syncResult.created, color: "text-green-600" },
                { label: "Updated", value: syncResult.updated, color: "text-blue-600" },
                { label: "Skipped", value: syncResult.skipped, color: "text-muted-foreground" },
                ...(filters.entra_sync_deactivate_removed
                  ? [{ label: "Deactivated", value: syncResult.deactivated, color: "text-orange-600" }]
                  : []),
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-md border p-3 text-center">
                  <div className={`text-2xl font-bold ${color}`}>{value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
                </div>
              ))}
            </div>

            {syncResult.errors.length > 0 && (
              <div className="rounded-md border border-orange-200 bg-orange-50 p-3 space-y-1">
                <p className="text-xs font-medium text-orange-800">
                  {syncResult.errors.length} user(s) failed to sync:
                </p>
                <div className="max-h-32 overflow-y-auto space-y-0.5">
                  {syncResult.errors.map((e, i) => (
                    <p key={i} className="text-xs text-orange-700">
                      {e.email}: {e.error}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
