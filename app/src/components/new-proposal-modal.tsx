"use client";

import { useState } from "react";
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
  mint: PublicKey;
  creator?: PublicKey;
  onSuccess: () => void;
}

export function NewProposalModal({
  open,
  onOpenChange,
  mint,
  creator,
  onSuccess,
}: Props) {
  const { createProposal, loading } = useVault();
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setFormError(null);
    try {
      const destKey = new PublicKey(destination.trim());
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount < 0) {
        setFormError("Enter a valid amount (0 or more)");
        return;
      }
      await createProposal(mint, destKey, Math.round(parsedAmount), creator);
      onSuccess();
      onOpenChange(false);
      setDestination("");
      setAmount("");
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New Proposal</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="prop-destination">Destination (wallet address)</Label>
            <Input
              id="prop-destination"
              placeholder="Recipient public key"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="prop-amount">Amount (base units)</Label>
            <Input
              id="prop-amount"
              type="number"
              min="0"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
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
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Creating..." : "Create Proposal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
