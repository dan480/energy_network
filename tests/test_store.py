"""Tests for persistent storage and optimistic locking with small HA stubs."""

from __future__ import annotations

import asyncio
from copy import deepcopy
import importlib.util
from pathlib import Path
import sys
import types

import pytest

ROOT = Path(__file__).resolve().parents[1]
PACKAGE_ROOT = ROOT / "custom_components/electrical_network"


class FakeStore:
    """Minimal replacement for homeassistant.helpers.storage.Store."""

    persisted: dict[str, object] = {}

    def __init__(self, hass, version, key, **kwargs):  # noqa: ANN001, ARG002
        self.key = key
        self.version = version
        self.kwargs = kwargs

    async def async_load(self):
        return deepcopy(self.persisted.get(self.key))

    async def async_save(self, value):
        self.persisted[self.key] = deepcopy(value)


def _load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def _load_store_module():
    """Load integration modules without importing their HA-dependent package init."""

    package_name = "electrical_network_testpkg"
    for name in list(sys.modules):
        if name == package_name or name.startswith(f"{package_name}."):
            sys.modules.pop(name)

    package = types.ModuleType(package_name)
    package.__path__ = [str(PACKAGE_ROOT)]
    sys.modules[package_name] = package

    homeassistant = types.ModuleType("homeassistant")
    core = types.ModuleType("homeassistant.core")
    helpers = types.ModuleType("homeassistant.helpers")
    storage = types.ModuleType("homeassistant.helpers.storage")
    core.HomeAssistant = object
    storage.Store = FakeStore
    homeassistant.core = core
    homeassistant.helpers = helpers
    helpers.storage = storage
    sys.modules["homeassistant"] = homeassistant
    sys.modules["homeassistant.core"] = core
    sys.modules["homeassistant.helpers"] = helpers
    sys.modules["homeassistant.helpers.storage"] = storage

    _load_module(f"{package_name}.const", PACKAGE_ROOT / "const.py")
    _load_module(f"{package_name}.defaults", PACKAGE_ROOT / "defaults.py")
    _load_module(f"{package_name}.schema", PACKAGE_ROOT / "schema.py")
    return _load_module(f"{package_name}.store", PACKAGE_ROOT / "store.py")


def test_store_initializes_and_saves() -> None:
    """First load must create a document and every save must increment revision."""

    module = _load_store_module()
    FakeStore.persisted.clear()
    store = module.ElectricalNetworkStore(object(), "entry-1")

    asyncio.run(store.async_load())
    first = store.snapshot()
    assert first["revision"] == 1
    assert first["config"]["title"] == "Электросхема дома"

    changed = deepcopy(first["config"])
    changed["title"] = "Дом и гараж"
    saved = asyncio.run(store.async_save(changed, expected_revision=1))

    assert saved["revision"] == 2
    assert saved["config"]["title"] == "Дом и гараж"
    assert FakeStore.persisted["electrical_network.entry-1"]["revision"] == 2


def test_store_rejects_stale_revision_without_mutation() -> None:
    """A stale browser must not overwrite a newer document."""

    module = _load_store_module()
    FakeStore.persisted.clear()
    store = module.ElectricalNetworkStore(object(), "entry-2")
    asyncio.run(store.async_load())

    original = store.snapshot()
    with pytest.raises(module.RevisionConflictError, match="Expected revision 99"):
        asyncio.run(store.async_save(original["config"], expected_revision=99))

    assert store.snapshot() == original


def test_store_rejects_invalid_document_before_mutation() -> None:
    """Server-side schema validation is mandatory even after client validation."""

    module = _load_store_module()
    FakeStore.persisted.clear()
    store = module.ElectricalNetworkStore(object(), "entry-3")
    asyncio.run(store.async_load())
    original = store.snapshot()

    invalid = deepcopy(original["config"])
    invalid["nodes"] = []
    with pytest.raises(module.DiagramValidationError):
        asyncio.run(store.async_save(invalid, expected_revision=1))

    assert store.snapshot() == original
