"use client";

import {useEffect, useState} from "react";

import {Chronicle} from "@/components/Chronicle";
import {CreateWorldForm} from "@/components/CreateWorldForm";
import {WorldAtlas} from "@/components/WorldAtlas";
import {WorldBook} from "@/components/WorldBook";
import {
  HAS_DEPLOYMENT,
  IMAGINE_WRITES_CONTRACT_ADDRESS,
  createWriter,
  readPlayerWorlds,
  readProfile,
  readWorld,
  readWorlds,
  type CreateWorldInput,
  type TransactionUpdate,
} from "@/lib/imagine-writes-client";
import {
  connectWallet,
  STUDIONET_CHAIN_ID,
  STUDIONET_EXPLORER_URL,
  type ConnectedWallet,
} from "@/lib/studionet";
import {shortAddress, type PlayerProfile, type WorldState, type WorldSummary} from "@/lib/types";


type Screen = "atlas" | "create" | "world" | "mine";

const ERROR_COPY: Record<string, string> = {
  world_name_taken: "That Story World name already exists. Give this world a name of its own.",
  world_not_found: "No Story World was found under that name.",
  world_not_waiting: "This world has already begun, so new characters cannot enter.",
  world_is_full: "Every character seat in this world is already filled.",
  already_joined: "This wallet has already entered the world.",
  character_name_taken: "Another writer already gave their character that name.",
  not_your_turn: "The quill belongs to another writer right now.",
  not_world_writer: "This wallet has not entered the Story World.",
  world_not_active: "This world is not accepting turns right now.",
  writer_eliminated: "This character's writing fate has already been sealed.",
  active_writer_cannot_claim: "The timed-out writer cannot advance their own quill.",
  turn_window_active: "The Quill Clock is still running. This scene cannot pass onward yet.",
  only_creator_can_start: "Only the world's creator can awaken Scene One.",
  only_creator_can_cancel: "Only the world's creator can close it.",
  not_enough_writers: "At least two characters must enter before Scene One can begin.",
};

function errorMessage(cause: unknown): string {
  const raw = cause instanceof Error ? cause.message : String(cause);
  const normalized = raw.toLowerCase();
  for (const [code, copy] of Object.entries(ERROR_COPY)) {
    if (normalized.includes(code)) return copy;
  }
  if (normalized.includes("user rejected") || normalized.includes("user denied")) {
    return "The wallet request was cancelled.";
  }
  if (normalized.includes("no injected evm wallet")) return raw;
  if (normalized.includes("llm_error")) {
    return "Validators could not reach a usable story decision. Nothing changed—please try again.";
  }
  return raw.replace("[EXPECTED]", "").trim();
}

