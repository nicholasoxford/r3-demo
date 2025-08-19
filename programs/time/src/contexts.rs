use crate::constants::MAX_SESSION_KEYS;
use crate::state::UserAccount;
use anchor_lang::prelude::*;

// ===== CONTEXTS =====

#[derive(Accounts)]
pub struct InitializeUserAccount<'info> {
    #[account(
        init,
        payer = authority,
        space = UserAccount::space(MAX_SESSION_KEYS),
        seeds = [UserAccount::SEED_PREFIX, authority.key().as_ref()],
        bump
    )]
    pub user_account: Account<'info, UserAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateSessionKey<'info> {
    #[account(
        mut,
        seeds = [UserAccount::SEED_PREFIX, authority.key().as_ref()],
        bump = user_account.bump,
        has_one = authority
    )]
    pub user_account: Account<'info, UserAccount>,

    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevokeSessionKey<'info> {
    #[account(
        mut,
        seeds = [UserAccount::SEED_PREFIX, authority.key().as_ref()],
        bump = user_account.bump,
        has_one = authority
    )]
    pub user_account: Account<'info, UserAccount>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateSessionKey<'info> {
    #[account(
        mut,
        seeds = [UserAccount::SEED_PREFIX, authority.key().as_ref()],
        bump = user_account.bump,
        has_one = authority
    )]
    pub user_account: Account<'info, UserAccount>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ExecuteWithSessionKey<'info> {
    #[account(
        seeds = [UserAccount::SEED_PREFIX, user_account.authority.as_ref()],
        bump = user_account.bump
    )]
    pub user_account: Account<'info, UserAccount>,

    /// The session key being used to sign this transaction
    pub session_signer: Signer<'info>,

    /// The authority account (owner of funds) - only required for transfers
    /// CHECK: This account is validated against user_account.authority when present
    #[account(mut)]
    pub from: Option<AccountInfo<'info>>,

    /// The recipient account - only required for transfers
    /// CHECK: This can be any account that will receive funds
    #[account(mut)]
    pub to: Option<AccountInfo<'info>>,

    /// System program - only required for transfers
    pub system_program: Option<Program<'info, System>>,
}

#[derive(Accounts)]
pub struct CleanupSessionKeys<'info> {
    #[account(
        mut,
        seeds = [UserAccount::SEED_PREFIX, authority.key().as_ref()],
        bump = user_account.bump,
        has_one = authority
    )]
    pub user_account: Account<'info, UserAccount>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct RevokeAllSessionKeys<'info> {
    #[account(
        mut,
        seeds = [UserAccount::SEED_PREFIX, authority.key().as_ref()],
        bump = user_account.bump,
        has_one = authority
    )]
    pub user_account: Account<'info, UserAccount>,

    pub authority: Signer<'info>,
}
