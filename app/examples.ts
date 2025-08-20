import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import {
  SessionKeySDK,
  createSessionKeySDK,
  generateSessionKey,
  PermissionPreset,
  SessionPermissions,
} from "./sdk";
import { BN } from "@coral-xyz/anchor";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";

// Shared configuration
const PROGRAM_ID = "DdtvbkajRMQj26vuAUaV96hDtzE1mzvB7k64VeWzoWib";
const RPC_URL = "http://localhost:8899";

// Helper to initialize SDK and user account
async function setupExample(name: string) {
  console.log(`\n=== ${name} ===\n`);

  const connection = new Connection(RPC_URL, "confirmed");
  const authority = Keypair.generate();
  const wallet = new anchor.Wallet(authority);
  const programId = new PublicKey(PROGRAM_ID);

  // Airdrop SOL
  const airdropSig = await connection.requestAirdrop(
    authority.publicKey,
    2 * LAMPORTS_PER_SOL
  );
  await connection.confirmTransaction(airdropSig, "confirmed");

  const sdk = await createSessionKeySDK(connection, programId, wallet);
  await sdk.initializeUserAccount(authority.publicKey);

  return { sdk, authority, connection };
}

// Example 1: Time vs Block Height Expiration
async function expirationTypes() {
  const { sdk, authority } = await setupExample("Expiration Types");

  // Time-based expiration (traditional)
  const timeKey = generateSessionKey();
  await sdk.createSessionKeyWithPreset(
    authority.publicKey,
    timeKey.publicKey,
    3600, // 1 hour
    PermissionPreset.TRANSFER_ONLY
  );
  console.log("✅ Time-based key: expires in 1 hour");

  // Block height-based expiration (blockchain-native)
  const blockKey = generateSessionKey();
  await sdk.createSessionKeyWithBlockHeight(
    authority.publicKey,
    blockKey.publicKey,
    900, // ~6-7 minutes
    {
      canTransfer: true,
      canDelegate: false,
      canExecuteCustom: false,
      maxTransferAmount: new BN(1000000000), // 1 SOL
      customFlags: 0,
    }
  );
  console.log("✅ Block-based key: expires after 900 blocks");

  // Verify both are valid
  const timeValid = await sdk.isSessionKeyValid(
    authority.publicKey,
    timeKey.publicKey
  );
  const blockValid = await sdk.isSessionKeyValid(
    authority.publicKey,
    blockKey.publicKey
  );
  console.log(`✅ Both keys valid: time=${timeValid}, block=${blockValid}`);
}

// Example 2: Permission Presets & Custom Permissions
async function permissionExamples() {
  const { sdk, authority } = await setupExample("Permission Examples");

  // Use preset for mobile wallet
  const mobileKey = generateSessionKey();
  await sdk.createSessionKey(
    authority.publicKey,
    mobileKey.publicKey,
    86400, // 24 hours
    {
      canTransfer: true,
      canDelegate: false,
      canExecuteCustom: false,
      maxTransferAmount: new BN(0.01 * LAMPORTS_PER_SOL), // 0.01 SOL limit
      customFlags: 0,
    }
  );
  console.log("✅ Mobile key: limited to 0.01 SOL transfers");

  // Trading bot with custom permissions
  const botKey = generateSessionKey();
  await sdk.createSessionKey(
    authority.publicKey,
    botKey.publicKey,
    3600, // 1 hour
    {
      canTransfer: true,
      canDelegate: false,
      canExecuteCustom: true, // Can interact with DEXs
      maxTransferAmount: new BN(5 * LAMPORTS_PER_SOL),
      customFlags: 1, // Custom flag for "trading only"
    }
  );
  console.log("✅ Bot key: can trade up to 5 SOL with DEX access");

  // Read-only observer key
  const observerKey = generateSessionKey();
  await sdk.createSessionKeyWithPreset(
    authority.publicKey,
    observerKey.publicKey,
    604800, // 1 week
    PermissionPreset.READ_ONLY
  );
  console.log("✅ Observer key: read-only access for monitoring");
}

// Example 3: Team Wallet with Role-Based Access
async function teamWallet() {
  const { sdk, authority } = await setupExample("Team Wallet");

  const roles = [
    { name: "CFO", permissions: PermissionPreset.FULL_ACCESS, days: 30 },
    { name: "Accountant", maxTransfer: 10, days: 7 },
    { name: "Intern", permissions: PermissionPreset.READ_ONLY, days: 1 },
  ];

  for (const role of roles) {
    const key = generateSessionKey();

    if (role.permissions) {
      await sdk.createSessionKeyWithPreset(
        authority.publicKey,
        key.publicKey,
        role.days * 86400,
        role.permissions
      );
    } else if (role.maxTransfer) {
      await sdk.createSessionKey(
        authority.publicKey,
        key.publicKey,
        role.days * 86400,
        {
          canTransfer: true,
          canDelegate: false,
          canExecuteCustom: true,
          maxTransferAmount: new BN(role.maxTransfer * LAMPORTS_PER_SOL),
          customFlags: 0,
        }
      );
    }

    console.log(`✅ ${role.name}: ${role.days} day access`);
  }
}

