"use client";

import { useState, useCallback, useMemo } from "react";
import {
  Plus, Users, Trash2, Loader2, ChevronUp, ChevronDown, ChevronsUpDown,
  Eye, UserCheck, UserX, Building2, Monitor, Key, Clock,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useUsers, useCreateUser, useUpdateUser, useDeleteUsers, useBulkUpdateUsers } from "@/hooks/useUsers";
import { useAssignments } from "@/hooks/useAssignments";
import { SearchInput } from "@/components/shared/SearchInput";
import { Modal } from "@/components/shared/Modal";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageLoader } from "@/components/shared/LoadingSpinner";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { formatDuration } from "@/lib/utils";
import type { UserWithDepartment, UserRole } from "@/types";
import { useRouter } from "next/navigation";

const ROLE_COLORS: Record<UserRole, string> = {
  ADMIN: "bg-red-100 text-red-700",
  MANAGER: "bg-purple-100 text-purple-700",
  USER: "bg-gray-100 text-gray-600",
};

const ROLE_ORDER: Record<UserRole, number> = { ADMIN: 0, MANAGER: 1, USER: 2 };

type SortKey = "name" | "email" | "role" | "department";
type SortDir = "asc" | "desc";

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown className="h-3 w-3 opacity-40" />;
  return sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
}

