"use client";

import { useCallback, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getMint,
} from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import { useProgram } from "./use-program";
import { PROGRAM_ID_STR } from "@/config/solana";

const PROGRAM_ID = new PublicKey(PROGRAM_ID_STR);

export interface VaultAccount {
  owners: PublicKey[];
  threshold: number;
  proposalCount: bigint;
  bump: number;
  isActive: boolean | null;
}

export interface ProposalAccount {
  vault: PublicKey;
  proposer: PublicKey;
  destination: PublicKey;
  amount: bigint;
  approvals: boolean[];
  executed: boolean;
  proposalId: bigint;
  bump: number;
}

export function getVaultPda(mint: PublicKey, owner: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), owner.toBuffer(), mint.toBuffer()],
    PROGRAM_ID,
  )[0];
}

export function getProposalPda(vaultPda: PublicKey, proposalId: BN): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("proposal"),
      vaultPda.toBuffer(),
      proposalId.toArrayLike(Buffer, "le", 8),
    ],
    PROGRAM_ID,
  )[0];
}

export function useVault() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const program = useProgram();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const initializeVault = useCallback(
    async (params: {
      mint: PublicKey;
      owners: PublicKey[];
      threshold: number;
      isActive?: boolean | null;
    }) => {
      if (!program || !wallet.publicKey)
        throw new Error("Wallet not connected");
      setLoading(true);
      setError(null);
      try {
        const vaultPda = getVaultPda(params.mint, wallet.publicKey);
        const vaultAta = getAssociatedTokenAddressSync(
          params.mint,
          vaultPda,
          true,
        );

        const tx = await program.methods
          .initializeVault({
            owners: params.owners,
            threshold: params.threshold,
            isActive: params.isActive ?? null,
          })
          .accountsStrict({
            vault: vaultPda,
            vaultAta,
            mint: params.mint,
            owner: wallet.publicKey,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        return tx;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [program, wallet],
  );

  const fetchVault = useCallback(
    async (
      mint: PublicKey,
      creator?: PublicKey,
    ): Promise<VaultAccount | null> => {
      if (!program) return null;
      const creatorPubkey = creator ?? wallet.publicKey ?? null;
      if (!creatorPubkey) return null;
      try {
        const vaultPda = getVaultPda(mint, creatorPubkey);
        return (await program.account.vault.fetch(
          vaultPda,
        )) as unknown as VaultAccount;
      } catch {
        return null;
      }
    },
    [program, wallet.publicKey],
  );

  const fetchVaultAtaBalance = useCallback(
    async (mint: PublicKey, creator?: PublicKey): Promise<string> => {
      const creatorPubkey = creator ?? wallet.publicKey;
      if (!creatorPubkey) return "0";
      try {
        const vaultPda = getVaultPda(mint, creatorPubkey);
        const vaultAta = getAssociatedTokenAddressSync(mint, vaultPda, true);
        const info = await connection.getTokenAccountBalance(vaultAta);
        return info.value.uiAmountString ?? "0";
      } catch {
        return "0";
      }
    },
    [connection, wallet.publicKey],
  );

  const deposit = useCallback(
    async (mint: PublicKey, amount: number, creator?: PublicKey) => {
      if (!program || !wallet.publicKey)
        throw new Error("Wallet not connected");
      const creatorPubkey = creator ?? wallet.publicKey;
      setLoading(true);
      setError(null);
      try {
        const vaultPda = getVaultPda(mint, creatorPubkey);
        const vaultAta = getAssociatedTokenAddressSync(mint, vaultPda, true);
        const ownerAta = getAssociatedTokenAddressSync(
          mint,
          wallet.publicKey,
          false,
        );
        const mintAccount = await getMint(connection, mint);

        const tx = await program.methods
          .deposit(new BN(amount * 10 ** mintAccount.decimals))
          .accountsStrict({
            owner: wallet.publicKey,
            creator: creatorPubkey,
            mint,
            vault: vaultPda,
            vaultAta,
            ownerAta,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        return tx;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [connection, program, wallet.publicKey],
  );

  const createProposal = useCallback(
    async (
      mint: PublicKey,
      destination: PublicKey,
      amount: number,
      creator?: PublicKey,
    ) => {
      if (!program || !wallet.publicKey)
        throw new Error("Wallet not connected");
      const creatorPubkey = creator ?? wallet.publicKey;
      setLoading(true);
      setError(null);
      try {
        const vaultPda = getVaultPda(mint, creatorPubkey);
        const vault = (await program.account.vault.fetch(
          vaultPda,
        )) as unknown as VaultAccount;
        const proposalId = new BN(vault.proposalCount.toString());
        const proposalPda = getProposalPda(vaultPda, proposalId);
        const mintAccount = await getMint(connection, mint);

        const tx = await program.methods
          .createProposal(
            destination,
            new BN(amount * 10 ** mintAccount.decimals),
          )
          .accountsStrict({
            owner: wallet.publicKey,
            creator: creatorPubkey,
            mint,
            vault: vaultPda,
            proposal: proposalPda,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        return tx;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [connection, program, wallet.publicKey],
  );

  const approveProposal = useCallback(
    async (mint: PublicKey, proposalId: BN, creator?: PublicKey) => {
      if (!program || !wallet.publicKey)
        throw new Error("Wallet not connected");
      const creatorPubkey = creator ?? wallet.publicKey;
      setLoading(true);
      setError(null);
      try {
        const vaultPda = getVaultPda(mint, creatorPubkey);
        const proposalPda = getProposalPda(vaultPda, proposalId);

        const tx = await program.methods
          .approveProposal()
          .accountsStrict({
            owner: wallet.publicKey,
            creator: creatorPubkey,
            mint,
            vault: vaultPda,
            proposal: proposalPda,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        return tx;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [program, wallet.publicKey],
  );

  const executeProposal = useCallback(
    async (
      mint: PublicKey,
      proposalId: BN,
      proposal: ProposalAccount,
      creator?: PublicKey,
    ) => {
      console.log("executeProposal", mint);
      if (!program || !wallet.publicKey)
        throw new Error("Wallet not connected");
      const creatorPubkey = creator ?? wallet.publicKey;
      setLoading(true);
      setError(null);
      try {
        const vaultPda = getVaultPda(mint, creatorPubkey);
        const vaultAta = getAssociatedTokenAddressSync(mint, vaultPda, true);
        const proposalPda = getProposalPda(vaultPda, proposalId);
        const destinationAta = getAssociatedTokenAddressSync(
          mint,
          proposal.destination,
        );

        const tx = await program.methods
          .executeProposal()
          .accountsStrict({
            owner: wallet.publicKey,
            creator: creatorPubkey,
            destination: proposal.destination,
            mint,
            vault: vaultPda,
            proposal: proposalPda,
            vaultAta,
            destinationAta,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        return tx;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [program, wallet],
  );

  const fetchProposals = useCallback(
    async (
      mint: PublicKey,
      proposalCount: number,
      creator?: PublicKey,
    ): Promise<ProposalAccount[]> => {
      const creatorPubkey = creator ?? wallet.publicKey;
      if (!program || !creatorPubkey) return [];
      const vaultPda = getVaultPda(mint, creatorPubkey);
      const results: ProposalAccount[] = [];
      for (let i = 0; i < proposalCount; i++) {
        try {
          const pda = getProposalPda(vaultPda, new BN(i));
          const p = (await program.account.proposal.fetch(
            pda,
          )) as unknown as ProposalAccount;
          results.push(p);
        } catch {
          // skip missing proposals
        }
      }
      return results;
    },
    [program, wallet.publicKey],
  );

  return {
    loading,
    error,
    clearError,
    initializeVault,
    fetchVault,
    fetchVaultAtaBalance,
    deposit,
    createProposal,
    approveProposal,
    executeProposal,
    fetchProposals,
  };
}
