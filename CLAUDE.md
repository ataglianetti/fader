# Fader

## Overview
Desktop App: Themeable wrapper for AI coding CLIs (Claude Code, Codex). Electron + React, forked from CLUI-CC.
Stack: TypeScript + Electron + React

## Vision

Fader is one shell with swappable backends, branded per-context. The owner uses Claude Code personally; APM Music (his employer) uses Codex. Fader wraps both behind a shared Driver interface so the same app serves both — swap a JSON theme file and a config toggle, get a completely different branded experience.

Three layers make this work:
1. **Theme Layer** — JSON files control colors, typography, branding, window title. No logic in themes. Obsidian-style: drop a file, change the look.
2. **Driver Layer** — `ClaudeDriver` and `CodexDriver` both implement the same interface. Both CLIs emit NDJSON streams; Fader normalizes the events into a shared internal schema.
3. **Experience Modes** — "Standard" for knowledge workers (simplified, results-focused) and "Power" for developers (full CLI, streaming output, tool approval). Theme files can set a default mode.

The goal is a shippable internal tool for APM employees, built and maintained by the owner to demonstrate he can ship polished products independently.

See `.planning/PLAN.md` for the phased development plan.

## Architecture
Run `/map-codebase` to populate. Reference docs land in `.planning/codebase/`.

## Agent Orchestration

### When to Use Agents vs Direct Work

| Task Size | Approach | Example |
|-----------|----------|---------|
| Trivial (<10 lines, one file) | Direct edit | Fix a typo, add a log statement |
| Small (one feature, 1-3 files) | Direct edit or single agent | Add a utility function, simple endpoint |
| Medium (feature, 3-8 files) | Planner → Implementer | New API endpoint with tests and validation |
| Large (cross-cutting, 8+ files) | Research → Plan → Implement (waves) → Verify → Review | Auth system, major refactor, new subsystem |

### How to Spawn Agents

1. Read the agent template from `.claude/agents/{agent}.md`
2. Use the Task tool with the template as part of the prompt
3. Include relevant context (codebase docs, prior agent output, specific files)
4. Set model based on current profile (see Model Profiles below)

Example:
```
Task: subagent_type=general-purpose, model={from profile}
Prompt: [agent template content]

Context: [what the agent needs to know]
Task: [specific work to do]
```

### Wave Execution

For multi-task plans from the planner:
1. Execute all tasks in Wave 1 in parallel (separate Task calls in one message)
2. Wait for Wave 1 to complete
3. Review results — adjust Wave 2 if needed
4. Execute Wave 2 tasks in parallel
5. Repeat until plan is complete
6. Run verifier against the original goal

### Model Profiles

Current profile is set in `.planning/STATE.md`. Default: `balanced`.

| Profile | Researcher | Planner | Implementer | Verifier | Debugger | Reviewer | Mapper |
|---------|-----------|---------|-------------|----------|----------|----------|--------|
| `quality` | opus | opus | opus | sonnet | opus | sonnet | sonnet |
| `balanced` | opus | opus | sonnet | sonnet | opus | sonnet | haiku |
| `budget` | sonnet | sonnet | sonnet | haiku | sonnet | haiku | haiku |

Override per-spawn by passing `model` explicitly to Task.

## Context Budget

### When to Spawn Fresh Agents
- Investigation is getting long (10+ file reads without clear direction)
- Switching from one subsystem to another
- After completing a wave — fresh context for each wave

### Save State Before Switching
When moving between tasks or subsystems, update `.planning/STATE.md`:
- What was just completed
- What's next
- Any blockers or open questions

## Worktree Patterns

### When to Use Worktrees
- Parallel implementation of independent features
- Exploratory changes that might be thrown away
- When two tasks touch the same files (avoid conflicts)

### Workflow
1. Use `isolation: "worktree"` parameter on Task tool
2. Agent works in isolated copy of the repo
3. If changes are good, merge the worktree branch
4. If changes are bad, discard the worktree

## Web App Conventions
- Component structure: one component per file, co-located styles/tests
- State management: to be determined (existing CLUI patterns take precedence)
- Routing: N/A (single-window Electron app)
- API calls: centralized in services/ directory

## Fader-Specific

### Hard Walls
- Fader is a shell, not an editor. No file trees, no syntax-highlighted editor tabs. If it needs those, stop.
- Driver abstraction is sacred. No Claude-specific code outside `src/drivers/claude/`. No Codex-specific code outside `src/drivers/codex/`.
- Theme files are data, not code. JSON in, CSS custom properties out. No logic in themes.

### Driver Interface
The `Driver` interface is the core abstraction. Both Claude Code and Codex implement it:
- `spawn()` — start the CLI process
- `kill()` — stop the CLI process
- `send(message)` — send user input
- `onEvent(handler)` — receive normalized events
- `resume(sessionId)` — resume a previous session
- `capabilities` — what this driver supports (permissions UI, session resume, etc.)
