"use client";

import { useState, useEffect } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { 
  FileBarChart, 
  Filter, 
  FileDown, 
  Search, 
  Calendar, 
  Layers, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  TrendingUp, 
  Package, 
  Printer,
  ChevronRight,
  Boxes
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  Line, 
  ComposedChart 
} from "recharts";

export default function ReportPage() {
  const [activeView, setActiveView] = useState<"daily-overall" | "daily-sku" | "sku-summary">("daily-overall");
  const [selectedMonth, setSelectedMonth] = useState<string>("2026-10");
  const [selectedDate, setSelectedDate] = useState<string>("all");
  const [selectedSku, setSelectedSku] = useState<string>("all");
  const [search, setSearch] = useState("");
  
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchDailyReport = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedMonth && selectedMonth !== "all") params.append("month", selectedMonth);
    if (selectedDate && selectedDate !== "all") params.append("date", selectedDate);
    if (selectedSku && selectedSku !== "all") params.append("sku", selectedSku);

    fetch(`/api/report/daily-nxt?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        setReportData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load report", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchDailyReport();
  }, [selectedMonth, selectedDate, selectedSku]);

  const dailySummary = reportData?.dailySummary || [];
  const skuDailySummary = reportData?.skuDailySummary || [];
  const skuTotals = reportData?.skuTotals || [];
  const period = reportData?.period || { opening: 0, inbound: 0, outbound: 0, netChange: 0, closing: 0 };
  const availableMonths = reportData?.availableMonths || [];
  const availableDates = reportData?.availableDates || [];
  const allSkus = reportData?.allSkus || [];

  // Filter SKU daily items by search
  const filteredSkuDaily = skuDailySummary.filter((item: any) => 
    item.sku.toLowerCase().includes(search.toLowerCase()) ||
    item.descr.toLowerCase().includes(search.toLowerCase()) ||
    item.date.includes(search)
  );

  const exportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // UTF-8 BOM

    if (activeView === "daily-overall") {
      csvContent += "Ngay,Ton Dau,Tong Nhap,Tong Xuat,Bien Dong Rong,Ton Cuoi\n";
      dailySummary.forEach((row: any) => {
        csvContent += `"${row.date}",${row.opening},${row.inbound},${row.outbound},${row.netChange},${row.closing}\n`;
      });
      csvContent += `"TONG CONG",${period.opening},${period.inbound},${period.outbound},${period.netChange},${period.closing}\n`;
    } else if (activeView === "daily-sku") {
      csvContent += "Ngay,Ma SKU,Ten San Pham,Ton Dau,Nhap,Xuat,Bien Dong,Ton Cuoi\n";
      filteredSkuDaily.forEach((row: any) => {
        csvContent += `"${row.date}","${row.sku}","${row.descr.replace(/"/g, '""')}",${row.opening},${row.inbound},${row.outbound},${row.netChange},${row.closing}\n`;
      });
    } else {
      csvContent += "Ma SKU,Ten San Pham,Ton Dau Ky,Tong Nhap,Tong Xuat,Bien Dong,Ton Cuoi Ky\n";
      skuTotals.forEach((row: any) => {
        csvContent += `"${row.sku}","${row.descr.replace(/"/g, '""')}",${row.opening},${row.inbound},${row.outbound},${row.netChange},${row.closing}\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Bao_Cao_NXT_${selectedMonth || "All"}_${activeView}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.text("BAO CAO NHAP XUAT TON HANG NGAY (DANONE POSM)", 14, 15);
    doc.setFontSize(10);
    doc.text(`Ky bao cao: Thang ${selectedMonth} | Ngay: ${selectedDate === 'all' ? 'Tat ca' : selectedDate} | SKU: ${selectedSku === 'all' ? 'Tat ca SKU' : selectedSku}`, 14, 22);

    let head: string[][] = [];
    let body: any[][] = [];

    if (activeView === "daily-overall") {
      head = [["Ngay", "Ton Dau", "Tong Nhap", "Tong Xuat", "Bien Dong (+/-)", "Ton Cuoi"]];
      body = dailySummary.map((r: any) => [
        r.date,
        r.opening.toLocaleString(),
        `+${r.inbound.toLocaleString()}`,
        `-${r.outbound.toLocaleString()}`,
        (r.netChange >= 0 ? `+${r.netChange.toLocaleString()}` : r.netChange.toLocaleString()),
        r.closing.toLocaleString()
      ]);
      body.push([
        "TONG KET",
        period.opening.toLocaleString(),
        `+${period.inbound.toLocaleString()}`,
        `-${period.outbound.toLocaleString()}`,
        (period.netChange >= 0 ? `+${period.netChange.toLocaleString()}` : period.netChange.toLocaleString()),
        period.closing.toLocaleString()
      ]);
    } else if (activeView === "daily-sku") {
      head = [["Ngay", "Ma SKU", "Ten San Pham", "Ton Dau", "Nhap (+)", "Xuat (-)", "Ton Cuoi"]];
      body = filteredSkuDaily.map((r: any) => [
        r.date,
        r.sku,
        r.descr,
        r.opening.toLocaleString(),
        `+${r.inbound.toLocaleString()}`,
        `-${r.outbound.toLocaleString()}`,
        r.closing.toLocaleString()
      ]);
    } else {
      head = [["Ma SKU", "Ten San Pham", "Ton Dau Ky", "Tong Nhap", "Tong Xuat", "Bien Dong", "Ton Cuoi Ky"]];
      body = skuTotals.map((r: any) => [
        r.sku,
        r.descr,
        r.opening.toLocaleString(),
        `+${r.inbound.toLocaleString()}`,
        `-${r.outbound.toLocaleString()}`,
        (r.netChange >= 0 ? `+${r.netChange.toLocaleString()}` : r.netChange.toLocaleString()),
        r.closing.toLocaleString()
      ]);
    }

    autoTable(doc, {
      head,
      body,
      startY: 28,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [16, 185, 129] }
    });

    doc.save(`Bao_Cao_NXT_${selectedMonth}_${activeView}.pdf`);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto animate-in">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
            <FileBarChart className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">
              Báo Cáo Nhập - Xuất - Tồn Hàng Ngày
            </h1>
            <p className="text-slate-500 font-medium">
              Theo dõi biến động xuất nhập tồn tổng thể và chi tiết từng mã SKU theo từng ngày
            </p>
          </div>
        </div>

        {/* Action Export Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={exportCSV}
            className="flex items-center px-4 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-2xl hover:bg-slate-50 transition-all shadow-sm active:scale-95 text-sm"
          >
            <FileDown className="w-4 h-4 mr-2 text-emerald-600" /> Xuất Excel/CSV
          </button>
          <button
            onClick={exportPDF}
            className="flex items-center px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold rounded-2xl hover:shadow-lg hover:shadow-emerald-500/20 transition-all active:scale-95 text-sm"
          >
            <Printer className="w-4 h-4 mr-2" /> In / Xuất PDF
          </button>
        </div>
      </div>

      {/* Filter Section */}
      <div className="bg-white p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 mb-8">
        <div className="flex flex-wrap items-center gap-4">
          {/* Select Month */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Chọn Tháng
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setSelectedDate("all");
              }}
              className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="all">Tất cả các tháng</option>
              {availableMonths.map((m: string) => (
                <option key={m} value={m}>Tháng {m}</option>
              ))}
            </select>
          </div>

          {/* Select Specific Day */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Chọn Ngày Cụ Thể
            </label>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="all">Tất cả các ngày trong kỳ</option>
              {availableDates
                .filter((d: string) => selectedMonth === "all" || d.startsWith(selectedMonth))
                .map((d: string) => (
                  <option key={d} value={d}>{d}</option>
                ))}
            </select>
          </div>

          {/* Select SKU */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Mã SKU
            </label>
            <select
              value={selectedSku}
              onChange={(e) => setSelectedSku(e.target.value)}
              className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="all">Tất cả SKU ({allSkus.length})</option>
              {allSkus.map((item: any) => (
                <option key={item.sku} value={item.sku}>
                  {item.sku} - {item.descr}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Search */}
          {activeView === "daily-sku" && (
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Tìm kiếm SKU / Tên SP
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nhập mã SKU hoặc từ khóa..."
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards for the Period */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Tồn Đầu Kỳ</p>
          <h3 className="text-2xl font-black text-slate-800">
            {period.opening.toLocaleString()}
          </h3>
          <span className="text-[11px] text-slate-400 font-medium">Đơn vị: chiếc (EA)</span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-blue-100 shadow-[0_8px_30px_rgb(59,130,246,0.06)] relative overflow-hidden">
          <div className="absolute -right-2 -bottom-2 w-16 h-16 bg-blue-50 rounded-full pointer-events-none" />
          <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1 flex items-center">
            <ArrowDownToLine className="w-3.5 h-3.5 mr-1" /> Tổng Nhập
          </p>
          <h3 className="text-2xl font-black text-blue-700">
            +{period.inbound.toLocaleString()}
          </h3>
          <span className="text-[11px] text-blue-500 font-medium">Trong kỳ báo cáo</span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-orange-100 shadow-[0_8px_30px_rgb(249,115,22,0.06)] relative overflow-hidden">
          <div className="absolute -right-2 -bottom-2 w-16 h-16 bg-orange-50 rounded-full pointer-events-none" />
          <p className="text-xs font-bold text-orange-600 uppercase tracking-wider mb-1 flex items-center">
            <ArrowUpFromLine className="w-3.5 h-3.5 mr-1" /> Tổng Xuất
          </p>
          <h3 className="text-2xl font-black text-orange-700">
            -{period.outbound.toLocaleString()}
          </h3>
          <span className="text-[11px] text-orange-500 font-medium">Trong kỳ báo cáo</span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center">
            <TrendingUp className="w-3.5 h-3.5 mr-1" /> Biến Động Ròng
          </p>
          <h3 className={`text-2xl font-black ${period.netChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {period.netChange >= 0 ? `+${period.netChange.toLocaleString()}` : period.netChange.toLocaleString()}
          </h3>
          <span className="text-[11px] text-slate-400 font-medium">Nhập trừ Xuất</span>
        </div>

        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-5 rounded-3xl shadow-lg shadow-emerald-900/10 col-span-2 md:col-span-1">
          <p className="text-xs font-bold text-emerald-100 uppercase tracking-wider mb-1">Tồn Cuối Kỳ</p>
          <h3 className="text-2xl font-black">
            {period.closing.toLocaleString()}
          </h3>
          <span className="text-[11px] text-emerald-200 font-medium">Hiện có trong kho</span>
        </div>
      </div>

      {/* Movement Trend Chart */}
      {dailySummary.length > 0 && (
        <div className="bg-white p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Biểu Đồ Xu Hướng Nhập - Xuất - Tồn Kho Theo Ngày</h3>
              <p className="text-xs text-slate-500">So sánh số lượng nhập (xanh), xuất (cam) và số dư tồn kho (đường xanh lá)</p>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dailySummary} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis yAxisId="left" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={11} tickLine={false} />
                <Tooltip
                  formatter={(value: any, name: any) => [Number(value).toLocaleString(), name]}
                  contentStyle={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1px solid #e2e8f0", boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)" }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="inbound" name="Nhập Kho" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={36} />
                <Bar yAxisId="left" dataKey="outbound" name="Xuất Kho" fill="#f97316" radius={[6, 6, 0, 0]} maxBarSize={36} />
                <Line yAxisId="right" type="monotone" dataKey="closing" name="Tồn Cuối Ngày" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Navigation View Tabs */}
      <div className="flex items-center space-x-2 mb-6 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveView("daily-overall")}
          className={`px-5 py-2.5 rounded-2xl font-bold text-sm transition-all flex items-center ${
            activeView === "daily-overall"
              ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Calendar className="w-4 h-4 mr-2" />
          Báo Cáo Tổng Thể Theo Ngày
        </button>

        <button
          onClick={() => setActiveView("daily-sku")}
          className={`px-5 py-2.5 rounded-2xl font-bold text-sm transition-all flex items-center ${
            activeView === "daily-sku"
              ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Boxes className="w-4 h-4 mr-2" />
          Chi Tiết Từng SKU Theo Ngày
        </button>

        <button
          onClick={() => setActiveView("sku-summary")}
          className={`px-5 py-2.5 rounded-2xl font-bold text-sm transition-all flex items-center ${
            activeView === "sku-summary"
              ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Layers className="w-4 h-4 mr-2" />
          Tổng Hợp SKU Trong Kỳ
        </button>
      </div>

      {/* VIEW 1: BÁO CÁO TỔNG THỂ THEO TỪNG NGÀY */}
      {activeView === "daily-overall" && (
        <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Bảng Tổng Hợp Nhập Xuất Tồn Theo Ngày</h3>
              <p className="text-xs text-slate-500">Số liệu hàng ngày của toàn bộ kho</p>
            </div>
            <span className="text-xs font-bold text-slate-500 bg-slate-200/60 px-3 py-1 rounded-full">
              {dailySummary.length} ngày phát sinh giao dịch
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                  <th className="py-4 px-6">Ngày</th>
                  <th className="py-4 px-6 text-right">Tồn Đầu Ngày</th>
                  <th className="py-4 px-6 text-right text-blue-600">Tổng Nhập (+)</th>
                  <th className="py-4 px-6 text-right text-orange-600">Tổng Xuất (-)</th>
                  <th className="py-4 px-6 text-right">Biến Động Ròng</th>
                  <th className="py-4 px-6 text-right font-bold text-slate-800">Tồn Cuối Ngày</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {dailySummary.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      Không có phát sinh nhập xuất trong khoảng thời gian đã chọn.
                    </td>
                  </tr>
                ) : (
                  dailySummary.map((row: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-4 px-6 font-bold text-slate-800 flex items-center">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-3" />
                        {row.date}
                      </td>
                      <td className="py-4 px-6 text-right text-slate-600 font-semibold">
                        {row.opening.toLocaleString()}
                      </td>
                      <td className="py-4 px-6 text-right text-blue-600 font-bold">
                        {row.inbound > 0 ? `+${row.inbound.toLocaleString()}` : "-"}
                      </td>
                      <td className="py-4 px-6 text-right text-orange-600 font-bold">
                        {row.outbound > 0 ? `-${row.outbound.toLocaleString()}` : "-"}
                      </td>
                      <td className="py-4 px-6 text-right font-bold">
                        <span className={`inline-block px-2.5 py-1 rounded-lg text-xs ${
                          row.netChange > 0 
                            ? "bg-emerald-50 text-emerald-700" 
                            : row.netChange < 0 
                            ? "bg-rose-50 text-rose-700" 
                            : "bg-slate-50 text-slate-600"
                        }`}>
                          {row.netChange > 0 ? `+${row.netChange.toLocaleString()}` : row.netChange.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right font-black text-slate-900 text-base">
                        {row.closing.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {dailySummary.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-900 text-white font-bold text-sm">
                    <td className="py-4 px-6">TỔNG CỘNG TRONG KỲ</td>
                    <td className="py-4 px-6 text-right text-slate-300">{period.opening.toLocaleString()}</td>
                    <td className="py-4 px-6 text-right text-blue-300">+{period.inbound.toLocaleString()}</td>
                    <td className="py-4 px-6 text-right text-orange-300">-{period.outbound.toLocaleString()}</td>
                    <td className="py-4 px-6 text-right text-emerald-300">
                      {period.netChange >= 0 ? `+${period.netChange.toLocaleString()}` : period.netChange.toLocaleString()}
                    </td>
                    <td className="py-4 px-6 text-right font-black text-base text-emerald-400">
                      {period.closing.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: BÁO CÁO CHI TIẾT TỪNG SKU THEO TỪNG NGÀY */}
      {activeView === "daily-sku" && (
        <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Chi Tiết Nhập - Xuất - Tồn Từng SKU Theo Từng Ngày</h3>
              <p className="text-xs text-slate-500">Phát sinh giao dịch chi tiết theo mã sản phẩm</p>
            </div>
            <span className="text-xs font-bold text-slate-500 bg-slate-200/60 px-3 py-1 rounded-full">
              {filteredSkuDaily.length} dòng dữ liệu
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                  <th className="py-4 px-6">Ngày</th>
                  <th className="py-4 px-6">Mã SKU</th>
                  <th className="py-4 px-6">Tên Sản Phẩm</th>
                  <th className="py-4 px-6 text-right">Tồn Đầu</th>
                  <th className="py-4 px-6 text-right text-blue-600">Nhập (+)</th>
                  <th className="py-4 px-6 text-right text-orange-600">Xuất (-)</th>
                  <th className="py-4 px-6 text-right">Biến Động</th>
                  <th className="py-4 px-6 text-right font-bold text-slate-800">Tồn Cuối</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredSkuDaily.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      Không tìm thấy dữ liệu phù hợp với bộ lọc.
                    </td>
                  </tr>
                ) : (
                  filteredSkuDaily.map((row: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-6 font-semibold text-slate-700 whitespace-nowrap">
                        {row.date}
                      </td>
                      <td className="py-3.5 px-6 font-bold text-slate-900 whitespace-nowrap">
                        {row.sku}
                      </td>
                      <td className="py-3.5 px-6 text-slate-600 max-w-xs truncate" title={row.descr}>
                        {row.descr}
                      </td>
                      <td className="py-3.5 px-6 text-right text-slate-600">
                        {row.opening.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-6 text-right font-bold text-blue-600">
                        {row.inbound > 0 ? `+${row.inbound.toLocaleString()}` : "-"}
                      </td>
                      <td className="py-3.5 px-6 text-right font-bold text-orange-600">
                        {row.outbound > 0 ? `-${row.outbound.toLocaleString()}` : "-"}
                      </td>
                      <td className="py-3.5 px-6 text-right font-semibold">
                        <span className={`text-xs ${row.netChange > 0 ? 'text-emerald-600' : row.netChange < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                          {row.netChange > 0 ? `+${row.netChange.toLocaleString()}` : row.netChange.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-right font-black text-slate-900">
                        {row.closing.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: TỔNG HỢP THEO TỪNG SKU TRONG KỲ */}
      {activeView === "sku-summary" && (
        <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Bảng Tổng Kết Theo Từng Mã SKU Trong Toàn Kỳ</h3>
              <p className="text-xs text-slate-500">Đối soát lượng nhập, xuất và tồn của từng sản phẩm</p>
            </div>
            <span className="text-xs font-bold text-slate-500 bg-slate-200/60 px-3 py-1 rounded-full">
              {skuTotals.length} mã sản phẩm
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                  <th className="py-4 px-6">Mã SKU</th>
                  <th className="py-4 px-6">Tên Sản Phẩm</th>
                  <th className="py-4 px-6 text-right">Tồn Đầu Kỳ</th>
                  <th className="py-4 px-6 text-right text-blue-600">Tổng Nhập (+)</th>
                  <th className="py-4 px-6 text-right text-orange-600">Tổng Xuất (-)</th>
                  <th className="py-4 px-6 text-right">Biến Động</th>
                  <th className="py-4 px-6 text-right font-bold text-slate-900">Tồn Cuối Kỳ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {skuTotals.map((row: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-4 px-6 font-bold text-slate-900">{row.sku}</td>
                    <td className="py-4 px-6 text-slate-600 font-medium">{row.descr}</td>
                    <td className="py-4 px-6 text-right text-slate-600 font-semibold">{row.opening.toLocaleString()}</td>
                    <td className="py-4 px-6 text-right text-blue-600 font-bold">+{row.inbound.toLocaleString()}</td>
                    <td className="py-4 px-6 text-right text-orange-600 font-bold">-{row.outbound.toLocaleString()}</td>
                    <td className="py-4 px-6 text-right font-bold">
                      <span className={`inline-block px-2.5 py-1 rounded-lg text-xs ${
                        row.netChange > 0 
                          ? "bg-emerald-50 text-emerald-700" 
                          : row.netChange < 0 
                          ? "bg-rose-50 text-rose-700" 
                          : "bg-slate-50 text-slate-600"
                      }`}>
                        {row.netChange > 0 ? `+${row.netChange.toLocaleString()}` : row.netChange.toLocaleString()}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right font-black text-slate-900 text-base">{row.closing.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
