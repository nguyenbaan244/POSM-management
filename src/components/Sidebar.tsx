"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  PackageSearch, 
  UploadCloud, 
  Scale,
  FileBarChart, 
  Activity, 
  CheckCircle2 
} from "lucide-react";

export default function Sidebar({ user }: { user?: { name: string, role: string } | null }) {
  const pathname = usePathname();

  const links = [
    { name: "Upload Data", href: "/", icon: UploadCloud, subtitle: "Tải file dữ liệu" },
    { name: "Inbound", href: "/inbound", icon: ArrowDownToLine, subtitle: "Nhập kho" },
    { name: "Outbound", href: "/outbound", icon: ArrowUpFromLine, subtitle: "Xuất kho" },
    { name: "Inventory", href: "/inventory", icon: PackageSearch, subtitle: "Tồn kho" },
    { name: "Report", href: "/report", icon: FileBarChart, subtitle: "Báo cáo NXT" },
    { name: "Check lệch tồn", href: "/check-lech-ton", icon: Scale, subtitle: "Đối soát chênh lệch kho" },
    { name: "Activity Log", href: "/activity-log", icon: Activity, subtitle: "Nhật ký" },
  ];

  return (
    <aside className="w-72 glass-dark text-white flex flex-col h-screen shrink-0 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-emerald-500/20 to-transparent pointer-events-none" />
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/30 rounded-full blur-3xl pointer-events-none" />
      
      <div className="p-8 pb-4 relative z-10">
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <FileBarChart className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight leading-none text-white">
              Danone <span className="text-emerald-400">report</span>
            </h1>
            <span className="text-[10px] font-bold text-emerald-400/80 uppercase tracking-widest">Danone Logistics</span>
          </div>
        </div>
        <p className="text-xs text-slate-400 font-medium pl-13">Materials & Stock Report System</p>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1.5 overflow-y-auto relative z-10">
        <div className="px-4 mb-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          Chức năng chính
        </div>
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.name}
              href={link.href}
              className={`flex items-center justify-between px-4 py-3 rounded-2xl transition-all duration-300 group relative ${
                isActive
                  ? "bg-gradient-to-r from-emerald-600/90 to-green-700/90 text-white shadow-lg shadow-emerald-900/40 border border-emerald-500/30"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-100 border border-transparent"
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${isActive ? "bg-white/20" : "bg-white/5 group-hover:bg-white/10"}`}>
                  <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400 group-hover:text-emerald-300"}`} />
                </div>
                <div>
                  <div className="font-semibold text-sm leading-tight">{link.name}</div>
                  <div className={`text-[10px] ${isActive ? "text-emerald-200" : "text-slate-500"}`}>{link.subtitle}</div>
                </div>
              </div>
              
              {isActive && (
                <div className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
              )}
            </Link>
          );
        })}
      </nav>
      
      <div className="p-4 relative z-10">
        <div className="bg-gradient-to-br from-slate-800 to-slate-800/60 p-4 rounded-2xl border border-white/5">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-xs font-black text-slate-900 shadow-md">
              AD
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-1.5">
                <p className="text-sm font-bold text-white truncate">Administrator</p>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <p className="text-[11px] text-slate-400">Direct Access (No Login)</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

