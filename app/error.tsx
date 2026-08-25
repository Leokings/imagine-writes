"use client";

export default function ErrorPage({reset}: {reset: () => void}) {
  return (
    <main className="loading-page">
      <span className="error-glyph" aria-hidden="true">⌁</span>
      <h1>The world folded unexpectedly</h1>
      <button className="button button--gold" onClick={reset}>Open it again</button>
    </main>
  );
}
