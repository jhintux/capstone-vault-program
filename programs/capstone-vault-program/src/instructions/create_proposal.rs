use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenInterface};

use crate::state::{Proposal, Vault};
use crate::errors::VaultError;

#[derive(Accounts)]
pub struct CreateProposal<'info> {
    #[account(mut)]
    owner: Signer<'info>,
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
        init,
        space = Proposal::DISCRIMINATOR.len() + Proposal::INIT_SPACE,
        seeds = [b"proposal", vault.key().as_ref(), &vault.proposal_count.to_le_bytes()],
        payer = owner,
        bump
    )]
    pub proposal: Account<'info, Proposal>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

impl<'info> CreateProposal<'info> {
    pub fn create_proposal(
        &mut self,
        bumps: &CreateProposalBumps,
        destination: Pubkey,
        amount: u64,
    ) -> Result<()> {
        require!(
            self.vault.owners.contains(&self.owner.key()),
            VaultError::Unauthorized
        );

        self.proposal.vault = self.vault.key();
        self.proposal.proposer = self.owner.key();
        self.proposal.destination = destination;
        self.proposal.amount = amount;
        self.proposal.proposal_id = self.vault.proposal_count;
        self.proposal.approvals = vec![false; self.vault.owners.len()];
        self.proposal.executed = false;
        self.proposal.bump = bumps.proposal;

        self.vault.proposal_count += 1;

        Ok(())
    }
}
