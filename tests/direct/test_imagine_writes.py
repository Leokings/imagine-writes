from __future__ import annotations

import json

import pytest


CONTRACT = "contracts/imagine_writes.py"
WORLD_NAME = "Direct Test World"
WORLD_KEY = "direct-test-world"
PREMISE = (
    "A living library is slowly forgetting every person whose name has "
    "ever been written in its books."
)
OPENING = (
    "At midnight, Mara found her own biography turning blank inside the "
    "Moonless Archive. A paper fox waited on the final sentence, holding "
    "a brass key between its teeth while the shelves whispered her name."
)
LAWS = [
    "Nobody may leave the Moonless Archive while the story is active.",
    "Magic can only act through words that already exist inside the library.",
    "The paper fox cannot die or be destroyed before Scene Four.",
]
OBJECTIVE = "Restore the Archive's true index before every written name disappears."
OBJECTIVE_CRITERIA = [
    "The brass key has opened the sealed catalogue beneath the central desk.",
    "The true index has been restored using names established in the story.",
]

GENERATOR_PROMPT = r"(?s).*ROLE: STORY_WORLDS_CONSTRAINT_GENERATOR.*"
CONSTRAINT_REVIEW_PROMPT = r"(?s).*ROLE: STORY_WORLDS_CONSTRAINT_REVIEWER.*"
TURN_PROMPT = r"(?s).*ROLE: STORY_WORLDS_TURN_ADJUDICATOR.*"
TURN_REVIEW_PROMPT = r"(?s).*ROLE: STORY_WORLDS_TURN_REVIEWER.*"


def constraint(category: str, difficulty: int) -> dict:
    instructions = {
        "CALLBACK": "Make the brass key materially affect the next event without opening the catalogue.",
        "DISCOVERY": "Reveal one bounded clue about the sealed catalogue without completing the objective.",
        "CONSEQUENCE": "Make an established choice produce a concrete cost inside the library.",
        "DILEMMA": "Force the active character to choose between protecting a name and following the fox.",
        "REVELATION": "Reinterpret an established clue while preserving every law of the Archive.",
        "RESTRICTION": "Continue the scene without adding a character or leaving the current room.",
        "CHARACTER": "Reveal a character motive through action or dialogue that changes the scene.",
        "ATMOSPHERE": "Make a library sound or texture materially change the character's decision.",
    }
    return {
        "category": category,
        "difficulty": difficulty,
        "instruction": instructions[category],
        "criteria": [
            "The requested narrative move must materially occur.",
            "The passage must preserve canon and every World Law.",
        ],
    }


FIRST_CONSTRAINT = constraint("CALLBACK", 1)


def address(value):
    from genlayer.py.types import Address

    return Address(value)


def mock_start(direct_vm, first: dict = FIRST_CONSTRAINT, valid: bool = True):
    direct_vm.mock_llm(GENERATOR_PROMPT, json.dumps(first))
    direct_vm.mock_llm(CONSTRAINT_REVIEW_PROMPT, json.dumps({"valid": valid}))


def mock_turn(
    direct_vm,
    *,
    accepted: bool,
    next_constraint: dict,
    progress: list[bool] | None = None,
    achieved: bool = False,
    reason: str = "The passage satisfies the challenge and preserves the established canon.",
    objective_reason: str = "The accepted canon supports some clues, but the complete objective is not yet proven.",
    violated_laws: list[int] | None = None,
    fate_text: str = "",
    reviewed_accepted: bool | None = None,
    reviewed_achieved: bool | None = None,
):
    objective_progress = progress if progress is not None else [False, False]
    direct_vm.mock_llm(
        TURN_PROMPT,
        json.dumps(
            {
                "accepted": accepted,
                "reason": reason,
                "violated_laws": violated_laws or [],
                "objective_progress": objective_progress,
                "objective_achieved": achieved,
                "objective_reason": objective_reason,
                "fate_text": fate_text,
                "next_constraint": next_constraint,
            }
        ),
    )
    direct_vm.mock_llm(
        TURN_REVIEW_PROMPT,
        json.dumps(
            {
                "accepted": accepted if reviewed_accepted is None else reviewed_accepted,
                "reason_valid": True,
                "violated_laws_valid": True,
                "objective_progress_valid": True,
                "objective_achieved": achieved if reviewed_achieved is None else reviewed_achieved,
                "objective_reason_valid": True,
                "fate_text_valid": True,
                "next_constraint_valid": True,
            }
        ),
    )


