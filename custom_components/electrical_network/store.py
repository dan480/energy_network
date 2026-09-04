"""Persistent storage for Electrical Network diagrams."""

from __future__ import annotations

import asyncio
from copy import deepcopy
import logging
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import STORAGE_KEY_PREFIX, STORAGE_MINOR_VERSION, STORAGE_VERSION
from .defaults import default_diagram
from .schema import DiagramValidationError, normalize_diagram

_LOGGER = logging.getLogger(__name__)


class RevisionConflictError(RuntimeError):
    """Raised when a stale browser tries to overwrite newer data."""


class ElectricalNetworkStore:
    """Store one electrical network document for a config entry."""

    def __init__(self, hass: HomeAssistant, entry_id: str) -> None:
        """Initialize the store."""

        self._store: Store[dict[str, Any]] = Store(
            hass,
            STORAGE_VERSION,
            f"{STORAGE_KEY_PREFIX}.{entry_id}",
            minor_version=STORAGE_MINOR_VERSION,
            atomic_writes=True,
        )
        self._lock = asyncio.Lock()
        self._revision = 1
        self._config = default_diagram()

    @property
    def revision(self) -> int:
        """Return the current revision."""

        return self._revision

    def snapshot(self) -> dict[str, Any]:
        """Return a detached snapshot for the frontend."""

        return {"revision": self._revision, "config": deepcopy(self._config)}

    async def async_load(self) -> None:
        """Load saved data, or initialize a new document."""

        raw = await self._store.async_load()
        if raw is None:
            await self._store.async_save(self.snapshot())
            return

        try:
            revision = raw.get("revision", 1)
            if isinstance(revision, bool) or not isinstance(revision, int) or revision < 1:
                raise DiagramValidationError("Stored revision is invalid")
            self._revision = revision
            self._config = normalize_diagram(raw.get("config"))
        except (AttributeError, DiagramValidationError, TypeError, ValueError) as err:
            # Keep Home Assistant available even if the custom storage file was edited
            # manually. The invalid file remains visible in logs for recovery.
            _LOGGER.error(
                "Cannot load the saved electrical network; using the demo diagram: %s",
                err,
            )
            self._revision = 1
            self._config = default_diagram()

    async def async_save(
        self,
        config: dict[str, Any],
        expected_revision: int | None,
    ) -> dict[str, Any]:
        """Validate and save a document with optimistic locking."""

        normalized = normalize_diagram(config)
        async with self._lock:
            if expected_revision is not None and expected_revision != self._revision:
                raise RevisionConflictError(
                    f"Expected revision {expected_revision}, current revision is {self._revision}"
                )
            self._config = normalized
            self._revision += 1
            await self._store.async_save(self.snapshot())
            return self.snapshot()
