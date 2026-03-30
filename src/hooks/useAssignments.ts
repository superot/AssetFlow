import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { AssignmentWithRelations, PaginatedResponse } from "@/types";
import type { CreateAssignmentInput } from "@/lib/validations";

interface AssignmentFilters {
  page?: number;
  pageSize?: number;
  userId?: string;
  active?: boolean;
  search?: string;
  type?: "asset" | "license" | "";
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

async function fetchAssignments(
  filters: AssignmentFilters = {}
): Promise<PaginatedResponse<AssignmentWithRelations>> {
  const params = new URLSearchParams();
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
  if (filters.userId) params.set("userId", filters.userId);
  if (filters.active) params.set("active", "true");
  if (filters.search) params.set("search", filters.search);
  if (filters.type) params.set("type", filters.type);
  if (filters.sortBy) params.set("sortBy", filters.sortBy);
  if (filters.sortDir) params.set("sortDir", filters.sortDir);
  const res = await fetch(`/api/assignments?${params}`);
  if (!res.ok) throw new Error("Failed to fetch assignments");
  return res.json();
}

export function useAssignments(filters: AssignmentFilters = {}) {
  return useQuery({
    queryKey: ["assignments", filters],
    queryFn: () => fetchAssignments(filters),
  });
}

export function useCreateAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateAssignmentInput) => {
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to create assignment");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assignments"] });
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["licenses"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useReturnAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const res = await fetch(`/api/assignments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to return assignment");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assignments"] });
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["licenses"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useBulkReturnAssignments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await fetch("/api/assignments/bulk-return", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Bulk return failed");
      return json.data as { returned: number; skipped: number };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assignments"] });
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["licenses"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
