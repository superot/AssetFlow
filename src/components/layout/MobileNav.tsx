"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, LayoutDashboard, Monitor, Key, ClipboardList, Users, BarChart3, Settings } from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/assets", label: "Assets", icon: Monitor },
  { href: "/licenses", label: "Licenses", icon: Key },
  { href: "/assignments", label: "Assignments", icon: ClipboardList },
  { href: "/users", label: "Users", icon: Users },
  { href: "/reports", label: "Reports", icon: BarChart3 },
];

interface MobileNavProps {
  role?: string;
}

export function MobileNav({ role }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  const items = role === "ADMIN"
    ? [...navItems, { href: "/settings", label: "Settings", icon: Settings }]
    : navItems;

  return (
    <div className="md:hidden">
      <button onClick={() => setOpen(!open)} className="p-2">
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
      {open && (
        <div className="absolute top-16 left-0 right-0 bg-background border-b z-50 px-4 py-3 space-y-1">
          {items.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium hover:bg-accent"
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
