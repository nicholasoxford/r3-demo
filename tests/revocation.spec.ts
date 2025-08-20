import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { SystemProgram, Keypair, PublicKey } from "@solana/web3.js";
import { Time } from "../target/types/time";
import { assert } from "chai";
import { TOKEN_PROGRAM_ID, mintTo } from "@solana/spl-token";
import { airdropLamports, createMintAndAtas, deriveUserPda } from "./helpers";

describe("Session Key Revocation ", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Time as Program<Time>;

  async function setupWithMint() {
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
    const { mint, ownerAta, recipientAta } = await createMintAndAtas(
      provider.connection,
      feePayer,
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
      500_000_000n
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
    return { authority, userPda, mint, ownerAta, recipientAta, delegateAuth };
  }

  it("revokes a key and rejects delegated transfer", async () => {
    const { authority, userPda, mint, ownerAta, recipientAta, delegateAuth } =
      await setupWithMint();

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

    await program.methods
      .revokeSessionKey(session.publicKey)
      .accountsStrict({ userAccount: userPda, authority: authority.publicKey })
      .signers([authority])
      .rpc();
    try {
      await program.methods
        .splDelegatedTransfer(new BN(1))
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
      assert.fail("expected SessionKeyRevoked");
    } catch (e) {
      assert.include(e.toString(), "SessionKeyRevoked");
    }
  });

  it("rejects double revoke and supports revoke all", async () => {
    const { authority, userPda } = await (async () => {
      const a = Keypair.generate();
      await airdropLamports(
        provider.connection,
        a.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      );
      const [pda] = await deriveUserPda(program.programId, a.publicKey);
      await program.methods
        .initializeUserAccount()
        .accountsStrict({
          userAccount: pda,
          authority: a.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([a])
        .rpc();
      // create two keys then revoke all
      for (let i = 0; i < 2; i++) {
        const s = Keypair.generate();
        await program.methods
          .createSessionKey(
            s.publicKey,
            new BN(Math.floor(Date.now() / 1000) + 600),
            { time: {} },
            {
              canTransfer: false,
              canDelegate: false,
              canExecuteCustom: false,
              maxTransferAmount: new BN(0),
              customFlags: 0,
            }
          )
          .accountsStrict({
            userAccount: pda,
            authority: a.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([a])
          .rpc();
      }
      return { authority: a, userPda: pda };
    })();

    // Revoke one key, then revoke again should error
    const acct1 = await program.account.userAccount.fetch(userPda);
    const keyPub = acct1.sessionKeys[0].pubkey as PublicKey;
    await program.methods
      .revokeSessionKey(keyPub)
      .accountsStrict({ userAccount: userPda, authority: authority.publicKey })
      .signers([authority])
      .rpc();
    try {
      await program.methods
        .revokeSessionKey(keyPub)
        .accountsStrict({
          userAccount: userPda,
          authority: authority.publicKey,
        })
        .signers([authority])
        .rpc();
      assert.fail("expected already revoked");
    } catch (e) {
      assert.include(e.toString(), "SessionKeyAlreadyRevoked");
    }
    await program.methods
      .revokeAllSessionKeys()
      .accountsStrict({ userAccount: userPda, authority: authority.publicKey })
      .signers([authority])
      .rpc();
    const acct2 = await program.account.userAccount.fetch(userPda);
    acct2.sessionKeys.forEach((k: any) => assert.equal(k.isRevoked, true));
  });
});
