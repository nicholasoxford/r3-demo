use crate::constants::{MAX_ALLOWED_MINTS, SESSION_KEY_SIZE};
use anchor_lang::prelude::*;

// ===== ACCOUNT STRUCTURES =====

#[account]
pub struct UserAccount {
    /// The main authority that owns this account
    pub authority: Pubkey,
    /// List of active and revoked session keys
    pub session_keys: Vec<SessionKey>,
    /// Bump seed for PDA
    pub bump: u8,
    /// Optional allowlist of SPL Token mints permitted for delegated transfers. Empty = allow any
    pub allowed_mints: Vec<Pubkey>,
}

impl UserAccount {
    pub const SEED_PREFIX: &'static [u8] = b"user_account";

    pub fn space(max_keys: usize) -> usize {
        8 + // discriminator
        32 + // authority
        4 + (max_keys * SESSION_KEY_SIZE) + // session_keys vec
        1 + // bump
        4 + (MAX_ALLOWED_MINTS * 32) // allowed_mints vec capacity
    }
}

// ===== DATA STRUCTURES =====

/// Expiration type for session keys - either time-based or block-height-based
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq)]
pub enum ExpirationType {
    /// Expires at a specific Unix timestamp
    Time,
    /// Expires at a specific block height (slot number)
    BlockHeight,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug)]
pub struct SessionKey {
    /// Public key of the session key
    pub pubkey: Pubkey,
    /// Unix timestamp when the key was created
    pub created_at: i64,
    /// Expiration value (either timestamp or block height based on expiration_type)
    pub expires_at: i64,
    /// Type of expiration (Time or BlockHeight)
    pub expiration_type: ExpirationType,
    /// Permissions granted to this session key
    pub permissions: SessionPermissions,
    /// Whether the key has been revoked
    pub is_revoked: bool,
    /// Optional label for identifying the key
    pub label: [u8; 32],
}

impl SessionKey {
    /// Check if the session key is expired based on its expiration type
    pub fn is_expired(&self, clock: &Clock) -> bool {
        match self.expiration_type {
            ExpirationType::Time => self.expires_at <= clock.unix_timestamp,
            ExpirationType::BlockHeight => self.expires_at <= clock.slot as i64,
        }
    }

    /// Check if the session key is valid (not revoked and not expired)
    pub fn is_valid(&self, clock: &Clock) -> bool {
        !self.is_revoked && !self.is_expired(clock)
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug)]
pub struct SessionPermissions {
    /// Can transfer tokens/SOL
    pub can_transfer: bool,
    /// Can delegate to other session keys
    pub can_delegate: bool,
    /// Can execute custom program instructions
    pub can_execute_custom: bool,
    /// Maximum amount that can be transferred (0 = unlimited)
    pub max_transfer_amount: u64,
    /// Custom permission flags for extensibility
    pub custom_flags: u32,
}

impl Default for SessionPermissions {
    fn default() -> Self {
        Self {
            can_transfer: false,
            can_delegate: false,
            can_execute_custom: false,
            max_transfer_amount: 0,
            custom_flags: 0,
        }
    }
}

// Removed unused SessionAction enum
