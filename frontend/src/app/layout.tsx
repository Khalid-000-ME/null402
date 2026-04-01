import "@/polyfills";
import type { Metadata } from "next";
import { JetBrains_Mono, DM_Sans, Space_Grotesk, Space_Mono } from 'next/font/google';
import { GeistPixelLine } from 'geist/font/pixel';
import { Analytics } from '@vercel/analytics/next';
import "./globals.css";
import { WalletProvider } from "@/lib/wallet";
import { Navigation } from "@/components/landing/navigation";

const jetbrainsMono = JetBrains_Mono({ 
  subsets: ["latin"],
  variable: '--font-jetbrains'
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: '--font-dm-sans',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: '--font-space-grotesk',
  display: 'swap',
});

const spaceMono = Space_Mono({
  weight: ['400', '700'],
  subsets: ["latin"],
  variable: '--font-space-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: "null402 — Confidential Lending on Ethereum",
  description:
    "null402 is the first confidential lending protocol on Ethereum using Zama fhEVM. Your collateral, debt and health factor are encrypted on-chain. Liquidation bots get ciphertext. They cannot target you. Your position is not hidden — it is null.",
  keywords: ["DeFi", "lending", "fhEVM", "Zama", "confidential", "FHE", "encrypted", "Ethereum", "null402"],
  openGraph: {
    title: "null402 — Your Position Is Null",
    description: "Confidential overcollateralised lending. Zero MEV surface. Powered by Zama fhEVM.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${dmSans.variable} ${spaceGrotesk.variable} ${spaceMono.variable} ${jetbrainsMono.variable} ${GeistPixelLine.variable} font-sans antialiased`}>
        <WalletProvider>
          <Navigation />
          {children}
        </WalletProvider>
        <Analytics />
      </body>
    </html>
  );
}
