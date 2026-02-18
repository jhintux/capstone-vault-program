# Capstone Vault Program

A Program that implements a **multi-signature token vault**: multiple owners control a shared token account, and outgoing transfers require a configurable threshold of owner approvals via proposals.

## Overview

- **Program ID:** `HdeZQYeeWuyrdmVmmyM1u4iUq6iNhhYTY73oNZjzqJLX`
- **Model:** One vault per `(owner, mint)` pair. The “owner” in the vault PDA is the vault creator; the vault itself has a list of up to 5 **owners** and a **threshold** (e.g. 2-of-3).
- **Flow:** Initialize vault → Deposit tokens → Create proposal → Approve (until threshold) → Execute proposal (transfer from vault to destination).

## Instructions

| Instruction | Description |
|-------------|-------------|
| `initialize_vault` | Create a vault PDA and its associated token account (ATA). Sets `owners`, optional `threshold` (default 2), and optional `is_active`. Caller must be in `owners`. |
| `deposit` | Transfer tokens from the signer’s ATA into the vault’s ATA. Signer must match the vault’s PDA “owner” (creator). |
| `create_proposal` | Create a proposal to send `amount` to `destination`. Only vault owners can create. Increments `vault.proposal_count` and assigns `proposal_id`. |
| `approve_proposal` | Record the signer’s approval for a proposal. Each owner can approve at most once; proposal must not be executed. |
| `execute_proposal` | If approvals ≥ `vault.threshold` and proposal not executed, transfer `proposal.amount` from vault ATA to `proposal.destination`’s ATA, then mark proposal executed. Vault PDA signs the transfer. |

## State

### Vault

- **Seeds:** `["vault", owner.key(), mint.key()]` (owner = vault creator)
- **Fields:** `owners` (max 5), `threshold`, `proposal_count`, `bump`, optional `is_active`
- **Token account:** Vault has an ATA for the same mint, with the **vault PDA** as authority.

### Proposal

- **Seeds:** `["proposal", vault.key(), proposal_id.to_le_bytes()]`
- **Fields:** `vault`, `proposer`, `destination`, `amount`, `approvals` (one bool per vault owner), `executed`, `proposal_id`, `bump`

## Errors

- **VaultError::Unauthorized** — Signer is not in the vault’s `owners` list.
- **ProposalError::ProposalAlreadyExecuted** — Execute or approve after execution.
- **ProposalError::ProposalAlreadyApproved** — Owner approving twice.
- **ProposalError::ThresholdNotReached** — Execute before enough approvals.

---

## Account relationships (Mermaid)

```mermaid
erDiagram
    Owner ||--o{ Vault : "creates / seeds"
    Mint ||--o{ Vault_ATA : "mint of"
    Mint ||--o{ Owner_ATA : "mint of"
    Mint ||--o{ Destination_ATA : "mint of"
    Vault ||--o{ Proposal : "has many"
    Vault ||--|| Vault_ATA : "authority of"
    Owner ||--o| Owner_ATA : "authority of"
    Destination ||--o| Destination_ATA : "authority of"
    Proposal }o--|| Vault : "belongs to"
    Proposal }o--o| Destination : "sends to"

    Vault {
        PDA seeds_vault_owner_mint
        Vec owners
        u8 threshold
        u64 proposal_count
        u8 bump
    }

    Proposal {
        PDA seeds_proposal_vault_id
        pubkey vault
        pubkey proposer
        pubkey destination
        u64 amount
        Vec approvals
        bool executed
        u64 proposal_id
        u8 bump
    }

    Vault_ATA {
        TokenAccount authority_vault
        Mint mint
    }

    Owner_ATA {
        TokenAccount authority_owner
        Mint mint
    }

    Destination_ATA {
        TokenAccount authority_destination
        Mint mint
    }

    Mint {
        SPL Mint
    }

    Owner {
        Pubkey wallet
    }

    Destination {
        Pubkey wallet
    }
```

### PDA and account flow (by instruction)

```mermaid
flowchart LR
    subgraph Init
        O1[Owner] --> V[Vault PDA]
        M[Mint] --> V
        V --> VA[Vault ATA]
        M --> VA
    end

    subgraph Deposit
        O2[Owner] --> V2[Vault]
        OA[Owner ATA] --> VA2[Vault ATA]
    end

    subgraph Proposals
        V3[Vault] --> P[Proposal PDA]
        P --> DA[Destination ATA]
        VA3[Vault ATA] --> DA
    end

    Vault_PDA["Vault PDA\nseeds: ['vault', owner, mint]"]
    Proposal_PDA["Proposal PDA\nseeds: ['proposal', vault, proposal_id]"]
    Vault_PDA --> Proposal_PDA
```

- **Vault PDA:** `["vault", owner.key(), mint.key()]` — one vault per (creator, mint).
- **Proposal PDA:** `["proposal", vault.key(), proposal_id]` — one proposal per (vault, proposal_id).
- **Vault ATA:** Standard ATA for `(vault_pda, mint)`; vault is the token authority.
- **Destination ATA:** ATA for `(proposal.destination, mint)`; used only in `execute_proposal`.
