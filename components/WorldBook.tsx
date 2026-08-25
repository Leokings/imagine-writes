"use client";

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
} from "react";

import {sameAddress, shortAddress, type WorldState} from "@/lib/types";
import {categoryLabel, formatCountdown, paceLabel, phaseLabel, sceneLabel} from "@/lib/worlds";


type WorldBookProps = {
  world: WorldState;
  account: string | null;
  busy: boolean;
  onJoin: (characterName: string, characterNote: string) => Promise<boolean>;
  onStart: () => Promise<boolean>;
  onCancel: () => Promise<boolean>;
  onSubmit: (passage: string) => Promise<boolean>;
  onClaim: () => Promise<boolean>;
  onForfeit: () => Promise<boolean>;
  onRefresh: () => Promise<void>;
};

const DRAFT_EVENT = "imagine-writes-draft";
const memoryDrafts = new Map<string, string>();

function useLocalDraft(worldKey: string, account: string | null) {
  const storageKey = `imagine-writes:v2:draft:${worldKey}:${account?.toLowerCase() ?? "spectator"}`;
  const subscribe = useCallback((notify: () => void) => {
    function onStorage(event: StorageEvent) {
      if (event.key === storageKey) notify();
    }
    function onDraft(event: Event) {
      if (event instanceof CustomEvent && event.detail === storageKey) notify();
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener(DRAFT_EVENT, onDraft);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(DRAFT_EVENT, onDraft);
    };
  }, [storageKey]);
  const getSnapshot = useCallback(
    () => {
      try {
        return window.localStorage.getItem(storageKey) ?? memoryDrafts.get(storageKey) ?? "";
      } catch {
        return memoryDrafts.get(storageKey) ?? "";
      }
    },
    [storageKey],
  );
  const value = useSyncExternalStore(subscribe, getSnapshot, () => "");
  const setValue = useCallback((nextValue: string) => {
    memoryDrafts.set(storageKey, nextValue);
    try {
      window.localStorage.setItem(storageKey, nextValue);
    } catch {
      // Keep the scratch page usable in memory when browser storage is blocked.
    }
    window.dispatchEvent(new CustomEvent(DRAFT_EVENT, {detail: storageKey}));
  }, [storageKey]);
  return [value, setValue] as const;
}

function QuillClock({deadline, windowSeconds}: {deadline: string; windowSeconds: number}) {
  const [now, setNow] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const deadlineTime = Date.parse(deadline);
  const remaining = Number.isFinite(deadlineTime) && now > 0
    ? deadlineTime - now
    : Number.NaN;
  const expired = Number.isFinite(remaining) && remaining <= 0;

  return (
    <div className={`quill-clock ${expired ? "is-expired" : ""}`}>
      <span aria-hidden="true">◷</span>
      <div>
        <small>{paceLabel(windowSeconds)}</small>
        <strong>{Number.isFinite(remaining) ? formatCountdown(remaining) : "Clock syncing…"}</strong>
      </div>
    </div>
  );
}

function ConfirmButton({
  children,
  message,
  className,
  disabled,
  onConfirm,
}: {
  children: ReactNode;
  message: string;
  className: string;
  disabled: boolean;
  onConfirm: () => Promise<boolean>;
}) {
  return (
    <button
      className={className}
      type="button"
      disabled={disabled}
      onClick={() => {
        if (window.confirm(message)) void onConfirm();
      }}
    >
      {children}
    </button>
  );
}

