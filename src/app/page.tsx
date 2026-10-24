"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { 
  UploadCloud, 
  FileSpreadsheet, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  PackageSearch, 
  Archive, 
  CheckCircle2, 
  AlertTriangle, 
  Download, 
  RefreshCw, 
  FolderUp, 
  Info,
  Calendar,
  Scale,
  ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import * as xlsx from "xlsx";

type UploadFormat = "inbound" | "outbound" | "inventory" | "baseline-inventory";

export default function UploadDataPage() {
  const [selectedFormat, setSelectedFormat] = useState<UploadFormat>("inbound");
  const [snapshotDate, setSnapshotDate] = useState<string>("");
  const [baselineDate, setBaselineDate] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  const [totalRowsCount, setTotalRowsCount] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any | null>(null);
  const [currentInventory, setCurrentInventory] = useState<any[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchCurrentInventory = () => {
    fetch("/api/inventory")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setCurrentInventory(data);
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchCurrentInventory();
  }, []);

  const formatConfig: Record<UploadFormat, {
    title: string;
    subtitle: string;
    color: string;
    badgeColor: string;
    icon: any;
    columns: string[];
    description: string;
    badge?: string;
  }> = {
    "inbound": {
      title: "Nhập Kho (Inbound)",
      subtitle: "Dữ liệu hàng nhập kho, số PO, nhà cung cấp, lô sản xuất",
      color: "from-blue-600 to-indigo-600",
      badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
      icon: ArrowDownToLine,
      columns: ["PO Number", "ReceiptKey", "Date Received", "Sku", "DESCR", "Qty Piece", "Supplier", "Batch"],
      description: "Tự động đối soát dữ liệu với database: Giao dịch đã có sẽ tự động bỏ qua, chỉ ghi thêm các dòng nhập mới."
    },
    "outbound": {
      title: "Xuất Kho (Outbound)",
      subtitle: "Dữ liệu hàng xuất kho, đơn hàng, khách hàng, số lượng xuất",
      color: "from-orange-500 to-rose-600",
      badgeColor: "bg-orange-50 text-orange-700 border-orange-200",
      icon: ArrowUpFromLine,
      columns: ["ShipDate", "Sale Order #", "Customer PO", "Sku", "Description", "Total Qty Pcs", "Batch", "Remark"],
      description: "Tự động đối soát dữ liệu với database: Giao dịch đã có sẽ tự động bỏ qua, chỉ ghi thêm các dòng xuất mới."
    },
    "inventory": {
      title: "Tồn Kho Mới Nhất (Inventory)",
      subtitle: "Kiểm kê tồn kho thực tế mới nhất (Không bắt buộc upload)",
      color: "from-emerald-500 to-teal-600",
      badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
      badge: "Không bắt buộc",
      icon: PackageSearch,
      columns: ["Sku", "DESCR", "Qty", "Loc", "BatchNo"],
      description: "Hệ thống tự động tính toán tồn kho theo lịch sử. Nếu bạn upload tồn kho mới, hệ thống sẽ kiểm tra khớp lệnh lịch sử."
    },
    "baseline-inventory": {
      title: "Tồn Kho Cũ (Baseline / Đầu Kỳ)",
      subtitle: "Dữ liệu tồn kho ban đầu làm căn cứ tính toán NXT và đối soát",
      color: "from-purple-600 to-indigo-600",
      badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
      badge: "Mốc Đầu Kỳ",
      icon: Archive,
      columns: ["Sku", "DESCR", "Qty", "BatchNo", "Loc"],
      description: "Thay thế danh mục SKU: Thiết lập số lượng tồn kho ban đầu theo ngày để tính toán NXT và Check lệch tồn."
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    processSelectedFile(selectedFile);
  };

  const processSelectedFile = (selectedFile: File) => {
    setFile(selectedFile);
    setUploadResult(null);

    const name = selectedFile.name;
    // Auto-detect date from filename (e.g. "22.10.2026", "23.10", "2026-10-22")
    const dmy = name.match(/(\d{1,2})[\.\/\-](\d{1,2})(?:[\.\/\-](\d{4}))?/);
    if (dmy) {
      const day = dmy[1].padStart(2, "0");
      const month = dmy[2].padStart(2, "0");
      const year = dmy[3] || "2026";
      const detectedDate = `${year}-${month}-${day}`;
      if (selectedFormat === "inventory") {
        setSnapshotDate(detectedDate);
      } else if (selectedFormat === "baseline-inventory") {
        setBaselineDate(detectedDate);
      }
    }

    // Auto-detect format from filename if obvious
    const lowerName = name.toLowerCase();
    if (lowerName.includes("inbound") && selectedFormat !== "inbound") {
      setSelectedFormat("inbound");
    } else if (lowerName.includes("outbound") && selectedFormat !== "outbound") {
      setSelectedFormat("outbound");
    } else if ((lowerName.includes("hôm nay") || lowerName.includes("test") || lowerName.includes("mới")) && lowerName.includes("inventory")) {
      setSelectedFormat("inventory");
      if (dmy) {
        const day = dmy[1].padStart(2, "0");
        const month = dmy[2].padStart(2, "0");
        const year = dmy[3] || "2026";
        setSnapshotDate(`${year}-${month}-${day}`);
      }
    } else if ((lowerName.includes("hôm qua") || lowerName.includes("qua") || lowerName.includes("baseline") || lowerName.includes("đầu kỳ")) && lowerName.includes("inventory")) {
      setSelectedFormat("baseline-inventory");
      if (dmy) {
        const day = dmy[1].padStart(2, "0");
        const month = dmy[2].padStart(2, "0");
        const year = dmy[3] || "2026";
        setBaselineDate(`${year}-${month}-${day}`);
      }
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = xlsx.read(data, { type: "binary" });
        const firstSheet = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheet];
        const rows: any[] = xlsx.utils.sheet_to_json(sheet);

        setTotalRowsCount(rows.length);
        if (rows.length > 0) {
          setDetectedColumns(Object.keys(rows[0]));
          setPreviewRows(rows.slice(0, 5));
        } else {
          setDetectedColumns([]);
          setPreviewRows([]);
        }
        toast.info(`Đã đọc ${rows.length} dòng từ file ${selectedFile.name}`);
      } catch (err) {
        console.error("Error parsing file:", err);
        toast.error("Không thể đọc định dạng file. Hãy kiểm tra lại file Excel (.xlsx, .xls) hoặc CSV.");
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Vui lòng chọn một file Excel hoặc CSV trước khi tải lên.");
      return;
    }

    if (selectedFormat === "inventory" && (!snapshotDate || snapshotDate.trim() === "")) {
      toast.error("Bắt buộc phải chọn Ngày chốt tồn kho mới trước khi tải lên!");
      return;
    }

    if (selectedFormat === "baseline-inventory" && (!baselineDate || baselineDate.trim() === "")) {
      toast.error("Bắt buộc phải chọn Ngày chốt tồn kho cũ trước khi tải lên!");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("format", selectedFormat);
    
    if (selectedFormat === "inventory") {
      formData.append("snapshotDate", snapshotDate);
    } else if (selectedFormat === "baseline-inventory") {
      formData.append("snapshotDate", baselineDate);
    }

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setUploadResult(data);
        fetchCurrentInventory();
        if (data.isMatched === false) {
          toast.warning("Dữ liệu tồn kho tải lên có sự chênh lệch so với lịch sử tính toán!");
        } else {
          toast.success(data.message || "Tải lên và xử lý dữ liệu thành công!");
        }
        // Reset file selection
        setFile(null);
        setPreviewRows([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        toast.error(data.error || "Có lỗi xảy ra khi tải lên dữ liệu");
      }
    } catch (err) {
      toast.error("Lỗi kết nối máy chủ");
    } finally {
      setIsUploading(false);
    }
  };

  const currentConfig = formatConfig[selectedFormat];
  const CurrentIcon = currentConfig.icon;

  return (
    <div className="p-8 max-w-7xl mx-auto animate-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
            <UploadCloud className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">
              Trung Tâm Tải Lên Dữ Liệu
            </h1>
            <p className="text-slate-500 font-medium">
              Đối soát tự động Nhập Kho, Xuất Kho, Tồn Kho Cũ (Đầu Kỳ) & Tồn Kho Mới Nhất
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Link
            href="/check-lech-ton"
            className="flex items-center px-4 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-2xl hover:bg-slate-50 transition-all shadow-sm active:scale-95 text-sm"
          >
            <Scale className="w-4 h-4 mr-2 text-emerald-600" />
            Xem Check Lệch Tồn
          </Link>
        </div>
      </div>

      {/* Format Selector Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {(Object.keys(formatConfig) as UploadFormat[]).map((fmt) => {
          const cfg = formatConfig[fmt];
          const IconComponent = cfg.icon;
          const isSelected = selectedFormat === fmt;

          return (
            <div
              key={fmt}
              onClick={() => {
                setSelectedFormat(fmt);
                setUploadResult(null);
              }}
              className={`p-5 rounded-3xl cursor-pointer transition-all duration-300 relative overflow-hidden border ${
                isSelected
                  ? "bg-white border-emerald-500 ring-2 ring-emerald-500/20 shadow-xl shadow-emerald-900/5 -translate-y-1"
                  : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-md"
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md bg-gradient-to-br ${cfg.color}`}
                >
                  <IconComponent className="w-6 h-6" />
                </div>
                {cfg.badge && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    {cfg.badge}
                  </span>
                )}
                {isSelected && (
                  <span className="flex items-center text-xs font-bold px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Đang chọn
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-slate-800 mb-1">{cfg.title}</h3>
              <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{cfg.subtitle}</p>
            </div>
          );
        })}
      </div>

      {/* Main Upload Box */}
      <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden mb-8">
        {/* Top Info Bar */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${currentConfig.color} flex items-center justify-center text-white`}>
              <CurrentIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">{currentConfig.title}</h2>
              <p className="text-xs text-slate-500">{currentConfig.description}</p>
            </div>
          </div>

          {/* Date Picker Requirement for Inventory and Baseline */}
          {selectedFormat === "inventory" && (
            <div className={`flex items-center px-4 py-2.5 rounded-2xl border transition-all ${
              !snapshotDate 
                ? "bg-rose-50/90 border-rose-300 ring-2 ring-rose-200" 
                : "bg-emerald-50/80 border-emerald-300 shadow-sm"
            }`}>
              <Calendar className={`w-5 h-5 mr-3 shrink-0 ${!snapshotDate ? "text-rose-600 animate-pulse" : "text-emerald-600"}`} />
              <div className="text-xs">
                <span className="font-bold flex items-center">
                  <span className="text-slate-900">Ngày chốt tồn kho mới:</span>
                  <span className={`ml-2 text-[10px] font-black px-1.5 py-0.5 rounded ${
                    !snapshotDate ? "bg-rose-200 text-rose-800" : "bg-emerald-200 text-emerald-800"
                  }`}>
                    * BẮT BUỘC CHỌN
                  </span>
                </span>
                <input
                  type="date"
                  value={snapshotDate}
                  onChange={(e) => setSnapshotDate(e.target.value)}
                  required
                  className="mt-1 font-bold text-slate-900 text-sm outline-none bg-transparent cursor-pointer block"
                />
              </div>
            </div>
          )}

          {selectedFormat === "baseline-inventory" && (
            <div className={`flex items-center px-4 py-2.5 rounded-2xl border transition-all ${
              !baselineDate 
                ? "bg-rose-50/90 border-rose-300 ring-2 ring-rose-200" 
                : "bg-purple-50/80 border-purple-300 shadow-sm"
            }`}>
              <Calendar className={`w-5 h-5 mr-3 shrink-0 ${!baselineDate ? "text-rose-600 animate-pulse" : "text-purple-600"}`} />
              <div className="text-xs">
                <span className="font-bold flex items-center">
                  <span className="text-slate-900">Ngày chốt tồn kho cũ:</span>
                  <span className={`ml-2 text-[10px] font-black px-1.5 py-0.5 rounded ${
                    !baselineDate ? "bg-rose-200 text-rose-800" : "bg-purple-200 text-purple-800"
                  }`}>
                    * BẮT BUỘC CHỌN
                  </span>
                </span>
                <input
                  type="date"
                  value={baselineDate}
                  onChange={(e) => setBaselineDate(e.target.value)}
                  required
                  className="mt-1 font-bold text-slate-900 text-sm outline-none bg-transparent cursor-pointer block"
                />
              </div>
            </div>
          )}

          {(selectedFormat === "inbound" || selectedFormat === "outbound") && (
            <div className="flex items-center bg-emerald-50/80 px-4 py-2 rounded-2xl border border-emerald-200 text-xs text-emerald-800 font-semibold">
              <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-600 shrink-0" />
              Tự động lọc trùng • Không ghi đè dữ liệu cũ
            </div>
          )}
        </div>

        {/* Drop Zone */}
        <div className="p-8">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/20 rounded-3xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 text-center group"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />

            <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 mb-4 group-hover:scale-110 transition-transform shadow-inner">
              <FolderUp className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-bold text-slate-800 mb-1">
              Kéo thả file Excel vào đây hoặc <span className="text-emerald-600 underline">bấm để chọn file</span>
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              Hỗ trợ định dạng Microsoft Excel (.xlsx, .xls) hoặc CSV
            </p>

            <div className="flex flex-wrap gap-2 justify-center max-w-xl">
              <span className="text-xs font-semibold text-slate-400">Các cột khuyến nghị:</span>
              {currentConfig.columns.map((col, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded-lg border border-slate-200"
                >
                  {col}
                </span>
              ))}
            </div>
          </div>

          {/* Smart Notice */}
          <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start space-x-3 text-xs text-slate-700">
            <Info className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-900">
                {selectedFormat === "inbound" && "Quy tắc Nhập Kho:"}
                {selectedFormat === "outbound" && "Quy tắc Xuất Kho:"}
                {selectedFormat === "inventory" && "Quy tắc Tồn Kho Mới Nhất (Tùy chọn):"}
                {selectedFormat === "baseline-inventory" && "Quy tắc Tồn Kho Cũ (Đầu Kỳ):"}
              </p>
              <p className="text-slate-600 mt-0.5">
                {selectedFormat === "inbound" &&
                  "Hệ thống sẽ đối chiếu với database: Những giao dịch đã có sẵn sẽ được bỏ qua, chỉ ghi thêm các dòng nhập mới. Tồn kho tự động tăng tương ứng."}
                {selectedFormat === "outbound" &&
                  "Hệ thống sẽ đối chiếu với database: Những giao dịch đã có sẵn sẽ được bỏ qua, chỉ ghi thêm các dòng xuất mới. Tồn kho tự động trừ tương ứng."}
                {selectedFormat === "inventory" &&
                  "Bạn không bắt buộc phải upload tồn kho vì hệ thống đã tự động tính toán từ nhập/xuất và tồn cũ. Nếu bạn upload tồn kho mới, hệ thống sẽ đối soát xem có khớp với lịch sử hay không và báo chi tiết nếu có lệch."}
                {selectedFormat === "baseline-inventory" &&
                  "Thay thế nút Danh mục SKU: Upload dữ liệu tồn kho cũ tại ngày bạn chọn để thiết lập số dư ban đầu, làm căn cứ tính toán xuất nhập tồn toàn hệ thống."}
              </p>
            </div>
          </div>

          {/* File Selected Preview */}
          {file && (
            <div className="mt-6 p-6 rounded-2xl bg-slate-50 border border-slate-200 animate-in fade-in">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-base">{file.name}</h4>
                    <p className="text-xs text-slate-500">
                      {(file.size / 1024).toFixed(1)} KB • Phát hiện {totalRowsCount.toLocaleString()} dòng dữ liệu
                    </p>
                  </div>
                </div>

                {((selectedFormat === "inventory" && !snapshotDate) ||
                  (selectedFormat === "baseline-inventory" && !baselineDate)) && (
                  <div className="w-full sm:w-auto flex items-center px-3.5 py-2 bg-rose-50 border border-rose-300 rounded-xl text-xs font-bold text-rose-700 animate-pulse">
                    <AlertTriangle className="w-4 h-4 mr-2 text-rose-600 shrink-0" />
                    Chưa chọn ngày chốt tồn ở khung trên!
                  </div>
                )}

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      setPreviewRows([]);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
                  >
                    Hủy chọn
                  </button>
                  <button
                    type="button"
                    onClick={handleUpload}
                    disabled={
                      isUploading ||
                      (selectedFormat === "inventory" && !snapshotDate) ||
                      (selectedFormat === "baseline-inventory" && !baselineDate)
                    }
                    className="flex-1 sm:flex-initial flex items-center justify-center px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-emerald-500/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {isUploading ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Đang đối soát & xử lý...
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-4 h-4 mr-2" />
                        Bắt Đầu Tải Lên & Đối Soát
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Preview Table */}
              {previewRows.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                    Xem trước 5 dòng đầu tiên:
                  </p>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-600 border-b border-slate-200">
                          {detectedColumns.map((col, idx) => (
                            <th key={idx} className="py-2.5 px-3 font-semibold whitespace-nowrap">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {previewRows.map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-slate-50">
                            {detectedColumns.map((col, cIdx) => (
                              <td key={cIdx} className="py-2 px-3 whitespace-nowrap max-w-xs truncate">
                                {String(row[col] ?? "-")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Success / Discrepancy Banner */}
          {uploadResult && (
            <div
              className={`mt-6 p-6 rounded-3xl border transition-all animate-in fade-in duration-300 ${
                uploadResult.isMatched === false
                  ? "bg-rose-50/70 border-rose-300 text-rose-950 shadow-lg shadow-rose-900/5"
                  : uploadResult.isMatched === true
                  ? "bg-emerald-50/80 border-emerald-300 text-emerald-950 shadow-lg shadow-emerald-900/5"
                  : "bg-slate-50 border-slate-200 text-slate-800"
              }`}
            >
              <div className="flex flex-col md:flex-row items-start justify-between gap-4">
                <div className="flex items-start space-x-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                    uploadResult.isMatched === false
                      ? "bg-rose-600 text-white"
                      : uploadResult.isMatched === true
                      ? "bg-emerald-600 text-white"
                      : "bg-blue-600 text-white"
                  }`}>
                    {uploadResult.isMatched === false ? (
                      <AlertTriangle className="w-6 h-6" />
                    ) : uploadResult.isMatched === true ? (
                      <CheckCircle2 className="w-6 h-6" />
                    ) : (
                      <CheckCircle2 className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-lg font-black tracking-tight">
                      {uploadResult.isMatched === false
                        ? `CẢNH BÁO: Phát hiện lệch tồn so với hệ thống ghi nhận ngày ${uploadResult.snapshotDate || ""}`
                        : uploadResult.isMatched === true
                        ? `XÁC THỰC THÀNH CÔNG: Tồn kho khớp 100% với hệ thống ghi nhận ngày ${uploadResult.snapshotDate || ""}`
                        : "Xử lý file hoàn tất thành công!"}
                    </h4>
                    <p className="text-sm mt-1 text-slate-700 leading-relaxed font-medium">
                      {uploadResult.message}
                    </p>

                    {/* Stats Pill Badges */}
                    <div className="flex flex-wrap gap-2.5 mt-3 text-xs font-bold">
                      {uploadResult.importedCount !== undefined && (
                        <span className="px-3 py-1 bg-white/90 rounded-xl border border-slate-200/80 text-slate-700 shadow-sm">
                          Mã SKU: {uploadResult.importedCount}
                        </span>
                      )}
                      {uploadResult.batchCount !== undefined && (
                        <span className="px-3 py-1 bg-white/90 rounded-xl border border-slate-200/80 text-slate-700 shadow-sm">
                          Số Lô: {uploadResult.batchCount}
                        </span>
                      )}
                      {uploadResult.totalQty !== undefined && (
                        <span className="px-3 py-1 bg-white/90 rounded-xl border border-slate-200/80 text-slate-900 shadow-sm">
                          Tồn File Tải Lên: {uploadResult.totalQty?.toLocaleString()} chiếc
                        </span>
                      )}
                      {(uploadResult.totalSystemQty !== undefined || uploadResult.totalExpectedQty !== undefined) && (
                        <span className="px-3 py-1 bg-white/90 rounded-xl border border-slate-200/80 text-slate-900 shadow-sm">
                          Hệ Thống Ghi Nhận: {(uploadResult.totalSystemQty || uploadResult.totalExpectedQty)?.toLocaleString()} chiếc
                        </span>
                      )}
                      {uploadResult.netVariance !== undefined && (
                        <span className={`px-3 py-1 rounded-xl border shadow-sm ${
                          uploadResult.netVariance === 0
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                            : "bg-rose-100 text-rose-800 border-rose-300"
                        }`}>
                          Chênh Lệch Tổng: {uploadResult.netVariance >= 0 ? `+${uploadResult.netVariance.toLocaleString()}` : uploadResult.netVariance.toLocaleString()} chiếc
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {(uploadResult.format === "inventory" || uploadResult.format === "baseline-inventory") && (
                  <Link
                    href={`/check-lech-ton?baselineDate=${baselineDate}&latestDate=${snapshotDate}`}
                    className={`px-5 py-2.5 text-white font-bold rounded-2xl text-xs flex items-center shadow-md shrink-0 transition-all active:scale-95 ${
                      uploadResult.isMatched === false
                        ? "bg-rose-600 hover:bg-rose-700 hover:shadow-rose-500/20"
                        : "bg-slate-900 hover:bg-slate-800 hover:shadow-slate-900/20"
                    }`}
                  >
                    <Scale className="w-4 h-4 mr-1.5" />
                    Xem Bảng Check Lệch Tồn <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </Link>
                )}
              </div>

              {/* Discrepancy Details Table */}
              {uploadResult.discrepancies && uploadResult.discrepancies.length > 0 && (
                <div className="mt-5 pt-5 border-t border-rose-200">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-xs font-black uppercase tracking-wider text-rose-900 flex items-center">
                      <AlertTriangle className="w-4 h-4 mr-1.5 text-rose-600" />
                      Chi tiết sai ở đâu ({uploadResult.discrepancies.length} mã SKU bị lệch):
                    </h5>
                    <span className="text-[11px] text-rose-700 font-medium">
                      Đối chiếu trực tiếp giữa file tải lên và số liệu hệ thống tính toán
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-rose-200 bg-white shadow-sm">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-rose-50/80 text-rose-900 border-b border-rose-200 font-bold uppercase tracking-wider text-[11px]">
                          <th className="py-2.5 px-3">Mã SKU</th>
                          <th className="py-2.5 px-3">Tên Sản Phẩm</th>
                          <th className="py-2.5 px-3 text-right">File Tải Lên</th>
                          <th className="py-2.5 px-3 text-right">Hệ Thống Ghi Nhận</th>
                          <th className="py-2.5 px-3 text-right">Chênh Lệch</th>
                          <th className="py-2.5 px-3">Đánh Giá Sai Ở Đâu</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rose-100 font-medium text-slate-700">
                        {uploadResult.discrepancies.map((d: any, idx: number) => (
                          <tr key={idx} className="hover:bg-rose-50/40 transition-colors">
                            <td className="py-2 px-3 font-bold text-slate-900">{d.sku}</td>
                            <td className="py-2 px-3 max-w-xs truncate" title={d.descr}>{d.descr}</td>
                            <td className="py-2 px-3 text-right font-black text-slate-900">
                              {Number(d.uploaded).toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-slate-600">
                              {Number(d.expected).toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-right font-black">
                              <span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-bold ${
                                d.variance > 0 ? "bg-blue-100 text-blue-800" : "bg-rose-100 text-rose-800"
                              }`}>
                                {d.variance > 0 ? `+${d.variance.toLocaleString()}` : d.variance.toLocaleString()}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-xs text-rose-700 font-medium">
                              {d.reason}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
