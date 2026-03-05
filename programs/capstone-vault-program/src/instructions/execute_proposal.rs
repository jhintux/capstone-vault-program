use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::{create_idempotent, AssociatedToken, Create},
    token::{transfer_checked, TransferChecked},
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::errors::ProposalError;
use crate::state::{Proposal, Vault};

#[derive(Accounts)]
pub struct ExecuteProposal<'info> {
    #[account(mut)]
    owner: Signer<'info>,
    /// CHECK: Creator pubkey is only used for vault PDA derivation; no account data is read.
    pub creator: UncheckedAccount<'info>,
    /// Destination wallet (owner of the destination ATA); must match proposal.destination.
    /// CHECK: Used as authority for ATA creation and validated by proposal state.
    pub destination: UncheckedAccount<'info>,
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
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = vault,
        associated_token::token_program = token_program
    )]
    pub vault_ata: InterfaceAccount<'info, TokenAccount>,
    /// Destination ATA (created by program if it does not exist).
    /// CHECK: Validated as the correct ATA for (mint, proposal.destination) or created via CPI.
    #[account(mut)]
    pub destination_ata: UncheckedAccount<'info>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

impl<'info> ExecuteProposal<'info> {
    pub fn execute_proposal(&mut self) -> Result<()> {
        require!(
            self.destination.key() == self.proposal.destination,
            ProposalError::InvalidDestination
        );

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

        // Create destination ATA if it does not exist (idempotent).
        let create_ata_accounts = Create {
            payer: self.owner.to_account_info(),
            associated_token: self.destination_ata.to_account_info(),
            authority: self.destination.to_account_info(),
            mint: self.mint.to_account_info(),
            system_program: self.system_program.to_account_info(),
            token_program: self.token_program.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(
            self.associated_token_program.to_account_info(),
            create_ata_accounts,
        );
        create_idempotent(cpi_ctx)?;

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
            self.creator.key.as_ref(),
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
