import json

import pytest

from conftest import (
    BEFORE_FIRST,
    COUNTER,
    CREATOR,
    DEADLINES_DATES,
    DEADLINES_TS,
    GEN,
    NO_FAN,
    PROOF,
    REVIEW,
    STATE,
    YES_FAN,
    as_sender,
)

GOAL = "Publish one article every week for 12 weeks"
WEEK0_URL = PROOF
WEEK1_URL = "https://example.com/week-1"
QUOTE = "Here is my weekly article number one"


def llm(verdict, quote=QUOTE, date="2026-10-19"):
    STATE["llm"] = json.dumps({"verdict": verdict, "quote": quote, "date": date})


def create(arena, stake=GEN, skips=0, dates=DEADLINES_DATES, ts=DEADLINES_TS):
    as_sender(CREATOR, stake)
    return arena.create_pact(GOAL, PROOF, dates, ts, skips)


def test_create_pact_requires_minimum_stake(arena):
    with pytest.raises(Exception, match="stake at least"):
        create(arena, stake=GEN // 100)


def test_create_pact_rejects_non_https_proof(arena):
    as_sender(CREATOR, GEN)
    with pytest.raises(Exception, match="https"):
        arena.create_pact(GOAL, "http://example.com", DEADLINES_DATES, DEADLINES_TS, 0)


def test_create_pact_rejects_unordered_deadlines(arena):
    with pytest.raises(Exception, match="increasing"):
        create(arena, ts=[DEADLINES_TS[1], DEADLINES_TS[0]])


def test_creator_cannot_bet_on_own_pact(arena):
    pid = create(arena)
    as_sender(CREATOR, GEN // 10)
    with pytest.raises(Exception, match="creator cannot bet"):
        arena.place_bet(pid, "YES", BEFORE_FIRST)


def test_one_side_per_market(arena):
    pid = create(arena)
    as_sender(NO_FAN, GEN // 10)
    arena.place_bet(pid, "NO", BEFORE_FIRST)
    as_sender(NO_FAN, GEN // 10)
    with pytest.raises(Exception, match="one side per market"):
        arena.place_bet(pid, "YES", BEFORE_FIRST)


def test_betting_closes_at_first_deadline(arena):
    pid = create(arena)
    as_sender(YES_FAN, GEN // 10)
    with pytest.raises(Exception, match="betting closes"):
        arena.place_bet(pid, "YES", DEADLINES_TS[0])


def test_completed_pact_pays_winning_side_pro_rata(arena):
    pid = create(arena)  # creator stakes 1 GEN on YES
    as_sender(YES_FAN, GEN // 2)
    arena.place_bet(pid, "YES", BEFORE_FIRST)
    as_sender(NO_FAN, GEN // 5)
    arena.place_bet(pid, "NO", BEFORE_FIRST)

    for week, url, ts in [(0, WEEK0_URL, DEADLINES_TS[0]), (1, WEEK1_URL, DEADLINES_TS[1])]:
        as_sender(CREATOR)
        STATE["render"][url] = "page"
        llm("HIT", date=DEADLINES_DATES[week])
        arena.check_in(pid, url, ts - 1000)
        arena.judge(pid, week, ts - 900)
        review_end = arena.get_board()[pid]["checkins"][week]["review_end"]
        arena.finalize(pid, week, review_end)

    board = arena.get_board()[pid]
    assert board["status"] == "COMPLETED"
    assert board["hits"] == 2

    # NO fan loses their bet; YES fan wins back stake plus a pro-rata share of the NO pool.
    as_sender(NO_FAN)
    with pytest.raises(Exception, match="nothing to claim"):
        arena.claim(pid)

    as_sender(YES_FAN)
    paid = arena.claim(pid)
    yes_pool = GEN + GEN // 2
    assert paid == GEN // 2 + (GEN // 2 * (GEN // 5)) // yes_pool
    with pytest.raises(Exception, match="nothing to claim"):
        arena.claim(pid)


def test_one_miss_breaks_pact_and_no_side_wins(arena):
    pid = create(arena)
    as_sender(NO_FAN, GEN // 5)
    arena.place_bet(pid, "NO", BEFORE_FIRST)

    as_sender(CREATOR)
    STATE["render"][WEEK0_URL] = "page"
    llm("MISS", quote="", date="")
    arena.check_in(pid, WEEK0_URL, BEFORE_FIRST)
    arena.judge(pid, 0, BEFORE_FIRST)
    review_end = arena.get_board()[pid]["checkins"][0]["review_end"]
    arena.finalize(pid, 0, review_end)

    assert arena.get_board()[pid]["status"] == "BROKEN"

    as_sender(NO_FAN)
    # Bet back plus the creator's forfeited stake, since the NO pool is 0.2 GEN.
    assert arena.claim(pid) == GEN // 5 + (GEN // 5 * GEN) // (GEN // 5)
    assert STATE["transfers"][-1] == (NO_FAN, GEN // 5 + GEN)


def test_skip_token_keeps_pact_alive(arena):
    pid = create(arena, skips=1)
    as_sender(CREATOR)
    STATE["render"][WEEK0_URL] = "page"
    llm("MISS", quote="", date="")
    arena.check_in(pid, WEEK0_URL, BEFORE_FIRST)
    arena.judge(pid, 0, BEFORE_FIRST)
    review_end = arena.get_board()[pid]["checkins"][0]["review_end"]
    arena.finalize(pid, 0, review_end)

    board = arena.get_board()[pid]
    assert board["status"] == "ACTIVE"
    assert board["checkins"][0]["outcome"] == "SKIPPED"
    assert board["skips_left"] == 0


def test_hit_dated_after_deadline_becomes_miss(arena):
    pid = create(arena)
    as_sender(CREATOR)
    STATE["render"][WEEK0_URL] = "page"
    llm("HIT", date="2026-10-25")  # after the 2026-10-20 deadline
    arena.check_in(pid, WEEK0_URL, BEFORE_FIRST)
    arena.judge(pid, 0, BEFORE_FIRST)
    assert arena.get_board()[pid]["checkins"][0]["verdict"] == "MISS"


def test_hit_without_quote_becomes_miss(arena):
    pid = create(arena)
    as_sender(CREATOR)
    STATE["render"][WEEK0_URL] = "page"
    llm("HIT", quote="short", date="2026-10-19")
    arena.check_in(pid, WEEK0_URL, BEFORE_FIRST)
    arena.judge(pid, 0, BEFORE_FIRST)
    assert arena.get_board()[pid]["checkins"][0]["verdict"] == "MISS"


def test_dispute_can_flip_a_hit_to_broken(arena):
    pid = create(arena)
    as_sender(CREATOR)
    STATE["render"][WEEK0_URL] = "page"
    llm("HIT")
    arena.check_in(pid, WEEK0_URL, BEFORE_FIRST)
    arena.judge(pid, 0, BEFORE_FIRST)

    as_sender(NO_FAN)
    STATE["render"][COUNTER] = "archived page shows the week was empty"
    arena.dispute(pid, 0, COUNTER, BEFORE_FIRST + 10)

    # The validators read the counter-evidence on finalize and now rule MISS.
    llm("MISS", quote="", date="")
    as_sender(NO_FAN)
    arena.finalize(pid, 0, BEFORE_FIRST + 20)
    assert arena.get_board()[pid]["status"] == "BROKEN"


def test_proposal_cannot_be_finalized_inside_review_window(arena):
    pid = create(arena)
    as_sender(CREATOR)
    STATE["render"][WEEK0_URL] = "page"
    llm("HIT")
    arena.check_in(pid, WEEK0_URL, BEFORE_FIRST)
    arena.judge(pid, 0, BEFORE_FIRST)
    with pytest.raises(Exception, match="review window still open"):
        arena.finalize(pid, 0, BEFORE_FIRST + 1)


def test_missed_week_recorded_after_deadline(arena):
    pid = create(arena)
    arena.mark_missed(pid, DEADLINES_TS[0] + 1)
    board = arena.get_board()[pid]
    assert board["status"] == "BROKEN"
    assert board["checkins"][0]["outcome"] == "MISS"


def test_cannot_mark_missed_before_deadline(arena):
    pid = create(arena)
    with pytest.raises(Exception, match="not overdue"):
        arena.mark_missed(pid, DEADLINES_TS[0])


def test_release_refunds_everyone_after_thirty_days(arena):
    pid = create(arena)
    as_sender(NO_FAN, GEN // 10)
    arena.place_bet(pid, "NO", BEFORE_FIRST)

    with pytest.raises(Exception, match="too early"):
        arena.release(pid, DEADLINES_TS[-1] + 1)

    arena.release(pid, DEADLINES_TS[-1] + 30 * 24 * 60 * 60 + 1)
    assert arena.get_board()[pid]["status"] == "REFUNDED"

    as_sender(NO_FAN)
    assert arena.claim(pid) == GEN // 10
    as_sender(CREATOR)
    assert arena.claim(pid) == GEN


def test_check_in_rejects_second_submission_before_finalize(arena):
    pid = create(arena)
    as_sender(CREATOR)
    STATE["render"][WEEK0_URL] = "page"
    llm("HIT")
    arena.check_in(pid, WEEK0_URL, BEFORE_FIRST)
    with pytest.raises(Exception, match="finish the open check-in"):
        arena.check_in(pid, WEEK1_URL, DEADLINES_TS[1] - 1)


def test_stats_reflect_pacts(arena):
    create(arena)
    stats = arena.get_stats()
    assert stats["pacts"] == 1
    assert stats["active"] == 1
    assert stats["total_wagered"] == GEN
