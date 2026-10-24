"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  PackageSearch, 
  Search, 
  AlertCircle, 
  Edit, 
  X, 
  Save, 
  Boxes, 
  PieChart as PieIcon, 
  Layers,
  ArrowUpRight,
  CheckCircle2,
  Tag,
  Filter,
  Calendar,
  FileDown
} from "lucide-react";
import { toast } from "sonner";
import { exportToExcel } from "@/lib/excelExport";
import { 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid,
  LabelList
} from "recharts";

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"];

export default function InventoryPage() {
  const [data, setData] = useState<any[]>([]);
  const [batchData, setBatchData] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [batchSearch, setBatchSearch] = useState("");
  const [batchSkuFilter, setBatchSkuFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  // Modal state for stock adjustments
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSku, setSelectedSku] = useState<any>(null);
  const [newQuantity, setNewQuantity] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [isAdjusting, setIsAdjusting] = useState(false);

  const fetchInventory = () => {
    setLoading(true);
    fetch("/api/inventory?batches=true")
      .then(res => res.json())
      .then(resData => {
        if (resData && resData.items) {
          setData(resData.items);
          setBatchData(resData.batches || []);
        } else if (Array.isArray(resData)) {
          setData(resData);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load inventory:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const totalStock = data.reduce((sum, item) => sum + item.quantity, 0);

  // Map SKU -> Total stock for percentage calculation in batch table
  const skuTotalMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of data) {
      map.set(item.sku, item.quantity);
    }
    return map;
  }, [data]);

  const filteredData = data.filter(item => 
    item.sku.toLowerCase().includes(search.toLowerCase()) || 
    item.descr?.toLowerCase().includes(search.toLowerCase()) ||
    item.account?.toLowerCase().includes(search.toLowerCase())
  );

  const pieChartData = data.map(item => ({
    name: item.sku,
    value: item.quantity,
    descr: item.descr
  }));

  // Unique SKUs present in batch data for the filter dropdown
  const uniqueBatchSkus = useMemo(() => {
    const set = new Set<string>();
    batchData.forEach(b => set.add(b.sku));
    return Array.from(set).sort();
  }, [batchData]);

  // Filtered batch rows
  const filteredBatches = useMemo(() => {
    return batchData.filter(b => {
      const matchSku = batchSkuFilter === "all" || b.sku === batchSkuFilter;
      const q = batchSearch.toLowerCase().trim();
      const matchSearch = !q || 
        b.sku.toLowerCase().includes(q) ||
        (b.descr && b.descr.toLowerCase().includes(q)) ||
        (b.batch && b.batch.toLowerCase().includes(q));
      return matchSku && matchSearch;
    });
  }, [batchData, batchSkuFilter, batchSearch]);

  const totalBatchStock = useMemo(() => {
    return filteredBatches.reduce((acc, cur) => acc + cur.quantity, 0);
  }, [filteredBatches]);

  const exportBatchExcel = () => {
    if (filteredBatches.length === 0) return toast.error("Không có dữ liệu để xuất");
    exportToExcel({
      filename: `Ton_Kho_Chi_Tiet_Theo_Lo_${new Date().toISOString().split("T")[0]}.xlsx`,
      sheetName: "Ton_Kho_Theo_Lo",
      title: "BẢNG CHI TIẾT TỒN KHO THEO TỪNG MÃ SKU & LÔ HÀNG (BATCH)",
      subtitles: [
        `Tổng số lô: ${filteredBatches.length} | Tổng số lượng: ${totalBatchStock.toLocaleString()} chiếc`,
        `Thời gian xuất: ${new Date().toLocaleString("vi-VN")}`
      ],
      data: filteredBatches,
      columns: [
        { header: "Mã SKU", key: "sku", width: 14 },
        { header: "Tên Sản Phẩm", key: "descr", width: 40 },
        { header: "Số Lô (Batch)", key: "batch", width: 18 },
        { header: "Số Lượng Tồn", key: "quantity", width: 16, format: v => Number(v).toLocaleString() },
        { header: "Tỷ Trọng Trong SKU (%)", key: "quantity", width: 20, format: (v, r) => {
          const total = skuTotalMap.get(r.sku) || 0;
          return total > 0 ? `${((v / total) * 100).toFixed(1)}%` : "0%";
        }},
        { header: "Hạn Dùng (EXP)", key: "expDate", width: 16, format: v => v || "Chưa rõ" }
      ]
    });
    toast.success("Đã xuất file Excel tồn kho theo lô thành công!");
  };

  const exportSkuSummaryExcel = () => {
    if (filteredData.length === 0) return toast.error("Không có dữ liệu để xuất");
    exportToExcel({
      filename: `Ton_Kho_Tong_Hop_SKU_${new Date().toISOString().split("T")[0]}.xlsx`,
      sheetName: "Ton_Kho_SKU",
      title: "BẢNG THỐNG KÊ TỔNG HỢP TỒN KHO THEO SKU",
      subtitles: [
        `Tổng tồn kho toàn bộ: ${totalStock.toLocaleString()} chiếc (${filteredData.length} mã SKU)`,
        `Thời gian xuất: ${new Date().toLocaleString("vi-VN")}`
      ],
      data: filteredData,
      columns: [
        { header: "Account", key: "account", width: 14 },
        { header: "Mã SKU", key: "sku", width: 14 },
        { header: "Tên Sản Phẩm (Mô Tả)", key: "descr", width: 42 },
        { header: "Số Lượng Tồn", key: "quantity", width: 18, format: v => Number(v).toLocaleString() },
        { header: "Tỷ Trọng (%)", key: "quantity", width: 16, format: v => totalStock > 0 ? `${((v / totalStock) * 100).toFixed(1)}%` : "0%" },
        { header: "Trạng Thái", key: "quantity", width: 16, format: v => v <= 1000 ? "Cần Bổ Sung" : "Sẵn Sàng" }
      ]
    });
    toast.success("Đã xuất file Excel tổng hợp tồn kho SKU thành công!");
  };

  const openEditModal = (item: any) => {
    setSelectedSku(item);
    setNewQuantity(item.quantity.toString());
    setAdjustReason("");
    setIsModalOpen(true);
  };

  const handleAdjust = async () => {
    if (!newQuantity || !adjustReason) {
      toast.error("Vui lòng nhập số lượng mới và lý do điều chỉnh.");
      return;
    }
    
    setIsAdjusting(true);
    try {
      const res = await fetch("/api/inventory/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: selectedSku.sku,
          account: selectedSku.account,
          descr: selectedSku.descr,
          oldQuantity: selectedSku.quantity,
          newQuantity: newQuantity,
          reason: adjustReason
        })
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchInventory();
        toast.success("Điều chỉnh tồn kho thành công!");
      } else {
        const err = await res.json();
        toast.error(err.error || "Không thể điều chỉnh tồn kho");
      }
    } catch (e) {
      toast.error("Lỗi khi điều chỉnh");
    } finally {
      setIsAdjusting(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto animate-in space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
            <PackageSearch className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">
              Báo Cáo Tồn Kho Thực Tế
            </h1>
            <p className="text-slate-500 font-medium">
              Số lượng tồn kho cập nhật theo thời gian thực của các sản phẩm Danone
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-emerald-100 shadow-[0_8px_30px_rgb(16,185,129,0.06)] relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-50 rounded-full" />
          <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Tổng Số Lượng Tồn Kho</p>
          <h3 className="text-3xl font-black text-slate-800">
            {totalStock.toLocaleString()} <span className="text-sm font-semibold text-slate-400">chiếc (EA)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-2 font-medium">Toàn bộ hàng trong kho hiện tại</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Số Mặt Hàng Đang Lưu Kho</p>
          <h3 className="text-3xl font-black text-slate-800">
            {data.length} <span className="text-sm font-semibold text-slate-400">mã SKU</span>
          </h3>
          <p className="text-xs text-slate-500 mt-2 font-medium">{batchData.length} Lô hàng (Batches) đang quản lý</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Mặt Hàng Tồn Lớn Nhất</p>
          <h3 className="text-3xl font-black text-emerald-600">
            {data.length > 0 ? [...data].sort((a, b) => b.quantity - a.quantity)[0]?.sku : "-"}
          </h3>
          <p className="text-xs text-slate-500 mt-2 font-medium truncate">
            {data.length > 0 ? [...data].sort((a, b) => b.quantity - a.quantity)[0]?.descr : ""}
          </p>
        </div>
      </div>

      {/* Visual Distribution Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Donut Chart */}
        <div className="bg-white p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-1">Tỷ Trọng Tồn Kho Theo SKU</h3>
          <p className="text-xs text-slate-500 mb-4">Cơ cấu số lượng sản phẩm lưu kho</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any) => [`${Number(value).toLocaleString()} chiếc`, "Tồn kho"]}
                  contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar Breakdown with Quantity Labels */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
          <div className="flex justify-between items-center mb-1">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Số Lượng Tồn Kho Từng Sản Phẩm</h3>
              <p className="text-xs text-slate-500">Số lượng hiển thị trực tiếp trên đầu mỗi cột</p>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl">
              Tổng: {totalStock.toLocaleString()} chiếc
            </span>
          </div>
          <div className="h-64 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pieChartData} margin={{ top: 25, right: 15, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.15)]} />
                <Tooltip
                  formatter={(val: any) => [`${Number(val).toLocaleString()} chiếc`, "Số lượng"]}
                  contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0" }}
                />
                <Bar dataKey="value" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={45}>
                  <LabelList 
                    dataKey="value" 
                    position="top" 
                    formatter={(val: any) => (val && Number(val) > 0 ? Number(val).toLocaleString() : "")}
                    style={{ fill: "#065f46", fontSize: 11, fontWeight: 700 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* NEW: DEDICATED BATCH-LEVEL DETAIL TABLE (YÊU CẦU CỦA USER) */}
      <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-indigo-50/70 via-slate-50 to-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-600/20">
                <Tag className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  Bảng Chi Tiết Tồn Kho Theo Từng Mã SKU & Lô Hàng (Batch)
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Cùng một mã SKU nhưng khác số Lô (Batch) được tách thành từng dòng riêng biệt, ghi rõ thông tin từng Batch
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            {/* Filter by SKU */}
            <div className="relative w-full sm:w-48">
              <select
                value={batchSkuFilter}
                onChange={(e) => setBatchSkuFilter(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition-all"
              >
                <option value="all">Tất Cả SKU ({batchData.length} lô)</option>
                {uniqueBatchSkus.map(sku => (
                  <option key={sku} value={sku}>SKU {sku}</option>
                ))}
              </select>
            </div>

            {/* Search Batch / SKU */}
            <div className="relative w-full sm:w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none w-full text-xs font-medium shadow-sm transition-all"
                placeholder="Tìm mã lô (Batch), SKU, tên..."
                value={batchSearch}
                onChange={(e) => setBatchSearch(e.target.value)}
              />
            </div>

            <button
              onClick={exportBatchExcel}
              className="flex items-center px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all shadow-sm active:scale-95 shrink-0"
            >
              <FileDown className="w-3.5 h-3.5 mr-1.5" /> Xuất Excel Theo Lô
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                <th className="py-4 px-6">Mã SKU</th>
                <th className="py-4 px-6">Tên Sản Phẩm (Mô Tả)</th>
                <th className="py-4 px-6">
                  <span className="inline-flex items-center text-indigo-700">
                    <Tag className="w-3.5 h-3.5 mr-1" />
                    Số Lô Hàng (Batch No)
                  </span>
                </th>
                <th className="py-4 px-6 text-right">Số Lượng Tồn</th>
                <th className="py-4 px-6 text-right">Tỷ Trọng Trong SKU (%)</th>
                <th className="py-4 px-6 text-center">Hạn Dùng (EXP)</th>
                <th className="py-4 px-6 text-center">Trạng Thái Lô</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Không tìm thấy lô hàng nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                filteredBatches.map((item, idx) => {
                  const skuTotal = skuTotalMap.get(item.sku) || item.quantity;
                  const shareOfSku = skuTotal > 0 ? ((item.quantity / skuTotal) * 100).toFixed(1) : 0;
                  return (
                    <tr key={idx} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="py-3.5 px-6 font-bold text-slate-900 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-xs font-mono font-bold">
                          {item.sku}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-slate-700 max-w-sm truncate" title={item.descr}>
                        {item.descr}
                      </td>
                      <td className="py-3.5 px-6 whitespace-nowrap">
                        <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-mono font-black bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm">
                          <Tag className="w-3 h-3 mr-1.5 text-indigo-500" />
                          Batch: {item.batch}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-right whitespace-nowrap">
                        <span className="text-base font-black text-slate-900">
                          {item.quantity.toLocaleString()}
                        </span>
                        <span className="text-[11px] text-slate-400 ml-1 font-semibold">chiếc</span>
                      </td>
                      <td className="py-3.5 px-6 text-right text-indigo-600 font-bold whitespace-nowrap">
                        {shareOfSku}%
                      </td>
                      <td className="py-3.5 px-6 text-center text-slate-600 text-xs font-semibold whitespace-nowrap">
                        {item.expDate ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            <Calendar className="w-3 h-3 mr-1 text-slate-400" />
                            {item.expDate}
                          </span>
                        ) : (
                          <span className="text-slate-400">Theo Date Lô</span>
                        )}
                      </td>
                      <td className="py-3.5 px-6 text-center whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-500" /> Sẵn Sàng Xuất
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredBatches.length > 0 && (
              <tfoot>
                <tr className="bg-slate-900 text-white font-bold text-sm">
                  <td colSpan={3} className="py-4 px-6">
                    TỔNG CỘNG ({filteredBatches.length} LÔ HÀNG ĐANG HIỂN THỊ)
                  </td>
                  <td className="py-4 px-6 text-right font-black text-emerald-300">
                    {totalBatchStock.toLocaleString()} chiếc
                  </td>
                  <td colSpan={3} className="py-4 px-6 text-right text-slate-400 text-xs">
                    Chiếm {totalStock > 0 ? ((totalBatchStock / totalStock) * 100).toFixed(1) : 0}% tổng kho
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Summary Inventory Table by SKU */}
      <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Bảng Thống Kê Tổng Hợp Tồn Kho Theo SKU</h2>
            <p className="text-xs text-slate-500 font-medium">Hiện có {filteredData.length} mã sản phẩm chính</p>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none w-full text-sm font-medium shadow-sm transition-all"
                placeholder="Tìm theo SKU hoặc tên..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <button
              onClick={exportSkuSummaryExcel}
              className="flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-sm active:scale-95 shrink-0"
            >
              <FileDown className="w-3.5 h-3.5 mr-1.5" /> Xuất Excel SKU
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                <th className="py-4 px-6">Account</th>
                <th className="py-4 px-6">Mã SKU</th>
                <th className="py-4 px-6">Tên Sản Phẩm (Mô Tả)</th>
                <th className="py-4 px-6 text-right">Số Lượng Tồn</th>
                <th className="py-4 px-6 text-right">Tỷ Trọng (%)</th>
                <th className="py-4 px-6 text-center">Trạng Thái</th>
                <th className="py-4 px-6 text-center">Điều Chỉnh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Không tìm thấy sản phẩm nào trong kho.
                  </td>
                </tr>
              ) : (
                filteredData.map((item, idx) => {
                  const share = totalStock > 0 ? ((item.quantity / totalStock) * 100).toFixed(1) : 0;
                  return (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-4 px-6 text-slate-500 text-xs">{item.account}</td>
                      <td className="py-4 px-6 font-bold text-slate-900">{item.sku}</td>
                      <td className="py-4 px-6 text-slate-700 max-w-md truncate" title={item.descr}>
                        {item.descr}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <span className="text-base font-black text-slate-900">
                          {item.quantity.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right text-slate-500 font-semibold">
                        {share}%
                      </td>
                      <td className="py-4 px-6 text-center">
                        {item.quantity <= 1000 ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            Cần Bổ Sung
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Sẵn Sàng
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <button
                          onClick={() => openEditModal(item)}
                          className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"
                          title="Điều chỉnh số lượng kho"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {isModalOpen && selectedSku && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-800">Điều Chỉnh Tồn Kho</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Mặt Hàng</label>
                <div className="text-base font-bold text-slate-900">{selectedSku.sku}</div>
                <div className="text-xs text-slate-500 truncate">{selectedSku.descr}</div>
              </div>
              
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-500 mb-1">Tồn Hiện Tại</label>
                  <input type="text" readOnly value={selectedSku.quantity.toLocaleString()} className="w-full px-4 py-2.5 bg-slate-100 rounded-xl text-slate-500 font-bold outline-none" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tồn Mới (*)</label>
                  <input type="number" value={newQuantity} onChange={e => setNewQuantity(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-bold text-slate-900 outline-none" placeholder="0" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Lý Do Điều Chỉnh (*)</label>
                <textarea 
                  value={adjustReason} 
                  onChange={e => setAdjustReason(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none text-sm" 
                  rows={3}
                  placeholder="Kiểm kê thực tế, hàng hỏng, điều chuyển..."
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-slate-600 font-semibold hover:bg-slate-200 rounded-xl text-sm">
                Hủy Bỏ
              </button>
              <button onClick={handleAdjust} disabled={isAdjusting || !newQuantity || !adjustReason} className="flex items-center px-5 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 text-sm disabled:opacity-50">
                {isAdjusting ? "Đang lưu..." : <><Save className="w-4 h-4 mr-2" /> Lưu Thay Đổi</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
