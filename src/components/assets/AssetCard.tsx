"use client";

import { Pencil, Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate, isExpiringSoon } from "@/lib/utils";
import type { AssetWithRelations, AssetStatus } from "@/types";

interface AssetCardProps {
  asset: AssetWithRelations;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function AssetCard({ asset, onEdit, onDelete }: AssetCardProps) {
  const expiring = isExpiringSoon(asset.warrantyExpiry);

  return (
    <div
      className={`rounded-xl border p-4 space-y-3 ${
        expiring ? "border-yellow-300 bg-yellow-50/50" : "bg-card"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold truncate">{asset.name}</p>
          <p className="text-xs text-muted-foreground font-mono">{asset.assetTag}</p>
        </div>
        <StatusBadge status={asset.status as AssetStatus} />
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {asset.model && (
          <>
            <span>Model</span>
            <span className="text-foreground font-medium">{asset.model}</span>
          </>
        )}
        <span>Category</span>
        <span className="text-foreground font-medium">{asset.category.name}</span>
        <span>Warranty</span>
        <span className={expiring ? "text-yellow-700 font-semibold" : "text-foreground font-medium"}>
          {formatDate(asset.warrantyExpiry)}
          {expiring && " ⚠"}
        </span>
      </div>

      <div className="flex items-center justify-end gap-1 pt-1 border-t">
        {onEdit && (
          <button
            onClick={onEdit}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
