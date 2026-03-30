import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { LicenseWithRelations, PaginatedResponse } from "@/types";
import type { CreateLicenseInput, UpdateLicenseInput } from "@/lib/validations";

interface LicenseFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  categoryId?: string;
}

async function fetchLicenses(
  filters: LicenseFilters = {}
): Promise<PaginatedResponse<LicenseWithRelations>> {
  const params = new URLSearchParams();
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
  if (filters.search) params.set("search", filters.search);
  if (filters.categoryId) params.set("categoryId", filters.categoryId);
  const res = await fetch(`/api/licenses?${params}`);
  if (!res.ok) throw new Error("Failed to fetch licenses");
  return res.json();
}

export function useLicenses(filters: LicenseFilters = {}) {
  return useQuery({
    queryKey: ["licenses", filters],
    queryFn: () => fetchLicenses(filters),
  });
}

export function useCreateLicense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateLicenseInput) => {
      const res = await fetch("/api/licenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to create license");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["licenses"] }),
  });
}

export function useUpdateLicense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateLicenseInput & { id: string }) => {
      const res = await fetch(`/api/licenses/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to update license");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["licenses"] }),
  });
}

export function useDeleteLicense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/licenses/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to delete license");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["licenses"] }),
  });
}
