import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "POSM Management System",
  description: "Point of Sale Materials Management",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = { name: "Admin", role: "ADMIN" };

  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-screen bg-slate-50 flex overflow-hidden`}>
        <Sidebar user={user} />
        <main className="flex-1 h-screen overflow-y-auto min-w-0">
          {children}
        </main>
        <Toaster position="top-center" richColors theme="light" />
      </body>
    </html>

  );
}
