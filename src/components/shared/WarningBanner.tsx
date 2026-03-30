import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface WarningBannerProps {
  message: string;
  className?: string;
}

export function WarningBanner({ message, className }: WarningBannerProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800",
        className
      )}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
