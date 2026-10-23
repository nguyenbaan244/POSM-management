"use client";

import { useState, useEffect } from "react";
import { 
  ArrowUpFromLine, 
  Calendar, 
  Plus, 
  Search, 
  Printer, 
  Boxes, 
  FileText, 
  TrendingDown,
  Package,
  Save,
  Trash2,
  X
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";

export default function OutboundPage() {
  const [selectedMonth, setSelectedMonth] = useState<string>("2026-10");
  const [selectedDate, setSelectedDate] = useState<string>("all");
  const [selectedSku, setSelectedSku] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [outboundData, setOutboundData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Manual Dispatch Modal
  const [showManualModal, setShowManualModal] = useState(false);
  const [masterDataList, setMasterDataList] = useState<any[]>([]);
  const [inventoryList, setInventoryList] = useState<any[]>([]);

  const defaultRow = () => ({
    date: new Date().toISOString().split('T')[0],
    account: "Danone",
    sku: "",
    descr: "",
    quantity: "",
    status: "NORM",
    remark: "",
  });

  const [rows, setRows] = useState<any[]>([defaultRow()]);
  const [savingManual, setSavingManual] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const fetchOutbound = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedMonth && selectedMonth !== "all") params.append("month", selectedMonth);
    if (selectedDate && selectedDate !== "all") params.append("date", selectedDate);
    if (selectedSku && selectedSku !== "all") params.append("sku", selectedSku);
    if (search) params.append("search", search);

    fetch(`/api/outbound?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        setOutboundData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load outbound data:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchOutbound();
  }, [selectedMonth, selectedDate, selectedSku, search]);

  useEffect(() => {
    fetch("/api/master-data").then(res => res.json()).then(setMasterDataList).catch(console.error);
    fetch("/api/inventory").then(res => res.json()).then(setInventoryList).catch(console.error);
  }, []);

  const items = outboundData?.items || [];
  const totalQuantity = outboundData?.totalQuantity || 0;
  const totalCount = outboundData?.totalCount || 0;
  const dailyStats = outboundData?.dailyStats || [];
  const skuStats = outboundData?.skuStats || [];
  const availableDates = outboundData?.availableDates || [];
  const availableMonths = outboundData?.availableMonths || [];

  // Pagination
  const totalPages = Math.ceil(items.length / pageSize) || 1;
  const paginatedItems = items.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const updateRow = (index: number, field: string, value: string) => {
    const newRows = [...rows];
    newRows[index][field] = value;
    if (field === "sku") {
      const foundMaster = masterDataList.find(m => m.sku.toUpperCase() === value.toUpperCase());
      newRows[index].descr = foundMaster ? foundMaster.descr : "";
      newRows[index].sku = value.toUpperCase();

      const foundInv = inventoryList.find(i => i.sku.toUpperCase() === value.toUpperCase());
      newRows[index].availableQty = foundInv ? foundInv.quantity : 0;
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
      toast.error("Vui lòng điền đầy đủ Mã SKU, Số lượng và Ngày xuất.");
      return;
    }
    setSavingManual(true);
    try {
      const res = await fetch("/api/outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: validRows })
      });
      if (res.ok) {
        toast.success("Tạo phiếu xuất kho thành công!");
        setShowManualModal(false);
        setRows([defaultRow()]);
        fetchOutbound();
      } else {
        const err = await res.json();
        toast.error(err.error || "Lỗi khi lưu phiếu xuất");
      }
    } catch (e) {
      toast.error("Lỗi kết nối");
    } finally {
      setSavingManual(false);
    }
  };

  const handlePrint = (item: any) => {
    const doc = new jsPDF();
    doc.text("PHIEU XUAT KHO (OUTBOUND DELIVERY NOTE)", 14, 15);
    doc.setFontSize(10);
    doc.text(`Ma Don / SO: ${item.orderCode}`, 14, 22);
    doc.text(`Ngay Xuat: ${new Date(item.date).toISOString().split('T')[0]}`, 14, 28);
    doc.text(`Account: ${item.account}`, 14, 34);

    const tableColumn = ["SKU", "Ten San Pham", "So Luong Xuat", "Trang Thai", "Ghi Chu / Khach Hang"];
    const tableRows = [[
      item.sku,
      item.descr,
      item.quantity.toLocaleString(),
      item.status || "NORM",
      item.remark || "-"
    ]];

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: 'grid',
      headStyles: { fillColor: [249, 115, 22] }
    });

    doc.save(`Outbound_${item.orderCode}.pdf`);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto animate-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-3xl bg-gradient-to-tr from-orange-500 to-rose-600 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
            <ArrowUpFromLine className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">
              Quản Lý Xuất Kho (Outbound)
            </h1>
            <p className="text-slate-500 font-medium">
              Dashboard theo dõi số liệu xuất kho theo tháng, ngày và tạo phiếu xuất
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowManualModal(true)}
          className="flex items-center px-5 py-2.5 bg-gradient-to-r from-orange-500 to-rose-600 text-white font-bold rounded-2xl hover:shadow-lg hover:shadow-orange-500/30 transition-all active:scale-95 text-sm self-start md:self-auto"
        >
          <Plus className="w-4 h-4 mr-2" /> Tạo Phiếu Xuất Mới
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
              className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
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
              className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
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
              className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
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
              Tìm Kiếm (SO, Khách Hàng, PO)
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nhập Sale Order, khách hàng, lô..."
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-3xl border border-orange-100 shadow-[0_8px_30px_rgb(249,115,22,0.06)] relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-orange-50 rounded-full" />
          <p className="text-xs font-bold text-orange-600 uppercase tracking-wider mb-1">Tổng Số Lượng Xuất</p>
          <h3 className="text-3xl font-black text-slate-800">
            {totalQuantity.toLocaleString()} <span className="text-sm font-semibold text-slate-400">chiếc</span>
          </h3>
          <p className="text-xs text-slate-500 mt-2 font-medium">Theo bộ lọc thời gian đã chọn</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Số Chuyến / Đơn Xuất</p>
          <h3 className="text-3xl font-black text-slate-800">
            {totalCount.toLocaleString()} <span className="text-sm font-semibold text-slate-400">phiếu</span>
          </h3>
          <p className="text-xs text-slate-500 mt-2 font-medium">Các đợt xuất giao tới khách hàng</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Số Mặt Hàng SKU</p>
          <h3 className="text-3xl font-black text-orange-600">
            {skuStats.length} <span className="text-sm font-semibold text-slate-400">mã sản phẩm</span>
          </h3>
          <p className="text-xs text-slate-500 mt-2 font-medium">Phát sinh xuất hàng trong kỳ</p>
        </div>
      </div>

      {/* Charts & Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Daily Outbound Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-1">Tiến Độ Xuất Kho Theo Từng Ngày</h3>
          <p className="text-xs text-slate-500 mb-6">Biểu đồ thể hiện sản lượng xuất hàng mỗi ngày</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyStats}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip
                  formatter={(val: any) => [`${Number(val).toLocaleString()} chiếc`, "Xuất Kho"]}
                  contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0" }}
                />
                <Bar dataKey="quantity" fill="#f97316" radius={[6, 6, 0, 0]} maxBarSize={45} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Outbound SKUs */}
        <div className="bg-white p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-1">Cơ Cấu SKU Xuất Kho</h3>
          <p className="text-xs text-slate-500 mb-4">Các mặt hàng xuất nhiều nhất</p>
          <div className="space-y-3">
            {skuStats.map((item: any, idx: number) => {
              const percent = totalQuantity > 0 ? ((item.quantity / totalQuantity) * 100).toFixed(1) : 0;
              return (
                <div key={idx} className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-slate-800 text-xs">{item.sku}</span>
                    <span className="font-extrabold text-orange-600 text-xs">-{item.quantity.toLocaleString()} ({percent}%)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate" title={item.descr}>{item.descr}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Outbound Transactions Table */}
      <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Danh Sách Chi Tiết Các Phiếu Xuất Kho</h3>
            <p className="text-xs text-slate-500">Hiển thị {paginatedItems.length} trên tổng số {items.length} bản ghi</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                <th className="py-4 px-6">Ngày Xuất</th>
                <th className="py-4 px-6">Mã Đơn / SO</th>
                <th className="py-4 px-6">Mã SKU</th>
                <th className="py-4 px-6">Tên Sản Phẩm</th>
                <th className="py-4 px-6 text-right">Số Lượng</th>
                <th className="py-4 px-6">Khách Hàng / Lô / Địa Chỉ</th>
                <th className="py-4 px-6 text-center">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Không có phiếu xuất nào khớp với bộ lọc.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-6 font-semibold text-slate-700 whitespace-nowrap">
                      {new Date(item.date).toISOString().split('T')[0]}
                    </td>
                    <td className="py-3.5 px-6 font-bold text-orange-700 whitespace-nowrap">
                      {item.orderCode}
                    </td>
                    <td className="py-3.5 px-6 font-bold text-slate-900 whitespace-nowrap">
                      {item.sku}
                    </td>
                    <td className="py-3.5 px-6 text-slate-600 max-w-xs truncate" title={item.descr}>
                      {item.descr}
                    </td>
                    <td className="py-3.5 px-6 text-right font-black text-orange-600">
                      -{item.quantity.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-6 text-slate-500 text-xs max-w-sm truncate" title={item.remark}>
                      {item.remark || "-"}
                    </td>
                    <td className="py-3.5 px-6 text-center">
                      <button
                        onClick={() => handlePrint(item)}
                        className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-colors"
                        title="In Phiếu Xuất"
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
              <h3 className="text-xl font-bold text-slate-800">Tạo Phiếu Xuất Kho Thủ Công</h3>
              <button onClick={() => setShowManualModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
              {rows.map((row, idx) => (
                <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row gap-3 items-end">
                  <div className="w-full sm:w-36">
                    <label className="block text-xs font-bold text-slate-600 mb-1">Ngày Xuất</label>
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
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-orange-600"
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
                className="w-full py-2.5 border border-dashed border-slate-300 hover:border-orange-500 text-orange-600 font-bold rounded-2xl text-xs transition-colors"
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
                className="px-6 py-2.5 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 text-sm disabled:opacity-50"
              >
                {savingManual ? "Đang lưu..." : "Xác Nhận Xuất Kho"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
