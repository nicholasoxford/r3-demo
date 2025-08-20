/// Maximum number of session keys per user account
pub const MAX_SESSION_KEYS: usize = 10;

/// Size of each session key entry in bytes
/// 32 (pubkey) + 8 (created_at) + 8 (expires_at) + 1 (expiration_type) + 32 (permissions) + 1 (is_revoked) + 32 (label)
pub const SESSION_KEY_SIZE: usize = 32 + 8 + 8 + 1 + 32 + 1 + 32;

/// Maximum number of allowed SPL token mints
pub const MAX_ALLOWED_MINTS: usize = 8;
