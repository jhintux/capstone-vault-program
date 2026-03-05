"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { useVault } from "./use-vault";

const STORAGE_PREFIX = "vault_mints_";

function storageKey(walletAddress: string): string {
  return `${STORAGE_PREFIX}${walletAddress}`;
}

function readStoredMints(key: string): string[] {
  try {
    const stored = localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as string[]) : [];
  } catch {
    return [];
  }
}

/** All vault_mints_* keys in localStorage. */
function getAllVaultMintKeys(): string[] {
  if (typeof window === "undefined") return [];
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key?.startsWith(STORAGE_PREFIX)) keys.push(key);
  }
  return keys;
}

export interface VaultEntry {
  mint: string;
  creator: string;
}

function readAllEntries(): VaultEntry[] {
  const keys = getAllVaultMintKeys();
  const seen = new Set<string>();
  const entries: VaultEntry[] = [];
  for (const key of keys) {
    const creator = key.slice(STORAGE_PREFIX.length);
    const mints = readStoredMints(key);
    for (const mint of mints) {
      const id = `${mint}:${creator}`;
      if (seen.has(id)) continue;
      seen.add(id);
      entries.push({ mint, creator });
    }
  }
  return entries;
}

export function useVaultList() {
  const { publicKey } = useWallet();
  const [revision, setRevision] = useState(0);

  const entries = useMemo(
    () => readAllEntries(),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revision invalidates after localStorage writes
    [revision]
  );

  const addMint = useCallback(
    (mintAddress: string) => {
      if (!publicKey) return;
      const key = storageKey(publicKey.toBase58());
      const prev = readStoredMints(key);
      if (prev.includes(mintAddress)) return;
      const next = [...prev, mintAddress];
      try {
        localStorage.setItem(key, JSON.stringify(next));
        setRevision((r) => r + 1);
      } catch {
        // ignore storage errors
      }
    },
    [publicKey]
  );

  const removeMint = useCallback(
    (mintAddress: string) => {
      if (!publicKey) return;
      const key = storageKey(publicKey.toBase58());
      const prev = readStoredMints(key);
      const next = prev.filter((m) => m !== mintAddress);
      try {
        localStorage.setItem(key, JSON.stringify(next));
        setRevision((r) => r + 1);
      } catch {
        // ignore storage errors
      }
    },
    [publicKey]
  );

  const removeEntry = useCallback((mintAddress: string, creator: string) => {
    const key = storageKey(creator);
    const prev = readStoredMints(key);
    const next = prev.filter((m) => m !== mintAddress);
    try {
      localStorage.setItem(key, JSON.stringify(next));
      setRevision((r) => r + 1);
    } catch {
      // ignore storage errors
    }
  }, []);

  return { entries, addMint, removeMint, removeEntry };
}

/** Fetches each vault from entries and returns only those where the current wallet is in vault.owners. */
export function useOwnedVaultEntries(entries: VaultEntry[]) {
  const { publicKey } = useWallet();
  const { fetchVault } = useVault();
  const [ownedEntries, setOwnedEntries] = useState<VaultEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!publicKey) {
      setOwnedEntries([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setOwnedEntries([]);
    (async () => {
      const results: VaultEntry[] = [];
      for (const { mint, creator } of entries) {
        if (cancelled) return;
        try {
          const vault = await fetchVault(
            new PublicKey(mint),
            new PublicKey(creator)
          );
          if (
            vault &&
            vault.owners.some((o) => o.equals(publicKey))
          ) {
            results.push({ mint, creator });
          }
        } catch {
          // skip failed fetches
        }
      }
      if (!cancelled) {
        setOwnedEntries(results);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entries, publicKey, fetchVault]);

  return { ownedEntries, loading };
}
