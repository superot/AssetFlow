"use client";

import { useState } from "react";
import { useCategories } from "@/hooks/useCategories";
import { useCreateLicense, useUpdateLicense } from "@/hooks/useLicenses";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import type { LicenseWithRelations } from "@/types";

interface LicenseFormProps {
  license?: LicenseWithRelations;
  onSuccess: () => void;
  onCancel: () => void;
}

function toDateInputValue(date: Date | string | null | undefined): string {
  if (!date) return "";
  return new Date(date).toISOString().split("T")[0];
}

export function LicenseForm({ license, onSuccess, onCancel }: LicenseFormProps) {
  const { data: categoriesData } = useCategories("SOFTWARE");
  const createLicense = useCreateLicense();
  const updateLicense = useUpdateLicense();

  const [form, setForm] = useState({
    name: license?.name ?? "",
    licenseKey: license?.licenseKey ?? "",
    vendor: license?.vendor ?? "",
    categoryId: license?.categoryId ?? "",
    totalSeats: license?.totalSeats ? String(license.totalSeats) : "1",
    expirationDate: toDateInputValue(license?.expirationDate),
    isSubscription: license?.isSubscription ?? false,
    purchaseCost: license?.purchaseCost != null ? String(license.purchaseCost) : "",
    notes: license?.notes ?? "",
  });
  const [error, setError] = useState<string | null>(null);

  const isPending = createLicense.isPending || updateLicense.isPending;
  const set = (field: string, value: string | boolean) =>
    setForm((f) => ({ ...f, [field]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = {
      name: form.name,
      licenseKey: form.licenseKey || undefined,
      vendor: form.vendor || undefined,
      categoryId: form.categoryId,
      totalSeats: parseInt(form.totalSeats),
      expirationDate: form.expirationDate
        ? new Date(form.expirationDate).toISOString()
        : undefined,
      isSubscription: form.isSubscription,
      purchaseCost: form.purchaseCost ? parseFloat(form.purchaseCost) : undefined,
      notes: form.notes || undefined,
    };
    try {
      if (license) {
        await updateLicense.mutateAsync({ id: license.id, ...payload });
      } else {
        await createLicense.mutateAsync(payload);
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

      <Field label="Name *">
        <input required value={form.name} onChange={(e) => set("name", e.target.value)} className="input" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Vendor">
          <input value={form.vendor} onChange={(e) => set("vendor", e.target.value)} placeholder="Microsoft, Adobe…" className="input" />
        </Field>
        <Field label="Category *">
          <select required value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} className="input">
            <option value="">Select category</option>
            {categoriesData?.data.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="License Key">
        <input value={form.licenseKey} onChange={(e) => set("licenseKey", e.target.value)} placeholder="XXXX-XXXX-XXXX-XXXX" className="input font-mono" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Total Seats *">
          <input required type="number" min="1" value={form.totalSeats} onChange={(e) => set("totalSeats", e.target.value)} className="input" />
        </Field>
        <Field label="Expiration Date">
          <input type="date" value={form.expirationDate} onChange={(e) => set("expirationDate", e.target.value)} className="input" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Purchase Cost (₺)">
          <input type="number" min="0" step="0.01" value={form.purchaseCost} onChange={(e) => set("purchaseCost", e.target.value)} className="input" />
        </Field>
        <Field label="Type">
          <label className="flex items-center gap-2 mt-2 cursor-pointer">
            <input type="checkbox" checked={form.isSubscription} onChange={(e) => set("isSubscription", e.target.checked)} className="h-4 w-4" />
            <span className="text-sm">Subscription</span>
          </label>
        </Field>
      </div>

      <Field label="Notes">
        <textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} className="input resize-none" />
      </Field>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="btn-outline">Cancel</button>
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending && <LoadingSpinner className="h-4 w-4" />}
          {license ? "Save Changes" : "Create License"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
