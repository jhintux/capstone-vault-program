use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use std::collections::HashSet;
use crate::state::Vault;

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(
        init,
        space = Vault::DISCRIMINATOR.len() + Vault::INIT_SPACE,
        seeds = [b"vault", user.key().as_ref(), mint.key().as_ref()],
        payer = user,
        bump
    )]
    vault: Account<'info, Vault>,
    #[account(
        init,
        payer = user,
        associated_token::mint = mint,
        associated_token::authority = vault,
        associated_token::token_program = token_program
    )]
    vault_ata: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mint::token_program = token_program
    )]
    mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    user: Signer<'info>,
    associated_token_program: Program<'info, AssociatedToken>,
    token_program: Interface<'info, TokenInterface>,
    system_program: Program<'info, System>,
}

impl<'info> InitializeVault<'info> {
    pub fn init_vault(
        &mut self,
        props: InitializeVaultProps,
        bumps: &InitializeVaultBumps,
    ) -> Result<()> {
        let threshold = props.threshold.unwrap_or(2u8);
        assert!(threshold > 0, "threshold must be > 0");
        assert!(props.owners.len() >= threshold as usize);

        assert!(!InitializeVault::has_duplicates(&props.owners));

        self.vault.owners = props.owners;
        self.vault.threshold = threshold;
        self.vault.proposal_count = 0;
        self.vault.bump = bumps.vault;

        Ok(())
    }

    pub fn has_duplicates(owners: &Vec<Pubkey>) -> bool {
        let mut set: HashSet<_> = HashSet::new();

        for key in owners {
            if !set.insert(key) {
                return true;
            }
        }

        return false;
    }
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeVaultProps {
    pub owners: Vec<Pubkey>,
    pub threshold: Option<u8>,
    pub is_active: Option<bool>,
}
