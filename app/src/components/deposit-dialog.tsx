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

export function DepositDialog({
  open,
  onOpenChange,
  mint,
  creator,
  onSuccess,
}: Props) {
  const { deposit, loading } = useVault();
  const [amount, setAmount] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setFormError(null);
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      setFormError("Enter a valid positive amount");
      return;
    }
    try {
      await deposit(mint, Math.round(parsed), creator);
      onSuccess();
      onOpenChange(false);
      setAmount("");
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Deposit Tokens</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="deposit-amount">Amount</Label>
            <Input
              id="deposit-amount"
              type="number"
              min="1"
              placeholder="Amount in base units"
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
            {loading ? "Depositing..." : "Deposit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
