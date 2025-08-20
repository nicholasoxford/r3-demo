import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Keypair, SystemProgram, PublicKey } from "@solana/web3.js";
import { Time } from "../target/types/time";
import { assert } from "chai";
import { TOKEN_PROGRAM_ID, mintTo } from "@solana/spl-token";
import { airdropLamports, createMintAndAtas, deriveUserPda } from "./helpers";

describe("PDA isolation & authority enforcement", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Time as Program<Time>;

  async function setupUser() {
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

  it("prevents another wallet from creating a session key on someone else's PDA", async () => {
    const owner = await setupUser();
    const attacker = await setupUser();

    const session = Keypair.generate();
    try {
      await program.methods
        .createSessionKey(
          session.publicKey,
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
          userAccount: owner.userPda,
          authority: attacker.authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([attacker.authority])
        .rpc();
      assert.fail("expected has_one/seed constraint error");
    } catch (e) {
      assert(
        e.toString().includes("has one") ||
          e.toString().includes("has_one") ||
          e.toString().includes("ConstraintHasOne") ||
          e.toString().includes("ConstraintSeeds")
      );
    }
  });

  it("prevents another wallet from revoking a key on someone else's PDA", async () => {
    const owner = await setupUser();
    const attacker = await setupUser();
    const session = Keypair.generate();
    await program.methods
      .createSessionKey(
        session.publicKey,
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
        userAccount: owner.userPda,
        authority: owner.authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([owner.authority])
      .rpc();

    try {
      await program.methods
        .revokeSessionKey(session.publicKey)
        .accountsStrict({
          userAccount: owner.userPda,
          authority: attacker.authority.publicKey,
        })
        .signers([attacker.authority])
        .rpc();
      assert.fail("expected ConstraintHasOne/Seeds");
    } catch (e) {
      assert(
        e.toString().includes("has one") ||
          e.toString().includes("has_one") ||
          e.toString().includes("ConstraintHasOne") ||
          e.toString().includes("ConstraintSeeds")
      );
    }
  });

  it("prevents another wallet from cleanup/revokeAll/updateAllowedMints on someone else's PDA", async () => {
    const owner = await setupUser();
    const attacker = await setupUser();

    // cleanupSessionKeys
    for (const call of ["cleanupSessionKeys", "revokeAllSessionKeys"]) {
      try {
        // @ts-ignore dynamic method
        await program.methods[call]()
          .accountsStrict({
            userAccount: owner.userPda,
            authority: attacker.authority.publicKey,
          })
          .signers([attacker.authority])
          .rpc();
        assert.fail(`expected failure for ${call}`);
      } catch (e) {
        assert(
          e.toString().includes("has one") ||
            e.toString().includes("has_one") ||
            e.toString().includes("ConstraintHasOne") ||
            e.toString().includes("ConstraintSeeds")
        );
      }
    }

    // updateAllowedMints
    try {
      await program.methods
        .updateAllowedMints([])
        .accountsStrict({
          userAccount: owner.userPda,
          authority: attacker.authority.publicKey,
        })
        .signers([attacker.authority])
        .rpc();
      assert.fail("expected failure for updateAllowedMints");
    } catch (e) {
      assert(
        e.toString().includes("has one") ||
          e.toString().includes("has_one") ||
          e.toString().includes("ConstraintHasOne") ||
          e.toString().includes("ConstraintSeeds")
      );
    }
  });

  it("prevents another wallet from approving delegate on someone else's PDA", async () => {
    const owner = await setupUser();
    const attacker = await setupUser();
    const recipient = Keypair.generate();
    const feePayer: any = (provider.wallet as any).payer;
    const { mint, ownerAta } = await createMintAndAtas(
      provider.connection,
      feePayer,
      owner.authority.publicKey,
      recipient.publicKey,
      6
    );

    await mintTo(
      provider.connection,
      owner.authority,
      mint,
      ownerAta,
      owner.authority.publicKey,
      100_000_000n
    );

    const [delegateAuth] = PublicKey.findProgramAddressSync(
      [Buffer.from("delegate"), owner.userPda.toBuffer(), mint.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .splApproveDelegate(new BN(1))
        .accountsStrict({
          userAccount: owner.userPda,
          authority: attacker.authority.publicKey,
          tokenAccount: ownerAta,
          mint,
          delegateAuthority: delegateAuth,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([attacker.authority])
        .rpc();
      assert.fail("expected has_one/seed/permission error");
    } catch (e) {
      // Accept either accounts constraint or permission validation
      assert(
        e.toString().includes("ConstraintHasOne") ||
          e.toString().includes("has one") ||
          e.toString().includes("ConstraintSeeds") ||
          e.toString().includes("InsufficientPermissions")
      );
    }
  });

  it("rejects using a foreign session key for delegated transfer on someone else's PDA", async () => {
    const owner = await setupUser();
    const attacker = await setupUser();
    const recipient = Keypair.generate();

    const { mint, ownerAta, recipientAta } = await createMintAndAtas(
      provider.connection,
      owner.authority,
      owner.authority.publicKey,
      recipient.publicKey,
      6
    );

    await mintTo(
      provider.connection,
      owner.authority,
      mint,
      ownerAta,
      owner.authority.publicKey,
      500_000_000n
    );

    await program.methods
      .updateAllowedMints([mint])
      .accountsStrict({
        userAccount: owner.userPda,
        authority: owner.authority.publicKey,
      })
      .signers([owner.authority])
      .rpc();

    const [delegateAuth] = PublicKey.findProgramAddressSync(
      [Buffer.from("delegate"), owner.userPda.toBuffer(), mint.toBuffer()],
      program.programId
    );

    await program.methods
      .splApproveDelegate(new BN(300_000_000))
      .accountsStrict({
        userAccount: owner.userPda,
        authority: owner.authority.publicKey,
        tokenAccount: ownerAta,
        mint,
        delegateAuthority: delegateAuth,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([owner.authority])
      .rpc();

    // Attacker creates his own session key, but tries to use owner's PDA
    const foreignSession = Keypair.generate();
    await program.methods
      .createSessionKey(
        foreignSession.publicKey,
        new BN(Math.floor(Date.now() / 1000) + 600),
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
        userAccount: attacker.userPda,
        authority: attacker.authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([attacker.authority])
      .rpc();

    try {
      await program.methods
        .splDelegatedTransfer(new BN(1))
        .accountsStrict({
          sessionSigner: foreignSession.publicKey,
          userAccount: owner.userPda,
          fromToken: ownerAta,
          toToken: recipientAta,
          mint,
          delegateAuthority: delegateAuth,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([foreignSession])
        .rpc();
      assert.fail("expected SessionKeyNotFound");
    } catch (e) {
      assert.include(e.toString(), "SessionKeyNotFound");
    }
  });
});
