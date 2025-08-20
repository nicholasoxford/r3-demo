use crate::constants::MAX_ALLOWED_MINTS;
use crate::contexts::InitializeUserAccount;
use crate::contexts::InitializeUserAccountWithConfig;
use anchor_lang::prelude::*;
use anchor_lang::system_program;

/// Initialize a user account that can hold session keys
pub fn handler(ctx: Context<InitializeUserAccount>) -> Result<()> {
    let user_account = &mut ctx.accounts.user_account;
    user_account.authority = ctx.accounts.authority.key();
    user_account.session_keys = Vec::new();
    user_account.bump = ctx.bumps.user_account;
    user_account.allowed_mints = Vec::new();

    msg!(
        "User account initialized for authority: {}",
        user_account.authority
    );
    Ok(())
}

/// Initialize with allowed mints and an initial lamport deposit into the PDA
pub fn handler_with_config(
    ctx: Context<InitializeUserAccountWithConfig>,
    allowed_mints: Vec<Pubkey>,
    initial_deposit_lamports: u64,
) -> Result<()> {
    require!(
        allowed_mints.len() <= MAX_ALLOWED_MINTS,
        crate::errors::ErrorCode::TooManyAllowedMints
    );

    let user_account = &mut ctx.accounts.user_account;
    user_account.authority = ctx.accounts.authority.key();
    user_account.session_keys = Vec::new();
    user_account.bump = ctx.bumps.user_account;
    user_account.allowed_mints = allowed_mints;

    if initial_deposit_lamports > 0 {
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.authority.to_account_info(),
                    to: ctx.accounts.user_account.to_account_info(),
                },
            ),
            initial_deposit_lamports,
        )?;
    }

    Ok(())
}
