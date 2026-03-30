import { cn } from "@/lib/utils";
import type { AssetStatus } from "@/types";

const statusConfig: Record<AssetStatus, { label: string; className: string }> = {
  AVAILABLE: { label: "Available", className: "bg-green-100 text-green-800" },
  DEPLOYED: { label: "Deployed", className: "bg-blue-100 text-blue-800" },
  UNDER_REPAIR: { label: "Under Repair", className: "bg-yellow-100 text-yellow-800" },
  ARCHIVED: { label: "Archived", className: "bg-gray-100 text-gray-600" },
};

interface StatusBadgeProps {
  status: AssetStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { label, className } = statusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        className
      )}
    >
      {label}
    </span>
  );
}
