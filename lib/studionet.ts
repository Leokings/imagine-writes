import {isAddress, type EIP1193Provider} from "viem";


export const STUDIONET_CHAIN_ID = 61_999;
export const STUDIONET_CHAIN_ID_HEX = `0x${STUDIONET_CHAIN_ID.toString(16)}`;
export const STUDIONET_RPC_URL = "https://studio.genlayer.com/api";
export const STUDIONET_EXPLORER_URL = "https://explorer-studio.genlayer.com";

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

export type ConnectedWallet = {
  address: `0x${string}`;
  provider: EIP1193Provider;
};

function errorCode(cause: unknown): number | undefined {
  if (cause === null || typeof cause !== "object") return undefined;
  const candidate = cause as {code?: unknown; cause?: unknown};
  if (typeof candidate.code === "number") return candidate.code;
  return errorCode(candidate.cause);
}

async function currentChainId(provider: EIP1193Provider): Promise<number> {
  const raw = await provider.request({method: "eth_chainId"});
  const parsed = typeof raw === "string" ? Number(BigInt(raw)) : Number(raw);
  if (!Number.isSafeInteger(parsed)) throw new Error("Wallet returned an invalid chain ID");
  return parsed;
}

async function selectStudionet(provider: EIP1193Provider): Promise<void> {
  if ((await currentChainId(provider)) === STUDIONET_CHAIN_ID) return;
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{chainId: STUDIONET_CHAIN_ID_HEX}],
    });
  } catch (cause) {
    const code = errorCode(cause);
    if (code === -32_002) {
      throw new Error("A wallet network request is already waiting for approval.");
    }
    if (code !== 4_902) throw cause;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: STUDIONET_CHAIN_ID_HEX,
          chainName: "GenLayer Studionet",
          nativeCurrency: {name: "GEN", symbol: "GEN", decimals: 18},
          rpcUrls: [STUDIONET_RPC_URL],
          blockExplorerUrls: [STUDIONET_EXPLORER_URL],
        },
      ],
    });
  }
  if ((await currentChainId(provider)) !== STUDIONET_CHAIN_ID) {
    throw new Error(`Wallet did not switch to Studionet ${STUDIONET_CHAIN_ID}`);
  }
}

export async function connectWallet(): Promise<ConnectedWallet> {
  const provider = window.ethereum;
  if (!provider) {
    throw new Error("No injected EVM wallet found. Install MetaMask or another browser wallet.");
  }
  const accounts = await provider.request({method: "eth_requestAccounts"});
  if (!Array.isArray(accounts) || typeof accounts[0] !== "string" || !isAddress(accounts[0])) {
    throw new Error("The wallet did not return an account");
  }
  await selectStudionet(provider);
  return {address: accounts[0] as `0x${string}`, provider};
}
