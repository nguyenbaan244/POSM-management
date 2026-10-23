const xlsx = require('xlsx');
const path = require('path');
const { Pool, neonConfig } = require('@neondatabase/serverless');
const { PrismaNeon } = require('@prisma/adapter-neon');
const { PrismaClient } = require('@prisma/client');
const ws = require('ws');

neonConfig.webSocketConstructor = ws;

let dbUrl = process.env.DATABASE_URL || "";
dbUrl = dbUrl.replace("?pgbouncer=true&sslmode=require", "?sslmode=require");
dbUrl = dbUrl.replace("&pgbouncer=true", "");

const pool = new Pool({ connectionString: dbUrl });
const adapter = new PrismaNeon(pool);
const prisma = new PrismaClient({ adapter });

function excelDateToDate(serial) {
  if (!serial) return new Date();
  if (typeof serial === 'number') {
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    return new Date(utc_value * 1000);
  }
  const d = new Date(serial);
  return isNaN(d.getTime()) ? new Date() : d;
}

async function main() {
  console.log("=== STEP 1: CLEARING OLD DATA ===");
  const delInbound = await prisma.inbound.deleteMany({});
  const delOutbound = await prisma.outbound.deleteMany({});
  const delInventory = await prisma.inventory.deleteMany({});
  const delMaster = await prisma.masterData.deleteMany({});
  const delLogs = await prisma.actionLog.deleteMany({});
  console.log("Deleted records:", {
    inbound: delInbound.count,
    outbound: delOutbound.count,
    inventory: delInventory.count,
    masterData: delMaster.count,
    actionLog: delLogs.count
  });

  const baseDir = path.resolve(__dirname, '..', '..', 'data');
  const invPath = path.join(baseDir, 'inventory hôm nay 23.10.xlsx');
  const ibPath = path.join(baseDir, 'INBOUND 23.10.2026.xlsx');
  const obPath = path.join(baseDir, 'OUTBOUND 23.10.2026.xlsx');

  console.log("=== STEP 2: PARSING & SEEDING MASTER DATA AND INVENTORY ===");
  const invWb = xlsx.readFile(invPath);
  const invSheet = invWb.Sheets[invWb.SheetNames[0]];
  const invRows = xlsx.utils.sheet_to_json(invSheet);

  const skuAgg = new Map();
  for (const r of invRows) {
    const sku = String(r['Sku'] || '').trim();
    const descr = String(r['DESCR'] || '').trim();
    const qty = Number(r['Qty'] || 0);
    if (!sku) continue;

    if (!skuAgg.has(sku)) {
      skuAgg.set(sku, { sku, descr, quantity: 0, account: 'Danone' });
    }
    const item = skuAgg.get(sku);
    item.quantity += qty;
    if (descr && !item.descr) item.descr = descr;
  }

  // Also check if Inbound or Outbound have other SKUs to include in MasterData
  const ibWb = xlsx.readFile(ibPath);
  const ibRows = xlsx.utils.sheet_to_json(ibWb.Sheets[ibWb.SheetNames[0]]);
  for (const r of ibRows) {
    const sku = String(r['Sku'] || '').trim();
    const descr = String(r['DESCR'] || '').trim();
    if (sku && !skuAgg.has(sku)) {
      skuAgg.set(sku, { sku, descr, quantity: 0, account: 'Danone' });
    }
  }

  const obWb = xlsx.readFile(obPath);
  const obRows = xlsx.utils.sheet_to_json(obWb.Sheets[obWb.SheetNames[0]]);
  for (const r of obRows) {
    const sku = String(r['Sku'] || '').trim();
    const descr = String(r['Description'] || '').trim();
    if (sku && !skuAgg.has(sku)) {
      skuAgg.set(sku, { sku, descr, quantity: 0, account: 'Danone' });
    }
  }

  console.log(`Creating ${skuAgg.size} Master Data & Inventory items...`);
  for (const item of skuAgg.values()) {
    await prisma.masterData.create({
      data: {
        sku: item.sku,
        account: item.account,
        descr: item.descr || item.sku
      }
    });

    await prisma.inventory.create({
      data: {
        sku: item.sku,
        account: item.account,
        descr: item.descr || item.sku,
        quantity: item.quantity
      }
    });
    console.log(`Saved SKU ${item.sku}: ${item.descr} (Stock: ${item.quantity.toLocaleString()})`);
  }

  console.log("=== STEP 3: IMPORTING INBOUND DATA ===");
  console.log(`Processing ${ibRows.length} inbound rows...`);
  const ibRecords = [];
  for (const r of ibRows) {
    const sku = String(r['Sku'] || '').trim();
    const descr = String(r['DESCR'] || '').trim();
    const qty = Number(r['Qty Piece'] || 0);
    const date = excelDateToDate(r['Date Received']);
    const poNumber = r['PO Number'] ? String(r['PO Number']).trim() : '';
    const receiptKey = r['ReceiptKey'] ? String(r['ReceiptKey']).trim() : '';
    const orderCode = poNumber || receiptKey || 'IB_IMPORT';
    const supplier = r['Supplier'] ? String(r['Supplier']).trim() : '';
    const batch = r['Batch'] ? String(r['Batch']).trim() : '';
    const status = r['Status'] ? String(r['Status']).trim() : 'NORMAL';
    const remark = [
      supplier ? `NCC: ${supplier}` : '',
      batch ? `Lô: ${batch}` : '',
      receiptKey ? `Receipt: ${receiptKey}` : ''
    ].filter(Boolean).join(' | ');

    ibRecords.push({
      orderCode,
      account: 'Danone',
      reversed: false,
      date,
      sku,
      descr: descr || (skuAgg.get(sku)?.descr ?? sku),
      quantity: qty,
      status,
      remark,
      createdBy: 'Excel Import'
    });
  }

  // Insert in batches of 50
  for (let i = 0; i < ibRecords.length; i += 50) {
    const chunk = ibRecords.slice(i, i + 50);
    await prisma.inbound.createMany({ data: chunk });
  }
  console.log(`Inserted ${ibRecords.length} Inbound records.`);

  console.log("=== STEP 4: IMPORTING OUTBOUND DATA ===");
  console.log(`Processing ${obRows.length} outbound rows...`);
  const obRecords = [];
  for (const r of obRows) {
    const sku = String(r['Sku'] || '').trim();
    const descr = String(r['Description'] || '').trim();
    const qty = Number(r['Total Qty Pcs'] || 0);
    const date = excelDateToDate(r['ShipDate']);
    const saleOrder = r['Sale Order #'] ? String(r['Sale Order #']).trim() : '';
    const customerPo = r['Customer PO'] ? String(r['Customer PO']).trim() : '';
    const orderKey = r['Order Key'] ? String(r['Order Key']).trim() : '';
    const orderCode = saleOrder || customerPo || orderKey || 'OB_IMPORT';
    const batch = r['Batch'] ? String(r['Batch']).trim() : '';
    const status = r['DefectiveCode'] ? String(r['DefectiveCode']).trim() : 'NORM';
    const fullRemark = r['Remark'] ? String(r['Remark']).trim() : '';
    const remark = [
      customerPo ? `PO: ${customerPo}` : '',
      batch ? `Lô: ${batch}` : '',
      fullRemark
    ].filter(Boolean).join(' | ');

    obRecords.push({
      orderCode,
      account: 'Danone',
      reversed: false,
      date,
      sku,
      descr: descr || (skuAgg.get(sku)?.descr ?? sku),
      quantity: qty,
      status,
      remark,
      createdBy: 'Excel Import'
    });
  }

  // Insert in batches of 50
  for (let i = 0; i < obRecords.length; i += 50) {
    const chunk = obRecords.slice(i, i + 50);
    await prisma.outbound.createMany({ data: chunk });
  }
  console.log(`Inserted ${obRecords.length} Outbound records.`);

  console.log("=== IMPORT COMPLETE ===");
  await prisma.$disconnect();
}

main().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
