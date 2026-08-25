import json
from pathlib import Path

from gltest import create_accounts, get_contract_factory
from gltest.assertions import tx_execution_succeeded
from gltest.contracts.contract import Contract
from gltest.types import TransactionStatus
from gltest.utils import extract_contract_address


WORLD_NAME = "The Clockwork Orchard"
PREMISE = (
    "A mechanical orchard remembers the future, but every harvested memory "
    "makes the present less stable."
)
OPENING = (
    "Nia entered the Clockwork Orchard beneath a copper sunrise. Silver fruit "
    "ticked among the branches, and a small moth made of folded maps landed on "
    "the only tree whose roots were still warm."
)
LAWS = [
    "Nobody may leave the orchard while the world remains active.",
    "A memory can only be harvested from fruit that has already appeared in canon.",
    "The folded-map moth cannot die or be destroyed before Scene Four.",
]
OBJECTIVE = "Repair the orchard's sleeping heart before the copper sunrise becomes permanent."
OBJECTIVE_CRITERIA = [
    "The warm-rooted tree has revealed the path to the orchard's heart.",
    "The heart has been repaired using an established memory without destroying the moth.",
]


def test_named_story_world_and_consensus_turn_on_studionet():
    host, guest = create_accounts(2)
    factory = get_contract_factory("ImagineWrites")
    deploy_receipt = factory.deploy_contract_tx(args=[], account=host)
    assert tx_execution_succeeded(deploy_receipt)
    contract_address = extract_contract_address(deploy_receipt)
    local_schema = json.loads(
        Path("abi/imagine_writes.json").read_text(encoding="utf-8")
    )
    contract = Contract.new(contract_address, local_schema, account=host)
    guest_contract = contract.connect(guest)
    print(
        f"Studionet Story Worlds contract: {contract.address}; "
        f"host: {host.address}; guest: {guest.address}"
    )

    create_receipt = contract.create_world(
        args=[
            WORLD_NAME,
            PREMISE,
            OPENING,
            "Nia",
            "A patient mechanic who distrusts prophecies but protects living machines.",
            json.dumps(LAWS),
            OBJECTIVE,
            json.dumps(OBJECTIVE_CRITERIA),
            3,
            6,
            4,
            2,
            3600,
        ]
    ).transact(wait_transaction_status=TransactionStatus.FINALIZED)
    assert tx_execution_succeeded(create_receipt)

    created = contract.get_world(args=[WORLD_NAME]).call()
    assert created["world_key"] == "the-clockwork-orchard"
    assert created["world_name"] == WORLD_NAME
    assert created["status"] == "WAITING"
    assert created["objective_status"] == "LOCKED"
    assert created["world_laws"] == LAWS

    join_receipt = guest_contract.join_world(
        args=[
            WORLD_NAME,
            "Orin",
            "A memory cartographer who can hear tomorrow humming inside metal fruit.",
        ]
    ).transact(wait_transaction_status=TransactionStatus.FINALIZED)
    assert tx_execution_succeeded(join_receipt)

    start_receipt = contract.start_world(args=[WORLD_NAME]).transact(
        wait_transaction_status=TransactionStatus.FINALIZED
    )
    assert tx_execution_succeeded(start_receipt)

    started = contract.get_world(args=[WORLD_NAME]).call()
    constraint = started["current_constraint"]
    assert started["status"] == "ACTIVE"
    assert started["phase"] == "QUEST"
    assert started["current_scene"] == 1
    assert started["active_player"].lower() == host.address.lower()
    assert constraint["category"] in (
        "CALLBACK",
        "DISCOVERY",
        "CONSEQUENCE",
        "DILEMMA",
        "REVELATION",
        "RESTRICTION",
        "CHARACTER",
        "ATMOSPHERE",
    )
    assert constraint["difficulty"] == 1
    assert len(constraint["criteria"]) in (2, 3)

    # This passage deliberately includes a callback, sensory consequence,
    # dialogue, choice, and bounded discovery while obeying all World Laws. A
    # valid consensus may still reject it against a more specific challenge;
    # either result must update the world atomically and keep the objective
    # locked before Scene Three.
    passage = (
        "Nia touched the brass key to the warm root and heard the silver fruit "
        "tick in answer. 'Show me a path, not the heart,' she told the folded-map "
        "moth, choosing its newly glowing trail over harvesting the nearest memory."
    )
    turn_receipt = contract.submit_passage(
        args=[WORLD_NAME, passage]
    ).transact(wait_transaction_status=TransactionStatus.FINALIZED)
    assert tx_execution_succeeded(turn_receipt)

    after = contract.get_world(args=[WORLD_NAME]).call()
    assert after["turn"] == 2
    assert after["active_player"].lower() == guest.address.lower()
    assert after["objective_status"] == "LOCKED"
    assert len(after["attempts"]) == 1
    assert after["attempts"][0]["text"] == passage
    assert isinstance(after["attempts"][0]["accepted"], bool)
    assert len(after["attempts"][0]["reason"]) >= 16
    assert len(after["attempts"][0]["objective_reason"]) >= 16
    assert after["revision"] == 4
    assert after["current_constraint"]["difficulty"] == 1
    if after["attempts"][0]["accepted"]:
        assert after["current_scene"] == 2
        assert len(after["story"]) == 2
        assert after["scores"] == [1, 0]
    else:
        assert after["current_scene"] == 1
        assert len(after["story"]) == 1
        assert after["ink"] == [1, 2]

    print(
        "Studionet Story World verified: "
        f"{constraint['category']} -> "
        f"{'accepted' if after['attempts'][0]['accepted'] else 'rejected'}; "
        f"next={after['current_constraint']['category']}"
    )
