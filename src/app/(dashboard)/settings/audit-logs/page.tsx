"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
}

interface AuditUser {
  id: string;
  name: string | null;
  email: string;
}

interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  changedBy: string;
  oldValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: AuditUser | null;
}

interface AuditResponse {
  data: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const ACTION_COLORS: Record<string, string> = {
  CREATED: "bg-green-100 text-green-700",
  UPDATED: "bg-blue-100 text-blue-700",
  DELETED: "bg-red-100 text-red-700",
  ASSIGNED: "bg-purple-100 text-purple-700",
  RETURNED: "bg-orange-100 text-orange-700",
};

async function fetchAuditLogs(page: number, pageSize: number, entityType?: string, action?: string): Promise<AuditResponse> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (entityType) params.set("entityType", entityType);
  if (action) params.set("action", action);

  const res = await fetch(`/api/settings/audit-logs?${params}`);
  if (!res.ok) throw new Error("Failed to load audit logs");
  return res.json();
}

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const pageSize = 20;

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["audit-logs", page, pageSize, entityType, action],
    queryFn: () => fetchAuditLogs(page, pageSize, entityType || undefined, action || undefined),
  });

  const handleFilterChange = () => setPage(1);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          className="input text-sm"
          value={entityType}
          onChange={(e) => { setEntityType(e.target.value); handleFilterChange(); }}
        >
          <option value="">All Entity Types</option>
          {["Asset", "License", "Assignment", "User", "Category", "Department", "SystemSetting"].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <select
          className="input text-sm"
          value={action}
          onChange={(e) => { setAction(e.target.value); handleFilterChange(); }}
        >
          <option value="">All Actions</option>
          {["CREATED", "UPDATED", "DELETED", "ASSIGNED", "RETURNED"].map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        {(entityType || action) && (
          <button
            className="btn-outline text-sm"
            onClick={() => { setEntityType(""); setAction(""); setPage(1); }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Timestamp</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Action</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Entity</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Changed By</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading || isFetching ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
                  </td>
                </tr>
              ) : data?.data.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">
                    No audit log entries found.
                  </td>
                </tr>
              ) : (
                data?.data.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ACTION_COLORS[log.action] ?? "bg-muted text-foreground"}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{log.entityType}</span>
                      <span className="text-muted-foreground text-xs ml-1 font-mono">
                        {log.entityId.slice(0, 8)}…
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {log.user ? (
                        <div>
                          <div className="font-medium">{log.user.name ?? log.user.email}</div>
                          {log.user.name && (
                            <div className="text-xs text-muted-foreground">{log.user.email}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs font-mono">
                          {log.changedBy.slice(0, 8)}…
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {log.newValue ? (
                        <pre className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1 max-w-xs overflow-hidden text-ellipsis whitespace-nowrap">
                          {JSON.stringify(log.newValue)}
                        </pre>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, data.total)} of {data.total} entries
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 1}
              className="p-1.5 rounded hover:bg-accent disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 py-1 rounded bg-muted text-xs font-medium">
              {page} / {data.totalPages}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= data.totalPages}
              className="p-1.5 rounded hover:bg-accent disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
