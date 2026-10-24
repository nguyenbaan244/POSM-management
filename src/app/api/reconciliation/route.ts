import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const toYMD = (d: Date) => d.toISOString().split("T")[0];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const baselineDateParam = searchParams.get("baselineDate");
    const latestDateParam = searchParams.get("latestDate");
    const viewMode = searchParams.get("viewMode") || "sku"; // "sku" | "batch"
    const filter = searchParams.get("filter") || "all"; // "all" | "discrepancy" | "match"
    const search = searchParams.get("search") || "";

    // 1. Fetch available baseline files with metadata
    const baselineRows = await prisma.baselineInventory.findMany({
      select: { date: true, quantity: true, sku: true },
      orderBy: { date: "asc" }
    });

    const baselineDateMap = new Map<string, { count: number, totalQty: number, skus: Set<string> }>();
    for (const r of baselineRows) {
      const dStr = toYMD(r.date);
      if (!baselineDateMap.has(dStr)) {
        baselineDateMap.set(dStr, { count: 0, totalQty: 0, skus: new Set() });
      }
      const item = baselineDateMap.get(dStr)!;
      item.count++;
      item.totalQty += r.quantity;
      item.skus.add(r.sku);
    }

    const availableBaselineFiles = Array.from(baselineDateMap.entries()).map(([dStr, meta]) => ({
      date: dStr,
      rowCount: meta.count,
      skuCount: meta.skus.size,
      totalQty: meta.totalQty
    }));
    const availableBaselineDates = availableBaselineFiles.map(f => f.date);

    // 2. Fetch available latest snapshot files with metadata
    const latestRows = await prisma.latestInventorySnapshot.findMany({
      select: { date: true, quantity: true, sku: true },
      orderBy: { date: "desc" }
    });

    const latestDateMap = new Map<string, { count: number, totalQty: number, skus: Set<string> }>();
    for (const r of latestRows) {
      const dStr = toYMD(r.date);
      if (!latestDateMap.has(dStr)) {
        latestDateMap.set(dStr, { count: 0, totalQty: 0, skus: new Set() });
      }
      const item = latestDateMap.get(dStr)!;
      item.count++;
      item.totalQty += r.quantity;
      item.skus.add(r.sku);
    }

    const availableLatestFiles = Array.from(latestDateMap.entries()).map(([dStr, meta]) => ({
      date: dStr,
      rowCount: meta.count,
      skuCount: meta.skus.size,
      totalQty: meta.totalQty
    }));
    const availableLatestDates = availableLatestFiles.map(f => f.date);

    // Determine target dates
    const targetBaselineDateStr = baselineDateParam || availableBaselineDates[0] || "2026-10-01";
    const targetLatestDateStr = latestDateParam || availableLatestDates[0] || "2026-10-23";

    const baselineDateStart = new Date(`${targetBaselineDateStr}T00:00:00.000Z`);
    const latestDateEnd = new Date(`${targetLatestDateStr}T23:59:59.999Z`);

    // 3. Master Data for descriptions
    const masterData = await prisma.masterData.findMany();
    const descrMap = new Map<string, string>();
    masterData.forEach(m => descrMap.set(m.sku, m.descr));

    // 4. Fetch Baseline Inventory for targetBaselineDate
    const baselineItems = await prisma.baselineInventory.findMany({
      where: {
        date: {
          gte: baselineDateStart,
          lte: new Date(`${targetBaselineDateStr}T23:59:59.999Z`)
        }
      }
    });

    // Populate descriptions from baseline
    for (const b of baselineItems) {
      if (b.descr) descrMap.set(b.sku, b.descr);
    }

    // 5. Fetch Inbounds strictly between baselineDate and latestDate
    const inbounds = await prisma.inbound.findMany({
      where: {
        reversed: false,
        date: {
          gte: baselineDateStart,
          lte: latestDateEnd
        }
      }
    });

    for (const ib of inbounds) {
      if (ib.descr && !descrMap.has(ib.sku)) descrMap.set(ib.sku, ib.descr);
    }

    // 6. Fetch Outbounds strictly between baselineDate and latestDate
    const outbounds = await prisma.outbound.findMany({
      where: {
        reversed: false,
        date: {
          gte: baselineDateStart,
          lte: latestDateEnd
        }
      }
    });

    for (const ob of outbounds) {
      if (ob.descr && !descrMap.has(ob.sku)) descrMap.set(ob.sku, ob.descr);
    }

    // 7. Fetch Latest Inventory for targetLatestDate
    let latestItems = await prisma.latestInventorySnapshot.findMany({
      where: {
        date: {
          gte: new Date(`${targetLatestDateStr}T00:00:00.000Z`),
          lte: latestDateEnd
        }
      }
    });

    let isSnapshotEstimated = false;
    if (latestItems.length === 0) {
      // Fallback: only if user specifically picked current/today date and no snapshot exists
      isSnapshotEstimated = true;
      const activeBatches = await prisma.inventoryBatch.findMany();
      latestItems = activeBatches.map(b => ({
        id: b.id,
        date: latestDateEnd,
        account: b.account,
        sku: b.sku,
        descr: b.descr,
        batch: b.batch,
        quantity: b.quantity,
        createdAt: b.updatedAt
      }));
    }

    for (const item of latestItems) {
      if (item.descr && !descrMap.has(item.sku)) descrMap.set(item.sku, item.descr);
    }

    // ==========================================
    // BUILD SKU LEVEL RECONCILIATION
    // ==========================================
    const skuOldMap = new Map<string, number>();
    const skuInMap = new Map<string, number>();
    const skuOutMap = new Map<string, number>();
    const skuActualMap = new Map<string, number>();

    baselineItems.forEach(b => skuOldMap.set(b.sku, (skuOldMap.get(b.sku) || 0) + b.quantity));
    inbounds.forEach(i => skuInMap.set(i.sku, (skuInMap.get(i.sku) || 0) + i.quantity));
    outbounds.forEach(o => skuOutMap.set(o.sku, (skuOutMap.get(o.sku) || 0) + o.quantity));
    latestItems.forEach(l => skuActualMap.set(l.sku, (skuActualMap.get(l.sku) || 0) + l.quantity));

    const allSkus = new Set<string>([
      ...skuOldMap.keys(),
      ...skuInMap.keys(),
      ...skuOutMap.keys(),
      ...skuActualMap.keys()
    ]);

    const skuItems: any[] = [];
    let skuMatchedCount = 0;
    let skuDiscrepancyCount = 0;

    for (const sku of allSkus) {
      const descr = descrMap.get(sku) || sku;
      const oldQty = skuOldMap.get(sku) || 0;
      const inQty = skuInMap.get(sku) || 0;
      const outQty = skuOutMap.get(sku) || 0;
      const calculatedQty = oldQty + inQty - outQty;
      const actualQty = skuActualMap.get(sku) || 0;
      const variance = actualQty - calculatedQty;

      let status = "MATCH";
      let statusText = "Khớp 100%";
      let reason = "Khớp tuyệt đối giữa tồn cũ + nhập - xuất so với tồn mới";

      if (variance === 0) {
        skuMatchedCount++;
      } else {
        skuDiscrepancyCount++;
        if (variance > 0) {
          status = "OVER";
          statusText = `Lệch thừa (+${variance.toLocaleString()})`;
          reason = `Tồn mới nhiều hơn tính toán ${variance.toLocaleString()} chiếc (có thể do nhập chưa ghi sổ hoặc xuất thừa)`;
        } else {
          status = "UNDER";
          statusText = `Lệch thiếu (${variance.toLocaleString()})`;
          reason = `Tồn mới ít hơn tính toán ${Math.abs(variance).toLocaleString()} chiếc (có thể do hao hụt hoặc xuất chưa ghi sổ)`;
        }
      }

      skuItems.push({
        sku,
        descr,
        oldQty,
        inQty,
        outQty,
        calculatedQty,
        actualQty,
        variance,
        status,
        statusText,
        reason
      });
    }

    skuItems.sort((a, b) => a.sku.localeCompare(b.sku));

    // ==========================================
    // BUILD BATCH LEVEL RECONCILIATION
    // ==========================================
    const batchOldMap = new Map<string, number>();
    const batchInMap = new Map<string, number>();
    const batchOutMap = new Map<string, number>();
    const batchActualMap = new Map<string, number>();

    baselineItems.forEach(b => {
      const k = `${b.sku}__${(b.batch || "Chưa rõ").trim()}`;
      batchOldMap.set(k, (batchOldMap.get(k) || 0) + b.quantity);
    });
    inbounds.forEach(i => {
      const k = `${i.sku}__${(i.batch || "Chưa rõ").trim()}`;
      batchInMap.set(k, (batchInMap.get(k) || 0) + i.quantity);
    });
    outbounds.forEach(o => {
      const k = `${o.sku}__${(o.batch || "Chưa rõ").trim()}`;
      batchOutMap.set(k, (batchOutMap.get(k) || 0) + o.quantity);
    });
    latestItems.forEach(l => {
      const k = `${l.sku}__${(l.batch || "Chưa rõ").trim()}`;
      batchActualMap.set(k, (batchActualMap.get(k) || 0) + l.quantity);
    });

    const allBatchKeys = new Set<string>([
      ...batchOldMap.keys(),
      ...batchInMap.keys(),
      ...batchOutMap.keys(),
      ...batchActualMap.keys()
    ]);

    const batchItems: any[] = [];
    let batchMatchedCount = 0;
    let batchDiscrepancyCount = 0;

    for (const key of allBatchKeys) {
      const [sku, batch] = key.split("__");
      const descr = descrMap.get(sku) || sku;
      const oldQty = batchOldMap.get(key) || 0;
      const inQty = batchInMap.get(key) || 0;
      const outQty = batchOutMap.get(key) || 0;
      const calculatedQty = oldQty + inQty - outQty;
      const actualQty = batchActualMap.get(key) || 0;
      const variance = actualQty - calculatedQty;

      let status = "MATCH";
      let statusText = "Khớp 100%";
      let reason = "Khớp tuyệt đối theo lô sản xuất";

      if (variance === 0) {
        batchMatchedCount++;
      } else {
        batchDiscrepancyCount++;
        if (variance > 0) {
          status = "OVER";
          statusText = `Lệch thừa (+${variance.toLocaleString()})`;
          reason = `Lô ${batch} tồn mới nhiều hơn tính toán ${variance.toLocaleString()} chiếc`;
        } else {
          status = "UNDER";
          statusText = `Lệch thiếu (${variance.toLocaleString()})`;
          reason = `Lô ${batch} tồn mới ít hơn tính toán ${Math.abs(variance).toLocaleString()} chiếc`;
        }
      }

      batchItems.push({
        sku,
        descr,
        batch: batch || "Chưa rõ",
        oldQty,
        inQty,
        outQty,
        calculatedQty,
        actualQty,
        variance,
        status,
        statusText,
        reason
      });
    }

    batchItems.sort((a, b) => {
      if (a.sku !== b.sku) return a.sku.localeCompare(b.sku);
      return a.batch.localeCompare(b.batch);
    });

    // Determine which dataset to filter & return based on viewMode
    let activeItems = viewMode === "batch" ? batchItems : skuItems;

    // Filter by discrepancy / match
    if (filter === "discrepancy") {
      activeItems = activeItems.filter(i => i.variance !== 0);
    } else if (filter === "match") {
      activeItems = activeItems.filter(i => i.variance === 0);
    }

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      activeItems = activeItems.filter(i =>
        i.sku.toLowerCase().includes(q) ||
        i.descr.toLowerCase().includes(q) ||
        (i.batch && i.batch.toLowerCase().includes(q))
      );
    }

    // Compute totals
    const totalOld = skuItems.reduce((acc, i) => acc + i.oldQty, 0);
    const totalIn = skuItems.reduce((acc, i) => acc + i.inQty, 0);
    const totalOut = skuItems.reduce((acc, i) => acc + i.outQty, 0);
    const totalCalculated = skuItems.reduce((acc, i) => acc + i.calculatedQty, 0);
    const totalActual = skuItems.reduce((acc, i) => acc + i.actualQty, 0);
    const netVariance = totalActual - totalCalculated;

    return NextResponse.json({
      success: true,
      baselineDate: targetBaselineDateStr,
      latestDate: targetLatestDateStr,
      viewMode,
      isSnapshotEstimated,
      availableBaselineDates,
      availableLatestDates,
      availableBaselineFiles,
      availableLatestFiles,
      summary: {
        totalSkus: skuItems.length,
        totalBatches: batchItems.length,
        skuMatchedCount,
        skuDiscrepancyCount,
        batchMatchedCount,
        batchDiscrepancyCount,
        totalOld,
        totalIn,
        totalOut,
        totalCalculated,
        totalActual,
        netVariance
      },
      items: activeItems
    });

  } catch (error: any) {
    console.error("Reconciliation error:", error);
    return NextResponse.json({ error: error.message || "Lỗi khi tính toán đối soát" }, { status: 500 });
  }
}
