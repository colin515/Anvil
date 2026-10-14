# Anvil — Your hardware. Your intelligence.

**Product website:** https://colin515.github.io/Anvil/  ·  **Windows installer:** [Download latest release](https://github.com/colin515/Anvil/releases/latest)

> **Website:** GitHub Pages is enabled. The repository-root site redirects to the standalone product/download page at [Anvil /docs](https://colin515.github.io/Anvil/docs/), while preserving the desktop app's Vite entry point. The public website does not host AI inference.

## Anvil v0.6 — Mobile chat and Studio workspace

Anvil runs local AI on your Windows PC using Ollama and serves a clean browser chat to devices on the **same private Wi-Fi / LAN**. It does **not** create an internet-exposed server or tunnel.

- **Wi-Fi chat link:** Anvil displays the actual address on your machine, such as `http://192.168.1.20:3000`. That IP is an **example only**; your address may differ.
- **Same-PC link:** `http://127.0.0.1:3000` after pressing **Start Wi-Fi server** in Anvil.
- **Optional access code:** on by default, visible in the desktop app. Turn it off in Settings or Wi-Fi host if all LAN users are trusted; you will receive a warning before disabling it.
- **Mobile-first chat:** compatible with Wi-Fi HTTP access on iOS and Android; unsupported Thinking mode removed.
- **One-click startup:** Starts Ollama when absent, auto-selects an already installed model, then starts the private Wi-Fi server; does not automatically download large models.
- **Unlimited conversation count / no chat quota:** no imposed per-hour chat count, and no 512-token output cap. Safety-size checks remain (1 MB HTTP body, 120k characters per message, up to 72 messages per model request), and a maximum of two *simultaneous* inference requests prevents resource exhaustion. The model's own context window still limits how much it can retain.
- **Saved chat history:** create, rename and delete chats. Conversations are saved **per browser/device** in local browser storage (not synchronized between devices); clearing site data erases them.
- **GPU usage:** live measured GPU-wide percentage on supported NVIDIA GPUs, Windows GPU-engine estimate as a fallback; this is **not** a precise AI-only utilization counter. Unsupported drivers display unavailable.
- **Stop AI / Shutdown:** Stop AI closes the chat server and asks Ollama to unload the active model from RAM/VRAM. Shut down Anvil also quits the desktop program; it does not kill an independently running Ollama service.
- The downloadable Windows installer is unsigned and meant for preview/personal testing.

## Browser workspace: Chat and Studio

The private Wi-Fi URL shown in Anvil (for example `http://192.168.1.20:3000`) now has two top-level tabs:

- **Chat:** redesigned mobile layout; first-message creation works on plain HTTP LAN pages where `crypto.randomUUID()` is unavailable. Stream parser accepts both incremental and buffered responses. New chats, saved local conversations, optional access code and optional Auto Refine remain available.
- **Studio:** local dashboard widgets, editable presentation slides, CSV/TSV/JSON chart explorer (bar, line, donut), process diagrams, report summaries and HTML exports, chart/template gallery, project search, snapshots, import/export JSON, custom themes, local profile and notification history, declarative plugin toggles, and an email draft launcher.

**Thinking selector has been removed.** Some models rejected its parameters. Anvil now uses default Ollama model behaviour for ordinary chat and Auto Refine.

Anvil Studio is a **local-first browser workspace**. Data belongs to that browser/device and is not automatically synced to other devices. Export your project or workspace backup regularly. Account creation, multi-user real-time collaboration, executable third-party plugins, Excel XLSX parsing, Google Analytics, AWS, Power BI, Tableau, and actual email sending/receiving need secured backend services and are **not implemented** in this version.

See [Studio feature status and roadmap](docs/FEATURE_STATUS.md) for what works and what still needs development.

### Connecting from a phone

1. Open Anvil on Windows and click **Start Everything**. Confirm Ollama has a model installed.
2. Use **Wi-Fi host → Copy Wi-Fi link** and open it on your phone connected to the same Wi-Fi (not the GitHub Pages marketing website).
3. Enter the access code from Anvil if you left code protection enabled.
4. Create a chat or open Studio using the top selector. If the previous version was cached, close the tab and reload. Test first with Auto Refine disabled.
5. Keep Anvil running. If the site doesn't load at all, allow inbound TCP 3000 on the Windows **Private** firewall profile and ensure the wireless network doesn't use client isolation.

**Security:** LAN HTTP is unencrypted. Do not expose TCP 3000 to the public internet or use this on untrusted Wi-Fi. The standalone GitHub Pages site is marketing/download only; it cannot connect to your private Ollama service.

## Automatic prompt completion

Open **Anvil's local browser chat** and enable **Auto refine** next to the Thinking control. Open the slider settings to configure:

- **Target self-rated confidence:** 50–99%, default **95%**.
- **Maximum attempts:** 1–6, default **4**, preventing runaway GPU usage.
- **Per-call timeout:** 30, 60, 120 or 240 seconds. The selected Ollama model and device determine actual speed.
- **Thinking effort:** Existing Off/Low/Medium/High settings still apply where Ollama supports them.

Each attempt generates an answer, then asks the **same local model** to review it for relevance, completeness, internal consistency and unsupported claims. Anvil shows progress and the model's score for each pass, revises the answer using feedback, and stops once the target is met or the maximum attempt count is reached. The final answer remains available even if the threshold is not reached; its outcome, score and reviewer feedback are saved with the conversation in that browser.

**Important:** A model rating its own answer at 95% does **not** establish a statistically calibrated 95% probability of factual accuracy. The reviewer has no external fact-checking or web verification. If the reviewer cannot return valid structured feedback, Anvil reports the review as unavailable instead of inventing a score. Each draft/review pair uses additional local inference time and resources. Press **Stop Generation** at any time.

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
6. The broken Thinking selector has been removed. Chat uses the model's normal behaviour.
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
