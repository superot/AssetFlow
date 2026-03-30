import { useQuery } from "@tanstack/react-query";
import type { AssetWithRelations } from "@/types";

async function fetchAsset(id: string): Promise<{ data: AssetWithRelations }> {
  const res = await fetch(`/api/assets/${id}`);
  if (!res.ok) throw new Error("Asset not found");
  return res.json();
}

export function useAsset(id: string) {
  return useQuery({
    queryKey: ["assets", id],
    queryFn: () => fetchAsset(id),
    enabled: !!id,
  });
}
