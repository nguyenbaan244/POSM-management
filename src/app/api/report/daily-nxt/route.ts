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

    // 1. Fetch current inventory, master data, inbounds, outbounds, snapshots and baselines
    const [inventoryList, masterDataList, inbounds, outbounds, snapshots, baselines] = await Promise.all([
      prisma.inventory.findMany({ orderBy: { sku: "asc" } }),
      prisma.masterData.findMany({ orderBy: { sku: "asc" } }),
      prisma.inbound.findMany({ where: { reversed: false }, orderBy: { date: "asc" } }),
      prisma.outbound.findMany({ where: { reversed: false }, orderBy: { date: "asc" } }),
      prisma.latestInventorySnapshot.findMany({ orderBy: { date: "asc" } }),
      prisma.baselineInventory.findMany({ orderBy: { date: "asc" } })
    ]);

    // Build SKU dictionary
    const skuMeta: Record<string, { descr: string, currentStock: number }> = {};
    for (const m of masterDataList) {
      skuMeta[m.sku] = { descr: m.descr, currentStock: 0 };
    }
    for (const b of baselines) {
      if (!skuMeta[b.sku]) skuMeta[b.sku] = { descr: b.descr, currentStock: 0 };
      else if (b.descr) skuMeta[b.sku].descr = b.descr;
    }
    for (const s of snapshots) {
      if (!skuMeta[s.sku]) skuMeta[s.sku] = { descr: s.descr, currentStock: 0 };
      else if (s.descr) skuMeta[s.sku].descr = s.descr;
    }
    for (const inv of inventoryList) {
      if (!skuMeta[inv.sku]) {
        skuMeta[inv.sku] = { descr: inv.descr, currentStock: inv.quantity };
      } else {
        skuMeta[inv.sku].currentStock = inv.quantity;
      }
    }

    // Build actual inventory snapshot map: [dateYMD][sku] => number
    // Lưu nhớ toàn bộ dữ liệu kiểm kê thực tế theo từng ngày (từ cả LatestInventorySnapshot và BaselineInventory)
    const actualStockMap: Record<string, Record<string, number>> = {};
    const datesWithActualUpload = new Set<string>();

    // Ưu tiên nạp baseline trước
    for (const b of baselines) {
      const d = toYMD(new Date(b.date));
      if (!actualStockMap[d]) actualStockMap[d] = {};
      actualStockMap[d][b.sku] = (actualStockMap[d][b.sku] || 0) + b.quantity;
      datesWithActualUpload.add(d);
    }

    // Sau đó nạp từ LatestInventorySnapshot (nếu ngày đó có upload tồn mới, ghi đè chính xác ngày đó)
    const snapshotDates = new Set<string>();
    for (const s of snapshots) {
      snapshotDates.add(toYMD(new Date(s.date)));
    }
    for (const d of snapshotDates) {
      actualStockMap[d] = {}; // Làm sạch để nạp chính xác từ snapshot của ngày đó
    }
    for (const s of snapshots) {
      const d = toYMD(new Date(s.date));
      actualStockMap[d][s.sku] = (actualStockMap[d][s.sku] || 0) + s.quantity;
      datesWithActualUpload.add(d);
    }

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
    const firstMonthDay = monthCalendarDays[0];

    // Collect all transaction dates
    const dateSet = new Set<string>();
    inbounds.forEach(ib => dateSet.add(toYMD(new Date(ib.date))));
    outbounds.forEach(ob => dateSet.add(toYMD(new Date(ob.date))));
    monthCalendarDays.forEach(d => dateSet.add(d));
    datesWithActualUpload.forEach(d => dateSet.add(d));

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

    // ========================================================
    // TỒN ĐẦU KỲ PHẢI LÀ DATA LÀM GỐC:
    // Nhóm baseline theo từng ngày
    const baselineByDateMap = new Map<string, Map<string, number>>();
    for (const b of baselines) {
      const d = toYMD(new Date(b.date));
      if (!baselineByDateMap.has(d)) {
        baselineByDateMap.set(d, new Map<string, number>());
      }
      const bMap = baselineByDateMap.get(d)!;
      bMap.set(b.sku, (bMap.get(b.sku) || 0) + b.quantity);
    }

    const availableBaselineDates = Array.from(baselineByDateMap.keys()).sort();

    // Xác định ngày Baseline làm gốc (Anchor Date) cho tháng này:
    // Ưu tiên 1: Baseline nằm trong tháng đang xem (ví dụ: ngày 22/10 hoặc ngày 01/10)
    // Ưu tiên 2: Baseline gần nhất trước tháng đang xem (ví dụ: 30/09)
    let anchorBaselineDate: string | null = null;
    const lastDayOfMonth = monthCalendarDays[monthCalendarDays.length - 1];
    const baselinesInMonth = availableBaselineDates.filter(d => d >= firstMonthDay && d <= lastDayOfMonth);

    if (baselinesInMonth.length > 0) {
      anchorBaselineDate = baselinesInMonth[baselinesInMonth.length - 1];
    } else {
      const baselinesBeforeMonth = availableBaselineDates.filter(d => d < firstMonthDay);
      if (baselinesBeforeMonth.length > 0) {
        anchorBaselineDate = baselinesBeforeMonth[baselinesBeforeMonth.length - 1];
      }
    }

    const anchorStockMap = anchorBaselineDate ? (baselineByDateMap.get(anchorBaselineDate) || new Map<string, number>()) : new Map<string, number>();

    // Xây dựng Timeline tính toán Lý Thuyết với TỒN ĐẦU KỲ LÀM GỐC:
    // Nếu tồn đầu kỳ không phải là ngày đầu tháng (ví dụ: ngày 22/10), lấy ngày đó làm gốc để tính ngược lên đầu tháng và tính xuống ngày hiện tại
    const skuLedger: Record<string, Record<string, {
      opening: number;
      in: number;
      out: number;
      theoreticalClosing: number;
      closing: number;
      actualClosing: number | null;
      variance: number | null;
      hasActual: boolean;
    }>> = {};

    for (const sku of allSkus) {
      skuLedger[sku] = {};
      const baseQty = anchorStockMap.get(sku) || 0;

      if (!anchorBaselineDate) {
        // Trường hợp không có baseline trong hệ thống: bắt đầu từ 0
        let running = 0;
        for (const d of monthCalendarDays) {
          const inQty = ibMap[d]?.[sku] || 0;
          const outQty = obMap[d]?.[sku] || 0;
          const theoreticalClosing = running + inQty - outQty;
          const hasActual = datesWithActualUpload.has(d);
          const actualClosing = hasActual ? (actualStockMap[d]?.[sku] ?? 0) : null;
          const variance = actualClosing !== null ? actualClosing - theoreticalClosing : null;

          skuLedger[sku][d] = {
            opening: running,
            in: inQty,
            out: outQty,
            theoreticalClosing,
            closing: theoreticalClosing,
            actualClosing,
            variance,
            hasActual
          };
          running = theoreticalClosing;
        }
      } else if (anchorBaselineDate === firstMonthDay) {
        // Trường hợp 1: Tồn đầu kỳ chính là ngày đầu tháng (01/tháng)
        let running = baseQty;
        for (const d of monthCalendarDays) {
          const inQty = ibMap[d]?.[sku] || 0;
          const outQty = obMap[d]?.[sku] || 0;
          const theoreticalClosing = running + inQty - outQty;
          const hasActual = datesWithActualUpload.has(d);
          const actualClosing = hasActual ? (actualStockMap[d]?.[sku] ?? 0) : null;
          const variance = actualClosing !== null ? actualClosing - theoreticalClosing : null;

          skuLedger[sku][d] = {
            opening: running,
            in: inQty,
            out: outQty,
            theoreticalClosing,
            closing: theoreticalClosing,
            actualClosing,
            variance,
            hasActual
          };
          running = theoreticalClosing;
        }
      } else if (anchorBaselineDate > firstMonthDay && anchorBaselineDate <= lastDayOfMonth) {
        // Trường hợp 2: Tồn đầu kỳ không phải là ngày đầu tháng (ví dụ: ngày 22/10)
        // Lấy ngày đó làm gốc: Tồn cuối ngày đó = baseQty, rồi tính ngược lên đầu tháng và tính xuôi xuống ngày hiện tại
        const anchorIdx = monthCalendarDays.indexOf(anchorBaselineDate);
        
        // Điểm gốc tại ngày anchorBaselineDate:
        const inAtAnchor = ibMap[anchorBaselineDate]?.[sku] || 0;
        const outAtAnchor = obMap[anchorBaselineDate]?.[sku] || 0;
        const closingAtAnchor = baseQty;
        const openingAtAnchor = closingAtAnchor - inAtAnchor + outAtAnchor;
        
        const hasActualAtAnchor = datesWithActualUpload.has(anchorBaselineDate);
        const actualClosingAtAnchor = hasActualAtAnchor ? (actualStockMap[anchorBaselineDate]?.[sku] ?? 0) : null;

        skuLedger[sku][anchorBaselineDate] = {
          opening: openingAtAnchor,
          in: inAtAnchor,
          out: outAtAnchor,
          theoreticalClosing: closingAtAnchor,
          closing: closingAtAnchor,
          actualClosing: actualClosingAtAnchor,
          variance: actualClosingAtAnchor !== null ? actualClosingAtAnchor - closingAtAnchor : null,
          hasActual: hasActualAtAnchor
        };

        // A. TÍNH NGƯỢC LÊN ĐẦU THÁNG (Reverse rollback from anchorIdx - 1 down to 0)
        for (let i = anchorIdx - 1; i >= 0; i--) {
          const d = monthCalendarDays[i];
          const dNext = monthCalendarDays[i + 1];
          const theoreticalClosing = skuLedger[sku][dNext].opening;
          const inQty = ibMap[d]?.[sku] || 0;
          const outQty = obMap[d]?.[sku] || 0;
          const opening = theoreticalClosing - inQty + outQty;

          const hasActual = datesWithActualUpload.has(d);
          const actualClosing = hasActual ? (actualStockMap[d]?.[sku] ?? 0) : null;
          const variance = actualClosing !== null ? actualClosing - theoreticalClosing : null;

          skuLedger[sku][d] = {
            opening,
            in: inQty,
            out: outQty,
            theoreticalClosing,
            closing: theoreticalClosing,
            actualClosing,
            variance,
            hasActual
          };
        }

        // B. TÍNH XUỐNG NGÀY HIỆN TẠI VÀ CUỐI THÁNG (Forward roll from anchorIdx + 1 to end of month)
        for (let i = anchorIdx + 1; i < monthCalendarDays.length; i++) {
          const d = monthCalendarDays[i];
          const dPrev = monthCalendarDays[i - 1];
          const opening = skuLedger[sku][dPrev].theoreticalClosing;
          const inQty = ibMap[d]?.[sku] || 0;
          const outQty = obMap[d]?.[sku] || 0;
          const theoreticalClosing = opening + inQty - outQty;

          const hasActual = datesWithActualUpload.has(d);
          const actualClosing = hasActual ? (actualStockMap[d]?.[sku] ?? 0) : null;
          const variance = actualClosing !== null ? actualClosing - theoreticalClosing : null;

          skuLedger[sku][d] = {
            opening,
            in: inQty,
            out: outQty,
            theoreticalClosing,
            closing: theoreticalClosing,
            actualClosing,
            variance,
            hasActual
          };
        }
      } else {
        // Trường hợp 3: anchorBaselineDate < firstMonthDay (nằm ở tháng trước)
        // Cuốn chiếu từ anchorBaselineDate tiến vào tháng này
        let cur = baseQty;
        for (const d of allDatesSorted) {
          if (d > anchorBaselineDate && d < firstMonthDay) {
            cur = cur + (ibMap[d]?.[sku] || 0) - (obMap[d]?.[sku] || 0);
          }
        }
        let running = cur;
        for (const d of monthCalendarDays) {
          const inQty = ibMap[d]?.[sku] || 0;
          const outQty = obMap[d]?.[sku] || 0;
          const theoreticalClosing = running + inQty - outQty;
          const hasActual = datesWithActualUpload.has(d);
          const actualClosing = hasActual ? (actualStockMap[d]?.[sku] ?? 0) : null;
          const variance = actualClosing !== null ? actualClosing - theoreticalClosing : null;

          skuLedger[sku][d] = {
            opening: running,
            in: inQty,
            out: outQty,
            theoreticalClosing,
            closing: theoreticalClosing,
            actualClosing,
            variance,
            hasActual
          };
          running = theoreticalClosing;
        }
      }
    }

    // Filter dates if specified
    let filteredDates = monthCalendarDays;
    if (selectedDate && selectedDate !== "all") {
      filteredDates = filteredDates.filter(d => d === selectedDate);
    }

    // Filter SKUs if specified
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
      let theoreticalClosing = 0;
      let actualClosing: number | null = null;
      const hasActual = datesWithActualUpload.has(d);

      for (const sku of targetSkus) {
        const record = skuLedger[sku]?.[d] || {
          opening: 0,
          in: 0,
          out: 0,
          theoreticalClosing: 0,
          closing: 0,
          actualClosing: null,
          variance: null,
          hasActual: false
        };
        opening += record.opening;
        inbound += record.in;
        outbound += record.out;
        theoreticalClosing += record.theoreticalClosing;
        if (hasActual && record.actualClosing !== null) {
          if (actualClosing === null) actualClosing = 0;
          actualClosing += record.actualClosing;
        }
      }

      const variance = actualClosing !== null ? actualClosing - theoreticalClosing : null;

      if (inbound > 0 || outbound > 0) {
        activeTransactionDaysCount++;
      }

      return {
        date: d,
        opening,
        inbound,
        outbound,
        netChange: inbound - outbound,
        theoreticalClosing,
        closing: theoreticalClosing,
        actualClosing,
        variance,
        hasActual,
        hasActivity: inbound > 0 || outbound > 0
      };
    });

    // Construct Weekly Summary (Tuần 1..Tuần 5)
    const weeklySummary: any[] = [];
    if (filteredDates.length >= 28) {
      const weekBuckets = [
        { label: "Tuần 1", startDay: 1, endDay: 7 },
        { label: "Tuần 2", startDay: 8, endDay: 14 },
        { label: "Tuần 3", startDay: 15, endDay: 21 },
        { label: "Tuần 4", startDay: 22, endDay: 28 },
        { label: "Tuần 5", startDay: 29, endDay: monthCalendarDays.length }
      ];

      weekBuckets.forEach((bucket) => {
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
          let theoreticalClosing = 0;
          let actualClosing: number | null = null;
          let activeDays = 0;

          for (const sku of targetSkus) {
            opening += skuLedger[sku]?.[firstDay]?.opening || 0;
            theoreticalClosing += skuLedger[sku]?.[lastDay]?.theoreticalClosing || 0;
          }

          // Lấy tồn thực tế của ngày cuối cùng trong tuần có kiểm kê
          for (let i = daysInBucket.length - 1; i >= 0; i--) {
            const dayRow = dailySummary.find(r => r.date === daysInBucket[i]);
            if (dayRow && dayRow.actualClosing !== null) {
              actualClosing = dayRow.actualClosing;
              break;
            }
          }

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
            theoreticalClosing,
            closing: theoreticalClosing,
            actualClosing,
            variance: actualClosing !== null ? actualClosing - theoreticalClosing : null,
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
        const record = skuLedger[sku]?.[d] || {
          opening: 0,
          in: 0,
          out: 0,
          theoreticalClosing: 0,
          closing: 0,
          actualClosing: null,
          variance: null,
          hasActual: false
        };
        if (record.opening > 0 || record.in > 0 || record.out > 0 || record.theoreticalClosing > 0 || record.hasActual) {
          skuDailySummary.push({
            date: d,
            sku,
            descr: skuMeta[sku]?.descr || sku,
            opening: record.opening,
            inbound: record.in,
            outbound: record.out,
            netChange: record.in - record.out,
            theoreticalClosing: record.theoreticalClosing,
            closing: record.theoreticalClosing,
            actualClosing: record.actualClosing,
            variance: record.variance,
            hasActual: record.hasActual
          });
        }
      }
    }

    // Aggregate totals for the period
    let periodOpening = 0;
    let periodClosing = 0;
    let periodTotalIn = 0;
    let periodTotalOut = 0;
    let periodActualClosing: number | null = null;

    if (dailySummary.length > 0) {
      periodOpening = dailySummary[0].opening;
      periodClosing = dailySummary[dailySummary.length - 1].theoreticalClosing;
      periodTotalIn = dailySummary.reduce((sum, item) => sum + item.inbound, 0);
      periodTotalOut = dailySummary.reduce((sum, item) => sum + item.outbound, 0);

      for (let i = dailySummary.length - 1; i >= 0; i--) {
        if (dailySummary[i].actualClosing !== null) {
          periodActualClosing = dailySummary[i].actualClosing;
          break;
        }
      }
    }

    // SKU Totals in the filtered period
    const skuTotals = targetSkus.map(sku => {
      let skuIn = 0;
      let skuOut = 0;
      let firstOpening = 0;
      let lastTheoreticalClosing = 0;
      let lastActualClosing: number | null = null;

      if (filteredDates.length > 0) {
        const firstDate = filteredDates[0];
        const lastDate = filteredDates[filteredDates.length - 1];
        firstOpening = skuLedger[sku]?.[firstDate]?.opening ?? 0;
        lastTheoreticalClosing = skuLedger[sku]?.[lastDate]?.theoreticalClosing ?? 0;

        for (const d of filteredDates) {
          skuIn += skuLedger[sku]?.[d]?.in ?? 0;
          skuOut += skuLedger[sku]?.[d]?.out ?? 0;
        }

        for (let i = filteredDates.length - 1; i >= 0; i--) {
          const rec = skuLedger[sku]?.[filteredDates[i]];
          if (rec && rec.actualClosing !== null) {
            lastActualClosing = rec.actualClosing;
            break;
          }
        }
      }

      return {
        sku,
        descr: skuMeta[sku]?.descr || sku,
        opening: firstOpening,
        inbound: skuIn,
        outbound: skuOut,
        netChange: skuIn - skuOut,
        theoreticalClosing: lastTheoreticalClosing,
        closing: lastTheoreticalClosing,
        actualClosing: lastActualClosing,
        variance: lastActualClosing !== null ? lastActualClosing - lastTheoreticalClosing : null,
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
        theoreticalClosing: periodClosing,
        closing: periodClosing,
        actualClosing: periodActualClosing,
        variance: periodActualClosing !== null ? periodActualClosing - periodClosing : null
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
