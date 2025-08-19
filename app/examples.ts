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
  return { sdk, authority: keypair, connection };
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
  demonstrateRealTransfers,
  subscriptionServiceExample,
  defiYieldHarvestingBot,
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

  // Example 4: Hybrid approach for maximum flexibility

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

/**
 * Example 12: Demonstrate Real SOL Transfers Using Session Keys
 *
 * This example shows how session keys can execute actual SOL transfers
 * on behalf of the authority, with proper permission and amount checking.
 */
async function demonstrateRealTransfers() {
  console.log("\n=== Example 12: Real SOL Transfers with Session Keys ===\n");

  const connection = new Connection("http://localhost:8899", "confirmed");
  const { sdk, authority } = await initializeSDK();

  // Initialize user account
  await sdk.initializeUserAccount(authority.publicKey);
  console.log("✅ User account initialized");
  console.log(
    `💰 Authority balance: ${
      (await connection.getBalance(authority.publicKey)) / LAMPORTS_PER_SOL
    } SOL`
  );

  // Create recipient accounts
  const recipient1 = Keypair.generate();
  const recipient2 = Keypair.generate();
  const recipient3 = Keypair.generate();

  // Example 1: Limited Transfer Session Key
  console.log(
    "\n1. Creating LIMITED transfer session key (max 0.1 SOL per tx):"
  );
  const limitedKey = generateSessionKey();

  await sdk.createSessionKey(
    authority.publicKey,
    limitedKey.publicKey,
    300, // 5 minutes
    {
      canTransfer: true,
      canDelegate: false,
      canExecuteCustom: false,
      maxTransferAmount: new BN(0.1 * LAMPORTS_PER_SOL), // 0.1 SOL max per transfer
      customFlags: 0,
    }
  );
  console.log("   ✅ Limited session key created");

  // Fund the session key for gas fees
  const airdrop1 = await connection.requestAirdrop(
    limitedKey.publicKey,
    0.01 * LAMPORTS_PER_SOL
  );
  await connection.confirmTransaction(airdrop1);

  // Execute transfer with limited key
  console.log("\n   Executing transfer with limited key:");
  try {
    const transferAmount = 0.05 * LAMPORTS_PER_SOL; // Within limit
    console.log(
      `   Transferring ${transferAmount / LAMPORTS_PER_SOL} SOL to recipient...`
    );

    // Execute real transfer
    await sdk.executeTransferWithSessionKey(
      authority.publicKey,
      limitedKey,
      recipient1.publicKey,
      new BN(transferAmount)
    );

    const balance = await connection.getBalance(recipient1.publicKey);
    console.log(`   ✅ Transfer successful (within 0.1 SOL limit)`);
    console.log(`   📊 Recipient 1 balance: ${balance / LAMPORTS_PER_SOL} SOL`);
  } catch (error) {
    console.log(`   ❌ Transfer failed: ${error}`);
  }

  // Example 2: Unlimited Transfer Session Key (for trusted operations)
  console.log("\n2. Creating UNLIMITED transfer session key:");
  const unlimitedKey = generateSessionKey();

  await sdk.createSessionKey(
    authority.publicKey,
    unlimitedKey.publicKey,
    60, // 1 minute (short-lived for security)
    {
      canTransfer: true,
      canDelegate: false,
      canExecuteCustom: false,
      maxTransferAmount: new BN(0), // 0 means unlimited
      customFlags: 0,
    }
  );
  console.log("   ✅ Unlimited session key created (short-lived for security)");

  // Fund the session key
  const airdrop2 = await connection.requestAirdrop(
    unlimitedKey.publicKey,
    0.01 * LAMPORTS_PER_SOL
  );
  await connection.confirmTransaction(airdrop2);

  // Execute larger transfer
  console.log("\n   Executing larger transfer with unlimited key:");
  try {
    const transferAmount = 0.5 * LAMPORTS_PER_SOL;
    console.log(
      `   Transferring ${transferAmount / LAMPORTS_PER_SOL} SOL to recipient...`
    );

    // Execute real transfer with unlimited key
    await sdk.executeTransferWithSessionKey(
      authority.publicKey,
      unlimitedKey,
      recipient2.publicKey,
      new BN(transferAmount)
    );

    const balance = await connection.getBalance(recipient2.publicKey);
    console.log(`   ✅ Transfer successful (no limit)`);
    console.log(`   📊 Recipient 2 balance: ${balance / LAMPORTS_PER_SOL} SOL`);
  } catch (error) {
    console.log(`   ❌ Transfer failed: ${error}`);
  }

  // Example 3: Demonstrate transfer limit enforcement
  console.log("\n3. Testing transfer limit enforcement:");
  console.log(
    "   Attempting to transfer 0.2 SOL with limited key (max 0.1 SOL):"
  );
  try {
    const transferAmount = 0.2 * LAMPORTS_PER_SOL; // Exceeds limit!
    console.log(
      `   Attempting ${transferAmount / LAMPORTS_PER_SOL} SOL transfer...`
    );

    // This should fail due to exceeding the limit
    await sdk.executeTransferWithSessionKey(
      authority.publicKey,
      limitedKey,
      recipient3.publicKey,
      new BN(transferAmount)
    );

    console.log(`   ❌ This should not have succeeded!`);
  } catch (error: any) {
    console.log(`   ✅ Correctly rejected: Transfer exceeds session key limit`);
    console.log(`   📝 Error: ${error.toString().split("\n")[0]}`);
  }

  // Example 4: Multi-signature pattern with session keys
  console.log("\n4. Multi-transfer pattern (batch payments):");
  const batchKey = generateSessionKey();

  await sdk.createSessionKey(
    authority.publicKey,
    batchKey.publicKey,
    600, // 10 minutes
    {
      canTransfer: true,
      canDelegate: false,
      canExecuteCustom: false,
      maxTransferAmount: new BN(0.02 * LAMPORTS_PER_SOL), // Small amounts only
      customFlags: 0,
    }
  );

  // Fund the batch key
  const airdrop3 = await connection.requestAirdrop(
    batchKey.publicKey,
    0.01 * LAMPORTS_PER_SOL
  );
  await connection.confirmTransaction(airdrop3);

  const recipients = [
    { keypair: recipient1, name: "Employee A" },
    { keypair: recipient2, name: "Employee B" },
    { keypair: recipient3, name: "Contractor C" },
  ];
  const paymentAmount = 0.01 * LAMPORTS_PER_SOL;

  console.log(
    `   Processing batch payments of ${
      paymentAmount / LAMPORTS_PER_SOL
    } SOL each:`
  );

  let successfulPayments = 0;
  for (let i = 0; i < recipients.length; i++) {
    try {
      // Execute real batch payment
      await sdk.executeTransferWithSessionKey(
        authority.publicKey,
        batchKey,
        recipients[i].keypair.publicKey,
        new BN(paymentAmount)
      );

      const balance = await connection.getBalance(
        recipients[i].keypair.publicKey
      );
      console.log(
        `   ✅ Payment ${i + 1}: Sent to ${recipients[i].name} (${recipients[
          i
        ].keypair.publicKey
          .toBase58()
          .slice(0, 8)}...) - Balance: ${balance / LAMPORTS_PER_SOL} SOL`
      );
      successfulPayments++;
    } catch (error) {
      console.log(`   ❌ Payment ${i + 1} failed: ${error}`);
    }
  }

  console.log(
    `   📊 Total transferred: ${
      (paymentAmount * successfulPayments) / LAMPORTS_PER_SOL
    } SOL across ${successfulPayments} payments`
  );

  // Summary
  console.log("\n📊 Transfer Examples Summary:");
  console.log("   - Limited keys protect against large unauthorized transfers");
  console.log("   - Unlimited keys should be short-lived for security");
  console.log(
    "   - Session keys enable automated payments without exposing main wallet"
  );
  console.log(
    "   - Perfect for subscription services, payroll, and automated trading"
  );

  const finalBalance = await connection.getBalance(authority.publicKey);
  console.log(
    `\n💰 Final authority balance: ${finalBalance / LAMPORTS_PER_SOL} SOL`
  );
}

