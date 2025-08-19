# Time-bound Session Keys

A Solana program that lets you create temporary session keys with custom permissions. Think of them like temporary API keys - you can give limited access to your wallet for specific time periods and specific actions.

## What it does

Session keys are temporary keypairs that can act on behalf of your main wallet, but with restrictions you define:

- Set expiration times (keys auto-expire after X seconds/hours/days)
- Control what they can do (transfers, delegate, custom actions)
- Set transfer limits
- Revoke them instantly if needed

Useful for things like mobile apps, trading bots, team wallets, or any situation where you want to delegate limited authority without exposing your main wallet.

## Setup

```bash
# Install deps
yarn install

# Build
anchor build

# Test
anchor test
```

## Quick Example

```typescript
import { SessionKeySDK, PermissionPreset } from "./app/sdk";

// Setup
const sdk = await SessionKeySDK.init(connection, programId, wallet);
await sdk.initializeUserAccount(authority);

// Create a session key that can only transfer funds for 1 hour
const sessionKey = Keypair.generate();
await sdk.createSessionKeyWithPreset(
  authority,
  sessionKey.publicKey,
  3600, // expires in 1 hour
  PermissionPreset.TRANSFER_ONLY
);

// Use it to transfer
await sdk.executeWithSessionKey(authority, sessionKey, {
  transfer: {
    recipient: someWallet,
    amount: new BN(100000000), // 0.1 SOL
  },
});

// Revoke when done (or let it expire)
await sdk.revokeSessionKey(authority, sessionKey.publicKey);
```

## Running Examples

Check out `app/examples.ts` for complete working examples:

```bash
# Run all examples
yarn tsx app/examples.ts

# The examples show:
# - Basic session key creation
# - Different permission presets
# - Transfer operations
# - Creating sub-keys
# - Revoking keys
# - Cleanup operations
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
