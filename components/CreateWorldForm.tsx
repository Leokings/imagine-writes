"use client";

import {useState, type FormEvent} from "react";

import type {CreateWorldInput} from "@/lib/imagine-writes-client";
import {sceneLabel, worldKeyFromName} from "@/lib/worlds";


type CreateWorldFormProps = {
  busy: boolean;
  connected: boolean;
  onCancel: () => void;
  onConnect: () => Promise<void>;
  onCreate: (values: CreateWorldInput) => Promise<void>;
};

function replaceAt(values: string[], index: number, value: string): string[] {
  return values.map((item, itemIndex) => itemIndex === index ? value : item);
}

function uniqueNormalized(values: string[]): boolean {
  const normalized = values.map((value) => value.trim().toLowerCase());
  return new Set(normalized).size === normalized.length;
}

export function CreateWorldForm({
  busy,
  connected,
  onCancel,
  onConnect,
  onCreate,
}: CreateWorldFormProps) {
  const [worldName, setWorldName] = useState("");
  const [premise, setPremise] = useState("");
  const [opening, setOpening] = useState("");
  const [characterName, setCharacterName] = useState("");
  const [characterNote, setCharacterNote] = useState("");
  const [worldLaws, setWorldLaws] = useState(["", ""]);
  const [objective, setObjective] = useState("");
  const [objectiveCriteria, setObjectiveCriteria] = useState(["", ""]);
  const [objectiveUnlockScene, setObjectiveUnlockScene] = useState(3);
  const [objectiveDeadlineScene, setObjectiveDeadlineScene] = useState(8);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [startingInk, setStartingInk] = useState(2);
  const [turnWindowSeconds, setTurnWindowSeconds] = useState(3_600);
  const [formError, setFormError] = useState("");

  const worldKey = worldKeyFromName(worldName);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    if (!worldKey) {
      setFormError("Use a 3–48 character world name with letters, numbers, spaces, apostrophes, or hyphens.");
      return;
    }
    if (!uniqueNormalized(worldLaws)) {
      setFormError("Each World Law must be different.");
      return;
    }
    if (!uniqueNormalized(objectiveCriteria)) {
      setFormError("Each objective milestone must be different.");
      return;
    }
    await onCreate({
      worldName,
      premise,
      opening,
      characterName,
      characterNote,
      worldLaws,
      objective,
      objectiveCriteria,
      objectiveUnlockScene,
      objectiveDeadlineScene,
      maxPlayers,
      startingInk,
      turnWindowSeconds,
    });
  }

  return (
    <main className="foundry-wrap">
      <header className="foundry-heading">
        <p className="kicker">World Foundry</p>
        <h1>Write the laws. Wake the world.</h1>
        <p>
          Your premise, laws, and peaceful objective become permanent once the
          world is created. GenLayer validators enforce them scene by scene.
        </p>
      </header>

      <form className="foundry-form" onSubmit={submit}>
        <section className="foundry-section">
          <div className="foundry-section__number">I</div>
          <div className="foundry-section__body">
            <div className="section-heading">
              <div>
                <span>First inscription</span>
                <h2>Name the world</h2>
              </div>
              {worldKey ? <code className="world-key-preview">/{worldKey}</code> : null}
            </div>

            <label className="field">
              <span>World name <em>Must be unique</em></span>
              <input
                value={worldName}
                onChange={(event) => setWorldName(event.target.value)}
                minLength={3}
                maxLength={48}
                placeholder="Give this Story World a unique name"
                required
              />
            </label>
            <label className="field">
              <span>Premise</span>
              <textarea
                value={premise}
                onChange={(event) => setPremise(event.target.value)}
                minLength={30}
                maxLength={320}
                rows={3}
                placeholder="Describe the world, its central conflict, and what makes it distinct…"
                required
              />
              <small>{premise.length}/320 · the promise of this world</small>
            </label>
            <label className="field">
              <span>Prologue</span>
              <textarea
                value={opening}
                onChange={(event) => setOpening(event.target.value)}
                minLength={60}
                maxLength={800}
                rows={6}
                placeholder="Write the opening that every future scene must treat as canon…"
                required
              />
              <small>{opening.length}/800 · canon begins here</small>
            </label>
          </div>
        </section>

        <section className="foundry-section">
          <div className="foundry-section__number">II</div>
          <div className="foundry-section__body">
            <div className="section-heading">
              <div>
                <span>The unbreakable</span>
                <h2>Set the World Laws</h2>
              </div>
              <span className="count-pill">{worldLaws.length}/8 laws</span>
            </div>
            <p className="section-copy">
              Validators reject any passage that breaks these. Make each law
              precise enough that independent judges can agree.
            </p>
            <div className="repeater-list">
              {worldLaws.map((law, index) => (
                <div className="repeater-row" key={`law-${index}`}>
                  <span className="repeater-index">{index + 1}</span>
                  <label className="visually-hidden" htmlFor={`law-${index}`}>World Law {index + 1}</label>
                  <textarea
                    id={`law-${index}`}
                    value={law}
                    onChange={(event) => setWorldLaws(replaceAt(worldLaws, index, event.target.value))}
                    minLength={12}
                    maxLength={180}
                    rows={2}
                    placeholder="State one permanent, independently judgeable law…"
                    required
                  />
                  {worldLaws.length > 2 ? (
                    <button
                      className="icon-button"
                      type="button"
                      onClick={() => setWorldLaws(worldLaws.filter((_, itemIndex) => itemIndex !== index))}
                      aria-label={`Remove World Law ${index + 1}`}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            {worldLaws.length < 8 ? (
              <button
                className="add-line"
                type="button"
                onClick={() => setWorldLaws([...worldLaws, ""])}
              >
                <span>＋</span> Add another law
              </button>
            ) : null}
          </div>
        </section>

        <section className="foundry-section foundry-section--objective">
          <div className="foundry-section__number">III</div>
          <div className="foundry-section__body">
            <div className="section-heading">
              <div>
                <span>The way home</span>
                <h2>Define the peaceful objective</h2>
              </div>
              <span className="peace-seal">Peace route</span>
            </div>
            <label className="field">
              <span>World Objective</span>
              <textarea
                value={objective}
                onChange={(event) => setObjective(event.target.value)}
                minLength={20}
                maxLength={240}
                rows={3}
                placeholder="Describe the peaceful ending the writers can achieve together…"
                required
              />
            </label>
            <fieldset className="milestone-fieldset">
              <legend>Evidence validators must find in canon</legend>
              <div className="repeater-list">
                {objectiveCriteria.map((criterion, index) => (
                  <div className="repeater-row" key={`criterion-${index}`}>
                    <span className="repeater-index repeater-index--round">{index + 1}</span>
                    <label className="visually-hidden" htmlFor={`criterion-${index}`}>Objective milestone {index + 1}</label>
                    <textarea
                      id={`criterion-${index}`}
                      value={criterion}
                      onChange={(event) => setObjectiveCriteria(replaceAt(objectiveCriteria, index, event.target.value))}
                      minLength={12}
                      maxLength={180}
                      rows={2}
                      placeholder="State evidence validators must find in accepted canon…"
                      required
                    />
                    {objectiveCriteria.length > 2 ? (
                      <button
                        className="icon-button"
                        type="button"
                        onClick={() => setObjectiveCriteria(objectiveCriteria.filter((_, itemIndex) => itemIndex !== index))}
                        aria-label={`Remove objective milestone ${index + 1}`}
                      >
                        ×
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
              {objectiveCriteria.length < 5 ? (
                <button
                  className="add-line"
                  type="button"
                  onClick={() => setObjectiveCriteria([...objectiveCriteria, ""])}
                >
                  <span>＋</span> Add milestone
                </button>
              ) : null}
            </fieldset>

            <div className="form-grid form-grid--four">
              <label className="field">
                <span>Objective awakens</span>
                <select
                  value={objectiveUnlockScene}
                  onChange={(event) => {
                    const nextUnlock = Number(event.target.value);
                    setObjectiveUnlockScene(nextUnlock);
                    if (objectiveDeadlineScene < nextUnlock + 2) {
                      setObjectiveDeadlineScene(nextUnlock + 2);
                    }
                  }}
                >
                  {Array.from({length: 9}, (_, index) => index + 2).map((scene) => (
                    <option value={scene} key={scene}>{sceneLabel(scene)}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Last peaceful chance</span>
                <select
                  value={objectiveDeadlineScene}
                  onChange={(event) => setObjectiveDeadlineScene(Number(event.target.value))}
                >
                  {Array.from(
                    {length: 14 - (objectiveUnlockScene + 2) + 1},
                    (_, index) => index + objectiveUnlockScene + 2,
                  ).map((scene) => (
                    <option value={scene} key={scene}>{sceneLabel(scene)}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Seats</span>
                <select value={maxPlayers} onChange={(event) => setMaxPlayers(Number(event.target.value))}>
                  {Array.from({length: 7}, (_, index) => index + 2).map((count) => (
                    <option value={count} key={count}>{count} writers</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Ink per writer</span>
                <select value={startingInk} onChange={(event) => setStartingInk(Number(event.target.value))}>
                  {[1, 2, 3].map((count) => (
                    <option value={count} key={count}>{count} {count === 1 ? "life" : "lives"}</option>
                  ))}
                </select>
              </label>
            </div>

            <fieldset className="pace-fieldset">
              <legend>Quill Clock</legend>
              <p>When time expires, any survivor can pass the same scene to the next quill in order.</p>
              <div className="pace-options">
                {[
                  {value: 300, title: "Blitz", copy: "5 minutes", symbol: "ϟ"},
                  {value: 3_600, title: "Campfire", copy: "1 hour", symbol: "◌"},
                  {value: 86_400, title: "Chronicle", copy: "24 hours", symbol: "☼"},
                ].map((pace) => (
                  <label className={turnWindowSeconds === pace.value ? "pace-card is-selected" : "pace-card"} key={pace.value}>
                    <input
                      type="radio"
                      name="turn-window"
                      value={pace.value}
                      checked={turnWindowSeconds === pace.value}
                      onChange={() => setTurnWindowSeconds(pace.value)}
                    />
                    <b aria-hidden="true">{pace.symbol}</b>
                    <strong>{pace.title}</strong>
                    <span>{pace.copy} per turn</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </section>

        <section className="foundry-section">
          <div className="foundry-section__number">IV</div>
          <div className="foundry-section__body">
            <div className="section-heading">
              <div>
                <span>Your first voice</span>
                <h2>Create your character</h2>
              </div>
            </div>
            <div className="form-grid">
              <label className="field">
                <span>Character name</span>
                <input
                  value={characterName}
                  onChange={(event) => setCharacterName(event.target.value)}
                  minLength={2}
                  maxLength={32}
                  placeholder="Name your first character"
                  required
                />
              </label>
              <label className="field">
                <span>Character note</span>
                <textarea
                  value={characterNote}
                  onChange={(event) => setCharacterNote(event.target.value)}
                  minLength={10}
                  maxLength={180}
                  rows={3}
                  placeholder="Give validators a motive, talent, fear, or secret to preserve…"
                  required
                />
              </label>
            </div>
          </div>
        </section>

        {formError ? <p className="form-error" role="alert">{formError}</p> : null}
        {!connected ? (
          <div className="connect-note">
            <span>Connect a Studionet wallet before binding this world.</span>
            <button type="button" onClick={() => void onConnect()} disabled={busy}>Connect wallet</button>
          </div>
        ) : null}
        <div className="form-actions">
          <button className="button button--quiet" type="button" onClick={onCancel}>Return to the atlas</button>
          <button className="button button--gold button--large" type="submit" disabled={busy || !connected}>
            <span>Bind this Story World</span>
            <small>Rules become permanent on Studionet</small>
          </button>
        </div>
      </form>
    </main>
  );
}
