"""Tests for the diagram schema without requiring a Home Assistant runtime."""

from __future__ import annotations

from copy import deepcopy
from pathlib import Path
import runpy

import pytest

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = runpy.run_path(str(ROOT / "custom_components/electrical_network/schema.py"))
DEFAULTS = runpy.run_path(str(ROOT / "custom_components/electrical_network/defaults.py"))

DiagramValidationError = SCHEMA["DiagramValidationError"]
normalize_diagram = SCHEMA["normalize_diagram"]
default_diagram = DEFAULTS["default_diagram"]


def test_default_diagram_is_valid_and_detached() -> None:
    """The bundled document must validate and callers must get independent copies."""

    first = default_diagram()
    second = default_diagram()
    normalized = normalize_diagram(first)

    assert normalized["schema_version"] == 1
    assert normalized["title"] == "Электросхема дома"
    assert len(normalized["nodes"]) >= 10
    assert len(normalized["edges"]) >= 9

    first["nodes"][0]["name"] = "Changed"
    assert second["nodes"][0]["name"] == "Сеть"


def test_normalization_removes_unknown_fields() -> None:
    """Storage must not persist arbitrary client fields."""

    document = default_diagram()
    document["unexpected"] = "drop me"
    document["nodes"][0]["unexpected"] = {"secret": True}
    document["edges"][0]["unexpected"] = "drop me"

    normalized = normalize_diagram(document)

    assert "unexpected" not in normalized
    assert "unexpected" not in normalized["nodes"][0]
    assert "unexpected" not in normalized["edges"][0]


def test_rejects_directed_cycle() -> None:
    """An electrical flow graph cannot feed back into itself."""

    document = default_diagram()
    document["edges"].append(
        {
            "id": "cycle_edge",
            "source": "garage_light",
            "target": "grid",
            "source_port": "auto",
            "target_port": "auto",
            "label": "",
            "disabled": False,
            "entities": {"state": "", "power": ""},
        }
    )

    with pytest.raises(DiagramValidationError, match="directed cycle"):
        normalize_diagram(document)


def test_rejects_child_of_non_board() -> None:
    """Only a distribution board can own visually nested nodes."""

    document = default_diagram()
    document["nodes"][0]["parent_id"] = "main_breaker"

    with pytest.raises(DiagramValidationError, match="inside a board"):
        normalize_diagram(document)


def test_rejects_invalid_entity_id() -> None:
    """Entity IDs are restricted to the Home Assistant domain.object format."""

    document = default_diagram()
    document["nodes"][0]["entities"]["power"] = "Sensor.Grid Power"

    with pytest.raises(DiagramValidationError, match="valid Home Assistant entity ID"):
        normalize_diagram(document)


def test_rejects_duplicate_node_and_edge_ids() -> None:
    """Stable unique IDs are required for editing and revision-safe storage."""

    document = default_diagram()
    duplicate_node = deepcopy(document["nodes"][0])
    document["nodes"].append(duplicate_node)
    with pytest.raises(DiagramValidationError, match="Node IDs must be unique"):
        normalize_diagram(document)

    document = default_diagram()
    duplicate_edge = deepcopy(document["edges"][0])
    document["edges"].append(duplicate_edge)
    with pytest.raises(DiagramValidationError, match="Edge IDs must be unique"):
        normalize_diagram(document)


def test_rejects_duplicate_connection() -> None:
    """The same source-target connection can only be present once."""

    document = default_diagram()
    duplicate_edge = deepcopy(document["edges"][0])
    duplicate_edge["id"] = "second_edge_id"
    document["edges"].append(duplicate_edge)

    with pytest.raises(DiagramValidationError, match="Only one connection"):
        normalize_diagram(document)


def test_rejects_wrong_setting_types() -> None:
    """Boolean settings must not silently accept strings from imported JSON."""

    document = default_diagram()
    document["settings"]["allow_control"] = "yes"

    with pytest.raises(DiagramValidationError, match="must be true or false"):
        normalize_diagram(document)


def test_normalizes_numeric_values_and_defaults() -> None:
    """Integers and floats must be normalized predictably."""

    document = default_diagram()
    document["settings"]["grid_size"] = 25.8
    document["viewport"] = {}
    document["nodes"][0].pop("w")
    document["nodes"][0].pop("h")

    normalized = normalize_diagram(document)

    assert normalized["settings"]["grid_size"] == 25
    assert normalized["viewport"] == {"x": 0.0, "y": 0.0, "zoom": 1.0}
    assert normalized["nodes"][0]["w"] == 220.0
    assert normalized["nodes"][0]["h"] == 120.0
