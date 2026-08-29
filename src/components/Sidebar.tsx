"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  PackageSearch, 
  Database,
  LayoutDashboard,
  Box,
  FileBarChart,
  Users,
  LogOut,
  Activity,
  Key
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function Sidebar({ user }: { user?: { name: string, role: string } | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [changingPwd, setChangingPwd] = useState(false);

  const links = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Inbound", href: "/inbound", icon: ArrowDownToLine },
    { name: "Outbound", href: "/outbound", icon: ArrowUpFromLine },
    { name: "Inventory", href: "/inventory", icon: PackageSearch },
    { name: "Master Data", href: "/master-data", icon: Database },
    { name: "Report", href: "/report", icon: FileBarChart },
  ];

  if (user?.role === "ADMIN") {
    links.push({ name: "User Management", href: "/users", icon: Users });
    links.push({ name: "Activity Log", href: "/activity-log", icon: Activity });
  }

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const handleChangeMyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newPassword) return;
    setChangingPwd(true);
    try {
      // Assuming we have the targetUserId from a me endpoint or we just send an empty targetUserId to update oneself.
      // Wait, user prop doesn't have id right now. Let's fetch the /api/auth/me to get the ID.
      const meRes = await fetch("/api/auth/me");
      const me = await meRes.json();
      
      const res = await fetch("/api/users/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: me.id, newPassword })
      });
      if (res.ok) {
        toast.success("Password changed successfully!");
        setPasswordModalOpen(false);
        setNewPassword("");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to change password");
      }
    } catch (e) {
      toast.error("Error changing password");
    } finally {
      setChangingPwd(false);
    }
  };

  return (
    <>
      <aside className="w-72 glass-dark text-white flex flex-col h-screen shrink-0 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-emerald-500/20 to-transparent pointer-events-none" />
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/30 rounded-full blur-3xl pointer-events-none" />
      
      <div className="p-8 pb-4 relative z-10">
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <Box className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">
            POSM<span className="text-emerald-400">.Pro</span>
          </h1>
        </div>
        <p className="text-xs text-slate-400 font-medium pl-13">Materials Management</p>
      </div>

      <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto relative z-10">
        <div className="px-4 mb-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Main Menu
        </div>
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.name}
              href={link.href}
              className={`flex items-center space-x-3 px-4 py-3.5 rounded-2xl transition-all duration-300 group relative ${
                isActive
                  ? "bg-gradient-to-r from-emerald-600/90 to-green-700/90 text-white shadow-lg shadow-emerald-900/40 border border-emerald-500/30"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-100 border border-transparent"
              }`}
            >
              <div className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${isActive ? "bg-white/20" : "bg-white/5 group-hover:bg-white/10"}`}>
                <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400 group-hover:text-emerald-300"}`} />
              </div>
              <span className="font-semibold text-sm">{link.name}</span>
              
              {isActive && (
                <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
              )}
            </Link>
          );
        })}
      </nav>
      
      <div className="p-6 relative z-10">
        <div className="bg-gradient-to-br from-slate-800 to-slate-800/50 p-4 rounded-2xl border border-white/5">
          {user ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-xs font-bold uppercase">
                  {user.name.substring(0, 2)}
                </div>
                <div>
                  <p className="text-sm font-semibold">{user.name}</p>
                  <p className="text-xs text-slate-400">{user.role === 'ADMIN' ? 'Administrator' : 'User'}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setPasswordModalOpen(true)} className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-white/5 rounded-lg transition-colors" title="Change Password">
                  <Key className="w-4 h-4" />
                </button>
                <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors" title="Log Out">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center text-sm text-slate-400">Not logged in</div>
          )}
        </div>
      </div>
    </aside>
      
      {/* Change Password Modal for Self */}
      {passwordModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative animate-in zoom-in-95 duration-200 text-slate-800">
            <h2 className="text-xl font-bold text-slate-800 mb-2">Change My Password</h2>
            <p className="text-sm text-slate-500 mb-6">Set a new password for your account.</p>
            
            <form onSubmit={handleChangeMyPassword}>
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 mb-2">New Password <span className="text-red-500">*</span></label>
                <input 
                  type="password" 
                  required 
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)} 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all duration-200"
                />
              </div>
              <div className="flex gap-3">
                <button 
                  type="button" 
                  onClick={() => {
                    setPasswordModalOpen(false);
                    setNewPassword("");
                  }}
                  className="flex-1 py-3 px-4 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={changingPwd}
                  className="flex-1 py-3 px-4 bg-emerald-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-emerald-500/30 transition-all active:scale-95 disabled:opacity-70"
                >
                  {changingPwd ? "Saving..." : "Change"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
