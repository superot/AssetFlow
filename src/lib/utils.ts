import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind class names safely */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a Date to locale date string */
export function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("tr-TR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Returns true if a date is within the next `days` days */
export function isExpiringSoon(date: Date | string | null, days = 30): boolean {
  if (!date) return false;
  const target = new Date(date);
  const now = new Date();
  const threshold = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return target > now && target <= threshold;
}

/** Format currency */
export function formatCurrency(amount: number | null): string {
  if (amount === null) return "—";
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(amount);
}

/** Returns duration in whole days between two dates (defaults `to` to now) */
export function durationDays(from: Date | string, to?: Date | string | null): number {
  const start = new Date(from);
  const end = to ? new Date(to) : new Date();
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

/** Returns human-readable duration string */
export function formatDuration(from: Date | string, to?: Date | string | null): string {
  const days = durationDays(from, to);
  if (days < 1) return "< 1 day";
  if (days === 1) return "1 day";
  if (days < 30) return `${days} days`;
  const months = Math.floor(days / 30);
  if (months === 1) return "1 month";
  if (months < 12) return `${months} months`;
  const years = Math.floor(months / 12);
  return years === 1 ? "1 year" : `${years} years`;
}
