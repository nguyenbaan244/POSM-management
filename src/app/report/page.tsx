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
  Boxes,
  CalendarRange,
  RefreshCw
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
  ComposedChart,
  LabelList
} from "recharts";
import { toast } from "sonner";
import { exportToExcel } from "@/lib/excelExport";

export default function ReportPage() {
  const [activeView, setActiveView] = useState<"daily-overall" | "daily-sku" | "sku-summary">("daily-overall");
  const [overallMode, setOverallMode] = useState<"daily" | "weekly">("daily");
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
  const weeklySummary = reportData?.weeklySummary || [];
  const skuDailySummary = reportData?.skuDailySummary || [];
  const skuTotals = reportData?.skuTotals || [];
  const period = reportData?.period || { opening: 0, inbound: 0, outbound: 0, netChange: 0, closing: 0 };
  const availableMonths = reportData?.availableMonths || [];
  const availableDates = reportData?.availableDates || [];
  const allSkus = reportData?.allSkus || [];
  const totalDays = reportData?.totalDaysInMonth || dailySummary.length;
  const activeDays = reportData?.activeTransactionDaysCount || 0;

  // Filter SKU daily items by search
  const filteredSkuDaily = skuDailySummary.filter((item: any) => 
    item.sku.toLowerCase().includes(search.toLowerCase()) ||
    item.descr.toLowerCase().includes(search.toLowerCase()) ||
    item.date.includes(search)
  );

  // EXPORT EXCEL HANDLERS FOR EACH TABLE
  const exportDailyExcel = () => {
    if (dailySummary.length === 0) return toast.error("Không có dữ liệu để xuất");
    exportToExcel({
      filename: `Bao_Cao_NXT_Theo_Ngay_${selectedMonth}.xlsx`,
      sheetName: "NXT_Theo_Ngay",
      title: `BẢNG TỔNG HỢP NHẬP XUẤT TỒN THEO NGÀY (THÁNG ${selectedMonth})`,
      subtitles: [
        `Kỳ báo cáo: Từ ngày 01 đến ngày cuối tháng (${totalDays} ngày)`,
        `Tổng tồn đầu kỳ: ${period.opening.toLocaleString()} | Tổng nhập: +${period.inbound.toLocaleString()} | Tổng xuất: -${period.outbound.toLocaleString()} | Tồn cuối lý thuyết: ${period.closing.toLocaleString()} | Tồn cuối thực tế: ${period.actualClosing !== null ? period.actualClosing.toLocaleString() : "Chưa kiểm kê"}`
      ],
      data: dailySummary,
      columns: [
        { header: "Ngày", key: "date", width: 14 },
        { header: "Tồn Đầu Ngày", key: "opening", width: 16, format: v => Number(v).toLocaleString() },
        { header: "Tổng Nhập (+)", key: "inbound", width: 16, format: v => (Number(v) > 0 ? `+${Number(v).toLocaleString()}` : "-") },
        { header: "Tổng Xuất (-)", key: "outbound", width: 16, format: v => (Number(v) > 0 ? `-${Number(v).toLocaleString()}` : "-") },
        { header: "Biến Động Ròng", key: "netChange", width: 16, format: v => (Number(v) > 0 ? `+${Number(v).toLocaleString()}` : Number(v) < 0 ? Number(v).toLocaleString() : "-") },
        { header: "Tồn Cuối Ngày Lý Thuyết", key: "theoreticalClosing", width: 24, format: v => Number(v).toLocaleString() },
        { header: "Tồn Cuối Ngày Thực Tế", key: "actualClosing", width: 24, format: v => (v !== null && v !== undefined ? Number(v).toLocaleString() : "Chưa kiểm kê") },
        { header: "Chênh Lệch (+/-)", key: "variance", width: 18, format: v => (v === null || v === undefined ? "-" : Number(v) > 0 ? `+${Number(v).toLocaleString()}` : Number(v).toLocaleString()) }
      ]
    });
    toast.success("Đã xuất file Excel bảng tổng hợp theo ngày!");
  };

  const exportWeeklyExcel = () => {
    if (weeklySummary.length === 0) return toast.error("Không có dữ liệu để xuất");
    exportToExcel({
      filename: `Bao_Cao_NXT_Theo_Tuan_${selectedMonth}.xlsx`,
      sheetName: "NXT_Theo_Tuan",
      title: `BẢNG TỔNG HỢP NHẬP XUẤT TỒN THEO TUẦN (THÁNG ${selectedMonth})`,
      subtitles: [
        `Tổng hợp theo tuần trong tháng ${selectedMonth}`,
        `Tổng tồn đầu kỳ: ${period.opening.toLocaleString()} | Tổng nhập: +${period.inbound.toLocaleString()} | Tổng xuất: -${period.outbound.toLocaleString()} | Tồn cuối lý thuyết: ${period.closing.toLocaleString()}`
      ],
      data: weeklySummary,
      columns: [
        { header: "Tuần", key: "week", width: 12 },
        { header: "Khoảng Thời Gian", key: "dateRange", width: 22 },
        { header: "Số Ngày Có Giao Dịch", key: "activeDaysCount", width: 18, format: (v, r: any) => `${v}/${r.daysCount || 7} ngày` },
        { header: "Tồn Đầu Tuần", key: "opening", width: 16, format: v => Number(v).toLocaleString() },
        { header: "Tổng Nhập (+)", key: "inbound", width: 16, format: v => (Number(v) > 0 ? `+${Number(v).toLocaleString()}` : "-") },
        { header: "Tổng Xuất (-)", key: "outbound", width: 16, format: v => (Number(v) > 0 ? `-${Number(v).toLocaleString()}` : "-") },
        { header: "Biến Động Ròng", key: "netChange", width: 16, format: v => (Number(v) > 0 ? `+${Number(v).toLocaleString()}` : Number(v) < 0 ? Number(v).toLocaleString() : "-") },
        { header: "Tồn Cuối Tuần Lý Thuyết", key: "theoreticalClosing", width: 24, format: v => Number(v).toLocaleString() },
        { header: "Tồn Cuối Tuần Thực Tế", key: "actualClosing", width: 24, format: v => (v !== null && v !== undefined ? Number(v).toLocaleString() : "Chưa kiểm kê") },
        { header: "Chênh Lệch (+/-)", key: "variance", width: 18, format: v => (v === null || v === undefined ? "-" : Number(v) > 0 ? `+${Number(v).toLocaleString()}` : Number(v).toLocaleString()) }
      ]
    });
    toast.success("Đã xuất file Excel bảng tổng hợp theo tuần!");
  };

  const exportSkuTotalsExcel = () => {
    if (skuTotals.length === 0) return toast.error("Không có dữ liệu để xuất");
    exportToExcel({
      filename: `Bao_Cao_Tong_Hop_SKU_${selectedMonth}.xlsx`,
      sheetName: "NXT_SKU_Totals",
      title: `BẢNG TỔNG HỢP DỮ LIỆU THEO SKU TRONG KỲ (THÁNG ${selectedMonth})`,
      subtitles: [
        `Danh sách tổng hợp từng mã sản phẩm`,
        `Tồn cuối kỳ lý thuyết: ${period.closing.toLocaleString()} chiếc | Tồn thực tế: ${period.actualClosing !== null ? period.actualClosing.toLocaleString() : "Chưa kiểm kê"} chiếc`
      ],
      data: skuTotals,
      columns: [
        { header: "Mã SKU", key: "sku", width: 14 },
        { header: "Tên Sản Phẩm (Mô Tả)", key: "descr", width: 40 },
        { header: "Tồn Đầu Kỳ", key: "opening", width: 16, format: v => Number(v).toLocaleString() },
        { header: "Tổng Nhập (+)", key: "inbound", width: 16, format: v => `+${Number(v).toLocaleString()}` },
        { header: "Tổng Xuất (-)", key: "outbound", width: 16, format: v => `-${Number(v).toLocaleString()}` },
        { header: "Biến Động", key: "netChange", width: 16, format: v => (Number(v) >= 0 ? `+${Number(v).toLocaleString()}` : Number(v).toLocaleString()) },
        { header: "Tồn Cuối Kỳ Lý Thuyết", key: "theoreticalClosing", width: 24, format: v => Number(v).toLocaleString() },
        { header: "Tồn Cuối Kỳ Thực Tế", key: "actualClosing", width: 24, format: v => (v !== null && v !== undefined ? Number(v).toLocaleString() : "Chưa kiểm kê") },
        { header: "Chênh Lệch (+/-)", key: "variance", width: 18, format: v => (v === null || v === undefined ? "-" : Number(v) > 0 ? `+${Number(v).toLocaleString()}` : Number(v).toLocaleString()) }
      ]
    });
    toast.success("Đã xuất file Excel bảng tổng hợp theo SKU!");
  };

  const exportSkuDailyExcel = () => {
    if (filteredSkuDaily.length === 0) return toast.error("Không có dữ liệu để xuất");
    exportToExcel({
      filename: `Bao_Cao_Chi_Tiet_SKU_Theo_Ngay_${selectedMonth}.xlsx`,
      sheetName: "Chi_Tiet_SKU_Theo_Ngay",
      title: `BẢNG CHI TIẾT NHẬP XUẤT TỒN TỪNG SKU THEO TỪNG NGÀY (THÁNG ${selectedMonth})`,
      data: filteredSkuDaily,
      columns: [
        { header: "Ngày", key: "date", width: 14 },
        { header: "Mã SKU", key: "sku", width: 14 },
        { header: "Tên Sản Phẩm", key: "descr", width: 38 },
        { header: "Tồn Đầu Ngày", key: "opening", width: 16, format: v => Number(v).toLocaleString() },
        { header: "Nhập (+)", key: "inbound", width: 16, format: v => (Number(v) > 0 ? `+${Number(v).toLocaleString()}` : "-") },
        { header: "Xuất (-)", key: "outbound", width: 16, format: v => (Number(v) > 0 ? `-${Number(v).toLocaleString()}` : "-") },
        { header: "Biến Động", key: "netChange", width: 16, format: v => (Number(v) > 0 ? `+${Number(v).toLocaleString()}` : Number(v) < 0 ? Number(v).toLocaleString() : "-") },
        { header: "Tồn Cuối Lý Thuyết", key: "theoreticalClosing", width: 22, format: v => Number(v).toLocaleString() },
        { header: "Tồn Cuối Thực Tế", key: "actualClosing", width: 22, format: v => (v !== null && v !== undefined ? Number(v).toLocaleString() : "Chưa kiểm kê") },
        { header: "Chênh Lệch (+/-)", key: "variance", width: 18, format: v => (v === null || v === undefined ? "-" : Number(v) > 0 ? `+${Number(v).toLocaleString()}` : Number(v).toLocaleString()) }
      ]
    });
    toast.success("Đã xuất file Excel chi tiết SKU theo ngày!");
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.text("BAO CAO NHAP XUAT TON HANG NGAY (DANONE REPORT)", 14, 15);
    doc.setFontSize(10);
    doc.text(`Ky bao cao: Thang ${selectedMonth} | Ngay: ${selectedDate === 'all' ? 'Tat ca' : selectedDate} | SKU: ${selectedSku === 'all' ? 'Tat ca SKU' : selectedSku}`, 14, 22);

    let head: string[][] = [];
    let body: any[][] = [];

    if (activeView === "daily-overall") {
      if (overallMode === "daily") {
        head = [["Ngay", "Ton Dau", "Tong Nhap", "Tong Xuat", "Bien Dong (+/-)", "Ton Cuoi"]];
        body = dailySummary.map((r: any) => [
          r.date,
          r.opening.toLocaleString(),
          `+${r.inbound.toLocaleString()}`,
          `-${r.outbound.toLocaleString()}`,
          (r.netChange >= 0 ? `+${r.netChange.toLocaleString()}` : r.netChange.toLocaleString()),
          r.closing.toLocaleString()
        ]);
      } else {
        head = [["Tuan", "Khoang Thoi Gian", "Ton Dau", "Tong Nhap", "Tong Xuat", "Bien Dong", "Ton Cuoi"]];
        body = weeklySummary.map((r: any) => [
          r.week,
          r.dateRange,
          r.opening.toLocaleString(),
          `+${r.inbound.toLocaleString()}`,
          `-${r.outbound.toLocaleString()}`,
          (r.netChange >= 0 ? `+${r.netChange.toLocaleString()}` : r.netChange.toLocaleString()),
          r.closing.toLocaleString()
        ]);
      }
      body.push([
        "TONG KET",
        "-",
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
              Báo Cáo Nhập - Xuất - Tồn
            </h1>
            <p className="text-slate-500 font-medium">
              Theo dõi biến động xuất nhập tồn từ ngày 1 đến ngày cuối tháng (Theo Ngày hoặc Theo Tuần)
            </p>
          </div>
        </div>

        {/* Global Print & Refresh Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={fetchDailyReport}
            className="flex items-center px-4 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-2xl hover:bg-slate-50 transition-all shadow-sm active:scale-95 text-sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Tải Lại
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
              Lọc Ngày Cụ Thể (Tùy chọn)
            </label>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="all">Tất cả ngày trong tháng ({totalDays} ngày)</option>
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
          <span className="text-[11px] text-slate-400 font-medium">Đầu tháng {selectedMonth}</span>
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
          <span className="text-[11px] text-emerald-200 font-medium">Cuối tháng {selectedMonth}</span>
        </div>
      </div>

      {/* Movement Trend Chart */}
      {dailySummary.length > 0 && (
        <div className="bg-white p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Biểu Đồ Xu Hướng Nhập - Xuất - Tồn Kho Theo Ngày</h3>
              <p className="text-xs text-slate-500">So sánh số lượng nhập (xanh), xuất (cam) và đường tồn kho liên tục không bỏ ngày nào</p>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dailySummary} margin={{ top: 25, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} tickFormatter={(val) => val.substring(8, 10)} />
                <YAxis yAxisId="left" stroke="#94a3b8" fontSize={11} tickLine={false} domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.15)]} />
                <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={11} tickLine={false} />
                <Tooltip
                  formatter={(value: any, name: any) => [Number(value).toLocaleString(), name]}
                  contentStyle={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1px solid #e2e8f0", boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)" }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="inbound" name="Nhập Kho" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={28}>
                  <LabelList 
                    dataKey="inbound" 
                    position="top" 
                    formatter={(v: any) => (v && Number(v) > 0 ? Number(v).toLocaleString() : "")}
                    style={{ fill: "#1e40af", fontSize: 9, fontWeight: 700 }}
                  />
                </Bar>
                <Bar yAxisId="left" dataKey="outbound" name="Xuất Kho" fill="#f97316" radius={[4, 4, 0, 0]} maxBarSize={28}>
                  <LabelList 
                    dataKey="outbound" 
                    position="top" 
                    formatter={(v: any) => (v && Number(v) > 0 ? Number(v).toLocaleString() : "")}
                    style={{ fill: "#c2410c", fontSize: 9, fontWeight: 700 }}
                  />
                </Bar>
                <Line yAxisId="right" type="monotone" dataKey="closing" name="Tồn Cuối Ngày" stroke="#10b981" strokeWidth={3} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* DEDICATED PERMANENT TABLE: BẢNG TỔNG HỢP THEO SKU & SỐ LƯỢNG TRONG KỲ */}
      <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden mb-8">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center">
              <Boxes className="w-5 h-5 mr-2 text-emerald-600" />
              Bảng Tổng Hợp Dữ Liệu Theo SKU & Số Lượng (Tồn Đầu - Nhập - Xuất - Tồn Cuối)
            </h3>
            <p className="text-xs text-slate-500">Bảng theo dõi trực quan số liệu biến động của từng mã sản phẩm trong kỳ báo cáo</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
              Tồn cuối kỳ: {period.closing.toLocaleString()} chiếc
            </span>
            <button
              onClick={exportSkuTotalsExcel}
              className="flex items-center px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-sm active:scale-95"
            >
              <FileDown className="w-3.5 h-3.5 mr-1.5" /> Xuất Excel SKU
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                <th className="py-3.5 px-6">Mã SKU</th>
                <th className="py-3.5 px-6">Tên Sản Phẩm (Mô Tả)</th>
                <th className="py-3.5 px-6 text-right">Tồn Đầu</th>
                <th className="py-3.5 px-6 text-right text-blue-600">Tổng Nhập (+)</th>
                <th className="py-3.5 px-6 text-right text-orange-600">Tổng Xuất (-)</th>
                <th className="py-3.5 px-6 text-right">Biến Động</th>
                <th className="py-3.5 px-6 text-right font-bold text-slate-900">Tồn Cuối Lý Thuyết</th>
                <th className="py-3.5 px-6 text-right font-bold text-emerald-700">Tồn Cuối Thực Tế</th>
                <th className="py-3.5 px-6 text-right font-bold text-slate-700">Chênh Lệch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {skuTotals.map((row: any, idx: number) => (
                <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 px-6 font-bold text-slate-900">{row.sku}</td>
                  <td className="py-3.5 px-6 text-slate-600 max-w-md truncate" title={row.descr}>{row.descr}</td>
                  <td className="py-3.5 px-6 text-right text-slate-600">{row.opening.toLocaleString()}</td>
                  <td className="py-3.5 px-6 text-right text-blue-600 font-bold">+{row.inbound.toLocaleString()}</td>
                  <td className="py-3.5 px-6 text-right text-orange-600 font-bold">-{row.outbound.toLocaleString()}</td>
                  <td className="py-3.5 px-6 text-right font-bold">
                    <span className={`inline-block px-2 py-0.5 rounded-lg text-xs ${
                      row.netChange > 0 
                        ? "bg-emerald-50 text-emerald-700" 
                        : row.netChange < 0 
                        ? "bg-rose-50 text-rose-700" 
                        : "bg-slate-50 text-slate-600"
                    }`}>
                      {row.netChange > 0 ? `+${row.netChange.toLocaleString()}` : row.netChange.toLocaleString()}
                    </span>
                  </td>
                  <td className="py-3.5 px-6 text-right font-black text-slate-900 font-mono">
                    {row.theoreticalClosing.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-6 text-right font-black text-emerald-700 font-mono">
                    {row.actualClosing !== null ? (
                      row.actualClosing.toLocaleString()
                    ) : (
                      <span className="text-slate-400 italic font-normal text-xs">Chưa kiểm kê</span>
                    )}
                  </td>
                  <td className="py-3.5 px-6 text-right font-bold">
                    {row.variance === null ? (
                      <span className="text-slate-300">-</span>
                    ) : row.variance === 0 ? (
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                        ✓ Khớp 100%
                      </span>
                    ) : row.variance < 0 ? (
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 font-mono">
                        {row.variance.toLocaleString()}
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 font-mono">
                        +{row.variance.toLocaleString()}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {skuTotals.length > 0 && (
              <tfoot>
                <tr className="bg-slate-900 text-white font-bold text-sm">
                  <td colSpan={2} className="py-3.5 px-6">TỔNG CỘNG TOÀN KHO</td>
                  <td className="py-3.5 px-6 text-right text-slate-300">{period.opening.toLocaleString()}</td>
                  <td className="py-3.5 px-6 text-right text-blue-300">+{period.inbound.toLocaleString()}</td>
                  <td className="py-3.5 px-6 text-right text-orange-300">-{period.outbound.toLocaleString()}</td>
                  <td className="py-3.5 px-6 text-right text-emerald-300">
                    {period.netChange >= 0 ? `+${period.netChange.toLocaleString()}` : period.netChange.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-6 text-right font-black text-emerald-300 font-mono">
                    {period.closing.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-6 text-right font-black text-teal-300 font-mono">
                    {period.actualClosing !== null ? period.actualClosing.toLocaleString() : "-"}
                  </td>
                  <td className="py-3.5 px-6 text-right font-bold text-xs">
                    {period.variance === null ? (
                      "-"
                    ) : period.variance === 0 ? (
                      <span className="text-emerald-400">✓ Khớp</span>
                    ) : period.variance < 0 ? (
                      <span className="text-rose-400 font-mono">{period.variance.toLocaleString()}</span>
                    ) : (
                      <span className="text-amber-400 font-mono">+{period.variance.toLocaleString()}</span>
                    )}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Navigation View Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-slate-200 pb-3">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveView("daily-overall")}
            className={`px-5 py-2.5 rounded-2xl font-bold text-sm transition-all flex items-center ${
              activeView === "daily-overall"
                ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Calendar className="w-4 h-4 mr-2" />
            Báo Cáo Tổng Hợp Theo Thời Gian
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

        {/* Mode Selector for Overall: Theo Ngày or Theo Tuần */}
        {activeView === "daily-overall" && (
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              onClick={() => setOverallMode("daily")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center ${
                overallMode === "daily"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Calendar className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
              Theo Ngày (1..cuối tháng)
            </button>
            <button
              onClick={() => setOverallMode("weekly")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center ${
                overallMode === "weekly"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
              Theo Tuần (Tuần 1..5)
            </button>
          </div>
        )}
      </div>

      {/* VIEW 1: BÁO CÁO TỔNG THỂ THEO TỪNG NGÀY HOẶC THEO TUẦN */}
      {activeView === "daily-overall" && (
        <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden">
          {/* Table Header with Export Excel Button */}
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                {overallMode === "daily"
                  ? "Bảng Tổng Hợp Nhập Xuất Tồn Theo Ngày"
                  : "Bảng Tổng Hợp Nhập Xuất Tồn Theo Tuần"}
              </h3>
              <p className="text-xs text-slate-500">
                {overallMode === "daily"
                  ? `Số liệu hàng ngày từ ngày 1 đến ngày cuối tháng (Đầy đủ ${totalDays} ngày, không bỏ ngày nào)`
                  : `Số liệu tổng hợp theo từng tuần trong tháng ${selectedMonth}`}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-600 bg-slate-200/60 px-3 py-1 rounded-full">
                {overallMode === "daily"
                  ? `${totalDays}/${totalDays} ngày (${activeDays} ngày có giao dịch)`
                  : `${weeklySummary.length} tuần trong tháng`}
              </span>
              <button
                onClick={overallMode === "daily" ? exportDailyExcel : exportWeeklyExcel}
                className="flex items-center px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-sm active:scale-95"
              >
                <FileDown className="w-3.5 h-3.5 mr-1.5" />
                {overallMode === "daily" ? "Xuất Excel Theo Ngày" : "Xuất Excel Theo Tuần"}
              </button>
            </div>
          </div>

          {/* TABLE CONTENT: DAILY MODE */}
          {overallMode === "daily" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                    <th className="py-4 px-6">Ngày</th>
                    <th className="py-4 px-6 text-right">Tồn Đầu Ngày</th>
                    <th className="py-4 px-6 text-right text-blue-600">Tổng Nhập (+)</th>
                    <th className="py-4 px-6 text-right text-orange-600">Tổng Xuất (-)</th>
                    <th className="py-4 px-6 text-right">Biến Động Ròng</th>
                    <th className="py-4 px-6 text-right font-bold text-slate-800">Tồn Cuối Lý Thuyết</th>
                    <th className="py-4 px-6 text-right font-bold text-emerald-700">Tồn Cuối Thực Tế</th>
                    <th className="py-4 px-6 text-right font-bold text-slate-700">Chênh Lệch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {dailySummary.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        Không có dữ liệu trong khoảng thời gian đã chọn.
                      </td>
                    </tr>
                  ) : (
                    dailySummary.map((row: any, idx: number) => {
                      const hasActivity = row.hasActivity || row.inbound > 0 || row.outbound > 0;
                      return (
                        <tr 
                          key={idx} 
                          className={`hover:bg-slate-50/80 transition-colors ${
                            hasActivity ? "bg-emerald-50/20" : ""
                          }`}
                        >
                          <td className="py-3.5 px-6 font-bold text-slate-800 flex items-center">
                            <span 
                              className={`w-2.5 h-2.5 rounded-full mr-3 ${
                                hasActivity ? "bg-emerald-500 ring-2 ring-emerald-300 animate-pulse" : "bg-slate-300"
                              }`} 
                            />
                            {row.date}
                            {hasActivity && (
                              <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                Phát sinh
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-6 text-right text-slate-600 font-semibold">
                            {row.opening.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-6 text-right text-blue-600 font-bold">
                            {row.inbound > 0 ? `+${row.inbound.toLocaleString()}` : "-"}
                          </td>
                          <td className="py-3.5 px-6 text-right text-orange-600 font-bold">
                            {row.outbound > 0 ? `-${row.outbound.toLocaleString()}` : "-"}
                          </td>
                          <td className="py-3.5 px-6 text-right font-bold">
                            {row.netChange !== 0 ? (
                              <span className={`inline-block px-2.5 py-1 rounded-lg text-xs ${
                                row.netChange > 0 
                                  ? "bg-emerald-50 text-emerald-700 font-bold" 
                                  : "bg-rose-50 text-rose-700 font-bold"
                              }`}>
                                {row.netChange > 0 ? `+${row.netChange.toLocaleString()}` : row.netChange.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-3.5 px-6 text-right font-black text-slate-900 text-base font-mono">
                            {row.theoreticalClosing.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-6 text-right font-black text-emerald-700 text-base font-mono">
                            {row.hasActual && row.actualClosing !== null ? (
                              <span className="inline-flex items-center">
                                {row.actualClosing.toLocaleString()}
                                <span className="ml-1.5 text-[10px] font-bold px-1 py-0.2 rounded bg-emerald-100 text-emerald-800">
                                  Kiểm kê
                                </span>
                              </span>
                            ) : (
                              <span className="text-slate-400 italic font-normal text-xs">Chưa kiểm kê</span>
                            )}
                          </td>
                          <td className="py-3.5 px-6 text-right font-bold">
                            {!row.hasActual || row.variance === null ? (
                              <span className="text-slate-300">-</span>
                            ) : row.variance === 0 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800">
                                ✓ Khớp 100%
                              </span>
                            ) : row.variance < 0 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold bg-rose-100 text-rose-800 font-mono">
                                {row.variance.toLocaleString()}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold bg-amber-100 text-amber-800 font-mono">
                                +{row.variance.toLocaleString()}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
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
                      <td className="py-4 px-6 text-right font-black text-base text-emerald-300 font-mono">
                        {period.closing.toLocaleString()}
                      </td>
                      <td className="py-4 px-6 text-right font-black text-base text-teal-300 font-mono">
                        {period.actualClosing !== null ? period.actualClosing.toLocaleString() : "-"}
                      </td>
                      <td className="py-4 px-6 text-right font-bold text-xs">
                        {period.variance === null ? (
                          "-"
                        ) : period.variance === 0 ? (
                          <span className="text-emerald-400">✓ Khớp</span>
                        ) : period.variance < 0 ? (
                          <span className="text-rose-400 font-mono">{period.variance.toLocaleString()}</span>
                        ) : (
                          <span className="text-amber-400 font-mono">+{period.variance.toLocaleString()}</span>
                        )}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}

          {/* TABLE CONTENT: WEEKLY MODE */}
          {overallMode === "weekly" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                    <th className="py-4 px-6">Tuần</th>
                    <th className="py-4 px-6">Khoảng Thời Gian</th>
                    <th className="py-4 px-6 text-center">Giao Dịch</th>
                    <th className="py-4 px-6 text-right">Tồn Đầu Tuần</th>
                    <th className="py-4 px-6 text-right text-blue-600">Tổng Nhập (+)</th>
                    <th className="py-4 px-6 text-right text-orange-600">Tổng Xuất (-)</th>
                    <th className="py-4 px-6 text-right">Biến Động Ròng</th>
                    <th className="py-4 px-6 text-right font-bold text-slate-800">Tồn Cuối Lý Thuyết</th>
                    <th className="py-4 px-6 text-right font-bold text-emerald-700">Tồn Cuối Thực Tế</th>
                    <th className="py-4 px-6 text-right font-bold text-slate-700">Chênh Lệch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {weeklySummary.map((row: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-4 px-6 font-bold text-slate-900">{row.week}</td>
                      <td className="py-4 px-6 text-slate-600 font-semibold">{row.dateRange}</td>
                      <td className="py-4 px-6 text-center">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold border border-slate-200">
                          {row.activeDaysCount}/{row.daysCount} ngày
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right text-slate-600 font-semibold">{row.opening.toLocaleString()}</td>
                      <td className="py-4 px-6 text-right text-blue-600 font-bold">
                        {row.inbound > 0 ? `+${row.inbound.toLocaleString()}` : "-"}
                      </td>
                      <td className="py-4 px-6 text-right text-orange-600 font-bold">
                        {row.outbound > 0 ? `-${row.outbound.toLocaleString()}` : "-"}
                      </td>
                      <td className="py-4 px-6 text-right font-bold">
                        {row.netChange !== 0 ? (
                          <span className={`inline-block px-2.5 py-1 rounded-lg text-xs ${
                            row.netChange > 0 
                              ? "bg-emerald-50 text-emerald-700 font-bold" 
                              : "bg-rose-50 text-rose-700 font-bold"
                          }`}>
                            {row.netChange > 0 ? `+${row.netChange.toLocaleString()}` : row.netChange.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right font-black text-slate-900 text-base font-mono">
                        {row.theoreticalClosing.toLocaleString()}
                      </td>
                      <td className="py-4 px-6 text-right font-black text-emerald-700 text-base font-mono">
                        {row.actualClosing !== null ? (
                          row.actualClosing.toLocaleString()
                        ) : (
                          <span className="text-slate-400 italic font-normal text-xs">Chưa kiểm kê</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right font-bold">
                        {row.variance === null ? (
                          <span className="text-slate-300">-</span>
                        ) : row.variance === 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800">
                            ✓ Khớp
                          </span>
                        ) : row.variance < 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold bg-rose-100 text-rose-800 font-mono">
                            {row.variance.toLocaleString()}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold bg-amber-100 text-amber-800 font-mono">
                            +{row.variance.toLocaleString()}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-900 text-white font-bold text-sm">
                    <td colSpan={3} className="py-4 px-6">TỔNG CỘNG TOÀN THÁNG</td>
                    <td className="py-4 px-6 text-right text-slate-300">{period.opening.toLocaleString()}</td>
                    <td className="py-4 px-6 text-right text-blue-300">+{period.inbound.toLocaleString()}</td>
                    <td className="py-4 px-6 text-right text-orange-300">-{period.outbound.toLocaleString()}</td>
                    <td className="py-4 px-6 text-right text-emerald-300">
                      {period.netChange >= 0 ? `+${period.netChange.toLocaleString()}` : period.netChange.toLocaleString()}
                    </td>
                    <td className="py-4 px-6 text-right font-black text-base text-emerald-300 font-mono">
                      {period.closing.toLocaleString()}
                    </td>
                    <td className="py-4 px-6 text-right font-black text-base text-teal-300 font-mono">
                      {period.actualClosing !== null ? period.actualClosing.toLocaleString() : "-"}
                    </td>
                    <td className="py-4 px-6 text-right font-bold text-xs">
                      {period.variance === null ? (
                        "-"
                      ) : period.variance === 0 ? (
                        <span className="text-emerald-400">✓ Khớp</span>
                      ) : period.variance < 0 ? (
                        <span className="text-rose-400 font-mono">{period.variance.toLocaleString()}</span>
                      ) : (
                        <span className="text-amber-400 font-mono">+{period.variance.toLocaleString()}</span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: BÁO CÁO CHI TIẾT TỪNG SKU THEO TỪNG NGÀY */}
      {activeView === "daily-sku" && (
        <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Chi Tiết Nhập - Xuất - Tồn Từng SKU Theo Từng Ngày</h3>
              <p className="text-xs text-slate-500">Phát sinh giao dịch chi tiết theo mã sản phẩm</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-500 bg-slate-200/60 px-3 py-1 rounded-full">
                {filteredSkuDaily.length} dòng dữ liệu
              </span>
              <button
                onClick={exportSkuDailyExcel}
                className="flex items-center px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-sm active:scale-95"
              >
                <FileDown className="w-3.5 h-3.5 mr-1.5" /> Xuất Excel Chi Tiết
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                  <th className="py-3.5 px-6">Ngày</th>
                  <th className="py-3.5 px-6">Mã SKU</th>
                  <th className="py-3.5 px-6">Tên Sản Phẩm</th>
                  <th className="py-3.5 px-6 text-right">Tồn Đầu</th>
                  <th className="py-3.5 px-6 text-right text-blue-600">Nhập (+)</th>
                  <th className="py-3.5 px-6 text-right text-orange-600">Xuất (-)</th>
                  <th className="py-3.5 px-6 text-right font-bold text-slate-800">Tồn Cuối Lý Thuyết</th>
                  <th className="py-3.5 px-6 text-right font-bold text-emerald-700">Tồn Cuối Thực Tế</th>
                  <th className="py-3.5 px-6 text-right font-bold text-slate-700">Chênh Lệch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredSkuDaily.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      Không tìm thấy giao dịch SKU phù hợp với bộ lọc.
                    </td>
                  </tr>
                ) : (
                  filteredSkuDaily.map((row: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-6 font-semibold text-slate-800">{row.date}</td>
                      <td className="py-3 px-6 font-bold text-slate-900">{row.sku}</td>
                      <td className="py-3 px-6 text-slate-600 max-w-xs truncate" title={row.descr}>{row.descr}</td>
                      <td className="py-3 px-6 text-right text-slate-600">{row.opening.toLocaleString()}</td>
                      <td className="py-3 px-6 text-right text-blue-600 font-bold">
                        {row.inbound > 0 ? `+${row.inbound.toLocaleString()}` : "-"}
                      </td>
                      <td className="py-3 px-6 text-right text-orange-600 font-bold">
                        {row.outbound > 0 ? `-${row.outbound.toLocaleString()}` : "-"}
                      </td>
                      <td className="py-3 px-6 text-right font-black text-slate-900 font-mono">
                        {row.theoreticalClosing.toLocaleString()}
                      </td>
                      <td className="py-3 px-6 text-right font-black text-emerald-700 font-mono">
                        {row.hasActual && row.actualClosing !== null ? (
                          row.actualClosing.toLocaleString()
                        ) : (
                          <span className="text-slate-400 italic font-normal text-xs">Chưa kiểm kê</span>
                        )}
                      </td>
                      <td className="py-3 px-6 text-right font-bold">
                        {!row.hasActual || row.variance === null ? (
                          <span className="text-slate-300">-</span>
                        ) : row.variance === 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                            ✓ Khớp
                          </span>
                        ) : row.variance < 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 font-mono">
                            {row.variance.toLocaleString()}
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 font-mono">
                            +{row.variance.toLocaleString()}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: TỔNG HỢP SKU TRONG KỲ */}
      {activeView === "sku-summary" && (
        <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Tổng Hợp Biến Động Từng SKU Trong Kỳ Báo Cáo</h3>
              <p className="text-xs text-slate-500">Xem tổng thể số lượng tồn đầu, nhập, xuất và tồn cuối của từng mã</p>
            </div>
            <button
              onClick={exportSkuTotalsExcel}
              className="flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-sm active:scale-95"
            >
              <FileDown className="w-3.5 h-3.5 mr-1.5" /> Xuất Excel Toàn Bộ SKU
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                  <th className="py-3.5 px-6">Mã SKU</th>
                  <th className="py-3.5 px-6">Tên Sản Phẩm</th>
                  <th className="py-3.5 px-6 text-right">Tồn Đầu Kỳ</th>
                  <th className="py-3.5 px-6 text-right text-blue-600">Tổng Nhập (+)</th>
                  <th className="py-3.5 px-6 text-right text-orange-600">Tổng Xuất (-)</th>
                  <th className="py-3.5 px-6 text-right">Biến Động</th>
                  <th className="py-3.5 px-6 text-right font-bold text-slate-800">Tồn Cuối Kỳ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {skuTotals.map((row: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-6 font-bold text-slate-900">{row.sku}</td>
                    <td className="py-3.5 px-6 text-slate-600">{row.descr}</td>
                    <td className="py-3.5 px-6 text-right text-slate-600">{row.opening.toLocaleString()}</td>
                    <td className="py-3.5 px-6 text-right text-blue-600 font-bold">+{row.inbound.toLocaleString()}</td>
                    <td className="py-3.5 px-6 text-right text-orange-600 font-bold">-{row.outbound.toLocaleString()}</td>
                    <td className="py-3.5 px-6 text-right font-bold">
                      <span className={`inline-block px-2 py-0.5 rounded-lg text-xs ${
                        row.netChange > 0 ? "bg-emerald-50 text-emerald-700" : row.netChange < 0 ? "bg-rose-50 text-rose-700" : "bg-slate-50 text-slate-600"
                      }`}>
                        {row.netChange > 0 ? `+${row.netChange.toLocaleString()}` : row.netChange.toLocaleString()}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-right font-black text-slate-900">{row.closing.toLocaleString()}</td>
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
