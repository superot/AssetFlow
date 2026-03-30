import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  description?: string;
  variant?: "default" | "warning" | "danger" | "success";
}

const variantStyles: Record<NonNullable<StatCardProps["variant"]>, string> = {
  default: "bg-card border-border",
  warning: "bg-yellow-50 border-yellow-200",
  danger: "bg-red-50 border-red-200",
  success: "bg-green-50 border-green-200",
};

const iconStyles: Record<NonNullable<StatCardProps["variant"]>, string> = {
  default: "text-primary",
  warning: "text-yellow-600",
  danger: "text-red-600",
  success: "text-green-600",
};

export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  variant = "default",
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border p-5 flex items-start gap-4",
        variantStyles[variant]
      )}
    >
      <div className={cn("mt-0.5", iconStyles[variant])}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-muted-foreground font-medium">{title}</p>
        <p className="text-2xl font-bold mt-0.5">{value}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </div>
    </div>
  );
}
