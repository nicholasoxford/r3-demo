use crate::contexts::SplApproveDelegate;
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Approve};

/// Approve a PDA delegate for SPL token spending. Owner must sign.
pub fn handler(ctx: Context<SplApproveDelegate>, amount: u64) -> Result<()> {
    // Optional: enforce mint allowlist or custom flags via user_account fields if you add them

    // Derive expected delegate PDA from user_account and mint
    let (expected_delegate, _bump) = Pubkey::find_program_address(
        &[
            b"delegate",
            ctx.accounts.user_account.key().as_ref(),
            ctx.accounts.mint.key().as_ref(),
        ],
        ctx.program_id,
    );
    require_keys_eq!(
        expected_delegate,
        ctx.accounts.delegate_authority.key(),
        crate::errors::ErrorCode::InsufficientPermissions
    );

    // Validate token account owner and mint
    require_keys_eq!(
        ctx.accounts.token_account.owner,
        ctx.accounts.authority.key(),
        crate::errors::ErrorCode::InsufficientPermissions
    );
    require_keys_eq!(
        ctx.accounts.token_account.mint,
        ctx.accounts.mint.key(),
        crate::errors::ErrorCode::InsufficientPermissions
    );

    // Enforce allowed mints allowlist if present
    if !ctx.accounts.user_account.allowed_mints.is_empty() {
        require!(
            ctx.accounts
                .user_account
                .allowed_mints
                .iter()
                .any(|m| m == &ctx.accounts.mint.key()),
            crate::errors::ErrorCode::MintNotAllowed
        );
    }

    token_interface::approve(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Approve {
                to: ctx.accounts.token_account.to_account_info(),
                delegate: ctx.accounts.delegate_authority.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
        ),
        amount,
    )
}
