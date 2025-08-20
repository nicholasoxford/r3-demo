use crate::contexts::SplRevokeDelegate;
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Revoke};

/// Revoke Token Program delegate (owner clears delegate)
pub fn handler(ctx: Context<SplRevokeDelegate>) -> Result<()> {
    token_interface::revoke(CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Revoke {
            source: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        },
    ))
}
