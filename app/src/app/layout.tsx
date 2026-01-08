import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "$KryptCash | Money Tools Built With Love",
  description: "Stake $KryptCash and earn real SOL rewards from PumpSwap trading fees",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
  openGraph: {
    title: "$KryptCash | Money Tools Built With Love",
    description: "Stake $KryptCash and earn real SOL rewards from PumpSwap trading fees",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 400,
        alt: "KryptCash - Money Tools Built With Love",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "$KryptCash | Money Tools Built With Love",
    description: "Stake $KryptCash and earn real SOL rewards from PumpSwap trading fees",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.png" type="image/png" />
      </head>
      <body className="bg-trench-black min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
