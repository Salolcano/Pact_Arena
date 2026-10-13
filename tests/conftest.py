"""Local harness: stubs the `genlayer` SDK so the Intelligent Contract runs in plain Python.

The real runtime provides validators, web access and LLM calls. Here each of
those is a plain function the tests control, so the contract's own logic
(bets, check-ins, review windows, settlement, payouts) is what gets tested.
"""

import importlib.util
import pathlib
import sys
import types
from types import SimpleNamespace

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]


class _Deco:
    """Stands in for gl.public.write / .payable / .view: each is an identity decorator."""

    def __getattr__(self, name):
        return self

    def __call__(self, fn):
        return fn


class UserError(Exception):
    pass


class Addr:
    def __init__(self, hex_str):
        self.as_hex = hex_str


class _Message:
    sender_address = Addr("0x0")
    value = 0


class _RecipientStub:
    def __init__(self, addr):
        self.addr = addr

    def emit_transfer(self, value):
        STATE["transfers"].append((self.addr.as_hex, int(value)))


STATE = {"render": {}, "llm": "", "transfers": []}
MESSAGE = _Message()


def _render(url, mode="text"):
    return STATE["render"].get(url, "")


def _exec_prompt(task):
    return STATE["llm"]


def _identity(fn, criteria=None):
    return fn()


gl = SimpleNamespace(
    Contract=object,
    public=_Deco(),
    evm=SimpleNamespace(contract_interface=lambda cls: _RecipientStub),
    vm=SimpleNamespace(UserError=UserError),
    message=MESSAGE,
    nondet=SimpleNamespace(
        web=SimpleNamespace(render=_render),
        exec_prompt=_exec_prompt,
    ),
    eq_principle=SimpleNamespace(
        prompt_comparative=_identity,
        strict_eq=_identity,
    ),
)

stub = types.ModuleType("genlayer")
stub.gl = gl
stub.u256 = int
stub.Address = Addr
sys.modules["genlayer"] = stub


def _load_contract():
    spec = importlib.util.spec_from_file_location(
        "pact_arena", ROOT / "contracts" / "pact_arena.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


GEN = 10**18
CREATOR = "0xCreator"
YES_FAN = "0xYesFan"
NO_FAN = "0xNoFan"
PROOF = "https://example.com/week-0"
COUNTER = "https://example.com/counter"
DEADLINES_DATES = ["2026-10-20", "2026-10-27"]
DEADLINES_TS = [1792454400, 1793059200]  # 2026-10-20 / 2026-10-27 00:00 UTC-ish
BEFORE_FIRST = DEADLINES_TS[0] - 1000
REVIEW = 24 * 60 * 60


def as_sender(addr, value=0):
    MESSAGE.sender_address = Addr(addr)
    MESSAGE.value = value


@pytest.fixture
def arena():
    module = _load_contract()
    STATE["transfers"].clear()
    STATE["render"].clear()
    STATE["llm"] = ""
    return module.PactArena()


@pytest.fixture
def contract_module():
    return _load_contract()
