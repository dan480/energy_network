#!/usr/bin/env python3
"""Run the custom panel in Chromium with a mocked Home Assistant frontend."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import shutil

from playwright.sync_api import sync_playwright


def build_smoke_document(root: Path) -> str:
    """Build a self-contained page so the browser needs no network navigation."""
    html_path = root / "docs/demo.html"
    frontend_path = root / "custom_components/electrical_network/frontend/electrical-network-panel.js"
    config_path = root / "examples/demo_diagram.json"

    html = html_path.read_text(encoding="utf-8")
    frontend = frontend_path.read_text(encoding="utf-8")
    config = json.loads(config_path.read_text(encoding="utf-8"))

    fetch_block = '''      const defaultConfig = await fetch("../examples/demo_diagram.json").then((response) => {
        if (!response.ok) throw new Error(`Cannot load demo JSON: ${response.status}`);
        return response.json();
      });
      await import("../custom_components/electrical_network/frontend/electrical-network-panel.js");
'''
    embedded_config = f"      const defaultConfig = {json.dumps(config, ensure_ascii=False)};\n"
    if fetch_block not in html:
        raise RuntimeError("The smoke page bootstrap block has changed")
    html = html.replace(fetch_block, embedded_config, 1)

    test_marker = '  <script type="module">\n    const status = document.getElementById("smoke-status");'
    if test_marker not in html:
        raise RuntimeError("The smoke page module marker has changed")
    frontend_module = (
        '  <script type="module">\n'
        f'{frontend}\n'
        '//# sourceURL=electrical-network-panel.js\n'
        '  </script>\n\n'
    )
    return html.replace(test_marker, frontend_module + test_marker, 1)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--output", type=Path)
    parser.add_argument("--chromium", default=shutil.which("chromium") or "/usr/bin/chromium")
    args = parser.parse_args()

    root = args.root.resolve()
    output = (args.output or root / "build/electrical-network-browser-smoke.png").resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    document = build_smoke_document(root)

    console_messages: list[str] = []
    page_errors: list[str] = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            executable_path=args.chromium,
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
        )
        page = browser.new_page(viewport={"width": 1672, "height": 941}, device_scale_factor=1)
        page.on("console", lambda message: console_messages.append(f"{message.type}: {message.text}"))
        page.on("pageerror", lambda error: page_errors.append(str(error)))
        page.set_content(document, wait_until="load", timeout=15_000)
        page.wait_for_function(
            "document.documentElement.dataset.testStatus === 'pass'",
            timeout=15_000,
        )
        page.screenshot(path=str(output), full_page=False)
        rendered_nodes = page.locator("electrical-network-panel").evaluate(
            "panel => panel.shadowRoot.querySelectorAll('[data-node-id]').length"
        )
        rendered_edges = page.locator("electrical-network-panel").evaluate(
            "panel => panel.shadowRoot.querySelectorAll('[data-edge-id]').length"
        )
        browser.close()

    if page_errors:
        raise RuntimeError("Browser page errors:\n" + "\n".join(page_errors))
    if not any("ELECTRICAL_NETWORK_SMOKE_PASS" in message for message in console_messages):
        details = "\n".join(console_messages[-20:])
        raise RuntimeError(f"The in-page smoke suite did not report success.\n{details}")

    print("Browser smoke test passed")
    print(f"Rendered nodes: {rendered_nodes}")
    print(f"Rendered edges: {rendered_edges}")
    print(f"Screenshot: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
