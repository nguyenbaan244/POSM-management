import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month"); // e.g. "2026-10"
    const selectedDate = searchParams.get("date"); // e.g. "2026-10-23"
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const selectedSku = searchParams.get("sku"); // e.g. "194402" or null

    // 1. Fetch current inventory and master data
    const [inventoryList, masterDataList, inbounds, outbounds] = await Promise.all([
      prisma.inventory.findMany({ orderBy: { sku: 'asc' } }),
      prisma.masterData.findMany({ orderBy: { sku: 'asc' } }),
      prisma.inbound.findMany({ where: { reversed: false }, orderBy: { date: 'asc' } }),
      prisma.outbound.findMany({ where: { reversed: false }, orderBy: { date: 'asc' } })
    ]);

    // Build SKU dictionary
    const skuMeta: Record<string, { descr: string, currentStock: number }> = {};
    for (const m of masterDataList) {
      skuMeta[m.sku] = { descr: m.descr, currentStock: 0 };
    }
    for (const inv of inventoryList) {
      if (!skuMeta[inv.sku]) {
        skuMeta[inv.sku] = { descr: inv.descr, currentStock: inv.quantity };
      } else {
        skuMeta[inv.sku].currentStock = inv.quantity;
      }
    }

    // Helper to format Date to YYYY-MM-DD
    const toYMD = (d: Date) => d.toISOString().split('T')[0];

    // Collect all transaction dates
    const dateSet = new Set<string>();
    inbounds.forEach(ib => dateSet.add(toYMD(new Date(ib.date))));
    outbounds.forEach(ob => dateSet.add(toYMD(new Date(ob.date))));

    // If no transactions exist, use today
    if (dateSet.size === 0) {
      dateSet.add(new Date().toISOString().split('T')[0]);
    }

    const allDatesSorted = Array.from(dateSet).sort();

    // Map movements by [date][sku]
    const ibMap: Record<string, Record<string, number>> = {};
    const obMap: Record<string, Record<string, number>> = {};

    inbounds.forEach(ib => {
      const d = toYMD(new Date(ib.date));
      if (!ibMap[d]) ibMap[d] = {};
      ibMap[d][ib.sku] = (ibMap[d][ib.sku] || 0) + ib.quantity;
    });

    outbounds.forEach(ob => {
      const d = toYMD(new Date(ob.date));
      if (!obMap[d]) obMap[d] = {};
      obMap[d][ob.sku] = (obMap[d][ob.sku] || 0) + ob.quantity;
    });

    const allSkus = Object.keys(skuMeta);

    // Build timeline backwards from latest date to calculate daily opening & closing
    // For each SKU:
    // On latest day: closing = currentStock
    // opening = closing - in + out
    // On prior day: closing = next_day.opening
    const skuLedger: Record<string, Record<string, { opening: number, in: number, out: number, closing: number }>> = {};

    for (const sku of allSkus) {
      skuLedger[sku] = {};
      let runningClosing = skuMeta[sku].currentStock;

      for (let i = allDatesSorted.length - 1; i >= 0; i--) {
        const d = allDatesSorted[i];
        const inQty = ibMap[d]?.[sku] || 0;
        const outQty = obMap[d]?.[sku] || 0;
        const opening = runningClosing - inQty + outQty;
        
        skuLedger[sku][d] = {
          opening,
          in: inQty,
          out: outQty,
          closing: runningClosing
        };

        runningClosing = opening;
      }
    }

    // Determine target filtered dates
    let filteredDates = allDatesSorted;

    if (selectedDate && selectedDate !== "all") {
      filteredDates = filteredDates.filter(d => d === selectedDate);
    } else if (month && month !== "all") {
      filteredDates = filteredDates.filter(d => d.startsWith(month));
    } else if (startDateParam && endDateParam) {
      filteredDates = filteredDates.filter(d => d >= startDateParam && d <= endDateParam);
    }

    // Target SKUs
    let targetSkus = allSkus;
    if (selectedSku && selectedSku !== "all") {
      targetSkus = targetSkus.filter(s => s === selectedSku);
    }

    // Construct Daily Overall Summary
    const dailySummary = filteredDates.map(d => {
      let opening = 0;
      let inbound = 0;
      let outbound = 0;
      let closing = 0;

      for (const sku of targetSkus) {
        const record = skuLedger[sku]?.[d] || { opening: 0, in: 0, out: 0, closing: 0 };
        opening += record.opening;
        inbound += record.in;
        outbound += record.out;
        closing += record.closing;
      }

      return {
        date: d,
        opening,
        inbound,
        outbound,
        netChange: inbound - outbound,
        closing
      };
    });

    // Construct Detailed SKU by Day table
    const skuDailySummary: any[] = [];
    for (const d of filteredDates) {
      for (const sku of targetSkus) {
        const record = skuLedger[sku]?.[d] || { opening: 0, in: 0, out: 0, closing: 0 };
        // Only push if there's activity or stock
        if (record.opening > 0 || record.in > 0 || record.out > 0 || record.closing > 0) {
          skuDailySummary.push({
            date: d,
            sku,
            descr: skuMeta[sku]?.descr || sku,
            opening: record.opening,
            inbound: record.in,
            outbound: record.out,
            netChange: record.in - record.out,
            closing: record.closing
          });
        }
      }
    }

    // Aggregate totals for the selected period
    let periodTotalIn = 0;
    let periodTotalOut = 0;
    let periodOpening = 0;
    let periodClosing = 0;

    if (dailySummary.length > 0) {
      periodOpening = dailySummary[0].opening;
      periodClosing = dailySummary[dailySummary.length - 1].closing;
      periodTotalIn = dailySummary.reduce((sum, item) => sum + item.inbound, 0);
      periodTotalOut = dailySummary.reduce((sum, item) => sum + item.outbound, 0);
    }

    // SKU Totals in the filtered period
    const skuTotals = targetSkus.map(sku => {
      let skuIn = 0;
      let skuOut = 0;
      let firstOpening = 0;
      let lastClosing = 0;

      if (filteredDates.length > 0) {
        const firstDate = filteredDates[0];
        const lastDate = filteredDates[filteredDates.length - 1];
        firstOpening = skuLedger[sku]?.[firstDate]?.opening ?? 0;
        lastClosing = skuLedger[sku]?.[lastDate]?.closing ?? 0;

        for (const d of filteredDates) {
          skuIn += skuLedger[sku]?.[d]?.in ?? 0;
          skuOut += skuLedger[sku]?.[d]?.out ?? 0;
        }
      }

      return {
        sku,
        descr: skuMeta[sku]?.descr || sku,
        opening: firstOpening,
        inbound: skuIn,
        outbound: skuOut,
        netChange: skuIn - skuOut,
        closing: lastClosing,
        currentStock: skuMeta[sku]?.currentStock ?? 0
      };
    });

    // Available filter options to send back to client
    const availableMonths = Array.from(new Set(allDatesSorted.map(d => d.substring(0, 7)))).sort().reverse();
    const availableDates = [...allDatesSorted].reverse();

    return NextResponse.json({
      period: {
        opening: periodOpening,
        inbound: periodTotalIn,
        outbound: periodTotalOut,
        netChange: periodTotalIn - periodTotalOut,
        closing: periodClosing,
      },
      dailySummary,
      skuDailySummary,
      skuTotals,
      availableMonths,
      availableDates,
      allSkus: allSkus.map(sku => ({ sku, descr: skuMeta[sku]?.descr || sku }))
    });

  } catch (error) {
    console.error("Daily NXT API Error:", error);
    return NextResponse.json({ error: "Failed to calculate daily NXT report" }, { status: 500 });
  }
}
