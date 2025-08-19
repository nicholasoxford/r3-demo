use crate::contexts::UpdateSessionKey;
use crate::errors::ErrorCode;
use crate::events::SessionKeyUpdated;
use crate::state::{ExpirationType, SessionPermissions};
use anchor_lang::prelude::*;

/// Update/modify an existing session key (e.g., extend expiry, change permissions)
pub fn handler(
    ctx: Context<UpdateSessionKey>,
    session_pubkey: Pubkey,
    new_expires_at: Option<i64>,
    new_permissions: Option<SessionPermissions>,
) -> Result<()> {
    let user_account = &mut ctx.accounts.user_account;
    let clock = Clock::get()?;

    // Store authority before mutable borrow
    let authority = user_account.authority;

    // Find the session key
    let session_key = user_account
        .session_keys
        .iter_mut()
        .find(|k| k.pubkey == session_pubkey)
        .ok_or(ErrorCode::SessionKeyNotFound)?;

    require!(!session_key.is_revoked, ErrorCode::SessionKeyRevoked);

    // Update expiry if provided
    if let Some(expires_at) = new_expires_at {
        // Validate based on expiration type
        match session_key.expiration_type {
            ExpirationType::Time => {
                require!(expires_at > clock.unix_timestamp, ErrorCode::InvalidExpiry);
            }
            ExpirationType::BlockHeight => {
                require!(expires_at > clock.slot as i64, ErrorCode::InvalidExpiry);
            }
        }
        session_key.expires_at = expires_at;
        msg!(
            "Session key expiry updated to: {} (type: {:?})",
            expires_at,
            session_key.expiration_type
        );
    }

    // Update permissions if provided
    if let Some(permissions) = new_permissions {
        session_key.permissions = permissions;
        msg!("Session key permissions updated");
    }

    // Store updated values before releasing mutable borrow
    let final_expires_at = session_key.expires_at;
    let final_permissions = session_key.permissions;

    emit!(SessionKeyUpdated {
        authority,
        session_key: session_pubkey,
        expires_at: final_expires_at,
        permissions: final_permissions,
    });

    Ok(())
}
