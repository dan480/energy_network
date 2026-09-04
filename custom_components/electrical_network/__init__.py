"""Electrical Network Designer custom integration."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.typing import ConfigType

from .const import (
    CONF_PANEL_TITLE,
    CONF_SIDEBAR_ICON,
    CONF_URL_PATH,
    DATA_PANEL_PATHS,
    DATA_STATIC_REGISTERED,
    DATA_STORES,
    DATA_WEBSOCKET_REGISTERED,
    DEFAULT_PANEL_TITLE,
    DEFAULT_SIDEBAR_ICON,
    DEFAULT_URL_PATH,
    DOMAIN,
    PANEL_WEB_COMPONENT,
    STATIC_JS_FILE,
    STATIC_URL,
    VERSION,
)
from .store import ElectricalNetworkStore
from .websocket_api import async_register_websocket_commands

_LOGGER = logging.getLogger(__name__)


def _domain_data(hass: HomeAssistant) -> dict[str, Any]:
    return hass.data.setdefault(
        DOMAIN,
        {
            DATA_STORES: {},
            DATA_PANEL_PATHS: {},
            DATA_WEBSOCKET_REGISTERED: False,
            DATA_STATIC_REGISTERED: False,
        },
    )


def _option(entry: ConfigEntry, key: str, default: str) -> str:
    value = entry.options.get(key, entry.data.get(key, default))
    return str(value)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Initialize domain-level data."""

    _domain_data(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up the editor, storage and sidebar panel."""

    data = _domain_data(hass)

    if not data[DATA_STATIC_REGISTERED]:
        frontend_dir = Path(__file__).parent / "frontend"
        await hass.http.async_register_static_paths(
            [StaticPathConfig(STATIC_URL, str(frontend_dir), True)]
        )
        data[DATA_STATIC_REGISTERED] = True

    store = ElectricalNetworkStore(hass, entry.entry_id)
    await store.async_load()
    data[DATA_STORES][entry.entry_id] = store

    if not data[DATA_WEBSOCKET_REGISTERED]:
        async_register_websocket_commands(hass)
        data[DATA_WEBSOCKET_REGISTERED] = True

    panel_path = _option(entry, CONF_URL_PATH, DEFAULT_URL_PATH)
    panel_title = _option(entry, CONF_PANEL_TITLE, DEFAULT_PANEL_TITLE)
    sidebar_icon = _option(entry, CONF_SIDEBAR_ICON, DEFAULT_SIDEBAR_ICON)

    try:
        await panel_custom.async_register_panel(
            hass,
            frontend_url_path=panel_path,
            webcomponent_name=PANEL_WEB_COMPONENT,
            sidebar_title=panel_title,
            sidebar_icon=sidebar_icon,
            module_url=f"{STATIC_URL}/{STATIC_JS_FILE}?v={VERSION}",
            config={
                "entry_id": entry.entry_id,
                "version": VERSION,
                "panel_title": panel_title,
            },
            require_admin=False,
        )
    except ValueError as err:
        data[DATA_STORES].pop(entry.entry_id, None)
        _LOGGER.error("Cannot register Electrical Network panel '%s': %s", panel_path, err)
        return False

    data[DATA_PANEL_PATHS][entry.entry_id] = panel_path
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload the panel while preserving its stored document."""

    data = _domain_data(hass)
    panel_path = data[DATA_PANEL_PATHS].pop(entry.entry_id, None)
    if panel_path:
        frontend.async_remove_panel(hass, panel_path)
    data[DATA_STORES].pop(entry.entry_id, None)
    return True
