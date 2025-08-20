import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { Time } from "../target/types/time";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  Connection,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

/**
 * Expiration type for session keys
 */
export enum ExpirationType {
  Time = "time",
  BlockHeight = "blockHeight",
}

/**
 * SessionKeySDK - A TypeScript SDK for interacting with the Time-bound Session Keys program
 *
 * This SDK provides high-level functions for managing session keys on Solana,
 * showcasing the power of account abstraction and delegated authority.
 */
export class SessionKeySDK {
  private program: Program<Time>;
  private provider: AnchorProvider;

  constructor(program: Program<Time>, provider: AnchorProvider) {
    this.program = program;
    this.provider = provider;
  }

  // ===== SPL TOKEN HELPERS =====
  async splApproveDelegate(
    authority: PublicKey,
    tokenAccount: PublicKey,
    mint: PublicKey,
    amount: BN
  ): Promise<string> {
    const [userAccountPDA] = await this.getUserAccountPDA(authority);
    const [delegateAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("delegate"), userAccountPDA.toBuffer(), mint.toBuffer()],
      this.program.programId
    );

    return this.program.methods
      .splApproveDelegate(amount)
      .accountsStrict({
        userAccount: userAccountPDA,
        authority,
        tokenAccount,
        mint,
        delegateAuthority,
        tokenProgram: new PublicKey(
          "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        ),
      })
      .rpc();
  }

  async splDelegatedTransfer(
    authority: PublicKey,
    sessionKeySigner: Keypair,
    fromToken: PublicKey,
    toToken: PublicKey,
    mint: PublicKey,
    amount: BN
  ): Promise<string> {
    const [userAccountPDA] = await this.getUserAccountPDA(authority);
    const [delegateAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("delegate"), userAccountPDA.toBuffer(), mint.toBuffer()],
      this.program.programId
    );

    const instructions = await this.program.methods
      .splDelegatedTransfer(amount)
      .accountsStrict({
        sessionSigner: sessionKeySigner.publicKey,
        userAccount: userAccountPDA,
        fromToken,
        toToken,
        mint,
        delegateAuthority,
        tokenProgram: new PublicKey(
          "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        ),
      })
      .signers([sessionKeySigner])
      .instruction();
    const connection = new Connection("http://localhost:8899", {
      commitment: "confirmed",
    });
    const tx = new Transaction().add(instructions);
    const sig = await connection.sendTransaction(tx, [sessionKeySigner]);
    console.log("sig", sig);
    await connection.confirmTransaction(sig, "confirmed");
    return sig;
  }

  // Build-only variant to avoid implicit provider signing; use with sendAndConfirmTransaction
  async buildSplDelegatedTransferIx(
    authority: PublicKey,
    sessionKeyPubkey: PublicKey,
    fromToken: PublicKey,
    toToken: PublicKey,
    mint: PublicKey,
    amount: BN
  ): Promise<TransactionInstruction> {
    const [userAccountPDA] = await this.getUserAccountPDA(authority);
    const [delegateAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("delegate"), userAccountPDA.toBuffer(), mint.toBuffer()],
      this.program.programId
    );
    return this.program.methods
      .splDelegatedTransfer(amount)
      .accountsStrict({
        sessionSigner: sessionKeyPubkey,
        userAccount: userAccountPDA,
        fromToken,
        toToken,
        mint,
        delegateAuthority,
        tokenProgram: new PublicKey(
          "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        ),
      })
      .instruction();
  }

  // Send a transaction using only the session key as fee payer/signer
  async sendWithSessionKey(
    sessionKey: Keypair,
    instructions: TransactionInstruction[]
  ): Promise<string> {
    const tx = new Transaction();
    tx.add(...instructions);
    const { blockhash, lastValidBlockHeight } =
      await this.provider.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = sessionKey.publicKey;
    tx.sign(sessionKey);
    return sendAndConfirmTransaction(
      this.provider.connection,
      tx,
      [sessionKey],
      {
        commitment: "confirmed",
        minContextSlot: undefined,
        skipPreflight: false,
      }
    );
  }

