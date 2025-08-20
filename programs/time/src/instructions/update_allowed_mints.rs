use crate::constants::MAX_ALLOWED_MINTS;
use crate::contexts::UpdateAllowedMints;
use anchor_lang::prelude::*;

/// Set or replace the allowlist of SPL token mints for this user account
pub fn handler(ctx: Context<UpdateAllowedMints>, mints: Vec<Pubkey>) -> Result<()> {
    require!(mints.len() <= MAX_ALLOWED_MINTS, crate::errors::ErrorCode::TooManyAllowedMints);

    let user_account = &mut ctx.accounts.user_account;
    user_account.allowed_mints = mints;

    Ok(())
}


