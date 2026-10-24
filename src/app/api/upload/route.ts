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
  const d = new Date(serial);
  return isNaN(d.getTime()) ? new Date() : d;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const format = (formData.get("format") as string) || "inbound";
    const mode = (formData.get("mode") as string) || "append"; // "append" or "replace"

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = xlsx.read(buffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rows: any[] = xlsx.utils.sheet_to_json(worksheet);

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "The uploaded file is empty" }, { status: 400 });
    }

    let importedCount = 0;
    let totalQty = 0;
    const errors: string[] = [];

    if (format === "inbound") {
      if (mode === "replace") {
        await prisma.inbound.deleteMany({});
      }

      const records = [];
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
        const batch = r["Batch"] || r["batch"] || "";
        const status = String(r["Status"] || "NORMAL");
        const remark = [
          supplier ? `NCC: ${supplier}` : "",
          batch ? `Lô: ${batch}` : "",
          receiptKey ? `Receipt: ${receiptKey}` : ""
        ].filter(Boolean).join(" | ");

        if (!sku || isNaN(qty) || qty <= 0) {
          errors.push(`Row ${i + 2}: Invalid SKU or quantity (${qty})`);
          continue;
        }

        totalQty += qty;
        records.push({
          orderCode,
          account: "Danone",
          reversed: false,
          date,
          sku,
          descr: descr || sku,
          quantity: qty,
          status,
          remark,
          createdBy: "Excel Upload"
        });
      }

      // Batch insert in chunks of 50
      for (let i = 0; i < records.length; i += 50) {
        const chunk = records.slice(i, i + 50);
        await prisma.inbound.createMany({ data: chunk });
      }

      // If appending, also update inventory quantities
      if (mode === "append") {
        for (const item of records) {
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
        }
      }

      importedCount = records.length;
      await logAction("UPLOAD_INBOUND", `Uploaded ${importedCount} inbound records (${mode} mode) from ${file.name}`);

    } else if (format === "outbound") {
      if (mode === "replace") {
        await prisma.outbound.deleteMany({});
      }

      const records = [];
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
        const batch = r["Batch"] || r["batch"] || "";
        const status = String(r["DefectiveCode"] || "NORM");
        const fullRemark = r["Remark"] || r["remark"] || "";
        const remark = [
          customerPo ? `PO: ${customerPo}` : "",
          batch ? `Lô: ${batch}` : "",
          fullRemark
        ].filter(Boolean).join(" | ");

        if (!sku || isNaN(qty) || qty <= 0) {
          errors.push(`Row ${i + 2}: Invalid SKU or quantity (${qty})`);
          continue;
        }

        totalQty += qty;
        records.push({
          orderCode,
          account: "Danone",
          reversed: false,
          date,
          sku,
          descr: descr || sku,
          quantity: qty,
          status,
          remark,
          createdBy: "Excel Upload"
        });
      }

      // Batch insert in chunks of 50
      for (let i = 0; i < records.length; i += 50) {
        const chunk = records.slice(i, i + 50);
        await prisma.outbound.createMany({ data: chunk });
      }

      // If appending, deduct from inventory
      if (mode === "append") {
        for (const item of records) {
          await prisma.inventory.upsert({
            where: { sku_account: { sku: item.sku, account: "Danone" } },
            update: { quantity: { decrement: item.quantity } },
            create: { sku: item.sku, account: "Danone", descr: item.descr, quantity: 0 }
          });
        }
      }

      importedCount = records.length;
      await logAction("UPLOAD_OUTBOUND", `Uploaded ${importedCount} outbound records (${mode} mode) from ${file.name}`);

    } else if (format === "inventory") {
      // Group by SKU and also by SKU + Batch
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

      if (mode === "replace") {
        await prisma.inventory.deleteMany({});
        await prisma.inventoryBatch.deleteMany({});
      }

      for (const item of skuAgg.values()) {
        totalQty += item.quantity;
        await prisma.inventory.upsert({
          where: { sku_account: { sku: item.sku, account: "Danone" } },
          update: { 
            quantity: mode === "replace" ? item.quantity : { increment: item.quantity },
            descr: item.descr
          },
          create: {
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

      // Upsert batch items
      for (const bItem of batchAgg.values()) {
        await prisma.inventoryBatch.upsert({
          where: { sku_account_batch: { sku: bItem.sku, account: "Danone", batch: bItem.batch } },
          update: {
            quantity: mode === "replace" ? bItem.quantity : { increment: bItem.quantity },
            descr: bItem.descr,
            mfgDate: bItem.mfgDate,
            expDate: bItem.expDate
          },
          create: {
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

      importedCount = skuAgg.size;
      await logAction("UPLOAD_INVENTORY", `Uploaded inventory for ${importedCount} SKUs (${batchAgg.size} batches, ${mode} mode) from ${file.name}`);

    } else if (format === "master-data") {
      if (mode === "replace") {
        await prisma.masterData.deleteMany({});
      }

      for (const r of rows) {
        const sku = String(r["SKU"] || r["Sku"] || r["sku"] || "").trim();
        const descr = String(r["Description"] || r["DESCR"] || r["descr"] || "").trim();
        const account = String(r["Account"] || "Danone").trim();

        if (sku && descr) {
          await prisma.masterData.upsert({
            where: { sku_account: { sku, account } },
            update: { descr },
            create: { sku, account, descr }
          });
          importedCount++;
        }
      }
      await logAction("UPLOAD_MASTER_DATA", `Uploaded ${importedCount} master data items from ${file.name}`);
    }

    return NextResponse.json({
      success: true,
      format,
      mode,
      importedCount,
      totalQty,
      errors: errors.slice(0, 10),
      message: `Đã xử lý thành công ${importedCount} bản ghi (${format}). Tổng số lượng: ${totalQty.toLocaleString()}`
    });

  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: error.message || "Failed to process file upload" }, { status: 500 });
  }
}
