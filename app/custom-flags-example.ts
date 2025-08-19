import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { SessionKeySDK, createSessionKeySDK, generateSessionKey } from "./sdk";
import { BN } from "@coral-xyz/anchor";

/**
 * Example: Reading and Using Custom Flags from Session Keys
 * 
 * This demonstrates how custom_flags are visible through IDL parsing
 * and how to use them for application-specific permissions.
 */

// Define custom flag meanings using bitflags pattern
const CustomFlags = {
  // Trading Bot Flags (bits 0-7)
  CAN_TRADE_SPOT: 1 << 0,        // 0x00000001
  CAN_TRADE_FUTURES: 1 << 1,     // 0x00000002
  CAN_USE_LEVERAGE: 1 << 2,      // 0x00000004
  CAN_SHORT_SELL: 1 << 3,        // 0x00000008
  
  // Subscription Flags (bits 8-15)
  SUBSCRIPTION_ACTIVE: 1 << 8,   // 0x00000100
  PREMIUM_TIER: 1 << 9,          // 0x00000200
  ENTERPRISE_TIER: 1 << 10,      // 0x00000400
  
  // Risk Management (bits 16-23)
  LOW_RISK: 1 << 16,             // 0x00010000
  MEDIUM_RISK: 1 << 17,          // 0x00020000
  HIGH_RISK: 1 << 18,            // 0x00040000
  
  // Time Restrictions (bits 24-31)
  WEEKDAYS_ONLY: 1 << 24,        // 0x01000000
  BUSINESS_HOURS: 1 << 25,       // 0x02000000
  AFTER_HOURS: 1 << 26,          // 0x04000000
};

