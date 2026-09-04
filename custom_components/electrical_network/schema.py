"""Validation and normalization for Electrical Network diagrams."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from copy import deepcopy
import math
import re
from typing import Any

NODE_TYPES = frozenset({"source", "breaker", "rcd", "board", "load", "meter", "junction"})
PORTS = frozenset({"auto", "left", "right", "top", "bottom"})
PHASES = frozenset({"all", "L1", "L2", "L3", "N", "DC", ""})
ENTITY_KEYS = (
    "state",
    "power",
    "current",
    "voltage",
    "energy",
    "frequency",
    "temperature",
)
MAX_NODES = 500
MAX_EDGES = 1000

_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
_ENTITY_ID_RE = re.compile(r"^[a-z0-9_]+\.[a-z0-9_]+$")
_ICON_RE = re.compile(r"^mdi:[a-z0-9-]+$")


class DiagramValidationError(ValueError):
    """Raised when a diagram cannot be accepted."""


def _mapping(value: Any, path: str) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise DiagramValidationError(f"{path} must be an object")
    return value


def _sequence(value: Any, path: str) -> Sequence[Any]:
    if not isinstance(value, Sequence) or isinstance(value, (str, bytes, bytearray)):
        raise DiagramValidationError(f"{path} must be an array")
    return value


def _string(value: Any, path: str, *, default: str = "", max_length: int = 200) -> str:
    if value is None:
        return default
    if not isinstance(value, str):
        raise DiagramValidationError(f"{path} must be a string")
    value = value.strip()
    if len(value) > max_length:
        raise DiagramValidationError(f"{path} is longer than {max_length} characters")
    return value


def _bool(value: Any, path: str, *, default: bool) -> bool:
    if value is None:
        return default
    if not isinstance(value, bool):
        raise DiagramValidationError(f"{path} must be true or false")
    return value


def _number(
    value: Any,
    path: str,
    *,
    default: float,
    minimum: float,
    maximum: float,
) -> float:
    if value is None:
        value = default
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise DiagramValidationError(f"{path} must be a number")
    result = float(value)
    if not math.isfinite(result) or result < minimum or result > maximum:
        raise DiagramValidationError(f"{path} must be between {minimum} and {maximum}")
    return result


def _entity_id(value: Any, path: str) -> str:
    result = _string(value, path, max_length=255)
    if result and not _ENTITY_ID_RE.fullmatch(result):
        raise DiagramValidationError(f"{path} is not a valid Home Assistant entity ID")
    return result


def _icon(value: Any, path: str, default: str) -> str:
    result = _string(value, path, default=default, max_length=80)
    if not _ICON_RE.fullmatch(result):
        raise DiagramValidationError(f"{path} must use the mdi:icon-name format")
    return result


def _default_icon(node_type: str) -> str:
    return {
        "source": "mdi:transmission-tower",
        "breaker": "mdi:electric-switch",
        "rcd": "mdi:shield-bolt",
        "board": "mdi:electric-switchboard",
        "load": "mdi:power-plug",
        "meter": "mdi:meter-electric",
        "junction": "mdi:source-branch",
    }[node_type]


def _normalize_entities(value: Any, path: str) -> dict[str, str]:
    source = _mapping(value or {}, path)
    return {key: _entity_id(source.get(key, ""), f"{path}.{key}") for key in ENTITY_KEYS}


def _normalize_demo(value: Any, path: str) -> dict[str, Any]:
    source = _mapping(value or {}, path)
    result: dict[str, Any] = {}
    state = source.get("state")
    if state is not None:
        result["state"] = _string(state, f"{path}.state", max_length=40)
    for key in ENTITY_KEYS:
        if key == "state" or source.get(key) is None:
            continue
        result[key] = _number(
            source.get(key),
            f"{path}.{key}",
            default=0,
            minimum=-1_000_000_000,
            maximum=1_000_000_000,
        )
    return result


def _normalize_settings(value: Any) -> dict[str, Any]:
    source = _mapping(value or {}, "settings")
    summary_entities = _mapping(source.get("summary_entities", {}), "settings.summary_entities")
    summary_demo = _mapping(source.get("summary_demo", {}), "settings.summary_demo")

    normalized_summary_entities = {
        key: _entity_id(summary_entities.get(key, ""), f"settings.summary_entities.{key}")
        for key in ("power", "energy", "current", "voltage", "frequency")
    }
    normalized_summary_demo = {
        "power": _number(
            summary_demo.get("power"),
            "settings.summary_demo.power",
            default=0,
            minimum=-1_000_000_000,
            maximum=1_000_000_000,
        ),
        "energy": _number(
            summary_demo.get("energy"),
            "settings.summary_demo.energy",
            default=0,
            minimum=-1_000_000_000,
            maximum=1_000_000_000,
        ),
        "current": _number(
            summary_demo.get("current"),
            "settings.summary_demo.current",
            default=0,
            minimum=-1_000_000,
            maximum=1_000_000,
        ),
        "voltage": _number(
            summary_demo.get("voltage"),
            "settings.summary_demo.voltage",
            default=230,
            minimum=-1_000_000,
            maximum=1_000_000,
        ),
        "frequency": _number(
            summary_demo.get("frequency"),
            "settings.summary_demo.frequency",
            default=50,
            minimum=0,
            maximum=1_000_000,
        ),
    }
    return {
        "demo_mode": _bool(source.get("demo_mode"), "settings.demo_mode", default=True),
        "auto_save": _bool(source.get("auto_save"), "settings.auto_save", default=True),
        "allow_control": _bool(
            source.get("allow_control"), "settings.allow_control", default=False
        ),
        "flow_threshold_w": _number(
            source.get("flow_threshold_w"),
            "settings.flow_threshold_w",
            default=3,
            minimum=0,
            maximum=1_000_000,
        ),
        "grid_size": int(
            _number(
                source.get("grid_size"),
                "settings.grid_size",
                default=20,
                minimum=5,
                maximum=200,
            )
        ),
        "show_grid": _bool(source.get("show_grid"), "settings.show_grid", default=True),
        "show_phase_balance": _bool(
            source.get("show_phase_balance"),
            "settings.show_phase_balance",
            default=True,
        ),
        "summary_entities": normalized_summary_entities,
        "summary_demo": normalized_summary_demo,
    }


def _normalize_node(value: Any, index: int) -> dict[str, Any]:
    path = f"nodes[{index}]"
    source = _mapping(value, path)
    node_id = _string(source.get("id"), f"{path}.id", max_length=64)
    if not _ID_RE.fullmatch(node_id):
        raise DiagramValidationError(f"{path}.id contains unsupported characters")

    node_type = _string(source.get("type"), f"{path}.type", max_length=32)
    if node_type not in NODE_TYPES:
        raise DiagramValidationError(f"{path}.type is unsupported")

    phase = _string(source.get("phase", ""), f"{path}.phase", max_length=8)
    if phase not in PHASES:
        raise DiagramValidationError(f"{path}.phase is unsupported")

    default_width = 410 if node_type == "board" else 220
    default_height = 320 if node_type == "board" else 120

    return {
        "id": node_id,
        "type": node_type,
        "name": _string(source.get("name"), f"{path}.name", default=node_id, max_length=120),
        "description": _string(
            source.get("description"), f"{path}.description", max_length=500
        ),
        "icon": _icon(source.get("icon"), f"{path}.icon", _default_icon(node_type)),
        "x": _number(
            source.get("x"), f"{path}.x", default=0, minimum=-100_000, maximum=100_000
        ),
        "y": _number(
            source.get("y"), f"{path}.y", default=0, minimum=-100_000, maximum=100_000
        ),
        "w": _number(
            source.get("w"),
            f"{path}.w",
            default=default_width,
            minimum=100,
            maximum=1_500,
        ),
        "h": _number(
            source.get("h"),
            f"{path}.h",
            default=default_height,
            minimum=60,
            maximum=1_500,
        ),
        "phase": phase,
        "nominal": _string(source.get("nominal"), f"{path}.nominal", max_length=60),
        "parent_id": _string(source.get("parent_id"), f"{path}.parent_id", max_length=64),
        "entities": _normalize_entities(source.get("entities", {}), f"{path}.entities"),
        "demo": _normalize_demo(source.get("demo", {}), f"{path}.demo"),
    }


def _normalize_edge(value: Any, index: int) -> dict[str, Any]:
    path = f"edges[{index}]"
    source = _mapping(value, path)
    edge_id = _string(source.get("id"), f"{path}.id", max_length=64)
    if not _ID_RE.fullmatch(edge_id):
        raise DiagramValidationError(f"{path}.id contains unsupported characters")

    source_port = _string(source.get("source_port", "auto"), f"{path}.source_port", max_length=8)
    target_port = _string(source.get("target_port", "auto"), f"{path}.target_port", max_length=8)
    if source_port not in PORTS or target_port not in PORTS:
        raise DiagramValidationError(f"{path} uses an unsupported port")

    entities = _mapping(source.get("entities", {}), f"{path}.entities")
    return {
        "id": edge_id,
        "source": _string(source.get("source"), f"{path}.source", max_length=64),
        "target": _string(source.get("target"), f"{path}.target", max_length=64),
        "source_port": source_port,
        "target_port": target_port,
        "label": _string(source.get("label"), f"{path}.label", max_length=100),
        "disabled": _bool(source.get("disabled"), f"{path}.disabled", default=False),
        "entities": {
            "state": _entity_id(entities.get("state", ""), f"{path}.entities.state"),
            "power": _entity_id(entities.get("power", ""), f"{path}.entities.power"),
        },
    }


def _assert_acyclic(nodes: list[dict[str, Any]], edges: list[dict[str, Any]]) -> None:
    adjacency: dict[str, list[str]] = {node["id"]: [] for node in nodes}
    indegree: dict[str, int] = {node["id"]: 0 for node in nodes}
    for edge in edges:
        adjacency[edge["source"]].append(edge["target"])
        indegree[edge["target"]] += 1

    queue = [node_id for node_id, count in indegree.items() if count == 0]
    visited = 0
    while queue:
        node_id = queue.pop()
        visited += 1
        for target in adjacency[node_id]:
            indegree[target] -= 1
            if indegree[target] == 0:
                queue.append(target)
    if visited != len(nodes):
        raise DiagramValidationError("The electrical network contains a directed cycle")


def normalize_diagram(value: Any) -> dict[str, Any]:
    """Validate a client-provided diagram and return a normalized copy."""

    source = _mapping(value, "diagram")
    raw_nodes = _sequence(source.get("nodes", []), "nodes")
    raw_edges = _sequence(source.get("edges", []), "edges")
    if not raw_nodes:
        raise DiagramValidationError("The diagram must contain at least one node")
    if len(raw_nodes) > MAX_NODES:
        raise DiagramValidationError(f"The diagram cannot contain more than {MAX_NODES} nodes")
    if len(raw_edges) > MAX_EDGES:
        raise DiagramValidationError(f"The diagram cannot contain more than {MAX_EDGES} edges")

    nodes = [_normalize_node(node, index) for index, node in enumerate(raw_nodes)]
    node_ids = [node["id"] for node in nodes]
    if len(node_ids) != len(set(node_ids)):
        raise DiagramValidationError("Node IDs must be unique")
    node_by_id = {node["id"]: node for node in nodes}

    for node in nodes:
        parent_id = node["parent_id"]
        if not parent_id:
            continue
        if parent_id == node["id"]:
            raise DiagramValidationError(f"Node {node['id']} cannot be its own parent")
        parent = node_by_id.get(parent_id)
        if parent is None:
            raise DiagramValidationError(f"Node {node['id']} references an unknown parent")
        if parent["type"] != "board":
            raise DiagramValidationError(f"Node {node['id']} can only be placed inside a board")

    # Parent nesting also has to stay acyclic.
    for node in nodes:
        current = node
        seen: set[str] = set()
        while current["parent_id"]:
            parent_id = current["parent_id"]
            if parent_id in seen:
                raise DiagramValidationError("Board nesting contains a cycle")
            seen.add(parent_id)
            current = node_by_id[parent_id]

    edges = [_normalize_edge(edge, index) for index, edge in enumerate(raw_edges)]
    edge_ids = [edge["id"] for edge in edges]
    if len(edge_ids) != len(set(edge_ids)):
        raise DiagramValidationError("Edge IDs must be unique")

    pairs: set[tuple[str, str]] = set()
    for edge in edges:
        if edge["source"] not in node_by_id or edge["target"] not in node_by_id:
            raise DiagramValidationError(f"Edge {edge['id']} references an unknown node")
        if edge["source"] == edge["target"]:
            raise DiagramValidationError(f"Edge {edge['id']} cannot connect a node to itself")
        pair = (edge["source"], edge["target"])
        if pair in pairs:
            raise DiagramValidationError(
                f"Only one connection from {edge['source']} to {edge['target']} is allowed"
            )
        pairs.add(pair)

    _assert_acyclic(nodes, edges)

    viewport = _mapping(source.get("viewport", {}), "viewport")
    normalized = {
        "schema_version": 1,
        "title": _string(source.get("title"), "title", default="Электросхема дома", max_length=120),
        "settings": _normalize_settings(source.get("settings", {})),
        "viewport": {
            "x": _number(
                viewport.get("x"), "viewport.x", default=0, minimum=-100_000, maximum=100_000
            ),
            "y": _number(
                viewport.get("y"), "viewport.y", default=0, minimum=-100_000, maximum=100_000
            ),
            "zoom": _number(
                viewport.get("zoom"), "viewport.zoom", default=1, minimum=0.15, maximum=3
            ),
        },
        "nodes": nodes,
        "edges": edges,
    }
    return deepcopy(normalized)
