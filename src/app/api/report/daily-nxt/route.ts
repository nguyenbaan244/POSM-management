import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function toYMD(d: Date): string {
  return d.toISOString().split("T")[0];
}

function getDaysInMonth(year: number, month: number): string[] {
  const daysCount = new Date(year, month, 0).getDate();
  const dates: string[] = [];
  for (let day = 1; day <= daysCount; day++) {
    const dd = String(day).padStart(2, "0");
    const mm = String(month).padStart(2, "0");
    dates.push(`${year}-${mm}-${dd}`);
  }
  return dates;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get("month") || "2026-10"; // e.g. "2026-10"
    const selectedDate = searchParams.get("date"); // e.g. "2026-10-23" or "all"
    const selectedSku = searchParams.get("sku"); // e.g. "194402" or "all"

    // 1. Fetch current inventory, master data, inbounds and outbounds
    const [inventoryList, masterDataList, inbounds, outbounds] = await Promise.all([
      prisma.inventory.findMany({ orderBy: { sku: "asc" } }),
      prisma.masterData.findMany({ orderBy: { sku: "asc" } }),
      prisma.inbound.findMany({ where: { reversed: false }, orderBy: { date: "asc" } }),
      prisma.outbound.findMany({ where: { reversed: false }, orderBy: { date: "asc" } })
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

    // Collect all dates
    const dateSet = new Set<string>();
    inbounds.forEach(ib => dateSet.add(toYMD(new Date(ib.date))));
    outbounds.forEach(ob => dateSet.add(toYMD(new Date(ob.date))));

    // Determine target month
    let targetYear = 2026;
    let targetMonth = 10;
    if (monthParam && monthParam !== "all") {
      const parts = monthParam.split("-");
      if (parts.length === 2) {
        targetYear = parseInt(parts[0], 10);
        targetMonth = parseInt(parts[1], 10);
      }
    }

    // Generate full calendar days of target month (day 1 to last day)
    const monthCalendarDays = getDaysInMonth(targetYear, targetMonth);
    monthCalendarDays.forEach(d => dateSet.add(d));

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

    // Build timeline backwards from the latest date in allDatesSorted
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

    // Target filtered dates for the month
    let filteredDates = monthCalendarDays;

    if (selectedDate && selectedDate !== "all") {
      filteredDates = filteredDates.filter(d => d === selectedDate);
    } else if (monthParam === "all") {
      filteredDates = allDatesSorted;
    }

    // Target SKUs
    let targetSkus = allSkus;
    if (selectedSku && selectedSku !== "all") {
      targetSkus = targetSkus.filter(s => s === selectedSku);
    }

    // Construct Daily Overall Summary - FULL DAYS FROM 1 TO END OF MONTH
    let activeTransactionDaysCount = 0;

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

      if (inbound > 0 || outbound > 0) {
        activeTransactionDaysCount++;
      }

      return {
        date: d,
        opening,
        inbound,
        outbound,
        netChange: inbound - outbound,
        closing,
        hasActivity: inbound > 0 || outbound > 0
      };
    });

    // Construct Weekly Summary (Tuần 1, Tuần 2, Tuần 3, Tuần 4, Tuần 5)
    const weeklySummary: any[] = [];
    if (filteredDates.length >= 28) {
      const weekBuckets = [
        { label: "Tuần 1", startDay: 1, endDay: 7 },
        { label: "Tuần 2", startDay: 8, endDay: 14 },
        { label: "Tuần 3", startDay: 15, endDay: 21 },
        { label: "Tuần 4", startDay: 22, endDay: 28 },
        { label: "Tuần 5", startDay: 29, endDay: monthCalendarDays.length }
      ];

      weekBuckets.forEach((bucket, idx) => {
        const daysInBucket = filteredDates.filter(d => {
          const dayNum = parseInt(d.split("-")[2], 10);
          return dayNum >= bucket.startDay && dayNum <= bucket.endDay;
        });

        if (daysInBucket.length > 0) {
          const firstDay = daysInBucket[0];
          const lastDay = daysInBucket[daysInBucket.length - 1];

          let opening = 0;
          let inbound = 0;
          let outbound = 0;
          let closing = 0;
          let activeDays = 0;

          // Opening is the opening of the first day of the week
          for (const sku of targetSkus) {
            opening += skuLedger[sku]?.[firstDay]?.opening || 0;
            closing += skuLedger[sku]?.[lastDay]?.closing || 0;
          }

          // Inbound and Outbound is sum of all days in this week
          daysInBucket.forEach(d => {
            const dayRow = dailySummary.find(r => r.date === d);
            if (dayRow) {
              inbound += dayRow.inbound;
              outbound += dayRow.outbound;
              if (dayRow.hasActivity) activeDays++;
            }
          });

          weeklySummary.push({
            week: bucket.label,
            dateRange: `${firstDay.substring(8, 10)}/${targetMonth} - ${lastDay.substring(8, 10)}/${targetMonth}/${targetYear}`,
            startDate: firstDay,
            endDate: lastDay,
            opening,
            inbound,
            outbound,
            netChange: inbound - outbound,
            closing,
            daysCount: daysInBucket.length,
            activeDaysCount: activeDays
          });
        }
      });
    }

    // Construct Detailed SKU by Day table
    const skuDailySummary: any[] = [];
    for (const d of filteredDates) {
      for (const sku of targetSkus) {
        const record = skuLedger[sku]?.[d] || { opening: 0, in: 0, out: 0, closing: 0 };
        // If viewing single day or day has activity, include it
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

    // Aggregate totals for the whole period
    let periodOpening = 0;
    let periodClosing = 0;
    let periodTotalIn = 0;
    let periodTotalOut = 0;

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

    const availableMonths = Array.from(new Set(allDatesSorted.map(d => d.substring(0, 7)))).sort().reverse();
    const availableDates = [...filteredDates].reverse();

    return NextResponse.json({
      period: {
        opening: periodOpening,
        inbound: periodTotalIn,
        outbound: periodTotalOut,
        netChange: periodTotalIn - periodTotalOut,
        closing: periodClosing,
      },
      targetMonth: `${targetYear}-${String(targetMonth).padStart(2, "0")}`,
      totalDaysInMonth: filteredDates.length,
      activeTransactionDaysCount,
      dailySummary,
      weeklySummary,
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
