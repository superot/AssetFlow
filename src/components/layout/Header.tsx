"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { MobileNav } from "./MobileNav";

interface HeaderProps {
  user?: { name?: string | null; email?: string | null };
  role?: string;
}

export function Header({ user, role }: HeaderProps) {
  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "U";

  return (
    <header className="h-16 border-b flex items-center justify-between px-4 md:px-6 shrink-0">
      <MobileNav role={role} />
      <div className="flex items-center gap-3 ml-auto">
        <div className="hidden sm:flex flex-col items-end">
          <span className="text-sm font-medium leading-none">{user?.name ?? user?.email}</span>
          {user?.name && (
            <span className="text-xs text-muted-foreground mt-0.5">{user.email}</span>
          )}
        </div>
        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold select-none">
          {initials}
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
