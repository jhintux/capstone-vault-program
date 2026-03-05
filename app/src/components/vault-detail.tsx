"use client";

import { useEffect, useState, useCallback } from "react";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  useVault,
  VaultAccount,
  ProposalAccount,
} from "@/hooks/use-vault";
import { truncateAddress } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { DepositDialog } from "./deposit-dialog";
import { NewProposalModal } from "./new-proposal-modal";

interface Props {
  mintAddress: string;
  creatorAddress: string;
  vaultIndex: number;
}

export function VaultDetail({
  mintAddress,
  creatorAddress,
  vaultIndex,
}: Props) {
  const { publicKey } = useWallet();
  const {
    fetchVault,
    fetchVaultAtaBalance,
    fetchProposals,
    approveProposal,
    executeProposal,
    loading,
    error,
    clearError,
  } = useVault();

  const [vault, setVault] = useState<VaultAccount | null>(null);
  const [ataBalance, setAtaBalance] = useState<string>("0");
  const [proposals, setProposals] = useState<ProposalAccount[]>([]);
  const [depositOpen, setDepositOpen] = useState(false);
  const [proposalOpen, setProposalOpen] = useState(false);
  const [txStatus, setTxStatus] = useState<string | null>(null);

  const mintPubkey = new PublicKey(mintAddress);
  const creatorPubkey = new PublicKey(creatorAddress);

  const refresh = useCallback(async () => {
    const v = await fetchVault(mintPubkey, creatorPubkey);
    setVault(v);
    if (v) {
      const bal = await fetchVaultAtaBalance(mintPubkey, creatorPubkey);
      setAtaBalance(bal);
      const props = await fetchProposals(
        mintPubkey,
        Number(v.proposalCount),
        creatorPubkey
      );
      setProposals(props);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mintAddress, creatorAddress, fetchVault, fetchVaultAtaBalance, fetchProposals]);

  useEffect(() => {
    if (publicKey) refresh();
  }, [publicKey, refresh]);

  const handleApprove = async (proposal: ProposalAccount) => {
    clearError();
    setTxStatus(null);
    try {
      const tx = await approveProposal(
        mintPubkey,
        new BN(proposal.proposalId.toString()),
        creatorPubkey
      );
      setTxStatus(`Approved! Tx: ${tx}`);
      await refresh();
    } catch {
      // error shown from hook
    }
  };

  const handleExecute = async (proposal: ProposalAccount) => {
    clearError();
    setTxStatus(null);
    try {
      const tx = await executeProposal(
        mintPubkey,
        new BN(proposal.proposalId.toString()),
        proposal,
        creatorPubkey
      );
      setTxStatus(`Executed! Tx: ${tx}`);
      await refresh();
    } catch {
      // error shown from hook
    }
  };

  const currentUserIndex = vault
    ? vault.owners.findIndex((o) => publicKey && o.equals(publicKey))
    : -1;

  const hasApproved = (proposal: ProposalAccount) => {
    if (currentUserIndex < 0) return false;
    return proposal.approvals[currentUserIndex] === true;
  };

  const approvalCount = (proposal: ProposalAccount) =>
    proposal.approvals.filter(Boolean).length;

  const quorumReached = (proposal: ProposalAccount) =>
    vault ? approvalCount(proposal) >= vault.threshold : false;

  if (!publicKey) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Connect your wallet to view vault details.
      </div>
    );
  }

  if (!vault) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Loading vault…
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-auto">
      {/* Vault header */}
      <div className="space-y-1">
        <h2 className="text-2xl font-bold">
          Vault {vaultIndex + 1} – {truncateAddress(mintAddress)}
        </h2>
        <p className="text-sm text-muted-foreground font-mono">{ataBalance} tokens</p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setDepositOpen(true)}
          className="mt-2"
        >
          Deposit
        </Button>
      </div>

      <Separator />

      {/* Vault meta */}
      <div className="text-sm text-muted-foreground space-y-1">
        <p>
          <span className="font-medium text-foreground">Owners:</span>{" "}
          {vault.owners.map((o) => truncateAddress(o)).join(", ")}
        </p>
        <p>
          <span className="font-medium text-foreground">Threshold:</span>{" "}
          {vault.threshold} / {vault.owners.length}
        </p>
      </div>

      <Separator />

      {/* Proposals */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Proposals</h3>
          <Button
            size="icon"
            variant="outline"
            className="h-7 w-7 text-base"
            onClick={() => setProposalOpen(true)}
            title="New proposal"
          >
            +
          </Button>
        </div>

        {proposals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No proposals yet.</p>
        ) : (
          <div className="space-y-3">
            {proposals.map((proposal, idx) => {
              const approved = hasApproved(proposal);
              const reached = quorumReached(proposal);
              return (
                <div
                  key={idx}
                  className="border border-border rounded-lg p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-0.5 text-sm flex-1">
                      <p className="font-medium">
                        Transfer{" "}
                        <span className="font-mono">
                          {proposal.amount.toString()}
                        </span>{" "}
                        of{" "}
                        <span className="font-mono">
                          {truncateAddress(mintAddress)}
                        </span>{" "}
                        to{" "}
                        <span className="font-mono">
                          {truncateAddress(proposal.destination)}
                        </span>
                      </p>
                      <p className="text-muted-foreground">
                        Proposed by:{" "}
                        <span className="font-mono">
                          {truncateAddress(proposal.proposer)}
                        </span>
                      </p>
                      <p className="text-muted-foreground">
                        Quorum:{" "}
                        <span className="font-medium text-foreground">
                          {approvalCount(proposal)} / {vault.threshold}
                        </span>
                      </p>
                      {proposal.executed && (
                        <Badge variant="secondary" className="mt-1">
                          Executed
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={
                          loading ||
                          approved ||
                          proposal.executed
                        }
                        onClick={() => handleApprove(proposal)}
                        title={
                          approved
                            ? "Already approved"
                            : proposal.executed
                            ? "Proposal already executed"
                            : "Approve proposal"
                        }
                      >
                        {approved ? "Approved" : "Approve"}
                      </Button>
                      <Button
                        size="sm"
                        variant={reached && !proposal.executed ? "default" : "outline"}
                        disabled={loading || !reached || proposal.executed}
                        onClick={() => handleExecute(proposal)}
                        title={
                          proposal.executed
                            ? "Already executed"
                            : !reached
                            ? "Quorum not reached"
                            : "Execute proposal"
                        }
                      >
                        Execute
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Status / error messages */}
      {txStatus && (
        <p className="text-sm text-green-600 break-all">{txStatus}</p>
      )}
      {error && <p className="text-sm text-destructive break-all">{error}</p>}

      {/* Dialogs */}
      <DepositDialog
        open={depositOpen}
        onOpenChange={setDepositOpen}
        mint={mintPubkey}
        creator={creatorPubkey}
        onSuccess={refresh}
      />

      <NewProposalModal
        open={proposalOpen}
        onOpenChange={setProposalOpen}
        mint={mintPubkey}
        creator={creatorPubkey}
        onSuccess={refresh}
      />
    </div>
  );
}
