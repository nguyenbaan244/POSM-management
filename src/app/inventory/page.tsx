"use client";

import { useState, useEffect } from "react";
import { PackageSearch } from "lucide-react";

export default function InventoryPage() {
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/inventory")
      .then(res => res.json())
      .then(data => {
        setInventory(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load inventory");
        setLoading(false);
      });
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-slate-800 mb-8 flex items-center">
        <PackageSearch className="w-8 h-8 mr-3 text-blue-500" />
        Inventory Balance
      </h1>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        {loading ? (
          <div className="text-center py-10 text-slate-500">Loading inventory...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 text-sm">
                  <th className="py-3 px-4 font-medium rounded-tl-lg">SKU</th>
                  <th className="py-3 px-4 font-medium">Description</th>
                  <th className="py-3 px-4 font-medium text-right rounded-tr-lg">Quantity (Balance)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inventory.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-slate-500">
                      No stock available in inventory.
                    </td>
                  </tr>
                ) : (
                  inventory.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 text-slate-800 font-medium">{item.sku}</td>
                      <td className="py-3 px-4 text-slate-600">{item.descr}</td>
                      <td className="py-3 px-4 text-right">
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                          item.quantity > 0 ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                        }`}>
                          {item.quantity}
                        </span>
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
