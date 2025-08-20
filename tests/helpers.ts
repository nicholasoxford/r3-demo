import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Keypair, Connection } from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";

export async function airdropLamports(
  connection: Connection,
  pubkey: PublicKey,
  lamports: number
) {
  const sig = await connection.requestAirdrop(pubkey, lamports);
  await connection.confirmTransaction(sig);
}

export function deriveUserPda(programId: PublicKey, authority: PublicKey) {
  return PublicKey.findProgramAddress(
    [Buffer.from("user_account"), authority.toBuffer()],
    programId
  );
}

export async function createMintAndAtas(
  connection: Connection,
  feePayer: Keypair,
  owner: PublicKey,
  recipient: PublicKey,
  decimals = 6
): Promise<{ mint: PublicKey; ownerAta: PublicKey; recipientAta: PublicKey }> {
  const mint = await createMint(connection, feePayer, owner, null, decimals);
  const ownerAtaAcc = await getOrCreateAssociatedTokenAccount(
    connection,
    feePayer,
    mint,
    owner
  );
  const recipientAtaAcc = await getOrCreateAssociatedTokenAccount(
    connection,
    feePayer,
    mint,
    recipient
  );
  return {
    mint,
    ownerAta: ownerAtaAcc.address,
    recipientAta: recipientAtaAcc.address,
  };
}

