"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  PackageSearch, 
  Database,
  LayoutDashboard
} from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();

  const links = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Inbound", href: "/inbound", icon: ArrowDownToLine },
    { name: "Outbound", href: "/outbound", icon: ArrowUpFromLine },
    { name: "Inventory", href: "/inventory", icon: PackageSearch },
    { name: "Master Data", href: "/master-data", icon: Database },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col h-screen shrink-0">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
          POSM System
        </h1>
      </div>
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.name}
              href={link.href}
              className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? "text-blue-200" : "text-slate-500"}`} />
              <span className="font-medium">{link.name}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-6 border-t border-slate-800 text-xs text-slate-500">
        &copy; 2026 POSM Management
      </div>
    </aside>
  );
}
