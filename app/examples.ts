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

/**
 * Example usage of the Time-bound Session Keys SDK
 *
 * These examples demonstrate various use cases for session keys,
 * showcasing Solana's native account abstraction capabilities.
 */

// Initialize SDK with authority keypair
async function initializeSDK(authorityKeypair?: Keypair) {
  const connection = new Connection("http://localhost:8899", "confirmed");
  // Use the provided authority keypair or generate a new one
  const keypair = authorityKeypair || Keypair.generate();
  const wallet = new anchor.Wallet(keypair);
  const programId = new PublicKey(
    "DdtvbkajRMQj26vuAUaV96hDtzE1mzvB7k64VeWzoWib"
  );
  console.log("Program ID:", programId.toBase58());

  // Airdrop SOL to the authority account for transaction fees
  console.log("Requesting airdrop for authority account...");
  const airdropSignature = await connection.requestAirdrop(
    keypair.publicKey,
    2 * LAMPORTS_PER_SOL // 2 SOL should be enough for testing
  );
  await connection.confirmTransaction(airdropSignature, "confirmed");
  console.log("✅ Airdrop confirmed");

  const sdk = await createSessionKeySDK(connection, programId, wallet);
  return { sdk, authority: keypair };
}

// Example 1: Basic Session Key Setup (Time & Block Height)
async function basicSessionKeySetup() {
  console.log("=== Basic Session Key Setup (Time & Block Height) ===");

  const { sdk, authority } = await initializeSDK();
  console.log("Authority:", authority.publicKey.toBase58());
  // Initialize user account
  await sdk.initializeUserAccount(authority.publicKey);
  console.log("✅ User account initialized");

  // Example 1A: Time-based expiration (traditional approach)
  console.log("\n📅 Creating TIME-BASED session key:");
  const timeBasedKey = generateSessionKey();
  console.log("🔑 Generated session key:", timeBasedKey.publicKey.toBase58());

  // Create session key with 1 hour expiry and transfer-only permissions
  await sdk.createSessionKeyWithPreset(
    authority.publicKey,
    timeBasedKey.publicKey,
    3600, // 1 hour in seconds
    PermissionPreset.TRANSFER_ONLY
  );
  console.log("✅ Time-based session key created (expires in 1 hour)");

  // Example 1B: Block height-based expiration (blockchain-native)
  console.log("\n⛓️  Creating BLOCK HEIGHT session key:");
  const blockBasedKey = generateSessionKey();
  console.log("🔑 Generated session key:", blockBasedKey.publicKey.toBase58());

  // Create session key that expires after 900 blocks (~6-7 minutes)
  await sdk.createSessionKeyWithBlockHeight(
    authority.publicKey,
    blockBasedKey.publicKey,
    900, // blocks
    {
      canTransfer: true,
      canDelegate: false,
      canExecuteCustom: false,
      maxTransferAmount: new BN(1000000000), // 1 SOL
      customFlags: 0,
    }
  );
  console.log("✅ Block-based session key created (expires after 900 blocks)");

  // Check if both session keys are valid
  const timeKeyValid = await sdk.isSessionKeyValid(
    authority.publicKey,
    timeBasedKey.publicKey
  );
  const blockKeyValid = await sdk.isSessionKeyValid(
    authority.publicKey,
    blockBasedKey.publicKey
  );
  console.log("\n🔍 Time-based key valid:", timeKeyValid);
  console.log("🔍 Block-based key valid:", blockKeyValid);
}

// Example 2: Mobile Wallet Integration
async function mobileWalletIntegration() {
  console.log("=== Mobile Wallet Integration ===");

  const { sdk, authority: mainWallet } = await initializeSDK();
  await sdk.initializeUserAccount(mainWallet.publicKey);

  // Create session key for mobile device
  const mobileSessionKey = generateSessionKey();

  // Limited permissions for mobile: small transfers only
  const mobilePermissions: SessionPermissions = {
    canTransfer: true,
    canDelegate: false,
    canExecuteCustom: false,
    maxTransferAmount: new anchor.BN(0.01 * LAMPORTS_PER_SOL), // Max 0.01 SOL per tx
    customFlags: 0,
  };

  await sdk.createSessionKey(
    mainWallet.publicKey,
    mobileSessionKey.publicKey,
    86400, // 24 hours
    mobilePermissions
  );

  console.log(
    "📱 Mobile session key created with limited transfer permissions"
  );
  console.log("  - Max transfer: 0.01 SOL");
  console.log("  - Valid for: 24 hours");
}

