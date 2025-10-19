"use client";

import { SessionProvider } from "next-auth/react";
import { TRPCReactProvider } from "~/trpc/react";
import { Toaster } from "sonner";
import { Navigation } from "./Navigation";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TRPCReactProvider>
        <Navigation />
        {children}
        <Toaster position="top-right" richColors />
      </TRPCReactProvider>
    </SessionProvider>
  );
}

