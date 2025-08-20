# Time-bound Session Keys

A Solana program that lets you create temporary session keys with custom permissions. Think of them like temporary API keys — you can delegate limited authority from your main wallet for specific time periods and specific actions.

## What it does

Session keys are temporary keypairs that can act on behalf of your main wallet, but with restrictions you define:

- Set expiration using either clock time or block height
- Control allowed actions (transfer, delegate, custom)
- Enforce transfer limits per key
- Revoke instantly, or clean up expired keys

Great for mobile wallets, trading bots, team wallets, or any setup where you want scoped, time-bound authority.

## Why Anchor?

Anchor gets a secure prototype shipped fast. We optimize later once there’s a baseline to measure.

## Setup

```bash
# Install deps
yarn install

# Build
anchor build

# Test locally
# Terminal 1: Start local validator
solana-test-validator --reset

# Terminal 2: Run tests (builds, deploys, and tests)
anchor test --skip-local-validator
```

## Quick examples

```typescript
import { BN } from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { SessionKeySDK, PermissionPreset } from "./app/sdk";

// Initialize SDK and user account (authority is the wallet controlling the user account PDA)
const sdk = await SessionKeySDK.init(
  connection,
  new PublicKey(PROGRAM_ID),
  wallet
);
await sdk.initializeUserAccount(authority.publicKey);

// Time-based session key (expires in 1 hour)
const timeKey = Keypair.generate();
await sdk.createSessionKeyWithPreset(
  authority,
  timeKey.publicKey,
  3600,
  PermissionPreset.TRANSFER_ONLY
);

// Block-height session key (expires after ~900 slots)
const blockKey = Keypair.generate();
await sdk.createSessionKeyWithBlockHeight(
  authority.publicKey,
  blockKey.publicKey,
  900,
  {
    canTransfer: true,
    canDelegate: false,
    canExecuteCustom: false,
    maxTransferAmount: new BN(1_000_000_000), // 1 token (depends on decimals)
    customFlags: 0,
  }
);

// SPL delegation flow
// 1) Owner approves a PDA delegate for a specific mint
await sdk.splApproveDelegate(
  authority.publicKey,
  ownerTokenAccount,
  mint,
  new BN(600_000_000)
);

// 2) Create a session key with transfer permissions and a limit
const sessionKey = Keypair.generate();
await sdk.createSessionKey(authority, sessionKey.publicKey, 300, {
  canTransfer: true,
  canDelegate: false,
  canExecuteCustom: false,
  maxTransferAmount: new BN(500_000_000),
  customFlags: 0,
});

// 3) Perform delegated transfer using only the session key signer
await sdk.splDelegatedTransfer(
  authority.publicKey,
  sessionKey,
  ownerTokenAccount,
  recipientTokenAccount,
  mint,
  new BN(400_000_000)
);

// Revoke when done (or let it expire)
await sdk.revokeSessionKey(authority.publicKey, sessionKey.publicKey);
```

## Running examples

See `app/examples.ts` for full, runnable demos (expiration types, permissions, team wallet, key rotation, cleanup, SPL delegation):

```bash
# Using Bun (recommended for running TS directly)
bun run app/examples.ts

# Or with your TS runner of choice (ensure it supports TS imports)
# ts-node app/examples.ts
```

## Tests

```bash
anchor test
```

What’s covered:

- Session key lifecycle (create/update/revoke/cleanup)
- Time vs block-height expiration
- Transfer limits and permission gating
- PDA isolation and allowed mints allowlist
- SPL delegate approve/transfer/revoke

## SDK highlights (`app/sdk.ts`)

Permissions shape:

```typescript
type SessionPermissions = {
  canTransfer: boolean;
  canDelegate: boolean;
  canExecuteCustom: boolean;
  maxTransferAmount: BN; // 0 = unlimited
  customFlags: number; // u32 bitfield
};
```

Presets available via `PermissionPreset` (FULL_ACCESS, TRANSFER_ONLY, LIMITED_TRANSFER, DELEGATE_ONLY, CUSTOM_ONLY, READ_ONLY).

## On-chain instructions (`programs/time/src/instructions/`)

- initialize_user_account
- initialize_user_account_with_config (sets `allowed_mints`, optional initial PDA lamports)
- create_session_key (supports Time or BlockHeight expiration)
- update_session_key
- revoke_session_key
- revoke_all_session_keys
- cleanup_session_keys
- update_allowed_mints (SPL mint allowlist)
- spl_approve_delegate (owner approves PDA delegate for a mint)
- spl_delegated_transfer (session key gated; PDA signs transfer_checked)
- spl_revoke_delegate

PDAs:

- `UserAccount`: seeds `["user_account", authority]`
- `Delegate` PDA per mint: seeds `["delegate", user_account_pda, mint]`

## Notes

- Up to 10 session keys per user (`MAX_SESSION_KEYS`)
- Allowed mints allowlist is enforced for SPL flows; empty list means any mint is allowed
- Cleanup of expired/revoked keys is manual (saves compute until you call it)
- `spl_delegated_transfer` uses `transfer_checked` and works with Token and Token-2022

Built with Anchor on Solana.