function timeAgo(date: Date | string | null): string {
  if (!date) return "Never";
  const d = new Date(date);
  const diffMs = Date.now() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 30) return `${diffDays}d ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

interface Department { id: string; name: string }

function useDepartments() {
  return useQuery<{ data: Department[] }>({
    queryKey: ["departments"],
    queryFn: async () => {
      const res = await fetch("/api/departments");
      if (!res.ok) throw new Error("Failed to fetch departments");
      return res.json();
    },
  });
}

// ── User Detail Modal ──────────────────────────────────────────────
interface UserDetailModalProps {
  user: UserWithDepartment;
  onClose: () => void;
  onEdit: () => void;
}

function UserDetailModal({ user, onClose, onEdit }: UserDetailModalProps) {
  const router = useRouter();
  const { data: activeData, isLoading: activeLoading } = useAssignments({
    userId: user.id,
    active: true,
    pageSize: 50,
  });
  const { data: historyData, isLoading: historyLoading } = useAssignments({
    userId: user.id,
    pageSize: 50,
  });

  const initials = (user.name ?? user.email)
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const pastAssignments = historyData?.data.filter((a) => a.returnedAt) ?? [];

  return (
    <Modal open onClose={onClose} title="User Details" size="lg">
      <div className="space-y-6">
        {/* Profile section */}
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-semibold">{user.name ?? "—"}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[user.role]}`}>
                {user.role}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${user.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {user.isActive ? "Active" : "Inactive"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-muted-foreground">
              {user.department && <span>🏢 {user.department.name}</span>}
              {user.location && <span>📍 {user.location}</span>}
              <span>Joined {new Date(user.createdAt).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}</span>
              <span>Last login: {timeAgo(user.lastLoginAt)}</span>
            </div>
          </div>
          <button onClick={onEdit} className="btn-outline text-sm shrink-0">Edit</button>
        </div>

        {/* Active assignments */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold">
              Active Assignments
              {user.activeAssignmentCount > 0 && (
                <span className="ml-2 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                  {user.activeAssignmentCount}
                </span>
              )}
            </h4>
            {user.activeAssignmentCount > 0 && (
              <button
                onClick={() => { onClose(); router.push(`/assignments?userId=${user.id}`); }}
                className="text-xs text-primary hover:underline"
              >
                View all →
              </button>
            )}
          </div>
          {activeLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </div>
          ) : activeData?.data.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No active assignments.</p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Type</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Item</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Assigned At</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {activeData?.data.map((a) => (
                    <tr key={a.id} className="hover:bg-muted/20">
                      <td className="px-3 py-2">
                        {a.assetId ? (
                          <Monitor className="h-3.5 w-3.5 text-blue-500" />
                        ) : (
                          <Key className="h-3.5 w-3.5 text-purple-500" />
                        )}
                      </td>
                      <td className="px-3 py-2 font-medium">
                        {a.asset?.name ?? a.license?.name ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {new Date(a.assignedAt).toLocaleDateString("en-GB")}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {formatDuration(new Date(a.assignedAt))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Past assignments */}
        <div>
          <h4 className="text-sm font-semibold mb-2">
            Assignment History
            {pastAssignments.length > 0 && (
              <span className="ml-2 text-xs text-muted-foreground font-normal">
                ({pastAssignments.length} returned)
              </span>
            )}
          </h4>
          {historyLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </div>
          ) : pastAssignments.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No past assignments.</p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Type</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Item</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Assigned At</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Returned At</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pastAssignments.map((a) => (
                    <tr key={a.id} className="hover:bg-muted/20">
                      <td className="px-3 py-2">
                        {a.assetId ? (
                          <Monitor className="h-3.5 w-3.5 text-blue-500" />
                        ) : (
                          <Key className="h-3.5 w-3.5 text-purple-500" />
                        )}
                      </td>
                      <td className="px-3 py-2 font-medium">
                        {a.asset?.name ?? a.license?.name ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {new Date(a.assignedAt).toLocaleDateString("en-GB")}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {a.returnedAt ? new Date(a.returnedAt).toLocaleDateString("en-GB") : "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {formatDuration(new Date(a.assignedAt), a.returnedAt ? new Date(a.returnedAt) : undefined)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ── Main Page ──────────────────────────────────────────────────────
export default function UsersPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">("");
  const [deptFilter, setDeptFilter] = useState("");
  const [bulkDept, setBulkDept] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserWithDepartment | null>(null);
  const [viewUser, setViewUser] = useState<UserWithDepartment | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteError, setDeleteError] = useState("");
  const [bulkError, setBulkError] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const filters = useMemo(() => ({
    search: search || undefined,
    status: statusFilter || undefined,
    departmentId: deptFilter || undefined,
  }), [search, statusFilter, deptFilter]);

  const { data, isLoading } = useUsers(filters);
  const { data: deptsData } = useDepartments();
  const updateUser = useUpdateUser();
  const deleteUsers = useDeleteUsers();
  const bulkUpdate = useBulkUpdateUsers();

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("");
    setDeptFilter("");
    setSelected(new Set());
  };

  const handleSearch = useCallback((val: string) => {
    setSearch(val);
    setSelected(new Set());
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const users = useMemo(() => {
    const raw = data?.data ?? [];
    return [...raw].sort((a, b) => {
      if (sortKey === "role") {
        const diff = ROLE_ORDER[a.role] - ROLE_ORDER[b.role];
        return sortDir === "asc" ? diff : -diff;
      }
      let valA: string;
      let valB: string;
      if (sortKey === "department") {
        valA = a.department?.name ?? "";
        valB = b.department?.name ?? "";
      } else if (sortKey === "email") {
        valA = a.email;
        valB = b.email;
      } else {
        valA = a.name ?? "";
        valB = b.name ?? "";
      }
      const cmp = valA.localeCompare(valB, undefined, { sensitivity: "base" });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const allSelected = users.length > 0 && users.every((u) => selected.has(u.id));
  const someSelected = selected.size > 0;
  const departments = deptsData?.data ?? [];

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(users.map((u) => u.id)));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selected.size} selected user(s)? This cannot be undone.`)) return;
    setDeleteError("");
    try {
      await deleteUsers.mutateAsync(Array.from(selected));
      setSelected(new Set());
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const handleBulkAction = async (action: "activate" | "deactivate" | "setDepartment") => {
    setBulkError("");
    try {
      const ids = Array.from(selected);
      if (action === "setDepartment") {
        if (!bulkDept) return;
        await bulkUpdate.mutateAsync({ action, ids, departmentId: bulkDept });
        setBulkDept("");
      } else {
        await bulkUpdate.mutateAsync({ action, ids });
      }
      setSelected(new Set());
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : "Operation failed");
    }
  };

  const toggleActive = async (user: UserWithDepartment) => {
    await updateUser.mutateAsync({ id: user.id, isActive: !user.isActive });
  };

  const openEdit = (user: UserWithDepartment) => {
    setViewUser(null);
    setEditUser(user);
    setModalOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {data ? `${users.length} user(s)` : "Loading…"}
          </p>
        </div>
        <button onClick={() => { setEditUser(null); setModalOpen(true); }} className="btn-primary">
          <Plus className="h-4 w-4" /> New User
        </button>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={handleSearch}
          placeholder="Search by name or email…"
          className="sm:w-64"
        />

        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as "" | "active" | "inactive"); setSelected(new Set()); }}
          className="input text-sm h-9 w-36"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <select
          value={deptFilter}
          onChange={(e) => { setDeptFilter(e.target.value); setSelected(new Set()); }}
          className="input text-sm h-9 w-44"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>

        {(search || statusFilter || deptFilter) && (
          <button onClick={resetFilters} className="text-xs text-muted-foreground hover:text-foreground underline">
            Clear filters
          </button>
        )}
      </div>

      {/* Bulk action toolbar */}
      {someSelected && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
          <span className="text-sm font-medium text-muted-foreground">{selected.size} selected</span>
          <div className="h-4 w-px bg-border" />

          <button
            onClick={() => handleBulkAction("activate")}
            disabled={bulkUpdate.isPending}
            className="flex items-center gap-1.5 text-xs btn-outline h-7 px-2.5"
          >
            <UserCheck className="h-3.5 w-3.5" /> Activate
          </button>

          <button
            onClick={() => handleBulkAction("deactivate")}
            disabled={bulkUpdate.isPending}
            className="flex items-center gap-1.5 text-xs btn-outline h-7 px-2.5"
          >
            <UserX className="h-3.5 w-3.5" /> Deactivate
          </button>

          <div className="flex items-center gap-1.5">
            <select
              value={bulkDept}
              onChange={(e) => setBulkDept(e.target.value)}
              className="input text-xs h-7 w-40"
            >
              <option value="">Change Department…</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            {bulkDept && (
              <button
                onClick={() => handleBulkAction("setDepartment")}
                disabled={bulkUpdate.isPending}
                className="flex items-center gap-1.5 text-xs btn-outline h-7 px-2.5"
              >
                <Building2 className="h-3.5 w-3.5" /> Apply
              </button>
            )}
          </div>

          <div className="h-4 w-px bg-border" />

          <button
            onClick={handleBulkDelete}
            disabled={deleteUsers.isPending}
            className="flex items-center gap-1.5 text-xs btn-destructive h-7 px-2.5"
          >
            {deleteUsers.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Delete
          </button>
        </div>
      )}

      {(deleteError || bulkError) && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
          {deleteError || bulkError}
        </div>
      )}

      {isLoading ? (
        <PageLoader />
      ) : !users.length ? (
        <EmptyState
          icon={Users}
          title="No users found"
          description="Add users to manage asset assignments."
          action={
            <button onClick={() => setModalOpen(true)} className="btn-primary">
              <Plus className="h-4 w-4" /> New User
            </button>
          }
        />
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden md:block rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="rounded border-gray-300 cursor-pointer"
                      title="Select all"
                    />
                  </th>
                  {(
                    [
                      { label: "Name", key: "name" },
                      { label: "Email", key: "email" },
                      { label: "Role", key: "role" },
                      { label: "Department", key: "department" },
                    ] as { label: string; key: SortKey }[]
                  ).map(({ label, key }) => (
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
                  <th className="px-4 py-3 text-xs uppercase tracking-wide text-left font-medium text-muted-foreground">Location</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wide text-left font-medium text-muted-foreground">Assets</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wide text-left font-medium text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Last Login</span>
                  </th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wide text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className={`hover:bg-muted/30 ${!user.isActive ? "opacity-50" : ""} ${selected.has(user.id) ? "bg-primary/5" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(user.id)}
                        onChange={() => toggleOne(user.id)}
                        className="rounded border-gray-300 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium">{user.name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[user.role]}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {user.department?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {user.location ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {user.activeAssignmentCount > 0 ? (
                        <button
                          onClick={() => router.push(`/assignments?userId=${user.id}`)}
                          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors font-medium"
                          title="View assignments"
                        >
                          {user.activeAssignmentCount}
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {timeAgo(user.lastLoginAt)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(user)}
                        disabled={updateUser.isPending}
                        className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
                          user.isActive
                            ? "bg-green-100 text-green-700 hover:bg-green-200"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setViewUser(user)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => { setEditUser(user); setModalOpen(true); }}
                          className="text-xs text-muted-foreground hover:text-foreground underline"
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden grid gap-3">
            {users.map((user) => (
              <div
                key={user.id}
                className={`rounded-xl border p-4 bg-card space-y-2 ${!user.isActive ? "opacity-60" : ""} ${selected.has(user.id) ? "ring-2 ring-primary/40" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(user.id)}
                    onChange={() => toggleOne(user.id)}
                    className="mt-1 rounded border-gray-300 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{user.name ?? user.email}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[user.role]}`}>
                        {user.role}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1.5 text-xs text-muted-foreground">
                      {user.department && <span>{user.department.name}</span>}
                      {user.location && <span>📍 {user.location}</span>}
                      {user.activeAssignmentCount > 0 && (
                        <span className="text-blue-600">{user.activeAssignmentCount} asset(s)</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t mt-2">
                      <button
                        onClick={() => toggleActive(user)}
                        className={`text-xs px-2 py-0.5 rounded-full ${user.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </button>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setViewUser(user)} className="text-muted-foreground hover:text-foreground">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => { setEditUser(user); setModalOpen(true); }}
                          className="text-xs text-muted-foreground underline"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Create/Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editUser ? "Edit User" : "New User"}
        size="md"
      >
        <UserForm
          user={editUser ?? undefined}
          departments={departments}
          onSuccess={() => setModalOpen(false)}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>

      {/* Detail modal */}
      {viewUser && (
        <UserDetailModal
          user={viewUser}
          onClose={() => setViewUser(null)}
          onEdit={() => openEdit(viewUser)}
        />
      )}
    </div>
  );
}

// ── Inline UserForm ────────────────────────────────────────────────
interface UserFormProps {
  user?: UserWithDepartment;
  departments: Department[];
  onSuccess: () => void;
  onCancel: () => void;
}

function UserForm({ user, departments, onSuccess, onCancel }: UserFormProps) {
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const [form, setForm] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    role: user?.role ?? "USER",
    departmentId: user?.departmentId ?? "",
    location: user?.location ?? "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const isPending = createUser.isPending || updateUser.isPending;
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (user) {
        await updateUser.mutateAsync({
          id: user.id,
          name: form.name,
          role: form.role as UserRole,
          departmentId: form.departmentId || null,
          location: form.location || null,
        });
      } else {
        await createUser.mutateAsync({
          name: form.name,
          email: form.email,
          role: form.role as UserRole,
          password: form.password,
          departmentId: form.departmentId || null,
        });
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
      )}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">Full Name *</label>
        <input required value={form.name} onChange={(e) => set("name", e.target.value)} className="input" />
      </div>
      {!user && (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Email *</label>
            <input required type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className="input" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Password *</label>
            <input required type="password" minLength={8} value={form.password} onChange={(e) => set("password", e.target.value)} className="input" />
          </div>
        </>
      )}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">Role</label>
        <select value={form.role} onChange={(e) => set("role", e.target.value)} className="input">
          <option value="USER">User</option>
          <option value="MANAGER">Manager</option>
          <option value="ADMIN">Admin</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">Department</label>
        <select value={form.departmentId} onChange={(e) => set("departmentId", e.target.value)} className="input">
          <option value="">— None —</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">Location</label>
        <input
          value={form.location}
          onChange={(e) => set("location", e.target.value)}
          placeholder="e.g. Istanbul HQ, Remote, Floor 3"
          className="input"
          maxLength={100}
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="btn-outline">Cancel</button>
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending && <LoadingSpinner className="h-4 w-4" />}
          {user ? "Save Changes" : "Create User"}
        </button>
      </div>
    </form>
  );
}
