"use client";

import { useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { PlusCircle, Save, FileDown, Trash2 } from "lucide-react";

export default function InboundPage() {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    sku: "",
    descr: "",
    quantity: "",
    status: "",
    remark: "",
  });

  const [tempList, setTempList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSkuChange = async (sku: string) => {
    setFormData({ ...formData, sku });
    if (sku.length >= 3) {
      try {
        const res = await fetch(`/api/master-data?sku=${sku}`);
        const data = await res.json();
        if (data && data.descr) {
          setFormData((prev) => ({ ...prev, descr: data.descr }));
        } else {
          setFormData((prev) => ({ ...prev, descr: "" }));
        }
      } catch (err) {
        console.error("Failed to fetch sku descr");
      }
    }
  };

  const handleTempSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.date || !formData.sku || !formData.quantity) {
      alert("Please fill required fields (Date, SKU, Quantity)");
      return;
    }
    setTempList([...tempList, { ...formData }]);
    setFormData({ ...formData, sku: "", descr: "", quantity: "", status: "", remark: "" });
  };

  const handleConfirm = async () => {
    if (tempList.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/inbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: tempList }),
      });
      if (res.ok) {
        alert("Saved to inventory successfully!");
        setTempList([]);
      } else {
        const err = await res.json();
        alert(err.error || "Failed to save");
      }
    } catch (err) {
      alert("Error occurred");
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text("Inbound Report", 14, 15);
    const tableColumn = ["Date", "SKU", "Description", "Quantity", "Status", "Remark"];
    const tableRows = tempList.map(item => [
      item.date,
      item.sku,
      item.descr,
      item.quantity,
      item.status,
      item.remark
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 20,
    });
    doc.save(`inbound_report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-slate-800 mb-8">Inbound Entry</h1>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-8">
        <form onSubmit={handleTempSave} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Date *</label>
            <input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">SKU *</label>
            <input type="text" required value={formData.sku} onChange={e => handleSkuChange(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" placeholder="Enter SKU" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
            <input type="text" value={formData.descr} readOnly className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-none text-slate-500" placeholder="Auto-populated" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Quantity *</label>
            <input type="number" required min="1" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" placeholder="0" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
            <input type="text" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" placeholder="e.g. Good" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Remark</label>
            <input type="text" value={formData.remark} onChange={e => setFormData({...formData, remark: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" placeholder="Optional notes" />
          </div>
          
          <div className="md:col-span-2 lg:col-span-3 flex justify-end mt-4">
            <button type="submit" className="flex items-center px-6 py-2.5 bg-blue-50 text-blue-700 font-medium rounded-xl hover:bg-blue-100 transition-colors">
              <PlusCircle className="w-5 h-5 mr-2" />
              Lưu tạm (Save Temp)
            </button>
          </div>
        </form>
      </div>

      {tempList.length > 0 && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-slate-800">Summary Table</h2>
            <div className="flex space-x-3">
              <button onClick={exportPDF} className="flex items-center px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors">
                <FileDown className="w-4 h-4 mr-2" /> Export PDF
              </button>
              <button onClick={handleConfirm} disabled={loading} className="flex items-center px-6 py-2 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50">
                <Save className="w-4 h-4 mr-2" /> {loading ? "Saving..." : "Xác nhận (Confirm)"}
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 text-sm">
                  <th className="py-3 px-4 font-medium">Date</th>
                  <th className="py-3 px-4 font-medium">SKU</th>
                  <th className="py-3 px-4 font-medium">Description</th>
                  <th className="py-3 px-4 font-medium">Quantity</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium">Remark</th>
                  <th className="py-3 px-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tempList.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 text-slate-700">{item.date}</td>
                    <td className="py-3 px-4 text-slate-700 font-medium">{item.sku}</td>
                    <td className="py-3 px-4 text-slate-500">{item.descr}</td>
                    <td className="py-3 px-4 text-slate-700">{item.quantity}</td>
                    <td className="py-3 px-4 text-slate-500">{item.status}</td>
                    <td className="py-3 px-4 text-slate-500">{item.remark}</td>
                    <td className="py-3 px-4 text-right">
                      <button onClick={() => setTempList(tempList.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
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
