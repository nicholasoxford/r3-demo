use crate::constants::MAX_SESSION_KEYS;
use crate::state::UserAccount;
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

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
pub struct InitializeUserAccountWithConfig<'info> {
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
        seeds = [UserAccount::SEED_PREFIX, user_account.authority.as_ref()],
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
        seeds = [UserAccount::SEED_PREFIX, user_account.authority.as_ref()],
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
        seeds = [UserAccount::SEED_PREFIX, user_account.authority.as_ref()],
        bump = user_account.bump,
        has_one = authority
    )]
    pub user_account: Account<'info, UserAccount>,

    pub authority: Signer<'info>,
}

// Removed SOL execute context to focus on SPL delegation only

#[derive(Accounts)]
pub struct CleanupSessionKeys<'info> {
    #[account(
        mut,
        seeds = [UserAccount::SEED_PREFIX, user_account.authority.as_ref()],
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
        seeds = [UserAccount::SEED_PREFIX, user_account.authority.as_ref()],
        bump = user_account.bump,
        has_one = authority
    )]
    pub user_account: Account<'info, UserAccount>,

    pub authority: Signer<'info>,
}

// Removed SOL deposit/withdraw contexts

// ===== SPL TOKEN CONTEXTS =====

#[derive(Accounts)]
pub struct SplApproveDelegate<'info> {
    #[account(
        mut,
        seeds = [UserAccount::SEED_PREFIX, user_account.authority.as_ref()],
        bump = user_account.bump,
        has_one = authority
    )]
    pub user_account: Account<'info, UserAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(mut)]
    pub token_account: InterfaceAccount<'info, TokenAccount>,

    pub mint: InterfaceAccount<'info, Mint>,

    /// CHECK: derived and checked in handler
    pub delegate_authority: UncheckedAccount<'info>,

    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct SplDelegatedTransfer<'info> {
    /// Session key must sign
    pub session_signer: Signer<'info>,

    #[account(
        seeds = [UserAccount::SEED_PREFIX, user_account.authority.as_ref()],
        bump = user_account.bump
    )]
    pub user_account: Account<'info, UserAccount>,

    #[account(mut)]
    pub from_token: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub to_token: InterfaceAccount<'info, TokenAccount>,

    pub mint: InterfaceAccount<'info, Mint>,

    /// CHECK: PDA signs via program
    pub delegate_authority: UncheckedAccount<'info>,

    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct SplRevokeDelegate<'info> {
    #[account(
        mut,
        seeds = [UserAccount::SEED_PREFIX, user_account.authority.as_ref()],
        bump = user_account.bump,
        has_one = authority
    )]
    pub user_account: Account<'info, UserAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(mut)]
    pub token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct UpdateAllowedMints<'info> {
    #[account(
        mut,
        seeds = [UserAccount::SEED_PREFIX, user_account.authority.as_ref()],
        bump = user_account.bump,
        has_one = authority
    )]
    pub user_account: Account<'info, UserAccount>,

    pub authority: Signer<'info>,
}