// Example 4: Team Wallet Management
async function teamWalletManagement() {
  console.log("=== Team Wallet Management ===");

  const { sdk, authority: treasuryWallet } = await initializeSDK();
  await sdk.initializeUserAccount(treasuryWallet.publicKey);

  // Create session keys for team members
  const teamMembers = [
    { name: "Alice", role: "CFO", sessionKey: generateSessionKey() },
    { name: "Bob", role: "Accountant", sessionKey: generateSessionKey() },
    { name: "Charlie", role: "Intern", sessionKey: generateSessionKey() },
  ];

  for (const member of teamMembers) {
    let permissions: SessionPermissions;
    let duration: number;

    // Different permissions based on role
    switch (member.role) {
      case "CFO":
        permissions = {
          canTransfer: true,
          canDelegate: true,
          canExecuteCustom: true,
          maxTransferAmount: new anchor.BN(0), // Unlimited
          customFlags: 0,
        };
        duration = 30 * 24 * 3600; // 30 days
        break;

      case "Accountant":
        permissions = {
          canTransfer: true,
          canDelegate: false,
          canExecuteCustom: true,
          maxTransferAmount: new anchor.BN(10 * LAMPORTS_PER_SOL), // Max 10 SOL
          customFlags: 0,
        };
        duration = 7 * 24 * 3600; // 7 days
        break;

      default: // Intern
        permissions = {
          canTransfer: false,
          canDelegate: false,
          canExecuteCustom: false,
          maxTransferAmount: new anchor.BN(0),
          customFlags: 0,
        };
        duration = 24 * 3600; // 1 day
        break;
    }

    await sdk.createSessionKey(
      treasuryWallet.publicKey,
      member.sessionKey.publicKey,
      duration,
      permissions
    );

    console.log(`👤 ${member.name} (${member.role}) session key created`);
  }
}

// Example 5: Automated Trading Bot
async function automatedTradingBot() {
  console.log("=== Automated Trading Bot ===");

  const { sdk, authority: traderWallet } = await initializeSDK();
  await sdk.initializeUserAccount(traderWallet.publicKey);

  // Create session key for trading bot
  const botSessionKey = generateSessionKey();

  // Bot can execute trades but with limits
  const botPermissions: SessionPermissions = {
    canTransfer: true,
    canDelegate: false,
    canExecuteCustom: true, // Can interact with DEX programs
    maxTransferAmount: new anchor.BN(5 * LAMPORTS_PER_SOL), // Max 5 SOL per operation
    customFlags: 1, // Custom flag for "trading only"
  };

  await sdk.createSessionKey(
    traderWallet.publicKey,
    botSessionKey.publicKey,
    3600, // 1 hour sessions
    botPermissions
  );

  console.log("🤖 Trading bot session key created");
  console.log("  - Can execute trades up to 5 SOL");
  console.log("  - Session expires in 1 hour");
  console.log("  - Auto-renewal possible before expiry");
}

// Example 6: Session Key Rotation
async function sessionKeyRotation() {
  console.log("=== Session Key Rotation ===");

  const { sdk, authority: userWallet } = await initializeSDK();
  await sdk.initializeUserAccount(userWallet.publicKey);

  // Create initial session key
  const oldSessionKey = generateSessionKey();
  await sdk.createSessionKeyWithPreset(
    userWallet.publicKey,
    oldSessionKey.publicKey,
    3600,
    PermissionPreset.FULL_ACCESS
  );
  console.log("🔑 Initial session key created");

  // Rotate to new session key
  const newSessionKey = generateSessionKey();

  // Create new key
  await sdk.createSessionKeyWithPreset(
    userWallet.publicKey,
    newSessionKey.publicKey,
    3600,
    PermissionPreset.FULL_ACCESS
  );
  console.log("🔑 New session key created");

  // Revoke old key
  await sdk.revokeSessionKey(userWallet.publicKey, oldSessionKey.publicKey);
  console.log("❌ Old session key revoked");

  console.log("✅ Session key rotation complete");
}

// Example 7: Monitoring and Auto-renewal
async function monitoringAndAutoRenewal() {
  console.log("=== Monitoring and Auto-renewal ===");

  const { sdk, authority: userWallet } = await initializeSDK();
  await sdk.initializeUserAccount(userWallet.publicKey);

  // Create session key
  const sessionKey = generateSessionKey();
  await sdk.createSessionKeyWithPreset(
    userWallet.publicKey,
    sessionKey.publicKey,
    7200, // 2 hours
    PermissionPreset.TRANSFER_ONLY
  );

  // Set up monitoring
  const stopMonitoring = await sdk.monitorSessionKeyExpiry(
    userWallet.publicKey,
    1800, // Warning when 30 minutes left
    async (key) => {
      console.log(`⚠️ Session key expiring soon: ${key.pubkey.toBase58()}`);
      console.log(`  Remaining time: ${key.remainingTimeSeconds} seconds`);

      // Auto-renew by extending expiry
      await sdk.updateSessionKey(
        userWallet.publicKey,
        key.pubkey,
        7200 // Extend by another 2 hours
      );
      console.log("✅ Session key auto-renewed");
    }
  );

  console.log("📊 Monitoring started - will auto-renew when needed");

  // Stop monitoring after some time
  setTimeout(() => {
    stopMonitoring();
    console.log("🛑 Monitoring stopped");
  }, 10 * 60 * 1000); // Stop after 10 minutes
}

