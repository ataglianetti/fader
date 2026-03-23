# Architecture

## Overview

Fader (formerly CLUI-CC) is a desktop application — an Electron + React wrapper around Claude Code that provides a lightweight, themeable UI for AI-assisted coding. The app spawns Claude Code as a subprocess, parses its streaming JSON output, normalizes events, and renders them in a minimal chat interface that integrates with the desktop OS (transparency, tray, multi-space support on macOS).

The core value prop: Claude's coding capabilities without the terminal, styled as a focused floating panel that stays out of the way until needed.

## Layers

| Layer | Purpose | Key Files |
|-------|---------|-----------|
| **Electron (Main)** | Process spawning, IPC, window management, file I/O, permission hooks | `src/main/index.ts`, `ControlPlane`, `RunManager` |
| **IPC Bridge** | Type-safe renderer ↔ main communication | `src/preload/index.ts`, `src/shared/types.ts` |
| **React (Renderer)** | Chat UI, conversation history, input, tabs, marketplace | `src/renderer/App.tsx`, components/, stores/ |
| **Claude Code Integration** | Subprocess spawning, event normalization, permission handling | `src/main/claude/`, `event-normalizer.ts` |
| **Marketplace & Skills** | Plugin catalog fetch/install, bundled skill provisioning | `src/main/marketplace/catalog.ts`, `skills/installer.ts` |
| **Permission System** | HTTP hook server for pre-tool-use permission capture (interactive mode) | `src/main/hooks/permission-server.ts` |
| **Theme System** | Dual-theme color tokens (dark/light), Zustand store, native OS theme sync | `src/renderer/theme.ts` |

## Data Flow

### Request → Execution → Rendering

1. **User submits prompt** (InputBar component) → `sessionStore.sendMessage()`
2. **Renderer → Main (IPC):** `window.clui.prompt(tabId, requestId, options)`
3. **ControlPlane.submitPrompt():**
   - Enqueues request (backpressure queue, max 32)
   - Waits for hook server ready
   - Calls `RunManager.spawn()`
4. **RunManager.spawn():**
   - Spawns `claude -p --output-format stream-json` as subprocess
   - Attaches stdout/stderr parsers
   - Hooks stdout to StreamParser (NDJSON lines)
5. **StreamParser → event-normalizer:**
   - Parses raw `ClaudeEvent` (init, stream_event, result, rate_limit, permission_request)
   - Normalizes to `NormalizedEvent` (session_init, text_chunk, tool_call, task_complete, etc.)
6. **ControlPlane.on('event', ...):**
   - Emits `broadcast('clui:normalized-event', tabId, event)`
7. **Renderer (useClaudeEvents hook):**
   - Listens on `window.clui.onEvent()`
   - Buffers text_chunk events (RAF batching) to avoid re-renders per character
   - Calls `sessionStore.handleNormalizedEvent()`
8. **SessionStore updates state** → React renders ConversationView
9. **Completion:** `task_complete` event includes cost, tokens, duration; stored in `lastResult`

### Permission Flow (Interactive Mode)

1. Claude Code encounters pre-tool-use hook (enabled via `--hooks` settings)
2. Claude sends HTTP POST to permission-server at port N
3. **PermissionServer** extracts tool name, input, options
4. Emits `permission-request` event to ControlPlane (with tabId from per-run token)
5. ControlPlane broadcasts normalized event → renderer shows `PermissionCard`
6. User selects option → renderer calls `window.clui.respondPermission()`
7. ControlPlane relays response back to permission-server → HTTP response sent
8. Claude resumes execution

### Theme & OS Integration

1. App startup: `App.tsx` calls `window.clui.getTheme()` → asks Electron for OS theme (light/dark)
2. Electron reads `nativeTheme.shouldUseDarkColors()`
3. Zustand store (`useThemeStore`) receives isDark, updates ThemeContext
4. All colors consumed via `useColors()` hook (returns dark or light palette)
5. OS theme change detected: Electron emits `clui:theme-changed` → store updates reactively

## Key Abstractions

