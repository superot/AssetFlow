interface LicenseDetailPageProps {
  params: { id: string };
}

export default function LicenseDetailPage({ params }: LicenseDetailPageProps) {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">License Detail</h1>
      <p className="text-muted-foreground">ID: {params.id}</p>
      {/* License detail — Phase 3 */}
    </div>
  );
}
