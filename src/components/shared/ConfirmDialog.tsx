"use client";

import { Modal } from "./Modal";
import { LoadingSpinner } from "./LoadingSpinner";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: "danger" | "default";
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  variant = "default",
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="flex justify-end gap-2 mt-6">
        <button
          onClick={onClose}
          disabled={loading}
          className="px-4 py-2 text-sm border rounded-lg hover:bg-accent disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className={`px-4 py-2 text-sm rounded-lg flex items-center gap-2 disabled:opacity-50 ${
            variant === "danger"
              ? "bg-red-600 text-white hover:bg-red-700"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          }`}
        >
          {loading && <LoadingSpinner className="h-4 w-4" />}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
