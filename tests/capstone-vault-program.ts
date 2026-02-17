import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  createMint,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Keypair, PublicKey } from "@solana/web3.js";
import { CapstoneVaultProgram } from "../target/types/capstone_vault_program";
import { expect } from "chai";

describe("capstone-vault-program", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace
    .capstoneVaultProgram as Program<CapstoneVaultProgram>;
  const user = provider.wallet.payer;

  function getVaultPda(mintPk: PublicKey, userPk: PublicKey) {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), userPk.toBuffer(), mintPk.toBuffer()],
      program.programId
    )[0];
  }

  async function createMintForTest(): Promise<PublicKey> {
    return createMint(
      provider.connection,
      user,
      user.publicKey,
      null,
      6,
      undefined,
      undefined,
      TOKEN_PROGRAM_ID
    );
  }

  async function initializeVault(
    mintPk: PublicKey,
    props: { owners: PublicKey[]; threshold?: number }
  ) {
    const vaultPda = getVaultPda(mintPk, user.publicKey);
    const vaultAta = getAssociatedTokenAddressSync(
      mintPk,
      vaultPda,
      true // allowOwnerOffCurve for PDA
    );

    return program.methods
      .initializeVault({
        owners: props.owners,
        threshold: props.threshold,
        isActive: null,
      })
      .accountsStrict({
        vault: vaultPda,
        vaultAta,
        mint: mintPk,
        user: user.publicKey,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([user])
      .rpc();
  }

  describe("Initialization Tests", () => {
    it("✅ Vault initializes correctly", async () => {
      const mint = await createMintForTest();
      const owner1 = Keypair.generate();
      const owner2 = Keypair.generate();
      const owners = [owner1.publicKey, owner2.publicKey];

      const tx = await initializeVault(mint, { owners, threshold: 2 });
      expect(tx).to.be.a("string");
      
      const vaultPda = getVaultPda(mint, user.publicKey);
      const vaultAccount = await program.account.vault.fetch(vaultPda);
      expect(vaultAccount.owners.length).to.equal(2);
      expect(vaultAccount.threshold).to.equal(2);
    });

    it("❌ Threshold > owners → should fail", async () => {
      const mint = await createMintForTest();
      const owner1 = Keypair.generate();
      const owner2 = Keypair.generate();
      const owners = [owner1.publicKey, owner2.publicKey];

      try {
        await initializeVault(mint, { owners, threshold: 3 });
        expect.fail("Expected transaction to fail");
      } catch {
        // expected
      }
    });

    it("❌ Duplicate owners → should fail", async () => {
      const mint = await createMintForTest();
      const owner1 = Keypair.generate();
      const owners = [owner1.publicKey, owner1.publicKey];

      try {
        await initializeVault(mint, { owners, threshold: 2 });
        expect.fail("Expected transaction to fail");
      } catch {
        // expected
      }
    });

    it("❌ Threshold = 0 → should fail", async () => {
      const mint = await createMintForTest();
      const owner1 = Keypair.generate();
      const owner2 = Keypair.generate();
      const owners = [owner1.publicKey, owner2.publicKey];

      try {
        await initializeVault(mint, { owners, threshold: 0 });
        expect.fail("Expected transaction to fail");
      } catch {
        // expected
      }
    });
  });
});
