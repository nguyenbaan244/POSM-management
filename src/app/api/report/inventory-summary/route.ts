import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const masterData = await prisma.masterData.findMany();
    const inventory = await prisma.inventory.findMany();
    const inbounds = await prisma.inbound.findMany({ where: { reversed: false } });
    const outbounds = await prisma.outbound.findMany({ where: { reversed: false } });

    const summary = masterData.map(md => {
      const skuLower = md.sku.toLowerCase();
      const accountLower = (md.account || "").toLowerCase();

      const inv = inventory.find(i => i.sku.toLowerCase() === skuLower && (i.account || "").toLowerCase() === accountLower);
      const totalIn = inbounds.filter(ib => ib.sku.toLowerCase() === skuLower && (ib.account || "").toLowerCase() === accountLower).reduce((sum, ib) => sum + ib.quantity, 0);
      const totalOut = outbounds.filter(ob => ob.sku.toLowerCase() === skuLower && (ob.account || "").toLowerCase() === accountLower).reduce((sum, ob) => sum + ob.quantity, 0);
      
      return {
        account: md.account,
        sku: md.sku,
        descr: md.descr,
        totalInbound: totalIn,
        totalOutbound: totalOut,
        balance: inv ? inv.quantity : 0
      };
    });

    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json({ error: "Failed to generate summary" }, { status: 500 });
  }
}
