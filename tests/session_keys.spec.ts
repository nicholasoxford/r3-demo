import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Keypair, SystemProgram } from "@solana/web3.js";
import { Time } from "../target/types/time";
import { assert } from "chai";
import { airdropLamports, deriveUserPda } from "./helpers";

describe("Session Keys (time/block)", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Time as Program<Time>;

  it("creates and updates a time-based session key", async () => {
    const authority = Keypair.generate();
    await airdropLamports(
      provider.connection,
      authority.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
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
          maxTransferAmount: new BN(1_000_000_000),
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

    const newExpiry = new BN(Math.floor(Date.now() / 1000) + 7200);
    await program.methods
      .updateSessionKey(session.publicKey, newExpiry, null)
      .accountsStrict({ userAccount: userPda, authority: authority.publicKey })
      .signers([authority])
      .rpc();

    const acct = await program.account.userAccount.fetch(userPda);
    const entry = acct.sessionKeys.find(
      (k: any) => k.pubkey.toBase58() === session.publicKey.toBase58()
    );
    assert.equal(entry.expiresAt.toNumber(), newExpiry.toNumber());
  });

  it("creates a block-height session key", async () => {
    const authority = Keypair.generate();
    await airdropLamports(
      provider.connection,
      authority.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
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

    const slot = await provider.connection.getSlot();
    const session = Keypair.generate();
    await program.methods
      .createSessionKey(
        session.publicKey,
        new BN(slot + 50),
        { blockHeight: {} },
        {
          canTransfer: true,
          canDelegate: false,
          canExecuteCustom: false,
          maxTransferAmount: new BN(100_000_000),
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

    const acct = await program.account.userAccount.fetch(userPda);
    const entry = acct.sessionKeys.find(
      (k: any) => k.pubkey.toBase58() === session.publicKey.toBase58()
    );
    assert.deepEqual(entry.expirationType, { blockHeight: {} });
  });

  it("enforces maximum number of session keys per user", async () => {
    const authority = Keypair.generate();
    await airdropLamports(
      provider.connection,
      authority.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
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

    // MAX_SESSION_KEYS is 10. Create 10, then the 11th should fail.
    const now = Math.floor(Date.now() / 1000);
    for (let i = 0; i < 10; i++) {
      const sk = Keypair.generate();
      await program.methods
        .createSessionKey(
          sk.publicKey,
          new BN(now + 3600 + i),
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
          userAccount: userPda,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();
    }

    try {
      const extra = Keypair.generate();
      await program.methods
        .createSessionKey(
          extra.publicKey,
          new BN(now + 9999),
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
          userAccount: userPda,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();
      assert.fail("expected TooManySessionKeys");
    } catch (e) {
      assert.include(e.toString(), "TooManySessionKeys");
    }
  });

  it("rejects updating block-height expiry to a past slot", async () => {
    const authority = Keypair.generate();
    await airdropLamports(
      provider.connection,
      authority.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
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

    const slot = await provider.connection.getSlot();
    const session = Keypair.generate();
    await program.methods
      .createSessionKey(
        session.publicKey,
        new BN(slot + 100),
        { blockHeight: {} },
        {
          canTransfer: false,
          canDelegate: false,
          canExecuteCustom: false,
          maxTransferAmount: new BN(0),
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

    // Try to update to a past slot
    try {
      await program.methods
        .updateSessionKey(session.publicKey, new BN(slot - 1), null)
        .accountsStrict({
          userAccount: userPda,
          authority: authority.publicKey,
        })
        .signers([authority])
        .rpc();
      assert.fail("expected InvalidExpiry");
    } catch (e) {
      assert.include(e.toString(), "InvalidExpiry");
    }
  });

  it("enforces authority-only updates (wrong signer fails)", async () => {
    const authority = Keypair.generate();
    await airdropLamports(
      provider.connection,
      authority.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
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
    const session = Keypair.generate();
    await program.methods
      .createSessionKey(
        session.publicKey,
        new BN(Math.floor(Date.now() / 1000) + 3600),
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
        userAccount: userPda,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();
    // Attempt update with a wrong authority
    const wrong = Keypair.generate();
    await airdropLamports(
      provider.connection,
      wrong.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
    );
    try {
      await program.methods
        .updateSessionKey(
          session.publicKey,
          new BN(Math.floor(Date.now() / 1000) + 7200),
          null
        )
        .accountsStrict({ userAccount: userPda, authority: wrong.publicKey })
        .signers([wrong])
        .rpc();
      assert.fail("expected has_one/authority constraint failure");
    } catch (e) {
      // Anchor typically returns ConstraintHasOne or a seeds/bump mismatch
      assert(
        e.toString().includes("has one") ||
          e.toString().includes("has_one") ||
          e.toString().includes("ConstraintHasOne") ||
          e.toString().includes("ConstraintSeeds") ||
          e.toString().includes("A seeds constraint was violated")
      );
    }
  });

  it("updates both expiry and permissions in one call", async () => {
    const authority = Keypair.generate();
    await airdropLamports(
      provider.connection,
      authority.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
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
          maxTransferAmount: new BN(100_000_000),
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

    const newExp = new BN(Math.floor(Date.now() / 1000) + 3600);
    const newPerms = {
      canTransfer: true,
      canDelegate: true,
      canExecuteCustom: true,
      maxTransferAmount: new BN(500_000_000),
      customFlags: 1,
    };
    await program.methods
      .updateSessionKey(session.publicKey, newExp, newPerms)
      .accountsStrict({ userAccount: userPda, authority: authority.publicKey })
      .signers([authority])
      .rpc();

    const acct = await program.account.userAccount.fetch(userPda);
    const entry = acct.sessionKeys.find(
      (k: any) => k.pubkey.toBase58() === session.publicKey.toBase58()
    );
    assert.equal(entry.expiresAt.toNumber(), newExp.toNumber());
    assert.equal(entry.permissions.canDelegate, true);
    assert.equal(entry.permissions.canExecuteCustom, true);
    assert.equal(entry.permissions.customFlags, 1);
  });
});
