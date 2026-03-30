"use client";

import { useState, useCallback } from "react";
import {
  Plus, Monitor, Pencil, Trash2, QrCode, Upload, Download,
  ChevronUp, ChevronDown, ChevronsUpDown, Loader2, UserCheck,
} from "lucide-react";
import Link from "next/link";
import {
  useAssets, useDeleteAsset, useUpdateAsset, useBulkUpdateAssets, useBulkDeleteAssets,
} from "@/hooks/useAssets";
import { useCategories } from "@/hooks/useCategories";
import { WarningBanner } from "@/components/shared/WarningBanner";
import { SearchInput } from "@/components/shared/SearchInput";
import { Pagination } from "@/components/shared/Pagination";
import { Modal } from "@/components/shared/Modal";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageLoader } from "@/components/shared/LoadingSpinner";
import { AssetForm } from "@/components/assets/AssetForm";
import { AssetCard } from "@/components/assets/AssetCard";
import { QrCodeDisplay } from "@/components/assets/QrCodeDisplay";
import { ImportModal } from "@/components/shared/ImportModal";
import { formatDate, isExpiringSoon } from "@/lib/utils";
import type { AssetWithRelations, AssetStatus } from "@/types";

// ── Types ────────────────────────────────────────────────────────────────────

type SortKey = "name" | "assetTag" | "status" | "warrantyExpiry" | "purchaseCost" | "createdAt";
type SortDir = "asc" | "desc";

const STATUS_OPTIONS = [
  { value: "", label: "All Status" },
  { value: "AVAILABLE", label: "Available" },
  { value: "DEPLOYED", label: "Deployed" },
  { value: "UNDER_REPAIR", label: "Under Repair" },
  { value: "ARCHIVED", label: "Archived" },
];

const BULK_STATUS_OPTIONS: { value: AssetStatus; label: string }[] = [
  { value: "AVAILABLE", label: "Mark Available" },
  { value: "UNDER_REPAIR", label: "Mark Under Repair" },
  { value: "ARCHIVED", label: "Archive" },
];

const STATUS_BADGE: Record<AssetStatus, string> = {
  AVAILABLE: "bg-green-100 text-green-800",
  DEPLOYED: "bg-blue-100 text-blue-800",
  UNDER_REPAIR: "bg-yellow-100 text-yellow-800",
  ARCHIVED: "bg-gray-100 text-gray-600",
};

// ── Sort icon ────────────────────────────────────────────────────────────────

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown className="h-3 w-3 opacity-40" />;
  return sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
}

// ── Quick status select ───────────────────────────────────────────────────────

