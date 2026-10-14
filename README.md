# Anvil — Your hardware. Your intelligence.

**Website:** [https://colin515.github.io/Anvil/](https://colin515.github.io/Anvil/) · **Windows download:** [Latest release](https://github.com/colin515/Anvil/releases/latest) · [Releases](https://github.com/colin515/Anvil/releases)

> **Website activation required:** The product website is already included in `docs/`, but GitHub Pages must first be enabled in **Repository Settings → Pages → Build and deployment → Source → GitHub Actions**. Then run **Actions → Publish Anvil website → Run workflow**. Until GitHub Pages is enabled, the website link above will not load.

Anvil is a clean **Windows local-AI desktop app**, built around a minimal, Flowforge-inspired interface. It scans your PC, recommends Ollama models, and runs a **localhost-only** browser chat. No tunnels, public hosting, invite codes, or accounts.

> **Local chat:** [http://127.0.0.1:3000](http://127.0.0.1:3000) — accessible **only on your own PC while the Anvil server is running**. The new local-only behaviour is included in v0.2.0-local and later. Older releases used a randomly assigned port.

> **Requirements:** Windows 10/11 (64-bit), [Ollama for Windows](https://ollama.com/download/windows) running locally. Node.js 22 is required only when building from source. The unsigned preview installer is for local testing.

## Product

- Flowforge-style graphite UI with bright blue accents, compact sidebar and quiet, functional motion.
- Dashboard with one-click **Start local server**, **Open Chat** and **Copy link** actions.
- Stable chat address `http://127.0.0.1:3000`, bound to `127.0.0.1` (not accessible over the LAN or internet).
- Hardware diagnostics and model fit recommendations with real Ollama downloads.
- Interactive, token-streamed browser chat from your PC; no invite code needed on loopback.
- Model library, selected model, download progress, and optional benchmark.

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

## How local hosting works

1. Start Ollama and download an AI model in Anvil, then choose it as the active model.
2. In **Overview** or **Local server**, click **Start local server**.
3. Open **http://127.0.0.1:3000** on this PC, or use **Open Chat** in Anvil. Use **Copy link** to copy the address.
4. Chat with your model directly. No internet sharing or visitor authentication is configured.
5. Click **Go offline** to stop serving the chat.

Anvil binds to `127.0.0.1`, not `0.0.0.0`. Other computers and phones cannot access that address on your PC. If port 3000 is occupied, Anvil reports an error instead of silently selecting a different port.

The **GitHub Pages** site is only a public product information and installer-download website. It does *not* host a live AI chat; local AI inference always runs on your computer.

## Publishing to GitHub

Repository: **https://github.com/colin515/Anvil**. The project uses GitHub Actions to verify source, build a Windows installer, and deploy a separate product/download website.

1. Push this project's contents to the `main` branch.
2. In **Settings → Pages**, choose **GitHub Actions** as the source. **This initial activation must be made by the repository owner:** GitHub Actions tokens cannot create a Pages site if repository administration blocks it. Then open **Actions → Publish Anvil website → Run workflow** to deploy `docs/` to `https://colin515.github.io/Anvil/`.
3. Run `npm install` (Node 22). The workflows install dependencies on the hosted runners.
4. An updated Windows release is built on GitHub Actions. Source checks must pass before publishing an installer. Download the newest **Anvil-Setup.exe** from the Releases page.
5. The public website reads GitHub's latest release API. The download button becomes a direct `.exe` link once `Anvil-Setup.exe` is published. Until then it links to the Releases page without claiming an installer exists.

For this repository, the product site URL is `https://colin515.github.io/Anvil/` after GitHub Pages has been enabled.

## Directory map

```text
src/                  React/TypeScript desktop UI and visitor chat
electron/main.cjs      Hardened Electron shell and native IPC
electron/logic.cjs     Deterministic memory-fit estimates
electron/host-server.cjs  Loopback-only browser chat server
electron/preload.cjs   Safe renderer IPC bridge
docs/index.html       Standalone GitHub Pages product site
.github/workflows/    CI, Pages deployment and Windows release
tests/                Unit tests for recommendations and local chat
```

## License

No license has yet been selected. The repository owner must choose one before distributing or inviting external contributions.