/**
 * Example 13: Subscription Service with Auto-payments
 *
 * Demonstrates how session keys enable subscription services to collect
 * payments automatically without user interaction for each payment.
 */
async function subscriptionServiceExample() {
  console.log(
    "\n=== Example 13: Subscription Service with Auto-payments ===\n"
  );

  const connection = new Connection("http://localhost:8899", "confirmed");
  const { sdk, authority } = await initializeSDK();

  // Initialize user account (subscriber)
  await sdk.initializeUserAccount(authority.publicKey);
  console.log("👤 Subscriber account initialized");
  console.log(
    `💳 Subscriber wallet: ${authority.publicKey.toBase58().slice(0, 20)}...`
  );
  console.log(
    `💰 Initial balance: ${
      (await connection.getBalance(authority.publicKey)) / LAMPORTS_PER_SOL
    } SOL\n`
  );

  // Service provider's wallet
  const serviceProvider = Keypair.generate();
  console.log("🏢 Service Provider: Netflix-on-Solana");
  console.log(
    `   Wallet: ${serviceProvider.publicKey.toBase58().slice(0, 20)}...`
  );

  // Create a monthly subscription session key
  console.log("\n📝 Setting up subscription:");
  const subscriptionKey = generateSessionKey();
  const monthlyFee = 0.05 * LAMPORTS_PER_SOL; // 0.05 SOL per month

  // Create session key with monthly limit
  await sdk.createSessionKey(
    authority.publicKey,
    subscriptionKey.publicKey,
    30 * 24 * 3600, // 30 days validity
    {
      canTransfer: true,
      canDelegate: false,
      canExecuteCustom: false,
      maxTransferAmount: new BN(monthlyFee), // Exactly monthly fee
      customFlags: 1, // Flag for "subscription payment"
    }
  );
  console.log("   ✅ Subscription authorized for 30 days");
  console.log(`   💵 Monthly fee: ${monthlyFee / LAMPORTS_PER_SOL} SOL`);
  console.log(
    `   🔑 Session key: ${subscriptionKey.publicKey.toBase58().slice(0, 20)}...`
  );

  // Fund the session key for gas
  const airdrop = await connection.requestAirdrop(
    subscriptionKey.publicKey,
    0.001 * LAMPORTS_PER_SOL
  );
  await connection.confirmTransaction(airdrop);

  // Simulate monthly payment collection
  console.log("\n💳 Processing monthly subscription payment:");

  try {
    const beforeBalance = await connection.getBalance(authority.publicKey);

    // Service collects payment using the session key
    await sdk.executeTransferWithSessionKey(
      authority.publicKey,
      subscriptionKey,
      serviceProvider.publicKey,
      new BN(monthlyFee)
    );

    const afterBalance = await connection.getBalance(authority.publicKey);
    const providerBalance = await connection.getBalance(
      serviceProvider.publicKey
    );

    console.log("   ✅ Payment collected successfully!");
    console.log(
      `   📊 Subscriber charged: ${
        (beforeBalance - afterBalance) / LAMPORTS_PER_SOL
      } SOL`
    );
    console.log(
      `   📊 Service provider received: ${
        providerBalance / LAMPORTS_PER_SOL
      } SOL`
    );
    console.log("   🎬 Access granted for current billing period");
  } catch (error) {
    console.log(`   ❌ Payment failed: ${error}`);
    console.log("   🚫 Service access suspended");
  }

  // Show renewal process
  console.log("\n🔄 Subscription Renewal Process:");
  console.log("   1. Session key expires after 30 days");
  console.log("   2. User must explicitly renew (create new session key)");
  console.log("   3. Prevents unauthorized charges after cancellation");
  console.log("   4. User maintains full control over their funds");

  // Benefits summary
  console.log("\n✨ Benefits of Session Keys for Subscriptions:");
  console.log("   • No need to sign each monthly payment");
  console.log("   • Automatic payment collection by service");
  console.log("   • User can cancel anytime by revoking key");
  console.log("   • Built-in spending limits prevent overcharging");
  console.log("   • Time-bound authorization for security");
}

