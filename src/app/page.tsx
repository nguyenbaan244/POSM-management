import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine, PackageSearch, Database } from "lucide-react";

export default function Home() {
  return (
    <div className="p-8">
      <h1 className="text-4xl font-extrabold text-slate-800 mb-2">POSM Management Dashboard</h1>
      <p className="text-slate-500 mb-10 text-lg">Manage your point of sale materials efficiently.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/inbound" className="bg-gradient-to-br from-blue-500 to-blue-600 p-8 rounded-3xl text-white shadow-xl shadow-blue-900/20 hover:scale-[1.02] transition-transform">
          <ArrowDownToLine className="w-12 h-12 mb-4 opacity-80" />
          <h2 className="text-2xl font-bold mb-2">Inbound</h2>
          <p className="text-blue-100">Record new stock arriving at the warehouse.</p>
        </Link>
        
        <Link href="/outbound" className="bg-gradient-to-br from-orange-500 to-orange-600 p-8 rounded-3xl text-white shadow-xl shadow-orange-900/20 hover:scale-[1.02] transition-transform">
          <ArrowUpFromLine className="w-12 h-12 mb-4 opacity-80" />
          <h2 className="text-2xl font-bold mb-2">Outbound</h2>
          <p className="text-orange-100">Record stock leaving the warehouse.</p>
        </Link>

        <Link href="/inventory" className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-8 rounded-3xl text-white shadow-xl shadow-emerald-900/20 hover:scale-[1.02] transition-transform">
          <PackageSearch className="w-12 h-12 mb-4 opacity-80" />
          <h2 className="text-2xl font-bold mb-2">Inventory</h2>
          <p className="text-emerald-100">Check current stock balance of all materials.</p>
        </Link>

        <Link href="/master-data" className="bg-gradient-to-br from-purple-500 to-purple-600 p-8 rounded-3xl text-white shadow-xl shadow-purple-900/20 hover:scale-[1.02] transition-transform">
          <Database className="w-12 h-12 mb-4 opacity-80" />
          <h2 className="text-2xl font-bold mb-2">Master Data</h2>
          <p className="text-purple-100">Manage SKU definitions and descriptions.</p>
        </Link>
      </div>
    </div>
  );
}
