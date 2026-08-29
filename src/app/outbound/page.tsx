"use client";

import { useState, useEffect } from "react";
import { Save, Trash2, ArrowUpFromLine, CheckCircle2, History, Plus, Printer, Undo2 } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function OutboundPage() {
  const defaultRow = () => ({
    date: new Date().toISOString().split('T')[0],
    account: "Danone",
    sku: "",
    descr: "",
    quantity: "",
    status: "",
    remark: "",
  });

  const [rows, setRows] = useState<any[]>([defaultRow()]);
  const [masterDataList, setMasterDataList] = useState<any[]>([]);
  const [inventoryList, setInventoryList] = useState<any[]>([]);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [latestOrderCode, setLatestOrderCode] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    fetch("/api/auth/me").then(res => res.json()).then(data => {
      if (!data.error) setCurrentUser(data);
    }).catch(console.error);
    fetch("/api/master-data")
      .then(res => res.json())
      .then(data => setMasterDataList(data))
      .catch(console.error);
    fetch("/api/inventory")
      .then(res => res.json())
      .then(data => setInventoryList(data))
      .catch(console.error);
    fetchHistory();
  }, []);

  const fetchHistory = () => {
    fetch("/api/outbound")
      .then(res => res.json())
      .then(data => {
        // Group by orderCode for cleaner display
        const grouped = data.reduce((acc: any, curr: any) => {
          if (!acc[curr.orderCode]) {
            acc[curr.orderCode] = {
              orderCode: curr.orderCode,
              date: curr.date,
              reversed: curr.reversed,
              items: []
            };
          }
          acc[curr.orderCode].items.push(curr);
          return acc;
        }, {});
        // Only show up to 5 recent orders
        setHistoryList(Object.values(grouped).slice(0, 5));
      })
      .catch(console.error);
  };

  const updateRow = (index: number, field: string, value: string) => {
    const newRows = [...rows];
    newRows[index][field] = value;
    
    if (field === "sku" || field === "account") {
      const currentSku = field === "sku" ? value : newRows[index].sku;
      const currentAccount = field === "account" ? value : newRows[index].account;
      
      const foundMaster = masterDataList.find(m => m.sku.toUpperCase() === currentSku.toUpperCase() && m.account.toLowerCase() === currentAccount.toLowerCase());
      if (field === "sku") {
        newRows[index].descr = foundMaster ? foundMaster.descr : "";
        newRows[index].sku = value.toUpperCase();
      }

      const foundInv = inventoryList.find(i => i.sku.toUpperCase() === currentSku.toUpperCase() && i.account.toLowerCase() === currentAccount.toLowerCase());
      newRows[index].availableQty = foundInv ? foundInv.quantity : 0;
    }
    
    setRows(newRows);
  };

  const addRow = () => {
    setRows([...rows, defaultRow()]);
  };

  const removeRow = (index: number) => {
    if (rows.length === 1) {
      setRows([defaultRow()]);
    } else {
      setRows(rows.filter((_, i) => i !== index));
    }
  };

  const handleConfirm = async () => {
    const validRows = rows.filter(r => r.sku && r.quantity && r.date && r.account);
    if (validRows.length === 0) {
      toast.error("Please fill required fields (Date, Account, SKU, Quantity) for at least one row.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: validRows }),
      });
      if (res.ok) {
        const data = await res.json();
        setLatestOrderCode(data.orderCode);
        setShowSuccess(true);
        setRows([defaultRow()]);
        fetchHistory();
        setTimeout(() => setShowSuccess(false), 5000);
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to save");
      }
    } catch (err) {
      toast.error("Error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async (orderCode: string) => {
    try {
      const res = await fetch(`/api/order?code=${orderCode}`);
      if (!res.ok) throw new Error("Failed to fetch order");
      const { meta, items } = await res.json();

      const doc = new jsPDF();
      doc.text(`POSM Receipt - ${meta.type}`, 14, 15);
      doc.setFontSize(10);
      doc.text(`Order Code: ${meta.orderCode}`, 14, 22);
      doc.text(`Date: ${new Date(meta.date).toISOString().split('T')[0]}`, 14, 28);
      if (meta.reversed) {
        doc.setTextColor(220, 38, 38);
        doc.text(`*** REVERSED ***`, 14, 34);
        doc.setTextColor(0, 0, 0);
      }

      const tableColumn = ["Account", "SKU", "Description", "Quantity", "Status", "Remark"];
      const tableRows = items.map((item: any) => [
        item.account, item.sku, item.descr, item.quantity, item.status || "-", item.remark || "-"
      ]);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: meta.reversed ? 40 : 34,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [249, 115, 22] }
      });
      
      doc.save(`${meta.orderCode}_receipt.pdf`);
    } catch (err) {
      toast.error("Error printing PDF");
    }
  };

  const handleReverse = (orderCode: string) => {
    toast(`Are you sure you want to reverse order ${orderCode}? This will add the stock back to inventory.`, {
      action: {
        label: "Confirm",
        onClick: async () => {
          try {
            const res = await fetch("/api/order/reverse", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderCode }),
            });
            if (res.ok) {
              toast.success("Order reversed successfully!");
              fetchHistory();
            } else {
              const err = await res.json();
              toast.error(err.error || "Failed to reverse order");
            }
          } catch (err) {
            toast.error("Error occurred");
          }
        },
      },
      cancel: { label: "Cancel", onClick: () => {} },
    });
  };

  return (
    <div className="p-8 max-w-7xl mx-auto animate-in">
      <div className="flex items-center space-x-4 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center text-orange-600 shadow-inner">
          <ArrowUpFromLine className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Outbound Entry</h1>
          <p className="text-slate-500 font-medium">Record multiple items leaving the warehouse</p>
        </div>
      </div>

      {showSuccess && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-emerald-700 animate-in">
          <div className="flex items-center">
            <CheckCircle2 className="w-5 h-5 mr-3 text-emerald-500" />
            <span className="font-semibold">Successfully deducted from inventory!</span>
          </div>
          <button onClick={() => handlePrint(latestOrderCode)} className="flex items-center font-bold bg-white px-4 py-2 rounded-lg shadow-sm border border-emerald-100 hover:bg-emerald-100 transition-colors">
            <Printer className="w-4 h-4 mr-2" /> Print {latestOrderCode}
          </button>
        </div>
      )}

      {rows.map((row, idx) => (
        <datalist id={`sku-list-${idx}`} key={`dl-${idx}`}>
          {masterDataList
            .filter(item => item.account.toLowerCase() === row.account.toLowerCase())
            .map((item, i) => (
              <option key={i} value={item.sku}>{item.descr}</option>
            ))}
        </datalist>
      ))}

      <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 mb-8 relative overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800">Batch Entry</h2>
          <div className="flex space-x-3">
            <button onClick={addRow} className="flex items-center px-4 py-2 bg-white text-orange-600 font-semibold rounded-xl border border-orange-200 hover:bg-orange-50 transition-colors shadow-sm">
              <Plus className="w-4 h-4 mr-2" /> Add Row
            </button>
            <button onClick={handleConfirm} disabled={loading} className="flex items-center px-6 py-2 bg-gradient-to-r from-orange-500 to-rose-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-orange-500/30 transition-all active:scale-95 disabled:opacity-70">
              <Save className="w-4 h-4 mr-2" /> {loading ? "Saving..." : "Save All (Xác nhận)"}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto p-4">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-slate-500 text-xs uppercase tracking-wider">
                <th className="py-2 px-2 font-semibold">Date <span className="text-red-500">*</span></th>
                <th className="py-2 px-2 font-semibold">Account <span className="text-red-500">*</span></th>
                <th className="py-2 px-2 font-semibold">SKU <span className="text-red-500">*</span></th>
                <th className="py-2 px-2 font-semibold min-w-[200px]">Description</th>
                <th className="py-2 px-2 font-semibold w-24">Qty <span className="text-red-500">*</span></th>
                <th className="py-2 px-2 font-semibold w-28 text-center">Qty Available</th>
                <th className="py-2 px-2 font-semibold">Status</th>
                <th className="py-2 px-2 font-semibold">Remark</th>
                <th className="py-2 px-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, idx) => (
                <tr key={idx} className="group">
                  <td className="p-2">
                    <input type="date" value={row.date} onChange={e => updateRow(idx, 'date', e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none text-sm font-medium" />
                  </td>
                  <td className="p-2">
                    <input type="text" value={row.account} onChange={e => updateRow(idx, 'account', e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none text-sm font-medium" placeholder="Danone" />
                  </td>
                  <td className="p-2">
                    <input type="text" list={`sku-list-${idx}`} value={row.sku} onChange={e => updateRow(idx, 'sku', e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium uppercase placeholder:normal-case placeholder:font-normal" placeholder="SKU" autoComplete="off" />
                  </td>
                  <td className="p-2">
                    <input type="text" value={row.descr} readOnly className="w-full px-3 py-2 bg-transparent border-transparent rounded-lg text-sm font-medium text-slate-500" placeholder="Auto-fill" />
                  </td>
                  <td className="p-2">
                    <input type="number" min="1" value={row.quantity} onChange={e => updateRow(idx, 'quantity', e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none text-sm font-medium text-center" placeholder="0" />
                  </td>
                  <td className="p-2 text-center">
                    <span className="inline-flex items-center justify-center px-3 py-1 bg-slate-100 text-slate-600 font-bold text-sm rounded-lg border border-slate-200 min-w-[3rem]">
                      {row.availableQty !== undefined ? row.availableQty : "-"}
                    </span>
                  </td>
                  <td className="p-2">
                    <input type="text" value={row.status} onChange={e => updateRow(idx, 'status', e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none text-sm font-medium" placeholder="Status" />
                  </td>
                  <td className="p-2">
                    <input type="text" value={row.remark} onChange={e => updateRow(idx, 'remark', e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none text-sm font-medium" placeholder="Remark" />
                  </td>
                  <td className="p-2 text-right">
                    <button onClick={() => removeRow(idx)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden relative">
        <div className="p-6 border-b border-slate-100 flex items-center bg-slate-50/50">
          <History className="w-5 h-5 text-slate-400 mr-3" />
          <h2 className="text-xl font-bold text-slate-800">Recent Outbound Orders</h2>
        </div>
        <div className="overflow-x-auto p-2">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-slate-500 text-[10px] uppercase tracking-wider">
                <th className="py-3 px-4 font-semibold">Order Code</th>
                <th className="py-3 px-4 font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold">Items</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {historyList.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500">No outbound history found.</td>
                </tr>
              ) : (
                historyList.map((order, idx) => (
                  <tr key={idx} className={`transition-colors text-sm ${order.reversed ? 'bg-red-50/50' : 'hover:bg-slate-50/80'}`}>
                    <td className="py-3 px-4">
                      <div className="flex items-center">
                        <span className={`font-bold ${order.reversed ? 'text-red-600 line-through' : 'text-slate-700'}`}>{order.orderCode}</span>
                        {order.reversed && <span className="ml-2 text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-700 rounded-md">REVERSED</span>}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-medium text-xs">{new Date(order.date).toISOString().split('T')[0]}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1">
                        {order.items.map((item: any, i: number) => (
                          <div key={i} className="text-xs font-medium text-slate-600">
                            <span className="font-bold text-rose-600">-{item.quantity}</span> {item.sku} <span className="text-slate-400 text-[10px]">({item.account})</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button onClick={() => handlePrint(order.orderCode)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Print PDF">
                          <Printer className="w-5 h-5" />
                        </button>
                        {!order.reversed && currentUser?.role === "ADMIN" && (
                          <button onClick={() => handleReverse(order.orderCode)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Reverse Order">
                            <Undo2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