/**
 * Example 14: DeFi Yield Harvesting Bot
 *
 * Shows how session keys enable automated DeFi strategies
 * with built-in risk management.
 */
async function defiYieldHarvestingBot() {
  console.log("\n=== Example 14: DeFi Yield Harvesting Bot ===\n");

  const connection = new Connection("http://localhost:8899", "confirmed");
  const { sdk, authority } = await initializeSDK();

  // Initialize user account
  await sdk.initializeUserAccount(authority.publicKey);
  console.log("🌾 DeFi User account initialized");
  console.log(
    `💰 Portfolio value: ${
      (await connection.getBalance(authority.publicKey)) / LAMPORTS_PER_SOL
    } SOL\n`
  );

  // Create different session keys for different risk levels
  console.log("🤖 Setting up yield harvesting bot with risk tiers:\n");

  // Low risk operations
  const lowRiskKey = generateSessionKey();
  await sdk.createSessionKey(
    authority.publicKey,
    lowRiskKey.publicKey,
    24 * 3600, // 24 hours
    {
      canTransfer: true,
      canDelegate: false,
      canExecuteCustom: true,
      maxTransferAmount: new BN(0.1 * LAMPORTS_PER_SOL), // Max 0.1 SOL per tx
      customFlags: 10, // Low risk flag
    }
  );
  console.log("   🟢 Low Risk Key: Stable pools only");
  console.log("      • Max transaction: 0.1 SOL");
  console.log("      • Valid for: 24 hours");
  console.log("      • Can compound yields automatically");

  // Medium risk operations
  const mediumRiskKey = generateSessionKey();
  await sdk.createSessionKey(
    authority.publicKey,
    mediumRiskKey.publicKey,
    12 * 3600, // 12 hours
    {
      canTransfer: true,
      canDelegate: false,
      canExecuteCustom: true,
      maxTransferAmount: new BN(0.5 * LAMPORTS_PER_SOL), // Max 0.5 SOL per tx
      customFlags: 20, // Medium risk flag
    }
  );
  console.log("\n   🟡 Medium Risk Key: Yield farming");
  console.log("      • Max transaction: 0.5 SOL");
  console.log("      • Valid for: 12 hours");
  console.log("      • Can swap tokens and provide liquidity");

  // High risk operations (very limited)
  const highRiskKey = generateSessionKey();
  await sdk.createSessionKeyWithBlockHeight(
    authority.publicKey,
    highRiskKey.publicKey,
    900, // ~6-7 minutes worth of blocks
    {
      canTransfer: true,
      canDelegate: false,
      canExecuteCustom: true,
      maxTransferAmount: new BN(1 * LAMPORTS_PER_SOL), // Max 1 SOL per tx
      customFlags: 30, // High risk flag
    }
  );
  console.log("\n   🔴 High Risk Key: Leveraged positions");
  console.log("      • Max transaction: 1 SOL");
  console.log("      • Valid for: 900 blocks (~7 minutes)");
  console.log("      • Can open leveraged positions");
  console.log("      • Block-based expiry for precise control");

  // Risk management summary
  console.log("\n🛡️ Risk Management Features:");
  console.log("   • Tiered permission system based on risk");
  console.log("   • Shorter validity for higher risk operations");
  console.log("   • Transaction limits prevent catastrophic losses");
  console.log("   • Block-height expiry for time-critical operations");
  console.log("   • Emergency revoke all for black swan events");

  console.log("\n📈 Bot Operations (Simulated):");
  console.log("   • Harvesting yield from stable pools...");
  console.log("   • Rebalancing portfolio positions...");
  console.log("   • Compounding earned rewards...");
  console.log("   ✅ Operations completed within risk parameters");
}

// Run all examples or individual ones
if (require.main === module) {
  // If running this file directly, you can choose which examples to run
  const args = process.argv.slice(2);

  if (args.includes("--subscription")) {
    subscriptionServiceExample().catch(console.error);
  } else if (args.includes("--defi")) {
    defiYieldHarvestingBot().catch(console.error);
  } else if (args.includes("--transfers")) {
    demonstrateRealTransfers().catch(console.error);
  } else {
    // Run all examples by default
    runExamples().catch(console.error);
  }
}

runExamples();
