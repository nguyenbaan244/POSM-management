"use client";

import { useState, useEffect } from "react";
import { Database, Plus } from "lucide-react";

export default function MasterDataPage() {
  const [masterData, setMasterData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [formData, setFormData] = useState({ sku: "", descr: "" });
  const [saving, setSaving] = useState(false);

  const fetchMasterData = () => {
    setLoading(true);
    fetch("/api/master-data")
      .then(res => res.json())
      .then(data => {
        setMasterData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load master data");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchMasterData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.sku || !formData.descr) return;
    setSaving(true);
    try {
      const res = await fetch("/api/master-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        alert("SKU saved successfully");
        setFormData({ sku: "", descr: "" });
        fetchMasterData();
      } else {
        alert("Failed to save SKU");
      }
    } catch (err) {
      alert("Error occurred");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-slate-800 mb-8 flex items-center">
        <Database className="w-8 h-8 mr-3 text-purple-500" />
        Master Data
      </h1>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-8">
        <h2 className="text-xl font-bold text-slate-800 mb-4">Add or Update SKU</h2>
        <form onSubmit={handleSave} className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-2">SKU *</label>
            <input type="text" required value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition" placeholder="e.g. ITEM-001" />
          </div>
          <div className="flex-[2]">
            <label className="block text-sm font-medium text-slate-700 mb-2">Description *</label>
            <input type="text" required value={formData.descr} onChange={e => setFormData({...formData, descr: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition" placeholder="Item description" />
          </div>
          <button type="submit" disabled={saving} className="flex items-center h-10 px-6 bg-purple-600 text-white font-medium rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50">
            <Plus className="w-4 h-4 mr-2" /> {saving ? "Saving..." : "Save SKU"}
          </button>
        </form>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        {loading ? (
          <div className="text-center py-10 text-slate-500">Loading master data...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 text-sm">
                  <th className="py-3 px-4 font-medium rounded-tl-lg">SKU</th>
                  <th className="py-3 px-4 font-medium rounded-tr-lg">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {masterData.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="py-8 text-center text-slate-500">
                      No master data available.
                    </td>
                  </tr>
                ) : (
                  masterData.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 text-slate-800 font-medium">{item.sku}</td>
                      <td className="py-3 px-4 text-slate-600">{item.descr}</td>
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
