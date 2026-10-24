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
  if (serial instanceof Date) {
    return new Date(Date.UTC(serial.getFullYear(), serial.getMonth(), serial.getDate()));
  }
  if (typeof serial === "string") {
    const s = serial.trim();
    // Format YYYY-MM-DD or YYYY/MM/DD
    const iso = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (iso) {
      return new Date(Date.UTC(parseInt(iso[1], 10), parseInt(iso[2], 10) - 1, parseInt(iso[3], 10)));
    }
    // Delimited date DD-MM-YYYY or MM/DD/YYYY
    const dmy = s.match(/^(\d{1,2})([\/\-])(\d{1,2})[\/\-](\d{4})/);
    if (dmy) {
      const p1 = parseInt(dmy[1], 10);
      const sep = dmy[2];
      const p2 = parseInt(dmy[3], 10);
      const year = parseInt(dmy[4], 10);
      let day: number, month: number;
      if (p1 > 12) {
        day = p1; month = p2;
      } else if (p2 > 12) {
        day = p2; month = p1;
      } else if (sep === "/") {
        // MM/DD/YYYY
        month = p1; day = p2;
      } else {
        // DD-MM-YYYY
        day = p1; month = p2;
      }
      return new Date(Date.UTC(year, month - 1, day));
    }
  }
  const d = new Date(serial);
  return isNaN(d.getTime()) ? new Date() : new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

