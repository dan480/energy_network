"""Static consistency checks for the distributable custom integration."""

from __future__ import annotations

import json
from pathlib import Path
import re
import runpy

ROOT = Path(__file__).resolve().parents[1]
COMPONENT = ROOT / "custom_components/electrical_network"


def test_manifest_and_hacs_metadata_are_consistent() -> None:
    manifest = json.loads((COMPONENT / "manifest.json").read_text(encoding="utf-8"))
    hacs = json.loads((ROOT / "hacs.json").read_text(encoding="utf-8"))

    assert manifest["domain"] == "electrical_network"
    assert re.fullmatch(r"\d+\.\d+\.\d+", manifest["version"])
    assert manifest["config_flow"] is True
    assert manifest["single_config_entry"] is True
    assert manifest["integration_type"] == "service"
    assert manifest["iot_class"] == "calculated"
    assert set(manifest["dependencies"]) == {
        "frontend",
        "http",
        "panel_custom",
        "websocket_api",
    }
    assert hacs["homeassistant"] == "2025.12.0"


def test_frontend_version_matches_manifest_and_has_no_remote_runtime_dependency() -> None:
    manifest = json.loads((COMPONENT / "manifest.json").read_text(encoding="utf-8"))
    source = (COMPONENT / "frontend/electrical-network-panel.js").read_text(encoding="utf-8")

    assert f'const ELECTRICAL_NETWORK_VERSION = "{manifest["version"]}";' in source
    assert "https://" not in source
    assert source.count("http://") == 1
    assert 'xmlns="http://www.w3.org/2000/svg"' in source
    assert "eval(" not in source
    assert 'customElements.define("electrical-network-panel"' in source


def test_translations_have_required_config_flow_keys() -> None:
    for path in [COMPONENT / "strings.json", *sorted((COMPONENT / "translations").glob("*.json"))]:
        data = json.loads(path.read_text(encoding="utf-8"))
        user = data["config"]["step"]["user"]
        options = data["options"]["step"]["init"]
        for section in (user, options):
            assert set(section["data"]) == {"panel_title", "sidebar_icon", "url_path"}


def test_example_document_matches_server_schema() -> None:
    schema = runpy.run_path(str(COMPONENT / "schema.py"))
    document = json.loads((ROOT / "examples/demo_diagram.json").read_text(encoding="utf-8"))
    normalized = schema["normalize_diagram"](document)

    assert normalized["title"] == document["title"]
    assert len(normalized["nodes"]) == len(document["nodes"])
    assert len(normalized["edges"]) == len(document["edges"])