def deploy(direct_vm, direct_deploy, player):
    direct_vm.sender = player
    return direct_deploy(CONTRACT)


def create_world(
    contract,
    direct_vm,
    creator,
    *,
    name: str = WORLD_NAME,
    unlock: int = 3,
    deadline: int = 5,
    ink: int = 2,
):
    direct_vm.sender = creator
    contract.create_world(
        name,
        PREMISE,
        OPENING,
        "Mara",
        "An archivist whose own biography is disappearing one sentence at a time.",
        json.dumps(LAWS),
        OBJECTIVE,
        json.dumps(OBJECTIVE_CRITERIA),
        unlock,
        deadline,
        4,
        ink,
        300,
    )
    return name.lower().replace(" ", "-")


def create_join_start(
    contract,
    direct_vm,
    alice,
    bob,
    *,
    unlock: int = 3,
    deadline: int = 5,
    ink: int = 2,
):
    world_key = create_world(
        contract,
        direct_vm,
        alice,
        unlock=unlock,
        deadline=deadline,
        ink=ink,
    )
    direct_vm.sender = bob
    contract.join_world(
        world_key,
        "Theo",
        "A mapmaker who can hear erased names scratching beneath the floorboards.",
    )
    direct_vm.sender = alice
    mock_start(direct_vm)
    contract.start_world(world_key)
    return world_key


def submit_as_active(contract, direct_vm, world_key: str, **turn):
    world = contract.get_world(world_key)
    direct_vm.sender = address(world["active_player"])
    direct_vm.clear_mocks()
    mock_turn(direct_vm, **turn)
    contract.submit_passage(
        world_key,
        "The brass key chimed against the atlas, and the paper fox followed its echo toward a newly glowing shelf.",
    )


def test_named_world_directory_unique_name_join_and_start(
    direct_vm,
    direct_deploy,
    direct_alice,
    direct_bob,
    direct_charlie,
):
    contract = deploy(direct_vm, direct_deploy, direct_alice)
    world_key = create_world(contract, direct_vm, direct_alice)
    directory = contract.get_worlds()["worlds"]
    assert world_key == WORLD_KEY
    assert directory[0]["world_name"] == WORLD_NAME
    assert directory[0]["world_key"] == WORLD_KEY
    assert directory[0]["player_count"] == 1

    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("world_name_taken"):
        contract.create_world(
            "Direct--Test_World",
            PREMISE,
            OPENING,
            "Iris",
            "A careful traveller who records every clue in a silver notebook.",
            json.dumps(LAWS),
            OBJECTIVE,
            json.dumps(OBJECTIVE_CRITERIA),
            3,
            5,
            4,
            2,
            300,
        )

    direct_vm.sender = direct_bob
    contract.join_world(
        WORLD_NAME,
        "Theo",
        "A mapmaker who can hear erased names scratching beneath the floorboards.",
    )
    direct_vm.sender = direct_alice
    mock_start(direct_vm)
    contract.start_world(world_key)

    world = contract.get_world(WORLD_NAME)
    assert world["status"] == "ACTIVE"
    assert world["phase"] == "QUEST"
    assert world["current_scene"] == 1
    assert world["active_player"] == str(address(direct_alice)).lower()
    assert world["current_constraint"] == FIRST_CONSTRAINT
    assert contract.get_player_worlds(address(direct_bob))["worlds"][0]["world_key"] == WORLD_KEY
    assert direct_vm.run_validator() is True


def test_accepted_passage_advances_scene_but_respects_objective_lock(
    direct_vm,
    direct_deploy,
    direct_alice,
    direct_bob,
):
    contract = deploy(direct_vm, direct_deploy, direct_alice)
    world_key = create_join_start(contract, direct_vm, direct_alice, direct_bob)

    submit_as_active(
        contract,
        direct_vm,
        world_key,
        accepted=True,
        next_constraint=constraint("DISCOVERY", 1),
        progress=[True, False],
    )
    world = contract.get_world(world_key)
    assert world["current_scene"] == 2
    assert world["turn"] == 2
    assert world["objective_status"] == "LOCKED"
    assert world["objective_progress"] == [True, False]
    assert world["scores"] == [1, 0]
    assert len(world["story"]) == 2
    assert world["story"][-1]["kind"] == "SCENE"
    assert world["active_player"] == str(address(direct_bob)).lower()
    assert contract.get_profile(address(direct_alice))["accepted_scenes"] == 1
    assert direct_vm.run_validator() is True


