use anchor_lang::{prelude::*, InitSpace};

#[derive(InitSpace)]
#[account]
pub struct Vault {
    #[max_len(5)]
    pub owners: Vec<Pubkey>,
    pub threshold: u8,
    pub proposal_count: u64,
    pub bump: u8,
    pub is_active: Option<bool>
}

#[derive(InitSpace)]
#[account]
pub struct Proposal {
    pub vault: Pubkey,
    pub proposer: Pubkey,
    pub destination: Pubkey,
    pub amount: u64,
    #[max_len(5)]
    pub approvals: Vec<bool>,
    pub executed: bool,
    pub proposal_id: u64,
    pub bump: u8,
}


