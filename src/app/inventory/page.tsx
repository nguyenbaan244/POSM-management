"use client";

import { useState, useEffect } from "react";
import { PackageSearch, Search, AlertCircle, Edit, X, Save } from "lucide-react";
import { toast } from "sonner";

export default function InventoryPage() {
  const [data, setData] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSku, setSelectedSku] = useState<any>(null);
  const [newQuantity, setNewQuantity] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    fetch("/api/auth/me").then(res => res.json()).then(data => {
      if (!data.error) setCurrentUser(data);
    }).catch(console.error);
    fetchInventory();
  }, []);

  const fetchInventory = () => {
    fetch("/api/inventory")
      .then(res => res.json())
      .then(setData)
      .catch(console.error);
  };

  const filteredData = data.filter(item => 
    item.sku.toLowerCase().includes(search.toLowerCase()) || 
    item.descr?.toLowerCase().includes(search.toLowerCase()) ||
    item.account?.toLowerCase().includes(search.toLowerCase())
  );

  const openEditModal = (item: any) => {
    setSelectedSku(item);
    setNewQuantity(item.quantity.toString());
    setAdjustReason("");
    setIsModalOpen(true);
  };

  const handleAdjust = async () => {
    if (!newQuantity || !adjustReason) {
      toast.error("Please provide the new quantity and a reason for adjustment.");
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
        fetchInventory(); // refresh data
        toast.success("Inventory adjusted successfully");
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to adjust inventory");
      }
    } catch (e) {
      toast.error("Error adjusting inventory");
    } finally {
      setIsAdjusting(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto animate-in">
      <div className="flex items-center space-x-4 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-inner">
          <PackageSearch className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Stock Inventory</h1>
          <p className="text-slate-500 font-medium">Real-time overview of your warehouse stocks</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden relative z-10">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Current Stock Levels</h2>
            <p className="text-sm text-slate-500 font-medium">{filteredData.length} active items</p>
          </div>
          
          <div className="relative mt-4 sm:mt-0 w-full sm:w-auto">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none w-full sm:w-64 shadow-sm transition-all"
              placeholder="Search SKU or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-slate-100 text-slate-500 text-xs uppercase tracking-wider">
                <th className="py-4 px-6 font-semibold">Account</th>
                <th className="py-4 px-6 font-semibold">SKU Code</th>
                <th className="py-4 px-6 font-semibold">Description</th>
                <th className="py-4 px-6 font-semibold text-right">Quantity Balance</th>
                <th className="py-4 px-6 font-semibold text-center">Status</th>
                <th className="py-4 px-6 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 font-medium">
                    No inventory records found matching your search.
                  </td>
                </tr>
              ) : (
                filteredData.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="py-4 px-6 text-slate-500 font-medium">{item.account}</td>
                    <td className="py-4 px-6 text-slate-900 font-bold">{item.sku}</td>
                    <td className="py-4 px-6 text-slate-600 font-medium max-w-md truncate" title={item.descr}>{item.descr}</td>
                    <td className="py-4 px-6 text-right">
                      <span className="text-lg font-black text-slate-800">{item.quantity}</span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      {item.quantity <= 10 ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
                          <AlertCircle className="w-3 h-3 mr-1" /> Low Stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                          In Stock
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {currentUser?.role === "ADMIN" && (
                        <button onClick={() => openEditModal(item)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Edit className="w-5 h-5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {isModalOpen && selectedSku && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-800">Adjust Stock</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-500 mb-1">SKU</label>
                <div className="text-lg font-bold text-slate-900">{selectedSku.sku} <span className="text-sm font-medium text-slate-400">({selectedSku.account})</span></div>
                <div className="text-sm text-slate-500 truncate">{selectedSku.descr}</div>
              </div>
              
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-slate-500 mb-2">Current Qty</label>
                  <input type="text" readOnly value={selectedSku.quantity} className="w-full px-4 py-3 bg-slate-100 border-transparent rounded-xl text-slate-500 font-bold outline-none cursor-not-allowed" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">New Qty <span className="text-red-500">*</span></label>
                  <input type="number" value={newQuantity} onChange={e => setNewQuantity(e.target.value)} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-bold text-slate-900 outline-none transition-all" placeholder="0" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Reason for adjustment <span className="text-red-500">*</span></label>
                <textarea 
                  value={adjustReason} 
                  onChange={e => setAdjustReason(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none" 
                  rows={3}
                  placeholder="E.g., Stock count discrepancy, damaged item..."
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-slate-600 font-semibold hover:bg-slate-200 rounded-xl transition-colors">
                Cancel
              </button>
              <button onClick={handleAdjust} disabled={isAdjusting || !newQuantity || !adjustReason} className="flex items-center px-5 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50">
                {isAdjusting ? "Saving..." : <><Save className="w-4 h-4 mr-2" /> Confirm Edit</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
