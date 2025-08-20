import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { Time } from "../target/types/time";
import { assert } from "chai";
import {
  TOKEN_PROGRAM_ID,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { airdropLamports, createMintAndAtas, deriveUserPda } from "./helpers";

describe("SPL Delegation", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Time as Program<Time>;

  async function setupAuthorityAndPda() {
    const authority = Keypair.generate();
    await airdropLamports(
      provider.connection,
      authority.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    const [userPda] = await deriveUserPda(
      program.programId,
      authority.publicKey
    );
    await program.methods
      .initializeUserAccount()
      .accountsStrict({
        userAccount: userPda,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();
    return { authority, userPda };
  }

  it("approves delegate and transfers via session key (time-based)", async () => {
    const { authority, userPda } = await setupAuthorityAndPda();
    const recipient = Keypair.generate();

    const { mint, ownerAta, recipientAta } = await createMintAndAtas(
      provider.connection,
      authority,
      authority.publicKey,
      recipient.publicKey,
      6
    );

    await mintTo(
      provider.connection,
      authority,
      mint,
      ownerAta,
      authority.publicKey,
      1_000_000_000n
    );

    await program.methods
      .updateAllowedMints([mint])
      .accountsStrict({ userAccount: userPda, authority: authority.publicKey })
      .signers([authority])
      .rpc();

    const [delegateAuth] = PublicKey.findProgramAddressSync(
      [Buffer.from("delegate"), userPda.toBuffer(), mint.toBuffer()],
      program.programId
    );

    await program.methods
      .splApproveDelegate(new BN(300_000_000))
      .accountsStrict({
        userAccount: userPda,
        authority: authority.publicKey,
        tokenAccount: ownerAta,
        mint,
        delegateAuthority: delegateAuth,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([authority])
      .rpc();

    const session = Keypair.generate();
    await program.methods
      .createSessionKey(
        session.publicKey,
        new BN(Math.floor(Date.now() / 1000) + 3600),
        { time: {} },
        {
          canTransfer: true,
          canDelegate: false,
          canExecuteCustom: false,
          maxTransferAmount: new BN(300_000_000),
          customFlags: 0,
        }
      )
      .accountsStrict({
        userAccount: userPda,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    // Fund session for fees
    await airdropLamports(
      provider.connection,
      session.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
    );

    await program.methods
      .splDelegatedTransfer(new BN(100_000_000))
      .accountsStrict({
        sessionSigner: session.publicKey,
        userAccount: userPda,
        fromToken: ownerAta,
        toToken: recipientAta,
        mint,
        delegateAuthority: delegateAuth,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([session])
      .rpc();

    const refreshed = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      authority,
      mint,
      recipient.publicKey
    );
    assert.equal(Number(refreshed.amount), 100_000_000);
  });
});