function QuickStatusSelect({
  asset,
  pending,
  onUpdate,
}: {
  asset: AssetWithRelations;
  pending: boolean;
  onUpdate: (id: string, status: AssetStatus) => void;
}) {
  if (asset.status === "DEPLOYED") {
    return (
      <span
        className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[asset.status]}`}
        title="Use Assign / Return to change a deployed asset's status"
      >
        Deployed
      </span>
    );
  }

  return (
    <div className="relative flex items-center">
      {pending && <Loader2 className="h-3 w-3 animate-spin mr-1 text-muted-foreground" />}
      <select
        value={asset.status}
        disabled={pending}
        onChange={(e) => onUpdate(asset.id, e.target.value as AssetStatus)}
        className={`text-xs px-2 py-0.5 rounded-full font-medium border-0 cursor-pointer appearance-none pr-5 ${STATUS_BADGE[asset.status]} disabled:opacity-60`}
      >
        {(["AVAILABLE", "UNDER_REPAIR", "ARCHIVED"] as AssetStatus[]).map((s) => (
          <option key={s} value={s} className="bg-white text-gray-900 text-sm">
            {s === "AVAILABLE" ? "Available" : s === "UNDER_REPAIR" ? "Under Repair" : "Archived"}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AssetsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [bulkActionMsg, setBulkActionMsg] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editAsset, setEditAsset] = useState<AssetWithRelations | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AssetWithRelations | null>(null);
  const [qrAsset, setQrAsset] = useState<AssetWithRelations | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const { data, isLoading } = useAssets({
    page, pageSize: 20, search, status, categoryId, sortBy: sortKey, sortDir,
  });
  const { data: categoriesData } = useCategories("HARDWARE");
  const deleteAsset = useDeleteAsset();
  const updateAsset = useUpdateAsset();
  const bulkUpdate = useBulkUpdateAssets();
  const bulkDelete = useBulkDeleteAssets();

  const assets = data?.data ?? [];

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSearch = useCallback((val: string) => {
    setSearch(val); setPage(1); setSelected(new Set());
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  };

  const toggleAll = () => {
    setSelected(assets.every((a) => selected.has(a.id))
      ? new Set()
      : new Set(assets.map((a) => a.id)));
  };

  const toggleOne = (id: string) =>
    setSelected((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const handleQuickStatus = async (id: string, status: AssetStatus) => {
    setPendingStatusId(id);
    try { await updateAsset.mutateAsync({ id, status }); }
    finally { setPendingStatusId(null); }
  };

  const handleBulkStatus = async (status: AssetStatus) => {
    setBulkActionMsg("");
    const result = await bulkUpdate.mutateAsync({ ids: Array.from(selected), status });
    setSelected(new Set());
    if (result.skipped > 0) {
      setBulkActionMsg(`${result.updated} updated. ${result.skipped} skipped (deployed): ${result.skippedTags.join(", ")}`);
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Archive ${selected.size} selected asset(s)? Deployed assets will be skipped.`)) return;
    setBulkActionMsg("");
    const result = await bulkDelete.mutateAsync(Array.from(selected));
    setSelected(new Set());
    if (result.skipped > 0) {
      setBulkActionMsg(`${result.deleted} archived. ${result.skipped} skipped (deployed): ${result.skippedTags.join(", ")}`);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteAsset.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (categoryId) params.set("categoryId", categoryId);
    params.set("sortBy", sortKey);
    params.set("sortDir", sortDir);
    window.open(`/api/assets/export?${params}`, "_blank");
  };

  const expiringCount = assets.filter((a) => isExpiringSoon(a.warrantyExpiry)).length;
  const someSelected = selected.size > 0;
  const allSelected = assets.length > 0 && assets.every((a) => selected.has(a.id));

  const sortableHeaders: { key: SortKey; label: string }[] = [
    { key: "assetTag", label: "Tag" },
    { key: "name", label: "Name" },
    { key: "status", label: "Status" },
    { key: "warrantyExpiry", label: "Warranty" },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Assets</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {data ? `${data.total} total` : "Loading…"}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="btn-outline" title="Export current filter to Excel">
            <Download className="h-4 w-4" /> Export
          </button>
          <button onClick={() => setImportOpen(true)} className="btn-outline">
            <Upload className="h-4 w-4" /> Import
          </button>
          <button onClick={() => { setEditAsset(null); setModalOpen(true); }} className="btn-primary">
            <Plus className="h-4 w-4" /> New Asset
          </button>
        </div>
      </div>

      {/* Warranty warning */}
      {expiringCount > 0 && (
        <WarningBanner message={`${expiringCount} asset${expiringCount > 1 ? "s" : ""} have warranties expiring within 30 days.`} />
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <SearchInput
          value={search}
          onChange={handleSearch}
          placeholder="Search by name, tag, serial…"
          className="sm:w-64"
        />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="input sm:w-40">
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }} className="input sm:w-44">
          <option value="">All Categories</option>
          {categoriesData?.data.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Bulk action toolbar */}
      {someSelected && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 px-4 py-2.5">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="flex items-center gap-2">
            <select
              className="input text-sm py-1"
              defaultValue=""
              onChange={(e) => { if (e.target.value) handleBulkStatus(e.target.value as AssetStatus); }}
            >
              <option value="" disabled>Change Status…</option>
              {BULK_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button
              onClick={handleBulkDelete}
              disabled={bulkDelete.isPending}
              className="btn-destructive flex items-center gap-1.5 text-sm py-1"
            >
              {bulkDelete.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Archive
            </button>
            <button onClick={() => setSelected(new Set())} className="text-xs text-muted-foreground hover:text-foreground">
              Clear
            </button>
          </div>
        </div>
      )}
      {bulkActionMsg && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{bulkActionMsg}</p>
      )}

      {/* Content */}
      {isLoading ? (
        <PageLoader />
      ) : !assets.length ? (
        <EmptyState
          icon={Monitor}
          title="No assets found"
          description="Add your first hardware asset to get started."
          action={
            <button onClick={() => { setEditAsset(null); setModalOpen(true); }} className="btn-primary">
              <Plus className="h-4 w-4" /> New Asset
            </button>
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll}
                      className="rounded border-gray-300 cursor-pointer" title="Select all" />
                  </th>
                  {sortableHeaders.map(({ key, label }) => (
                    <th key={key} className="text-left px-4 py-3 text-xs uppercase tracking-wide">
                      <button
                        onClick={() => handleSort(key)}
                        className="flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {label}
                        <SortIcon col={key} sortKey={sortKey} sortDir={sortDir} />
                      </button>
                    </th>
                  ))}
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Category</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Assigned To</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {assets.map((asset) => {
                  const expiring = isExpiringSoon(asset.warrantyExpiry);
                  const isPending = pendingStatusId === asset.id;
                  return (
                    <tr
                      key={asset.id}
                      className={`hover:bg-muted/30 transition-colors ${expiring ? "bg-yellow-50/40" : ""} ${selected.has(asset.id) ? "bg-primary/5" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selected.has(asset.id)} onChange={() => toggleOne(asset.id)}
                          className="rounded border-gray-300 cursor-pointer" />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{asset.assetTag}</td>
                      <td className="px-4 py-3">
                        <Link href={`/assets/${asset.id}`} className="font-medium hover:underline">
                          {asset.name}
                        </Link>
                        {asset.model && <div className="text-xs text-muted-foreground">{asset.model}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <QuickStatusSelect asset={asset} pending={isPending} onUpdate={handleQuickStatus} />
                      </td>
                      <td className="px-4 py-3">
                        <span className={expiring ? "text-yellow-700 font-medium" : "text-muted-foreground"}>
                          {formatDate(asset.warrantyExpiry)}{expiring && " ⚠"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{asset.category.name}</td>
                      <td className="px-4 py-3">
                        {asset.currentAssignment ? (
                          <span className="flex items-center gap-1 text-xs text-blue-700">
                            <UserCheck className="h-3 w-3" />
                            {asset.currentAssignment.user.name ?? asset.currentAssignment.user.email}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => setQrAsset(asset)}
                            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground" title="QR Code">
                            <QrCode className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => { setEditAsset(asset); setModalOpen(true); }}
                            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setDeleteTarget(asset)}
                            className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden grid gap-3">
            {assets.map((asset) => (
              <div key={asset.id} className={`relative ${selected.has(asset.id) ? "ring-2 ring-primary/40 rounded-xl" : ""}`}>
                <div className="absolute top-3 left-3 z-10">
                  <input type="checkbox" checked={selected.has(asset.id)} onChange={() => toggleOne(asset.id)}
                    className="rounded border-gray-300 cursor-pointer" />
                </div>
                <AssetCard
                  asset={asset}
                  onEdit={() => { setEditAsset(asset); setModalOpen(true); }}
                  onDelete={() => setDeleteTarget(asset)}
                />
                {asset.currentAssignment && (
                  <div className="mx-1 -mt-1 mb-1 px-4 pb-2 flex items-center gap-1 text-xs text-blue-700">
                    <UserCheck className="h-3 w-3" />
                    {asset.currentAssignment.user.name ?? asset.currentAssignment.user.email}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, data.total)} of {data.total}
              </span>
              <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} />
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editAsset ? "Edit Asset" : "New Asset"} size="lg">
        <AssetForm asset={editAsset ?? undefined} onSuccess={() => setModalOpen(false)} onCancel={() => setModalOpen(false)} />
      </Modal>

      <Modal open={!!qrAsset} onClose={() => setQrAsset(null)} title="Asset QR Code" size="sm">
        {qrAsset && (
          <div className="flex justify-center py-4">
            <QrCodeDisplay assetTag={qrAsset.assetTag} assetName={qrAsset.name} size={200} />
          </div>
        )}
      </Modal>

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} type="assets" />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Archive Asset"
        description={`Archive "${deleteTarget?.name}"? This will mark it as archived and hide it from active lists.`}
        confirmLabel="Archive"
        variant="danger"
        loading={deleteAsset.isPending}
      />
    </div>
  );
}
