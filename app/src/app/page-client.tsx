"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  useVaultList,
  useOwnedVaultEntries,
  type VaultEntry,
} from "@/hooks/use-vault-list";
import { truncateAddress } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NewVaultModal } from "@/components/new-vault-modal";
import { VaultDetail } from "@/components/vault-detail";

export function PageClient() {
  const { publicKey } = useWallet();
  const { entries, addMint } = useVaultList();
  const { ownedEntries, loading } = useOwnedVaultEntries(entries);
  const [selectedEntry, setSelectedEntry] = useState<VaultEntry | null>(null);
  const [newVaultOpen, setNewVaultOpen] = useState(false);

  const handleVaultCreated = (mintAddress: string) => {
    if (!publicKey) return;
    addMint(mintAddress);
    setSelectedEntry({ mint: mintAddress, creator: publicKey.toBase58() });
  };

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r border-border flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="font-semibold text-sm">Vaults</span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={() => setNewVaultOpen(true)}
            disabled={!publicKey}
          >
            New
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {!publicKey && (
            <p className="px-4 py-2 text-xs text-muted-foreground">
              Connect wallet to see vaults.
            </p>
          )}
          {loading && publicKey && (
            <p className="px-4 py-2 text-xs text-muted-foreground">
              Loading vaults…
            </p>
          )}
          {!loading && ownedEntries.length === 0 && publicKey && (
            <p className="px-4 py-2 text-xs text-muted-foreground">
              No vaults yet. Click New to create one.
            </p>
          )}
          {!loading &&
            ownedEntries.map((entry, i) => (
              <button
                key={`${entry.mint}:${entry.creator}`}
                onClick={() => setSelectedEntry(entry)}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-accent transition-colors ${
                  selectedEntry?.mint === entry.mint &&
                  selectedEntry?.creator === entry.creator
                    ? "bg-accent font-medium"
                    : "text-muted-foreground"
                }`}
              >
                Vault {i + 1} – {truncateAddress(entry.mint)}
              </button>
            ))}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {selectedEntry ? (
          <VaultDetail
            key={`${selectedEntry.mint}:${selectedEntry.creator}`}
            mintAddress={selectedEntry.mint}
            creatorAddress={selectedEntry.creator}
            vaultIndex={Math.max(
              0,
              ownedEntries.findIndex(
                (e) =>
                  e.mint === selectedEntry.mint &&
                  e.creator === selectedEntry.creator
              )
            )}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            {publicKey
              ? "Select a vault from the sidebar, or create one."
              : "Connect your wallet to get started."}
          </div>
        )}
      </main>

      <NewVaultModal
        open={newVaultOpen}
        onOpenChange={setNewVaultOpen}
        onSuccess={handleVaultCreated}
      />
    </div>
  );
}
