use anchor_lang::prelude::*;
use crate::state::SessionPermissions;

// ===== EVENTS =====

#[event]
pub struct SessionKeyCreated {
    pub authority: Pubkey,
    pub session_key: Pubkey,
    pub expires_at: i64,
    pub permissions: SessionPermissions,
}

#[event]
pub struct SessionKeyRevoked {
    pub authority: Pubkey,
    pub session_key: Pubkey,
}

#[event]
pub struct SessionKeyUpdated {
    pub authority: Pubkey,
    pub session_key: Pubkey,
    pub expires_at: i64,
    pub permissions: SessionPermissions,
}

#[event]
pub struct AllSessionKeysRevoked {
    pub authority: Pubkey,
    pub count: u32,
}
