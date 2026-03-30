"use client";

import { useState, useCallback } from "react";
import { Plus, Key, Pencil, Trash2, Upload } from "lucide-react";
import { useLicenses, useDeleteLicense } from "@/hooks/useLicenses";
import { WarningBanner } from "@/components/shared/WarningBanner";
import { SearchInput } from "@/components/shared/SearchInput";
import { Pagination } from "@/components/shared/Pagination";
import { Modal } from "@/components/shared/Modal";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageLoader } from "@/components/shared/LoadingSpinner";
import { LicenseForm } from "@/components/licenses/LicenseForm";
import { ImportModal } from "@/components/shared/ImportModal";
import { formatDate, formatCurrency, isExpiringSoon } from "@/lib/utils";
import type { LicenseWithRelations } from "@/types";

function SeatBar({ available, total }: { available: number; total: number }) {
  const used = total - available;
  const pct = total > 0 ? Math.round((used / total) * 100) : 0;
  const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-yellow-500" : "bg-primary";
  return (
    <div className="w-full space-y-0.5">
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">
        {used}/{total} seats used
      </p>
    </div>
  );
}

export default function LicensesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editLicense, setEditLicense] = useState<LicenseWithRelations | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LicenseWithRelations | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const { data, isLoading } = useLicenses({ page, pageSize: 20, search });
  const deleteLicense = useDeleteLicense();

  const handleSearch = useCallback((val: string) => { setSearch(val); setPage(1); }, []);

  const openCreate = () => { setEditLicense(null); setModalOpen(true); };
  const openEdit = (l: LicenseWithRelations) => { setEditLicense(l); setModalOpen(true); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Licenses</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {data ? `${data.total} total` : "Loading…"}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setImportOpen(true)} className="btn-outline">
            <Upload className="h-4 w-4" /> Import
          </button>
          <button onClick={openCreate} className="btn-primary">
            <Plus className="h-4 w-4" /> New License
          </button>
        </div>
      </div>

      {data?.data.some((l) => isExpiringSoon(l.expirationDate)) && (
        <WarningBanner message="Some licenses are expiring within 30 days. Renew them to avoid disruption." />
      )}

      <SearchInput
        value={search}
        onChange={handleSearch}
        placeholder="Search by name or vendor…"
        className="sm:w-72"
      />

      {isLoading ? (
        <PageLoader />
      ) : !data?.data.length ? (
        <EmptyState
          icon={Key}
          title="No licenses found"
          description="Track software licenses and seat usage."
          action={
            <button onClick={openCreate} className="btn-primary">
              <Plus className="h-4 w-4" /> New License
            </button>
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {["Name", "Vendor", "Category", "Seats", "Expiry", "Cost", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.data.map((lic) => {
                  const expiring = isExpiringSoon(lic.expirationDate);
                  return (
                    <tr key={lic.id} className={`hover:bg-muted/30 ${expiring ? "bg-yellow-50/50" : ""}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium">{lic.name}</div>
                        {lic.isSubscription && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                            Subscription
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{lic.vendor ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{lic.category.name}</td>
                      <td className="px-4 py-3 min-w-[140px]">
                        <SeatBar available={lic.availableSeats} total={lic.totalSeats} />
                      </td>
                      <td className="px-4 py-3">
                        <span className={expiring ? "text-yellow-700 font-medium" : ""}>
                          {formatDate(lic.expirationDate)}
                          {expiring && " ⚠"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatCurrency(lic.purchaseCost)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => openEdit(lic)} className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setDeleteTarget(lic)} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden grid gap-3">
            {data.data.map((lic) => {
              const expiring = isExpiringSoon(lic.expirationDate);
              return (
                <div key={lic.id} className={`rounded-xl border p-4 space-y-3 ${expiring ? "border-yellow-300 bg-yellow-50/50" : "bg-card"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{lic.name}</p>
                      <p className="text-xs text-muted-foreground">{lic.vendor ?? lic.category.name}</p>
                    </div>
                    {lic.isSubscription && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded shrink-0">Sub</span>
                    )}
                  </div>
                  <SeatBar available={lic.availableSeats} total={lic.totalSeats} />
                  <div className="text-xs text-muted-foreground">
                    Expires: <span className={expiring ? "text-yellow-700 font-semibold" : "text-foreground"}>{formatDate(lic.expirationDate)}</span>
                  </div>
                  <div className="flex justify-end gap-1 pt-1 border-t">
                    <button onClick={() => openEdit(lic)} className="p-1.5 rounded hover:bg-accent text-muted-foreground">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setDeleteTarget(lic)} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {data.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, data.total)} of {data.total}</span>
              <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} />
            </div>
          )}
        </>
      )}

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} type="licenses" />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editLicense ? "Edit License" : "New License"} size="lg">
        <LicenseForm license={editLicense ?? undefined} onSuccess={() => setModalOpen(false)} onCancel={() => setModalOpen(false)} />
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => { await deleteLicense.mutateAsync(deleteTarget!.id); setDeleteTarget(null); }}
        title="Delete License"
        description={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleteLicense.isPending}
      />
    </div>
  );
}
