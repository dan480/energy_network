"""Config flow for Electrical Network Designer."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.config_entries import ConfigFlowResult, OptionsFlowWithReload
from homeassistant.core import callback
from homeassistant.helpers import config_validation as cv

from .const import (
    CONF_PANEL_TITLE,
    CONF_SIDEBAR_ICON,
    CONF_URL_PATH,
    DEFAULT_PANEL_TITLE,
    DEFAULT_SIDEBAR_ICON,
    DEFAULT_URL_PATH,
    DOMAIN,
)

_URL_PATH = vol.All(cv.string, vol.Match(r"^[a-z0-9][a-z0-9_-]*$"))


def _schema(values: dict[str, Any] | None = None) -> vol.Schema:
    values = values or {}

    return vol.Schema(
        {
            vol.Required(
                CONF_PANEL_TITLE,
                default=values.get(
                    CONF_PANEL_TITLE,
                    DEFAULT_PANEL_TITLE,
                ),
            ): cv.string,

            vol.Required(
                CONF_SIDEBAR_ICON,
                default=values.get(
                    CONF_SIDEBAR_ICON,
                    DEFAULT_SIDEBAR_ICON,
                ),
            ): cv.string,

            vol.Required(
                CONF_URL_PATH,
                default=values.get(
                    CONF_URL_PATH,
                    DEFAULT_URL_PATH,
                ),
            ): _URL_PATH,
        }
    )


class ElectricalNetworkConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle setup of the Electrical Network panel."""

    VERSION = 1

    @staticmethod
    @callback
    def async_get_options_flow(
        config_entry: config_entries.ConfigEntry,
    ) -> ElectricalNetworkOptionsFlow:
        """Return the options flow."""

        return ElectricalNetworkOptionsFlow()

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Create the single local configuration entry."""

        if self._async_current_entries():
            return self.async_abort(reason="already_configured")

        if user_input is not None:
            return self.async_create_entry(
                title=user_input[CONF_PANEL_TITLE],
                data=user_input,
            )

        return self.async_show_form(
            step_id="user",
            data_schema=_schema(),
        )


class ElectricalNetworkOptionsFlow(OptionsFlowWithReload):
    """Allow changing sidebar presentation without reinstalling."""

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Manage integration options."""

        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        values = dict(self.config_entry.data)
        values.update(self.config_entry.options)
        return self.async_show_form(step_id="init", data_schema=_schema(values))
