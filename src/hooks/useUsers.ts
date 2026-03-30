import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { UserWithDepartment } from "@/types";
import type { CreateUserInput, UpdateUserInput } from "@/lib/validations";

interface UserFilters {
  search?: string;
  status?: "active" | "inactive";
  departmentId?: string;
}

async function fetchUsers(filters: UserFilters = {}): Promise<{ data: UserWithDepartment[] }> {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (filters.departmentId) params.set("departmentId", filters.departmentId);
  const res = await fetch(`/api/users?${params}`);
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json();
}

export function useUsers(filters: UserFilters = {}) {
  return useQuery({
    queryKey: ["users", filters],
    queryFn: () => fetchUsers(filters),
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateUserInput) => {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to create user");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useDeleteUsers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await fetch("/api/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error ?? "Failed to delete users");
      }
      return json;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateUserInput & { id: string }) => {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to update user");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

type BulkAction =
  | { action: "activate"; ids: string[] }
  | { action: "deactivate"; ids: string[] }
  | { action: "setDepartment"; ids: string[]; departmentId: string };

export function useBulkUpdateUsers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: BulkAction) => {
      const res = await fetch("/api/users/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Bulk update failed");
      return json.data as { updated: number };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}
