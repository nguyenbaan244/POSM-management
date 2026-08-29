import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "inbound";
    const startDateStr = searchParams.get("startDate");
    const endDateStr = searchParams.get("endDate");

    let dateFilter = {};
    if (startDateStr && endDateStr) {
      // Create date objects. For end date, set time to end of day to include all entries on that day.
      const startDate = new Date(startDateStr);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(endDateStr);
      endDate.setHours(23, 59, 59, 999);
      
      dateFilter = {
        date: {
          gte: startDate,
          lte: endDate,
        }
      };
    }

    if (type === "inbound") {
      const data = await prisma.inbound.findMany({
        where: dateFilter,
        orderBy: { date: 'desc' }
      });
      return NextResponse.json(data);
    } 
    else if (type === "outbound") {
      const data = await prisma.outbound.findMany({
        where: dateFilter,
        orderBy: { date: 'desc' }
      });
      return NextResponse.json(data);
    } 
    else if (type === "inventory") {
      const data = await prisma.inventory.findMany({
        orderBy: { sku: 'asc' }
      });
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
  } catch (error) {
    console.error("Report API Error:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