def test_constraint_difficulty_is_canonicalized_from_scene_and_phase(
    direct_vm,
    direct_deploy,
    direct_alice,
    direct_bob,
):
    contract = deploy(direct_vm, direct_deploy, direct_alice)
    world_key = create_world(contract, direct_vm, direct_alice)
    direct_vm.sender = direct_bob
    contract.join_world(
        world_key,
        "Theo",
        "A mapmaker who can hear erased names scratching beneath the floorboards.",
    )

    direct_vm.sender = direct_alice
    mock_start(direct_vm, constraint("DISCOVERY", 3))
    contract.start_world(world_key)
    assert contract.get_world(world_key)["current_constraint"]["difficulty"] == 1

    submit_as_active(
        contract,
        direct_vm,
        world_key,
        accepted=True,
        next_constraint=constraint("CONSEQUENCE", 3),
        progress=[False, False],
    )
    world = contract.get_world(world_key)
    assert world["current_scene"] == 2
    assert world["current_constraint"]["difficulty"] == 1
    assert len(world["attempts"]) == 1
    assert direct_vm.run_validator() is True


def test_objective_cannot_complete_before_unlock_scene_and_state_is_atomic(
    direct_vm,
    direct_deploy,
    direct_alice,
    direct_bob,
):
    contract = deploy(direct_vm, direct_deploy, direct_alice)
    world_key = create_join_start(contract, direct_vm, direct_alice, direct_bob)
    before = contract.get_world(world_key)
    direct_vm.clear_mocks()
    mock_turn(
        direct_vm,
        accepted=True,
        next_constraint=constraint("DISCOVERY", 1),
        progress=[True, True],
        achieved=True,
        objective_reason="Both criteria appear fulfilled, so the objective should complete immediately.",
    )
    with direct_vm.expect_revert("incorrect_objective_achievement"):
        contract.submit_passage(
            world_key,
            "Mara declared the true index restored even though Scene Three had not yet begun.",
        )
    assert contract.get_world(world_key) == before


def test_objective_completion_creates_a_peaceful_shared_ending(
    direct_vm,
    direct_deploy,
    direct_alice,
    direct_bob,
):
    contract = deploy(direct_vm, direct_deploy, direct_alice)
    world_key = create_join_start(contract, direct_vm, direct_alice, direct_bob)

    submit_as_active(
        contract,
        direct_vm,
        world_key,
        accepted=True,
        next_constraint=constraint("DISCOVERY", 1),
        progress=[True, False],
    )
    submit_as_active(
        contract,
        direct_vm,
        world_key,
        accepted=True,
        next_constraint=constraint("CONSEQUENCE", 2),
        progress=[True, False],
    )
    submit_as_active(
        contract,
        direct_vm,
        world_key,
        accepted=True,
        next_constraint=constraint("DILEMMA", 2),
        progress=[True, True],
        achieved=True,
        objective_reason="The brass key opened the catalogue and the accepted names rebuilt the true index after its Scene Three gate.",
    )

    world = contract.get_world(world_key)
    assert world["status"] == "COMPLETE"
    assert world["phase"] == "PEACE"
    assert world["objective_status"] == "COMPLETED"
    assert world["outcome_type"] == "PEACE"
    assert world["winner"] == ""
    assert set(world["survivors"]) == {
        str(address(direct_alice)).lower(),
        str(address(direct_bob)).lower(),
    }
    assert contract.get_profile(address(direct_alice))["peaceful_wins"] == 1
    assert contract.get_profile(address(direct_bob))["peaceful_wins"] == 1
    assert contract.get_contract_state()["total_peaceful_worlds"] == 1


