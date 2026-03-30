"use client";

import { useState } from "react";
import { useAssets } from "@/hooks/useAssets";
import { useLicenses } from "@/hooks/useLicenses";
import { useUsers } from "@/hooks/useUsers";
import { useCreateAssignment } from "@/hooks/useAssignments";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

interface AssignModalProps {
  onSuccess: () => void;
  onCancel: () => void;
}

type AssignType = "asset" | "license";

export function AssignModal({ onSuccess, onCancel }: AssignModalProps) {
  const [type, setType] = useState<AssignType>("asset");
  const [assetId, setAssetId] = useState("");
  const [licenseId, setLicenseId] = useState("");
  const [userId, setUserId] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: assetsData } = useAssets({ status: "AVAILABLE", pageSize: 100 });
  const { data: licensesData } = useLicenses({ pageSize: 100 });
  const { data: usersData } = useUsers();
  const createAssignment = useCreateAssignment();

  // Only show licenses with available seats
  const availableLicenses = licensesData?.data.filter((l) => l.availableSeats > 0) ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createAssignment.mutateAsync({
        assetId: type === "asset" ? assetId : undefined,
        licenseId: type === "license" ? licenseId : undefined,
        userId,
        notes: notes || undefined,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Type selector */}
      <div className="flex rounded-lg border overflow-hidden">
        {(["asset", "license"] as AssignType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`flex-1 py-2 text-sm font-medium capitalize transition-colors ${
              type === t
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent text-muted-foreground"
            }`}
          >
            {t === "asset" ? "Hardware Asset" : "Software License"}
          </button>
        ))}
      </div>

      {/* Asset / License select */}
      {type === "asset" ? (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Asset *</label>
          <select required value={assetId} onChange={(e) => setAssetId(e.target.value)} className="input">
            <option value="">Select available asset…</option>
            {assetsData?.data.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} — {a.assetTag}
              </option>
            ))}
          </select>
          {!assetsData?.data.length && (
            <p className="text-xs text-muted-foreground">No available assets.</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">License *</label>
          <select required value={licenseId} onChange={(e) => setLicenseId(e.target.value)} className="input">
            <option value="">Select license with available seats…</option>
            {availableLicenses.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.availableSeats} seats left)
              </option>
            ))}
          </select>
          {!availableLicenses.length && (
            <p className="text-xs text-muted-foreground">No licenses with available seats.</p>
          )}
        </div>
      )}

      {/* User select */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">Assign To *</label>
        <select required value={userId} onChange={(e) => setUserId(e.target.value)} className="input">
          <option value="">Select user…</option>
          {usersData?.data.filter((u) => u.isActive).map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} — {u.email}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">Notes</label>
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="input resize-none" />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="btn-outline">Cancel</button>
        <button type="submit" disabled={createAssignment.isPending} className="btn-primary">
          {createAssignment.isPending && <LoadingSpinner className="h-4 w-4" />}
          Assign
        </button>
      </div>
    </form>
  );
}
