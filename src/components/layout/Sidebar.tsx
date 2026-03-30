"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Monitor,
  Key,
  ClipboardList,
  Users,
  BarChart3,
  Settings,
  Boxes,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/assets", label: "Assets", icon: Monitor },
  { href: "/licenses", label: "Licenses", icon: Key },
  { href: "/assignments", label: "Assignments", icon: ClipboardList },
  { href: "/users", label: "Users", icon: Users },
  { href: "/reports", label: "Reports", icon: BarChart3 },
];

interface SidebarProps {
  role?: string;
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <aside className="hidden md:flex w-64 flex-col bg-sidebar border-r border-sidebar-border">
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <Boxes className="h-6 w-6 text-primary" />
          <span className="text-sidebar-foreground font-bold text-lg tracking-tight">
            AssetFlow
          </span>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4">
        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
          Navigation
        </p>
        <div className="space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                pathname.startsWith(href)
                  ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-primary pl-[10px]"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
        </div>
        {role === "ADMIN" && (
          <>
            <hr className="my-3 border-sidebar-border" />
            <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
              Admin
            </p>
            <Link
              href="/settings"
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                pathname.startsWith("/settings")
                  ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-primary pl-[10px]"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Settings className="h-5 w-5" />
              Settings
            </Link>
          </>
        )}
      </nav>
      <div className="px-4 py-3 border-t border-sidebar-border">
        <p className="text-xs font-mono text-sidebar-foreground/60 tabular-nums">
          {now
            ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
            : "--:--:--"}
        </p>
        <p className="text-xs text-sidebar-foreground/40 mt-0.5">
          {now
            ? now.toLocaleDateString([], { weekday: "short", day: "2-digit", month: "short", year: "numeric" })
            : "---"}
        </p>
      </div>
    </aside>
  );
}
