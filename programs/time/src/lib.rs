use anchor_lang::prelude::*;

// Module declarations
pub mod constants;
pub mod contexts;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

// Re-exports for external use
pub use constants::*;
pub use contexts::*;
pub use events::*;
pub use state::*;

use instructions::*;

declare_id!("DdtvbkajRMQj26vuAUaV96hDtzE1mzvB7k64VeWzoWib");

#[program]
pub mod time {
    use super::*;

    /// Initialize a user account that can hold session keys
    pub fn initialize_user_account(ctx: Context<InitializeUserAccount>) -> Result<()> {
        initialize_user_account::handler(ctx)
    }

    /// Create a new session key with specified permissions and expiry
    pub fn create_session_key(
        ctx: Context<CreateSessionKey>,
        session_pubkey: Pubkey,
        expires_at: i64,
        expiration_type: ExpirationType,
        permissions: SessionPermissions,
    ) -> Result<()> {
        create_session_key::handler(
            ctx,
            session_pubkey,
            expires_at,
            expiration_type,
            permissions,
        )
    }

    /// Revoke an existing session key
    pub fn revoke_session_key(
        ctx: Context<RevokeSessionKey>,
        session_pubkey: Pubkey,
    ) -> Result<()> {
        revoke_session_key::handler(ctx, session_pubkey)
    }

    /// Update/modify an existing session key (e.g., extend expiry, change permissions)
    pub fn update_session_key(
        ctx: Context<UpdateSessionKey>,
        session_pubkey: Pubkey,
        new_expires_at: Option<i64>,
        new_permissions: Option<SessionPermissions>,
    ) -> Result<()> {
        update_session_key::handler(ctx, session_pubkey, new_expires_at, new_permissions)
    }

    /// Execute an action using a session key
    pub fn execute_with_session_key(
        ctx: Context<ExecuteWithSessionKey>,
        action: SessionAction,
    ) -> Result<()> {
        execute_with_session_key::handler(ctx, action)
    }

    /// Clean up expired or revoked session keys to save space
    pub fn cleanup_session_keys(ctx: Context<CleanupSessionKeys>) -> Result<()> {
        cleanup_session_keys::handler(ctx)
    }

    /// Revoke all session keys at once (emergency function)
    pub fn revoke_all_session_keys(ctx: Context<RevokeAllSessionKeys>) -> Result<()> {
        revoke_all_session_keys::handler(ctx)
    }
}
