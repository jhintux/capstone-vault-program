import { web3 } from "@coral-xyz/anchor";

export const DEFAULT_COMMITMENT: web3.Commitment = "confirmed";
export const DEFAULT_RPC =
  process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";
export const PROGRAM_ID_STR =
  process.env.NEXT_PUBLIC_PROGRAM_ID ||
  "HdeZQYeeWuyrdmVmmyM1u4iUq6iNhhYTY73oNZjzqJLX";
