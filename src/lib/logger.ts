import { prisma } from "./prisma";
import { cookies } from "next/headers";

export async function logAction(action: string, details: string) {
  try {
    let userId = null;
    let username = "System";

    const cookieStore = await cookies();
    const sessionId = cookieStore.get("sessionId")?.value;

    if (sessionId) {
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: { user: true }
      });
      if (session && session.user) {
        userId = session.user.id;
        username = session.user.name;
      }
    }

    await prisma.actionLog.create({
      data: {
        userId,
        username,
        action,
        details
      }
    });
  } catch (error) {
    console.error("Failed to log action:", error);
  }
}
