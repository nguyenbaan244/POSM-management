"use client";

import { useState, useEffect } from "react";
import { Database, Plus, Search, Tag, Edit } from "lucide-react";
import { toast } from "sonner";

export default function MasterDataPage() {
  const [masterData, setMasterData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  const [formData, setFormData] = useState({ account: "", sku: "", descr: "" });
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

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
    fetch("/api/auth/me").then(res => res.json()).then(data => {
      if (!data.error) setCurrentUser(data);
    }).catch(console.error);
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
        setFormData({ account: "", sku: "", descr: "" });
        fetchMasterData();
        toast.success("SKU saved successfully");
      } else {
        toast.error("Failed to save SKU");
      }
    } catch (err) {
      toast.error("Error occurred");
    } finally {
      setSaving(false);
    }
  };

  const filteredData = masterData.filter(item => 
    (item.sku || "").toLowerCase().includes(search.toLowerCase()) || 
    (item.descr || "").toLowerCase().includes(search.toLowerCase()) ||
    (item.account || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto animate-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center text-purple-600 shadow-inner">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Master Data</h1>
            <p className="text-slate-500 font-medium">Manage SKU catalogue and definitions</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-purple-50 to-transparent rounded-bl-full pointer-events-none" />
        
        <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center relative z-10">
          <Tag className="w-5 h-5 mr-2 text-purple-500" /> 
          Add or Update SKU
        </h2>
        
        <form onSubmit={handleSave} className="flex flex-col md:flex-row gap-4 items-end relative z-10">
          <div className="flex-1 w-full">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Account <span className="text-red-500">*</span></label>
            <input type="text" required value={formData.account} onChange={e => setFormData({...formData, account: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all duration-200 font-medium text-slate-700 shadow-sm" placeholder="e.g. Danone" />
          </div>
          <div className="flex-1 w-full">
            <label className="block text-sm font-semibold text-slate-700 mb-2">SKU <span className="text-red-500">*</span></label>
            <input type="text" required value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all duration-200 font-medium text-slate-700 shadow-sm uppercase placeholder:normal-case placeholder:font-normal" placeholder="e.g. 194402" />
          </div>
          <div className="flex-[2] w-full">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Description <span className="text-red-500">*</span></label>
            <input type="text" required value={formData.descr} onChange={e => setFormData({...formData, descr: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all duration-200 font-medium text-slate-700 shadow-sm" placeholder="Detailed item description" />
          </div>
          <button type="submit" disabled={saving} className="w-full md:w-auto flex justify-center items-center h-12 px-8 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-purple-500/30 transition-all active:scale-95 disabled:opacity-70 disabled:hover:shadow-none">
            <Plus className="w-5 h-5 mr-2" /> {saving ? "Saving..." : "Save SKU"}
          </button>
        </form>
      </div>


      <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden relative">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="text-xl font-bold text-slate-800">SKU Catalogue</h2>
            <p className="text-sm text-slate-500 font-medium">{masterData.length} total SKUs registered</p>
          </div>
          
          <div className="relative mt-4 sm:mt-0 w-full sm:w-auto">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none w-full sm:w-64 shadow-sm transition-all"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="font-medium">Loading catalogue...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white border-b border-slate-100 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="py-4 px-6 font-semibold">Account</th>
                  <th className="py-4 px-6 font-semibold">SKU Code</th>
                  <th className="py-4 px-6 font-semibold">Description</th>
                  <th className="py-4 px-6 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="py-12 text-center">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-50 text-slate-400 mb-4">
                        <Database className="w-8 h-8" />
                      </div>
                      <p className="text-slate-500 font-medium text-lg">No matching SKUs found.</p>
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item, idx) => (
                    <tr key={idx} className="hover:bg-purple-50/30 transition-colors group">
                      <td className="py-4 px-6 text-slate-600 font-medium w-1/4">{item.account}</td>
                      <td className="py-4 px-6 text-slate-900 font-bold w-1/4">
                        <div className="flex items-center">
                          <div className="w-2 h-2 rounded-full bg-purple-400 mr-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          {item.sku}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-slate-600 font-medium">{item.descr}</td>
                      <td className="py-4 px-6 text-right">
                        <button 
                          onClick={() => {
                            setFormData({ account: item.account || "", sku: item.sku, descr: item.descr });
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                          title="Sửa SKU"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                      </td>

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
