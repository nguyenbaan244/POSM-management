"use client";

import { useState, useRef, useEffect } from "react";
import { 
  UploadCloud, 
  FileSpreadsheet, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  PackageSearch, 
  Database, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  FileCheck,
  RefreshCw,
  FolderUp,
  Info
} from "lucide-react";
import { toast } from "sonner";
import * as xlsx from "xlsx";

type UploadFormat = "inbound" | "outbound" | "inventory" | "master-data";
type UploadMode = "append" | "replace";

export default function UploadDataPage() {
  const [selectedFormat, setSelectedFormat] = useState<UploadFormat>("inbound");
  const [uploadMode, setUploadMode] = useState<UploadMode>("append");
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
  }> = {
    "inbound": {
      title: "Nhập Kho (Inbound)",
      subtitle: "Dữ liệu hàng nhập kho, số PO, nhà cung cấp, lô sản xuất",
      color: "from-blue-600 to-indigo-600",
      badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
      icon: ArrowDownToLine,
      columns: ["PO Number", "ReceiptKey", "Date Received", "Sku", "DESCR", "Qty Piece", "Supplier", "Batch"],
      description: "Hỗ trợ file Excel theo mẫu Inbound chuẩn (PO, ReceiptKey, Ngày nhập, Mã SKU, Tên SP, SL Nhập, Lô...)"
    },
    "outbound": {
      title: "Xuất Kho (Outbound)",
      subtitle: "Dữ liệu hàng xuất kho, đơn hàng, khách hàng, số lượng xuất",
      color: "from-orange-500 to-rose-600",
      badgeColor: "bg-orange-50 text-orange-700 border-orange-200",
      icon: ArrowUpFromLine,
      columns: ["ShipDate", "Sale Order #", "Customer PO", "Sku", "Description", "Total Qty Pcs", "Batch", "Remark"],
      description: "Hỗ trợ file Excel theo mẫu Outbound chuẩn (Ngày xuất, Số đơn SO/PO, SKU, Tên SP, SL Xuất, Lô...)"
    },
    "inventory": {
      title: "Tồn Kho (Inventory)",
      subtitle: "Dữ liệu kiểm kê tồn kho theo từng vị trí và SKU",
      color: "from-emerald-500 to-teal-600",
      badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
      icon: PackageSearch,
      columns: ["Sku", "DESCR", "Qty", "Loc", "BatchNo"],
      description: "Hỗ trợ file tồn kho chi tiết hoặc tổng hợp. Hệ thống sẽ tự động gộp tổng tồn theo từng mã SKU."
    },
    "master-data": {
      title: "Danh Mục SKU (Master Data)",
      subtitle: "Danh mục quy chuẩn mã hàng, tên sản phẩm và tài khoản",
      color: "from-purple-600 to-indigo-600",
      badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
      icon: Database,
      columns: ["SKU", "Description", "Account"],
      description: "Quản lý mã sản phẩm (SKU) và tên mô tả chính thức để phục vụ tra cứu tự động trong toàn bộ hệ thống."
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

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("format", selectedFormat);
    formData.append("mode", uploadMode);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setUploadResult(data);
        fetchCurrentInventory();
        toast.success(data.message || "Tải lên và xử lý dữ liệu thành công!");
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

  const handleDownloadTemplate = (format: UploadFormat) => {
    window.open(`/api/upload/template?type=${format}`, "_blank");
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
              Import & cập nhật dữ liệu Inbound, Outbound, Tồn kho & Danh mục SKU theo định dạng Excel
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleDownloadTemplate(selectedFormat)}
            className="flex items-center px-4 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-2xl hover:bg-slate-50 transition-all shadow-sm active:scale-95 text-sm"
          >
            <Download className="w-4 h-4 mr-2 text-emerald-600" />
            Tải File Mẫu (.xlsx)
          </button>
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
                {isSelected && (
                  <span className="flex items-center text-xs font-bold px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Đang chọn
                  </span>
                )}
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">{cfg.title}</h3>
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

          {/* Mode Switcher */}
          <div className="flex items-center bg-white p-1 rounded-2xl border border-slate-200 shadow-sm self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setUploadMode("append")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                uploadMode === "append"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Nối tiếp (Append)
            </button>
            <button
              type="button"
              onClick={() => setUploadMode("replace")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                uploadMode === "replace"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-rose-600"
              }`}
            >
              Ghi đè (Replace)
            </button>
          </div>
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

          {/* Mode Warning Notice */}
          <div className="mt-4 p-4 rounded-2xl bg-amber-50/60 border border-amber-200 flex items-start space-x-3 text-xs text-amber-800">
            <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Chế độ xử lý: {uploadMode === "append" ? "Nối tiếp (Append)" : "Ghi đè (Replace)"}</p>
              <p className="text-amber-700 mt-0.5">
                {uploadMode === "append" 
                  ? "Dữ liệu mới sẽ được thêm vào hệ thống. Tồn kho tự động được cập nhật tương ứng theo các giao dịch mới." 
                  : "CẢNH BÁO: Chế độ 'Ghi đè' sẽ xóa toàn bộ các bản ghi cũ của mục này và thay thế hoàn toàn bằng dữ liệu trong file bạn tải lên."}
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
                    disabled={isUploading}
                    className="flex-1 sm:flex-initial flex items-center justify-center px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-emerald-500/30 transition-all active:scale-95 disabled:opacity-50 text-sm"
                  >
                    {isUploading ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Đang xử lý...
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-4 h-4 mr-2" />
                        Bắt đầu Tải Lên & Xử Lý
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

          {/* Success Banner */}
          {uploadResult && (
            <div className="mt-6 p-6 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start space-x-4 animate-in">
              <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-base font-bold text-emerald-900">
                  Xử lý file hoàn tất thành công!
                </h4>
                <p className="text-sm text-emerald-800 mt-1">
                  {uploadResult.message}
                </p>
                <div className="flex gap-4 mt-3 text-xs font-semibold text-emerald-700">
                  <span>Số bản ghi: {uploadResult.importedCount}</span>
                  <span>Tổng số lượng: {uploadResult.totalQty?.toLocaleString()}</span>
                  <span>Chế độ: {uploadResult.mode}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Real-time SKU & Quantity Overview Table */}
      {currentInventory.length > 0 && (
        <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden mb-8">
          <div className="p-6 border-b border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h3 className="text-lg font-bold text-slate-800 flex items-center">
                <PackageSearch className="w-5 h-5 mr-2 text-emerald-600" />
                Bảng Thống Kê Dữ Liệu Theo SKU & Số Lượng Tồn Kho Hiện Tại
              </h3>
              <p className="text-xs text-slate-500">Đối soát trực quan số lượng tồn thực tế của từng mã sản phẩm Danone</p>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
              Tổng tồn kho: {currentInventory.reduce((s, x) => s + (x.quantity || 0), 0).toLocaleString()} chiếc
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                  <th className="py-3.5 px-6">Mã SKU</th>
                  <th className="py-3.5 px-6">Tên Sản Phẩm (Mô Tả)</th>
                  <th className="py-3.5 px-6 text-right">Số Lượng Tồn</th>
                  <th className="py-3.5 px-6 text-right">Tỷ Trọng (%)</th>
                  <th className="py-3.5 px-6 text-center">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {currentInventory.map((item, idx) => {
                  const total = currentInventory.reduce((s, x) => s + (x.quantity || 0), 0);
                  const share = total > 0 ? ((item.quantity / total) * 100).toFixed(1) : 0;
                  return (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-6 font-bold text-slate-900">{item.sku}</td>
                      <td className="py-3.5 px-6 text-slate-600 max-w-md truncate" title={item.descr}>{item.descr}</td>
                      <td className="py-3.5 px-6 text-right font-black text-slate-900">{item.quantity.toLocaleString()}</td>
                      <td className="py-3.5 px-6 text-right font-semibold text-slate-500">{share}%</td>
                      <td className="py-3.5 px-6 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Sẵn Sàng
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-900 text-white font-bold text-sm">
                  <td colSpan={2} className="py-3.5 px-6">TỔNG CỘNG TẤT CẢ SKU</td>
                  <td className="py-3.5 px-6 text-right font-black text-emerald-400">
                    {currentInventory.reduce((s, x) => s + (x.quantity || 0), 0).toLocaleString()}
                  </td>
                  <td className="py-3.5 px-6 text-right text-slate-300">100%</td>
                  <td className="py-3.5 px-6 text-center text-xs text-emerald-300">Hoạt động bình thường</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Guide & Rules */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 mb-3">
            <ArrowDownToLine className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-slate-800 mb-1">Mẫu Inbound</h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            Chứa PO Number, ReceiptKey, Ngày nhập kho, Mã SKU, Số lượng sản phẩm (Qty Piece) và tên nhà cung cấp.
          </p>
          <button
            onClick={() => handleDownloadTemplate("inbound")}
            className="mt-3 text-xs font-bold text-blue-600 hover:underline flex items-center"
          >
            <Download className="w-3.5 h-3.5 mr-1" /> Tải mẫu Inbound (.xlsx)
          </button>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 mb-3">
            <ArrowUpFromLine className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-slate-800 mb-1">Mẫu Outbound</h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            Chứa Ngày xuất hàng (ShipDate), Sale Order #, Customer PO, Mã SKU, Số lượng xuất (Total Qty Pcs), Lô hàng.
          </p>
          <button
            onClick={() => handleDownloadTemplate("outbound")}
            className="mt-3 text-xs font-bold text-orange-600 hover:underline flex items-center"
          >
            <Download className="w-3.5 h-3.5 mr-1" /> Tải mẫu Outbound (.xlsx)
          </button>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 mb-3">
            <PackageSearch className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-slate-800 mb-1">Mẫu Tồn Kho (Inventory)</h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            Bảng số lượng tồn theo SKU. Khi tải lên, hệ thống sẽ tự động gộp tổng theo mã SKU và cập nhật số dư kho.
          </p>
          <button
            onClick={() => handleDownloadTemplate("inventory")}
            className="mt-3 text-xs font-bold text-emerald-600 hover:underline flex items-center"
          >
            <Download className="w-3.5 h-3.5 mr-1" /> Tải mẫu Tồn Kho (.xlsx)
          </button>
        </div>
      </div>
    </div>
  );
}