// Example 8: Emergency Revocation
async function emergencyRevocation() {
  console.log("=== Emergency Revocation ===");

  const { sdk, authority: userWallet } = await initializeSDK();
  await sdk.initializeUserAccount(userWallet.publicKey);

  // Create multiple session keys
  const sessionKeys = [
    generateSessionKey(),
    generateSessionKey(),
    generateSessionKey(),
  ];

  for (const key of sessionKeys) {
    await sdk.createSessionKeyWithPreset(
      userWallet.publicKey,
      key.publicKey,
      86400,
      PermissionPreset.FULL_ACCESS
    );
  }
  console.log(`✅ Created ${sessionKeys.length} session keys`);

  // Check active keys
  let activeKeys = await sdk.getActiveSessionKeys(userWallet.publicKey);
  console.log(`📊 Active session keys: ${activeKeys.length}`);

  // Emergency: Revoke all keys at once
  await sdk.revokeAllSessionKeys(userWallet.publicKey);
  console.log("🚨 EMERGENCY: All session keys revoked");

  // Verify all revoked
  activeKeys = await sdk.getActiveSessionKeys(userWallet.publicKey);
  console.log(`📊 Active session keys after revocation: ${activeKeys.length}`);
}

// Example 9: Cleanup Expired Keys
async function cleanupExpiredKeys() {
  console.log("=== Cleanup Expired Keys ===");

  const { sdk, authority: userWallet } = await initializeSDK();
  await sdk.initializeUserAccount(userWallet.publicKey);

  // Create some short-lived keys
  const shortLivedKeys = [
    { key: generateSessionKey(), duration: 2 }, // 2 seconds
    { key: generateSessionKey(), duration: 3 }, // 3 seconds
    { key: generateSessionKey(), duration: 3600 }, // 1 hour (won't expire)
  ];

  for (const { key, duration } of shortLivedKeys) {
    await sdk.createSessionKeyWithPreset(
      userWallet.publicKey,
      key.publicKey,
      duration,
      PermissionPreset.READ_ONLY
    );
  }
  console.log("✅ Created mixed duration keys");

  // Wait for some to expire
  console.log("⏳ Waiting for keys to expire...");
  await new Promise((resolve) => setTimeout(resolve, 4000));

  // Check keys before cleanup
  const keysBeforeCleanup = await sdk.getSessionKeys(userWallet.publicKey);
  console.log(`📊 Total keys before cleanup: ${keysBeforeCleanup.length}`);
  console.log(
    `  - Active: ${keysBeforeCleanup.filter((k) => k.isActive).length}`
  );
  console.log(
    `  - Expired: ${keysBeforeCleanup.filter((k) => k.isExpired).length}`
  );

  // Cleanup
  await sdk.cleanupSessionKeys(userWallet.publicKey);
  console.log("🧹 Cleanup executed");

  // Check keys after cleanup
  const keysAfterCleanup = await sdk.getSessionKeys(userWallet.publicKey);
  console.log(`📊 Total keys after cleanup: ${keysAfterCleanup.length}`);
}

// Run examples
export async function runExamples() {
  try {
    await basicSessionKeySetup();
    console.log("\n");

    await mobileWalletIntegration();
    console.log("\n");

    await teamWalletManagement();
    console.log("\n");

    await automatedTradingBot();
    console.log("\n");

    await sessionKeyRotation();
    console.log("\n");

    await emergencyRevocation();
    console.log("\n");

    await cleanupExpiredKeys();
    console.log("\n");

    // Demonstrate both time and block height expiration types
    await demonstrateExpirationTypes();
    console.log("\n");

    // Note: monitoringAndAutoRenewal runs indefinitely, so we skip it in batch run

    console.log("✅ All examples completed successfully!");
  } catch (error) {
    console.error("❌ Error running examples:", error);
  }
}

// Export individual examples for selective running
export {
  basicSessionKeySetup,
  mobileWalletIntegration,
  teamWalletManagement,
  automatedTradingBot,
  sessionKeyRotation,
  monitoringAndAutoRenewal,
  emergencyRevocation,
  cleanupExpiredKeys,
  demonstrateExpirationTypes,
};

/**
 * Example 11: Demonstrate Both Expiration Types (Time and Block Height)
 *
 * This example shows how to create session keys that expire based on:
 * 1. Wall clock time (Unix timestamp)
 * 2. Block height (Solana slot number)
 *
 * Use cases:
 * - Time-based: Traditional time-bound access (e.g., "valid for 24 hours")
 * - Block-based: Precise blockchain-native expiration (e.g., "valid for 1000 blocks")
 */
