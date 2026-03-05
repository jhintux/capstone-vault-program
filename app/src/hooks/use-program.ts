"use client";

import { useMemo } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { getProgram } from "@/lib/anchor-client";
import type { Program } from "@coral-xyz/anchor";
import { CapstoneVaultProgram } from "@/idl/capstone_vault_program";

export function useProgram(): Program<CapstoneVaultProgram> | null {
  const { connection } = useConnection();
  const wallet = useWallet();

  return useMemo(() => {
    if (!wallet.publicKey || !wallet.signTransaction) return null;
    try {
      return getProgram<CapstoneVaultProgram>(connection, wallet as never);
    } catch {
      return null;
    }
  }, [connection, wallet]);
}
