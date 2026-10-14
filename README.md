# Anvil — Your hardware. Your intelligence.

**Product website:** https://colin515.github.io/Anvil/  ·  **Windows installer:** [Download latest release](https://github.com/colin515/Anvil/releases/latest)

> **Website:** GitHub Pages is enabled. The repository-root site redirects to the standalone product/download page at [Anvil /docs](https://colin515.github.io/Anvil/docs/), while preserving the desktop app's Vite entry point. The public website does not host AI inference.

## Anvil v0.4 — One-click Ollama startup, Wi-Fi chat and thinking controls

Anvil runs local AI on your Windows PC using Ollama and serves a clean browser chat to devices on the **same private Wi-Fi / LAN**. It does **not** create an internet-exposed server or tunnel.

- **Wi-Fi chat link:** Anvil displays the actual address on your machine, such as `http://192.168.1.20:3000`. That IP is an **example only**; your address may differ.
- **Same-PC link:** `http://127.0.0.1:3000` after pressing **Start Wi-Fi server** in Anvil.
- **Optional access code:** on by default, visible in the desktop app. Turn it off in Settings or Wi-Fi host if all LAN users are trusted; you will receive a warning before disabling it.
- **Thinking effort:** Off / Low / Medium / High in the browser chat, sent to Ollama where supported. GPT-OSS supports graded reasoning effort; not every model distinguishes the three levels.
- **One-click startup:** Starts Ollama when absent, auto-selects an already installed model, then starts the private Wi-Fi server; does not automatically download large models.
- **Unlimited conversation count / no chat quota:** no imposed per-hour chat count, and no 512-token output cap. Safety-size checks remain (1 MB HTTP body, 120k characters per message, up to 72 messages per model request), and a maximum of two *simultaneous* inference requests prevents resource exhaustion. The model's own context window still limits how much it can retain.
- **Saved chat history:** create, rename and delete chats. Conversations are saved **per browser/device** in local browser storage (not synchronized between devices); clearing site data erases them.
- **GPU usage:** live measured GPU-wide percentage on supported NVIDIA GPUs, Windows GPU-engine estimate as a fallback; this is **not** a precise AI-only utilization counter. Unsupported drivers display unavailable.
- **Stop AI / Shutdown:** Stop AI closes the chat server and asks Ollama to unload the active model from RAM/VRAM. Shut down Anvil also quits the desktop program; it does not kill an independently running Ollama service.
- The downloadable Windows installer is unsigned and meant for preview/personal testing.

## Setup

1. Install [Ollama for Windows](https://ollama.com/download/windows), then install the latest Anvil Windows release.
2. Download at least one model under **My models**, either within Anvil or via Ollama. Model downloads are never started automatically without your choice.
3. Click **Start Everything** on the **Overview** screen. It checks whether Ollama is already running, starts it if needed, selects an installed model when necessary and starts the private Wi-Fi host. A separate Start Wi-Fi server button remains available in the host console for manual setup.
4. Copy the Wi-Fi address shown by Anvil and open it from any device connected to the same private Wi-Fi. If access-code protection is enabled, enter the code shown in the Windows app.
5. If other devices cannot connect, ensure your network is set to **Private** in Windows and allow Anvil's inbound TCP port 3000 on the **Private** firewall profile (not Public). Avoid guest Wi-Fi with client isolation. You can use an elevated PowerShell terminal to create a narrowly scoped rule:
   ```powershell
   New-NetFirewallRule -DisplayName "Anvil Wi-Fi AI" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 -Profile Private
   ```
   Only run this on a trusted private network. Don't configure router port-forwarding.
6. In the browser chat, adjust **Thinking** between **Off, Low, Medium and High**. Ollama reasoning support varies by model: GPT-OSS supports graded levels; many models only support on/off; models without reasoning capability may reject an enabled setting. Choose Off if this happens.
7. When finished, press **Stop hosting**, **Stop AI and unload model**, or **Shut down Anvil**. Anvil stops only Ollama processes that it launched itself; externally managed Ollama services are left alone.

**Security:** Local Wi-Fi HTTP traffic is not encrypted by TLS. Use only on trusted LANs. Anyone sharing your private network could potentially observe unencrypted traffic; keep access codes enabled where appropriate. Do not forward TCP port 3000 to the public internet.

## Development

```powershell
npm ci
npm run check
npm run build
npm run desktop
# Or to create the Windows installer:
npm run package:win
```

Node.js 22 is required for building from source (not for installing a packaged release). Website source is in `docs/`; chat and desktop sources are in `src/`, with Electron backend in `electron/`. GitHub Actions builds and tests the Windows installer.

## License

No open-source license has yet been selected. Choose one before expecting external contributions or redistributing modified versions.
