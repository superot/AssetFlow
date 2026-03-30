"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SlidersHorizontal, Tag, Building2, ScrollText, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

const settingsNav = [
  { href: "/settings/general", label: "General", icon: SlidersHorizontal },
  { href: "/settings/categories", label: "Categories", icon: Tag },
  { href: "/settings/entra-id", label: "Entra ID Sync", icon: Building2 },
  { href: "/settings/notifications", label: "Notifications", icon: Bell },
  { href: "/settings/audit-logs", label: "Audit Logs", icon: ScrollText },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 border-b mb-6 -mx-4 md:-mx-6 px-4 md:px-6 overflow-x-auto">
      {settingsNav.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex items-center gap-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
            pathname === href
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
