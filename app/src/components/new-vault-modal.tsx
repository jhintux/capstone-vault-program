"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useVault } from "@/hooks/use-vault";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (mintAddress: string) => void;
}

export function NewVaultModal({ open, onOpenChange, onSuccess }: Props) {
  const { publicKey } = useWallet();
  const { initializeVault, loading } = useVault();

  const [mintInput, setMintInput] = useState("");
  const [ownersInput, setOwnersInput] = useState("");
  const [threshold, setThreshold] = useState("2");
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setFormError(null);
    try {
      const mint = new PublicKey(mintInput.trim());

      const ownerLines = ownersInput
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const owners = ownerLines.map((o) => new PublicKey(o));

      const thresholdNum = parseInt(threshold, 10);
      if (isNaN(thresholdNum) || thresholdNum <= 0) {
        setFormError("Threshold must be greater than 0");
        return;
      }
      if (owners.length < thresholdNum) {
        setFormError("Threshold cannot exceed number of owners");
        return;
      }
      if (owners.length > 5) {
        setFormError("Maximum 5 owners allowed");
        return;
      }

      const uniqueOwners = new Set(owners.map((o) => o.toBase58()));
      if (uniqueOwners.size !== owners.length) {
        setFormError("Duplicate owners are not allowed");
        return;
      }

      await initializeVault({
        mint,
        owners,
        threshold: thresholdNum,
        isActive,
      });

      onSuccess(mint.toBase58());
      onOpenChange(false);
      setMintInput("");
      setOwnersInput("");
      setThreshold("2");
      setIsActive(true);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleAddMyKey = () => {
    if (!publicKey) return;
    const existing = ownersInput.trim();
    const myKey = publicKey.toBase58();
    if (existing.includes(myKey)) return;
    setOwnersInput(existing ? `${existing}\n${myKey}` : myKey);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Vault</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="mint">Mint Address</Label>
            <Input
              id="mint"
              placeholder="Token mint public key"
              value={mintInput}
              onChange={(e) => setMintInput(e.target.value)}
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="owners">Owners (one per line or comma-separated, max 5)</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleAddMyKey}
                disabled={!publicKey}
              >
                + Add my key
              </Button>
            </div>
            <textarea
              id="owners"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Owner public keys..."
              value={ownersInput}
              onChange={(e) => setOwnersInput(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="threshold">Threshold (min approvals required)</Label>
            <Input
              id="threshold"
              type="number"
              min={1}
              placeholder="2"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="isActive"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="isActive">Active</Label>
          </div>

          {formError && (
            <p className="text-sm text-destructive">{formError}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !publicKey}>
            {loading ? "Creating..." : "Create Vault"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