export function WorldBook({
  world,
  account,
  busy,
  onJoin,
  onStart,
  onCancel,
  onSubmit,
  onClaim,
  onForfeit,
  onRefresh,
}: WorldBookProps) {
  const [characterName, setCharacterName] = useState("");
  const [characterNote, setCharacterNote] = useState("");
  const [expired, setExpired] = useState(false);
  const [draft, setDraft] = useLocalDraft(world.worldKey, account);

  useEffect(() => {
    const deadline = Date.parse(world.turnDeadline);
    if (!Number.isFinite(deadline)) return;
    const timer = window.setTimeout(
      () => setExpired(true),
      Math.max(0, deadline - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [world.turnDeadline]);

  const playerIndex = account
    ? world.players.findIndex((player) => sameAddress(player, account))
    : -1;
  const isParticipant = playerIndex >= 0;
  const isAlive = isParticipant && world.ink[playerIndex] > 0;
  const isActiveWriter = Boolean(account && sameAddress(account, world.activePlayer));
  const isHost = Boolean(account && sameAddress(account, world.host));
  const activeIndex = world.players.findIndex((player) => sameAddress(player, world.activePlayer));
  const objectiveCompleteCount = world.objectiveProgress.filter(Boolean).length;

  async function join(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await onJoin(characterName, characterNote)) {
      setCharacterName("");
      setCharacterNote("");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await onSubmit(draft)) setDraft("");
  }

  return (
    <main className="world-view">
      <header className="world-masthead">
        <div className="world-masthead__title">
          <span className="world-sigil" aria-hidden="true">✦</span>
          <div>
            <p className="kicker">A living Story World</p>
            <h1>{world.worldName}</h1>
            <p>{world.premise}</p>
          </div>
        </div>
        <div className="world-masthead__actions">
          <span className={`phase-badge phase-badge--${world.status.toLowerCase()}`}>{phaseLabel(world.phase)}</span>
          {world.status === "ACTIVE" && isAlive ? (
            <ConfirmButton
              className="text-button text-button--danger"
              message="Set down your quill? You will be removed from this world and cannot return."
              disabled={busy}
              onConfirm={onForfeit}
            >
              Forfeit
            </ConfirmButton>
          ) : null}
        </div>
      </header>

      <section className="world-dashboard">
        <article className={`objective-panel objective-panel--${world.objectiveStatus.toLowerCase()}`}>
          <div className="objective-panel__heading">
            <span className="objective-icon" aria-hidden="true">
              {world.objectiveStatus === "COMPLETED" ? "✓" : world.objectiveStatus === "FAILED" ? "×" : "◇"}
            </span>
            <div>
              <p className="kicker">The World Objective</p>
              <h2>{world.objective}</h2>
            </div>
            <span className="objective-state">{world.objectiveStatus}</span>
          </div>
          <p className="objective-reason">{world.objectiveReason}</p>
          <div className="objective-timeline" role="group" aria-label="Objective window">
            <span>Locked until {sceneLabel(world.objectiveUnlockScene)}</span>
            <i><b style={{width: `${Math.min(100, Math.max(0, ((world.currentScene - 1) / (world.objectiveDeadlineScene - 1)) * 100))}%`}} /></i>
            <span>Last chance {sceneLabel(world.objectiveDeadlineScene)}</span>
          </div>
          <ul className="objective-checklist">
            {world.objectiveCriteria.map((criterion, index) => (
              <li className={world.objectiveProgress[index] ? "is-complete" : ""} key={criterion}>
                <span aria-hidden="true">{world.objectiveProgress[index] ? "✓" : index + 1}</span>
                {criterion}
              </li>
            ))}
          </ul>
          <small>{objectiveCompleteCount}/{world.objectiveCriteria.length} milestones evidenced in accepted canon</small>
        </article>

        <aside className="laws-panel">
          <div className="laws-panel__heading">
            <div><p className="kicker">Permanent</p><h2>World Laws</h2></div>
            <span>{world.worldLaws.length}</span>
          </div>
          <ol>
            {world.worldLaws.map((law) => <li key={law}>{law}</li>)}
          </ol>
        </aside>
      </section>

      <section className="roster-strip" aria-label="World characters">
        <div className="roster-strip__intro">
          <p className="kicker">The cast</p>
          <strong>{world.players.length}/{world.maxPlayers} voices</strong>
        </div>
        {/* Keyboard focus is intentional: this region scrolls horizontally when the cast overflows. */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
        <div className="roster-list" role="region" aria-label="Character roster" tabIndex={0}>
          {world.players.map((player, index) => {
            const eliminated = world.ink[index] === 0;
            const writing = sameAddress(player, world.activePlayer);
            return (
              <article className={`${eliminated ? "is-eliminated" : ""} ${writing ? "is-writing" : ""}`} key={player}>
                <span className="character-avatar" aria-hidden="true">{world.characters[index].slice(0, 1).toUpperCase()}</span>
                <div>
                  <strong>{world.characters[index]} {sameAddress(player, world.host) ? <em>Creator</em> : null}</strong>
                  <small title={player}>{shortAddress(player)} · {world.scores[index]} accepted</small>
                </div>
                <span className="ink-lives" role="img" aria-label={`${world.ink[index]} Ink remaining`}>
                  {world.ink[index] > 0 ? Array.from({length: world.ink[index]}, (_, inkIndex) => <i key={inkIndex}>◆</i>) : "FATE SEALED"}
                </span>
              </article>
            );
          })}
        </div>
      </section>

      <section className="story-book" aria-label={`${world.worldName} open book`}>
        <div className="book-ribbon" aria-hidden="true" />
        <article className="book-page book-page--story">
          <header className="page-heading">
            <span>Canonical manuscript</span>
            <b>{world.story.filter((entry) => entry.kind === "SCENE").length} scenes written</b>
          </header>
          {/* Keyboard focus is intentional: long manuscripts scroll independently of the page. */}
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
          <div className="manuscript" role="region" aria-label="Canonical manuscript" tabIndex={0}>
            {world.story.map((entry, index) => (
              <section className={`manuscript-entry manuscript-entry--${entry.kind.toLowerCase()}`} key={`${entry.kind}-${entry.scene}-${index}`}>
                <div className="manuscript-entry__heading">
                  <span>{entry.kind === "PROLOGUE" ? "Prologue" : entry.kind === "FATE" ? `Fate · ${sceneLabel(entry.scene)}` : sceneLabel(entry.scene)}</span>
                  <small>{entry.kind === "SCENE" ? `by ${entry.character}` : entry.character}</small>
                </div>
                <p>{entry.text}</p>
              </section>
            ))}
            {world.status === "WAITING" ? <p className="unwritten-line">Scene One waits for the world to awaken.</p> : null}
          </div>
          <footer className="page-number">— {world.story.length} —</footer>
        </article>

        <article className="book-page book-page--turn">
          {world.status === "WAITING" ? (
            <div className="waiting-page">
              <p className="kicker">Before Scene One</p>
              <h2>The world is gathering its voices</h2>
              <p>{world.lastEvent}</p>
              {!isParticipant && account && world.players.length < world.maxPlayers ? (
                <form className="join-form" onSubmit={join}>
                  <div className="join-form__ornament" aria-hidden="true">✧</div>
                  <h3>Enter as a character</h3>
                  <label className="field">
                    <span>Character name</span>
                    <input value={characterName} onChange={(event) => setCharacterName(event.target.value)} minLength={2} maxLength={32} required placeholder="A name no one else has used" />
                  </label>
                  <label className="field">
                    <span>Who are they?</span>
                    <textarea value={characterNote} onChange={(event) => setCharacterNote(event.target.value)} minLength={10} maxLength={180} rows={3} required placeholder="A motive, talent, fear, or secret…" />
                  </label>
                  <button className="button button--gold" type="submit" disabled={busy}>Enter this world</button>
                </form>
              ) : !account ? (
                <div className="spectator-note"><span aria-hidden="true">◎</span><p>Connect a Studionet wallet to enter as a character.</p></div>
              ) : isParticipant ? (
                <div className="spectator-note"><span aria-hidden="true">✓</span><p>Your character is inside. The creator can awaken the world once at least two voices have gathered.</p></div>
              ) : (
                <div className="spectator-note"><span aria-hidden="true">×</span><p>This world has no empty seats, but its book remains open to readers.</p></div>
              )}
              {isHost ? (
                <div className="host-actions">
                  <button className="button button--ink" type="button" onClick={() => void onStart()} disabled={busy || world.players.length < 2}>Awaken Scene One</button>
                  <ConfirmButton className="text-button text-button--danger" message="Close this world before Scene One?" disabled={busy} onConfirm={onCancel}>Cancel world</ConfirmButton>
                </div>
              ) : null}
            </div>
          ) : null}

          {world.status === "ACTIVE" && world.currentConstraint ? (
            <div className="turn-page">
              <header className="turn-heading">
                <div>
                  <p className="kicker">Turn {world.turn} · {sceneLabel(world.currentScene)}</p>
                  <h2>{activeIndex >= 0 ? `${world.characters[activeIndex]}'s quill` : "The active quill"}</h2>
                </div>
                <QuillClock deadline={world.turnDeadline} windowSeconds={world.turnWindowSeconds} />
              </header>

              {world.phase === "LAST_QUILL" ? (
                <div className="last-quill-warning"><span aria-hidden="true">†</span><p><strong>Last Quill.</strong> The peaceful objective expired. One rejection or timeout now seals a writer&apos;s fate immediately.</p></div>
              ) : null}

              <section className="constraint-card">
                <div className="constraint-card__topline">
                  <span>{categoryLabel(world.currentConstraint.category)}</span>
                  <span>Difficulty {"◆".repeat(world.currentConstraint.difficulty)}</span>
                </div>
                <h3>{world.currentConstraint.instruction}</h3>
                <ul>
                  {world.currentConstraint.criteria.map((criterion) => <li key={criterion}>{criterion}</li>)}
                </ul>
                <small>Generated and reviewed by GenLayer validators</small>
              </section>

              {isActiveWriter && isAlive ? (
                <form className="passage-form" onSubmit={submit}>
                  <div className="passage-form__heading">
                    <div><span className="live-dot" /> Your quill is live</div>
                    <small>{draft.length}/650</small>
                  </div>
                  <label className="visually-hidden" htmlFor="active-passage">Write the next canonical passage</label>
                  <textarea
                    id="active-passage"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    minLength={30}
                    maxLength={650}
                    rows={9}
                    required
                    placeholder="Continue the story while obeying every World Law and this turn's challenge…"
                  />
                  <div className="passage-form__footer">
                    <p><b>Accepted:</b> becomes {sceneLabel(world.currentScene)}. <b>Rejected:</b> lose Ink; the same scene passes to the next survivor.</p>
                    <button className="button button--gold" type="submit" disabled={busy || expired}>Submit to validators</button>
                  </div>
                </form>
              ) : isAlive ? (
                <div className="waiting-writer">
                  <div className="waiting-writer__heading">
                    <div><p className="kicker">Your private scratch page</p><h3>Draft while you wait</h3></div>
                    <span>Saved only in this browser</span>
                  </div>
                  <label className="visually-hidden" htmlFor="draft-ahead">Draft your next passage</label>
                  <textarea
                    id="draft-ahead"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    maxLength={650}
                    rows={7}
                    placeholder="Prepare a branch, note a clue, or write your next move. You can revise it when the challenge reaches you…"
                  />
                  <div className="waiting-writer__footer">
                    <span>{draft.length}/650 · never sent on-chain until you submit it</span>
                    {expired ? (
                      <button className="button button--danger" type="button" onClick={() => void onClaim()} disabled={busy}>Pass the expired quill</button>
                    ) : <span>Watching {activeIndex >= 0 ? world.characters[activeIndex] : "the active writer"} write…</span>}
                  </div>
                </div>
              ) : (
                <div className="spectator-note spectator-note--large">
                  <span aria-hidden="true">◎</span>
                  <p>{isParticipant ? "Your writing fate is sealed, but you can read every scene and verdict." : "You are reading as a spectator. Join a gathering world to take up a quill."}</p>
                </div>
              )}

              {expired && isActiveWriter ? (
                <div className="clock-expired-note">Your clock has expired. Any survivor may now pass this scene to the next living writer in order.</div>
              ) : null}
              <footer className="turn-event">{world.lastEvent}</footer>
            </div>
          ) : null}

          {world.status === "COMPLETE" ? (
            <div className={`ending-page ending-page--${world.outcomeType.toLowerCase()}`}>
              <span className="ending-mark" aria-hidden="true">{world.outcomeType === "PEACE" ? "☼" : "♛"}</span>
              <p className="kicker">The final page</p>
              <h2>{world.outcomeType === "PEACE" ? "The world found peace" : "One quill survived"}</h2>
              <p>{world.outcomeReason}</p>
              {world.outcomeType === "PEACE" ? (
                <div className="survivor-names">
                  {world.survivors.map((survivor) => {
                    const index = world.players.findIndex((player) => sameAddress(player, survivor));
                    return <span key={survivor}>{index >= 0 ? world.characters[index] : shortAddress(survivor)}</span>;
                  })}
                </div>
              ) : (
                <strong className="sole-winner">{world.characters[world.players.findIndex((player) => sameAddress(player, world.winner))] ?? shortAddress(world.winner)}</strong>
              )}
              <small>Finalized by validator consensus on GenLayer Studionet</small>
            </div>
          ) : null}

          {world.status === "CANCELLED" ? (
            <div className="ending-page"><span className="ending-mark" aria-hidden="true">∅</span><h2>This world never awakened</h2><p>{world.lastEvent}</p></div>
          ) : null}
          <footer className="page-number">— {Math.max(1, world.currentScene + 1)} —</footer>
        </article>
      </section>

      <div className="book-refresh-dock">
        <button
          className="book-refresh-button"
          type="button"
          onClick={() => void onRefresh()}
          disabled={busy}
        >
          <span className="book-refresh-button__icon" aria-hidden="true">↻</span>
          <span>
            <strong>{busy ? "Checking the quill…" : "Refresh turn status"}</strong>
            <small>See whether the next turn has reached you</small>
          </span>
        </button>
      </div>
    </main>
  );
}