async function demonstrateCustomFlags() {
  console.log("=== Custom Flags Example: Reading & Using Bitflags ===\n");

  // Initialize SDK
  const connection = new Connection("http://localhost:8899", "confirmed");
  const authority = Keypair.generate();
  const wallet = new anchor.Wallet(authority);
  const programId = new PublicKey("DdtvbkajRMQj26vuAUaV96hDtzE1mzvB7k64VeWzoWib");
  
  // Airdrop SOL
  const airdrop = await connection.requestAirdrop(authority.publicKey, 2 * LAMPORTS_PER_SOL);
  await connection.confirmTransaction(airdrop);
  
  const sdk = await createSessionKeySDK(connection, programId, wallet);
  await sdk.initializeUserAccount(authority.publicKey);

  // Example 1: Create Trading Bot Session Key with Custom Flags
  console.log("1. Creating Trading Bot Session Key with custom permissions:\n");
  
  const tradingBotKey = generateSessionKey();
  const tradingBotFlags = 
    CustomFlags.CAN_TRADE_SPOT | 
    CustomFlags.CAN_TRADE_FUTURES | 
    CustomFlags.MEDIUM_RISK |
    CustomFlags.BUSINESS_HOURS;
  
  await sdk.createSessionKey(
    authority.publicKey,
    tradingBotKey.publicKey,
    3600, // 1 hour
    {
      canTransfer: true,
      canDelegate: false,
      canExecuteCustom: true,
      maxTransferAmount: new BN(5 * LAMPORTS_PER_SOL),
      customFlags: tradingBotFlags, // Setting custom flags!
    }
  );
  
  console.log(`   ✅ Trading bot key created with flags: 0x${tradingBotFlags.toString(16)}`);
  console.log(`   Binary: ${tradingBotFlags.toString(2).padStart(32, '0')}`);

  // Example 2: Create Premium Subscription Key
  console.log("\n2. Creating Premium Subscription Session Key:\n");
  
  const subscriptionKey = generateSessionKey();
  const subscriptionFlags = 
    CustomFlags.SUBSCRIPTION_ACTIVE | 
    CustomFlags.PREMIUM_TIER;
  
  await sdk.createSessionKey(
    authority.publicKey,
    subscriptionKey.publicKey,
    30 * 24 * 3600, // 30 days
    {
      canTransfer: true,
      canDelegate: false,
      canExecuteCustom: false,
      maxTransferAmount: new BN(0.1 * LAMPORTS_PER_SOL),
      customFlags: subscriptionFlags,
    }
  );
  
  console.log(`   ✅ Subscription key created with flags: 0x${subscriptionFlags.toString(16)}`);

  // Example 3: READ AND ANALYZE CUSTOM FLAGS
  console.log("\n3. Reading and Analyzing Custom Flags from Chain:\n");
  
  // Fetch all session keys (this uses IDL parsing!)
  const sessionKeys = await sdk.getSessionKeys(authority.publicKey);
  
  console.log(`Found ${sessionKeys.length} session keys:\n`);
  
  sessionKeys.forEach((key, index) => {
    console.log(`Session Key ${index + 1}:`);
    console.log(`   Public Key: ${key.pubkey.toBase58().slice(0, 20)}...`);
    console.log(`   Custom Flags: 0x${key.permissions.customFlags.toString(16).padStart(8, '0')}`);
    console.log(`   Binary: ${key.permissions.customFlags.toString(2).padStart(32, '0')}`);
    
    // Decode the flags
    const flags = key.permissions.customFlags;
    console.log(`   Decoded Permissions:`);
    
    // Check Trading Permissions
    if (flags & CustomFlags.CAN_TRADE_SPOT) console.log(`     ✅ Can Trade Spot`);
    if (flags & CustomFlags.CAN_TRADE_FUTURES) console.log(`     ✅ Can Trade Futures`);
    if (flags & CustomFlags.CAN_USE_LEVERAGE) console.log(`     ✅ Can Use Leverage`);
    if (flags & CustomFlags.CAN_SHORT_SELL) console.log(`     ✅ Can Short Sell`);
    
    // Check Subscription Status
    if (flags & CustomFlags.SUBSCRIPTION_ACTIVE) console.log(`     ✅ Subscription Active`);
    if (flags & CustomFlags.PREMIUM_TIER) console.log(`     ✅ Premium Tier`);
    if (flags & CustomFlags.ENTERPRISE_TIER) console.log(`     ✅ Enterprise Tier`);
    
    // Check Risk Level
    if (flags & CustomFlags.LOW_RISK) console.log(`     🟢 Low Risk`);
    if (flags & CustomFlags.MEDIUM_RISK) console.log(`     🟡 Medium Risk`);
    if (flags & CustomFlags.HIGH_RISK) console.log(`     🔴 High Risk`);
    
    // Check Time Restrictions
    if (flags & CustomFlags.WEEKDAYS_ONLY) console.log(`     📅 Weekdays Only`);
    if (flags & CustomFlags.BUSINESS_HOURS) console.log(`     🕐 Business Hours Only`);
    if (flags & CustomFlags.AFTER_HOURS) console.log(`     🌙 After Hours Trading`);
    
    console.log();
  });

  // Example 4: Check specific permission before executing
  console.log("4. Using Custom Flags for Permission Checks:\n");
  
  const botKey = sessionKeys.find(k => 
    k.permissions.customFlags & CustomFlags.CAN_TRADE_FUTURES
  );
  
  if (botKey) {
    console.log("   Found a key with futures trading permission!");
    
    // Check if it's allowed to trade now (business hours check)
    if (botKey.permissions.customFlags & CustomFlags.BUSINESS_HOURS) {
      const hour = new Date().getHours();
      if (hour >= 9 && hour < 17) {
        console.log("   ✅ Trading allowed - within business hours");
      } else {
        console.log("   ❌ Trading blocked - outside business hours");
      }
    }
    
    // Check risk level
    const riskLevel = 
      (botKey.permissions.customFlags & CustomFlags.HIGH_RISK) ? "HIGH" :
      (botKey.permissions.customFlags & CustomFlags.MEDIUM_RISK) ? "MEDIUM" :
      (botKey.permissions.customFlags & CustomFlags.LOW_RISK) ? "LOW" : "UNKNOWN";
    
    console.log(`   Risk Level: ${riskLevel}`);
  }

  // Example 5: Combine multiple flags for complex permissions
  console.log("\n5. Complex Permission Example - Multi-flag Requirements:\n");
  
  // Find keys that have BOTH premium tier AND can trade futures
  const premiumTradingKeys = sessionKeys.filter(k => 
    (k.permissions.customFlags & CustomFlags.PREMIUM_TIER) &&
    (k.permissions.customFlags & CustomFlags.CAN_TRADE_FUTURES)
  );
  
  if (premiumTradingKeys.length > 0) {
    console.log(`   Found ${premiumTradingKeys.length} premium trading keys`);
  } else {
    console.log("   No keys with both premium tier and futures trading");
  }

  // Show how to update flags
  console.log("\n6. Updating Custom Flags:\n");
  
  if (sessionKeys.length > 0) {
    const keyToUpdate = sessionKeys[0];
    const newFlags = keyToUpdate.permissions.customFlags | CustomFlags.ENTERPRISE_TIER;
    
    console.log(`   Current flags: 0x${keyToUpdate.permissions.customFlags.toString(16)}`);
    console.log(`   Adding ENTERPRISE_TIER flag...`);
    
    await sdk.updateSessionKey(
      authority.publicKey,
      keyToUpdate.pubkey,
      undefined, // Don't change expiry
      {
        ...keyToUpdate.permissions,
        customFlags: newFlags,
      }
    );
    
    console.log(`   ✅ Updated flags to: 0x${newFlags.toString(16)}`);
  }

  // Summary
  console.log("\n📊 Custom Flags Summary:");
  console.log("   • 32 bits = 32 different boolean flags");
  console.log("   • Use bitwise operations to check/set flags");
  console.log("   • Fully visible through IDL parsing");
  console.log("   • Perfect for app-specific permissions");
  console.log("   • No protocol changes needed for new features");
}

// Helper function to visualize flags
function visualizeFlags(flags: number): string {
  const binary = flags.toString(2).padStart(32, '0');
  return binary.match(/.{1,8}/g)!.join(' ');
}

// Run the example
if (require.main === module) {
  demonstrateCustomFlags().catch(console.error);
}

export { demonstrateCustomFlags, CustomFlags, visualizeFlags };
