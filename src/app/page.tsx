import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine, PackageSearch, Database, TrendingUp, Activity } from "lucide-react";
import { prisma } from "@/lib/prisma";
import DashboardCharts from "@/components/DashboardCharts";
import DownloadSummaryButton from "@/components/DownloadSummaryButton";
import { cookies } from "next/headers";

export default async function Home() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("sessionId")?.value;
  let userName = "Guest";
  
  if (sessionId) {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true }
    });
    if (session && session.expiresAt > new Date()) {
      userName = session.user.name;
    }
  }

  const inventoryCount = await prisma.inventory.count();
  const masterDataCount = await prisma.masterData.count();

  // Prepare Pie Chart Data (Inventory Distribution)
  const allInventory = await prisma.inventory.findMany({
    orderBy: { quantity: 'desc' }
  });
  let pieData = [];
  if (allInventory.length <= 5) {
    pieData = allInventory.map(item => ({ name: item.sku, value: item.quantity }));
  } else {
    pieData = allInventory.slice(0, 5).map(item => ({ name: item.sku, value: item.quantity }));
    const othersQty = allInventory.slice(5).reduce((sum, item) => sum + item.quantity, 0);
    if (othersQty > 0) pieData.push({ name: 'Others', value: othersQty });
  }

  // Prepare Bar Chart Data (Inbound vs Outbound Top 5 Active SKUs)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const inbounds = await prisma.inbound.findMany({
    where: { reversed: false, date: { gte: thirtyDaysAgo } }
  });
  const outbounds = await prisma.outbound.findMany({
    where: { reversed: false, date: { gte: thirtyDaysAgo } }
  });

  const activityMap: Record<string, { Inbound: number, Outbound: number, Total: number }> = {};
  inbounds.forEach(ib => {
    if (!activityMap[ib.sku]) activityMap[ib.sku] = { Inbound: 0, Outbound: 0, Total: 0 };
    activityMap[ib.sku].Inbound += ib.quantity;
    activityMap[ib.sku].Total += ib.quantity;
  });
  outbounds.forEach(ob => {
    if (!activityMap[ob.sku]) activityMap[ob.sku] = { Inbound: 0, Outbound: 0, Total: 0 };
    activityMap[ob.sku].Outbound += ob.quantity;
    activityMap[ob.sku].Total += ob.quantity;
  });

  const sortedActiveSkus = Object.entries(activityMap)
    .sort((a, b) => b[1].Total - a[1].Total)
    .slice(0, 5)
    .map(([sku, data]) => ({
      name: sku,
      Inbound: data.Inbound,
      Outbound: data.Outbound
    }));

  return (
    <div className="p-8 max-w-7xl mx-auto animate-in">
      <div className="flex justify-between items-end mb-12">
        <div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight mb-3">
            Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">{userName}!</span>
          </h1>
          <p className="text-slate-500 text-lg font-medium">Here's what's happening in your warehouse today.</p>
        </div>
        <div className="hidden md:flex space-x-2">
          <div className="px-4 py-2 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-semibold text-slate-600">System Online</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {/* Quick Stats */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group hover:shadow-lg transition-all duration-300">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-50 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out" />
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center mb-4 text-blue-600">
              <PackageSearch className="w-6 h-6" />
            </div>
            <div>
              <p className="text-slate-500 font-medium mb-1">Total SKUs in Stock</p>
              <h3 className="text-3xl font-bold text-slate-800">{inventoryCount}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group hover:shadow-lg transition-all duration-300">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-50 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out" />
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center mb-4 text-purple-600">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <p className="text-slate-500 font-medium mb-1">Master Data Items</p>
              <h3 className="text-3xl font-bold text-slate-800">{masterDataCount}</h3>
            </div>
          </div>
        </div>

        <DownloadSummaryButton />
      </div>

      <DashboardCharts inventoryData={pieData} activityData={sortedActiveSkus} />

      <h2 className="text-2xl font-bold text-slate-800 mb-6">Modules</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/inbound" className="group relative overflow-hidden bg-white p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 hover:shadow-xl transition-all duration-300">
          <div className="absolute right-0 top-0 w-32 h-32 bg-blue-50 rounded-bl-full transition-transform duration-500 group-hover:scale-110 -z-10" />
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center mb-6 shadow-lg shadow-blue-500/30 group-hover:-translate-y-1 transition-transform">
            <ArrowDownToLine className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-3">Inbound</h2>
          <p className="text-slate-500 leading-relaxed">Record new stock arriving at the warehouse. Create batch entries and update inventory levels securely.</p>
        </Link>
        
        <Link href="/outbound" className="group relative overflow-hidden bg-white p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 hover:shadow-xl transition-all duration-300">
          <div className="absolute right-0 top-0 w-32 h-32 bg-orange-50 rounded-bl-full transition-transform duration-500 group-hover:scale-110 -z-10" />
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-rose-500 text-white flex items-center justify-center mb-6 shadow-lg shadow-orange-500/30 group-hover:-translate-y-1 transition-transform">
            <ArrowUpFromLine className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-3">Outbound</h2>
          <p className="text-slate-500 leading-relaxed">Record stock leaving the warehouse. Automatically deduct quantities from your inventory balance.</p>
        </Link>

        <Link href="/inventory" className="group relative overflow-hidden bg-white p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 hover:shadow-xl transition-all duration-300">
          <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-50 rounded-bl-full transition-transform duration-500 group-hover:scale-110 -z-10" />
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/30 group-hover:-translate-y-1 transition-transform">
            <PackageSearch className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-3">Inventory</h2>
          <p className="text-slate-500 leading-relaxed">Check current stock balance of all materials in real-time. Identify low-stock items quickly.</p>
        </Link>

        <Link href="/master-data" className="group relative overflow-hidden bg-white p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 hover:shadow-xl transition-all duration-300">
          <div className="absolute right-0 top-0 w-32 h-32 bg-purple-50 rounded-bl-full transition-transform duration-500 group-hover:scale-110 -z-10" />
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center mb-6 shadow-lg shadow-purple-500/30 group-hover:-translate-y-1 transition-transform">
            <Database className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-3">Master Data</h2>
          <p className="text-slate-500 leading-relaxed">Manage SKU definitions and descriptions. Keep your product catalog organized and up to date.</p>
        </Link>
      </div>
    </div>
  );
}
