"use client";

import { useState } from "react";
import { useCategories } from "@/hooks/useCategories";
import { useCreateAsset, useUpdateAsset } from "@/hooks/useAssets";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import type { AssetWithRelations } from "@/types";

interface AssetFormProps {
  asset?: AssetWithRelations;
  onSuccess: () => void;
  onCancel: () => void;
}

const statusOptions = [
  { value: "AVAILABLE", label: "Available" },
  { value: "DEPLOYED", label: "Deployed" },
  { value: "UNDER_REPAIR", label: "Under Repair" },
  { value: "ARCHIVED", label: "Archived" },
];

function toDateInputValue(date: Date | string | null | undefined): string {
  if (!date) return "";
  return new Date(date).toISOString().split("T")[0];
}

export function AssetForm({ asset, onSuccess, onCancel }: AssetFormProps) {
  const { data: categoriesData } = useCategories("HARDWARE");
  const createAsset = useCreateAsset();
  const updateAsset = useUpdateAsset();

  const [form, setForm] = useState({
    assetTag: asset?.assetTag ?? "",
    serialNumber: asset?.serialNumber ?? "",
    name: asset?.name ?? "",
    model: asset?.model ?? "",
    manufacturer: asset?.manufacturer ?? "",
    categoryId: asset?.categoryId ?? "",
    status: asset?.status ?? "AVAILABLE",
    purchaseDate: toDateInputValue(asset?.purchaseDate),
    warrantyExpiry: toDateInputValue(asset?.warrantyExpiry),
    purchaseCost: asset?.purchaseCost != null ? String(asset.purchaseCost) : "",
    location: asset?.location ?? "",
    notes: asset?.notes ?? "",
  });
  const [error, setError] = useState<string | null>(null);

  const isPending = createAsset.isPending || updateAsset.isPending;

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const payload = {
      assetTag: form.assetTag,
      serialNumber: form.serialNumber || undefined,
      name: form.name,
      model: form.model || undefined,
      manufacturer: form.manufacturer || undefined,
      categoryId: form.categoryId,
      status: form.status as "AVAILABLE" | "DEPLOYED" | "UNDER_REPAIR" | "ARCHIVED",
      purchaseDate: form.purchaseDate ? new Date(form.purchaseDate).toISOString() : undefined,
      warrantyExpiry: form.warrantyExpiry ? new Date(form.warrantyExpiry).toISOString() : undefined,
      purchaseCost: form.purchaseCost ? parseFloat(form.purchaseCost) : undefined,
      location: form.location || undefined,
      notes: form.notes || undefined,
    };

    try {
      if (asset) {
        await updateAsset.mutateAsync({ id: asset.id, ...payload });
      } else {
        await createAsset.mutateAsync(payload);
      }
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

      <div className="grid grid-cols-2 gap-3">
        <Field label="Asset Tag *">
          <input
            required
            value={form.assetTag}
            onChange={(e) => set("assetTag", e.target.value)}
            disabled={!!asset}
            placeholder="e.g. AST-0001"
            className="input"
          />
        </Field>
        <Field label="Serial Number">
          <input
            value={form.serialNumber}
            onChange={(e) => set("serialNumber", e.target.value)}
            placeholder="SN123456"
            className="input"
          />
        </Field>
      </div>

      <Field label="Name *">
        <input
          required
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. Dell Latitude 5540"
          className="input"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Model">
          <input
            value={form.model}
            onChange={(e) => set("model", e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Manufacturer">
          <input
            value={form.manufacturer}
            onChange={(e) => set("manufacturer", e.target.value)}
            className="input"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Category *">
          <select
            required
            value={form.categoryId}
            onChange={(e) => set("categoryId", e.target.value)}
            className="input"
          >
            <option value="">Select category</option>
            {categoriesData?.data.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select
            value={form.status}
            onChange={(e) => set("status", e.target.value)}
            className="input"
          >
            {statusOptions.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Purchase Date">
          <input
            type="date"
            value={form.purchaseDate}
            onChange={(e) => set("purchaseDate", e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Warranty Expiry">
          <input
            type="date"
            value={form.warrantyExpiry}
            onChange={(e) => set("warrantyExpiry", e.target.value)}
            className="input"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Purchase Cost (₺)">
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.purchaseCost}
            onChange={(e) => set("purchaseCost", e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Location">
          <input
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
            placeholder="Office, Warehouse…"
            className="input"
          />
        </Field>
      </div>

      <Field label="Notes">
        <textarea
          rows={2}
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          className="input resize-none"
        />
      </Field>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm border rounded-lg hover:bg-accent"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
        >
          {isPending && <LoadingSpinner className="h-4 w-4" />}
          {asset ? "Save Changes" : "Create Asset"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
