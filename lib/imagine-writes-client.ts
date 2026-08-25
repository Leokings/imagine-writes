import {createClient} from "genlayer-js";
import {studionet} from "genlayer-js/chains";
import {
  TransactionHashVariant,
  TransactionStatus,
  type CalldataEncodable,
  type Hash,
} from "genlayer-js/types";

import {
  parseProfile,
  parseWorldDirectory,
  parseWorldState,
  type PlayerProfile,
  type WorldState,
  type WorldSummary,
} from "@/lib/types";
import type {ConnectedWallet} from "@/lib/studionet";
import {inspectReceiptExecution} from "@/lib/transaction";


const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const FALLBACK_CONTRACT_ADDRESS = "0x443845484eb76CF7689B6Ea9a6EC2B8f90d0898C";
const configuredAddress =
  process.env.NEXT_PUBLIC_IMAGINE_WRITES_CONTRACT_ADDRESS?.trim() ||
  FALLBACK_CONTRACT_ADDRESS;

if (!/^0x[0-9a-fA-F]{40}$/.test(configuredAddress)) {
  throw new Error("NEXT_PUBLIC_IMAGINE_WRITES_CONTRACT_ADDRESS is not a valid address");
}

export const IMAGINE_WRITES_CONTRACT_ADDRESS = configuredAddress as `0x${string}`;
export const HAS_DEPLOYMENT = configuredAddress.toLowerCase() !== ZERO_ADDRESS;

export type TransactionUpdate = {
  hash: Hash;
  action: string;
  phase: "submitted" | "finalized" | "failed";
};

export type CreateWorldInput = {
  worldName: string;
  premise: string;
  opening: string;
  characterName: string;
  characterNote: string;
  worldLaws: string[];
  objective: string;
  objectiveCriteria: string[];
  objectiveUnlockScene: number;
  objectiveDeadlineScene: number;
  maxPlayers: number;
  startingInk: number;
  turnWindowSeconds: number;
};

function requireDeployment(): `0x${string}` {
  if (!HAS_DEPLOYMENT) throw new Error("Story Worlds has not been deployed yet");
  return IMAGINE_WRITES_CONTRACT_ADDRESS;
}

async function read(functionName: string, args: CalldataEncodable[] = []) {
  const client = createClient({chain: studionet});
  return client.readContract({
    address: requireDeployment(),
    functionName,
    args,
    transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
  });
}

export async function readWorlds(): Promise<WorldSummary[]> {
  return parseWorldDirectory(await read("get_worlds"));
}

export async function readWorld(worldNameOrKey: string): Promise<WorldState> {
  return parseWorldState(await read("get_world", [worldNameOrKey]));
}

export async function readPlayerWorlds(address: string): Promise<WorldSummary[]> {
  return parseWorldDirectory(await read("get_player_worlds", [address]));
}

export async function readProfile(address: string): Promise<PlayerProfile> {
  return parseProfile(await read("get_profile", [address]));
}

export function createWriter(
  wallet: ConnectedWallet,
  onUpdate?: (update: TransactionUpdate) => void,
) {
  async function write(
    action: string,
    functionName: string,
    args: CalldataEncodable[] = [],
  ): Promise<Hash> {
    const client = createClient({
      chain: studionet,
      account: wallet.address,
      provider: wallet.provider,
    });
    const hash = await client.writeContract({
      address: requireDeployment(),
      functionName,
      args,
      value: 0n,
    });
    onUpdate?.({hash, action, phase: "submitted"});
    const receipt = await client.waitForTransactionReceipt({
      hash,
      status: TransactionStatus.FINALIZED,
      interval: 4_000,
      retries: 75,
    });
    const execution = inspectReceiptExecution(receipt);
    if (execution.outcome === "failure") {
      onUpdate?.({hash, action, phase: "failed"});
      throw new Error(execution.detail || `${action} finalized with a contract execution error`);
    }
    if (execution.outcome === "unknown") {
      onUpdate?.({hash, action, phase: "failed"});
      throw new Error(`${action} finalized, but its contract execution result could not be verified`);
    }
    onUpdate?.({hash, action, phase: "finalized"});
    return hash;
  }

  return {
    createWorld: (values: CreateWorldInput) =>
      write("Binding your Story World", "create_world", [
        values.worldName,
        values.premise,
        values.opening,
        values.characterName,
        values.characterNote,
        JSON.stringify(values.worldLaws),
        values.objective,
        JSON.stringify(values.objectiveCriteria),
        BigInt(values.objectiveUnlockScene),
        BigInt(values.objectiveDeadlineScene),
        BigInt(values.maxPlayers),
        BigInt(values.startingInk),
        BigInt(values.turnWindowSeconds),
      ]),
    joinWorld: (worldNameOrKey: string, characterName: string, characterNote: string) =>
      write("Entering the Story World", "join_world", [
        worldNameOrKey,
        characterName,
        characterNote,
      ]),
    startWorld: (worldNameOrKey: string) =>
      write("Asking validators to set the first challenge", "start_world", [worldNameOrKey]),
    submitPassage: (worldNameOrKey: string, passage: string) =>
      write("Letting validators judge the passage", "submit_passage", [
        worldNameOrKey,
        passage,
      ]),
    claimQuill: (worldNameOrKey: string) =>
      write("Passing the expired quill", "claim_quill", [worldNameOrKey]),
    forfeitWorld: (worldNameOrKey: string) =>
      write("Setting down your quill", "forfeit_world", [worldNameOrKey]),
    cancelWorld: (worldNameOrKey: string) =>
      write("Closing the unstarted world", "cancel_world", [worldNameOrKey]),
  };
}
