# Project State

## Profile
balanced

## Decisions
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-23 | Forked from CLUI-CC | Brownfield — existing Electron/React CLI wrapper for Claude Code. Forking to build themeable, multi-backend wrapper. |
| 2026-03-23 | Agent scaffolding added | Onboarding existing project with agent orchestration |
| 2026-03-23 | Removed global model config | `~/.claude/settings.json` had `"model": "opus[1m]"` — invalid ID caused 404s. Fader should never depend on global Claude config for model selection. |
| 2026-03-23 | Model picker must be driver-supplied | Hardcoded Claude model list won't work when Codex driver lands. Each driver declares its own available models via the Driver interface. Preference persists per-driver. Added to Phase 0 plan. |
| 2026-03-23 | Uninstalled Clui CC | Removed /Applications/Clui CC.app, ~/Library/Application Support/clui, and ~/Projects/clui-cc to eliminate collision with Fader. |

## Position
Phase 0 in progress. Rebrand complete (Clui CC → Fader). Model picker fixed with Default option. Codebase mapped (.planning/codebase/). Theming system from Phase 1 already partially landed (4 starter themes, settings UI).

Next up: Extract Claude-specific code into `src/drivers/claude/`, define the Driver interface (including `availableModels`), wrap existing integration as ClaudeDriver.

## Blockers
None.
