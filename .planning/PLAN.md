# Fader Development Plan

## Phase 0: Foundation (Fork + Strip)

**Goal:** Clean fork with Claude Code working exactly as CLUI does today, but with the codebase organized for what's coming.

- Fork CLUI-CC, rename to Fader
- Audit the React component tree — map what renders output, input, tabs, permissions
- Extract all Claude-specific code into `src/drivers/claude/`
- Define the `Driver` interface: spawn, kill, send, onEvent, resume, capabilities
- Wrap existing Claude Code integration as `ClaudeDriver` implementing that interface
- Verify nothing broke — Fader with Claude Code should behave identically to CLUI

**Ships:** Working fork with clean driver boundary. No new features.

## Phase 1: Theming System

**Goal:** JSON theme files control the entire visual layer. Swap a file, swap the look.

- Define theme schema (colors, typography, spacing, branding assets, window title)
- Build theme loader — reads JSON, applies as CSS custom properties
- Create two starter themes: personal dark + APM Music branded
- Hot-reload support — theme changes apply without restart
- Settings UI: theme picker dropdown

**Theme schema (draft):**
```json
{
  "name": "APM Music",
  "colors": {
    "bg-primary": "#1A1A2E",
    "bg-secondary": "#2D2D44",
    "accent": "#E6A23C",
    "text-primary": "#F5F5F5",
    "text-secondary": "#A0A0B0",
    "success": "#4CAF50",
    "error": "#C45B4D",
    "border": "#3D3D5C"
  },
  "typography": {
    "fontFamily": "Inter, system-ui, sans-serif",
    "fontMono": "JetBrains Mono, monospace",
    "fontSize": "14px"
  },
  "branding": {
    "logo": "./themes/apm/logo.svg",
    "windowTitle": "APM Code Assistant",
    "welcomeMessage": "What are you working on?"
  }
}
```

**Ships:** Themeable Fader with Claude Code backend. Two themes working.

## Phase 2: Codex Driver

**Goal:** `CodexDriver` implements the same `Driver` interface. Backend-swappable.

- Research Codex CLI's NDJSON event schema in detail (map every event type to internal schema)
- Implement `CodexDriver`: binary discovery, spawn with `exec --json`, stream parsing
- Build event normalizer: Codex events → Fader's internal event types
- Handle the permission model difference — Codex uses exec policies, not interactive approval. The wrapper doesn't need to intercept; it just needs to display policy-blocked events correctly.
- Session resume via `codex resume` subcommand
- Settings: backend selector (Claude Code / Codex), persisted per-profile
- Test matrix: both drivers against the same UI flows

**Event mapping (known):**

| Codex Event | Fader Internal | Claude Code Equivalent |
|-------------|---------------|----------------------|
| `thread.started` | `session.init` | `InitEvent` |
| `turn.started` | `turn.start` | `StreamEvent` (start) |
| `turn.completed` | `turn.end` | `ResultEvent` |
| `item.started` (AgentMessage) | `message.delta` | `StreamEvent` (text) |
| `item.completed` (CommandExecution) | `tool.result` | `ToolCallEvent` |
| `item.completed` (FileChange) | `file.change` | `ToolCallEvent` (Edit/Write) |
| `turn.failed` | `error` | Error handling |

**Ships:** Fader works with both Claude Code and Codex. Theme + backend are independent choices.

## Phase 3: Experience Modes

**Goal:** Standard mode for APM knowledge workers. Power mode for devs.

**Standard mode:**
- Simplified input (no raw CLI flags visible)
- Prompt templates / starter suggestions relevant to the org's work
- Results-focused output — collapse tool calls, show final answers
- No file diff rendering (or simplified version)
- Curated settings (hide advanced options)

**Power mode (default for personal use):**
- Full streaming output with tool calls visible
- File diffs rendered inline
- Permission approval UI (Claude Code only)
- All settings exposed
- Terminal access

- Settings toggle: Standard / Power
- Theme files can set a default mode (`"defaultMode": "standard"`)
- Mode persists per-profile

**Ships:** APM-ready deployment. Knowledge workers get a clean interface, power users get everything.

## Phase 4: Polish + Distribution

**Goal:** Shippable internal tool for APM.

- Electron auto-updater for APM deployment (or manual DMG/installer)
- Onboarding flow: first-run setup (select backend, choose theme, configure API key)
- Bundled Codex exec policy for APM (locked-down defaults for non-technical users)
- `AGENTS.md` template for APM projects (equivalent to CLAUDE.md guidance)
- Error handling: offline states, API key expiry, CLI not found
- Telemetry/logging (opt-in, local only — no phoning home)
- README, screenshots, internal docs for APM distribution

**Ships:** v1.0 — distributable to APM employees.

## Phase Sequencing

```
Phase 0 ──→ Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 4
(fork)      (themes)     (codex)     (modes)      (ship)
   │                        │
   └── usable immediately   └── both backends working
```

Phases 1 and 2 could run in parallel if desired — theming is purely visual, Codex driver is purely backend. But sequencing them lets you ship a good-looking Claude Code wrapper (Phase 1) before tackling the Codex integration.

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Codex CLI NDJSON schema changes | Breaks Codex driver | Pin to Codex CLI version, watch releases |
| CLUI upstream diverges significantly | Miss improvements, security fixes | Periodic upstream merge reviews |
| Codex permission model too different for shared UI | Standard mode can't handle both cleanly | Accept that permission UI is driver-specific, not shared |
| APM employees need Windows support | Electron works cross-platform, but Codex sandbox differs on Windows | Phase 4 concern — test Windows before APM rollout |
| Scope creep into IDE features | This becomes a code editor, not a wrapper | Hard wall: Fader is a shell, not an editor. If it needs file trees and tabs, stop. |