export function ImagineWritesApp() {
  const [screen, setScreen] = useState<Screen>("atlas");
  const [wallet, setWallet] = useState<ConnectedWallet | null>(null);
  const [worlds, setWorlds] = useState<WorldSummary[]>([]);
  const [myWorlds, setMyWorlds] = useState<WorldSummary[]>([]);
  const [world, setWorld] = useState<WorldState | null>(null);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [transaction, setTransaction] = useState<TransactionUpdate | null>(null);
  const [atlasLoading, setAtlasLoading] = useState(HAS_DEPLOYMENT);

  useEffect(() => {
    if (!HAS_DEPLOYMENT) return;
    let cancelled = false;
    readWorlds()
      .then((nextWorlds) => {
        if (!cancelled) setWorlds(nextWorlds);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(errorMessage(cause));
      })
      .finally(() => {
        if (!cancelled) setAtlasLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!wallet) return;
    const provider = wallet.provider;
    let cancelled = false;

    function disconnect(message: string) {
      if (cancelled) return;
      setWallet(null);
      setMyWorlds([]);
      setProfile(null);
      setTransaction(null);
      setBusy("");
      setError(message);
    }

    function handleAccountsChanged(accounts: `0x${string}`[]) {
      const address = accounts[0];
      if (!address) {
        disconnect("The wallet disconnected. Connect it again to keep writing.");
        return;
      }
      const nextWallet: ConnectedWallet = {address, provider};
      setWallet(nextWallet);
      setError("");
      void Promise.all([readPlayerWorlds(address), readProfile(address)])
        .then(([nextWorlds, nextProfile]) => {
          if (cancelled) return;
          setMyWorlds(nextWorlds);
          setProfile(nextProfile);
        })
        .catch((cause: unknown) => {
          if (!cancelled) setError(errorMessage(cause));
        });
    }

    function handleChainChanged(chainId: string) {
      try {
        if (Number(BigInt(chainId)) === STUDIONET_CHAIN_ID) return;
      } catch {
        // An invalid chain ID is treated as leaving Studionet.
      }
      disconnect("The wallet switched away from GenLayer Studionet. Connect again to return.");
    }

    function handleDisconnect() {
      disconnect("The wallet disconnected. Connect it again to keep writing.");
    }

    provider.on("accountsChanged", handleAccountsChanged);
    provider.on("chainChanged", handleChainChanged);
    provider.on("disconnect", handleDisconnect);
    return () => {
      cancelled = true;
      provider.removeListener("accountsChanged", handleAccountsChanged);
      provider.removeListener("chainChanged", handleChainChanged);
      provider.removeListener("disconnect", handleDisconnect);
    };
  }, [wallet]);

  async function refresh(
    nextWallet: ConnectedWallet | null = wallet,
    worldNameOrKey: string | null = world?.worldKey ?? null,
  ) {
    if (!HAS_DEPLOYMENT) return;
    setError("");
    const [nextWorlds, nextWorld, nextMyWorlds, nextProfile] = await Promise.all([
      readWorlds(),
      worldNameOrKey ? readWorld(worldNameOrKey) : Promise.resolve(null),
      nextWallet ? readPlayerWorlds(nextWallet.address) : Promise.resolve([]),
      nextWallet ? readProfile(nextWallet.address) : Promise.resolve(null),
    ]);
    setWorlds(nextWorlds);
    if (nextWorld) setWorld(nextWorld);
    setMyWorlds(nextMyWorlds);
    setProfile(nextProfile);
  }

  async function connect() {
    setBusy("Connecting your wallet");
    setError("");
    try {
      const connected = await connectWallet();
      setWallet(connected);
      await refresh(connected);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy("");
    }
  }

  async function openWorld(worldNameOrKey: string) {
    setBusy("Opening the Story World");
    setError("");
    try {
      const nextWorld = await readWorld(worldNameOrKey);
      setWorld(nextWorld);
      setScreen("world");
      window.scrollTo({top: 0, behavior: "smooth"});
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy("");
    }
  }

  async function perform(
    operation: (writer: ReturnType<typeof createWriter>) => Promise<unknown>,
    refreshWorld: string | null = world?.worldKey ?? null,
  ): Promise<boolean> {
    if (!wallet) {
      setError("Connect a Studionet wallet first.");
      return false;
    }
    setError("");
    setTransaction(null);
    const writer = createWriter(wallet, (update) => {
      setTransaction(update);
      setBusy(update.action);
    });
    try {
      await operation(writer);
      await refresh(wallet, refreshWorld);
      return true;
    } catch (cause) {
      setError(errorMessage(cause));
      return false;
    } finally {
      setBusy("");
    }
  }

  async function createWorld(values: CreateWorldInput) {
    const created = await perform((writer) => writer.createWorld(values), null);
    if (created) await openWorld(values.worldName);
  }

  async function refreshVisibleWorld() {
    setBusy("Refreshing the atlas");
    try {
      await refresh();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy("");
    }
  }

  const account = wallet?.address ?? null;

  return (
    <div className="app-shell" aria-busy={Boolean(busy)}>
      <header className="site-header">
        <button className="brand" onClick={() => setScreen("atlas")} aria-label="Story Worlds home">
          <span className="brand__mark" aria-hidden="true"><i /><i /></span>
          <span><strong>Imagine Writes</strong><small>Story Worlds</small></span>
        </button>

        <nav aria-label="Primary navigation">
          <button className={screen === "atlas" ? "is-active" : ""} aria-pressed={screen === "atlas"} onClick={() => setScreen("atlas")}>World Atlas</button>
          <button className={screen === "create" ? "is-active" : ""} aria-pressed={screen === "create"} onClick={() => setScreen("create")}>Create a World</button>
          <button className={screen === "mine" ? "is-active" : ""} aria-pressed={screen === "mine"} onClick={() => setScreen("mine")}>My Worlds</button>
          {world ? <button className={screen === "world" ? "is-active" : ""} aria-pressed={screen === "world"} onClick={() => setScreen("world")}>Open Book</button> : null}
        </nav>

        <div className="header-actions">
          <span className="network-pill"><i /> Studionet</span>
          <button className="wallet-button" onClick={() => void connect()} disabled={Boolean(busy)}>
            <span aria-hidden="true">◇</span> {account ? shortAddress(account) : "Connect wallet"}
          </button>
        </div>
      </header>

      {!HAS_DEPLOYMENT ? (
        <div className="deployment-banner">The new Story Worlds contract is waiting for its finalized Studionet address.</div>
      ) : null}

      {error ? (
        <div className="error-banner" role="alert">
          <span aria-hidden="true">!</span>
          <div><strong>The ink blotted.</strong><p>{error}</p></div>
          <button onClick={() => setError("")} aria-label="Dismiss error">×</button>
        </div>
      ) : null}

      {transaction ? (
        <div className={`transaction-ribbon transaction-ribbon--${transaction.phase}`} aria-live="polite">
          {transaction.phase === "submitted" ? (
            <span className="ink-dots" aria-hidden="true"><i /><i /><i /></span>
          ) : (
            <span aria-hidden="true">{transaction.phase === "finalized" ? "✓" : "×"}</span>
          )}
          <span>{transaction.phase === "submitted" ? transaction.action : transaction.phase === "finalized" ? "Finalized—canon is ready" : "Finalized with an error—nothing changed"}</span>
          <a href={`${STUDIONET_EXPLORER_URL}/tx/${transaction.hash}`} target="_blank" rel="noopener noreferrer">{shortAddress(transaction.hash)} ↗</a>
        </div>
      ) : null}

      {screen === "atlas" ? (
        <WorldAtlas
          worlds={worlds}
          busy={Boolean(busy)}
          loading={atlasLoading}
          onCreate={() => setScreen("create")}
          onOpen={openWorld}
          onRefresh={refreshVisibleWorld}
        />
      ) : null}

      {screen === "mine" ? (
        account ? (
          <WorldAtlas
            worlds={myWorlds}
            busy={Boolean(busy)}
            mode="mine"
            profile={profile}
            onCreate={() => setScreen("create")}
            onOpen={openWorld}
            onRefresh={refreshVisibleWorld}
          />
        ) : (
          <main className="connect-page">
            <span className="connect-page__portal" aria-hidden="true">◇</span>
            <p className="kicker">Your traveller&apos;s journal</p>
            <h1>Connect to find your worlds</h1>
            <p>Your wallet is your identity. No account, password, or private story database is required.</p>
            <button className="button button--gold button--large" onClick={() => void connect()} disabled={Boolean(busy)}>Connect Studionet wallet</button>
          </main>
        )
      ) : null}

      {screen === "create" ? (
        <CreateWorldForm
          busy={Boolean(busy)}
          connected={Boolean(account)}
          onCancel={() => setScreen("atlas")}
          onConnect={connect}
          onCreate={createWorld}
        />
      ) : null}

      {screen === "world" && world ? (
        <>
          <WorldBook
            key={`${world.worldKey}-${world.revision}-${account ?? "reader"}`}
            world={world}
            account={account}
            busy={Boolean(busy)}
            onJoin={(characterName, characterNote) => perform((writer) => writer.joinWorld(world.worldKey, characterName, characterNote))}
            onStart={() => perform((writer) => writer.startWorld(world.worldKey))}
            onCancel={() => perform((writer) => writer.cancelWorld(world.worldKey))}
            onSubmit={(passage) => perform((writer) => writer.submitPassage(world.worldKey, passage))}
            onClaim={() => perform((writer) => writer.claimQuill(world.worldKey))}
            onForfeit={() => perform((writer) => writer.forfeitWorld(world.worldKey))}
            onRefresh={refreshVisibleWorld}
          />
          <Chronicle world={world} />
        </>
      ) : null}

      {screen === "world" && !world ? (
        <main className="connect-page">
          <span className="connect-page__portal" aria-hidden="true">✧</span>
          <h1>No Story World is open</h1>
          <p>Choose a named world from the atlas, or search for one directly.</p>
          <button className="button button--gold" onClick={() => setScreen("atlas")}>Return to the atlas</button>
        </main>
      ) : null}

      <footer className="site-footer">
        <div><span className="footer-mark" aria-hidden="true">◇</span><span><strong>Imagine Writes</strong><small>Validator-native Story Worlds</small></span></div>
        <p>Write together. Obey the world. Find peace—or become the Last Quill.</p>
        <div>
          <span>GenLayer Studionet</span>
          {HAS_DEPLOYMENT ? <a href={`${STUDIONET_EXPLORER_URL}/address/${IMAGINE_WRITES_CONTRACT_ADDRESS}`} target="_blank" rel="noopener noreferrer">Contract {shortAddress(IMAGINE_WRITES_CONTRACT_ADDRESS)} ↗</a> : null}
        </div>
      </footer>
    </div>
  );
}