function getRowValue(row: any, ...candidates: string[]): any {
  if (!row) return "";
  for (const c of candidates) {
    if (row[c] !== undefined && row[c] !== null && row[c] !== "") return row[c];
  }
  const rowKeys = Object.keys(row);
  for (const c of candidates) {
    const cClean = c.trim().toLowerCase();
    const foundKey = rowKeys.find(k => k.trim().toLowerCase() === cClean);
    if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && row[foundKey] !== "") {
      return row[foundKey];
    }
  }
  return "";
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
        select: { date: true, orderCode: true, sku: true, quantity: true, batch: true, remark: true }
      });

      // Frequency map of existing records in DB (supports multiset deduplication)
      const dbCounts = new Map<string, number>();
      for (const ib of existingInbounds) {
        const toIdMatch = ib.remark?.match(/\[TOID:([^\]]+)\]/);
        const key = toIdMatch 
          ? `TOID|${toIdMatch[1].trim()}` 
          : `${toYMD(new Date(ib.date))}|${ib.orderCode.trim().toLowerCase()}|${ib.sku.trim().toLowerCase()}|${ib.quantity}|${(ib.batch || "").trim().toLowerCase()}`;
        dbCounts.set(key, (dbCounts.get(key) || 0) + 1);
      }

      const newRecords: any[] = [];

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const sku = String(getRowValue(r, "Sku", "SKU", "sku", "Mã hàng", "MaHang") || "").trim();
        const descr = String(getRowValue(r, "DESCR", "Description", "descr", "description", "Tên hàng", "TenHang") || "").trim();
        // Priority: "Qty Piece" is the piece/each unit in WMS inbound reports
        const qtyRaw = getRowValue(r, "Qty Piece", "Quantity", "Qty", "quantity", "Total Qty Pcs", "Số lượng", "SoLuong");
        const qty = Number(qtyRaw || 0);
        const poNumber = String(getRowValue(r, "PO Number", "PONumber", "PO") || "").trim();
        const receiptKey = String(getRowValue(r, "ReceiptKey", "Receipt Key") || "").trim();
        const toId = String(getRowValue(r, "ToId", "To ID", "Pallet ID", "PalletID") || "").trim();
        const orderCode = String(poNumber || receiptKey || (toId ? `PALLET_${toId}` : `IB_${Date.now()}_${i + 1}`)).trim();
        const rawDate = getRowValue(r, "Date Received", "DateReceived", "Date", "date", "Ngày nhập", "NgayNhap", "Date Closed");
        const date = parseExcelDate(rawDate);
        const supplier = String(getRowValue(r, "Supplier", "supplier", "Nhà cung cấp") || "").trim();
        const batch = String(getRowValue(r, "Batch", "batch", "Lottable06", "Lot") || "").trim();
        const status = String(getRowValue(r, "Status", "status") || "NORMAL").trim();
        const fullRemark = String(getRowValue(r, "Remark", "remark", "Ghi chú") || "").trim();

        if (!sku || isNaN(qty) || qty <= 0) {
          errors.push(`Dòng ${i + 2}: SKU hoặc số lượng không hợp lệ (${qty})`);
          continue;
        }

        const key = toId 
          ? `TOID|${toId}` 
          : `${toYMD(date)}|${orderCode.toLowerCase()}|${sku.toLowerCase()}|${qty}|${batch.toLowerCase()}`;

        const existingCount = dbCounts.get(key) || 0;
        if (existingCount > 0) {
          // Record already exists in DB from a previous upload -> skip
          dbCounts.set(key, existingCount - 1);
          skippedCount++;
        } else {
          // New record -> add! (Never drop sibling pallets within the same upload)
          totalQty += qty;
          const remark = [
            toId ? `[TOID:${toId}]` : "",
            poNumber ? `PO: ${poNumber}` : "",
            supplier ? `NCC: ${supplier}` : "",
            batch ? `Lô: ${batch}` : "",
            receiptKey ? `Receipt: ${receiptKey}` : "",
            fullRemark
          ].filter(Boolean).join(" | ");

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

      // Aggregate stock changes by SKU and by Batch before DB upserts
      const inSkuDelta = new Map<string, { descr: string, qty: number }>();
      const inBatchDelta = new Map<string, { sku: string, descr: string, batch: string, qty: number }>();

      for (const item of newRecords) {
        if (!inSkuDelta.has(item.sku)) {
          inSkuDelta.set(item.sku, { descr: item.descr, qty: 0 });
        }
        inSkuDelta.get(item.sku)!.qty += item.quantity;
        if (item.descr && item.descr !== item.sku) inSkuDelta.get(item.sku)!.descr = item.descr;

        if (item.batch) {
          const bKey = `${item.sku}__${item.batch}`;
          if (!inBatchDelta.has(bKey)) {
            inBatchDelta.set(bKey, { sku: item.sku, descr: item.descr, batch: item.batch, qty: 0 });
          }
          inBatchDelta.get(bKey)!.qty += item.quantity;
          if (item.descr && item.descr !== item.sku) inBatchDelta.get(bKey)!.descr = item.descr;
        }
      }

      for (const [sku, d] of inSkuDelta.entries()) {
        await prisma.inventory.upsert({
          where: { sku_account: { sku, account: "Danone" } },
          update: { quantity: { increment: d.qty }, descr: d.descr },
          create: { sku, account: "Danone", descr: d.descr, quantity: d.qty }
        });
        await prisma.masterData.upsert({
          where: { sku_account: { sku, account: "Danone" } },
          update: { descr: d.descr },
          create: { sku, account: "Danone", descr: d.descr }
        });
      }

      for (const b of inBatchDelta.values()) {
        await prisma.inventoryBatch.upsert({
          where: { sku_account_batch: { sku: b.sku, account: "Danone", batch: b.batch } },
          update: { quantity: { increment: b.qty }, descr: b.descr },
          create: { sku: b.sku, account: "Danone", descr: b.descr, batch: b.batch, quantity: b.qty }
        });
      }

      importedCount = newRecords.length;
      await logAction("UPLOAD_INBOUND", `Đã kiểm tra file nhập kho: Thêm mới ${importedCount} dòng (+${totalQty.toLocaleString()} chiếc), Đã có sẵn ${skippedCount} dòng (bỏ qua).`);

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
        select: { date: true, orderCode: true, sku: true, quantity: true, batch: true, remark: true }
      });

      // Frequency map of existing records in DB (supports multiset deduplication)
      const dbCounts = new Map<string, number>();
      for (const ob of existingOutbounds) {
        const outKeyMatch = ob.remark?.match(/\[OUTKEY:([^\]]+)\]/);
        const key = outKeyMatch 
          ? `OUTKEY|${outKeyMatch[1].trim()}|${ob.sku.trim().toLowerCase()}|${ob.quantity}|${(ob.batch || "").trim().toLowerCase()}`
          : `${toYMD(new Date(ob.date))}|${ob.orderCode.trim().toLowerCase()}|${ob.sku.trim().toLowerCase()}|${ob.quantity}|${(ob.batch || "").trim().toLowerCase()}`;
        dbCounts.set(key, (dbCounts.get(key) || 0) + 1);
      }

      const newRecords: any[] = [];

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const sku = String(getRowValue(r, "Sku", "SKU", "sku", "Mã hàng", "MaHang") || "").trim();
        const descr = String(getRowValue(r, "Description", "DESCR", "descr", "description", "Tên hàng", "TenHang") || "").trim();
        // Priority: "Total Qty Pcs" is the piece/each unit in WMS outbound reports
        const qtyRaw = getRowValue(r, "Total Qty Pcs", "Qty Piece", "Quantity", "Qty", "quantity", "Số lượng", "SoLuong");
        const qty = Number(qtyRaw || 0);
        const saleOrder = String(getRowValue(r, "Sale Order #", "Sale Order", "SaleOrder", "SO") || "").trim();
        const customerPo = String(getRowValue(r, "Customer PO", "CustomerPO") || "").trim();
        const orderKey = String(getRowValue(r, "Order Key", "OrderKey") || "").trim();
        const palletId = String(getRowValue(r, "Pallet ID", "PalletID", "Pallet") || "").trim();
        const redInv = String(getRowValue(r, "RED INV", "Red Inv", "RedInv") || "").trim();
        const orderCode = String(saleOrder || customerPo || orderKey || (palletId ? `PALLET_${palletId}` : `OB_${Date.now()}_${i + 1}`)).trim();
        const rawDate = getRowValue(r, "ShipDate", "Ship Date", "Date", "date", "Ngày xuất", "NgayXuat");
        const date = parseExcelDate(rawDate);
        const batch = String(getRowValue(r, "Batch", "batch", "Lot") || "").trim();
        const status = String(getRowValue(r, "DefectiveCode", "Status", "status") || "NORM").trim();
        const fullRemark = String(getRowValue(r, "Remark", "remark", "Ghi chú") || "").trim();

        if (!sku || isNaN(qty) || qty <= 0) {
          errors.push(`Dòng ${i + 2}: SKU hoặc số lượng không hợp lệ (${qty})`);
          continue;
        }

        const outKeyTag = [orderKey, palletId, redInv].filter(Boolean).join("|");
        const key = outKeyTag
          ? `OUTKEY|${outKeyTag}|${sku.toLowerCase()}|${qty}|${batch.toLowerCase()}`
          : `${toYMD(date)}|${orderCode.toLowerCase()}|${sku.toLowerCase()}|${qty}|${batch.toLowerCase()}`;

        const existingCount = dbCounts.get(key) || 0;
        if (existingCount > 0) {
          // Record already exists in DB from a previous upload -> skip
          dbCounts.set(key, existingCount - 1);
          skippedCount++;
        } else {
          // New record -> add! (Never drop sibling cartons/orders within the same upload)
          totalQty += qty;
          const remark = [
            outKeyTag ? `[OUTKEY:${outKeyTag}]` : "",
            customerPo ? `PO: ${customerPo}` : "",
            saleOrder ? `SO: ${saleOrder}` : "",
            batch ? `Lô: ${batch}` : "",
            fullRemark
          ].filter(Boolean).join(" | ");

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

      // Aggregate stock changes by SKU and by Batch before DB upserts
      const outSkuDelta = new Map<string, { descr: string, qty: number }>();
      const outBatchDelta = new Map<string, { sku: string, descr: string, batch: string, qty: number }>();

      for (const item of newRecords) {
        if (!outSkuDelta.has(item.sku)) {
          outSkuDelta.set(item.sku, { descr: item.descr, qty: 0 });
        }
        outSkuDelta.get(item.sku)!.qty += item.quantity;
        if (item.descr && item.descr !== item.sku) outSkuDelta.get(item.sku)!.descr = item.descr;

        if (item.batch) {
          const bKey = `${item.sku}__${item.batch}`;
          if (!outBatchDelta.has(bKey)) {
            outBatchDelta.set(bKey, { sku: item.sku, descr: item.descr, batch: item.batch, qty: 0 });
          }
          outBatchDelta.get(bKey)!.qty += item.quantity;
          if (item.descr && item.descr !== item.sku) outBatchDelta.get(bKey)!.descr = item.descr;
        }
      }

      for (const [sku, d] of outSkuDelta.entries()) {
        await prisma.inventory.upsert({
          where: { sku_account: { sku, account: "Danone" } },
          update: { quantity: { decrement: d.qty } },
          create: { sku, account: "Danone", descr: d.descr, quantity: 0 }
        });
      }

      for (const b of outBatchDelta.values()) {
        await prisma.inventoryBatch.upsert({
          where: { sku_account_batch: { sku: b.sku, account: "Danone", batch: b.batch } },
          update: { quantity: { decrement: b.qty } },
          create: { sku: b.sku, account: "Danone", descr: b.descr, batch: b.batch, quantity: 0 }
        });
      }

      importedCount = newRecords.length;
      await logAction("UPLOAD_OUTBOUND", `Đã kiểm tra file xuất kho: Thêm mới ${importedCount} dòng (-${totalQty.toLocaleString()} chiếc), Đã có sẵn ${skippedCount} dòng (bỏ qua).`);

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
        const sku = String(getRowValue(r, "Sku", "SKU", "sku", "Mã hàng", "MaHang") || "").trim();
        const descr = String(getRowValue(r, "DESCR", "Description", "descr", "description", "Tên hàng", "TenHang") || "").trim();
        const batch = String(getRowValue(r, "Batch", "BATCH", "batch", "Lot", "LOT", "BatchNo", "Số lô") || "Chưa rõ").trim();
        const qty = Number(getRowValue(r, "Qty", "Quantity", "quantity", "Qty Piece", "Total Qty Pcs", "Số lượng", "SoLuong") || 0);

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
        const sku = String(getRowValue(r, "Sku", "SKU", "sku", "Mã hàng", "MaHang") || "").trim();
        const descr = String(getRowValue(r, "DESCR", "Description", "descr", "description", "Tên hàng", "TenHang") || "").trim();
        const batch = String(getRowValue(r, "Batch", "BATCH", "batch", "Lot", "LOT", "BatchNo", "Số lô") || "Chưa rõ").trim();
        const qty = Number(getRowValue(r, "Qty", "Quantity", "quantity", "Qty Piece", "Total Qty Pcs", "Số lượng", "SoLuong") || 0);
        const mfg = getRowValue(r, "MfgDate", "MFG", "mfgDate", "Manufacture Date") ? String(getRowValue(r, "MfgDate", "MFG", "mfgDate", "Manufacture Date")).trim() : undefined;
        const exp = getRowValue(r, "ExpDate", "EXP", "expDate", "ExpiryDate") ? String(getRowValue(r, "ExpDate", "EXP", "expDate", "ExpiryDate")).trim() : undefined;

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
