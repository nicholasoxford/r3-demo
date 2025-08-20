use crate::contexts::SplDelegatedTransfer;
use crate::errors::ErrorCode;
use crate::state::ExpirationType;
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, TransferChecked};

/// Perform SPL token transfer using PDA delegate, gated by session key time/permissions
pub fn handler(ctx: Context<SplDelegatedTransfer>, amount: u64) -> Result<()> {
    let user_account = &ctx.accounts.user_account;
    let session_signer = &ctx.accounts.session_signer;
    let clock = Clock::get()?;

    // Find the session key
    let session_key = user_account
        .session_keys
        .iter()
        .find(|k| k.pubkey == session_signer.key())
        .ok_or(ErrorCode::SessionKeyNotFound)?;

    // Validate
    require!(!session_key.is_revoked, ErrorCode::SessionKeyRevoked);
    match session_key.expiration_type {
        ExpirationType::Time => require!(
            session_key.expires_at > clock.unix_timestamp,
            ErrorCode::SessionKeyExpired
        ),
        ExpirationType::BlockHeight => require!(
            session_key.expires_at > clock.slot as i64,
            ErrorCode::SessionKeyExpired
        ),
    }
    require!(
        session_key.permissions.can_transfer,
        ErrorCode::InsufficientPermissions
    );
    if session_key.permissions.max_transfer_amount > 0 {
        require!(
            amount <= session_key.permissions.max_transfer_amount,
            ErrorCode::InsufficientPermissions
        );
    }

    // Check delegate PDA matches expected for (user_account, mint)
    let (expected_delegate, bump) = Pubkey::find_program_address(
        &[
            b"delegate",
            user_account.key().as_ref(),
            ctx.accounts.mint.key().as_ref(),
        ],
        ctx.program_id,
    );
    require_keys_eq!(
        expected_delegate,
        ctx.accounts.delegate_authority.key(),
        ErrorCode::InsufficientPermissions
    );

    // Enforce allowed mints allowlist if present
    if !user_account.allowed_mints.is_empty() {
        require!(
            user_account
                .allowed_mints
                .iter()
                .any(|m| m == &ctx.accounts.mint.key()),
            ErrorCode::MintNotAllowed
        );
    }

    // CPI to token transfer with delegate PDA as authority
    // Bind to locals so the referenced bytes live long enough for signer seeds
    let user_key = user_account.key();
    let mint_key = ctx.accounts.mint.key();
    let seeds: &[&[u8]] = &[b"delegate", user_key.as_ref(), mint_key.as_ref(), &[bump]];
    // Use transfer_checked for compatibility across Token and Token-2022
    let decimals = ctx.accounts.mint.decimals;
    token_interface::transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.from_token.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.to_token.to_account_info(),
                authority: ctx.accounts.delegate_authority.to_account_info(),
            },
            &[seeds],
        ),
        amount,
        decimals,
    )
}
