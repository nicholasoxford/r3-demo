import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SystemProgram, Keypair } from "@solana/web3.js";
import { Time } from "../target/types/time";
import { assert } from "chai";
import { airdropLamports, deriveUserPda } from "./helpers";

describe("User Account Initialization ", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Time as Program<Time>;

  it("initializes a new user account", async () => {
    const authority = Keypair.generate();
    await airdropLamports(
      provider.connection,
      authority.publicKey,
      1 * anchor.web3.LAMPORTS_PER_SOL
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

    const acct = await program.account.userAccount.fetch(userPda);
    assert.equal(acct.authority.toBase58(), authority.publicKey.toBase58());
  });

  it("fails to reinitialize the same PDA", async () => {
    const authority = Keypair.generate();
    await airdropLamports(
      provider.connection,
      authority.publicKey,
      1 * anchor.web3.LAMPORTS_PER_SOL
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

    try {
      await program.methods
        .initializeUserAccount()
        .accountsStrict({
          userAccount: userPda,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();
      assert.fail("expected error");
    } catch (_) {
      assert(true);
    }
  });
});
