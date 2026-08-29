"use client";

import { useState, useEffect } from "react";
import { Activity, Clock } from "lucide-react";

export default function ActivityLogPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/logs")
      .then(res => res.json())
      .then(data => {
        if (!data.error) setLogs(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto animate-in">
      <div className="flex items-center space-x-4 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-fuchsia-100 flex items-center justify-center text-fuchsia-600 shadow-inner">
          <Activity className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">System Activity Log</h1>
          <p className="text-slate-500 font-medium">Audit trail of all actions performed by users</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden relative">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800 flex items-center">
            <Clock className="w-5 h-5 mr-2 text-slate-400" /> Recent Actions
          </h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500 font-medium">Loading logs...</div>
        ) : (
          <div className="overflow-x-auto p-2">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-slate-500 text-xs uppercase tracking-wider">
                  <th className="py-4 px-6 font-semibold w-48">Timestamp</th>
                  <th className="py-4 px-6 font-semibold w-32">User</th>
                  <th className="py-4 px-6 font-semibold w-40">Action</th>
                  <th className="py-4 px-6 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500 font-medium">
                      No activity logs found.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors text-sm">
                      <td className="py-3 px-6 text-slate-500 font-medium text-xs whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-6 text-slate-700 font-bold whitespace-nowrap">
                        {log.username}
                      </td>
                      <td className="py-3 px-6">
                        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold tracking-wider">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-6 text-slate-600 font-medium">
                        {log.details}
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
