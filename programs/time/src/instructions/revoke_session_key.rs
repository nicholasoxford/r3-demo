use anchor_lang::prelude::*;
use crate::contexts::RevokeSessionKey;
use crate::errors::ErrorCode;
use crate::events::SessionKeyRevoked;

/// Revoke an existing session key
pub fn handler(
    ctx: Context<RevokeSessionKey>,
    session_pubkey: Pubkey,
) -> Result<()> {
    let user_account = &mut ctx.accounts.user_account;

    // Find and revoke the session key
    let session_key = user_account
        .session_keys
        .iter_mut()
        .find(|k| k.pubkey == session_pubkey)
        .ok_or(ErrorCode::SessionKeyNotFound)?;

    require!(!session_key.is_revoked, ErrorCode::SessionKeyAlreadyRevoked);

    session_key.is_revoked = true;

    msg!("Session key revoked: {}", session_pubkey);

    emit!(SessionKeyRevoked {
        authority: user_account.authority,
        session_key: session_pubkey,
    });

    Ok(())
}
