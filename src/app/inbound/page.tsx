"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  ArrowDownToLine, 
  Calendar, 
  Plus, 
  Search, 
  Printer, 
  Undo2, 
  CheckCircle2, 
  Boxes, 
  FileText, 
  TrendingUp,
  Package,
  Save,
  Trash2,
  X,
  FileDown
} from "lucide-react";
import { toast } from "sonner";
import { exportToExcel } from "@/lib/excelExport";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LabelList
} from "recharts";

export default function InboundPage() {
  const [selectedMonth, setSelectedMonth] = useState<string>("2026-10");
  const [selectedDate, setSelectedDate] = useState<string>("all");
  const [selectedSku, setSelectedSku] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [inboundData, setInboundData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Manual Entry Form Modal / Section
  const [showManualModal, setShowManualModal] = useState(false);
  const [masterDataList, setMasterDataList] = useState<any[]>([]);

  const defaultRow = () => ({
    date: new Date().toISOString().split('T')[0],
    account: "Danone",
    sku: "",
    descr: "",
    quantity: "",
    status: "NORMAL",
    remark: "",
  });

  const [rows, setRows] = useState<any[]>([defaultRow()]);
  const [savingManual, setSavingManual] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const fetchInbound = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedMonth && selectedMonth !== "all") params.append("month", selectedMonth);
    if (selectedDate && selectedDate !== "all") params.append("date", selectedDate);
    if (selectedSku && selectedSku !== "all") params.append("sku", selectedSku);
    if (search) params.append("search", search);

    fetch(`/api/inbound?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        setInboundData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load inbound data:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchInbound();
  }, [selectedMonth, selectedDate, selectedSku, search]);

  useEffect(() => {
    fetch("/api/master-data")
      .then(res => res.json())
      .then(setMasterDataList)
      .catch(console.error);
  }, []);

  const items = inboundData?.items || [];
  const totalQuantity = inboundData?.totalQuantity || 0;
  const totalCount = inboundData?.totalCount || 0;
  const dailyStats = inboundData?.dailyStats || [];
  const skuStats = inboundData?.skuStats || [];
  const availableDates = inboundData?.availableDates || [];
  const availableMonths = inboundData?.availableMonths || [];

  // Group inbound details: nếu cùng ngày nhập, SKU và PO thì gom thành 1 dòng, cộng tổng số lượng lại
  const groupedItems = useMemo(() => {
    const map = new Map<string, any>();
    for (const item of items) {
      const dateStr = item.date ? new Date(item.date).toISOString().split('T')[0] : '';
      const poStr = (item.orderCode || '').trim();
      const skuStr = (item.sku || '').trim();
      const groupKey = `${dateStr}__${poStr}__${skuStr}`;

      if (!map.has(groupKey)) {
        map.set(groupKey, {
          ...item,
          dateStr,
          quantity: 0,
          subRowCount: 0,
          remarks: new Set<string>(),
          originalIds: [] as number[],
        });
      }

      const g = map.get(groupKey)!;
      g.quantity += Number(item.quantity || 0);
      g.subRowCount += 1;
      if (item.remark) g.remarks.add(item.remark);
      if (item.id) g.originalIds.push(item.id);
    }

    return Array.from(map.values()).map(g => ({
      ...g,
      remark: Array.from(g.remarks).filter(Boolean).join("; ")
    }));
  }, [items]);

  const exportSkuInboundExcel = () => {
    if (skuStats.length === 0) return toast.error("Không có dữ liệu để xuất");
    exportToExcel({
      filename: `Thong_Ke_SKU_Nhap_Kho_${selectedMonth || "All"}.xlsx`,
      sheetName: "SKU_Nhap_Kho",
      title: "BẢNG THỐNG KÊ NHẬP KHO THEO TỪNG MÃ SKU & SỐ LƯỢNG",
      subtitles: [
        `Kỳ báo cáo: Tháng ${selectedMonth} | Ngày: ${selectedDate}`,
        `Tổng số lượng nhập: +${totalQuantity.toLocaleString()} chiếc (${totalCount} phiếu)`
      ],
      data: skuStats,
      columns: [
        { header: "Mã SKU", key: "sku", width: 14 },
        { header: "Tên Sản Phẩm (Mô Tả)", key: "descr", width: 42 },
        { header: "Số Lượng Nhập (+)", key: "quantity", width: 18, format: v => Number(v).toLocaleString() },
        { header: "Số Lô / Phiếu", key: "count", width: 16, format: v => `${v} phiếu` },
        { header: "Tỷ Trọng (%)", key: "quantity", width: 16, format: v => totalQuantity > 0 ? `${((v / totalQuantity) * 100).toFixed(1)}%` : "0%" }
      ]
    });
    toast.success("Đã xuất file Excel thống kê SKU nhập kho!");
  };

  const exportInboundDetailsExcel = () => {
    if (groupedItems.length === 0) return toast.error("Không có dữ liệu để xuất");
    exportToExcel({
      filename: `Chi_Tiet_Phieu_Nhap_Kho_${selectedMonth || "All"}.xlsx`,
      sheetName: "Chi_Tiet_Nhap",
      title: "DANH SÁCH CHI TIẾT CÁC PHIẾU NHẬP KHO",
      subtitles: [
        `Kỳ báo cáo: Tháng ${selectedMonth} | Ngày: ${selectedDate}`,
        `Tổng số dòng đã gom: ${groupedItems.length} | Tổng SL: ${totalQuantity.toLocaleString()} chiếc`
      ],
      data: groupedItems,
      columns: [
        { header: "Ngày Nhập", key: "dateStr", width: 14, format: (v, r) => v || (r.date ? new Date(r.date).toISOString().split('T')[0] : "-") },
        { header: "Mã Đơn / PO", key: "orderCode", width: 18 },
        { header: "Mã SKU", key: "sku", width: 14 },
        { header: "Tên Sản Phẩm", key: "descr", width: 40 },
        { header: "Số Lượng Nhập (+)", key: "quantity", width: 18, format: v => Number(v).toLocaleString() },
        { header: "Ghi Chú / Lô / NCC", key: "remark", width: 35 },
        { header: "Người Tạo", key: "createdBy", width: 16 }
      ]
    });
    toast.success("Đã xuất file Excel chi tiết phiếu nhập kho!");
  };

  // Pagination based on grouped items
  const totalPages = Math.ceil(groupedItems.length / pageSize) || 1;
  const paginatedItems = groupedItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const updateRow = (index: number, field: string, value: string) => {
    const newRows = [...rows];
    newRows[index][field] = value;
    if (field === "sku") {
      const found = masterDataList.find(m => m.sku.toUpperCase() === value.toUpperCase());
      newRows[index].descr = found ? found.descr : "";
      newRows[index].sku = value.toUpperCase();
    }
    setRows(newRows);
  };

  const addRow = () => setRows([...rows, defaultRow()]);
  const removeRow = (index: number) => {
    if (rows.length === 1) setRows([defaultRow()]);
    else setRows(rows.filter((_, i) => i !== index));
  };

  const handleSaveManual = async () => {
    const validRows = rows.filter(r => r.sku && r.quantity && r.date);
    if (validRows.length === 0) {
      toast.error("Vui lòng điền đầy đủ Mã SKU, Số lượng và Ngày nhập.");
      return;
    }
    setSavingManual(true);
    try {
      const res = await fetch("/api/inbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: validRows })
      });
      if (res.ok) {
        toast.success("Tạo phiếu nhập kho thành công!");
        setShowManualModal(false);
        setRows([defaultRow()]);
        fetchInbound();
      } else {
        const err = await res.json();
        toast.error(err.error || "Lỗi khi lưu phiếu");
      }
    } catch (e) {
      toast.error("Lỗi kết nối");
    } finally {
      setSavingManual(false);
    }
  };

  const handlePrint = (item: any) => {
    const doc = new jsPDF();
    doc.text("PHIEU NHAP KHO (INBOUND RECEIPT)", 14, 15);
    doc.setFontSize(10);
    doc.text(`Ma Don / PO: ${item.orderCode}`, 14, 22);
    doc.text(`Ngay Nhap: ${new Date(item.date).toISOString().split('T')[0]}`, 14, 28);
    doc.text(`Account: ${item.account}`, 14, 34);

    const tableColumn = ["SKU", "Ten San Pham", "So Luong", "Trang Thai", "Ghi Chu"];
    const tableRows = [[
      item.sku,
      item.descr,
      item.quantity.toLocaleString(),
      item.status || "NORMAL",
      item.remark || "-"
    ]];

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] }
    });

    doc.save(`Inbound_${item.orderCode}.pdf`);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto animate-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <ArrowDownToLine className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">
              Quản Lý Nhập Kho (Inbound)
            </h1>
            <p className="text-slate-500 font-medium">
              Dashboard theo dõi số liệu nhập kho theo tháng, ngày và tạo phiếu nhập
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowManualModal(true)}
          className="flex items-center px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-2xl hover:shadow-lg hover:shadow-blue-500/30 transition-all active:scale-95 text-sm self-start md:self-auto"
        >
          <Plus className="w-4 h-4 mr-2" /> Tạo Phiếu Nhập Mới
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 mb-8">
        <div className="flex flex-wrap items-center gap-4">
          {/* Month selector */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Lọc Theo Tháng
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setSelectedDate("all");
              }}
              className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">Tất cả các tháng</option>
              {availableMonths.map((m: string) => (
                <option key={m} value={m}>Tháng {m}</option>
              ))}
            </select>
          </div>

          {/* Date selector */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Lọc Theo Ngày Cụ Thể
            </label>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">Tất cả các ngày</option>
              {availableDates
                .filter((d: string) => selectedMonth === "all" || d.startsWith(selectedMonth))
                .map((d: string) => (
                  <option key={d} value={d}>{d}</option>
                ))}
            </select>
          </div>

          {/* SKU selector */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Mã Sản Phẩm (SKU)
            </label>
            <select
              value={selectedSku}
              onChange={(e) => setSelectedSku(e.target.value)}
              className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">Tất cả SKU</option>
              {masterDataList.map((m: any) => (
                <option key={m.sku} value={m.sku}>{m.sku} - {m.descr}</option>
              ))}
            </select>
          </div>

          {/* Search box */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Tìm Kiếm (Mã Đơn, PO, Ghi chú)
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nhập PO, nhà cung cấp, lô..."
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-3xl border border-blue-100 shadow-[0_8px_30px_rgb(59,130,246,0.06)] relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-50 rounded-full" />
          <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Tổng Số Lượng Nhập</p>
          <h3 className="text-3xl font-black text-slate-800">
            {totalQuantity.toLocaleString()} <span className="text-sm font-semibold text-slate-400">chiếc</span>
          </h3>
          <p className="text-xs text-slate-500 mt-2 font-medium">Theo bộ lọc thời gian đã chọn</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Số Lô / Đơn Nhập</p>
          <h3 className="text-3xl font-black text-slate-800">
            {totalCount.toLocaleString()} <span className="text-sm font-semibold text-slate-400">phiếu</span>
          </h3>
          <p className="text-xs text-slate-500 mt-2 font-medium">Các đợt giao nhận hàng về kho</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Số Mặt Hàng SKU</p>
          <h3 className="text-3xl font-black text-emerald-600">
            {skuStats.length} <span className="text-sm font-semibold text-slate-400">mã sản phẩm</span>
          </h3>
          <p className="text-xs text-slate-500 mt-2 font-medium">Phát sinh nhập kho trong kỳ</p>
        </div>
      </div>

      {/* Charts & Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Daily Inbound Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-1">Tiến Độ Nhập Kho Theo Từng Ngày</h3>
          <p className="text-xs text-slate-500 mb-6">Biểu đồ thể hiện sản lượng nhập hàng về kho mỗi ngày</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyStats} margin={{ top: 25, right: 15, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.15)]} />
                <Tooltip
                  formatter={(val: any) => [`${Number(val).toLocaleString()} chiếc`, "Nhập Kho"]}
                  contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0" }}
                />
                <Bar dataKey="quantity" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={45}>
                  <LabelList 
                    dataKey="quantity" 
                    position="top" 
                    formatter={(val: any) => (val && Number(val) > 0 ? Number(val).toLocaleString() : "")}
                    style={{ fill: "#1e40af", fontSize: 11, fontWeight: 700 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Inbound SKUs */}
        <div className="bg-white p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-1">Cơ Cấu SKU Nhập Kho</h3>
          <p className="text-xs text-slate-500 mb-4">Các mặt hàng nhập nhiều nhất</p>
          <div className="space-y-3">
            {skuStats.map((item: any, idx: number) => {
              const percent = totalQuantity > 0 ? ((item.quantity / totalQuantity) * 100).toFixed(1) : 0;
              return (
                <div key={idx} className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-slate-800 text-xs">{item.sku}</span>
                    <span className="font-extrabold text-blue-600 text-xs">+{item.quantity.toLocaleString()} ({percent}%)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate" title={item.descr}>{item.descr}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* DEDICATED TABLE: TỔNG HỢP THEO SKU & SỐ LƯỢNG NHẬP */}
      <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden mb-8">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center">
              <Boxes className="w-5 h-5 mr-2 text-blue-600" />
              Bảng Thống Kê Nhập Kho Theo Từng Mã SKU & Số Lượng
            </h3>
            <p className="text-xs text-slate-500">Tổng hợp chi tiết số lượng nhập và số phiếu giao nhận theo từng mã hàng</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl">
              Tổng nhập: +{totalQuantity.toLocaleString()} chiếc
            </span>
            <button
              onClick={exportSkuInboundExcel}
              className="flex items-center px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all shadow-sm active:scale-95"
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
                <th className="py-3.5 px-6 text-right text-blue-600">Số Lượng Nhập (+)</th>
                <th className="py-3.5 px-6 text-right">Số Lô / Phiếu</th>
                <th className="py-3.5 px-6 text-right">Tỷ Trọng Nhập (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {skuStats.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Không có phát sinh nhập kho trong kỳ này.
                  </td>
                </tr>
              ) : (
                skuStats.map((item: any, idx: number) => {
                  const share = totalQuantity > 0 ? ((item.quantity / totalQuantity) * 100).toFixed(1) : 0;
                  return (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-6 font-bold text-slate-900">{item.sku}</td>
                      <td className="py-3.5 px-6 text-slate-600 max-w-md truncate" title={item.descr}>{item.descr}</td>
                      <td className="py-3.5 px-6 text-right font-black text-blue-600">+{item.quantity.toLocaleString()}</td>
                      <td className="py-3.5 px-6 text-right font-semibold text-slate-700">{item.count} phiếu</td>
                      <td className="py-3.5 px-6 text-right font-semibold text-slate-500">{share}%</td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {skuStats.length > 0 && (
              <tfoot>
                <tr className="bg-slate-900 text-white font-bold text-sm">
                  <td colSpan={2} className="py-3.5 px-6">TỔNG CỘNG TẤT CẢ SKU</td>
                  <td className="py-3.5 px-6 text-right font-black text-blue-300">+{totalQuantity.toLocaleString()}</td>
                  <td className="py-3.5 px-6 text-right text-slate-300">{totalCount} phiếu</td>
                  <td className="py-3.5 px-6 text-right text-slate-300">100%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Inbound Transactions Table */}
      <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">

          <div>
            <h3 className="text-lg font-bold text-slate-800">
              Danh Sách Chi Tiết Các Phiếu Nhập Kho (Gom Theo Ngày, PO & SKU)
            </h3>
            <p className="text-xs text-slate-500">
              Hiển thị {paginatedItems.length} trên tổng số {groupedItems.length} dòng đã gom (tổng hợp từ {items.length} bản ghi chi tiết)
            </p>
          </div>
          <button
            onClick={exportInboundDetailsExcel}
            className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all shadow-sm active:scale-95"
          >
            <FileDown className="w-3.5 h-3.5 mr-1.5" /> Xuất Excel Chi Tiết Nhập
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                <th className="py-4 px-6">Ngày Nhập</th>
                <th className="py-4 px-6">Mã Đơn / PO</th>
                <th className="py-4 px-6">Mã SKU</th>
                <th className="py-4 px-6">Tên Sản Phẩm</th>
                <th className="py-4 px-6 text-right">Tổng Số Lượng</th>
                <th className="py-4 px-6">Ghi Chú / Lô / NCC</th>
                <th className="py-4 px-6 text-center">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Không có phiếu nhập nào khớp với bộ lọc.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-6 font-semibold text-slate-700 whitespace-nowrap">
                      {item.dateStr || (item.date ? new Date(item.date).toISOString().split('T')[0] : "-")}
                    </td>
                    <td className="py-3.5 px-6 font-bold text-blue-700 whitespace-nowrap">
                      {item.orderCode}
                    </td>
                    <td className="py-3.5 px-6 font-bold text-slate-900 whitespace-nowrap">
                      {item.sku}
                    </td>
                    <td className="py-3.5 px-6 text-slate-600 max-w-xs truncate" title={item.descr}>
                      {item.descr}
                    </td>
                    <td className="py-3.5 px-6 text-right whitespace-nowrap">
                      <span className="font-black text-blue-600">
                        +{item.quantity.toLocaleString()}
                      </span>
                      {item.subRowCount > 1 && (
                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          Gom {item.subRowCount} dòng
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-6 text-slate-500 text-xs max-w-sm truncate" title={item.remark}>
                      {item.remark || "-"}
                    </td>
                    <td className="py-3.5 px-6 text-center">
                      <button
                        onClick={() => handlePrint(item)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                        title="In Phiếu Nhập"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">Trang {currentPage} / {totalPages}</span>
            <div className="flex gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40"
              >
                Trước
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Manual Entry Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-800">Tạo Phiếu Nhập Kho Thủ Công</h3>
              <button onClick={() => setShowManualModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
              {rows.map((row, idx) => (
                <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row gap-3 items-end">
                  <div className="w-full sm:w-36">
                    <label className="block text-xs font-bold text-slate-600 mb-1">Ngày Nhập</label>
                    <input
                      type="date"
                      value={row.date}
                      onChange={e => updateRow(idx, "date", e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium"
                    />
                  </div>
                  <div className="w-full sm:w-36">
                    <label className="block text-xs font-bold text-slate-600 mb-1">Mã SKU</label>
                    <input
                      type="text"
                      value={row.sku}
                      onChange={e => updateRow(idx, "sku", e.target.value)}
                      placeholder="Mã SKU"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase"
                    />
                  </div>
                  <div className="flex-1 w-full">
                    <label className="block text-xs font-bold text-slate-600 mb-1">Tên Sản Phẩm</label>
                    <input
                      type="text"
                      value={row.descr}
                      readOnly
                      placeholder="Tự động điền theo SKU"
                      className="w-full px-3 py-2 bg-slate-100 border-transparent rounded-xl text-xs text-slate-500"
                    />
                  </div>
                  <div className="w-full sm:w-28">
                    <label className="block text-xs font-bold text-slate-600 mb-1">Số Lượng</label>
                    <input
                      type="number"
                      min="1"
                      value={row.quantity}
                      onChange={e => updateRow(idx, "quantity", e.target.value)}
                      placeholder="SL"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-blue-600"
                    />
                  </div>
                  <button
                    onClick={() => removeRow(idx)}
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              <button
                onClick={addRow}
                className="w-full py-2.5 border border-dashed border-slate-300 hover:border-blue-500 text-blue-600 font-bold rounded-2xl text-xs transition-colors"
              >
                + Thêm dòng sản phẩm
              </button>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setShowManualModal(false)}
                className="px-5 py-2.5 text-slate-600 font-semibold hover:bg-slate-200 rounded-xl text-sm"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleSaveManual}
                disabled={savingManual}
                className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 text-sm disabled:opacity-50"
              >
                {savingManual ? "Đang lưu..." : "Xác Nhận Nhập Kho"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