  async splRevokeDelegate(
    authority: PublicKey,
    tokenAccount: PublicKey
  ): Promise<string> {
    const [userAccountPDA] = await this.getUserAccountPDA(authority);

    return this.program.methods
      .splRevokeDelegate()
      .accountsStrict({
        userAccount: userAccountPDA,
        authority,
        tokenAccount,
        tokenProgram: new PublicKey(
          "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        ),
      })
      .rpc();
  }

  async updateAllowedMints(
    authority: PublicKey,
    mints: PublicKey[]
  ): Promise<string> {
    const [userAccountPDA] = await this.getUserAccountPDA(authority);
    return this.program.methods
      .updateAllowedMints(mints)
      .accountsStrict({
        userAccount: userAccountPDA,
        authority,
      })
      .rpc();
  }

  /**
   * Initialize the SDK with a connection and program ID
   */
  static async init(
    connection: Connection,
    programId: PublicKey,
    wallet?: anchor.Wallet
  ): Promise<SessionKeySDK> {
    const provider = new AnchorProvider(
      connection,
      wallet || new anchor.Wallet(Keypair.generate()),
      { commitment: "confirmed" }
    );

    const idl = await Program.fetchIdl(programId, provider);
    if (!idl) throw new Error("IDL not found");

    const program = new Program(idl as Time, provider) as Program<Time>;
    return new SessionKeySDK(program, provider);
  }

  /**
   * Derive the user account PDA for a given authority
   */
  async getUserAccountPDA(authority: PublicKey): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddress(
      [Buffer.from("user_account"), authority.toBuffer()],
      this.program.programId
    );
  }

