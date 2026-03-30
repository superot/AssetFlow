"use client";

import {
  Monitor,
  CheckCircle,
  Wrench,
  Key,
  ClipboardList,
  AlertTriangle,
  Package,
  Clock,
} from "lucide-react";
import { StatCard } from "@/components/shared/StatCard";
import { WarningBanner } from "@/components/shared/WarningBanner";
import { PageLoader } from "@/components/shared/LoadingSpinner";
import { useDashboardStats } from "@/hooks/useDashboard";

export default function DashboardPage() {
  const { data, isLoading, error } = useDashboardStats();

  if (isLoading) return <PageLoader />;
  if (error || !data)
    return (
      <div className="text-sm text-red-600">Failed to load dashboard stats.</div>
    );

  const s = data.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          IT Asset Management Overview
        </p>
      </div>

      {/* Warning banners */}
      {s.expiringWarranties > 0 && (
        <WarningBanner
          message={`${s.expiringWarranties} asset warranty expiring within 30 days`}
        />
      )}
      {s.expiringLicenses > 0 && (
        <WarningBanner
          message={`${s.expiringLicenses} software license expiring within 30 days`}
        />
      )}

      {/* Asset stats */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Hardware Assets
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Assets" value={s.totalAssets} icon={Package} />
          <StatCard
            title="Deployed"
            value={s.deployedAssets}
            icon={Monitor}
            variant="default"
            description={`${s.totalAssets > 0 ? Math.round((s.deployedAssets / s.totalAssets) * 100) : 0}% of total`}
          />
          <StatCard
            title="Available"
            value={s.availableAssets}
            icon={CheckCircle}
            variant="success"
          />
          <StatCard
            title="Under Repair"
            value={s.assetsUnderRepair}
            icon={Wrench}
            variant={s.assetsUnderRepair > 0 ? "warning" : "default"}
          />
        </div>
      </div>

      {/* License & assignment stats */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Software & Assignments
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard title="Total Licenses" value={s.totalLicenses} icon={Key} />
          <StatCard
            title="Active Assignments"
            value={s.activeAssignments}
            icon={ClipboardList}
          />
          <StatCard
            title="Expiring Soon"
            value={s.expiringWarranties + s.expiringLicenses}
            icon={Clock}
            variant={
              s.expiringWarranties + s.expiringLicenses > 0
                ? "warning"
                : "default"
            }
            description="Warranties + licenses within 30 days"
          />
        </div>
      </div>

      {/* Expiry alert detail */}
      {(s.expiringWarranties > 0 || s.expiringLicenses > 0) && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <h3 className="text-sm font-semibold text-yellow-800">
              Action Required
            </h3>
          </div>
          <ul className="space-y-1 text-sm text-yellow-800">
            {s.expiringWarranties > 0 && (
              <li>
                • {s.expiringWarranties} asset(s) with warranty expiring within
                30 days — check the Assets page
              </li>
            )}
            {s.expiringLicenses > 0 && (
              <li>
                • {s.expiringLicenses} license(s) expiring within 30 days —
                check the Licenses page
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
