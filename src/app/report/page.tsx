"use client";

import { useState, useEffect } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { FileBarChart, Filter, FileDown, Search, Loader2 } from "lucide-react";

export default function ReportPage() {
  const [reportType, setReportType] = useState("inbound");
  const [startDate, setStartDate] = useState(
    new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const formatDate = (date: any) => {
    if (!date) return "-";
    try {
      return new Date(date).toISOString().split('T')[0];
    } catch (e) {
      return "-";
    }
  };

  const fetchReport = () => {
    setLoading(true);
    const query = new URLSearchParams({
      type: reportType,
      startDate,
      endDate
    }).toString();

    fetch(`/api/report?${query}`)
      .then(res => res.json())
      .then(resData => {
        setData(resData);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load report", err);
        setLoading(false);
      });
  };

  // Fetch automatically on load or filter change
  useEffect(() => {
    fetchReport();
  }, [reportType, startDate, endDate]);

  const filteredData = data.filter(item => 
    item.sku.toLowerCase().includes(search.toLowerCase()) || 
    item.descr?.toLowerCase().includes(search.toLowerCase()) ||
    item.account?.toLowerCase().includes(search.toLowerCase())
  );

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text(`POSM Report - ${reportType.toUpperCase()}`, 14, 15);
    doc.setFontSize(10);
    if (reportType !== "inventory") {
      doc.text(`Period: ${startDate} to ${endDate}`, 14, 22);
    }
    
    let tableColumn = [];
    let tableRows = [];

    if (reportType === "inventory") {
      tableColumn = ["Account", "SKU", "Description", "Quantity Balance"];
      tableRows = filteredData.map(item => [item.account || "-", item.sku, item.descr, item.quantity]);
    } else {
      tableColumn = ["Order Code", "Date", "Account", "SKU", "Description", "Quantity", "Status", "Remark", "User"];
      tableRows = filteredData.map(item => [
        item.orderCode || "-",
        formatDate(item.date),
        item.account || "-",
        item.sku,
        item.descr,
        item.quantity,
        item.status || "-",
        item.remark || "-",
        item.createdBy || "-"
      ]);
    }

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 28,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: reportType === 'inbound' ? [59, 130, 246] : reportType === 'outbound' ? [249, 115, 22] : [16, 185, 129] }
    });
    
    doc.save(`posm_${reportType}_report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // Add BOM for UTF-8 Excel compatibility
    
    if (reportType === "inventory") {
      csvContent += "Account,SKU,Description,Quantity Balance\n";
      filteredData.forEach(item => {
        const row = `"${item.account || ""}","${item.sku}","${item.descr}",${item.quantity}`;
        csvContent += row + "\n";
      });
    } else {
      csvContent += "Order Code,Date,Account,SKU,Description,Quantity,Status,Remark,User\n";
      filteredData.forEach(item => {
        const dateStr = formatDate(item.date);
        const row = `"${item.orderCode || ""}","${dateStr}","${item.account || ""}","${item.sku}","${item.descr}",${item.quantity},"${item.status || ""}","${item.remark || ""}","${item.createdBy || ""}"`;
        csvContent += row + "\n";
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `posm_${reportType}_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto animate-in">
      <div className="flex items-center space-x-4 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 shadow-inner">
          <FileBarChart className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Reports & Analytics</h1>
          <p className="text-slate-500 font-medium">Extract and export POSM data easily</p>
        </div>
      </div>

      {/* Filter Section */}
      <div className="bg-white p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 mb-8 relative z-10 flex flex-col lg:flex-row gap-6 lg:items-end justify-between">
        <div className="flex flex-col md:flex-row gap-4 flex-1">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Report Type</label>
            <select 
              value={reportType} 
              onChange={(e) => setReportType(e.target.value)}
              className="w-full md:w-48 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-700"
            >
              <option value="inbound">Inbound History</option>
              <option value="outbound">Outbound History</option>
              <option value="inventory">Current Inventory</option>
            </select>
          </div>

          <div className={`flex flex-col md:flex-row gap-4 transition-opacity duration-300 ${reportType === 'inventory' ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Start Date</label>
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full md:w-40 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-700"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">End Date</label>
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full md:w-40 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-700"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={exportCSV} disabled={data.length === 0} className="flex items-center px-5 py-2.5 bg-emerald-50 text-emerald-700 font-semibold rounded-xl hover:bg-emerald-100 border border-emerald-200 transition-all active:scale-95 disabled:opacity-50">
            <FileDown className="w-4 h-4 mr-2" /> CSV
          </button>
          <button onClick={exportPDF} disabled={data.length === 0} className="flex items-center px-5 py-2.5 bg-rose-50 text-rose-700 font-semibold rounded-xl hover:bg-rose-100 border border-rose-200 transition-all active:scale-95 disabled:opacity-50">
            <FileDown className="w-4 h-4 mr-2" /> PDF
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden relative">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="text-xl font-bold text-slate-800 capitalize">{reportType} Data</h2>
            <p className="text-sm text-slate-500 font-medium">Found {filteredData.length} records</p>
          </div>
          
          <div className="relative mt-4 sm:mt-0 w-full sm:w-auto">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none w-full sm:w-64 shadow-sm transition-all"
              placeholder="Search SKU or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
            <p className="font-medium">Generating report...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white border-b border-slate-100 text-slate-500 text-xs uppercase tracking-wider">
                  {reportType !== "inventory" && <th className="py-4 px-6 font-semibold">Order Code</th>}
                  {reportType !== "inventory" && <th className="py-4 px-6 font-semibold">Date</th>}
                  <th className="py-4 px-6 font-semibold">Account</th>
                  <th className="py-4 px-6 font-semibold">SKU Code</th>
                  <th className="py-4 px-6 font-semibold">Description</th>
                  <th className="py-4 px-6 font-semibold text-right">Quantity</th>
                  {reportType !== "inventory" && (
                    <>
                      <th className="py-4 px-6 font-semibold">Status</th>
                      <th className="py-4 px-6 font-semibold">Remark</th>
                      <th className="py-4 px-6 font-semibold">User</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={reportType === "inventory" ? 4 : 8} className="py-12 text-center">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-50 text-slate-400 mb-4">
                        <Filter className="w-8 h-8" />
                      </div>
                      <p className="text-slate-500 font-medium text-lg">No data matches your filters.</p>
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                      {reportType !== "inventory" && (
                        <td className="py-4 px-6 text-slate-900 font-bold">{item.orderCode || '-'}</td>
                      )}
                      {reportType !== "inventory" && (
                        <td className="py-4 px-6 text-slate-600 font-medium">
                          {formatDate(item.date)}
                        </td>
                      )}
                      <td className="py-4 px-6 text-slate-500 font-medium">{item.account}</td>
                      <td className="py-4 px-6 text-slate-900 font-bold">
                        <div className="flex items-center">
                          <div className={`w-2 h-2 rounded-full mr-3 opacity-0 group-hover:opacity-100 transition-opacity ${
                            reportType === 'inbound' ? 'bg-blue-400' : reportType === 'outbound' ? 'bg-orange-400' : 'bg-emerald-400'
                          }`} />
                          {item.sku}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-slate-600 font-medium">{item.descr}</td>
                      <td className="py-4 px-6 text-right">
                        <span className={`inline-block font-bold ${
                          reportType === 'inbound' ? 'text-blue-600' : reportType === 'outbound' ? 'text-orange-600' : 'text-emerald-600'
                        }`}>
                          {reportType === 'inbound' ? '+' : reportType === 'outbound' ? '-' : ''}{item.quantity}
                        </span>
                      </td>
                      {reportType !== "inventory" && (
                        <>
                          <td className="py-4 px-6 text-slate-500">{item.status || '-'}</td>
                          <td className="py-4 px-6 text-slate-500">{item.remark || '-'}</td>
                          <td className="py-4 px-6 text-slate-500 font-bold">{item.createdBy || '-'}</td>
                        </>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
