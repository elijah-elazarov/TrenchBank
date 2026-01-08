"use client";

import { ReactNode } from "react";
import { Toaster } from "react-hot-toast";
import { WalletContextProvider } from "@/contexts/WalletContextProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WalletContextProvider>
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#16161f",
            color: "#fff",
            border: "1px solid #1e1e2a",
            borderRadius: "12px",
          },
          success: {
            iconTheme: {
              primary: "#00ff88",
              secondary: "#0a0a0f",
            },
          },
          error: {
            iconTheme: {
              primary: "#ef4444",
              secondary: "#fff",
            },
          },
        }}
      />
    </WalletContextProvider>
  );
}

