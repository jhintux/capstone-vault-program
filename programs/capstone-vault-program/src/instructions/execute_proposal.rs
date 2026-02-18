use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{transfer_checked, TransferChecked},
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::errors::ProposalError;
use crate::state::{Proposal, Vault};

#[derive(Accounts)]
pub struct ExecuteProposal<'info> {
    #[account(mut)]
    owner: Signer<'info>,
    #[account(
        mint::token_program = token_program
    )]
    mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref(), mint.key().as_ref()],
        bump = vault.bump
    )]
    vault: Account<'info, Vault>,
    #[account(
        mut,
        seeds = [b"proposal", vault.key().as_ref(), &proposal.proposal_id.to_le_bytes()],
        bump = proposal.bump
    )]
    proposal: Account<'info, Proposal>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = vault,
        associated_token::token_program = token_program
    )]
    vault_ata: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = proposal.destination,
        associated_token::token_program = token_program
    )]
    destination_ata: InterfaceAccount<'info, TokenAccount>,
    associated_token_program: Program<'info, AssociatedToken>,
    token_program: Interface<'info, TokenInterface>,
    system_program: Program<'info, System>,
}

impl<'info> ExecuteProposal<'info> {
    pub fn execute_proposal(&mut self) -> Result<()> {
        require!(
            self.proposal
                .approvals
                .iter()
                .filter(|e| e == &&true)
                .count()
                >= self.vault.threshold as usize,
            ProposalError::ThresholdNotReached
        );

        require!(
            !self.proposal.executed,
            ProposalError::ProposalAlreadyExecuted
        );

        let transfer_accounts = TransferChecked {
            from: self.vault_ata.to_account_info(),
            to: self.destination_ata.to_account_info(),
            mint: self.mint.to_account_info(),
            authority: self.vault.to_account_info(),
        };

        let mint_key = self.mint.key();
        let bump = self.vault.bump;
        let seeds: &[&[u8]] = &[
            b"vault",
            self.owner.key().as_ref(),
            mint_key.as_ref(),
            &[bump],
        ];
        let signer_seeds = &[&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            transfer_accounts,
            signer_seeds,
        );
        transfer_checked(cpi_ctx, self.proposal.amount, self.mint.decimals)?;

        self.proposal.executed = true;

        Ok(())
    }
}
