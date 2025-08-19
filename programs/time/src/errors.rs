use anchor_lang::prelude::*;

// ===== ERRORS =====

#[error_code]
pub enum ErrorCode {
    #[msg("Session key expiry must be in the future")]
    InvalidExpiry,

    #[msg("Maximum number of session keys reached")]
    TooManySessionKeys,

    #[msg("Session key already exists")]
    SessionKeyAlreadyExists,

    #[msg("Session key not found")]
    SessionKeyNotFound,

    #[msg("Session key has been revoked")]
    SessionKeyRevoked,

    #[msg("Session key has already been revoked")]
    SessionKeyAlreadyRevoked,

    #[msg("Session key has expired")]
    SessionKeyExpired,

    #[msg("Insufficient permissions for this action")]
    InsufficientPermissions,
}