- **ControlPlane** (`src/main/claude/control-plane.ts`) — The single authority for tab lifecycle, request queuing, health reporting, and event routing. Bridges RunManager/PtyRunManager events to the renderer. Manages permission server integration.

- **RunManager** (`src/main/claude/run-manager.ts`) — Spawns `claude -p` subprocesses, parses NDJSON streams, emits normalized events. Keeps diagnostic ring buffers (stderr, stdout) for error reporting. Handles cancel/kill lifecycle.

- **EventNormalizer** (`src/main/claude/event-normalizer.ts`) — Converts raw Claude Code stream events into a simpler canonical form (text_chunk, tool_call, task_complete, permission_request, etc.). Handles partial message synthesis for UI fallback.

- **PtyRunManager** (`src/main/claude/pty-run-manager.ts`) — Alternative run backend using node-pty for interactive permission transport (feature-flagged via `CLUI_INTERACTIVE_PERMISSIONS_PTY`). Bridges Claude's stdin/stdout over a PTY.

- **PermissionServer** (`src/main/hooks/permission-server.ts`) — HTTP server that accepts pre-tool-use hooks from Claude Code. Validates tool requests, emits permission-request events. Masking sensitive fields before rendering UI cards.

- **SessionStore** (`src/renderer/stores/sessionStore.ts`) — Zustand store managing all UI state: tabs, messages, attachments, permission queue, marketplace state. Handlers for all normalized event types. Tab CRUD and session resume logic.

- **Marketplace & Catalog** (`src/main/marketplace/catalog.ts`) — Fetches plugin catalogs from GitHub (3 sources: skills, knowledge-work, financial). Validates plugin names/repos. Installs/uninstalls via `installPlugin()`.

- **SkillInstaller** (`src/main/skills/installer.ts`) — Ensures bundled skills (from `/skills` directory) are present in `~/.claude/skills/`. Respects user-managed skills (doesn't overwrite if no version marker).

- **ThemeStore** (`src/renderer/theme.ts`) — Zustand store holding color palettes (dark + light) and expansion UI state. `useColors()` hook returns active palette. Syncs with OS theme via IPC.

## External Integrations

| Service | Purpose | Client Location | Flow |
|---------|---------|-----------------|------|
| Claude Code CLI | AI execution | RunManager.spawn() | Subprocess + NDJSON parsing |
| GitHub (marketplace) | Plugin source | marketplace/catalog.ts | HTTP fetch raw.githubusercontent.com |
| OS Theme | Light/dark mode detection | Electron nativeTheme | IPC → renderer theme store |
| macOS NSPanel | Floating window + spaces | main/index.ts BrowserWindow | OS-level, non-activating |
| Permission Hooks | Pre-tool-use validation | PermissionServer (HTTP) | Claude Code → localhost:N → hook response → stdout |

## Error Handling & Diagnostics

- **Process death:** RunManager detects process exit, emits `exit` event with exit code + signal. ControlPlane broadcasts `session_dead` to renderer.
- **Stderr capture:** Last ~100 lines buffered in RunHandle.stderrTail. Included in `getDiagnostics()` response.
- **Permission denials:** Tracked per-run. If any tools were denied, result event includes `permissionDenials` array. Renderer shows `PermissionDeniedCard` fallback UI.
- **Rate limit:** Parsed from Claude events, broadcast to renderer. StatusBar displays reset time.
- **Logging:** Main process writes to `~/.clui-debug.log`. Ring buffers survive process exit for post-mortem analysis via `getDiagnostics()`.

## Design Constraints (from CLAUDE.md)

1. **Fader is a shell, not an editor.** No file trees, no syntax-highlighted tabs. If a feature needs those, it's out of scope.
2. **Driver abstraction is sacred.** No Claude-specific code outside `src/main/claude/`. No Codex-specific code outside `src/drivers/codex/` (future). Currently only Claude implemented; structure is ready for multi-driver.
3. **Theme files are data, not code.** Colors are constants in `theme.ts` (JS object literals) that export to CSS custom properties at runtime. No logic in themes.
4. **The preload bridge is the contract.** CluiAPI interface is the renderer's only view of the main process; all logic must be expressible through these IPC calls.
