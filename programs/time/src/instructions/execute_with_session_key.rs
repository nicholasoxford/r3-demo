use anchor_lang::prelude::*;
use crate::contexts::ExecuteWithSessionKey;
use crate::state::{SessionAction, ExpirationType};
use crate::errors::ErrorCode;
use crate::events::SessionActionExecuted;

/// Execute an action using a session key
pub fn handler(
    ctx: Context<ExecuteWithSessionKey>,
    action: SessionAction,
) -> Result<()> {
    let user_account = &ctx.accounts.user_account;
    let session_signer = &ctx.accounts.session_signer;
    let clock = Clock::get()?;

    // Find the session key
    let session_key = user_account
        .session_keys
        .iter()
        .find(|k| k.pubkey == session_signer.key())
        .ok_or(ErrorCode::SessionKeyNotFound)?;

    // Validate session key
    require!(!session_key.is_revoked, ErrorCode::SessionKeyRevoked);
    
    // Check expiration based on type
    match session_key.expiration_type {
        ExpirationType::Time => {
            require!(
                session_key.expires_at > clock.unix_timestamp,
                ErrorCode::SessionKeyExpired
            );
        }
        ExpirationType::BlockHeight => {
            require!(
                session_key.expires_at > clock.slot as i64,
                ErrorCode::SessionKeyExpired
            );
        }
    }

    // Check permissions
    match action {
        SessionAction::Transfer { .. } => {
            require!(
                session_key.permissions.can_transfer,
                ErrorCode::InsufficientPermissions
            );
        }
        SessionAction::Delegate { .. } => {
            require!(
                session_key.permissions.can_delegate,
                ErrorCode::InsufficientPermissions
            );
        }
        SessionAction::Custom { .. } => {
            require!(
                session_key.permissions.can_execute_custom,
                ErrorCode::InsufficientPermissions
            );
        }
    }

    // Execute the action (simplified - in real implementation would handle actual operations)
    msg!(
        "Action executed by session key: {} for authority: {}",
        session_signer.key(),
        user_account.authority
    );

    emit!(SessionActionExecuted {
        authority: user_account.authority,
        session_key: session_signer.key(),
        action,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