  /**
   * Initialize a user account for managing session keys
   */
  async initializeUserAccount(authority: PublicKey): Promise<string> {
    const [userAccountPDA] = await this.getUserAccountPDA(authority);
    console.log("User account PDA:", userAccountPDA.toBase58());
    const tx = await this.program.methods
      .initializeUserAccount()
      .accountsStrict({
        userAccount: userAccountPDA,
        authority: authority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log("Initialize user account tx:", tx);

    return tx;
  }

  async initializeUserAccountWithConfig(
    authority: PublicKey,
    allowedMints: PublicKey[],
    initialDepositLamports: BN
  ): Promise<string> {
    const [userAccountPDA] = await this.getUserAccountPDA(authority);
    return this.program.methods
      .initializeUserAccountWithConfig(allowedMints, initialDepositLamports)
      .accountsStrict({
        userAccount: userAccountPDA,
        authority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  /**
   * Create a new session key with specified permissions
   */
  async createSessionKey({
    authority,
    sessionKeyPubkey,
    durationSeconds,
    permissions,
  }: {
    authority: Keypair;
    sessionKeyPubkey: PublicKey;
    durationSeconds: number;
    permissions: SessionPermissions;
  }): Promise<string> {
    const [userAccountPDA] = await this.getUserAccountPDA(authority.publicKey);
    const expiresAt = new BN(Math.floor(Date.now() / 1000) + durationSeconds);

    const ix = await this.program.methods
      .createSessionKey(
        sessionKeyPubkey,
        expiresAt,
        { time: {} }, // ExpirationType.Time
        permissions
      )
      .accountsStrict({
        userAccount: userAccountPDA,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    const connection = new Connection("http://localhost:8899", {
      commitment: "confirmed",
    });
    const tx = new Transaction().add(ix);
    const sig = await connection.sendTransaction(tx, [authority]);
    console.log("sig", sig);
    await connection.confirmTransaction(sig, "confirmed");
    return sig;
  }

  /**
   * Create a new session key with block height expiration
   */
  async createSessionKeyWithBlockHeight(
    authority: PublicKey,
    sessionKeyPubkey: PublicKey,
    blocksFromNow: number,
    permissions: SessionPermissions
  ): Promise<string> {
    const [userAccountPDA] = await this.getUserAccountPDA(authority);

    // Get current slot (block height)
    const currentSlot = await this.provider.connection.getSlot();
    const expiresAt = new BN(currentSlot + blocksFromNow);

    const tx = await this.program.methods
      .createSessionKey(
        sessionKeyPubkey,
        expiresAt,
        { blockHeight: {} }, // ExpirationType.BlockHeight
        permissions
      )
      .accountsStrict({
        userAccount: userAccountPDA,
        authority: authority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  }

  /**
   * Create a session key with preset permission templates
   */
  async createSessionKeyWithPreset(
    authority: Keypair,
    sessionKeyPubkey: PublicKey,
    durationSeconds: number,
    preset: PermissionPreset
  ): Promise<string> {
    const permissions = this.getPermissionsFromPreset(preset);
    return this.createSessionKey({
      authority,
      sessionKeyPubkey,
      durationSeconds,
      permissions,
    });
  }

  /**
   * Update an existing session key's expiry or permissions
   */
  async updateSessionKey(
    authority: PublicKey,
    sessionKeyPubkey: PublicKey,
    newExpirySeconds?: number,
    newPermissions?: SessionPermissions
  ): Promise<string> {
    const [userAccountPDA] = await this.getUserAccountPDA(authority);
    const newExpiresAt = newExpirySeconds
      ? new BN(Math.floor(Date.now() / 1000) + newExpirySeconds)
      : null;

    const tx = await this.program.methods
      .updateSessionKey(sessionKeyPubkey, newExpiresAt, newPermissions)
      .accountsStrict({
        userAccount: userAccountPDA,
        authority: authority,
      })
      .rpc();

    return tx;
  }

  /**
   * Revoke a specific session key
   */
  async revokeSessionKey(
    authority: PublicKey,
    sessionKeyPubkey: PublicKey
  ): Promise<string> {
    const [userAccountPDA] = await this.getUserAccountPDA(authority);

    const tx = await this.program.methods
      .revokeSessionKey(sessionKeyPubkey)
      .accountsStrict({
        userAccount: userAccountPDA,
        authority: authority,
      })
      .rpc();

    return tx;
  }

  /**
   * Revoke all session keys for a user (emergency function)
   */
  async revokeAllSessionKeys(authority: PublicKey): Promise<string> {
    const [userAccountPDA] = await this.getUserAccountPDA(authority);

    const tx = await this.program.methods
      .revokeAllSessionKeys()
      .accountsStrict({
        userAccount: userAccountPDA,
        authority: authority,
      })
      .rpc();

    return tx;
  }

  /**
   * Clean up expired and revoked session keys
   */
  async cleanupSessionKeys(authority: PublicKey): Promise<string> {
    const [userAccountPDA] = await this.getUserAccountPDA(authority);

    const tx = await this.program.methods
      .cleanupSessionKeys()
      .accountsStrict({
        userAccount: userAccountPDA,
        authority: authority,
      })
      .rpc();

    return tx;
  }

  /**
   * Get all session keys for a user
   */
  async getSessionKeys(authority: PublicKey): Promise<SessionKeyInfo[]> {
    const [userAccountPDA] = await this.getUserAccountPDA(authority);

    try {
      const userAccount = await this.program.account.userAccount.fetch(
        userAccountPDA
      );
      const currentTime = Math.floor(Date.now() / 1000);

      return userAccount.sessionKeys.map((key) => ({
        pubkey: key.pubkey,
        createdAt: key.createdAt.toNumber(),
        expiresAt: key.expiresAt.toNumber(),
        expirationType: key.expirationType,
        isExpired: this.isKeyExpired(key, currentTime),
        isRevoked: key.isRevoked,
        isActive: !key.isRevoked && !this.isKeyExpired(key, currentTime),
        permissions: key.permissions,
        label: new Uint8Array(key.label),
        remainingTimeSeconds: Math.max(
          0,
          key.expiresAt.toNumber() - currentTime
        ),
      }));
    } catch (error) {
      // Account doesn't exist yet
      return [];
    }
  }

  /**
   * Get active (non-revoked, non-expired) session keys
   */
  async getActiveSessionKeys(authority: PublicKey): Promise<SessionKeyInfo[]> {
    const allKeys = await this.getSessionKeys(authority);
    return allKeys.filter((key) => key.isActive);
  }

  /**
   * Check if a specific session key is valid
   */
  async isSessionKeyValid(
    authority: PublicKey,
    sessionKeyPubkey: PublicKey
  ): Promise<boolean> {
    const keys = await this.getActiveSessionKeys(authority);
    return keys.some((key) => key.pubkey.equals(sessionKeyPubkey));
  }

  /**
   * Create a delegated transaction that can be signed by a session key
   */
  async createDelegatedTransaction(
    authority: PublicKey,
    sessionKeyPubkey: PublicKey,
    instructions: anchor.web3.TransactionInstruction[]
  ): Promise<Transaction> {
    const [userAccountPDA] = await this.getUserAccountPDA(authority);

    // Verify session key is valid
    const isValid = await this.isSessionKeyValid(authority, sessionKeyPubkey);
    if (!isValid) {
      throw new Error("Session key is not valid");
    }

    const tx = new Transaction();
    instructions.forEach((ix) => tx.add(ix));

    const { blockhash } = await this.provider.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = sessionKeyPubkey;

    return tx;
  }

  /**
   * Helper function to get permissions from preset templates
   */
  private getPermissionsFromPreset(
    preset: PermissionPreset
  ): SessionPermissions {
    switch (preset) {
      case PermissionPreset.FULL_ACCESS:
        return {
          canTransfer: true,
          canDelegate: true,
          canExecuteCustom: true,
          maxTransferAmount: new BN(0), // 0 means unlimited
          customFlags: 0,
        };

      case PermissionPreset.TRANSFER_ONLY:
        return {
          canTransfer: true,
          canDelegate: false,
          canExecuteCustom: false,
          maxTransferAmount: new BN(0),
          customFlags: 0,
        };

      case PermissionPreset.LIMITED_TRANSFER:
        return {
          canTransfer: true,
          canDelegate: false,
          canExecuteCustom: false,
          maxTransferAmount: new BN(100_000_000), // 0.1 SOL
          customFlags: 0,
        };

      case PermissionPreset.DELEGATE_ONLY:
        return {
          canTransfer: false,
          canDelegate: true,
          canExecuteCustom: false,
          maxTransferAmount: new BN(0),
          customFlags: 0,
        };

      case PermissionPreset.CUSTOM_ONLY:
        return {
          canTransfer: false,
          canDelegate: false,
          canExecuteCustom: true,
          maxTransferAmount: new BN(0),
          customFlags: 0,
        };

      case PermissionPreset.READ_ONLY:
        return {
          canTransfer: false,
          canDelegate: false,
          canExecuteCustom: false,
          maxTransferAmount: new BN(0),
          customFlags: 0,
        };

      default:
        throw new Error("Invalid permission preset");
    }
  }

  /**
   * Batch create multiple session keys
   */
  async batchCreateSessionKeys(
    authority: Keypair,
    sessionKeys: BatchSessionKeyParams[]
  ): Promise<string[]> {
    const txs: string[] = [];

    for (const params of sessionKeys) {
      const tx = await this.createSessionKey({
        authority,
        sessionKeyPubkey: params.pubkey,
        durationSeconds: params.durationSeconds,
        permissions: params.permissions,
      });
      txs.push(tx);
    }

    return txs;
  }

  /**
   * Monitor session key expiry and send notifications
   */
  async monitorSessionKeyExpiry(
    authority: PublicKey,
    warningThresholdSeconds: number = 3600,
    callback: (key: SessionKeyInfo) => void
  ): Promise<() => void> {
    const checkExpiry = async () => {
      const keys = await this.getActiveSessionKeys(authority);

      keys.forEach((key) => {
        if (key.remainingTimeSeconds <= warningThresholdSeconds) {
          callback(key);
        }
      });
    };

    // Check every minute
    const interval = setInterval(checkExpiry, 60000);

    // Return cleanup function
    return () => clearInterval(interval);
  }

  // Helper method to check if a key is expired
  private isKeyExpired(key: any, currentTime: number): boolean {
    if (key.expirationType?.time !== undefined) {
      return key.expiresAt.toNumber() < currentTime;
    } else if (key.expirationType?.blockHeight !== undefined) {
      // For block height, we'd need to get current slot
      // This is a simplified check - in production, you'd want to fetch current slot
      return false;
    }
    // Default to time-based check for backward compatibility
    return key.expiresAt.toNumber() < currentTime;
  }
}

// Type definitions
export interface SessionPermissions {
  canTransfer: boolean;
  canDelegate: boolean;
  canExecuteCustom: boolean;
  maxTransferAmount: BN;
  customFlags: number;
}

export interface SessionKeyInfo {
  pubkey: PublicKey;
  createdAt: number;
  expiresAt: number;
  expirationType?: { time?: {} } | { blockHeight?: {} }; // Expiration type (Time or BlockHeight)
  isExpired: boolean;
  isRevoked: boolean;
  isActive: boolean;
  permissions: SessionPermissions;
  label: Uint8Array;
  remainingTimeSeconds: number;
}

export interface BatchSessionKeyParams {
  pubkey: PublicKey;
  durationSeconds: number;
  permissions: SessionPermissions;
}

export type SessionAction =
  | { transfer: { recipient: PublicKey; amount: BN } }
  | { delegate: { newSessionKey: PublicKey; permissions: SessionPermissions } }
  | { custom: { programId: PublicKey; data: Buffer } };

export enum PermissionPreset {
  FULL_ACCESS = "FULL_ACCESS",
  TRANSFER_ONLY = "TRANSFER_ONLY",
  LIMITED_TRANSFER = "LIMITED_TRANSFER",
  DELEGATE_ONLY = "DELEGATE_ONLY",
  CUSTOM_ONLY = "CUSTOM_ONLY",
  READ_ONLY = "READ_ONLY",
}

// Export convenience functions
export async function createSessionKeySDK(
  connection: Connection,
  programId: PublicKey,
  wallet?: anchor.Wallet
): Promise<SessionKeySDK> {
  return SessionKeySDK.init(connection, programId, wallet);
}

export function generateSessionKey(): Keypair {
  return Keypair.generate();
}

export function calculateExpiryTimestamp(durationSeconds: number): number {
  return Math.floor(Date.now() / 1000) + durationSeconds;
}
