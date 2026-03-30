import { useQuery } from "@tanstack/react-query";
import type { Category } from "@/types";

async function fetchCategories(type?: "HARDWARE" | "SOFTWARE"): Promise<{ data: Category[] }> {
  const url = type ? `/api/categories?type=${type}` : "/api/categories";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch categories");
  return res.json();
}

export function useCategories(type?: "HARDWARE" | "SOFTWARE") {
  return useQuery({
    queryKey: ["categories", type],
    queryFn: () => fetchCategories(type),
    staleTime: 300_000, // categories rarely change
  });
}
