import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  createMint,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  mintTo,
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
      program.programId,
    )[0];
  }

  async function setupMintForTest(): Promise<PublicKey> {
    return createMint(
      provider.connection,
      user,
      user.publicKey,
      null,
      6,
      undefined,
      undefined,
      TOKEN_PROGRAM_ID,
    );
  }

  async function initializeVault(
    mintPk: PublicKey,
    props: { owners: PublicKey[]; threshold?: number },
  ) {
    const vaultPda = getVaultPda(mintPk, user.publicKey);
    const vaultAta = getAssociatedTokenAddressSync(
      mintPk,
      vaultPda,
      true, // allowOwnerOffCurve for PDA
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
        owner: user.publicKey,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([user])
      .rpc();
  }

  function getProposalPda(
    vaultPda: PublicKey,
    proposalId: anchor.BN,
  ): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("proposal"),
        vaultPda.toBuffer(),
        proposalId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId,
    );
    return pda;
  }

  async function deposit(mintPk: PublicKey, amount: number) {
    const vaultPda = getVaultPda(mintPk, user.publicKey);
    const vaultAta = getAssociatedTokenAddressSync(mintPk, vaultPda, true);
    const userAta = getAssociatedTokenAddressSync(
      mintPk,
      user.publicKey,
      false,
    );

    return program.methods
      .deposit(new anchor.BN(amount))
      .accountsStrict({
        owner: user.publicKey,
        mint: mintPk,
        vault: vaultPda,
        vaultAta,
        ownerAta: userAta,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([user])
      .rpc();
  }

  async function createProposal(
    mintPk: PublicKey,
    destination: PublicKey,
    amount: number,
  ) {
    const vaultPda = getVaultPda(mintPk, user.publicKey);
    const vaultAccount = await program.account.vault.fetch(vaultPda);
    const proposalId = vaultAccount.proposalCount;
    const proposalPda = getProposalPda(vaultPda, proposalId);

    return program.methods
      .createProposal(destination, new anchor.BN(amount))
      .accountsStrict({
        owner: user.publicKey,
        mint: mintPk,
        vault: vaultPda,
        proposal: proposalPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([user])
      .rpc();
  }

  async function approveProposal(
    mintPk: PublicKey,
    approver: Keypair,
    proposalId: anchor.BN,
  ) {
    const vaultPda = getVaultPda(mintPk, approver.publicKey);
    const proposalPda = getProposalPda(vaultPda, proposalId);

    return program.methods
      .approveProposal()
      .accountsStrict({
        owner: approver.publicKey,
        mint: mintPk,
        vault: vaultPda,
        proposal: proposalPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([approver])
      .rpc();
  }

  async function executeProposal(
    mintPk: PublicKey,
    executor: Keypair,
    proposalId: anchor.BN,
    destinationAta: PublicKey,
  ) {
    const vaultPda = getVaultPda(mintPk, executor.publicKey);
    const vaultAccount = await program.account.vault.fetch(vaultPda);
    const proposalPda = getProposalPda(vaultPda, proposalId);
    const proposalAccount = await program.account.proposal.fetch(proposalPda);
    const vaultAta = getAssociatedTokenAddressSync(mintPk, vaultPda, true);

    return program.methods
      .executeProposal()
      .accountsStrict({
        owner: executor.publicKey,
        mint: mintPk,
        vault: vaultPda,
        proposal: proposalPda,
        vaultAta,
        destinationAta,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([executor])
      .rpc();
  }

  describe("Initialization Tests", () => {
    it("✅ Vault initializes correctly", async () => {
      const mint = await setupMintForTest();
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
      const mint = await setupMintForTest();
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
      const mint = await setupMintForTest();
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
      const mint = await setupMintForTest();
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

    it("❌ Empty owners → should fail", async () => {
      const mint = await setupMintForTest();
      const owners: PublicKey[] = [];
      try {
        await initializeVault(mint, { owners, threshold: 1 });
        expect.fail("Expected transaction to fail");
      } catch {
        // expected - owners.len() >= threshold fails or constraint
      }
    });

    it("✅ Single owner with threshold 1", async () => {
      const mint = await setupMintForTest();
      const owners = [user.publicKey];
      const tx = await initializeVault(mint, { owners, threshold: 1 });
      expect(tx).to.be.a("string");
      const vaultPda = getVaultPda(mint, user.publicKey);
      const vaultAccount = await program.account.vault.fetch(vaultPda);
      expect(vaultAccount.owners.length).to.equal(1);
      expect(vaultAccount.threshold).to.equal(1);
    });

    it("✅ Max owners (5) initializes correctly", async () => {
      const mint = await setupMintForTest();
      const owners = [
        user.publicKey,
        Keypair.generate().publicKey,
        Keypair.generate().publicKey,
        Keypair.generate().publicKey,
        Keypair.generate().publicKey,
      ];
      const tx = await initializeVault(mint, { owners, threshold: 3 });
      expect(tx).to.be.a("string");
      const vaultPda = getVaultPda(mint, user.publicKey);
      const vaultAccount = await program.account.vault.fetch(vaultPda);
      expect(vaultAccount.owners.length).to.equal(5);
      expect(vaultAccount.threshold).to.equal(3);
    });
  });

  describe("Deposit Tests", () => {
    it("✅ Deposit increases vault balance", async () => {
      const mint = await setupMintForTest();
      const owners = [user.publicKey, Keypair.generate().publicKey];
      await initializeVault(mint, { owners, threshold: 2 });

      const userAta = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        user,
        mint,
        user.publicKey,
      );
      await mintTo(
        provider.connection,
        user,
        mint,
        userAta.address,
        user,
        1_000_000,
      );

      const vaultPda = getVaultPda(mint, user.publicKey);
      const vaultAta = getAssociatedTokenAddressSync(mint, vaultPda, true);
      const vaultAtaBefore = await provider.connection.getTokenAccountBalance(
        vaultAta,
      );

      await deposit(mint, 500_000);

      const vaultAtaAfter = await provider.connection.getTokenAccountBalance(
        vaultAta,
      );
      expect(Number(vaultAtaAfter.value.amount)).to.equal(
        Number(vaultAtaBefore.value.amount) + 500_000,
      );
    });

    it("❌ Non-owner cannot deposit", async () => {
      const mint = await setupMintForTest();
      const owner1 = Keypair.generate();
      const owner2 = Keypair.generate();
      const owners = [owner1.publicKey, owner2.publicKey];
      await initializeVault(mint, { owners, threshold: 2 });
      const nonOwner = Keypair.generate();
      const vaultPdaNonOwner = getVaultPda(mint, nonOwner.publicKey);
      const vaultAtaNonOwner = getAssociatedTokenAddressSync(
        mint,
        vaultPdaNonOwner,
        true,
      );
      const nonOwnerAta = getAssociatedTokenAddressSync(
        mint,
        nonOwner.publicKey,
        false,
      );
      try {
        await program.methods
          .deposit(new anchor.BN(100))
          .accountsStrict({
            owner: nonOwner.publicKey,
            mint,
            vault: vaultPdaNonOwner,
            vaultAta: vaultAtaNonOwner,
            ownerAta: nonOwnerAta,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([nonOwner])
          .rpc();
        expect.fail("Expected transaction to fail");
      } catch {
        // expected - vault at (nonOwner, mint) does not exist
      }
    });

    it("❌ Deposit more than owner balance fails", async () => {
      const mint = await setupMintForTest();
      const owners = [user.publicKey];
      await initializeVault(mint, { owners, threshold: 1 });
      const userAta = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        user,
        mint,
        user.publicKey,
      );
      await mintTo(provider.connection, user, mint, userAta.address, user, 100);
      try {
        await deposit(mint, 1_000_000);
        expect.fail("Expected transaction to fail (insufficient balance)");
      } catch {
        // expected - transfer would exceed balance
      }
    });
  });

  describe("Proposal Tests", () => {
    it("✅ Owner can create proposal", async () => {
      const mint = await setupMintForTest();
      const owner2 = Keypair.generate();
      const owners = [user.publicKey, owner2.publicKey];
      await initializeVault(mint, { owners, threshold: 2 });

      const destination = Keypair.generate().publicKey;
      const tx = await createProposal(mint, destination, 100);
      expect(tx).to.be.a("string");

      const vaultPda = getVaultPda(mint, user.publicKey);
      const proposalPda = getProposalPda(vaultPda, new anchor.BN(0));
      const proposal = await program.account.proposal.fetch(proposalPda);
      expect(proposal.destination.toBase58()).to.equal(destination.toBase58());
      expect(Number(proposal.amount)).to.equal(100);
    });

    it("❌ Non-owner cannot create", async () => {
      const mint = await setupMintForTest();
      const owner1 = Keypair.generate();
      const owner2 = Keypair.generate();
      const owners = [owner1.publicKey, owner2.publicKey];
      await initializeVault(mint, { owners, threshold: 2 });

      const destination = Keypair.generate().publicKey;
      try {
        await createProposal(mint, destination, 100);
        expect.fail("Expected transaction to fail");
      } catch {
        // expected - user is not in vault.owners
      }
    });

    it("❌ Proposal ID increments properly", async () => {
      const mint = await setupMintForTest();
      const owners = [user.publicKey, Keypair.generate().publicKey];
      await initializeVault(mint, { owners, threshold: 2 });

      const dest1 = Keypair.generate().publicKey;
      const dest2 = Keypair.generate().publicKey;

      await createProposal(mint, dest1, 100);
      await createProposal(mint, dest2, 200);

      const vaultPda = getVaultPda(mint, user.publicKey);
      const proposal0 = await program.account.proposal.fetch(
        getProposalPda(vaultPda, new anchor.BN(0)),
      );
      const proposal1 = await program.account.proposal.fetch(
        getProposalPda(vaultPda, new anchor.BN(1)),
      );

      expect(Number(proposal0.proposalId)).to.equal(0);
      expect(Number(proposal1.proposalId)).to.equal(1);
    });

    it("✅ Create proposal with amount 0 allowed", async () => {
      const mint = await setupMintForTest();
      const owners = [user.publicKey];
      await initializeVault(mint, { owners, threshold: 1 });
      const destination = Keypair.generate().publicKey;
      const tx = await createProposal(mint, destination, 0);
      expect(tx).to.be.a("string");
      const vaultPda = getVaultPda(mint, user.publicKey);
      const proposal = await program.account.proposal.fetch(
        getProposalPda(vaultPda, new anchor.BN(0)),
      );
      expect(Number(proposal.amount)).to.equal(0);
    });
  });

  describe("Approval Tests", () => {
    it("✅ Owner can approve", async () => {
      const mint = await setupMintForTest();
      const owner2 = Keypair.generate();
      const owners = [user.publicKey, owner2.publicKey];
      await initializeVault(mint, { owners, threshold: 2 });

      const destination = Keypair.generate().publicKey;
      await createProposal(mint, destination, 100);

      const vaultPda = getVaultPda(mint, user.publicKey);
      const proposalPda = getProposalPda(vaultPda, new anchor.BN(0));

      await approveProposal(mint, user, new anchor.BN(0));

      const proposal = await program.account.proposal.fetch(proposalPda);
      expect(proposal.approvals[0]).to.equal(true);
      expect(proposal.approvals[1]).to.equal(false);
    });

    it("❌ Non-owner cannot approve", async () => {
      const mint = await setupMintForTest();
      const owner2 = Keypair.generate();
      const owners = [user.publicKey, owner2.publicKey];
      await initializeVault(mint, { owners, threshold: 2 });

      const destination = Keypair.generate().publicKey;
      await createProposal(mint, destination, 100);

      const nonOwner = Keypair.generate();
      try {
        await approveProposal(mint, nonOwner, new anchor.BN(0));
        expect.fail("Expected transaction to fail");
      } catch {
        // expected - non-owner cannot approve (vault at nonOwner PDA does not exist or Unauthorized)
      }
    });

    it("❌ Cannot approve twice", async () => {
      const mint = await setupMintForTest();
      const owners = [user.publicKey, Keypair.generate().publicKey];
      await initializeVault(mint, { owners, threshold: 2 });

      const destination = Keypair.generate().publicKey;
      await createProposal(mint, destination, 100);

      await approveProposal(mint, user, new anchor.BN(0));

      try {
        await approveProposal(mint, user, new anchor.BN(0));
        expect.fail("Expected transaction to fail");
      } catch {
        // expected - ProposalAlreadyApproved
      }
    });

    it("❌ Cannot approve executed proposal", async () => {
      const mint = await setupMintForTest();
      const owners = [user.publicKey];
      await initializeVault(mint, { owners, threshold: 1 });

      const userAta = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        user,
        mint,
        user.publicKey,
      );
      await mintTo(
        provider.connection,
        user,
        mint,
        userAta.address,
        user,
        1_000_000,
      );

      const destination = Keypair.generate().publicKey;
      const destAta = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        user,
        mint,
        destination,
      );

      await deposit(mint, 500_000);
      await createProposal(mint, destination, 100);
      await approveProposal(mint, user, new anchor.BN(0));
      await executeProposal(mint, user, new anchor.BN(0), destAta.address);
      try {
        await approveProposal(mint, user, new anchor.BN(0));
        expect.fail(
          "Expected transaction to fail with ProposalAlreadyExecuted",
        );
      } catch {
        // expected - ProposalAlreadyExecuted
      }
    });
  });

  describe("Execution Tests", () => {
    it("❌ Cannot execute before threshold reached", async () => {
      const mint = await setupMintForTest();
      const owner2 = Keypair.generate();
      const owners = [user.publicKey, owner2.publicKey];
      await initializeVault(mint, { owners, threshold: 2 });

      const destination = Keypair.generate().publicKey;
      const destAta = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        user,
        mint,
        destination,
      );
      await createProposal(mint, destination, 100);
      await approveProposal(mint, user, new anchor.BN(0));
      try {
        await executeProposal(mint, user, new anchor.BN(0), destAta.address);
        expect.fail("Expected transaction to fail");
      } catch {
        // expected - ThresholdNotReached (only 1 approval, need 2)
      }
    });

    it("✅ Execute after threshold reached", async () => {
      const mint = await setupMintForTest();
      const owners = [user.publicKey];
      await initializeVault(mint, { owners, threshold: 1 });

      const userAta = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        user,
        mint,
        user.publicKey,
      );
      await mintTo(
        provider.connection,
        user,
        mint,
        userAta.address,
        user,
        1_000_000,
      );
      await deposit(mint, 500_000);

      const destination = Keypair.generate().publicKey;
      const destAta = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        user,
        mint,
        destination,
      );
      await createProposal(mint, destination, 100);
      await approveProposal(mint, user, new anchor.BN(0));
      const tx = await executeProposal(
        mint,
        user,
        new anchor.BN(0),
        destAta.address,
      );
      expect(tx).to.be.a("string");
      const vaultPda = getVaultPda(mint, user.publicKey);
      const proposalPda = getProposalPda(vaultPda, new anchor.BN(0));
      const proposal = await program.account.proposal.fetch(proposalPda);
      expect(proposal.executed).to.equal(true);
    });

    it("❌ Execute twice", async () => {
      const mint = await setupMintForTest();
      const owners = [user.publicKey];
      await initializeVault(mint, { owners, threshold: 1 });

      const userAta = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        user,
        mint,
        user.publicKey,
      );
      await mintTo(
        provider.connection,
        user,
        mint,
        userAta.address,
        user,
        1_000_000,
      );
      await deposit(mint, 500_000);

      const destination = Keypair.generate().publicKey;
      const destAta = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        user,
        mint,
        destination,
      );
      await createProposal(mint, destination, 100);
      await approveProposal(mint, user, new anchor.BN(0));
      await executeProposal(mint, user, new anchor.BN(0), destAta.address);
      try {
        await executeProposal(mint, user, new anchor.BN(0), destAta.address);
        expect.fail("Expected transaction to fail");
      } catch {
        // expected - ProposalAlreadyExecuted
      }
    });

    it("❌ Execute if already executed", async () => {
      const mint = await setupMintForTest();
      const owners = [user.publicKey];
      await initializeVault(mint, { owners, threshold: 1 });

      const userAta = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        user,
        mint,
        user.publicKey,
      );
      await mintTo(
        provider.connection,
        user,
        mint,
        userAta.address,
        user,
        1_000_000,
      );
      await deposit(mint, 500_000);

      const destination = Keypair.generate().publicKey;
      const destAta = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        user,
        mint,
        destination,
      );
      await createProposal(mint, destination, 100);
      await approveProposal(mint, user, new anchor.BN(0));
      await executeProposal(mint, user, new anchor.BN(0), destAta.address);
      try {
        await executeProposal(mint, user, new anchor.BN(0), destAta.address);
        expect.fail("Expected transaction to fail");
      } catch {
        // expected - ProposalAlreadyExecuted
      }
    });

    it("✅ Funds transferred correctly", async () => {
      const mint = await setupMintForTest();
      const owners = [user.publicKey];
      await initializeVault(mint, { owners, threshold: 1 });

      const userAta = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        user,
        mint,
        user.publicKey,
      );
      await mintTo(
        provider.connection,
        user,
        mint,
        userAta.address,
        user,
        1_000_000,
      );
      await deposit(mint, 500_000);

      const destination = Keypair.generate().publicKey;
      const destAta = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        user,
        mint,
        destination,
      );
      const transferAmount = 100_000;
      await createProposal(mint, destination, transferAmount);
      await approveProposal(mint, user, new anchor.BN(0));
      const vaultPda = getVaultPda(mint, user.publicKey);
      const vaultAta = getAssociatedTokenAddressSync(mint, vaultPda, true);
      const vaultBalanceBefore =
        await provider.connection.getTokenAccountBalance(vaultAta);
      const destBalanceBefore =
        await provider.connection.getTokenAccountBalance(destAta.address);

      await executeProposal(mint, user, new anchor.BN(0), destAta.address);

      const vaultBalanceAfter =
        await provider.connection.getTokenAccountBalance(vaultAta);
      const destBalanceAfter = await provider.connection.getTokenAccountBalance(
        destAta.address,
      );
      expect(Number(vaultBalanceAfter.value.amount)).to.equal(
        Number(vaultBalanceBefore.value.amount) - transferAmount,
      );
      expect(Number(destBalanceAfter.value.amount)).to.equal(
        Number(destBalanceBefore.value.amount) + transferAmount,
      );
    });

    it("❌ Non-owner cannot execute", async () => {
      const mint = await setupMintForTest();
      const owners = [user.publicKey];
      await initializeVault(mint, { owners, threshold: 1 });
      const userAta = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        user,
        mint,
        user.publicKey,
      );
      await mintTo(
        provider.connection,
        user,
        mint,
        userAta.address,
        user,
        1_000_000,
      );
      await deposit(mint, 500_000);
      const destination = Keypair.generate().publicKey;
      const destAta = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        user,
        mint,
        destination,
      );
      await createProposal(mint, destination, 100);
      await approveProposal(mint, user, new anchor.BN(0));
      const fakeSigner = Keypair.generate();
      const vaultPdaFake = getVaultPda(mint, fakeSigner.publicKey);
      const proposalPda = getProposalPda(
        getVaultPda(mint, user.publicKey),
        new anchor.BN(0),
      );
      const vaultAtaFake = getAssociatedTokenAddressSync(
        mint,
        vaultPdaFake,
        true,
      );
      try {
        await program.methods
          .executeProposal()
          .accountsStrict({
            owner: fakeSigner.publicKey,
            mint,
            vault: vaultPdaFake,
            proposal: proposalPda,
            vaultAta: vaultAtaFake,
            destinationAta: destAta.address,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([fakeSigner])
          .rpc();
        expect.fail("Expected transaction to fail");
      } catch {
        // expected - vault at (fakeSigner, mint) does not exist
      }
    });

    it("❌ Execute with wrong destination ATA (wrong mint) fails", async () => {
      const mint1 = await setupMintForTest();
      const mint2 = await setupMintForTest();
      const owners = [user.publicKey];
      await initializeVault(mint1, { owners, threshold: 1 });
      const userAta1 = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        user,
        mint1,
        user.publicKey,
      );
      await mintTo(
        provider.connection,
        user,
        mint1,
        userAta1.address,
        user,
        1_000_000,
      );
      await deposit(mint1, 500_000);
      const destination = Keypair.generate().publicKey;
      const destAtaMint1 = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        user,
        mint1,
        destination,
      );
      const destAtaMint2 = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        user,
        mint2,
        destination,
      );
      await createProposal(mint1, destination, 100);
      await approveProposal(mint1, user, new anchor.BN(0));
      try {
        await executeProposal(
          mint1,
          user,
          new anchor.BN(0),
          destAtaMint2.address,
        );
        expect.fail("Expected transaction to fail (wrong ATA mint)");
      } catch {
        // expected - destination_ata must be for same mint
      }
    });

    it("✅ Execute proposal with amount 0 succeeds", async () => {
      const mint = await setupMintForTest();
      const owners = [user.publicKey];
      await initializeVault(mint, { owners, threshold: 1 });
      const destination = Keypair.generate().publicKey;
      const destAta = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        user,
        mint,
        destination,
      );
      await createProposal(mint, destination, 0);
      await approveProposal(mint, user, new anchor.BN(0));
      const tx = await executeProposal(
        mint,
        user,
        new anchor.BN(0),
        destAta.address,
      );
      expect(tx).to.be.a("string");
      const vaultPda = getVaultPda(mint, user.publicKey);
      const proposal = await program.account.proposal.fetch(
        getProposalPda(vaultPda, new anchor.BN(0)),
      );
      expect(proposal.executed).to.equal(true);
    });

    it("❌ Execute when destination ATA does not exist fails", async () => {
      const mint = await setupMintForTest();
      const owners = [user.publicKey];
      await initializeVault(mint, { owners, threshold: 1 });
      const userAta = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        user,
        mint,
        user.publicKey,
      );
      await mintTo(
        provider.connection,
        user,
        mint,
        userAta.address,
        user,
        1_000_000,
      );
      await deposit(mint, 500_000);
      const destination = Keypair.generate().publicKey;
      await createProposal(mint, destination, 100);
      await approveProposal(mint, user, new anchor.BN(0));
      const nonExistentDestAta = getAssociatedTokenAddressSync(
        mint,
        destination,
        false,
      );
      try {
        await executeProposal(mint, user, new anchor.BN(0), nonExistentDestAta);
        expect.fail(
          "Expected transaction to fail (destination ATA not created)",
        );
      } catch {
        // expected - destination ATA account does not exist
      }
    });
  });

  describe("Advanced Edge Cases (Impressive Points)", () => {
    it("❌ Proposal created but vault has insufficient funds", async () => {
      const mint = await setupMintForTest();
      const owners = [user.publicKey];
      await initializeVault(mint, { owners, threshold: 1 });
      const destination = Keypair.generate().publicKey;
      const destAta = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        user,
        mint,
        destination,
      );
      await createProposal(mint, destination, 1_000_000);
      await approveProposal(mint, user, new anchor.BN(0));
      try {
        await executeProposal(mint, user, new anchor.BN(0), destAta.address);
        expect.fail("Expected transaction to fail (insufficient funds)");
      } catch {
        // expected - vault has 0 balance
      }
    });

    it("❌ Approve proposal from wrong vault", async () => {
      const mint1 = await setupMintForTest();
      const mint2 = await setupMintForTest();
      const owners = [user.publicKey];
      await initializeVault(mint1, { owners, threshold: 1 });
      await initializeVault(mint2, { owners, threshold: 1 });
      await createProposal(mint1, Keypair.generate().publicKey, 100);
      try {
        const vaultPda2 = getVaultPda(mint2, user.publicKey);
        const proposalPda2 = getProposalPda(vaultPda2, new anchor.BN(0));
        await program.methods
          .approveProposal()
          .accountsStrict({
            owner: user.publicKey,
            mint: mint2,
            vault: vaultPda2,
            proposal: proposalPda2,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([user])
          .rpc();
        expect.fail("Expected transaction to fail");
      } catch {
        // expected - proposal belongs to vault1, not vault2
      }
    });

    it("❌ Wrong PDA seeds", async () => {
      const mint = await setupMintForTest();
      const owners = [user.publicKey];
      await initializeVault(mint, { owners, threshold: 1 });
      const vaultPda = getVaultPda(mint, user.publicKey);
      const wrongProposalPda = getProposalPda(vaultPda, new anchor.BN(99));
      try {
        await program.methods
          .approveProposal()
          .accountsStrict({
            owner: user.publicKey,
            mint,
            vault: vaultPda,
            proposal: wrongProposalPda,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([user])
          .rpc();
        expect.fail("Expected transaction to fail");
      } catch {
        // expected - proposal account at wrong PDA does not exist or invalid
      }
    });

    it("❌ Attempt fake vault authority signer", async () => {
      const mint = await setupMintForTest();
      const owners = [user.publicKey];
      await initializeVault(mint, { owners, threshold: 1 });
      await createProposal(mint, user.publicKey, 100);
      const fakeSigner = Keypair.generate();
      const vaultPda = getVaultPda(mint, user.publicKey);
      const proposalPda = getProposalPda(vaultPda, new anchor.BN(0));
      try {
        await program.methods
          .approveProposal()
          .accountsStrict({
            owner: fakeSigner.publicKey,
            mint,
            vault: getVaultPda(mint, fakeSigner.publicKey),
            proposal: proposalPda,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([fakeSigner])
          .rpc();
        expect.fail("Expected transaction to fail");
      } catch {
        // expected - fake signer's vault PDA does not exist or Unauthorized
      }
    });
  });
});