async function demonstrateExpirationTypes() {
  console.log("\n=== Example 11: Time vs Block Height Expiration ===\n");

  const { sdk, authority } = await initializeSDK();

  // Initialize user account
  await sdk.initializeUserAccount(authority.publicKey);

  // Example 1: Time-based expiration (traditional approach)
  console.log("1. Creating session key with TIME-BASED expiration (1 hour):");
  const timeBasedKey = Keypair.generate();

  await sdk.createSessionKey(
    authority.publicKey,
    timeBasedKey.publicKey,
    3600, // 1 hour in seconds
    {
      canTransfer: true,
      canDelegate: false,
      canExecuteCustom: false,
      maxTransferAmount: new BN(1000000000), // 1 SOL
      customFlags: 0,
    }
  );

  console.log("   ✅ Time-based session key created");
  console.log(
    `   📅 Expires in 1 hour (${new Date(
      Date.now() + 3600000
    ).toLocaleString()})`
  );

  // Example 2: Block height-based expiration (blockchain-native)
  console.log(
    "\n2. Creating session key with BLOCK HEIGHT expiration (1000 blocks):"
  );
  const blockBasedKey = Keypair.generate();

  await sdk.createSessionKeyWithBlockHeight(
    authority.publicKey,
    blockBasedKey.publicKey,
    1000, // Expires after 1000 blocks (~7-8 minutes on mainnet)
    {
      canTransfer: true,
      canDelegate: false,
      canExecuteCustom: true,
      maxTransferAmount: new BN(500000000), // 0.5 SOL
      customFlags: 0,
    }
  );

  console.log("   ✅ Block height-based session key created");
  console.log("   ⛓️  Expires after 1000 blocks (~7-8 minutes on mainnet)");

  // Example 3: Compare use cases
  console.log("\n3. Use Case Comparison:");
  console.log("\n   Time-Based Expiration:");
  console.log('   - ✅ Intuitive for users ("expires at 3pm")');
  console.log("   - ✅ Good for scheduled access windows");
  console.log("   - ⚠️  Can be affected by clock drift");
  console.log("   - 📱 Best for: User sessions, API keys, temporary access");

  console.log("\n   Block Height-Based Expiration:");
  console.log("   - ✅ Deterministic and verifiable on-chain");
  console.log("   - ✅ Immune to clock manipulation");
  console.log("   - ✅ Precise control over transaction windows");
  console.log("   - ⚠️  Less intuitive for end users");
  console.log(
    "   - 🤖 Best for: Smart contracts, DeFi protocols, automated systems"
  );

  // Example 4: Hybrid approach for maximum flexibility
  console.log("\n4. Hybrid Approach Example:");
  console.log("   You could create two keys for critical operations:");

  const hybridTimeKey = Keypair.generate();
  const hybridBlockKey = Keypair.generate();

  // Short time window (5 minutes)
  await sdk.createSessionKey(
    authority.publicKey,
    hybridTimeKey.publicKey,
    300, // 5 minutes
    {
      canTransfer: true,
      canDelegate: false,
      canExecuteCustom: false,
      maxTransferAmount: new BN(100000000), // 0.1 SOL
      customFlags: 1, // Flag for "time-critical"
    }
  );

  // Equivalent block window (~5 minutes = ~750 blocks)
  await sdk.createSessionKeyWithBlockHeight(
    authority.publicKey,
    hybridBlockKey.publicKey,
    750, // ~5 minutes worth of blocks
    {
      canTransfer: true,
      canDelegate: false,
      canExecuteCustom: false,
      maxTransferAmount: new BN(100000000), // 0.1 SOL
      customFlags: 2, // Flag for "block-critical"
    }
  );

  console.log("   ✅ Created both time and block-based keys for redundancy");
  console.log("   💡 Application can choose which to use based on context");

  // Get and display all session keys with their expiration types
  const allKeys = await sdk.getSessionKeys(authority.publicKey);

  console.log("\n5. All Session Keys Summary:");
  allKeys.forEach((key, index) => {
    const expType =
      key.expirationType && "time" in key.expirationType ? "TIME" : "BLOCK";
    const expValue =
      key.expirationType && "time" in key.expirationType
        ? new Date(key.expiresAt * 1000).toLocaleString()
        : `Block #${key.expiresAt}`;

    console.log(`   Key ${index + 1}: ${expType} expiration - ${expValue}`);
    console.log(
      `         Status: ${key.isActive ? "✅ Active" : "❌ Inactive"}`
    );
  });

  console.log("\n💡 Tip: Choose expiration type based on your use case:");
  console.log("   - User-facing features → Time-based");
  console.log("   - Protocol interactions → Block-based");
  console.log("   - Critical operations → Both for redundancy");
}

runExamples();
