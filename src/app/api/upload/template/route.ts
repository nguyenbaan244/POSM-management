import { NextResponse } from "next/server";
import * as xlsx from "xlsx";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "inbound";

    let headers: string[] = [];
    let sampleRows: any[] = [];
    let filename = "template.xlsx";

    if (type === "inbound") {
      filename = "Mau_Nhap_Kho_Inbound.xlsx";
      sampleRows = [
        {
          "PO Number": "4505745062",
          "ReceiptKey": "0000009576",
          "Date Received": "2026-10-23",
          "Sku": "194402",
          "DESCR": "APTAMIL PROFUTURA CESARBIOTIK IF 380G",
          "Qty Piece": 204,
          "Supplier": "DANONE NUTRICIA NZ LTD",
          "Batch": "2028.07.10",
          "Status": "NORMAL",
          "Remark": "Nhập kho chính thức"
        },
        {
          "PO Number": "4505745063",
          "ReceiptKey": "0000009577",
          "Date Received": "2026-10-23",
          "Sku": "194403",
          "DESCR": "APTAMIL PROFUTURA CESARBIOTIK IF 800G",
          "Qty Piece": 600,
          "Supplier": "DANONE NUTRICIA NZ LTD",
          "Batch": "2028.07.11",
          "Status": "NORMAL",
          "Remark": "Lô hàng tháng 10"
        }
      ];
    } else if (type === "outbound") {
      filename = "Mau_Xuat_Kho_Outbound.xlsx";
      sampleRows = [
        {
          "ShipDate": "2026-10-23",
          "Sale Order #": "PO#DVN261005-24",
          "Customer PO": "5071775139",
          "Sku": "194402",
          "Description": "APTAMIL PROFUTURA CESARBIOTIK IF 380G",
          "Total Qty Pcs": 216,
          "Batch": "2028.07.10",
          "DefectiveCode": "NORM",
          "Remark": "HOANG DUC PHARMACEUTICAL"
        },
        {
          "ShipDate": "2026-10-23",
          "Sale Order #": "PO-TNSL-TBN3-055641",
          "Customer PO": "5071806629",
          "Sku": "194404",
          "Description": "APTAMIL PROFUTURA CESARBIOTIK FO 800G",
          "Total Qty Pcs": 432,
          "Batch": "2028.07.10",
          "DefectiveCode": "NORM",
          "Remark": "ONPOINT COMPANY LIMITED"
        }
      ];
    } else if (type === "inventory") {
      filename = "Mau_Ton_Kho_Inventory.xlsx";
      sampleRows = [
        {
          "Sku": "194402",
          "DESCR": "APTAMIL PROFUTURA CESARBIOTIK IF 380G",
          "Qty": 290986,
          "Account": "Danone",
          "Loc": "A19-113-1",
          "BatchNo": "2028.07.10"
        },
        {
          "Sku": "194403",
          "DESCR": "APTAMIL PROFUTURA CESARBIOTIK IF 800G",
          "Qty": 104445,
          "Account": "Danone",
          "Loc": "A19-107-2",
          "BatchNo": "2028.07.11"
        }
      ];
    } else if (type === "baseline-inventory" || type === "master-data") {
      filename = "Mau_Ton_Kho_Cu_Baseline.xlsx";
      sampleRows = [
        {
          "Sku": "194402",
          "DESCR": "APTAMIL PROFUTURA CESARBIOTIK IF 380G",
          "BatchNo": "2028.07.10",
          "Qty": 50000,
          "Loc": "A19-113-1"
        },
        {
          "Sku": "194403",
          "DESCR": "APTAMIL PROFUTURA CESARBIOTIK IF 800G",
          "BatchNo": "2028.07.11",
          "Qty": 30000,
          "Loc": "A19-107-2"
        }
      ];
    }

    const ws = xlsx.utils.json_to_sheet(sampleRows);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Template");
    const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

    return new Response(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });
  } catch (error) {
    console.error("Template generation error:", error);
    return NextResponse.json({ error: "Failed to generate template" }, { status: 500 });
  }
}
