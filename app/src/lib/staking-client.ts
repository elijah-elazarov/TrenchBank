import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";

export class StakingClient {
  private connection: Connection;
  private programId: PublicKey;
  private stakingMint: PublicKey;
  private rewardMint: PublicKey;

  constructor(
    connection: Connection,
    programId: PublicKey,
    stakingMint: PublicKey,
    rewardMint: PublicKey
  ) {
    this.connection = connection;
    this.programId = programId;
    this.stakingMint = stakingMint;
    this.rewardMint = rewardMint;
  }

  getPoolPDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("pool"), this.stakingMint.toBuffer()],
      this.programId
    );
  }

  getPoolVaultPDA(poolPDA: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("pool_vault"), poolPDA.toBuffer()],
      this.programId
    );
  }

  getRewardVaultPDA(poolPDA: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("reward_vault"), poolPDA.toBuffer()],
      this.programId
    );
  }

  getUserStakePDA(poolPDA: PublicKey, userPubkey: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("user_stake"), poolPDA.toBuffer(), userPubkey.toBuffer()],
      this.programId
    );
  }

  async getUserTokenBalance(userPubkey: PublicKey): Promise<number> {
    try {
      const ata = await getAssociatedTokenAddress(this.stakingMint, userPubkey);
      const account = await getAccount(this.connection, ata);
      return Number(account.amount);
    } catch {
      return 0;
    }
  }

  async buildStakeInstruction(
    userPubkey: PublicKey,
    amount: BN
  ): Promise<TransactionInstruction[]> {
    const [poolPDA] = this.getPoolPDA();
    const [poolVaultPDA] = this.getPoolVaultPDA(poolPDA);
    const [userStakePDA] = this.getUserStakePDA(poolPDA, userPubkey);
    const userTokenAccount = await getAssociatedTokenAddress(
      this.stakingMint,
      userPubkey
    );

    const data = Buffer.alloc(16);
    data.writeUInt8(1, 0);
    amount.toArrayLike(Buffer, "le", 8).copy(data, 8);

    return [
      new TransactionInstruction({
        programId: this.programId,
        keys: [
          { pubkey: userPubkey, isSigner: true, isWritable: true },
          { pubkey: poolPDA, isSigner: false, isWritable: true },
          { pubkey: userStakePDA, isSigner: false, isWritable: true },
          { pubkey: userTokenAccount, isSigner: false, isWritable: true },
          { pubkey: poolVaultPDA, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        data,
      }),
    ];
  }

  async buildTransaction(
    instructions: TransactionInstruction[],
    feePayer: PublicKey
  ): Promise<Transaction> {
    const tx = new Transaction();
    tx.add(...instructions);
    tx.feePayer = feePayer;
    tx.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
    return tx;
  }

  formatTokenAmount(amount: number, decimals: number = 6): string {
    return (amount / Math.pow(10, decimals)).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });
  }
}

export function createStakingClient(
  rpcUrl: string,
  programId: string,
  stakingMint: string,
  rewardMint: string
): StakingClient | null {
  try {
    const connection = new Connection(rpcUrl, "confirmed");
    return new StakingClient(
      connection,
      new PublicKey(programId),
      new PublicKey(stakingMint),
      new PublicKey(rewardMint)
    );
  } catch {
    return null;
  }
}
