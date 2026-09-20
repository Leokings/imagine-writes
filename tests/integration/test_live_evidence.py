r"""Opt-in, resumable StudioNet evidence flow for the production contract.

Run one stage at a time through gltest so the generated challenge can be read
before writing the next passage:

  $env:IMAGINE_WRITES_LIVE_EVIDENCE = "1"
  $env:IMAGINE_WRITES_LIVE_STAGE = "bootstrap"  # create, join, start
  .venv\Scripts\gltest.exe tests/integration/test_live_evidence.py -v -s --network studionet

  $env:IMAGINE_WRITES_LIVE_STAGE = "submit"
  $env:IMAGINE_WRITES_PASSAGE = "..."
  .venv\Scripts\gltest.exe tests/integration/test_live_evidence.py -v -s --network studionet

  $env:IMAGINE_WRITES_LIVE_STAGE = "finish"     # second wallet forfeits
  .venv\Scripts\gltest.exe tests/integration/test_live_evidence.py -v -s --network studionet

The two test-only keys and resume journal stay in the gitignored
``.live-evidence`` directory. The public evidence file excludes private keys.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from time import sleep

import pytest

from genlayer_py import create_account
from genlayer_py.exceptions import GenLayerError
from gltest.assertions import tx_execution_succeeded
from gltest.clients import get_gl_client
from gltest.contracts.contract import Contract
from gltest.types import TransactionHashVariant, TransactionStatus


CONTRACT_ADDRESS = "0x443845484eb76CF7689B6Ea9a6EC2B8f90d0898C"
PROJECT_ROOT = Path(__file__).resolve().parents[2]
STATE_PATH = PROJECT_ROOT / ".live-evidence" / "imagine-writes-private.json"
PUBLIC_PATH = PROJECT_ROOT / ".live-evidence" / "imagine-writes-public.json"
FINALIZED_WAIT_MS = 4_000
FINALIZED_RETRIES = 120


pytestmark = pytest.mark.skipif(
    os.getenv("IMAGINE_WRITES_LIVE_EVIDENCE") != "1",
    reason="set IMAGINE_WRITES_LIVE_EVIDENCE=1 to create real StudioNet transactions",
)


def save_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(value, indent=2), encoding="utf-8")
    temporary.replace(path)


def load_or_create_state() -> dict:
    if STATE_PATH.exists():
        state = json.loads(STATE_PATH.read_text(encoding="utf-8"))
        assert state["contract_address"].lower() == CONTRACT_ADDRESS.lower()
        return state

    creator = create_account()
    guest = create_account()
    suffix = creator.address[-6:].lower()
    state = {
        "network": "GenLayer StudioNet",
        "contract_address": CONTRACT_ADDRESS,
        "world_name": f"The Returning Tide {suffix}",
        "wallets": {
            "creator": {
                "address": creator.address,
                "private_key": "0x" + creator.key.hex(),
            },
            "guest": {
                "address": guest.address,
                "private_key": "0x" + guest.key.hex(),
            },
        },
        "transactions": {},
    }
    save_json(STATE_PATH, state)
    print(
        "WALLETS_CREATED "
        f"creator={creator.address} guest={guest.address} journal={STATE_PATH}",
        flush=True,
    )
    return state


def read_final(contract: Contract, world_name: str) -> dict:
    last_error: Exception | None = None
    for attempt in range(20):
        try:
            return contract.get_world(args=[world_name]).call(
                transaction_hash_variant=TransactionHashVariant.LATEST_FINAL
            )
        except GenLayerError as error:
            last_error = error
            if attempt < 19:
                sleep(min(attempt + 1, 5))
    assert last_error is not None
    raise last_error


def wait_for_success(tx_hash: str) -> dict:
    client = get_gl_client()
    last_error: Exception | None = None
    for _attempt in range(FINALIZED_RETRIES):
        try:
            receipt = client.wait_for_transaction_receipt(
                transaction_hash=tx_hash,
                status=TransactionStatus.FINALIZED,
                interval=FINALIZED_WAIT_MS,
                retries=1,
            )
            assert receipt.get("status_name") == TransactionStatus.FINALIZED.value
            assert tx_execution_succeeded(receipt), json.dumps(receipt, default=str)
            return receipt
        except (GenLayerError, ValueError) as error:
            last_error = error
            sleep(FINALIZED_WAIT_MS / 1_000)
    raise AssertionError(f"{tx_hash} did not finalize successfully: {last_error}")


def ensure_transaction(
    state: dict,
    step: str,
    actor: str,
    contract: Contract,
    function_name: str,
    args: list,
) -> dict:
    existing = state["transactions"].get(step)
    if (
        existing
        and existing.get("status") == "FINALIZED"
        and existing.get("execution_result") == "SUCCESS"
    ):
        print(f"REUSED {step} {existing['transaction_hash']} FINALIZED SUCCESS", flush=True)
        return existing

    if existing and existing.get("transaction_hash"):
        tx_hash = existing["transaction_hash"]
        print(f"RESUMING {step} {tx_hash}", flush=True)
    else:
        tx_hash = str(
            get_gl_client().write_contract(
                address=contract.address,
                function_name=function_name,
                account=contract.account,
                value=0,
                leader_only=False,
                args=args,
            )
        )
        state["transactions"][step] = {
            "step": step,
            "actor": actor,
            "function": function_name,
            "transaction_hash": tx_hash,
            "status": "SUBMITTED",
            "execution_result": "PENDING",
        }
        save_json(STATE_PATH, state)
        print(f"SUBMITTED {step} {tx_hash}", flush=True)

    receipt = wait_for_success(tx_hash)
    leader = (receipt.get("consensus_data", {}).get("leader_receipt") or [{}])[0]
    evidence = state["transactions"][step]
    evidence["status"] = receipt.get("status_name")
    evidence["execution_result"] = leader.get("execution_result")
    save_json(STATE_PATH, state)
    print(f"FINALIZED {step} {tx_hash} SUCCESS", flush=True)
    return evidence


def write_public_evidence(state: dict, world: dict) -> None:
    attempts = world.get("attempts", [])
    public = {
        "network": state["network"],
        "contract_address": state["contract_address"],
        "world_name": state["world_name"],
        "wallets": {
            actor: details["address"] for actor, details in state["wallets"].items()
        },
        "transactions": list(state["transactions"].values()),
        "readback": {
            "status": world["status"],
            "phase": world["phase"],
            "outcome_type": world["outcome_type"],
            "winner": world["winner"],
            "player_count": len(world["players"]),
            "current_scene": world["current_scene"],
            "revision": world["revision"],
            "story_entries": len(world["story"]),
            "attempts": [
                {
                    "turn": item["turn"],
                    "scene": item["scene"],
                    "player": item["player"],
                    "character": item["character"],
                    "accepted": item["accepted"],
                    "reason": item["reason"],
                }
                for item in attempts
            ],
            "last_event": world["last_event"],
        },
    }
    save_json(PUBLIC_PATH, public)
    print("PUBLIC_EVIDENCE " + json.dumps(public, separators=(",", ":")), flush=True)


def test_production_contract_evidence_flow() -> None:
    stage = os.getenv("IMAGINE_WRITES_LIVE_STAGE", "state").strip().lower()
    if stage not in {"bootstrap", "state", "submit", "finish"}:
        raise AssertionError("IMAGINE_WRITES_LIVE_STAGE must be bootstrap, state, submit, or finish")

    state = load_or_create_state()
    creator = create_account(state["wallets"]["creator"]["private_key"])
    guest = create_account(state["wallets"]["guest"]["private_key"])
    schema = json.loads((PROJECT_ROOT / "abi" / "imagine_writes.json").read_text(encoding="utf-8"))
    creator_contract = Contract.new(CONTRACT_ADDRESS, schema, account=creator)
    guest_contract = creator_contract.connect(guest)
    world_name = state["world_name"]

    if "setup.create" not in state["transactions"]:
        ensure_transaction(
            state,
            "setup.create",
            "creator",
            creator_contract,
            "create_world",
            [
                world_name,
                "On an island where the tide flows backward at midnight, two keepers must repair a broken star compass before their harbor disappears.",
                "Mira reached the lighthouse as the midnight tide climbed away from shore. A cracked brass star compass waited beneath the dark lens, while Soren crossed the exposed seabed carrying its missing crystal needle.",
                "Mira Vale",
                "A careful lighthouse keeper who solves danger through observation and honest cooperation.",
                json.dumps(
                    [
                        "The brass star compass cannot be destroyed or removed from the island.",
                        "No named character may die while the world remains in its Quest phase.",
                    ]
                ),
                "Repair the brass star compass and use its light to guide the missing harbor home.",
                json.dumps(
                    [
                        "Accepted canon shows Mira and Soren repairing the brass star compass together.",
                        "Accepted canon shows the repaired compass relighting the lighthouse and returning the missing harbor.",
                    ]
                ),
                2,
                4,
                2,
                3,
                300,
            ],
        )

    world = read_final(creator_contract, world_name)
    if guest.address.lower() not in [player.lower() for player in world["players"]]:
        ensure_transaction(
            state,
            "setup.join",
            "guest",
            guest_contract,
            "join_world",
            [
                world_name,
                "Soren Quill",
                "A tide cartographer who carries the compass needle and trusts Mira's lighthouse craft.",
            ],
        )

    world = read_final(creator_contract, world_name)
    if world["status"] == "WAITING":
        ensure_transaction(
            state,
            "setup.start",
            "creator",
            creator_contract,
            "start_world",
            [world_name],
        )

    world = read_final(creator_contract, world_name)
    if stage == "submit":
        passage = os.getenv("IMAGINE_WRITES_PASSAGE", "").strip()
        if len(passage) < 30 or len(passage) > 650:
            raise AssertionError("IMAGINE_WRITES_PASSAGE must contain 30-650 characters")
        actor_address = world["active_player"].lower()
        if actor_address == creator.address.lower():
            actor, contract = "creator", creator_contract
        elif actor_address == guest.address.lower():
            actor, contract = "guest", guest_contract
        else:
            raise AssertionError(f"unexpected active player {world['active_player']}")
        step = f"turn.{world['turn']}.{actor}.submit"
        ensure_transaction(
            state,
            step,
            actor,
            contract,
            "submit_passage",
            [world_name, passage],
        )
        world = read_final(creator_contract, world_name)

    if stage == "finish" and world["status"] == "ACTIVE":
        guest_index = [player.lower() for player in world["players"]].index(guest.address.lower())
        if int(world["ink"][guest_index]) > 0:
            actor, contract = "guest", guest_contract
        else:
            actor, contract = "creator", creator_contract
        ensure_transaction(
            state,
            "finish.forfeit",
            actor,
            contract,
            "forfeit_world",
            [world_name],
        )
        world = read_final(creator_contract, world_name)

    write_public_evidence(state, world)
    print(
        "WORLD_STATE "
        + json.dumps(
            {
                "world_name": world["world_name"],
                "status": world["status"],
                "phase": world["phase"],
                "turn": world["turn"],
                "current_scene": world["current_scene"],
                "active_player": world["active_player"],
                "constraint": world["current_constraint"],
                "attempt_count": len(world["attempts"]),
                "last_event": world["last_event"],
            },
            separators=(",", ":"),
        ),
        flush=True,
    )

    if stage == "finish":
        assert world["status"] == "COMPLETE"
        assert world["phase"] in {"PEACE", "SURVIVOR"}

