use anchor_lang::prelude::*;
use crate::contexts::InitializeUserAccount;

/// Initialize a user account that can hold session keys
pub fn handler(ctx: Context<InitializeUserAccount>) -> Result<()> {
    let user_account = &mut ctx.accounts.user_account;
    user_account.authority = ctx.accounts.authority.key();
    user_account.session_keys = Vec::new();
    user_account.bump = ctx.bumps.user_account;

    msg!(
        "User account initialized for authority: {}",
        user_account.authority
    );
    Ok(())
}
