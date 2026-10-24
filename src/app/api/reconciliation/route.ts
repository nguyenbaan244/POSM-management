import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const toYMD = (d: Date) => d.toISOString().split("T")[0];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const baselineDateParam = searchParams.get("baselineDate");
    const latestDateParam = searchParams.get("latestDate");
    const filter = searchParams.get("filter") || "all"; // "all" | "discrepancy" | "match"
    const search = searchParams.get("search") || "";

    // 1. Fetch available baseline dates
    const baselineDateRows = await prisma.baselineInventory.findMany({
      select: { date: true },
      distinct: ["date"],
      orderBy: { date: "asc" }
    });
    const availableBaselineDates = baselineDateRows.map(r => toYMD(r.date));

    // 2. Fetch available latest snapshot dates
    const latestDateRows = await prisma.latestInventorySnapshot.findMany({
      select: { date: true },
      distinct: ["date"],
      orderBy: { date: "desc" }
    });
    const availableLatestDates = latestDateRows.map(r => toYMD(r.date));

    // Determine target dates
    const targetBaselineDateStr = baselineDateParam || availableBaselineDates[0] || "2026-10-01";
    const targetLatestDateStr = latestDateParam || availableLatestDates[0] || "2026-10-23";

    const baselineDateStart = new Date(`${targetBaselineDateStr}T00:00:00.000Z`);
    const latestDateEnd = new Date(`${targetLatestDateStr}T23:59:59.999Z`);

    // 3. Fetch Master Data for descriptions
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

    const oldStockMap = new Map<string, { descr: string, qty: number }>();
    for (const b of baselineItems) {
      const key = `${b.sku}__${(b.batch || "Chưa rõ").trim()}`;
      oldStockMap.set(key, {
        descr: b.descr,
        qty: (oldStockMap.get(key)?.qty || 0) + b.quantity
      });
      if (b.descr) descrMap.set(b.sku, b.descr);
    }

    // 5. Fetch Inbounds between baselineDate and latestDate
    const inbounds = await prisma.inbound.findMany({
      where: {
        reversed: false,
        date: {
          gte: baselineDateStart,
          lte: latestDateEnd
        }
      }
    });

    const inMap = new Map<string, number>();
    for (const ib of inbounds) {
      const key = `${ib.sku}__${(ib.batch || "Chưa rõ").trim()}`;
      inMap.set(key, (inMap.get(key) || 0) + ib.quantity);
      if (ib.descr && !descrMap.has(ib.sku)) descrMap.set(ib.sku, ib.descr);
    }

    // 6. Fetch Outbounds between baselineDate and latestDate
    const outbounds = await prisma.outbound.findMany({
      where: {
        reversed: false,
        date: {
          gte: baselineDateStart,
          lte: latestDateEnd
        }
      }
    });

    const outMap = new Map<string, number>();
    for (const ob of outbounds) {
      const key = `${ob.sku}__${(ob.batch || "Chưa rõ").trim()}`;
      outMap.set(key, (outMap.get(key) || 0) + ob.quantity);
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

    // Fallback if no snapshot for that exact date: use active InventoryBatch
    if (latestItems.length === 0) {
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

    const actualStockMap = new Map<string, { descr: string, qty: number }>();
    for (const item of latestItems) {
      const key = `${item.sku}__${(item.batch || "Chưa rõ").trim()}`;
      actualStockMap.set(key, {
        descr: item.descr,
        qty: (actualStockMap.get(key)?.qty || 0) + item.quantity
      });
      if (item.descr && !descrMap.has(item.sku)) descrMap.set(item.sku, item.descr);
    }

    // 8. Combine all keys across oldStock, inbounds, outbounds, actualStock
    const allKeys = new Set<string>([
      ...oldStockMap.keys(),
      ...inMap.keys(),
      ...outMap.keys(),
      ...actualStockMap.keys()
    ]);

    const items: any[] = [];
    let totalOld = 0;
    let totalIn = 0;
    let totalOut = 0;
    let totalCalculated = 0;
    let totalActual = 0;
    let matchedCount = 0;
    let discrepancyCount = 0;

    for (const key of allKeys) {
      const [sku, batch] = key.split("__");
      const descr = descrMap.get(sku) || oldStockMap.get(key)?.descr || actualStockMap.get(key)?.descr || sku;

      const oldQty = oldStockMap.get(key)?.qty || 0;
      const inQty = inMap.get(key) || 0;
      const outQty = outMap.get(key) || 0;
      const calculatedQty = oldQty + inQty - outQty;
      const actualQty = actualStockMap.get(key)?.qty || 0;
      const variance = actualQty - calculatedQty;

      totalOld += oldQty;
      totalIn += inQty;
      totalOut += outQty;
      totalCalculated += calculatedQty;
      totalActual += actualQty;

      let status = "MATCH";
      let statusText = "Khớp 100%";

      if (variance === 0) {
        matchedCount++;
      } else {
        discrepancyCount++;
        if (variance > 0) {
          status = "OVER";
          statusText = `Lệch thừa (+${variance.toLocaleString()})`;
        } else {
          status = "UNDER";
          statusText = `Lệch thiếu (${variance.toLocaleString()})`;
        }
      }

      items.push({
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
        statusText
      });
    }

    // Sort by SKU asc, then batch asc
    items.sort((a, b) => {
      if (a.sku !== b.sku) return a.sku.localeCompare(b.sku);
      return a.batch.localeCompare(b.batch);
    });

    // Apply Filter
    let filteredItems = items;
    if (filter === "discrepancy") {
      filteredItems = filteredItems.filter(i => i.variance !== 0);
    } else if (filter === "match") {
      filteredItems = filteredItems.filter(i => i.variance === 0);
    }

    // Apply Search
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      filteredItems = filteredItems.filter(i => 
        i.sku.toLowerCase().includes(q) ||
        i.descr.toLowerCase().includes(q) ||
        i.batch.toLowerCase().includes(q)
      );
    }

    return NextResponse.json({
      success: true,
      baselineDate: targetBaselineDateStr,
      latestDate: targetLatestDateStr,
      availableBaselineDates,
      availableLatestDates,
      summary: {
        totalItems: items.length,
        matchedCount,
        discrepancyCount,
        totalOld,
        totalIn,
        totalOut,
        totalCalculated,
        totalActual,
        netVariance: totalActual - totalCalculated
      },
      items: filteredItems
    });

  } catch (error: any) {
    console.error("Reconciliation error:", error);
    return NextResponse.json({ error: error.message || "Failed to calculate reconciliation" }, { status: 500 });
  }
}