def test_deadline_enters_last_quill_and_a_rejection_selects_the_survivor(
    direct_vm,
    direct_deploy,
    direct_alice,
    direct_bob,
):
    contract = deploy(direct_vm, direct_deploy, direct_alice)
    world_key = create_join_start(
        contract,
        direct_vm,
        direct_alice,
        direct_bob,
        unlock=2,
        deadline=4,
        ink=3,
    )
    sequence = [
        ("DISCOVERY", 1),
        ("CONSEQUENCE", 2),
        ("DILEMMA", 2),
        ("REVELATION", 3),
    ]
    for category, difficulty in sequence:
        submit_as_active(
            contract,
            direct_vm,
            world_key,
            accepted=True,
            next_constraint=constraint(category, difficulty),
            progress=[True, False],
        )

    world = contract.get_world(world_key)
    assert world["phase"] == "LAST_QUILL"
    assert world["objective_status"] == "FAILED"
    assert world["current_scene"] == 5
    assert world["current_constraint"]["difficulty"] == 3

    losing_player = world["active_player"]
    surviving_player = next(
        player for player in world["players"] if player != losing_player
    )
    direct_vm.sender = address(losing_player)
    direct_vm.clear_mocks()
    mock_turn(
        direct_vm,
        accepted=False,
        next_constraint=constraint("RESTRICTION", 3),
        progress=[True, False],
        reason="The passage breaks the active restriction and cannot enter the established canon.",
        fate_text="The Archive pulled the failed writer's character into a blank margin, sealing their voice beyond the reach of every remaining page.",
    )
    contract.submit_passage(
        world_key,
        "The character ignored the challenge and tried to escape through a door forbidden by the World Laws.",
    )

    world = contract.get_world(world_key)
    losing_index = world["players"].index(losing_player)
    assert world["ink"][losing_index] == 0
    assert world["story"][-1]["kind"] == "FATE"
    assert world["status"] == "COMPLETE"
    assert world["phase"] == "SURVIVOR"
    assert world["winner"] == surviving_player
    assert contract.get_profile(address(surviving_player))["survivor_wins"] == 1


def test_quest_rejection_costs_ink_without_advancing_scene(
    direct_vm,
    direct_deploy,
    direct_alice,
    direct_bob,
):
    contract = deploy(direct_vm, direct_deploy, direct_alice)
    world_key = create_join_start(contract, direct_vm, direct_alice, direct_bob, ink=2)
    direct_vm.clear_mocks()
    mock_turn(
        direct_vm,
        accepted=False,
        next_constraint=constraint("DISCOVERY", 1),
        reason="The passage contradicts the locked setting and violates the first World Law.",
        violated_laws=[1],
    )
    contract.submit_passage(
        world_key,
        "Mara walked out of the Archive into daylight, abandoning every established clue behind her.",
    )
    world = contract.get_world(world_key)
    assert world["ink"] == [1, 2]
    assert world["current_scene"] == 1
    assert len(world["story"]) == 1
    assert world["attempts"][0]["violated_laws"] == [1]
    assert world["active_player"] == str(address(direct_bob)).lower()


def test_quill_clock_allows_the_next_writer_to_claim_an_expired_turn(
    direct_vm,
    direct_deploy,
    direct_alice,
    direct_bob,
):
    contract = deploy(direct_vm, direct_deploy, direct_alice)
    direct_vm.warp("2026-08-19T12:00:00Z")
    world_key = create_join_start(contract, direct_vm, direct_alice, direct_bob, ink=2)
    started = contract.get_world(world_key)
    assert started["turn_deadline"] == "2026-08-19T12:05:00Z"

    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("turn_window_active"):
        contract.claim_quill(world_key)

    direct_vm.warp("2026-08-19T12:05:00Z")
    direct_vm.clear_mocks()
    mock_start(direct_vm, constraint("DISCOVERY", 1))
    contract.claim_quill(world_key)

    world = contract.get_world(world_key)
    assert world["current_scene"] == 1
    assert world["turn"] == 2
    assert world["ink"] == [1, 2]
    assert world["active_player"] == str(address(direct_bob)).lower()
    assert world["attempts"][-1]["text"].startswith("[The Quill Clock expired")
    assert world["current_constraint"]["category"] == "DISCOVERY"
    assert world["turn_deadline"] == "2026-08-19T12:10:00Z"
    assert direct_vm.run_validator() is True


