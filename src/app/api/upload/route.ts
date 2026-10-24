import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as xlsx from "xlsx";
import { logAction } from "@/lib/logger";

function parseExcelDate(serial: any): Date {
  if (!serial) return new Date();
  if (typeof serial === "number") {
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    return new Date(utc_value * 1000);
  }
  if (typeof serial === "string") {
    const s = serial.trim();
    // Check format DD/MM/YYYY or DD-MM-YYYY
    const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dmy) {
      return new Date(parseInt(dmy[3], 10), parseInt(dmy[2], 10) - 1, parseInt(dmy[1], 10));
    }
  }
  const d = new Date(serial);
  return isNaN(d.getTime()) ? new Date() : d;
}

const toYMD = (d: Date) => d.toISOString().split("T")[0];

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const format = (formData.get("format") as string) || "inbound";
    const snapshotDateParam = (formData.get("snapshotDate") as string) || "";

    if (!file) {
      return NextResponse.json({ error: "Vui lòng chọn file tải lên" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = xlsx.read(buffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rows: any[] = xlsx.utils.sheet_to_json(worksheet);

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "File tải lên không có dữ liệu" }, { status: 400 });
    }

    let importedCount = 0;
    let skippedCount = 0;
    let totalQty = 0;
    const errors: string[] = [];

    // ==========================================
    // 1. INBOUND (Nhập kho) - Tự động đối soát, không ghi đè, chỉ ghi thêm bản ghi mới
    // ==========================================
    if (format === "inbound") {
      // Load all existing inbounds for deduplication
      const existingInbounds = await prisma.inbound.findMany({
        where: { reversed: false },
        select: { date: true, orderCode: true, sku: true, quantity: true, batch: true }
      });

      const existingSet = new Set<string>();
      for (const ib of existingInbounds) {
        const key = `${toYMD(new Date(ib.date))}|${ib.orderCode.trim().toLowerCase()}|${ib.sku.trim().toLowerCase()}|${ib.quantity}|${(ib.batch || "").trim().toLowerCase()}`;
        existingSet.add(key);
      }

      const newRecords: any[] = [];

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const sku = String(r["Sku"] || r["SKU"] || r["sku"] || "").trim();
        const descr = String(r["DESCR"] || r["Description"] || r["descr"] || "").trim();
        const qty = Number(r["Qty Piece"] || r["Quantity"] || r["Qty"] || r["quantity"] || 0);
        const poNumber = r["PO Number"] || r["PONumber"] || r["PO"] || "";
        const receiptKey = r["ReceiptKey"] || r["Receipt Key"] || "";
        const orderCode = String(poNumber || receiptKey || `IB_${Date.now()}_${i + 1}`).trim();
        const rawDate = r["Date Received"] || r["Date"] || r["date"];
        const date = parseExcelDate(rawDate);
        const supplier = r["Supplier"] || r["supplier"] || "";
        const batch = String(r["Batch"] || r["batch"] || "").trim();
        const status = String(r["Status"] || "NORMAL");
        const remark = [
          supplier ? `NCC: ${supplier}` : "",
          batch ? `Lô: ${batch}` : "",
          receiptKey ? `Receipt: ${receiptKey}` : ""
        ].filter(Boolean).join(" | ");

        if (!sku || isNaN(qty) || qty <= 0) {
          errors.push(`Dòng ${i + 2}: SKU hoặc số lượng không hợp lệ (${qty})`);
          continue;
        }

        const rowKey = `${toYMD(date)}|${orderCode.toLowerCase()}|${sku.toLowerCase()}|${qty}|${batch.toLowerCase()}`;

        if (existingSet.has(rowKey)) {
          // Record already exists in DB -> skip!
          skippedCount++;
        } else {
          // New record -> add
          existingSet.add(rowKey); // prevent duplicate rows inside the same uploaded file
          totalQty += qty;
          newRecords.push({
            orderCode,
            account: "Danone",
            reversed: false,
            date,
            sku,
            descr: descr || sku,
            quantity: qty,
            batch,
            status,
            remark,
            createdBy: "Excel Upload"
          });
        }
      }

      // Batch insert newly discovered records
      for (let i = 0; i < newRecords.length; i += 50) {
        const chunk = newRecords.slice(i, i + 50);
        await prisma.inbound.createMany({ data: chunk });
      }

      // Update inventory and batch stock for new records
      for (const item of newRecords) {
        await prisma.inventory.upsert({
          where: { sku_account: { sku: item.sku, account: "Danone" } },
          update: { quantity: { increment: item.quantity }, descr: item.descr },
          create: { sku: item.sku, account: "Danone", descr: item.descr, quantity: item.quantity }
        });
        await prisma.masterData.upsert({
          where: { sku_account: { sku: item.sku, account: "Danone" } },
          update: { descr: item.descr },
          create: { sku: item.sku, account: "Danone", descr: item.descr }
        });

        if (item.batch) {
          await prisma.inventoryBatch.upsert({
            where: { sku_account_batch: { sku: item.sku, account: "Danone", batch: item.batch } },
            update: { quantity: { increment: item.quantity }, descr: item.descr },
            create: { sku: item.sku, account: "Danone", descr: item.descr, batch: item.batch, quantity: item.quantity }
          });
        }
      }

      importedCount = newRecords.length;
      await logAction("UPLOAD_INBOUND", `Đã kiểm tra file nhập kho: Thêm mới ${importedCount} dòng, Đã có sẵn ${skippedCount} dòng (bỏ qua).`);

      return NextResponse.json({
        success: true,
        format,
        totalRows: rows.length,
        importedCount,
        skippedCount,
        totalQty,
        errors: errors.slice(0, 5),
        message: `Đã đối soát xong: Thêm mới ${importedCount} bản ghi (+${totalQty.toLocaleString()} chiếc). Đã có sẵn ${skippedCount} bản ghi trong dữ liệu cũ (tự động bỏ qua không ghi đè).`
      });

    // ==========================================
    // 2. OUTBOUND (Xuất kho) - Tự động đối soát, không ghi đè, chỉ ghi thêm bản ghi mới
    // ==========================================
    } else if (format === "outbound") {
      const existingOutbounds = await prisma.outbound.findMany({
        where: { reversed: false },
        select: { date: true, orderCode: true, sku: true, quantity: true, batch: true }
      });

      const existingSet = new Set<string>();
      for (const ob of existingOutbounds) {
        const key = `${toYMD(new Date(ob.date))}|${ob.orderCode.trim().toLowerCase()}|${ob.sku.trim().toLowerCase()}|${ob.quantity}|${(ob.batch || "").trim().toLowerCase()}`;
        existingSet.add(key);
      }

      const newRecords: any[] = [];

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const sku = String(r["Sku"] || r["SKU"] || r["sku"] || "").trim();
        const descr = String(r["Description"] || r["DESCR"] || r["descr"] || "").trim();
        const qty = Number(r["Total Qty Pcs"] || r["Quantity"] || r["Qty"] || r["quantity"] || 0);
        const saleOrder = r["Sale Order #"] || r["Sale Order"] || r["Order Code"] || "";
        const customerPo = r["Customer PO"] || r["CustomerPO"] || "";
        const orderKey = r["Order Key"] || "";
        const orderCode = String(saleOrder || customerPo || orderKey || `OB_${Date.now()}_${i + 1}`).trim();
        const rawDate = r["ShipDate"] || r["Date"] || r["date"];
        const date = parseExcelDate(rawDate);
        const batch = String(r["Batch"] || r["batch"] || "").trim();
        const status = String(r["DefectiveCode"] || "NORM");
        const fullRemark = r["Remark"] || r["remark"] || "";
        const remark = [
          customerPo ? `PO: ${customerPo}` : "",
          batch ? `Lô: ${batch}` : "",
          fullRemark
        ].filter(Boolean).join(" | ");

        if (!sku || isNaN(qty) || qty <= 0) {
          errors.push(`Dòng ${i + 2}: SKU hoặc số lượng không hợp lệ (${qty})`);
          continue;
        }

        const rowKey = `${toYMD(date)}|${orderCode.toLowerCase()}|${sku.toLowerCase()}|${qty}|${batch.toLowerCase()}`;

        if (existingSet.has(rowKey)) {
          // Already in DB -> skip!
          skippedCount++;
        } else {
          // New record -> add!
          existingSet.add(rowKey);
          totalQty += qty;
          newRecords.push({
            orderCode,
            account: "Danone",
            reversed: false,
            date,
            sku,
            descr: descr || sku,
            quantity: qty,
            batch,
            status,
            remark,
            createdBy: "Excel Upload"
          });
        }
      }

      // Batch insert newly discovered records
      for (let i = 0; i < newRecords.length; i += 50) {
        const chunk = newRecords.slice(i, i + 50);
        await prisma.outbound.createMany({ data: chunk });
      }

      // Deduct from inventory and batch stock for new records
      for (const item of newRecords) {
        await prisma.inventory.upsert({
          where: { sku_account: { sku: item.sku, account: "Danone" } },
          update: { quantity: { decrement: item.quantity } },
          create: { sku: item.sku, account: "Danone", descr: item.descr, quantity: 0 }
        });

        if (item.batch) {
          await prisma.inventoryBatch.upsert({
            where: { sku_account_batch: { sku: item.sku, account: "Danone", batch: item.batch } },
            update: { quantity: { decrement: item.quantity } },
            create: { sku: item.sku, account: "Danone", descr: item.descr, batch: item.batch, quantity: 0 }
          });
        }
      }

      importedCount = newRecords.length;
      await logAction("UPLOAD_OUTBOUND", `Đã kiểm tra file xuất kho: Thêm mới ${importedCount} dòng, Đã có sẵn ${skippedCount} dòng (bỏ qua).`);

      return NextResponse.json({
        success: true,
        format,
        totalRows: rows.length,
        importedCount,
        skippedCount,
        totalQty,
        errors: errors.slice(0, 5),
        message: `Đã đối soát xong: Thêm mới ${importedCount} bản ghi (-${totalQty.toLocaleString()} chiếc). Đã có sẵn ${skippedCount} bản ghi trong dữ liệu cũ (tự động bỏ qua không ghi đè).`
      });

    // ==========================================
    // 3. TỒN KHO CŨ / TỒN ĐẦU KỲ (Baseline Inventory - Thay thế Danh mục SKU)
    // ==========================================
    } else if (format === "baseline-inventory" || format === "master-data") {
      const baselineDate = snapshotDateParam ? new Date(snapshotDateParam) : new Date("2026-10-01");
      const dateYMD = toYMD(baselineDate);

      // Aggregation maps
      const batchMap = new Map<string, { sku: string, descr: string, batch: string, quantity: number }>();

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const sku = String(r["Sku"] || r["SKU"] || r["sku"] || "").trim();
        const descr = String(r["DESCR"] || r["Description"] || r["descr"] || "").trim();
        const batch = String(r["Batch"] || r["BATCH"] || r["batch"] || r["Lot"] || r["LOT"] || r["BatchNo"] || "Chưa rõ").trim();
        const qty = Number(r["Qty"] || r["Quantity"] || r["quantity"] || r["Qty Piece"] || 0);

        if (!sku) continue;

        const key = `${sku}__${batch}`;
        if (!batchMap.has(key)) {
          batchMap.set(key, { sku, descr: descr || sku, batch, quantity: 0 });
        }
        const item = batchMap.get(key)!;
        item.quantity += qty;
        if (descr && item.descr === sku) item.descr = descr;
      }

      // Clear existing baseline for this date and insert fresh
      await prisma.baselineInventory.deleteMany({
        where: { date: baselineDate, account: "Danone" }
      });

      const recordsToInsert = Array.from(batchMap.values()).map(item => ({
        date: baselineDate,
        account: "Danone",
        sku: item.sku,
        descr: item.descr,
        batch: item.batch,
        quantity: item.quantity
      }));

      for (let i = 0; i < recordsToInsert.length; i += 50) {
        await prisma.baselineInventory.createMany({ data: recordsToInsert.slice(i, i + 50) });
      }

      // Also upsert to masterData so descriptions are permanently available
      for (const item of batchMap.values()) {
        totalQty += item.quantity;
        await prisma.masterData.upsert({
          where: { sku_account: { sku: item.sku, account: "Danone" } },
          update: { descr: item.descr },
          create: { sku: item.sku, account: "Danone", descr: item.descr }
        });
      }

      importedCount = batchMap.size;
      await logAction("UPLOAD_BASELINE_INVENTORY", `Đã lưu tồn kho cũ / đầu kỳ ngày ${dateYMD}: ${importedCount} mục (Tổng SL: ${totalQty})`);

      return NextResponse.json({
        success: true,
        format: "baseline-inventory",
        snapshotDate: dateYMD,
        importedCount,
        totalQty,
        message: `Đã thiết lập thành công Tồn kho cũ / Tồn đầu kỳ ngày ${dateYMD}: ${importedCount} mã SKU/Lô. Tổng số lượng: ${totalQty.toLocaleString()} chiếc.`
      });

    // ==========================================
    // 4. TỒN KHO MỚI NHẤT (Latest Inventory - Không bắt buộc & Có kiểm tra lệch tồn)
    // ==========================================
    } else if (format === "inventory") {
      const snapshotDate = snapshotDateParam ? new Date(snapshotDateParam) : new Date();
      const dateYMD = toYMD(snapshotDate);

      const skuAgg = new Map<string, { sku: string, descr: string, quantity: number }>();
      const batchAgg = new Map<string, { sku: string, descr: string, batch: string, quantity: number, mfgDate?: string, expDate?: string }>();

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const sku = String(r["Sku"] || r["SKU"] || r["sku"] || "").trim();
        const descr = String(r["DESCR"] || r["Description"] || r["descr"] || "").trim();
        const batch = String(r["Batch"] || r["BATCH"] || r["batch"] || r["Lot"] || r["LOT"] || r["BatchNo"] || "Chưa rõ").trim();
        const qty = Number(r["Qty"] || r["Quantity"] || r["quantity"] || 0);
        const mfg = r["MfgDate"] || r["MFG"] || r["mfgDate"] ? String(r["MfgDate"] || r["MFG"] || r["mfgDate"]).trim() : undefined;
        const exp = r["ExpDate"] || r["EXP"] || r["expDate"] ? String(r["ExpDate"] || r["EXP"] || r["expDate"]).trim() : undefined;

        if (!sku) continue;

        // SKU aggregate
        if (!skuAgg.has(sku)) {
          skuAgg.set(sku, { sku, descr: descr || sku, quantity: 0 });
        }
        const item = skuAgg.get(sku)!;
        item.quantity += qty;
        if (descr && item.descr === sku) item.descr = descr;

        // Batch aggregate
        const bKey = `${sku}__${batch}`;
        if (!batchAgg.has(bKey)) {
          batchAgg.set(bKey, { sku, descr: descr || sku, batch, quantity: 0, mfgDate: mfg, expDate: exp });
        }
        const bItem = batchAgg.get(bKey)!;
        bItem.quantity += qty;
        if (descr && bItem.descr === sku) bItem.descr = descr;
      }

      // 1. Save to LatestInventorySnapshot
      await prisma.latestInventorySnapshot.deleteMany({
        where: { date: snapshotDate, account: "Danone" }
      });

      const snapshotList = Array.from(batchAgg.values()).map(b => ({
        date: snapshotDate,
        account: "Danone",
        sku: b.sku,
        descr: b.descr,
        batch: b.batch,
        quantity: b.quantity
      }));

      for (let i = 0; i < snapshotList.length; i += 50) {
        await prisma.latestInventorySnapshot.createMany({ data: snapshotList.slice(i, i + 50) });
      }

      // 2. Update active inventory
      await prisma.inventory.deleteMany({});
      await prisma.inventoryBatch.deleteMany({});

      for (const item of skuAgg.values()) {
        totalQty += item.quantity;
        await prisma.inventory.create({
          data: {
            sku: item.sku,
            account: "Danone",
            descr: item.descr,
            quantity: item.quantity
          }
        });
        await prisma.masterData.upsert({
          where: { sku_account: { sku: item.sku, account: "Danone" } },
          update: { descr: item.descr },
          create: { sku: item.sku, account: "Danone", descr: item.descr }
        });
      }

      for (const bItem of batchAgg.values()) {
        await prisma.inventoryBatch.create({
          data: {
            sku: bItem.sku,
            account: "Danone",
            descr: bItem.descr,
            batch: bItem.batch,
            quantity: bItem.quantity,
            mfgDate: bItem.mfgDate,
            expDate: bItem.expDate
          }
        });
      }

      // 3. AUTOMATIC VALIDATION: Check uploaded inventory against historical system calculated inventory!
      // Fetch latest baseline or opening stock before this date
      const baselineRecords = await prisma.baselineInventory.findMany({
        where: { date: { lte: snapshotDate } },
        orderBy: { date: "desc" }
      });

      const baselineDate = baselineRecords.length > 0 ? baselineRecords[0].date : null;
      const baselineMap = new Map<string, number>(); // sku -> qty

      if (baselineDate) {
        for (const b of baselineRecords) {
          if (b.date.getTime() === baselineDate.getTime()) {
            baselineMap.set(b.sku, (baselineMap.get(b.sku) || 0) + b.quantity);
          }
        }
      }

      // Inbounds & Outbounds up to snapshotDate
      const inbounds = await prisma.inbound.findMany({
        where: {
          reversed: false,
          date: baselineDate ? { gte: baselineDate, lte: snapshotDate } : { lte: snapshotDate }
        }
      });

      const outbounds = await prisma.outbound.findMany({
        where: {
          reversed: false,
          date: baselineDate ? { gte: baselineDate, lte: snapshotDate } : { lte: snapshotDate }
        }
      });

      // Calculate expected quantity for each SKU
      const expectedMap = new Map<string, number>();
      for (const [sku, baseQty] of baselineMap.entries()) {
        expectedMap.set(sku, baseQty);
      }
      for (const ib of inbounds) {
        expectedMap.set(ib.sku, (expectedMap.get(ib.sku) || 0) + ib.quantity);
      }
      for (const ob of outbounds) {
        expectedMap.set(ob.sku, (expectedMap.get(ob.sku) || 0) - ob.quantity);
      }

      // Compare Uploaded vs Calculated
      const discrepancies: any[] = [];
      const checkedSkus = new Set([...skuAgg.keys(), ...expectedMap.keys()]);

      for (const sku of checkedSkus) {
        const uploaded = skuAgg.get(sku)?.quantity || 0;
        const expected = expectedMap.get(sku) || 0;
        const diff = uploaded - expected;
        if (diff !== 0 && baselineDate) {
          discrepancies.push({
            sku,
            descr: skuAgg.get(sku)?.descr || sku,
            uploaded,
            expected,
            variance: diff
          });
        }
      }

      importedCount = skuAgg.size;
      const isMatched = discrepancies.length === 0;

      await logAction(
        "UPLOAD_INVENTORY",
        `Đã tải lên tồn kho ngày ${dateYMD} (${importedCount} SKUs, Tổng SL: ${totalQty}). Trạng thái khớp lệnh: ${isMatched ? "KHỚP 100%" : `LỆCH ${discrepancies.length} SKU`}`
      );

      return NextResponse.json({
        success: true,
        format,
        snapshotDate: dateYMD,
        importedCount,
        batchCount: batchAgg.size,
        totalQty,
        isMatched,
        discrepancies,
        message: isMatched
          ? `Tồn kho ngày ${dateYMD} đã tải lên thành công và KHỚP 100% với dữ liệu nhập xuất lịch sử! (${totalQty.toLocaleString()} chiếc)`
          : `Đã lưu tồn kho ngày ${dateYMD}. CẢNH BÁO: Phát hiện ${discrepancies.length} mã SKU có số lượng LỆCH so với dữ liệu nhập xuất lịch sử tính đến ngày ${dateYMD}! Hãy xem tab 'Check lệch tồn' để đối soát chi tiết.`
      });
    }

    return NextResponse.json({ error: "Định dạng không được hỗ trợ" }, { status: 400 });

  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: error.message || "Lỗi khi xử lý file tải lên" }, { status: 500 });
  }
}
