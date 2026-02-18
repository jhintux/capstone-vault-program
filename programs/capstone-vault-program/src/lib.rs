use anchor_lang::prelude::*;

pub mod state;
pub mod instructions;
pub mod errors;

pub use instructions::*;

declare_id!("HdeZQYeeWuyrdmVmmyM1u4iUq6iNhhYTY73oNZjzqJLX");

#[program]
pub mod capstone_vault_program {
    use super::*;

    pub fn initialize_vault(ctx: Context<InitializeVault>, props: InitializeVaultProps) -> Result<()> {
        ctx.accounts.init_vault(props, &ctx.bumps)
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        ctx.accounts.deposit(amount)
    }

    pub fn create_proposal(
        ctx: Context<CreateProposal>,
        destination: Pubkey,
        amount: u64,
    ) -> Result<()> {
        ctx.accounts.create_proposal(&ctx.bumps, destination, amount)
    }

    pub fn approve_proposal(ctx: Context<ApproveProposal>) -> Result<()> {
        ctx.accounts.approve_proposal()
    }

    pub fn execute_proposal(ctx: Context<ExecuteProposal>) -> Result<()> {
        ctx.accounts.execute_proposal()
    }
}
