"use client";

import { useState, useCallback } from "react";
import {
  Plus, ClipboardList, CornerDownLeft, Download,
  ChevronUp, ChevronDown, ChevronsUpDown, Loader2,
  Monitor, Key, Clock,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  useAssignments, useReturnAssignment, useBulkReturnAssignments,
} from "@/hooks/useAssignments";
import { useUsers } from "@/hooks/useUsers";
import { Modal } from "@/components/shared/Modal";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageLoader, LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Pagination } from "@/components/shared/Pagination";
import { SearchInput } from "@/components/shared/SearchInput";
import { StatCard } from "@/components/shared/StatCard";
import { AssignModal } from "@/components/assignments/AssignModal";
import { formatDate, formatDuration, durationDays } from "@/lib/utils";
import type { AssignmentWithRelations } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

type SortKey = "assignedAt" | "returnedAt";
type SortDir = "asc" | "desc";

interface StatsData {
  active: number;
  assetsDeployed: number;
  licensesInUse: number;
  returnedThisMonth: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown className="h-3 w-3 opacity-40" />;
  return sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
}

function DurationBadge({ assignedAt, returnedAt }: { assignedAt: string | Date; returnedAt?: string | Date | null }) {
  const days = durationDays(assignedAt, returnedAt);
  const color = returnedAt
    ? "text-muted-foreground"
    : days > 90
    ? "text-red-600 font-medium"
    : days > 30
    ? "text-amber-600"
    : "text-green-700";
  return <span className={`text-xs ${color}`}>{formatDuration(assignedAt, returnedAt)}</span>;
}

// ── Return dialog ─────────────────────────────────────────────────────────────

