use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenInterface};

use crate::errors::{ProposalError, VaultError};
use crate::state::{Proposal, Vault};

#[derive(Accounts)]
pub struct ApproveProposal<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    /// CHECK: Creator pubkey is only used for vault PDA derivation; no account data is read.
    pub creator: UncheckedAccount<'info>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        seeds = [b"vault", creator.key().as_ref(), mint.key().as_ref()],
        bump = vault.bump
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        mut,
        seeds = [b"proposal", vault.key().as_ref(), &proposal.proposal_id.to_le_bytes()],
        bump = proposal.bump
    )]
    pub proposal: Account<'info, Proposal>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

impl<'info> ApproveProposal<'info> {
    pub fn approve_proposal(&mut self) -> Result<()> {
        require!(
            self.vault.owners.contains(&self.owner.key()),
            VaultError::Unauthorized
        );

        require!(
            self.proposal.executed != true,
            ProposalError::ProposalAlreadyExecuted
        );

        let owner_ix = self.vault.owners.iter().position(|&key| key == self.owner.key()).unwrap();

        require!(
            !self.proposal.approvals[owner_ix],
            ProposalError::ProposalAlreadyApproved
        );

        self.proposal.approvals[owner_ix] = true;

        Ok(())
    }
}
