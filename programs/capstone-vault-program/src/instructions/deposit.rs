use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{transfer_checked, TransferChecked},
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::state::Vault;

#[derive(Accounts)]
pub struct Deposit<'info> {
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
        associated_token::mint = mint,
        associated_token::authority = vault,
        associated_token::token_program = token_program
    )]
    vault_ata: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = owner,
        associated_token::token_program = token_program
    )]
    owner_ata: InterfaceAccount<'info, TokenAccount>,
    associated_token_program: Program<'info, AssociatedToken>,
    token_program: Interface<'info, TokenInterface>,
    system_program: Program<'info, System>,
}

impl<'info> Deposit<'info> {
    pub fn deposit(&mut self, amount: u64) -> Result<()> {
        let transfer_accounts = TransferChecked {
            from: self.owner_ata.to_account_info(),
            to: self.vault_ata.to_account_info(),
            mint: self.mint.to_account_info(),
            authority: self.owner.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(self.token_program.to_account_info(), transfer_accounts);
        transfer_checked(cpi_ctx, amount, self.mint.decimals)?;

        Ok(())
    }
}
