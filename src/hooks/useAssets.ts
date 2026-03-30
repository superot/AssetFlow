import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { AssetWithRelations, PaginatedResponse, AssetStatus } from "@/types";
import type { CreateAssetInput, UpdateAssetInput } from "@/lib/validations";

interface AssetFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  categoryId?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

async function fetchAssets(
  filters: AssetFilters = {}
): Promise<PaginatedResponse<AssetWithRelations>> {
  const params = new URLSearchParams();
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (filters.categoryId) params.set("categoryId", filters.categoryId);
  if (filters.sortBy) params.set("sortBy", filters.sortBy);
  if (filters.sortDir) params.set("sortDir", filters.sortDir);
  const res = await fetch(`/api/assets?${params}`);
  if (!res.ok) throw new Error("Failed to fetch assets");
  return res.json();
}

export function useAssets(filters: AssetFilters = {}) {
  return useQuery({
    queryKey: ["assets", filters],
    queryFn: () => fetchAssets(filters),
  });
}

export function useCreateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateAssetInput) => {
      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to create asset");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assets"] }),
  });
}

export function useUpdateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateAssetInput & { id: string }) => {
      const res = await fetch(`/api/assets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to update asset");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assets"] }),
  });
}

export function useDeleteAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/assets/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to delete asset");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assets"] }),
  });
}

export function useBulkUpdateAssets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: AssetStatus }) => {
      const res = await fetch("/api/assets/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, status }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Bulk update failed");
      return json.data as { updated: number; skipped: number; skippedTags: string[] };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assets"] }),
  });
}

export function useBulkDeleteAssets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await fetch("/api/assets/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Bulk delete failed");
      return json.data as { deleted: number; skipped: number; skippedTags: string[] };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assets"] }),
  });
}
