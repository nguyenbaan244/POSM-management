import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center h-full min-h-[50vh]">
      <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
      <h2 className="text-xl font-semibold text-slate-700 animate-pulse">Loading data...</h2>
      <p className="text-slate-500 text-sm mt-2">Fetching the latest records from the database.</p>
    </div>
  );
}
