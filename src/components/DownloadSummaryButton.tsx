"use client";

import { Download, Loader2, FileSpreadsheet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function DownloadSummaryButton() {
  const [loading, setLoading] = useState(false);
  
  const handleDownload = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/report/inventory-summary");
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      
      let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
      csvContent += "Account,SKU,Description,Total Inbound,Total Outbound,Current Balance\n";
      data.forEach((item: any) => {
        csvContent += `"${item.account}","${item.sku}","${item.descr}",${item.totalInbound},${item.totalOutbound},${item.balance}\n`;
      });
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `nhap_xuat_ton_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Downloaded successfully!");
    } catch (e) {
      toast.error("Failed to download report");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden lg:col-span-2 group flex flex-col justify-between">
      <div className="absolute right-0 bottom-0 w-48 h-48 bg-emerald-50 rounded-full blur-3xl pointer-events-none" />
      <div className="relative z-10 mb-4">
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">Analytics Export</h3>
        </div>
        <p className="text-slate-500 text-sm">Download a full inventory analysis report (Nhập Xuất Tồn) in CSV format.</p>
      </div>
      <button 
        onClick={handleDownload} 
        disabled={loading} 
        className="relative z-10 w-fit flex items-center px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-all shadow-md shadow-emerald-500/20 active:scale-95 disabled:opacity-70"
      >
        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
        Download CSV (Nhập Xuất Tồn)
      </button>
    </div>
  );
}
