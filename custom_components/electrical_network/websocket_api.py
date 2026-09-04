"""WebSocket API for the Electrical Network editor."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from .const import DATA_STORES, DOMAIN
from .defaults import default_diagram
from .schema import DiagramValidationError
from .store import ElectricalNetworkStore, RevisionConflictError


def _get_store(hass: HomeAssistant, entry_id: str | None) -> ElectricalNetworkStore | None:
    domain_data = hass.data.get(DOMAIN, {})
    stores: dict[str, ElectricalNetworkStore] = domain_data.get(DATA_STORES, {})
    if entry_id:
        return stores.get(entry_id)
    if len(stores) == 1:
        return next(iter(stores.values()))
    return None


@websocket_api.websocket_command(
    {
        vol.Required("type"): "electrical_network/config/get",
        vol.Optional("entry_id"): str,
    }
)
@callback
def websocket_get_config(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return the saved diagram."""

    store = _get_store(hass, msg.get("entry_id"))
    if store is None:
        connection.send_error(
            msg["id"], websocket_api.ERR_NOT_FOUND, "Electrical Network entry not found"
        )
        return
    connection.send_result(msg["id"], store.snapshot())


@websocket_api.require_admin
@websocket_api.websocket_command(
    {
        vol.Required("type"): "electrical_network/config/save",
        vol.Optional("entry_id"): str,
        vol.Optional("revision"): vol.Any(None, vol.All(int, vol.Range(min=1))),
        vol.Required("config"): dict,
    }
)
@websocket_api.async_response
async def websocket_save_config(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Validate and persist a diagram."""

    store = _get_store(hass, msg.get("entry_id"))
    if store is None:
        connection.send_error(
            msg["id"], websocket_api.ERR_NOT_FOUND, "Electrical Network entry not found"
        )
        return
    try:
        result = await store.async_save(msg["config"], msg.get("revision"))
    except RevisionConflictError as err:
        connection.send_error(msg["id"], "revision_conflict", str(err))
        return
    except DiagramValidationError as err:
        connection.send_error(msg["id"], websocket_api.ERR_INVALID_FORMAT, str(err))
        return
    connection.send_result(msg["id"], result)


@websocket_api.require_admin
@websocket_api.websocket_command(
    {
        vol.Required("type"): "electrical_network/config/reset",
        vol.Optional("entry_id"): str,
        vol.Optional("revision"): vol.Any(None, vol.All(int, vol.Range(min=1))),
    }
)
@websocket_api.async_response
async def websocket_reset_config(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Replace the current document with the bundled demo diagram."""

    store = _get_store(hass, msg.get("entry_id"))
    if store is None:
        connection.send_error(
            msg["id"], websocket_api.ERR_NOT_FOUND, "Electrical Network entry not found"
        )
        return
    try:
        result = await store.async_save(default_diagram(), msg.get("revision"))
    except RevisionConflictError as err:
        connection.send_error(msg["id"], "revision_conflict", str(err))
        return
    connection.send_result(msg["id"], result)


@callback
def async_register_websocket_commands(hass: HomeAssistant) -> None:
    """Register all integration WebSocket commands."""

    websocket_api.async_register_command(hass, websocket_get_config)
    websocket_api.async_register_command(hass, websocket_save_config)
    websocket_api.async_register_command(hass, websocket_reset_config)
