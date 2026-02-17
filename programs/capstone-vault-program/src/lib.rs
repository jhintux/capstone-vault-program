use anchor_lang::prelude::*;

pub mod state;
pub mod instructions;

pub use instructions::*;

declare_id!("HdeZQYeeWuyrdmVmmyM1u4iUq6iNhhYTY73oNZjzqJLX");

#[program]
pub mod capstone_vault_program {
    use super::*;

    pub fn initialize_vault(ctx: Context<InitializeVault>, props: InitializeVaultProps) -> Result<()> {
        ctx.accounts.init_vault(props, &ctx.bumps)
    }
}