def test_final_quest_ink_generates_canonical_fate_and_ends_world(
    direct_vm,
    direct_deploy,
    direct_alice,
    direct_bob,
):
    contract = deploy(direct_vm, direct_deploy, direct_alice)
    world_key = create_join_start(contract, direct_vm, direct_alice, direct_bob, ink=1)
    fate = (
        "The library folded Mara into the atlas as a silent ink portrait, leaving "
        "the protected paper fox alive beside the unfinished route."
    )
    direct_vm.clear_mocks()
    mock_turn(
        direct_vm,
        accepted=False,
        next_constraint=constraint("DISCOVERY", 1),
        reason="The passage fails both challenge criteria and contradicts the established key.",
        fate_text=fate,
    )
    contract.submit_passage(
        world_key,
        "Mara threw away the key and announced that every problem had solved itself without explanation.",
    )
    world = contract.get_world(world_key)
    assert world["story"][-1]["text"] == fate
    assert world["story"][-1]["kind"] == "FATE"
    assert world["phase"] == "SURVIVOR"
    assert world["winner"] == str(address(direct_bob)).lower()


def test_validator_independently_rejects_conflicting_turn_decisions(
    direct_vm,
    direct_deploy,
    direct_alice,
    direct_bob,
):
    contract = deploy(direct_vm, direct_deploy, direct_alice)
    world_key = create_join_start(contract, direct_vm, direct_alice, direct_bob)
    direct_vm.clear_mocks()
    mock_turn(
        direct_vm,
        accepted=True,
        next_constraint=constraint("DISCOVERY", 1),
        progress=[True, False],
        reviewed_accepted=False,
    )
    contract.submit_passage(
        world_key,
        "The brass key rang against the atlas and revealed a catalogue symbol beneath the dust.",
    )
    assert direct_vm.run_validator() is False
    assert direct_vm.run_validator(leader_error=RuntimeError("leader failed")) is False


def test_creator_access_character_uniqueness_and_input_validation(
    direct_vm,
    direct_deploy,
    direct_alice,
    direct_bob,
    direct_charlie,
):
    contract = deploy(direct_vm, direct_deploy, direct_alice)
    world_key = create_world(contract, direct_vm, direct_alice)

    direct_vm.sender = direct_bob
    contract.join_world(
        world_key,
        "Theo",
        "A mapmaker who can hear erased names scratching beneath the floorboards.",
    )
    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("character_name_taken"):
        contract.join_world(
            world_key,
            "theo",
            "Another traveller attempting to use an existing character identity.",
        )
    with direct_vm.expect_revert("only_creator_can_start"):
        contract.start_world(world_key)

    direct_vm.sender = direct_alice
    mock_start(direct_vm)
    contract.start_world(world_key)
    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("not_your_turn"):
        contract.submit_passage(
            world_key,
            "A spectator attempts to add a passage without joining the active Story World.",
        )

    with direct_vm.expect_revert("invalid_world_laws"):
        contract.create_world(
            "Broken Rules",
            PREMISE,
            OPENING,
            "Iris",
            "A careful traveller who records every clue in a silver notebook.",
            "not-json",
            OBJECTIVE,
            json.dumps(OBJECTIVE_CRITERIA),
            3,
            5,
            4,
            2,
            300,
        )


@pytest.mark.parametrize(
    ("unlock", "deadline", "players", "ink", "turn_window", "message"),
    [
        (1, 5, 4, 2, 300, "invalid_objective_unlock_scene"),
        (11, 13, 4, 2, 300, "invalid_objective_unlock_scene"),
        (4, 5, 4, 2, 300, "invalid_objective_deadline_scene"),
        (3, 15, 4, 2, 300, "invalid_objective_deadline_scene"),
        (3, 5, 1, 2, 300, "invalid_max_players"),
        (3, 5, 9, 2, 300, "invalid_max_players"),
        (3, 5, 4, 0, 300, "invalid_starting_ink"),
        (3, 5, 4, 4, 300, "invalid_starting_ink"),
        (3, 5, 4, 2, 600, "invalid_turn_window"),
    ],
)
def test_world_configuration_validation(
    direct_vm,
    direct_deploy,
    direct_alice,
    unlock,
    deadline,
    players,
    ink,
    turn_window,
    message,
):
    contract = deploy(direct_vm, direct_deploy, direct_alice)
    with direct_vm.expect_revert(message):
        contract.create_world(
            WORLD_NAME,
            PREMISE,
            OPENING,
            "Mara",
            "An archivist whose own biography is disappearing one sentence at a time.",
            json.dumps(LAWS),
            OBJECTIVE,
            json.dumps(OBJECTIVE_CRITERIA),
            unlock,
            deadline,
            players,
            ink,
            turn_window,
        )
