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
      if (!snapshotDateParam || snapshotDateParam.trim() === "") {
        return NextResponse.json({ error: "Bắt buộc phải nhập ngày chốt tồn kho cũ (Đầu kỳ) khi tải lên file!" }, { status: 400 });
      }
      const baselineDateStr = snapshotDateParam.trim();
      const baselineDate = new Date(`${baselineDateStr}T00:00:00.000Z`);
      if (isNaN(baselineDate.getTime())) {
        return NextResponse.json({ error: "Định dạng ngày chốt tồn kho cũ không hợp lệ (YYYY-MM-DD)" }, { status: 400 });
      }
      const dateYMD = toYMD(baselineDate);

      // Aggregation maps
      const skuMap = new Map<string, { sku: string, descr: string, quantity: number }>();
      const batchMap = new Map<string, { sku: string, descr: string, batch: string, quantity: number }>();

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const sku = String(r["Sku"] || r["SKU"] || r["sku"] || "").trim();
        const descr = String(r["DESCR"] || r["Description"] || r["descr"] || "").trim();
        const batch = String(r["Batch"] || r["BATCH"] || r["batch"] || r["Lot"] || r["LOT"] || r["BatchNo"] || "Chưa rõ").trim();
        const qty = Number(r["Qty"] || r["Quantity"] || r["quantity"] || r["Qty Piece"] || 0);

        if (!sku) continue;

        // SKU level aggregation
        if (!skuMap.has(sku)) {
          skuMap.set(sku, { sku, descr: descr || sku, quantity: 0 });
        }
        const sItem = skuMap.get(sku)!;
        sItem.quantity += qty;
        if (descr && sItem.descr === sku) sItem.descr = descr;

        // Batch level aggregation
        const key = `${sku}__${batch}`;
        if (!batchMap.has(key)) {
          batchMap.set(key, { sku, descr: descr || sku, batch, quantity: 0 });
        }
        const item = batchMap.get(key)!;
        item.quantity += qty;
        if (descr && item.descr === sku) item.descr = descr;
      }

      for (const item of skuMap.values()) {
        totalQty += item.quantity;
      }

      // ========================================================
      // TỒN ĐẦU KỲ LÀ DATA GỐC (ROOT DATA)
      // Lưu/Cập nhật vào bảng BaselineInventory (xóa sạch toàn bộ mốc của ngày này trước khi nạp mới)
      // ========================================================
      await prisma.baselineInventory.deleteMany({
        where: {
          date: {
            gte: new Date(`${dateYMD}T00:00:00.000Z`),
            lte: new Date(`${dateYMD}T23:59:59.999Z`)
          },
          account: "Danone"
        }
      });

      const recordsToInsert = Array.from(batchMap.values()).map(item => ({
        date: baselineDate,
        account: "Danone",
        sku: item.sku,
        descr: item.descr,
        batch: item.batch,
        quantity: item.quantity
      }));

      for (let i = 0; i < recordsToInsert.length; i += 100) {
        await prisma.baselineInventory.createMany({ data: recordsToInsert.slice(i, i + 100) });
      }

      // Cập nhật MasterData
      for (const item of skuMap.values()) {
        await prisma.masterData.upsert({
          where: { sku_account: { sku: item.sku, account: "Danone" } },
          update: { descr: item.descr },
          create: { sku: item.sku, account: "Danone", descr: item.descr }
        });
      }

      importedCount = skuMap.size;

      await logAction(
        "UPLOAD_BASELINE_INVENTORY",
        `Đã lưu tồn kho cũ (Đầu kỳ) ngày ${dateYMD}: ${importedCount} SKUs (${batchMap.size} lô, Tổng SL: ${totalQty}). Đã thiết lập làm dữ liệu gốc.`
      );

      return NextResponse.json({
        success: true,
        format: "baseline-inventory",
        snapshotDate: dateYMD,
        importedCount,
        batchCount: batchMap.size,
        totalQty,
        totalSystemQty: totalQty,
        netVariance: 0,
        isMatched: true,
        discrepancies: [],
        message: `ĐÃ ĐỐI SOÁT XONG: Tồn kho cũ (Đầu kỳ) ngày ${dateYMD} đã nạp thành công (${totalQty.toLocaleString()} chiếc) và được thiết lập làm dữ liệu gốc cho toàn bộ hệ thống tính toán!`
      });

    // ==========================================
    // 4. TỒN KHO MỚI NHẤT (Latest Inventory - Không bắt buộc & Có kiểm tra lệch tồn)
    // ==========================================
    } else if (format === "inventory") {
      if (!snapshotDateParam || snapshotDateParam.trim() === "") {
        return NextResponse.json({ error: "Bắt buộc phải nhập ngày chốt tồn kho mới khi tải lên file!" }, { status: 400 });
      }
      const snapshotDateStr = snapshotDateParam.trim();
      const snapshotDate = new Date(`${snapshotDateStr}T00:00:00.000Z`);
      if (isNaN(snapshotDate.getTime())) {
        return NextResponse.json({ error: "Định dạng ngày chốt tồn kho mới không hợp lệ (YYYY-MM-DD)" }, { status: 400 });
      }
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

      for (const item of skuAgg.values()) {
        totalQty += item.quantity;
      }

      // ========================================================
      // KIỂM TRA ĐỐI SOÁT VỚI HỆ THỐNG: TỒN CŨ + NHẬP - XUẤT = TỒN MỚI
      // ========================================================
      // 1. Tìm bản ghi tồn cũ (Baseline) gần nhất trước hoặc bằng ngày này
      const baselineRecords = await prisma.baselineInventory.findMany({
        where: { date: { lte: new Date(`${dateYMD}T23:59:59.999Z`) } },
        orderBy: { date: "desc" }
      });

      const baselineDate = baselineRecords.length > 0 ? baselineRecords[0].date : null;
      const baselineMap = new Map<string, number>();

      if (baselineDate) {
        for (const b of baselineRecords) {
          if (toYMD(b.date) === toYMD(baselineDate)) {
            baselineMap.set(b.sku, (baselineMap.get(b.sku) || 0) + b.quantity);
          }
        }
      }

      // 2. Lấy dữ liệu Nhập và Xuất từ sau mốc baselineDate đến ngày snapshotDate
      // Nếu baselineDate là ngày đầu tháng (ví dụ: 01/10): tính từ đầu ngày 01/10
      // Nếu baselineDate không phải ngày đầu tháng (ví dụ: 22/10): mốc baseline là tồn chốt cuối ngày 22, do đó giao dịch phát sinh trong kỳ là từ sau ngày 22
      const isBaselineFirstDay = baselineDate ? toYMD(baselineDate).endsWith("-01") : false;
      const inbounds = await prisma.inbound.findMany({
        where: {
          reversed: false,
          date: baselineDate
            ? (isBaselineFirstDay 
                ? { gte: new Date(`${toYMD(baselineDate)}T00:00:00.000Z`), lte: new Date(`${dateYMD}T23:59:59.999Z`) }
                : { gt: new Date(`${toYMD(baselineDate)}T23:59:59.999Z`), lte: new Date(`${dateYMD}T23:59:59.999Z`) })
            : { lte: new Date(`${dateYMD}T23:59:59.999Z`) }
        }
      });

      const outbounds = await prisma.outbound.findMany({
        where: {
          reversed: false,
          date: baselineDate
            ? (isBaselineFirstDay 
                ? { gte: new Date(`${toYMD(baselineDate)}T00:00:00.000Z`), lte: new Date(`${dateYMD}T23:59:59.999Z`) }
                : { gt: new Date(`${toYMD(baselineDate)}T23:59:59.999Z`), lte: new Date(`${dateYMD}T23:59:59.999Z`) })
            : { lte: new Date(`${dateYMD}T23:59:59.999Z`) }
        }
      });

      // 3. Tính tồn dự kiến theo công thức: Tồn Tính Toán = Tồn cũ + Nhập - Xuất
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

      // 4. So sánh số tồn file mới với tồn tính toán
      const discrepancies: any[] = [];
      const checkedSkus = new Set([...skuAgg.keys(), ...expectedMap.keys()]);
      let totalExpectedQty = 0;

      for (const sku of checkedSkus) {
        const uploaded = skuAgg.get(sku)?.quantity || 0;
        const expected = expectedMap.get(sku) || 0;
        totalExpectedQty += expected;
        const diff = uploaded - expected;

        if (diff !== 0 && baselineDate) {
          discrepancies.push({
            sku,
            descr: skuAgg.get(sku)?.descr || sku,
            uploaded,
            expected,
            variance: diff,
            reason: diff > 0
              ? `Tồn mới cao hơn tính toán (+${diff.toLocaleString()} chiếc). Khả năng thiếu chứng từ xuất hoặc nhập thừa.`
              : `Tồn mới thấp hơn tính toán (${diff.toLocaleString()} chiếc). Khả năng thiếu chứng từ nhập hoặc có hao hụt.`
          });
        }
      }

      // 5. Lưu vào LatestInventorySnapshot (xóa toàn bộ snapshot trong ngày và chèn mới dạng batch)
      await prisma.latestInventorySnapshot.deleteMany({
        where: {
          date: {
            gte: new Date(`${dateYMD}T00:00:00.000Z`),
            lte: new Date(`${dateYMD}T23:59:59.999Z`)
          },
          account: "Danone"
        }
      });

      const snapshotList = Array.from(batchAgg.values()).map(b => ({
        date: snapshotDate,
        account: "Danone",
        sku: b.sku,
        descr: b.descr,
        batch: b.batch,
        quantity: b.quantity
      }));

      for (let i = 0; i < snapshotList.length; i += 100) {
        await prisma.latestInventorySnapshot.createMany({ data: snapshotList.slice(i, i + 100) });
      }

      // 6. Cập nhật bảng Inventory & InventoryBatch hiện hành (tối ưu tốc độ cao)
      await prisma.inventory.deleteMany({});
      await prisma.inventoryBatch.deleteMany({});

      const skuList = Array.from(skuAgg.values()).map(item => ({
        sku: item.sku,
        account: "Danone",
        descr: item.descr,
        quantity: item.quantity
      }));
      await prisma.inventory.createMany({ data: skuList });

      for (const item of skuAgg.values()) {
        await prisma.masterData.upsert({
          where: { sku_account: { sku: item.sku, account: "Danone" } },
          update: { descr: item.descr },
          create: { sku: item.sku, account: "Danone", descr: item.descr }
        });
      }

      const batchListToInsert = Array.from(batchAgg.values()).map(bItem => ({
        sku: bItem.sku,
        account: "Danone",
        descr: bItem.descr,
        batch: bItem.batch,
        quantity: bItem.quantity,
        mfgDate: bItem.mfgDate,
        expDate: bItem.expDate
      }));

      for (let i = 0; i < batchListToInsert.length; i += 100) {
        await prisma.inventoryBatch.createMany({ data: batchListToInsert.slice(i, i + 100) });
      }

      importedCount = skuAgg.size;
      const isMatched = discrepancies.length === 0;

      await logAction(
        "UPLOAD_INVENTORY",
        `Đã tải lên tồn kho ngày ${dateYMD} (${importedCount} SKUs, ${batchAgg.size} lô, Tổng SL: ${totalQty}). Khớp hệ thống: ${isMatched ? "100% KHỚP" : `LỆCH ${discrepancies.length} SKU`}`
      );

      return NextResponse.json({
        success: true,
        format,
        snapshotDate: dateYMD,
        baselineDateUsed: baselineDate ? toYMD(baselineDate) : null,
        importedCount,
        batchCount: batchAgg.size,
        totalQty,
        totalExpectedQty,
        netVariance: totalQty - totalExpectedQty,
        isMatched,
        discrepancies,
        message: isMatched
          ? `Tồn kho ngày ${dateYMD} đã tải lên thành công và KHỚP 100% với dữ liệu nhập xuất lịch sử! (${totalQty.toLocaleString()} chiếc)`
          : `Đã lưu tồn kho ngày ${dateYMD}. CẢNH BÁO: Phát hiện ${discrepancies.length} mã SKU có số lượng LỆCH so với dữ liệu nhập xuất lịch sử tính đến ngày ${dateYMD}! Hãy kiểm tra chi tiết bảng đối soát bên dưới.`
      });
    }

    return NextResponse.json({ error: "Định dạng không được hỗ trợ" }, { status: 400 });

  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: error.message || "Lỗi khi xử lý file tải lên" }, { status: 500 });
  }
}
