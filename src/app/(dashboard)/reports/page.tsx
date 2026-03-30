"use client";

import { Download, FileSpreadsheet, Monitor, Key, ClipboardList } from "lucide-react";
import { useDashboardStats } from "@/hooks/useDashboard";
import { StatCard } from "@/components/shared/StatCard";
import { PageLoader } from "@/components/shared/LoadingSpinner";
import { Package, CheckCircle, Wrench } from "lucide-react";

interface ExportCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  xlsxHref: string;
  csvHref: string;
}

function ExportCard({ title, description, icon: Icon, xlsxHref, csvHref }: ExportCardProps) {
  return (
    <div className="rounded-xl border p-5 flex items-start gap-4">
      <div className="text-primary mt-0.5">
        <Icon className="h-6 w-6" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        <div className="flex gap-2 mt-3">
          <a href={xlsxHref} download className="btn-primary text-xs">
            <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
          </a>
          <a href={csvHref} download className="btn-outline text-xs">
            <Download className="h-3.5 w-3.5" /> CSV
          </a>
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const { data, isLoading } = useDashboardStats();

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Export data as Excel or CSV for external analysis.
        </p>
      </div>

      {/* Summary stats */}
      {isLoading ? (
        <PageLoader />
      ) : data ? (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Current Snapshot
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard title="Total Assets" value={data.data.totalAssets} icon={Package} />
            <StatCard title="Deployed" value={data.data.deployedAssets} icon={Monitor} />
            <StatCard title="Available" value={data.data.availableAssets} icon={CheckCircle} variant="success" />
            <StatCard title="Under Repair" value={data.data.assetsUnderRepair} icon={Wrench} variant={data.data.assetsUnderRepair > 0 ? "warning" : "default"} />
          </div>
        </div>
      ) : null}

      {/* Export cards */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Export Reports
        </h2>
        <div className="space-y-3">
          <ExportCard
            title="Assets Report"
            description="All hardware assets with status, warranty dates, assignments, and cost."
            icon={Monitor}
            xlsxHref="/api/reports/assets"
            csvHref="/api/reports/assets?format=csv"
          />
          <ExportCard
            title="Licenses Report"
            description="All software licenses with seat usage, expiry dates, and costs."
            icon={Key}
            xlsxHref="/api/reports/licenses"
            csvHref="/api/reports/licenses?format=csv"
          />
          <ExportCard
            title="Active Assignments"
            description="Currently active zimmet records — who has what device or license."
            icon={ClipboardList}
            xlsxHref="/api/reports/assignments?active=true"
            csvHref="/api/reports/assignments?active=true&format=csv"
          />
          <ExportCard
            title="Full Assignment History"
            description="Complete assignment history including returned items."
            icon={FileSpreadsheet}
            xlsxHref="/api/reports/assignments"
            csvHref="/api/reports/assignments?format=csv"
          />
        </div>
      </div>
    </div>
  );
}
