import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Time } from "../target/types/time";
import { assert } from "chai";
import { Keypair, SystemProgram } from "@solana/web3.js";

describe("Time-bound Session Keys", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Time as Program<Time>;
  const authority = provider.wallet;

  // Test accounts
  let userAccountPDA: anchor.web3.PublicKey;
  let userAccountBump: number;
  let sessionKey1: Keypair;
  let sessionKey2: Keypair;
  let sessionKey3: Keypair;

  before(async () => {
    // Derive the user account PDA
    [userAccountPDA, userAccountBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from("user_account"), authority.publicKey.toBuffer()],
        program.programId
      );

    // Generate session keys
    sessionKey1 = Keypair.generate();
    sessionKey2 = Keypair.generate();
    sessionKey3 = Keypair.generate();
  });

  describe("User Account Initialization", () => {
    it("Should initialize a user account", async () => {
      const tx = await program.methods
        .initializeUserAccount()
        .accountsStrict({
          userAccount: userAccountPDA,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("Initialize user account tx:", tx);

      // Fetch and verify the account
      const userAccount = await program.account.userAccount.fetch(
        userAccountPDA
      );
      assert.equal(
        userAccount.authority.toBase58(),
        authority.publicKey.toBase58()
      );
      assert.equal(userAccount.sessionKeys.length, 0);
      assert.equal(userAccount.bump, userAccountBump);
    });

    it("Should fail to reinitialize an existing user account", async () => {
      try {
        await program.methods
          .initializeUserAccount()
          .accountsStrict({
            userAccount: userAccountPDA,
            authority: authority.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        assert.fail("Should have thrown an error");
      } catch (error) {
        // Expected error - account already initialized
      }
    });
  });

  describe("Session Key Creation", () => {
    it("Should create a session key with full permissions", async () => {
      const expiresAt = new anchor.BN(Math.floor(Date.now() / 1000) + 3600); // 1 hour from now
      const permissions = {
        canTransfer: true,
        canDelegate: true,
        canExecuteCustom: true,
        maxTransferAmount: new anchor.BN(1000000000), // 1 SOL
        customFlags: 0,
      };

      const tx = await program.methods
        .createSessionKey(
          sessionKey1.publicKey,
          expiresAt,
          { time: {} }, // Time-based expiration
          permissions
        )
        .accountsStrict({
          userAccount: userAccountPDA,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("Create session key tx:", tx);

      // Verify the session key was added
      const userAccount = await program.account.userAccount.fetch(
        userAccountPDA
      );
      assert.equal(userAccount.sessionKeys.length, 1);

      const createdKey = userAccount.sessionKeys[0];
      assert.equal(
        createdKey.pubkey.toBase58(),
        sessionKey1.publicKey.toBase58()
      );
      assert.equal(createdKey.expiresAt.toNumber(), expiresAt.toNumber());
      assert.equal(createdKey.isRevoked, false);
      assert.equal(createdKey.permissions.canTransfer, true);
      assert.equal(createdKey.permissions.canDelegate, true);
      assert.equal(createdKey.permissions.canExecuteCustom, true);
    });

    it("Should create a session key with block height expiration", async () => {
      // Get current slot and add 400 blocks (~3 minutes)
      const currentSlot = await provider.connection.getSlot();
      const expiresAt = new anchor.BN(currentSlot + 400);
      const permissions = {
        canTransfer: true,
        canDelegate: false,
        canExecuteCustom: false,
        maxTransferAmount: new anchor.BN(100000000), // 0.1 SOL
        customFlags: 0,
      };

      const tx = await program.methods
        .createSessionKey(
          sessionKey2.publicKey,
          expiresAt,
          { blockHeight: {} }, // Block height-based expiration
          permissions
        )
        .accountsStrict({
          userAccount: userAccountPDA,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("Create session key with block height tx:", tx);

      // Verify the session key was added
      const userAccount = await program.account.userAccount.fetch(
        userAccountPDA
      );
      assert.equal(userAccount.sessionKeys.length, 2);
      const key = userAccount.sessionKeys[1];
      assert.equal(key.pubkey.toBase58(), sessionKey2.publicKey.toBase58());
      assert.deepEqual(key.expirationType, { blockHeight: {} });
    });

    it("Should create a third session key with limited permissions", async () => {
      const expiresAt = new anchor.BN(Math.floor(Date.now() / 1000) + 7200); // 2 hours from now
      const permissions = {
        canTransfer: true,
        canDelegate: false,
        canExecuteCustom: false,
        maxTransferAmount: new anchor.BN(100000000), // 0.1 SOL
        customFlags: 0,
      };

      await program.methods
        .createSessionKey(
          sessionKey3.publicKey,
          expiresAt,
          { time: {} },
          permissions
        )
        .accountsStrict({
          userAccount: userAccountPDA,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const userAccount = await program.account.userAccount.fetch(
        userAccountPDA
      );
      assert.equal(userAccount.sessionKeys.length, 3); // Now we have 3: time-based, block-based, and this limited one
    });

    it("Should fail to create a session key with past expiry", async () => {
      const expiresAt = new anchor.BN(Math.floor(Date.now() / 1000) - 3600); // 1 hour ago
      const permissions = {
        canTransfer: true,
        canDelegate: false,
        canExecuteCustom: false,
        maxTransferAmount: new anchor.BN(0),
        customFlags: 0,
      };

      try {
        await program.methods
          .createSessionKey(
            sessionKey3.publicKey,
            expiresAt,
            { time: {} },
            permissions
          )
          .accountsStrict({
            userAccount: userAccountPDA,
            authority: authority.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        assert.fail("Should have thrown an error");
      } catch (error) {
        assert.include(error.toString(), "InvalidExpiry");
      }
    });

    it("Should fail to create a duplicate session key", async () => {
      const expiresAt = new anchor.BN(Math.floor(Date.now() / 1000) + 3600);
      const permissions = {
        canTransfer: true,
        canDelegate: false,
        canExecuteCustom: false,
        maxTransferAmount: new anchor.BN(0),
        customFlags: 0,
      };

      try {
        await program.methods
          .createSessionKey(
            sessionKey1.publicKey,
            expiresAt,
            { time: {} },
            permissions
          )
          .accountsStrict({
            userAccount: userAccountPDA,
            authority: authority.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        assert.fail("Should have thrown an error");
      } catch (error) {
        assert.include(error.toString(), "SessionKeyAlreadyExists");
      }
    });
  });

  describe("Session Key Update", () => {
    it("Should update session key expiry", async () => {
      const newExpiresAt = new anchor.BN(Math.floor(Date.now() / 1000) + 10800); // 3 hours from now

      await program.methods
        .updateSessionKey(sessionKey1.publicKey, newExpiresAt, null)
        .accountsStrict({
          userAccount: userAccountPDA,
          authority: authority.publicKey,
        })
        .rpc();

      const userAccount = await program.account.userAccount.fetch(
        userAccountPDA
      );
      const updatedKey = userAccount.sessionKeys.find(
        (k) => k.pubkey.toBase58() === sessionKey1.publicKey.toBase58()
      );
      assert.equal(updatedKey.expiresAt.toNumber(), newExpiresAt.toNumber());
    });

    it("Should update session key permissions", async () => {
      const newPermissions = {
        canTransfer: false,
        canDelegate: false,
        canExecuteCustom: true,
        maxTransferAmount: new anchor.BN(500000000), // 0.5 SOL
        customFlags: 1,
      };

      await program.methods
        .updateSessionKey(sessionKey1.publicKey, null, newPermissions)
        .accountsStrict({
          userAccount: userAccountPDA,
          authority: authority.publicKey,
        })
        .rpc();

      const userAccount = await program.account.userAccount.fetch(
        userAccountPDA
      );
      const updatedKey = userAccount.sessionKeys.find(
        (k) => k.pubkey.toBase58() === sessionKey1.publicKey.toBase58()
      );
      assert.equal(updatedKey.permissions.canTransfer, false);
      assert.equal(updatedKey.permissions.canExecuteCustom, true);
      assert.equal(updatedKey.permissions.customFlags, 1);
    });

    it("Should fail to update non-existent session key", async () => {
      const newExpiresAt = new anchor.BN(Math.floor(Date.now() / 1000) + 3600);
      const nonExistentKey = Keypair.generate(); // Create a key that was never registered

      try {
        await program.methods
          .updateSessionKey(nonExistentKey.publicKey, newExpiresAt, null)
          .accountsStrict({
            userAccount: userAccountPDA,
            authority: authority.publicKey,
          })
          .rpc();
        assert.fail("Should have thrown an error");
      } catch (error) {
        assert.include(error.toString(), "SessionKeyNotFound");
      }
    });
  });

  describe("Session Key Execution", () => {
    it("Should execute action with valid time-based session key", async () => {
      // Fund the session key account so it can pay for transactions
      const airdropTx = await provider.connection.requestAirdrop(
        sessionKey3.publicKey,
        anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdropTx);

      // Execute a transfer action with time-based key
      const action = {
        transfer: {
          recipient: Keypair.generate().publicKey,
          amount: new anchor.BN(50000000), // 0.05 SOL
        },
      };

      await program.methods
        .executeWithSessionKey(action)
        .accountsStrict({
          userAccount: userAccountPDA,
          sessionSigner: sessionKey3.publicKey,
        })
        .signers([sessionKey3])
        .rpc();

      // Transaction should succeed
      assert(true, "Time-based session key execution successful");
    });

    it("Should execute action with valid block-height session key", async () => {
      // Fund the session key account so it can pay for transactions
      const airdropTx = await provider.connection.requestAirdrop(
        sessionKey2.publicKey,
        anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdropTx);

      // Execute a transfer action with block-height key
      const action = {
        transfer: {
          recipient: Keypair.generate().publicKey,
          amount: new anchor.BN(100000000), // 0.1 SOL
        },
      };

      await program.methods
        .executeWithSessionKey(action)
        .accountsStrict({
          userAccount: userAccountPDA,
          sessionSigner: sessionKey2.publicKey,
        })
        .signers([sessionKey2])
        .rpc();

      // Transaction should succeed
      assert(true, "Block-height session key execution successful");
    });

    it("Should fail to execute with insufficient permissions", async () => {
      const action = {
        delegate: {
          newSessionKey: Keypair.generate().publicKey,
          permissions: {
            canTransfer: false,
            canDelegate: false,
            canExecuteCustom: false,
            maxTransferAmount: new anchor.BN(0),
            customFlags: 0,
          },
        },
      };

      try {
        await program.methods
          .executeWithSessionKey(action)
          .accountsStrict({
            userAccount: userAccountPDA,
            sessionSigner: sessionKey2.publicKey,
          })
          .signers([sessionKey2])
          .rpc();
        assert.fail("Should have thrown an error");
      } catch (error) {
        assert.include(error.toString(), "InsufficientPermissions");
      }
    });

    it("Should fail to execute with expired block-height session key", async () => {
      // Create a session key that expires at the current block height (immediately)
      const expiredBlockKey = Keypair.generate();
      const currentSlot = await provider.connection.getSlot();
      const expiresAt = new anchor.BN(currentSlot + 1); // Expires after just 1 block
      
      const permissions = {
        canTransfer: true,
        canDelegate: false,
        canExecuteCustom: false,
        maxTransferAmount: new anchor.BN(100000000), // 0.1 SOL
        customFlags: 0,
      };

      await program.methods
        .createSessionKey(
          expiredBlockKey.publicKey,
          expiresAt,
          { blockHeight: {} }, // Block height-based expiration
          permissions
        )
        .accountsStrict({
          userAccount: userAccountPDA,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // Fund the key
      const airdropTx = await provider.connection.requestAirdrop(
        expiredBlockKey.publicKey,
        anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdropTx);

      // Wait for a few blocks to pass
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Try to execute with the expired key
      const action = {
        transfer: {
          recipient: Keypair.generate().publicKey,
          amount: new anchor.BN(50000000), // 0.05 SOL
        },
      };

      try {
        await program.methods
          .executeWithSessionKey(action)
          .accountsStrict({
            userAccount: userAccountPDA,
            sessionSigner: expiredBlockKey.publicKey,
          })
          .signers([expiredBlockKey])
          .rpc();
        assert.fail("Should have thrown an error");
      } catch (error) {
        assert.include(error.toString(), "SessionKeyExpired");
      }
    });
  });

  describe("Session Key Revocation", () => {
    it("Should revoke a specific session key", async () => {
      await program.methods
        .revokeSessionKey(sessionKey1.publicKey)
        .accountsStrict({
          userAccount: userAccountPDA,
          authority: authority.publicKey,
        })
        .rpc();

      const userAccount = await program.account.userAccount.fetch(
        userAccountPDA
      );
      const revokedKey = userAccount.sessionKeys.find(
        (k) => k.pubkey.toBase58() === sessionKey1.publicKey.toBase58()
      );
      assert.equal(revokedKey.isRevoked, true);
    });

    it("Should fail to execute with revoked session key", async () => {
      // Fund the revoked session key
      const airdropTx = await provider.connection.requestAirdrop(
        sessionKey1.publicKey,
        anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdropTx);

      const action = {
        custom: {
          programId: SystemProgram.programId,
          data: Buffer.from([]),
        },
      };

      try {
        await program.methods
          .executeWithSessionKey(action)
          .accountsStrict({
            userAccount: userAccountPDA,
            sessionSigner: sessionKey1.publicKey,
          })
          .signers([sessionKey1])
          .rpc();
        assert.fail("Should have thrown an error");
      } catch (error) {
        assert.include(error.toString(), "SessionKeyRevoked");
      }
    });

    it("Should fail to revoke already revoked key", async () => {
      try {
        await program.methods
          .revokeSessionKey(sessionKey1.publicKey)
          .accountsStrict({
            userAccount: userAccountPDA,
            authority: authority.publicKey,
          })
          .rpc();
        assert.fail("Should have thrown an error");
      } catch (error) {
        assert.include(error.toString(), "SessionKeyAlreadyRevoked");
      }
    });

    it("Should revoke all session keys", async () => {
      await program.methods
        .revokeAllSessionKeys()
        .accountsStrict({
          userAccount: userAccountPDA,
          authority: authority.publicKey,
        })
        .rpc();

      const userAccount = await program.account.userAccount.fetch(
        userAccountPDA
      );
      userAccount.sessionKeys.forEach((key) => {
        assert.equal(key.isRevoked, true);
      });
    });
  });

  describe("Session Key Cleanup", () => {
    it("Should create new session keys for cleanup test", async () => {
      // Create a new session key that will expire soon
      const shortExpiryKey = Keypair.generate();
      const expiresAt = new anchor.BN(Math.floor(Date.now() / 1000) + 2); // 2 seconds from now
      const permissions = {
        canTransfer: true,
        canDelegate: false,
        canExecuteCustom: false,
        maxTransferAmount: new anchor.BN(0),
        customFlags: 0,
      };

      await program.methods
        .createSessionKey(
          shortExpiryKey.publicKey,
          expiresAt,
          { time: {} },
          permissions
        )
        .accountsStrict({
          userAccount: userAccountPDA,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // Wait for the key to expire
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Now cleanup
      await program.methods
        .cleanupSessionKeys()
        .accountsStrict({
          userAccount: userAccountPDA,
          authority: authority.publicKey,
        })
        .rpc();

      const userAccount = await program.account.userAccount.fetch(
        userAccountPDA
      );

      // Should have removed the expired key and all revoked keys
      const hasExpiredKey = userAccount.sessionKeys.some(
        (k) => k.pubkey.toBase58() === shortExpiryKey.publicKey.toBase58()
      );
      assert.equal(hasExpiredKey, false, "Expired key should be removed");

      // All remaining keys should be revoked (from the previous test)
      const hasRevokedKeys = userAccount.sessionKeys.some((k) => k.isRevoked);
      assert.equal(hasRevokedKeys, false, "Revoked keys should be removed");
    });
  });
});
