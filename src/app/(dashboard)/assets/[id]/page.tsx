"use client";

import { useState } from "react";
import { useAsset } from "@/hooks/useAsset";
import { useUsers } from "@/hooks/useUsers";
import { useCreateAssignment, useReturnAssignment } from "@/hooks/useAssignments";
import { useQueryClient } from "@tanstack/react-query";
import { QrCodeDisplay } from "@/components/assets/QrCodeDisplay";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Modal } from "@/components/shared/Modal";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { AssetForm } from "@/components/assets/AssetForm";
import { PageLoader, LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { formatDate, formatCurrency } from "@/lib/utils";
import { ArrowLeft, Pencil, QrCode, UserPlus, RotateCcw } from "lucide-react";
import Link from "next/link";
import type { AssetStatus } from "@/types";

interface AssetDetailPageProps {
  params: { id: string };
}

export default function AssetDetailPage({ params }: AssetDetailPageProps) {
  const qc = useQueryClient();
  const { data, isLoading, error } = useAsset(params.id);
  const { data: usersData } = useUsers();
  const createAssignment = useCreateAssignment();
  const returnAssignment = useReturnAssignment();

  const [editOpen, setEditOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [assignUserId, setAssignUserId] = useState("");
  const [assignNotes, setAssignNotes] = useState("");
  const [assignError, setAssignError] = useState("");

  if (isLoading) return <PageLoader />;
  if (error || !data) return <p className="text-red-600 text-sm">Asset not found.</p>;

  const asset = data.data;
  const activeAssignment = asset.assignments.find((a) => !a.returnedAt);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssignError("");
    try {
      await createAssignment.mutateAsync({ assetId: asset.id, userId: assignUserId, notes: assignNotes || undefined });
      qc.invalidateQueries({ queryKey: ["asset", params.id] });
      setAssignOpen(false);
      setAssignUserId("");
      setAssignNotes("");
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : "Failed to assign asset");
    }
  };

  const handleReturn = async () => {
    if (!activeAssignment) return;
    await returnAssignment.mutateAsync({ id: activeAssignment.id });
    qc.invalidateQueries({ queryKey: ["asset", params.id] });
    setReturnOpen(false);
  };

  const activeUsers = usersData?.data.filter((u) => u.isActive) ?? [];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link href="/assets" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Assets
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium truncate">{asset.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{asset.name}</h1>
          <p className="text-sm text-muted-foreground font-mono mt-0.5">{asset.assetTag}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <StatusBadge status={asset.status as AssetStatus} />

          {/* Assign / Return */}
          {asset.status === "AVAILABLE" && (
            <button onClick={() => setAssignOpen(true)} className="btn-primary flex items-center gap-1.5">
              <UserPlus className="h-4 w-4" /> Assign Asset
            </button>
          )}
          {asset.status === "DEPLOYED" && activeAssignment && (
            <button onClick={() => setReturnOpen(true)} className="btn-outline flex items-center gap-1.5">
              <RotateCcw className="h-4 w-4" /> Return Asset
            </button>
          )}

          <button onClick={() => setQrOpen(true)} className="btn-outline">
            <QrCode className="h-4 w-4" /> QR
          </button>
          <button onClick={() => setEditOpen(true)} className="btn-outline">
            <Pencil className="h-4 w-4" /> Edit
          </button>
        </div>
      </div>

      {/* Currently assigned to */}
      {activeAssignment && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 flex items-center gap-3 text-sm">
          <UserPlus className="h-4 w-4 text-blue-600 shrink-0" />
          <span className="text-blue-800">
            Currently assigned to{" "}
            <strong>{activeAssignment.user.name ?? activeAssignment.user.email}</strong>
            {" "}since {formatDate(activeAssignment.assignedAt)}
          </span>
        </div>
      )}

      {/* Info grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <InfoSection title="Details">
          <InfoRow label="Serial Number" value={asset.serialNumber} />
          <InfoRow label="Model" value={asset.model} />
          <InfoRow label="Manufacturer" value={asset.manufacturer} />
          <InfoRow label="Category" value={asset.category.name} />
          <InfoRow label="Location" value={asset.location} />
        </InfoSection>
        <InfoSection title="Purchase & Warranty">
          <InfoRow label="Purchase Date" value={formatDate(asset.purchaseDate)} />
          <InfoRow label="Warranty Expiry" value={formatDate(asset.warrantyExpiry)} />
          <InfoRow label="Purchase Cost" value={formatCurrency(asset.purchaseCost)} />
        </InfoSection>
        {asset.notes && (
          <InfoSection title="Notes" className="md:col-span-2">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{asset.notes}</p>
          </InfoSection>
        )}
      </div>

      {/* Assignment history */}
      <div>
        <h2 className="text-base font-semibold mb-3">Assignment History</h2>
        {asset.assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No assignments yet.</p>
        ) : (
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {["User", "Assigned By", "Assigned At", "Returned At"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {asset.assignments.map((a) => (
                  <tr key={a.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{a.user.name}</div>
                      <div className="text-xs text-muted-foreground">{a.user.email}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{a.createdBy.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(a.assignedAt)}</td>
                    <td className="px-4 py-3">
                      {a.returnedAt ? (
                        <span className="text-muted-foreground">{formatDate(a.returnedAt)}</span>
                      ) : (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Active</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Asset" size="lg">
        <AssetForm asset={asset} onSuccess={() => setEditOpen(false)} onCancel={() => setEditOpen(false)} />
      </Modal>

      {/* QR modal */}
      <Modal open={qrOpen} onClose={() => setQrOpen(false)} title="Asset QR Code" size="sm">
        <div className="flex justify-center py-4">
          <QrCodeDisplay assetTag={asset.assetTag} assetName={asset.name} size={200} />
        </div>
      </Modal>

      {/* Assign modal */}
      <Modal open={assignOpen} onClose={() => { setAssignOpen(false); setAssignError(""); }} title="Assign Asset" size="sm">
        <form onSubmit={handleAssign} className="space-y-4">
          {assignError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{assignError}</div>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">User *</label>
            <select
              required
              value={assignUserId}
              onChange={(e) => setAssignUserId(e.target.value)}
              className="input"
            >
              <option value="">Select a user…</option>
              {activeUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name ?? u.email} ({u.email})</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Notes</label>
            <textarea
              value={assignNotes}
              onChange={(e) => setAssignNotes(e.target.value)}
              className="input min-h-[72px] resize-none"
              placeholder="Optional handover notes…"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setAssignOpen(false)} className="btn-outline">Cancel</button>
            <button type="submit" disabled={createAssignment.isPending || !assignUserId} className="btn-primary">
              {createAssignment.isPending && <LoadingSpinner className="h-4 w-4" />}
              Assign
            </button>
          </div>
        </form>
      </Modal>

      {/* Return confirm */}
      <ConfirmDialog
        open={returnOpen}
        onClose={() => setReturnOpen(false)}
        onConfirm={handleReturn}
        title="Return Asset"
        description={`Mark "${asset.name}" as returned from ${activeAssignment?.user.name ?? activeAssignment?.user.email}? The asset will become Available.`}
        confirmLabel="Return Asset"
        loading={returnAssignment.isPending}
      />
    </div>
  );
}

function InfoSection({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border p-5 space-y-3 ${className ?? ""}`}>
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right">{value ?? "—"}</span>
    </div>
  );
}
