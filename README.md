# Imagine Writes

Imagine Writes is a validator-native collaborative storytelling game built on GenLayer. Players create uniquely named Story Worlds, lock in the laws of those worlds, and work toward a peaceful objective before the story becomes a Last Quill survival contest.

## Live deployment

- App: https://imagine-writes.vercel.app
- Network: GenLayer Studionet (chain ID `61999`)
- Contract: [`0x443845484eb76CF7689B6Ea9a6EC2B8f90d0898C`](https://explorer-studio.genlayer.com/address/0x443845484eb76CF7689B6Ea9a6EC2B8f90d0898C)
- Deployment transaction: [`0x885c6b4fdda97264f5eb19f3d1ed72affbedb88bf11c0c0cd11bc433833799bb`](https://explorer-studio.genlayer.com/tx/0x885c6b4fdda97264f5eb19f3d1ed72affbedb88bf11c0c0cd11bc433833799bb)

The production contract starts with zero seeded worlds. Every world visible in the Atlas is created by a real wallet and finalized on Studionet.

## Why this is GenLayer-native

- The frontend owns presentation, wallet connection, finalized-state reads, and the private browser-only draft pad.
- The intelligent contract owns unique world names, permanent laws, turn order, Ink, scene gates, canon, eliminations, and final outcomes.
- GenLayer validators generate and independently review each creative constraint. For every submitted passage, a leader proposes the ruling and a validator independently recomputes the acceptance and objective decisions before state can change.
- No private API, centralized AI endpoint, database, or trusted game server decides what enters canon.

## How a Story World works

1. A creator chooses a unique world name, premise, prologue, 2–8 permanent World Laws, a peaceful objective, and the evidence validators must find before accepting it.
2. Other wallets enter as uniquely named characters while the world is gathering.
3. The creator awakens Scene One. GenLayer validators generate and independently review the scene's creative constraint.
4. The active writer submits a passage. Validators judge it against canon, every World Law, the current constraint, and the objective's scene gate.
5. An accepted passage becomes the numbered scene. A rejected passage costs Ink and passes the same scene to the next surviving writer.
6. The Quill Clock prevents stalled worlds. After the selected 5-minute, 1-hour, or 24-hour window expires, any living participant can advance it; the timed-out writer loses Ink and the same scene passes to the next survivor in the established order.
7. If the objective is completed during its allowed scene window, every living writer shares a peaceful ending. If the deadline passes, Last Quill begins and each rejection or timeout eliminates a writer until one remains.

The open book contains only accepted canon and character fates. The validator Chronicle preserves every accepted passage, rejection, timeout, ruling, law violation, and objective decision. Waiting players also have a private browser-only scratch page for drafting ahead.

## Local development

Requirements: Node.js 20.19–24 and Python 3.12.

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements-dev.txt
npm install
npm run dev
```

On macOS or Linux, install the same Python requirements with `.venv/bin/python -m pip install -r requirements-dev.txt`. The npm verification scripts resolve either virtual-environment layout automatically.

Copy `.env.example` to `.env.local` only to override the built-in Studionet contract address.

Run the local contract, frontend, and production-build checks with:

```powershell
npm run verify
```

Run the hosted Studionet lifecycle test separately with:

```powershell
npm run test:integration
```

## Project layout

- `contracts/imagine_writes.py` — GenLayer intelligent contract
- `components/` — World Atlas, World Foundry, unfolding storybook, turn desk, and Chronicle
- `lib/` — Studionet wallet client, contract parsers, and Story World helpers
- `tests/direct/` — deterministic contract tests, including rejection and Quill Clock handoffs
- `tests/integration/` — finalized end-to-end Studionet lifecycle test
- `abi/imagine_writes.json` — generated contract interface
- `deployments/studionet.json` — finalized deployment record
