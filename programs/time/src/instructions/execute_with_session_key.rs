use crate::contexts::ExecuteWithSessionKey;
use crate::errors::ErrorCode;
use crate::events::SessionActionExecuted;
use crate::state::{ExpirationType, SessionAction};
use anchor_lang::prelude::*;
use anchor_lang::system_program;

/// Execute an action using a session key
pub fn handler(ctx: Context<ExecuteWithSessionKey>, action: SessionAction) -> Result<()> {
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

    // Check permissions and execute action
    match action.clone() {
        SessionAction::Transfer { recipient, amount } => {
            require!(
                session_key.permissions.can_transfer,
                ErrorCode::InsufficientPermissions
            );

            // Check transfer amount limit
            if session_key.permissions.max_transfer_amount > 0 {
                require!(
                    amount <= session_key.permissions.max_transfer_amount,
                    ErrorCode::InsufficientPermissions
                );
            }

            // For transfers, ensure required accounts are present
            let from = ctx
                .accounts
                .from
                .as_ref()
                .ok_or(ErrorCode::InsufficientPermissions)?;
            let to = ctx
                .accounts
                .to
                .as_ref()
                .ok_or(ErrorCode::InsufficientPermissions)?;
            let system_program = ctx
                .accounts
                .system_program
                .as_ref()
                .ok_or(ErrorCode::InsufficientPermissions)?;

            // Verify that the 'from' account is the authority
            require!(
                from.key() == user_account.authority,
                ErrorCode::InsufficientPermissions
            );

            // Ensure the recipient account matches
            require!(to.key() == recipient, ErrorCode::InsufficientPermissions);

            // Perform the actual transfer from the authority to the recipient
            msg!(
                "Executing transfer: {} lamports from {} to {}",
                amount,
                user_account.authority,
                recipient
            );

            // Execute the system transfer
            system_program::transfer(
                CpiContext::new(
                    system_program.to_account_info(),
                    system_program::Transfer {
                        from: from.to_account_info(),
                        to: to.to_account_info(),
                    },
                ),
                amount,
            )?;
        }
        SessionAction::Delegate { .. } => {
            require!(
                session_key.permissions.can_delegate,
                ErrorCode::InsufficientPermissions
            );
            msg!("Delegate action requested");
        }
        SessionAction::Custom { .. } => {
            require!(
                session_key.permissions.can_execute_custom,
                ErrorCode::InsufficientPermissions
            );
            msg!("Custom action requested");
        }
    }

    emit!(SessionActionExecuted {
        authority: user_account.authority,
        session_key: session_signer.key(),
        action,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
