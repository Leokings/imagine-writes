"use client";

import {useState} from "react";

import {shortAddress, type WorldState} from "@/lib/types";
import {categoryLabel, sceneLabel} from "@/lib/worlds";


type ChronicleProps = {
  world: WorldState;
};

export function Chronicle({world}: ChronicleProps) {
  const sceneNumbers = Array.from(
    new Set([
      ...world.story.filter((entry) => entry.scene > 0).map((entry) => entry.scene),
      ...world.attempts.map((attempt) => attempt.scene),
      ...(world.status === "ACTIVE" ? [world.currentScene] : []),
    ]),
  ).sort((first, second) => first - second);
  const [selectedScene, setSelectedScene] = useState<number | "ALL">("ALL");
  const attempts = selectedScene === "ALL"
    ? world.attempts
    : world.attempts.filter((attempt) => attempt.scene === selectedScene);

  return (
    <section className="chronicle" aria-labelledby="chronicle-title">
      <div className="chronicle-heading">
        <div>
          <p className="kicker">The validator record</p>
          <h2 id="chronicle-title">Chronicle of every attempt</h2>
          <p>Canon remembers accepted scenes. The Chronicle also remembers every rejection and expired quill.</p>
        </div>
        <span>{world.attempts.length} verdicts</span>
      </div>

      {sceneNumbers.length ? (
        <nav className="scene-index" aria-label="Read a specific scene">
          <button type="button" className={selectedScene === "ALL" ? "is-active" : ""} onClick={() => setSelectedScene("ALL")}>All scenes</button>
          {sceneNumbers.map((scene) => (
            <button type="button" className={selectedScene === scene ? "is-active" : ""} key={scene} onClick={() => setSelectedScene(scene)}>
              {sceneLabel(scene)}
            </button>
          ))}
        </nav>
      ) : null}

      {attempts.length ? (
        <div className="verdict-list">
          {[...attempts].reverse().map((attempt, reverseIndex) => {
            const isTimeout = attempt.text.startsWith("[The Quill Clock");
            return (
              <details className={`verdict verdict--${attempt.accepted ? "accepted" : "rejected"}`} key={`${attempt.turn}-${attempt.player}-${reverseIndex}`} open={reverseIndex === 0}>
                <summary>
                  <span className="verdict__mark" aria-hidden="true">{attempt.accepted ? "✓" : isTimeout ? "◷" : "×"}</span>
                  <span className="verdict__scene">{sceneLabel(attempt.scene)} <small>Turn {attempt.turn}</small></span>
                  <span className="verdict__author">{attempt.character} <small>{shortAddress(attempt.player)}</small></span>
                  <span className="verdict__result">{attempt.accepted ? "Accepted into canon" : isTimeout ? "Quill expired" : "Rejected by consensus"}</span>
                  <span className="verdict__chevron" aria-hidden="true">⌄</span>
                </summary>
                <div className="verdict__body">
                  <blockquote>{attempt.text}</blockquote>
                  <div className="verdict-grid">
                    <div>
                      <span>Validator decision</span>
                      <p>{attempt.reason}</p>
                    </div>
                    <div>
                      <span>Turn challenge</span>
                      <p><b>{categoryLabel(attempt.constraint.category)}</b> · {attempt.constraint.instruction}</p>
                    </div>
                    <div>
                      <span>World Laws</span>
                      <p>{attempt.violatedLaws.length ? `Violated ${attempt.violatedLaws.map((law) => `Law ${law}`).join(", ")}` : "No World Law violation recorded"}</p>
                    </div>
                    <div>
                      <span>Objective ruling</span>
                      <p>{attempt.objectiveReason}</p>
                    </div>
                  </div>
                  {attempt.objectiveProgress.some(Boolean) ? (
                    <div className="verdict-progress">
                      {attempt.objectiveProgress.map((complete, index) => (
                        <span className={complete ? "is-complete" : ""} key={world.objectiveCriteria[index]}>{complete ? "✓" : "○"} Milestone {index + 1}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </details>
            );
          })}
        </div>
      ) : (
        <div className="empty-chronicle"><span aria-hidden="true">⌁</span><p>No passage has faced the validators yet.</p></div>
      )}
    </section>
  );
}
