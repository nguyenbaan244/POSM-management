"use client";

import { useState, useEffect } from "react";
import { 
  Scale, 
  Search, 
  Calendar, 
  FileDown, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  HelpCircle,
  Layers,
  Box
} from "lucide-react";
import { toast } from "sonner";
import { exportToExcel } from "@/lib/excelExport";

export default function CheckLechTonPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [baselineDate, setBaselineDate] = useState<string>("");
  const [latestDate, setLatestDate] = useState<string>("");
  const [viewMode, setViewMode] = useState<"sku" | "batch">("sku");
  const [filter, setFilter] = useState<"all" | "discrepancy" | "match">("all");
  const [search, setSearch] = useState("");

  const fetchReconciliation = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (baselineDate) params.append("baselineDate", baselineDate);
    if (latestDate) params.append("latestDate", latestDate);
    if (viewMode) params.append("viewMode", viewMode);
    if (filter !== "all") params.append("filter", filter);
    if (search) params.append("search", search);

    fetch(`/api/reconciliation?${params.toString()}`)
      .then(res => res.json())
      .then(resData => {
        if (resData.success) {
          setData(resData);
          if (resData.baselineDate && (!baselineDate || !resData.availableBaselineDates?.includes(baselineDate))) {
            setBaselineDate(resData.baselineDate);
          }
          if (resData.latestDate && (!latestDate || !resData.availableLatestDates?.includes(latestDate))) {
            setLatestDate(resData.latestDate);
          }
        } else {
          toast.error(resData.error || "Không thể tải dữ liệu đối soát");
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Lỗi khi tải dữ liệu đối soát:", err);
        toast.error("Lỗi kết nối máy chủ");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchReconciliation();
  }, [baselineDate, latestDate, viewMode, filter, search]);

  const items = data?.items || [];
  const summary = data?.summary || {
    totalSkus: 0,
    totalBatches: 0,
    skuMatchedCount: 0,
    skuDiscrepancyCount: 0,
    batchMatchedCount: 0,
    batchDiscrepancyCount: 0,
    totalOld: 0,
    totalIn: 0,
    totalOut: 0,
    totalCalculated: 0,
    totalActual: 0,
    netVariance: 0
  };

  const availableBaselineFiles = data?.availableBaselineFiles || [];
  const availableLatestFiles = data?.availableLatestFiles || [];

  const matchedCount = viewMode === "sku" ? summary.skuMatchedCount : summary.batchMatchedCount;
  const discrepancyCount = viewMode === "sku" ? summary.skuDiscrepancyCount : summary.batchDiscrepancyCount;
  const totalItemCount = viewMode === "sku" ? summary.totalSkus : summary.totalBatches;

  const handleExportExcel = () => {
    if (!items || items.length === 0) {
      toast.error("Không có dữ liệu để xuất");
      return;
    }

    const isBatch = viewMode === "batch";
    const exportColumns = isBatch
      ? [
          { header: "Mã SKU", key: "sku", width: 14 },
          { header: "Tên Sản Phẩm", key: "descr", width: 38 },
          { header: "Số Lô (Batch)", key: "batch", width: 18 },
          { header: `Tồn Cũ (${baselineDate})`, key: "oldQty", width: 16, format: (v: any) => Number(v).toLocaleString() },
          { header: "(+) Nhập Trong Kỳ", key: "inQty", width: 16, format: (v: any) => (Number(v) > 0 ? `+${Number(v).toLocaleString()}` : "-") },
          { header: "(-) Xuất Trong Kỳ", key: "outQty", width: 16, format: (v: any) => (Number(v) > 0 ? `-${Number(v).toLocaleString()}` : "-") },
          { header: "(=) Tồn Tính Toán (Sổ Sách)", key: "calculatedQty", width: 22, format: (v: any) => Number(v).toLocaleString() },
          { header: `Tồn Thực Tế Tải Lên (${latestDate})`, key: "actualQty", width: 22, format: (v: any) => Number(v).toLocaleString() },
          { header: "Chênh Lệch (+/-)", key: "variance", width: 16, format: (v: any) => (Number(v) > 0 ? `+${Number(v).toLocaleString()}` : Number(v).toLocaleString()) },
          { header: "Trạng Thái", key: "statusText", width: 20 },
          { header: "Đánh Giá Sai Ở Đâu", key: "reason", width: 45 }
        ]
      : [
          { header: "Mã SKU", key: "sku", width: 14 },
          { header: "Tên Sản Phẩm", key: "descr", width: 38 },
          { header: `Tồn Cũ (${baselineDate})`, key: "oldQty", width: 16, format: (v: any) => Number(v).toLocaleString() },
          { header: "(+) Tổng Nhập Trong Kỳ", key: "inQty", width: 18, format: (v: any) => (Number(v) > 0 ? `+${Number(v).toLocaleString()}` : "-") },
          { header: "(-) Tổng Xuất Trong Kỳ", key: "outQty", width: 18, format: (v: any) => (Number(v) > 0 ? `-${Number(v).toLocaleString()}` : "-") },
          { header: "(=) Tồn Tính Toán (Sổ Sách)", key: "calculatedQty", width: 24, format: (v: any) => Number(v).toLocaleString() },
          { header: `Tồn Thực Tế Tải Lên (${latestDate})`, key: "actualQty", width: 24, format: (v: any) => Number(v).toLocaleString() },
          { header: "Chênh Lệch (+/-)", key: "variance", width: 16, format: (v: any) => (Number(v) > 0 ? `+${Number(v).toLocaleString()}` : Number(v).toLocaleString()) },
          { header: "Trạng Thái", key: "statusText", width: 20 },
          { header: "Đánh Giá Sai Ở Đâu", key: "reason", width: 45 }
        ];

    exportToExcel({
      filename: `Doi_Soat_Lech_Ton_${viewMode.toUpperCase()}_${baselineDate}_den_${latestDate}.xlsx`,
      sheetName: isBatch ? "Lech_Ton_Theo_Lo" : "Lech_Ton_Theo_SKU",
      title: `BẢNG ĐỐI SOÁT CHÊNH LỆCH TỒN KHO ${isBatch ? "CHI TIẾT THEO LÔ" : "TỔNG HỢP THEO SKU"} (DANONE LOGISTICS)`,
      subtitles: [
        `Khoảng thời gian: Từ ngày ${baselineDate} (File tồn cũ) đến ngày ${latestDate} (File tồn mới)`,
        `Chế độ xem: ${isBatch ? "Chi tiết theo Lô (Batch)" : "Tổng hợp theo SKU"} | Số mục: ${totalItemCount} | Khớp: ${matchedCount} | Lệch: ${discrepancyCount} | Tổng chênh lệch: ${summary.netVariance >= 0 ? `+${summary.netVariance.toLocaleString()}` : summary.netVariance.toLocaleString()} chiếc`,
        `Thời gian xuất: ${new Date().toLocaleString("vi-VN")}`
      ],
      data: items,
      columns: exportColumns
    });

    toast.success(`Đã xuất file Excel đối soát ${isBatch ? "theo Lô" : "theo SKU"} thành công!`);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto animate-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-3xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
            <Scale className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">
              Check Lệch Tồn Kho
            </h1>
            <p className="text-slate-500 font-medium">
              Chỉ lấy số tồn file cũ + nhập - xuất và so sánh trực tiếp với số tồn file mới
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchReconciliation}
            disabled={loading}
            className="flex items-center px-4 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-2xl hover:bg-slate-50 transition-all shadow-sm active:scale-95 text-sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 text-slate-600 ${loading ? "animate-spin" : ""}`} />
            Làm Mới
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold rounded-2xl hover:shadow-lg hover:shadow-emerald-500/20 transition-all active:scale-95 text-sm"
          >
            <FileDown className="w-4 h-4 mr-2" />
            Xuất Excel (.xlsx)
          </button>
        </div>
      </div>

      {/* Date Selectors & Formula Banner */}
      <div className="bg-white p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
            {/* Baseline Date Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span className="flex items-center">
                  <Calendar className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                  File Tồn Kho Cũ (Đầu Kỳ)
                </span>
                {availableBaselineFiles.length > 0 && (
                  <span className="text-[11px] text-blue-600 font-normal">
                    {availableBaselineFiles.length} file đã upload
                  </span>
                )}
              </label>

              {availableBaselineFiles.length > 0 ? (
                <select
                  value={baselineDate}
                  onChange={(e) => setBaselineDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  {availableBaselineFiles.map((f: any, idx: number) => (
                    <option key={idx} value={f.date}>
                      Ngày {f.date} ({f.skuCount} SKU, {f.totalQty.toLocaleString()} chiếc)
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="date"
                  value={baselineDate}
                  onChange={(e) => setBaselineDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              )}
              <span className="text-[11px] text-slate-400 mt-1 block">
                Căn cứ số dư tồn ban đầu để tính toán (+ Nhập - Xuất)
              </span>
            </div>

            {/* Latest Date Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span className="flex items-center">
                  <Calendar className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                  File Tồn Kho Mới (Kiểm Kê / Đối Soát)
                </span>
                {availableLatestFiles.length > 0 && (
                  <span className="text-[11px] text-emerald-600 font-normal">
                    {availableLatestFiles.length} file đã upload
                  </span>
                )}
              </label>

              {availableLatestFiles.length > 0 ? (
                <select
                  value={latestDate}
                  onChange={(e) => setLatestDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  {availableLatestFiles.map((f: any, idx: number) => (
                    <option key={idx} value={f.date}>
                      Ngày {f.date} ({f.skuCount} SKU, {f.totalQty.toLocaleString()} chiếc)
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="date"
                  value={latestDate}
                  onChange={(e) => setLatestDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              )}
              <span className="text-[11px] text-slate-400 mt-1 block">
                Số tồn thực tế trong file tồn mới để so sánh trực tiếp
              </span>
            </div>
          </div>

          {/* Formula Callout */}
          <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 max-w-sm">
            <div className="flex items-start space-x-3 text-xs text-slate-700">
              <HelpCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-emerald-950">Công thức chuẩn:</p>
                <p className="mt-0.5 text-slate-700">
                  <span className="font-bold text-slate-900">(=) Tồn Tính Toán</span> = Tồn file cũ + Nhập trong kỳ - Xuất trong kỳ.
                </p>
                <p className="mt-0.5 text-slate-700">
                  <span className="font-bold text-slate-900">Chênh Lệch</span> = Tồn file mới - Tồn Tính Toán.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
            {viewMode === "sku" ? "Tổng Số SKU Kiểm Tra" : "Tổng Số Lô Kiểm Tra"}
          </p>
          <h3 className="text-2xl font-black text-slate-800">
            {totalItemCount}
          </h3>
          <span className="text-[11px] text-slate-400 font-medium">
            {viewMode === "sku" ? "Mã hàng SKU" : "Cặp SKU - Batch"}
          </span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-emerald-100 shadow-[0_8px_30px_rgb(16,185,129,0.06)] relative overflow-hidden">
          <div className="absolute -right-2 -bottom-2 w-16 h-16 bg-emerald-50 rounded-full pointer-events-none" />
          <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1 flex items-center">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Khớp 100%
          </p>
          <h3 className="text-2xl font-black text-emerald-700">
            {matchedCount}
          </h3>
          <span className="text-[11px] text-emerald-500 font-medium">Chính xác tuyệt đối</span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-rose-100 shadow-[0_8px_30px_rgb(244,63,94,0.06)] relative overflow-hidden">
          <div className="absolute -right-2 -bottom-2 w-16 h-16 bg-rose-50 rounded-full pointer-events-none" />
          <p className="text-xs font-bold text-rose-600 uppercase tracking-wider mb-1 flex items-center">
            <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Bị Lệch Tồn
          </p>
          <h3 className="text-2xl font-black text-rose-700">
            {discrepancyCount}
          </h3>
          <span className="text-[11px] text-rose-500 font-medium">Cần kiểm tra lại</span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Tồn Tính Toán (Sổ Sách)</p>
          <h3 className="text-2xl font-black text-slate-800">
            {summary.totalCalculated.toLocaleString()}
          </h3>
          <span className="text-[11px] text-slate-400 font-medium">Tồn cũ + Nhập - Xuất</span>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-3xl shadow-lg shadow-slate-900/10 col-span-2 md:col-span-1">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Tồn Thực Tế Tải Lên</p>
          <h3 className="text-2xl font-black text-emerald-400">
            {summary.totalActual.toLocaleString()}
          </h3>
          <span className="text-[11px] text-slate-300 font-medium">
            Lệch: {summary.netVariance >= 0 ? `+${summary.netVariance.toLocaleString()}` : summary.netVariance.toLocaleString()} chiếc
          </span>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden mb-8">
        {/* Table Filter Header & View Mode Switch */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex bg-slate-200/80 p-1 rounded-2xl mr-2">
              <button
                onClick={() => setViewMode("sku")}
                className={`flex items-center px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  viewMode === "sku"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Layers className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                Tổng Hợp Theo SKU ({summary.totalSkus})
              </button>
              <button
                onClick={() => setViewMode("batch")}
                className={`flex items-center px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  viewMode === "batch"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Box className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                Chi Tiết Theo Lô (BatchNo) ({summary.totalBatches})
              </button>
            </div>

            {/* Status Filters */}
            <button
              onClick={() => setFilter("all")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filter === "all"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              Tất Cả ({totalItemCount})
            </button>
            <button
              onClick={() => setFilter("discrepancy")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center ${
                filter === "discrepancy"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "bg-white text-rose-700 border border-rose-200 hover:bg-rose-50"
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 mr-1" />
              Chỉ Xem Lệch ({discrepancyCount})
            </button>
            <button
              onClick={() => setFilter("match")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center ${
                filter === "match"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              Khớp 100% ({matchedCount})
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo SKU, Tên SP, Lô..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <th className="py-3.5 px-4">Mã SKU</th>
                <th className="py-3.5 px-4">Tên Sản Phẩm</th>
                {viewMode === "batch" && (
                  <th className="py-3.5 px-4">Số Lô (BatchNo)</th>
                )}
                <th className="py-3.5 px-4 text-right">Tồn Cũ ({baselineDate})</th>
                <th className="py-3.5 px-4 text-right text-blue-600">(+) Nhập</th>
                <th className="py-3.5 px-4 text-right text-orange-600">(-) Xuất</th>
                <th className="py-3.5 px-4 text-right font-bold text-slate-800">(=) Tồn Tính Toán</th>
                <th className="py-3.5 px-4 text-right font-bold text-slate-800">Tồn Mới ({latestDate})</th>
                <th className="py-3.5 px-4 text-right font-black">Chênh Lệch</th>
                <th className="py-3.5 px-4 text-center">Trạng Thái</th>
                <th className="py-3.5 px-4">Đánh Giá Sai Ở Đâu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={viewMode === "batch" ? 11 : 10} className="py-16 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                    Đang đối soát dữ liệu theo công thức tồn cũ + nhập - xuất...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={viewMode === "batch" ? 11 : 10} className="py-16 text-center text-slate-400">
                    Không tìm thấy mục đối soát nào phù hợp với điều kiện tìm kiếm.
                  </td>
                </tr>
              ) : (
                items.map((row: any, idx: number) => {
                  const isMatch = row.variance === 0;
                  const isOver = row.variance > 0;

                  return (
                    <tr 
                      key={idx} 
                      className={`hover:bg-slate-50 transition-colors ${
                        !isMatch ? (isOver ? "bg-blue-50/20" : "bg-rose-50/20") : ""
                      }`}
                    >
                      <td className="py-3 px-4 font-bold text-slate-900">{row.sku}</td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={row.descr}>
                        {row.descr}
                      </td>
                      {viewMode === "batch" && (
                        <td className="py-3 px-4 font-semibold text-slate-700">
                          <span className="px-2 py-0.5 bg-slate-100 rounded-md font-mono text-[11px] border border-slate-200">
                            {row.batch}
                          </span>
                        </td>
                      )}
                      <td className="py-3 px-4 text-right text-slate-600">{row.oldQty.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right text-blue-600 font-bold">
                        {row.inQty > 0 ? `+${row.inQty.toLocaleString()}` : "-"}
                      </td>
                      <td className="py-3 px-4 text-right text-orange-600 font-bold">
                        {row.outQty > 0 ? `-${row.outQty.toLocaleString()}` : "-"}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-800">
                        {row.calculatedQty.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-slate-900">
                        {row.actualQty.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-black">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-lg text-xs font-bold ${
                            isMatch
                              ? "text-slate-400"
                              : isOver
                              ? "bg-blue-100 text-blue-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {row.variance > 0 ? `+${row.variance.toLocaleString()}` : row.variance.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isMatch ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Khớp 100%
                          </span>
                        ) : isOver ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            Lệch thừa (+)
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <AlertTriangle className="w-3 h-3 mr-1" /> Lệch thiếu (-)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-sm truncate text-[11px]" title={row.reason}>
                        {row.reason}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {items.length > 0 && (
              <tfoot>
                <tr className="bg-slate-900 text-white font-bold text-xs">
                  <td colSpan={viewMode === "batch" ? 3 : 2} className="py-3.5 px-4 text-sm font-black">
                    TỔNG CỘNG TOÀN BỘ KHO
                  </td>
                  <td className="py-3.5 px-4 text-right text-slate-300">
                    {summary.totalOld.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-right text-blue-300">
                    +{summary.totalIn.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-right text-orange-300">
                    -{summary.totalOut.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-right text-white">
                    {summary.totalCalculated.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-right text-emerald-300 font-black">
                    {summary.totalActual.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-right text-emerald-400 font-black">
                    {summary.netVariance >= 0 ? `+${summary.netVariance.toLocaleString()}` : summary.netVariance.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {discrepancyCount === 0 ? "Khớp Toàn Bộ" : `Lệch ${discrepancyCount} mục`}
                  </td>
                  <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                    {discrepancyCount === 0 ? "Số liệu hoàn toàn chính xác" : "Cần rà soát các mục bị lệch"}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
