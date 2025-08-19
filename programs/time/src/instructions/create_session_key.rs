use crate::constants::MAX_SESSION_KEYS;
use crate::contexts::CreateSessionKey;
use crate::errors::ErrorCode;
use crate::events::SessionKeyCreated;
use crate::state::{ExpirationType, SessionKey, SessionPermissions};
use anchor_lang::prelude::*;

/// Create a new session key with specified permissions and expiry
pub fn handler(
    ctx: Context<CreateSessionKey>,
    session_pubkey: Pubkey,
    expires_at: i64,
    expiration_type: ExpirationType,
    permissions: SessionPermissions,
) -> Result<()> {
    let user_account = &mut ctx.accounts.user_account;
    let clock = Clock::get()?;

    // Validate expiry based on type
    match expiration_type {
        ExpirationType::Time => {
            // Validate timestamp is in the future
            require!(expires_at > clock.unix_timestamp, ErrorCode::InvalidExpiry);
        }
        ExpirationType::BlockHeight => {
            // Validate block height is in the future
            require!(expires_at > clock.slot as i64, ErrorCode::InvalidExpiry);
        }
    }

    // Check if we've reached the maximum number of session keys
    require!(
        user_account.session_keys.len() < MAX_SESSION_KEYS,
        ErrorCode::TooManySessionKeys
    );

    // Check if session key already exists
    require!(
        !user_account
            .session_keys
            .iter()
            .any(|k| k.pubkey == session_pubkey),
        ErrorCode::SessionKeyAlreadyExists
    );

    // Create new session key
    let session_key = SessionKey {
        pubkey: session_pubkey,
        created_at: clock.unix_timestamp,
        expires_at,
        expiration_type,
        permissions,
        is_revoked: false,
        label: [0; 32], // Can be used for custom labeling
    };

    user_account.session_keys.push(session_key);

    msg!(
        "Session key created: {} (expires at: {} - type: {:?})",
        session_pubkey,
        expires_at,
        expiration_type
    );

    emit!(SessionKeyCreated {
        authority: user_account.authority,
        session_key: session_pubkey,
        expires_at,
        permissions,
    });

    Ok(())
}
