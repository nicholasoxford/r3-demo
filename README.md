# Time-bound Session Keys for Solana

A powerful Solana program implementing time-bound session keys that showcase the native account abstraction capabilities of the Solana Virtual Machine (SVM). This program enables users to create temporary, permission-scoped keys that can act on their behalf for a defined period.

## 🌟 Features

### Core Functionality

- **Time-bound Authority**: Session keys automatically expire after a specified duration
- **Granular Permissions**: Fine-grained control over what actions session keys can perform
- **Full CRUD Operations**: Create, read, update, and delete session keys
- **Emergency Controls**: Instant revocation of individual or all session keys
- **Automatic Cleanup**: Remove expired and revoked keys to optimize storage

### Permission System

- **Transfer Rights**: Allow/restrict token and SOL transfers
- **Delegation Rights**: Control whether session keys can create sub-keys
- **Custom Execution**: Enable interaction with other programs
- **Transfer Limits**: Set maximum transfer amounts per operation
- **Custom Flags**: Extensible permission system for future use cases

## 🚀 Use Cases

1. **Mobile Wallets**: Create limited-permission keys for mobile devices
2. **DApp Integration**: Temporary access for web3 applications
3. **Team Management**: Distributed treasury control with role-based permissions
4. **Automated Trading**: Time-limited keys for trading bots
5. **Recurring Payments**: Scheduled transaction permissions
6. **Gaming**: Session-based in-game transaction authority

## 📦 Installation

```bash
# Clone the repository
git clone <repository-url>
cd time

# Install dependencies
yarn install

# Build the program
anchor build

# Run tests
anchor test
```

## 🏗️ Architecture

### Program Structure

```
programs/time/src/lib.rs
├── Instructions
│   ├── initialize_user_account    # Setup user's session key account
│   ├── create_session_key        # Create new session key
│   ├── update_session_key        # Modify existing key
│   ├── revoke_session_key        # Revoke specific key
│   ├── revoke_all_session_keys   # Emergency revoke all
│   ├── execute_with_session_key  # Use session key for actions
│   └── cleanup_session_keys      # Remove expired/revoked keys
│
├── State
│   ├── UserAccount               # PDA storing session keys
│   └── SessionKey                # Individual key data structure
│
└── Types
    ├── SessionPermissions        # Permission configuration
    ├── SessionAction             # Executable actions
    └── ErrorCode                 # Custom error types
```

### Data Structures

#### UserAccount

```rust
pub struct UserAccount {
    pub authority: Pubkey,           // Main wallet owner
    pub session_keys: Vec<SessionKey>, // List of session keys
    pub bump: u8,                    // PDA bump seed
}
```

#### SessionKey

```rust
pub struct SessionKey {
    pub pubkey: Pubkey,              // Session key public key
    pub created_at: i64,             // Creation timestamp
    pub expires_at: i64,             // Expiration timestamp
    pub permissions: SessionPermissions, // Granted permissions
    pub is_revoked: bool,            // Revocation status
    pub label: [u8; 32],            // Optional identifier
}
```

## 💻 SDK Usage

### TypeScript SDK

The SDK provides high-level functions for interacting with the session keys program:

```typescript
import { SessionKeySDK, PermissionPreset } from "./app/sdk";

// Initialize SDK
const sdk = await SessionKeySDK.init(connection, programId, wallet);

// Initialize user account
await sdk.initializeUserAccount(authority);

// Create a session key with preset permissions
const sessionKey = Keypair.generate();
await sdk.createSessionKeyWithPreset(
  authority,
  sessionKey.publicKey,
  3600, // 1 hour duration
  PermissionPreset.TRANSFER_ONLY
);

// Execute action with session key
await sdk.executeWithSessionKey(authority, sessionKey, {
  transfer: {
    recipient: recipientPubkey,
    amount: new BN(100000000), // 0.1 SOL
  },
});
```

### Permission Presets

The SDK includes convenient permission presets:

- **FULL_ACCESS**: All permissions enabled
- **TRANSFER_ONLY**: Can only transfer funds
- **LIMITED_TRANSFER**: Transfer with amount limits
- **DELEGATE_ONLY**: Can only create sub-keys
- **CUSTOM_ONLY**: Can only execute custom instructions
- **READ_ONLY**: No permissions (view-only)

## 🔧 Instruction Reference

### Initialize User Account

Creates a PDA to store session keys for a user.

```typescript
await program.methods
  .initializeUserAccount()
  .accounts({
    userAccount: userAccountPDA,
    authority: authorityPubkey,
    systemProgram: SystemProgram.programId,
  })
  .rpc();
```

### Create Session Key

Adds a new session key with specified permissions and expiry.

```typescript
await program.methods
  .createSessionKey(sessionPubkey, expiresAt, permissions)
  .accounts({
    userAccount: userAccountPDA,
    authority: authorityPubkey,
    systemProgram: SystemProgram.programId,
  })
  .rpc();
```

### Update Session Key

Modifies expiry or permissions of an existing session key.

```typescript
await program.methods
  .updateSessionKey(sessionPubkey, newExpiresAt, newPermissions)
  .accounts({
    userAccount: userAccountPDA,
    authority: authorityPubkey,
  })
  .rpc();
```

### Revoke Session Key

Immediately revokes a specific session key.

```typescript
await program.methods
  .revokeSessionKey(sessionPubkey)
  .accounts({
    userAccount: userAccountPDA,
    authority: authorityPubkey,
  })
  .rpc();
```

### Execute with Session Key

Uses a session key to perform authorized actions.

```typescript
await program.methods
  .executeWithSessionKey(action)
  .accounts({
    userAccount: userAccountPDA,
    sessionSigner: sessionPubkey,
  })
  .signers([sessionKeypair])
  .rpc();
```

## 🔐 Security Considerations

1. **Key Storage**: Session keys should be stored securely on the client side
2. **Permission Scope**: Always use minimum necessary permissions
3. **Expiry Times**: Set appropriate expiration times based on use case
4. **Regular Cleanup**: Periodically clean up expired keys to optimize storage
5. **Monitoring**: Implement monitoring for suspicious session key activity
6. **Rotation**: Regularly rotate session keys for enhanced security

## 🧪 Testing

The test suite covers all major functionality:

```bash
# Run all tests
anchor test

# Test categories:
# - User Account Initialization
# - Session Key Creation
# - Session Key Updates
# - Session Key Execution
# - Session Key Revocation
# - Cleanup Operations
```

## 📊 Events

The program emits events for key operations:

- `SessionKeyCreated`: New session key created
- `SessionKeyUpdated`: Session key modified
- `SessionKeyRevoked`: Specific key revoked
- `AllSessionKeysRevoked`: All keys revoked
- `SessionActionExecuted`: Action performed with session key

## 🚧 Limitations

- Maximum 10 session keys per user account (configurable)
- Session keys cannot extend their own permissions
- Expired keys must be manually cleaned up to free space

## 🔮 Future Enhancements

- [ ] Multi-signature session keys
- [ ] Hierarchical permission inheritance
- [ ] Rate limiting per session key
- [ ] Automatic cleanup via crank
- [ ] Session key recovery mechanisms
- [ ] Cross-program invocation templates

## 🤝 Contributing

Contributions are welcome! Please ensure:

1. All tests pass
2. Code follows Rust best practices
3. Documentation is updated
4. Changes include appropriate tests

## 📄 License

[MIT License](LICENSE)

## 🙏 Acknowledgments

This implementation showcases the power of Solana's account abstraction model and the flexibility of the Anchor framework for building sophisticated on-chain permission systems.

---

Built with ❤️ for the Solana ecosystem
