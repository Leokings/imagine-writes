"use client";

import {useState, type FormEvent} from "react";

import type {PlayerProfile, WorldSummary} from "@/lib/types";
import {paceLabel, phaseLabel, sceneLabel} from "@/lib/worlds";


type Filter = "ALL" | "WAITING" | "ACTIVE" | "COMPLETE";

type WorldAtlasProps = {
  worlds: WorldSummary[];
  busy: boolean;
  loading?: boolean;
  mode?: "atlas" | "mine";
  profile?: PlayerProfile | null;
  onCreate: () => void;
  onOpen: (worldNameOrKey: string) => Promise<void>;
  onRefresh: () => Promise<void>;
};

function statusCopy(world: WorldSummary): string {
  if (world.status === "WAITING") return `${world.playerCount}/${world.maxPlayers} writers gathering`;
  if (world.status === "ACTIVE") return `${world.survivorCount} quills still writing`;
  if (world.phase === "PEACE") return "Objective completed together";
  if (world.phase === "SURVIVOR") return "One quill remained";
  return "World closed before it began";
}

export function WorldAtlas({
  worlds,
  busy,
  loading = false,
  mode = "atlas",
  profile,
  onCreate,
  onOpen,
  onRefresh,
}: WorldAtlasProps) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
  const visibleWorlds = filter === "ALL"
    ? worlds
    : worlds.filter((world) => world.status === filter);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (query.trim()) await onOpen(query.trim());
  }

  return (
    <main className="atlas">
      {mode === "atlas" ? (
        <section className="atlas-hero">
          <div className="atlas-hero__copy">
            <p className="kicker">Consensus storytelling on GenLayer</p>
            <h1>Every world has laws.<br /><i>Every quill has a life.</i></h1>
            <p>
              Build a living story with strangers. Validators invent each
              challenge, enforce the world&apos;s laws, and decide whether everyone
              finds peace—or only one writer survives.
            </p>
            <div className="hero-actions">
              <button className="button button--gold button--large" onClick={onCreate}>
                Create a Story World <span aria-hidden="true">→</span>
              </button>
              <a className="text-link" href="#world-directory">Explore open worlds</a>
            </div>
          </div>
          <div className="portal-art" aria-hidden="true">
            <span className="portal-art__orbit portal-art__orbit--one" />
            <span className="portal-art__orbit portal-art__orbit--two" />
            <span className="portal-art__stars">✦ · ✧ · ✦</span>
            <div className="portal-book">
              <span className="portal-book__left" />
              <span className="portal-book__right" />
              <span className="portal-book__spine" />
            </div>
            <span className="portal-art__quill">⌁</span>
          </div>
        </section>
      ) : (
        <section className="my-worlds-hero">
          <div>
            <p className="kicker">Your traveller&apos;s journal</p>
            <h1>My Story Worlds</h1>
            <p>Every world your wallet has entered, written into one atlas.</p>
          </div>
          {profile ? (
            <div className="profile-stats" aria-label="Writer profile">
              <span><strong>{profile.worldsPlayed}</strong> worlds</span>
              <span><strong>{profile.acceptedScenes}</strong> scenes</span>
              <span><strong>{profile.peacefulWins}</strong> peace endings</span>
              <span><strong>{profile.survivorWins}</strong> survivor wins</span>
            </div>
          ) : null}
        </section>
      )}

      <section className="atlas-directory" id="world-directory">
        <div className="directory-heading">
          <div>
            <p className="kicker">{mode === "mine" ? "Known paths" : "The living atlas"}</p>
            <h2>{mode === "mine" ? "Worlds you have entered" : "Choose a world to enter"}</h2>
          </div>
          <button className="refresh-button" onClick={() => void onRefresh()} disabled={busy}>
            <span aria-hidden="true">↻</span> Refresh atlas
          </button>
        </div>

        <form className="world-search" onSubmit={search}>
          <label className="visually-hidden" htmlFor={`${mode}-world-search`}>Open a world by exact name</label>
          <span aria-hidden="true">⌕</span>
          <input
            id={`${mode}-world-search`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type the exact world name"
          />
          <button type="submit" disabled={busy || !query.trim()}>Open world</button>
        </form>

        <div className="directory-controls">
          <div className="filter-tabs" role="group" aria-label="Filter Story Worlds">
            {([
              ["ALL", "All worlds"],
              ["WAITING", "Gathering"],
              ["ACTIVE", "In progress"],
              ["COMPLETE", "Endings"],
            ] as const).map(([value, label]) => (
              <button
                className={filter === value ? "is-active" : ""}
                key={value}
                onClick={() => setFilter(value)}
                type="button"
                aria-pressed={filter === value}
              >
                {label}
              </button>
            ))}
          </div>
          <span>{loading ? "Reading worlds…" : `${visibleWorlds.length} ${visibleWorlds.length === 1 ? "world" : "worlds"}`}</span>
        </div>

        {loading ? (
          <div className="empty-atlas" role="status" aria-live="polite">
            <span className="ink-dots" aria-hidden="true"><i /><i /><i /></span>
            <h3>Reading finalized worlds</h3>
            <p>The Atlas is checking Studionet for the latest accepted state.</p>
          </div>
        ) : visibleWorlds.length ? (
          <div className="world-grid">
            {visibleWorlds.map((world, index) => (
              <article className={`world-card world-card--${(index % 3) + 1}`} key={world.worldKey}>
                <button
                  className="world-card__cover"
                  onClick={() => void onOpen(world.worldKey)}
                  disabled={busy}
                  aria-label={`Open ${world.worldName}`}
                >
                  <span className="world-card__sigil" aria-hidden="true">{index % 2 ? "✧" : "✦"}</span>
                  <span className={`phase-badge phase-badge--${world.status.toLowerCase()}`}>{phaseLabel(world.phase)}</span>
                  <span className="world-card__title">{world.worldName}</span>
                  <span className="world-card__line" />
                  <span className="world-card__premise">{world.premise}</span>
                  <span className="world-card__open">Open the book <b aria-hidden="true">→</b></span>
                </button>
                <div className="world-card__meta">
                  <span>{world.status === "WAITING" ? "Before Scene One" : sceneLabel(world.currentScene)}</span>
                  <span>{statusCopy(world)}</span>
                  <span>{paceLabel(world.turnWindowSeconds)}</span>
                </div>
                <div className={`objective-ribbon objective-ribbon--${world.objectiveStatus.toLowerCase()}`}>
                  <span aria-hidden="true">{world.objectiveStatus === "COMPLETED" ? "✓" : "◇"}</span>
                  <p><b>{world.objectiveStatus === "LOCKED" ? `Unlocks ${sceneLabel(world.objectiveUnlockScene)}` : "World Objective"}</b> {world.objective}</p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-atlas">
            <span aria-hidden="true">✧</span>
            <h3>{filter === "ALL" ? "The page is waiting" : "No worlds match this chapter"}</h3>
            <p>{mode === "mine" ? "Enter a public world and it will appear here." : "Create the first world in this part of the Atlas."}</p>
            <button className="button button--gold" onClick={onCreate}>Create a Story World</button>
          </div>
        )}
      </section>

      {mode === "atlas" ? (
        <section className="how-it-works" aria-labelledby="how-title">
          <p className="kicker">The rules of the table</p>
          <h2 id="how-title">How a world moves</h2>
          <div className="rule-steps">
            <article><span>01</span><h3>A validator sets the challenge</h3><p>Each turn begins with a fresh, AI-generated constraint grounded in the existing canon.</p></article>
            <article><span>02</span><h3>One quill writes the scene</h3><p>An accepted passage becomes canon. A rejection loses Ink and passes the same scene onward.</p></article>
            <article><span>03</span><h3>Peace—or the Last Quill</h3><p>Complete the shared objective in time, or survive until every other writing voice is gone.</p></article>
          </div>
        </section>
      ) : null}
    </main>
  );
}
