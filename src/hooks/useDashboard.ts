import { useQuery } from "@tanstack/react-query";
import type { DashboardStats } from "@/types";

async function fetchDashboardStats(): Promise<{ data: DashboardStats }> {
  const res = await fetch("/api/dashboard");
  if (!res.ok) throw new Error("Failed to fetch dashboard stats");
  return res.json();
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboardStats,
  });
}
