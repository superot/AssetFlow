"use client";

import { useState, useRef } from "react";
import { Upload, Download, CheckCircle, AlertTriangle } from "lucide-react";
import { Modal } from "./Modal";
import { LoadingSpinner } from "./LoadingSpinner";
import { useQueryClient } from "@tanstack/react-query";

interface ImportResult {
  created: number;
  skipped?: number;
  skippedTags?: string[];
  validationErrors: { row: number; message: string }[];
}

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  type: "assets" | "licenses";
}

export function ImportModal({ open, onClose, type }: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const label = type === "assets" ? "Assets" : "Licenses";

  function handleClose() {
    setFile(null);
    setResult(null);
    setError(null);
    onClose();
  }

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`/api/${type}/import`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Import failed");
        return;
      }
      setResult(json);
      // Invalidate list queries
      qc.invalidateQueries({ queryKey: [type] });
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title={`Import ${label}`} size="md">
      <div className="space-y-5">
        {/* Template download */}
        <div className="rounded-lg bg-muted/50 border p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Download Template</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Fill in the Excel template and upload it below.
            </p>
          </div>
          <a
            href={`/api/templates/${type}`}
            download
            className="btn-outline shrink-0 text-xs"
          >
            <Download className="h-3.5 w-3.5" /> Template
          </a>
        </div>

        {/* File picker */}
        {!result && (
          <div
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-2 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
          >
            <Upload className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm font-medium">
              {file ? file.name : "Click to select file"}
            </p>
            <p className="text-xs text-muted-foreground">CSV or Excel (.xlsx, .xls)</p>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setError(null);
              }}
            />
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
              <CheckCircle className="h-5 w-5 shrink-0" />
              <div className="text-sm">
                <span className="font-semibold">{result.created} {label.toLowerCase()}</span> imported successfully.
                {(result.skipped ?? 0) > 0 && (
                  <span className="ml-1 text-muted-foreground">
                    {result.skipped} skipped (duplicate tags).
                  </span>
                )}
              </div>
            </div>

            {result.validationErrors.length > 0 && (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                <p className="text-xs font-semibold text-yellow-800 mb-2">
                  {result.validationErrors.length} row(s) had errors and were skipped:
                </p>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {result.validationErrors.map((e, i) => (
                    <p key={i} className="text-xs text-yellow-700">
                      Row {e.row}: {e.message}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={handleClose} className="btn-outline">
            {result ? "Close" : "Cancel"}
          </button>
          {!result && (
            <button
              onClick={handleUpload}
              disabled={!file || loading}
              className="btn-primary"
            >
              {loading && <LoadingSpinner className="h-4 w-4" />}
              Upload & Import
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
