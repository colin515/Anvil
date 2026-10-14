# Anvil — Your hardware. Your intelligence.

**Website:** [https://colin515.github.io/Anvil/](https://colin515.github.io/Anvil/) · **Windows download:** [Anvil-Setup.exe](https://github.com/colin515/Anvil/releases/download/v0.1.0-preview/Anvil-Setup.exe) · [Releases](https://github.com/colin515/Anvil/releases)

> **Website activation required:** The product website is already included in `docs/`, but GitHub Pages must first be enabled in **Repository Settings → Pages → Build and deployment → Source → GitHub Actions**. Then run **Actions → Publish Anvil website → Run workflow**. Until GitHub Pages is enabled, the website link above will not load.

An early **Windows desktop MVP** that turns an Ollama-powered PC into a local AI host, with a visitor chat that can optionally be shared through Cloudflare Quick Tunnels. Includes a premium marketing website for **GitHub Pages** and GitHub Actions to package a downloadable Windows installer.

> **Status:** Working source implementation / early personal-testing MVP. This repository does not bundle Ollama, sign its installer, or claim production-grade public hosting security. Hardware fit scores are estimates, not guaranteed speeds. The app must be built on Windows for the installer.

## Product

- Guided onboarding: welcome → real hardware scan → purpose → optional benchmark → fit recommendations → model download → local host → public share.
- Windows hardware scan via PowerShell CIM (`Win32_VideoController`, `Win32_LogicalDisk`) plus CPU/RAM via Node `os`.
- Ollama model discovery, model downloads with true byte counters, local benchmark via Ollama's generation telemetry.
- Electron desktop app with context isolation, safe IPC allowlist, dashboard, model library, host console and settings.
- Local browser chat server bound to **127.0.0.1**. Invite code required for visitor inference. Chat streams actual Ollama tokens.
- Optional temporary public URL via externally installed `cloudflared`; immediate offline shutdown.
- Responsive product website in `docs/` for GitHub Pages, with an automatically detected downloadable GitHub Release asset.

## Requirements

- Windows 10 or 11, 64-bit.
- Node.js 22 to **build from source** (end users do not need Node if installing a packaged release).
- [Ollama for Windows](https://ollama.com/download/windows), running on `127.0.0.1:11434`, required for model download and inference.
- Optional [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) binary available on `PATH` for public sharing.

## Development

```powershell
npm install --no-audit --no-fund
# Terminal 1 — Vite (the desktop is an Electron window)
npm run dev
# Terminal 2 — Electron
npm run desktop:dev
```

Or build and run the packaged interface locally:

```powershell
npm run check
npm run build
npm run desktop
```

Run the Windows installer packaging step:

```powershell
npm run package:win
```

Output: `release/Anvil-Setup.exe`. **Do not distribute an installer that has not been built, scanned and tested on a Windows PC.** Unsigned installers may trigger SmartScreen warnings.

## How hosting works

1. Download a model through Ollama or select an already installed model. **Set it active** in Anvil.
2. Choose **Start local server**. Anvil serves its visitor chat only on a random loopback port. This alone does not open access to the internet.
3. If you installed `cloudflared`, select **Go public**. It requests an ephemeral `*.trycloudflare.com` address.
4. Share both the public URL and the *separate invite code* with intended visitors. Visitors authenticate via an HTTP-only, secure session cookie; they can send up to 30 messages per hour, with 2 concurrent requests across the host.
5. Select **Go offline** to close the local server, destroy visitor sessions, and stop the tunnel.

The website in `docs/` is **not** the chat host. GitHub Pages serves a public product page and download link. Actual AI inference runs on the Windows PC hosting Anvil.

### Important security limitations

Quick Tunnels are intended for development and experimentation, not hardened production hosting. This MVP has basic invite-code protection, per-IP login throttling, limited chat input and concurrency, and a 12-hour session lifetime. It has **no accounts database, audit policy, CSRF token, billing, durable user management, abuse moderation or service isolation**. Host PC or Ollama failures will interrupt chat. Do not expose proprietary models or confidential data to untrusted users. Your local Ollama endpoint must **not** be exposed directly to the internet.

## Publishing to GitHub

Repository: **https://github.com/colin515/Anvil**. The project uses GitHub Actions to test source, build a Windows installer and deploy the product website.

1. Push this project's contents to the `main` branch.
2. In **Settings → Pages**, choose **GitHub Actions** as the source. **This initial activation must be made by the repository owner:** GitHub Actions tokens cannot create a Pages site if repository administration blocks it. Then open **Actions → Publish Anvil website → Run workflow** to deploy `docs/` to `https://colin515.github.io/Anvil/`.
3. Run `npm install` (Node 22). The workflows install dependencies on the hosted runners.
4. After checking the Windows build locally, push a version tag, e.g. `git tag v0.1.0 && git push origin v0.1.0`. The release workflow builds on `windows-latest` and uploads **Anvil-Setup.exe** as a GitHub Release asset.
5. The public website reads GitHub's latest release API. The download button becomes a direct `.exe` link once `Anvil-Setup.exe` is published. Until then it links to the Releases page without claiming an installer exists.

If the repository owner or name differs from `<username>/anvil`, update the links in `docs/index.html` and `electron/main.cjs`.

## Directory map

```text
src/                  React/TypeScript desktop UI and visitor chat
electron/main.cjs      Hardened Electron shell and native IPC
electron/logic.cjs     Deterministic memory-fit estimates
electron/host-server.cjs  Loopback-only chat/invite server & tunnel
electron/preload.cjs   Safe renderer IPC bridge
docs/index.html       Standalone GitHub Pages product site
.github/workflows/    CI, Pages deployment and Windows release
tests/                Unit tests for recommendations and invite check
```

## License

No license has yet been selected. The repository owner must choose one before distributing or inviting external contributions.
