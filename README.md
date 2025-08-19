# Time-bound Session Keys

A Solana program that lets you create temporary session keys with custom permissions. Think of them like temporary API keys - you can give limited access to your wallet for specific time periods and specific actions.

## What it does

Session keys are temporary keypairs that can act on behalf of your main wallet, but with restrictions you define:

- Set expiration times using either block height or clock time (keys auto-expire after X seconds/hours/days)
- Control what they can do (transfers, delegate, custom actions)
- Set transfer limits
- Revoke them instantly if needed

Useful for things like mobile apps, trading bots, team wallets, or any situation where you want to delegate limited authority without exposing your main wallet.

## Why Anchor?

I went with Anchor for this project because speed matters. Could've gone with Pinocchio for smaller binary size and better CU optimization, but that's premature optimization. My approach: ship something that works first, then optimize once you've got a solid baseline to measure against. Anchor gets you from idea to working prototype fast, which is exactly what you need when you're balancing product impact with shipping velocity.

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

## Quick Example

```typescript
import { SessionKeySDK, PermissionPreset } from "./app/sdk";

// Setup
const sdk = await SessionKeySDK.init(connection, programId, wallet);
await sdk.initializeUserAccount(authority);

// Option 1: Time-based expiration (in seconds)
const timeKey = Keypair.generate();
await sdk.createSessionKeyWithPreset(
  authority,
  timeKey.publicKey,
  3600, // expires in 1 hour
  PermissionPreset.TRANSFER_ONLY
);

// Option 2: Block height-based expiration
const blockKey = Keypair.generate();
await sdk.createSessionKeyWithBlockHeight(
  authority,
  blockKey.publicKey,
  900, // expires after ~900 blocks (~6-7 minutes on mainnet)
  {
    canTransfer: true,
    canDelegate: false,
    canExecuteCustom: false,
    maxTransferAmount: new BN(1000000000), // 1 SOL max
    customFlags: 0,
  }
);

// Use either key to transfer
await sdk.executeWithSessionKey(authority, timeKey, {
  transfer: {
    recipient: someWallet,
    amount: new BN(100000000), // 0.1 SOL
  },
});

// Revoke when done (or let it expire)
await sdk.revokeSessionKey(authority, timeKey.publicKey);
```

## Running Examples

Check out `app/examples.ts` for complete working examples:

```bash
# Run all examples
bun run app/examples.ts

# Examples included:
# - Expiration Types: Time vs block height expiration
# - Permission Examples: Presets and custom permissions
# - Team Wallet: Role-based access control
# - Key Management: Rotation and revocation
# - Cleanup Operations: Remove expired keys
# - Real Transfers: Actual SOL transfers with limits
```

## Tests

The test suite covers everything:

```bash
anchor test
```

Tests include:

- Creating and managing session keys
- Permission validation
- Expiration checks
- Transfer limits
- Revocation (single and bulk)
- Edge cases and error conditions

## SDK

The TypeScript SDK (`app/sdk.ts`) wraps the program with convenient methods:

```typescript
// Permission presets make it easy
PermissionPreset.FULL_ACCESS; // Can do anything
PermissionPreset.TRANSFER_ONLY; // Only transfers
PermissionPreset.LIMITED_TRANSFER; // Transfers with limits
PermissionPreset.DELEGATE_ONLY; // Can only create sub-keys
PermissionPreset.READ_ONLY; // Can't do anything

// Or build custom permissions
const customPerms = {
  canTransfer: true,
  canDelegate: false,
  canExecuteCustom: true,
  maxTransferAmount: new BN(1000000000), // 1 SOL max
  customFlags: [false, false, false, false],
};
```

## Program Structure

```
programs/time/src/
├── lib.rs                    # Entry point
├── instructions/             # All the operations
├── state.rs                  # Account structures
├── contexts.rs              # Validation logic
├── errors.rs                # Error codes
└── events.rs                # Emitted events
```

Key accounts:

- `UserAccount`: PDA that stores all session keys for a user
- `SessionKey`: Individual key with permissions and expiry

## Notes

- Each user can have up to 10 session keys
- Keys can't extend their own permissions
- Expired keys need manual cleanup (saves compute)
- Session keys can create sub-keys if given permission

Built with Anchor on Solana.
