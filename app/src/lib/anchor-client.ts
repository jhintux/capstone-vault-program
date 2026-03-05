import {
  AnchorProvider,
  BN,
  Idl,
  Program,
  setProvider,
} from "@coral-xyz/anchor";
import * as anchor from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import idl from "@/idl/capstone_vault_program.json";

export function getProvider(connection: Connection, wallet: anchor.Wallet) {
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  setProvider(provider);
  return provider;
}

export function getProgram<T extends Idl>(connection: Connection, wallet: anchor.Wallet): Program<T> {
  const provider = getProvider(connection, wallet);
  return new Program(idl as T, provider);
}

export { BN, anchor };
export type { Idl };
