import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NearSupply - RFQ & Quotation Management Platform",
  description: "Professional RFQ and quotation management platform for businesses. Manage requests for quotations, supplier proposals, and product catalogs efficiently.",
  keywords: ["NearSupply", "RFQ", "Quotation", "Procurement", "Supplier", "Business", "B2B"],
  authors: [{ name: "NearSupply Team" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "NearSupply",
    description: "RFQ & Quotation Management Platform",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