// Example 4: Key Rotation & Revocation
async function keyManagement() {
  const { sdk, authority } = await setupExample("Key Management");

  // Create and rotate keys
  const oldKey = generateSessionKey();
  await sdk.createSessionKeyWithPreset(
    authority.publicKey,
    oldKey.publicKey,
    3600,
    PermissionPreset.FULL_ACCESS
  );
  console.log("✅ Initial key created");

  const newKey = generateSessionKey();
  await sdk.createSessionKeyWithPreset(
    authority.publicKey,
    newKey.publicKey,
    3600,
    PermissionPreset.FULL_ACCESS
  );
  await sdk.revokeSessionKey(authority.publicKey, oldKey.publicKey);
  console.log("✅ Rotated: old key revoked, new key active");

  // Emergency revoke all
  const keys = [generateSessionKey(), generateSessionKey()];
  for (const key of keys) {
    await sdk.createSessionKeyWithPreset(
      authority.publicKey,
      key.publicKey,
      86400,
      PermissionPreset.TRANSFER_ONLY
    );
  }
  console.log("✅ Created 2 more keys");

  await sdk.revokeAllSessionKeys(authority.publicKey);
  const activeKeys = await sdk.getActiveSessionKeys(authority.publicKey);
  console.log(`✅ Emergency revoked all - active keys: ${activeKeys.length}`);
}

// Example 5: Cleanup Expired Keys
async function cleanupExpiredKeys() {
  const { sdk, authority } = await setupExample("Cleanup Operations");

  // Create keys with different expiration times
  const shortLivedKeys = [
    { key: generateSessionKey(), duration: 2 }, // 2 seconds
    { key: generateSessionKey(), duration: 3 }, // 3 seconds
    { key: generateSessionKey(), duration: 3600 }, // 1 hour (won't expire)
  ];

  for (const { key, duration } of shortLivedKeys) {
    await sdk.createSessionKeyWithPreset(
      authority.publicKey,
      key.publicKey,
      duration,
      PermissionPreset.READ_ONLY
    );
  }
  console.log("✅ Created 3 keys with mixed durations");

  // Wait for some to expire
  console.log("⏳ Waiting for keys to expire...");
  await new Promise((resolve) => setTimeout(resolve, 4000));

  // Check and cleanup
  const before = await sdk.getSessionKeys(authority.publicKey);
  console.log(
    `Before: ${before.length} total (${
      before.filter((k) => k.isExpired).length
    } expired)`
  );

  await sdk.cleanupSessionKeys(authority.publicKey);

  const after = await sdk.getSessionKeys(authority.publicKey);
  console.log(`After cleanup: ${after.length} keys remain`);
}

// Example 6: Real SOL Transfers with Session Keys
async function realTransfers() {
  const { sdk, authority, connection } = await setupExample("SPL Delegation");

  // Create a new SPL mint (9 decimals) and two token accounts
  const mint = await createMint(
    connection,
    authority,
    authority.publicKey,
    null,
    9
  );

  const authorityAta = await getOrCreateAssociatedTokenAccount(
    connection,
    authority,
    mint,
    authority.publicKey
  );

  const recipient = Keypair.generate();
  const recipientAta = await getOrCreateAssociatedTokenAccount(
    connection,
    authority,
    mint,
    recipient.publicKey
  );

  // Mint tokens to the authority
  await mintTo(
    connection,
    authority,
    mint,
    authorityAta.address,
    authority,
    1_000_000_000n // 1 token with 9 decimals
  );

  // Approve PDA delegate for this mint
  const approveAmount = new BN(600_000_000); // 0.6 tokens
  await sdk.splApproveDelegate(
    authority.publicKey,
    authorityAta.address,
    mint,
    approveAmount
  );

  // Create a session key with transfer permissions and a 0.5 token limit
  const sessionKey = generateSessionKey();
  await sdk.createSessionKey(authority.publicKey, sessionKey.publicKey, 300, {
    canTransfer: true,
    canDelegate: false,
    canExecuteCustom: false,
    maxTransferAmount: new BN(500_000_000), // 0.5 tokens
    customFlags: 0,
  });

  // Optional: fund session key for fees if you plan to send with it as fee payer
  const sig = await connection.requestAirdrop(
    sessionKey.publicKey,
    0.01 * LAMPORTS_PER_SOL
  );
  const txSig = await connection.confirmTransaction(sig, "confirmed");
  console.log(txSig);
  // Perform delegated transfer using the session key signer
  await sdk.splDelegatedTransfer(
    authority.publicKey,
    sessionKey,
    authorityAta.address,
    recipientAta.address,
    mint,
    new BN(400_000_000) // 0.4 tokens (within 0.5 limit)
  );

  console.log("✅ Delegated SPL transfer of 0.4 tokens succeeded");
}

// Run all examples
export async function runExamples() {
  try {
    // await expirationTypes();
    // await permissionExamples();
    // await teamWallet();
    // await keyManagement();
    // await cleanupExpiredKeys();
    await realTransfers();

    console.log("\n✅ All examples completed successfully!");
  } catch (error) {
    console.error("❌ Error running examples:", error);
  }
}

// Export individual examples for selective running
export {
  expirationTypes,
  permissionExamples,
  teamWallet,
  keyManagement,
  cleanupExpiredKeys,
  realTransfers,
};

// Run examples when called directly
if (require.main === module) {
  runExamples();
}
