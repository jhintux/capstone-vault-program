"use client";

import dynamic from "next/dynamic";

const WalletMultiButton = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

export function Header() {
  return (
    <header className="w-full border-b border-border bg-background px-6 py-3 flex items-center justify-between">
      <span className="text-lg font-bold tracking-tight">Capstone Vault</span>
      <WalletMultiButton />
    </header>
  );
}
