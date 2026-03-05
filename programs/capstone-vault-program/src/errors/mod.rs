use anchor_lang::prelude::*;

#[error_code]
pub enum VaultError {
    #[msg("Not an owner of the vault")]
    Unauthorized,
}

#[error_code]
pub enum ProposalError {
    #[msg("Destination account does not match proposal destination")]
    InvalidDestination,
    #[msg("Proposal already executed")]
    ProposalAlreadyExecuted,
    #[msg("Owner already approved the proposal")]
    ProposalAlreadyApproved,
    #[msg("Not enough approvals")]
    ThresholdNotReached,
}
