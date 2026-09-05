"""Constants for the Electrical Network integration."""

from typing import Final

DOMAIN: Final = "electrical_network"
NAME: Final = "Electrical Network Designer"
VERSION: Final = "0.3.1"

CONF_PANEL_TITLE: Final = "panel_title"
CONF_SIDEBAR_ICON: Final = "sidebar_icon"
CONF_URL_PATH: Final = "url_path"

DEFAULT_PANEL_TITLE: Final = "Электросхема дома"
DEFAULT_SIDEBAR_ICON: Final = "mdi:transmission-tower"
DEFAULT_URL_PATH: Final = "electrical-network"

PANEL_WEB_COMPONENT: Final = "electrical-network-panel"
STATIC_URL: Final = "/electrical_network_static"
STATIC_JS_FILE: Final = "electrical-network-panel.js"

DATA_STORES: Final = "stores"
DATA_WEBSOCKET_REGISTERED: Final = "websocket_registered"
DATA_STATIC_REGISTERED: Final = "static_registered"
DATA_PANEL_PATHS: Final = "panel_paths"

STORAGE_VERSION: Final = 1
STORAGE_MINOR_VERSION: Final = 1
STORAGE_KEY_PREFIX: Final = "electrical_network"