function ReturnDialog({
  assignment,
  onClose,
  onConfirm,
  isPending,
}: {
  assignment: AssignmentWithRelations;
  onClose: () => void;
  onConfirm: (notes: string) => void;
  isPending: boolean;
}) {
  const [notes, setNotes] = useState("");
  const itemName = assignment.asset?.name ?? assignment.license?.name ?? "item";
  const userName = assignment.user.name ?? assignment.user.email;

  return (
    <Modal open onClose={onClose} title="Return Item" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Mark <strong className="text-foreground">{itemName}</strong> as returned from{" "}
          <strong className="text-foreground">{userName}</strong>?{" "}
          The item will become available again.
        </p>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Return Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input w-full min-h-[72px] resize-none"
            placeholder="Condition, location, remarks…"
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn-outline">Cancel</button>
          <button
            onClick={() => onConfirm(notes)}
            disabled={isPending}
            className="btn-primary flex items-center gap-2"
          >
            {isPending && <LoadingSpinner className="h-4 w-4" />}
            <CornerDownLeft className="h-4 w-4" />
            Confirm Return
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AssignmentsPage() {
  const [page, setPage] = useState(1);
  const [activeOnly, setActiveOnly] = useState(true);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"" | "asset" | "license">("");
  const [userId, setUserId] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("assignedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkMsg, setBulkMsg] = useState("");

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [returnTarget, setReturnTarget] = useState<AssignmentWithRelations | null>(null);

  const { data, isLoading } = useAssignments({
    page, pageSize: 20, active: activeOnly, search, type, userId, sortBy: sortKey, sortDir,
  });
  const { data: usersData } = useUsers();
  const returnMut = useReturnAssignment();
  const bulkReturn = useBulkReturnAssignments();

  const { data: statsData } = useQuery<{ data: StatsData }>({
    queryKey: ["assignment-stats"],
    queryFn: () => fetch("/api/assignments/stats").then((r) => r.json()),
  });
  const stats = statsData?.data;

  const assignments = data?.data ?? [];
  const activeAssignments = assignments.filter((a) => !a.returnedAt);
  const allSelected = activeAssignments.length > 0 && activeAssignments.every((a) => selected.has(a.id));
  const someSelected = selected.size > 0;

  const handleSearch = useCallback((val: string) => { setSearch(val); setPage(1); setSelected(new Set()); }, []);
  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  };
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(activeAssignments.map((a) => a.id)));
  const toggleOne = (id: string) =>
    setSelected((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const handleReturn = async (notes: string) => {
    await returnMut.mutateAsync({ id: returnTarget!.id, notes });
    setReturnTarget(null);
  };

  const handleBulkReturn = async () => {
    setBulkMsg("");
    const result = await bulkReturn.mutateAsync(Array.from(selected));
    setSelected(new Set());
    if (result.skipped > 0)
      setBulkMsg(`${result.returned} returned. ${result.skipped} were already returned and skipped.`);
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (activeOnly) params.set("active", "true");
    if (search) params.set("search", search);
    if (type) params.set("type", type);
    if (userId) params.set("userId", userId);
    params.set("sortBy", sortKey);
    params.set("sortDir", sortDir);
    window.open(`/api/assignments/export?${params}`, "_blank");
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Assignments</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {data ? `${data.total} record(s)` : "Loading…"}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="btn-outline">
            <Download className="h-4 w-4" /> Export
          </button>
          <button onClick={() => setAssignModalOpen(true)} className="btn-primary">
            <Plus className="h-4 w-4" /> Assign
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard title="Active Assignments" value={stats.active} icon={ClipboardList} />
          <StatCard title="Assets Deployed" value={stats.assetsDeployed} icon={Monitor} />
          <StatCard title="License Seats In Use" value={stats.licensesInUse} icon={Key} />
          <StatCard title="Returned This Month" value={stats.returnedThisMonth} icon={Clock} variant="success" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {/* Active/All toggle */}
        <div className="flex rounded-lg border overflow-hidden">
          {[{ label: "Active", value: true }, { label: "All History", value: false }].map((opt) => (
            <button
              key={String(opt.value)}
              onClick={() => { setActiveOnly(opt.value); setPage(1); setSelected(new Set()); }}
              className={`px-3 py-1.5 text-sm transition-colors ${
                activeOnly === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <SearchInput value={search} onChange={handleSearch} placeholder="Search item or user…" className="sm:w-56" />

        <select value={type} onChange={(e) => { setType(e.target.value as typeof type); setPage(1); }} className="input sm:w-36">
          <option value="">All Types</option>
          <option value="asset">Assets</option>
          <option value="license">Licenses</option>
        </select>

        <select value={userId} onChange={(e) => { setUserId(e.target.value); setPage(1); }} className="input sm:w-44">
          <option value="">All Users</option>
          {(usersData?.data ?? []).map((u) => (
            <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
          ))}
        </select>
      </div>

      {/* Bulk toolbar */}
      {someSelected && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-2.5">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <button
            onClick={handleBulkReturn}
            disabled={bulkReturn.isPending}
            className="btn-primary flex items-center gap-1.5 text-sm py-1"
          >
            {bulkReturn.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CornerDownLeft className="h-3.5 w-3.5" />}
            Return Selected
          </button>
          <button onClick={() => setSelected(new Set())} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
        </div>
      )}
      {bulkMsg && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{bulkMsg}</p>
      )}

      {/* Content */}
      {isLoading ? (
        <PageLoader />
      ) : !assignments.length ? (
        <EmptyState
          icon={ClipboardList}
          title="No assignments found"
          description={activeOnly ? "No active assignments." : "No assignment history."}
          action={
            <button onClick={() => setAssignModalOpen(true)} className="btn-primary">
              <Plus className="h-4 w-4" /> Assign
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
                    {activeOnly && (
                      <input type="checkbox" checked={allSelected} onChange={toggleAll}
                        className="rounded border-gray-300 cursor-pointer" title="Select all active" />
                    )}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Item</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Assigned To</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Assigned By</th>
                  {(["assignedAt", "returnedAt"] as SortKey[]).map((key) => (
                    <th key={key} className="text-left px-4 py-3 text-xs uppercase tracking-wide">
                      <button
                        onClick={() => handleSort(key)}
                        className="flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {key === "assignedAt" ? "Assigned At" : "Returned At"}
                        <SortIcon col={key} sortKey={sortKey} sortDir={sortDir} />
                      </button>
                    </th>
                  ))}
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Duration</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {assignments.map((asgn) => (
                  <tr
                    key={asgn.id}
                    className={`hover:bg-muted/30 transition-colors ${selected.has(asgn.id) ? "bg-primary/5" : ""}`}
                  >
                    <td className="px-4 py-3">
                      {!asgn.returnedAt && (
                        <input type="checkbox" checked={selected.has(asgn.id)} onChange={() => toggleOne(asgn.id)}
                          className="rounded border-gray-300 cursor-pointer" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {asgn.asset ? (
                        <div>
                          <div className="font-medium flex items-center gap-1.5">
                            <Monitor className="h-3 w-3 text-muted-foreground shrink-0" />
                            {asgn.asset.name}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono ml-5">{asgn.asset.assetTag}</div>
                        </div>
                      ) : asgn.license ? (
                        <div>
                          <div className="font-medium flex items-center gap-1.5">
                            <Key className="h-3 w-3 text-muted-foreground shrink-0" />
                            {asgn.license.name}
                          </div>
                          <div className="text-xs text-muted-foreground ml-5">{asgn.license.vendor ?? "License"}</div>
                        </div>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{asgn.user.name}</div>
                      <div className="text-xs text-muted-foreground">{asgn.user.email}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-sm">{asgn.createdBy.name}</td>
                    <td className="px-4 py-3 text-muted-foreground text-sm">{formatDate(asgn.assignedAt)}</td>
                    <td className="px-4 py-3">
                      {asgn.returnedAt ? (
                        <div>
                          <div className="text-sm text-muted-foreground">{formatDate(asgn.returnedAt)}</div>
                          {asgn.notes && <div className="text-xs italic text-muted-foreground mt-0.5 max-w-[160px] truncate" title={asgn.notes}>{asgn.notes}</div>}
                        </div>
                      ) : (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Active</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <DurationBadge assignedAt={asgn.assignedAt} returnedAt={asgn.returnedAt} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!asgn.returnedAt && (
                        <button
                          onClick={() => setReturnTarget(asgn)}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs border rounded hover:bg-accent whitespace-nowrap"
                        >
                          <CornerDownLeft className="h-3 w-3" /> Return
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden grid gap-3">
            {assignments.map((asgn) => (
              <div
                key={asgn.id}
                className={`rounded-xl border p-4 bg-card space-y-2 ${selected.has(asgn.id) ? "ring-2 ring-primary/40" : ""}`}
              >
                <div className="flex items-start gap-3">
                  {!asgn.returnedAt && (
                    <input type="checkbox" checked={selected.has(asgn.id)} onChange={() => toggleOne(asgn.id)}
                      className="mt-0.5 rounded border-gray-300 cursor-pointer" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold truncate">{asgn.asset?.name ?? asgn.license?.name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{asgn.user.name ?? asgn.user.email}</p>
                      </div>
                      {!asgn.returnedAt
                        ? <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full shrink-0">Active</span>
                        : <span className="text-xs text-muted-foreground shrink-0">Returned</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>Assigned {formatDate(asgn.assignedAt)}</span>
                      <DurationBadge assignedAt={asgn.assignedAt} returnedAt={asgn.returnedAt} />
                    </div>
                    {asgn.notes && <p className="text-xs italic text-muted-foreground mt-1 truncate">{asgn.notes}</p>}
                    {!asgn.returnedAt && (
                      <button
                        onClick={() => setReturnTarget(asgn)}
                        className="mt-2 flex items-center gap-1 px-2.5 py-1 text-xs border rounded hover:bg-accent"
                      >
                        <CornerDownLeft className="h-3 w-3" /> Return
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, data.total)} of {data.total}</span>
              <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} />
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <Modal open={assignModalOpen} onClose={() => setAssignModalOpen(false)} title="New Assignment" size="md">
        <AssignModal onSuccess={() => setAssignModalOpen(false)} onCancel={() => setAssignModalOpen(false)} />
      </Modal>

      {returnTarget && (
        <ReturnDialog
          assignment={returnTarget}
          onClose={() => setReturnTarget(null)}
          onConfirm={handleReturn}
          isPending={returnMut.isPending}
        />
      )}

      {/* Bulk return confirmation handled inline via button */}
      <ConfirmDialog
        open={false}
        onClose={() => {}}
        onConfirm={() => {}}
        title=""
        description=""
      />
    </div>
  );
}
