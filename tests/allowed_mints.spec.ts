import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { SystemProgram, Keypair, PublicKey } from "@solana/web3.js";
import { Time } from "../target/types/time";
import { assert } from "chai";
import { TOKEN_PROGRAM_ID, mintTo } from "@solana/spl-token";
import { airdropLamports, createMintAndAtas, deriveUserPda } from "./helpers";

describe("Allowed mints behavior", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Time as Program<Time>;

  it("enforces allowlist and switching mints", async () => {
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

    const recipient = Keypair.generate();
    const feePayer: any = (provider.wallet as any).payer;
    const {
      mint: mintA,
      ownerAta: ownerAtaA,
      recipientAta: recipAtaA,
    } = await createMintAndAtas(
      provider.connection,
      feePayer,
      authority.publicKey,
      recipient.publicKey,
      6
    );
    const { mint: mintB } = await createMintAndAtas(
      provider.connection,
      feePayer,
      authority.publicKey,
      recipient.publicKey,
      6
    );

    await mintTo(
      provider.connection,
      authority,
      mintA,
      ownerAtaA,
      authority.publicKey,
      500_000_000n
    );

    await program.methods
      .updateAllowedMints([mintA])
      .accountsStrict({
        userAccount: userPda,
        authority: authority.publicKey,
      })
      .signers([authority])
      .rpc();

    const [delegateA] = PublicKey.findProgramAddressSync(
      [Buffer.from("delegate"), userPda.toBuffer(), mintA.toBuffer()],
      program.programId
    );
    await program.methods
      .splApproveDelegate(new BN(200_000_000))
      .accountsStrict({
        userAccount: userPda,
        authority: authority.publicKey,
        tokenAccount: ownerAtaA,
        mint: mintA,
        delegateAuthority: delegateA,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([authority])
      .rpc();

    const session = Keypair.generate();
    await program.methods
      .createSessionKey(
        session.publicKey,
        new BN(Math.floor(Date.now() / 1000) + 600),
        { time: {} },
        {
          canTransfer: true,
          canDelegate: false,
          canExecuteCustom: false,
          maxTransferAmount: new BN(200_000_000),
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

    // Transfer with allowed mint A succeeds
    await program.methods
      .splDelegatedTransfer(new BN(100_000_000))
      .accountsStrict({
        sessionSigner: session.publicKey,
        userAccount: userPda,
        fromToken: ownerAtaA,
        toToken: recipAtaA,
        mint: mintA,
        delegateAuthority: delegateA,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([session])
      .rpc();

    // Switch allowlist to only mintB
    await program.methods
      .updateAllowedMints([mintB])
      .accountsStrict({
        userAccount: userPda,
        authority: authority.publicKey,
      })
      .signers([authority])
      .rpc();

    // Now transferring with mintA should fail due to MintNotAllowed
    try {
      await program.methods
        .splDelegatedTransfer(new BN(1))
        .accountsStrict({
          sessionSigner: session.publicKey,
          userAccount: userPda,
          fromToken: ownerAtaA,
          toToken: recipAtaA,
          mint: mintA,
          delegateAuthority: delegateA,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([session])
        .rpc();
      assert.fail("expected MintNotAllowed");
    } catch (e) {
      assert.include(e.toString(), "MintNotAllowed");
    }
  });
});
