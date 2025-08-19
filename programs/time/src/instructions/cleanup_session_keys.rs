use crate::contexts::CleanupSessionKeys;
use anchor_lang::prelude::*;

/// Clean up expired or revoked session keys to save space
pub fn handler(ctx: Context<CleanupSessionKeys>) -> Result<()> {
    let user_account = &mut ctx.accounts.user_account;
    let clock = Clock::get()?;

    let initial_count = user_account.session_keys.len();

    // Remove expired and revoked keys
    user_account.session_keys.retain(|key| key.is_valid(&clock));

    let removed_count = initial_count - user_account.session_keys.len();

    msg!("Cleaned up {} expired/revoked session keys", removed_count);

    Ok(())
}
