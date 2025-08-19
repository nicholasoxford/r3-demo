use anchor_lang::prelude::*;
use crate::contexts::RevokeAllSessionKeys;
use crate::events::AllSessionKeysRevoked;

/// Revoke all session keys at once (emergency function)
pub fn handler(ctx: Context<RevokeAllSessionKeys>) -> Result<()> {
    let user_account = &mut ctx.accounts.user_account;

    for session_key in &mut user_account.session_keys {
        session_key.is_revoked = true;
    }

    msg!(
        "All session keys revoked for authority: {}",
        user_account.authority
    );

    emit!(AllSessionKeysRevoked {
        authority: user_account.authority,
        count: user_account.session_keys.len() as u32,
    });

    Ok(())
}
