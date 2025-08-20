import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { createSessionKeySDK, generateSessionKey } from "./sdk";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";

// Shared configuration for the example
const PROGRAM_ID = "DdtvbkajRMQj26vuAUaV96hDtzE1mzvB7k64VeWzoWib";
const RPC_URL = "http://localhost:8899";

// this function showcases how we can delegate transferring an SPL token
// on another wallets behalf

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

export async function runSplTokenTransferExample() {
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
  await sdk.createSessionKey({
    authority,
    sessionKeyPubkey: sessionKey.publicKey,
    durationSeconds: 300,
    permissions: {
      canTransfer: true,
      canDelegate: false,
      canExecuteCustom: false,
      maxTransferAmount: new BN(500_000_000), // 0.5 tokens
      customFlags: 0,
    },
  });

  // Optional: fund session key for fees if you plan to send with it as fee payer
  const sig = await connection.requestAirdrop(
    sessionKey.publicKey,
    0.01 * LAMPORTS_PER_SOL
  );
  await connection.confirmTransaction(sig, "confirmed");

  console.log("✅ Session key funded with 0.01 SOL");

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

runSplTokenTransferExample().catch((error) => {
  console.error("❌ Error running SPL token transfer example:", error);
  process.exit(1);
});
