# Fader Codebase Concerns

## Summary
No critical vulnerabilities identified. Codebase demonstrates thoughtful security design with explicit permission model, input validation, and error isolation. Primary concerns are architectural—large monolithic components and parsing fragility in interactive PTY handling.

---

## Critical Issues

None identified.

---

## High-Priority Issues

### 1. PTY Output Parsing is Fragile (Feature Flag)
**File:** `/Users/echowreck/Projects/fader/src/main/claude/pty-run-manager.ts` (889 lines)

**Issue:** Permission prompt and output detection relies on heuristic pattern matching against Ink-based CLI terminal output. If Claude CLI's UI changes, the parser may silently fail to detect permissions or tool calls.

**Evidence:**
- Lines 73-160: `detectPermissionPrompt()` uses confidence scoring against keyword patterns, not formal grammar
- Lines 106-108: Pattern-based option extraction ("Allow for this project", "Allow once", "Deny")
- Lines 188-200: `isUiChrome()` filters 30+ line patterns; incomplete coverage of all possible CLI output

**Impact:**
- Permission requests may be silently converted to allow/deny defaults instead of showing UI
- New tool calls may be missed if CLI formatting changes
- Feature is behind `CLUI_INTERACTIVE_PERMISSIONS_PTY` flag, so production impact depends on deployment

**Mitigation:**
- Add telemetry for permission detection confidence scores
- Maintain test cases with recorded CLI output samples
- Document CLI output format expectations in comments
- Consider fallback to HTTP hook transport if PTY parser fails N times

---

### 2. Binary Location Discovery Uses Multiple Fallbacks
**Files:**
- `/Users/echowreck/Projects/fader/src/main/process-manager.ts` (lines 38-67)
- `/Users/echowreck/Projects/fader/src/main/claude/run-manager.ts` (duplicate logic)
- `/Users/echowreck/Projects/fader/src/main/cli-env.ts` (getCliPath)

**Issue:** Each module re-implements binary discovery with different strategies. If all fallbacks fail, code returns hardcoded 'claude' as last resort, which will fail at runtime.

**Evidence:**
- `process-manager.ts:49`: `execSync('test -x "${c}"'...)` with shell injection risk if paths aren't trusted
- `process-manager.ts:66`: Fallback returns 'claude' (unqualified, depends on PATH at spawn time)
- Duplication across run-manager.ts and process-manager.ts suggests unclear ownership

**Impact:**
- If Claude CLI is installed in unexpected location, Fader silently fails to start runs
- Shell injection unlikely but possible if homedir() ever returns untrusted data

**Mitigation:**
- Consolidate discovery logic into single module (maybe cli-env.ts)
- Add explicit error if no binary found instead of silent fallback
- Consider caching result across module restarts
- Document expected installation paths

---

## Medium-Priority Issues

### 1. Large Files with Complex State Management
**Files & Sizes:**
- `src/main/index.ts` (1102 lines) — Monolithic main process handler
- `src/renderer/stores/sessionStore.ts` (934 lines) — Large Zustand store
- `src/main/claude/pty-run-manager.ts` (889 lines) — PTY parsing & event emission
- `src/renderer/components/ConversationView.tsx` (847 lines) — Conversation UI
- `src/main/claude/control-plane.ts` (824 lines) — Tab/session lifecycle

**Issue:** Files >800 lines combine multiple responsibilities, making them harder to test and reason about in isolation. Control flow becomes implicit when state machine logic spans hundreds of lines.

**Evidence:**
- `index.ts`: IPC handlers, window management, screenshot handling, transcription orchestration all in one file
- `control-plane.ts`: Tab registry, request queuing, permission server integration, RunManager event routing
- `sessionStore.ts`: Tab CRUD, permission decisions, marketplace state, event handling, attachment management

**Impact:**
- Difficult to test individual state transitions
- High risk of introducing state inconsistencies
- New team members take longer to understand flow

**Mitigation:**
- Extract IPC handler groups into separate modules
- Split session store into domain-specific substores (tabs, marketplace, permissions)
- Extract control-plane event wiring into separate adapter modules

---

### 2. Type Safety Escapes
**Findings:** ~39 instances of `any`, `@ts-ignore`, `as unknown`, or `as any` across codebase.

**High-risk examples:**
- `/src/main/index.ts:682`: `(err: any)` in execFile callback — actual error type unknown
- `/src/main/index.ts:769`: `(parseErr: any)` in WhisperKit JSON parsing
- `/src/renderer/stores/sessionStore.ts`: Zustand store uses implicit `any` for action parameters

**Impact:**
- Missing validation of error shapes can cause runtime crashes
- Silent type mismatches in state updates

**Mitigation:**
- Define explicit error types for each async boundary
- Use discriminated unions for event/error types instead of `any`
- Stricter TypeScript config (currently `strict: true` but `skipLibCheck: true` may hide issues)

---

### 3. Permission Server Sensitive Field Masking
**File:** `/Users/echowreck/Projects/fader/src/main/hooks/permission-server.ts`

**Issue:** Redaction of sensitive fields in tool inputs (line 143) uses regex pattern matching. Malformed inputs could slip through.

**Pattern:** `const SENSITIVE_FIELD_RE = /token|password|secret|key|auth|credential|api.?key/i`

**Evidence:**
- Case-insensitive regex may not catch camelCase variants (e.g., `apiSecret` vs regex expecting `apisecret`)
- Regex is defensive but not exhaustive
- Masking applied only in logs, not in actual permission requests sent to renderer

**Impact:**
- Low: logs may expose sensitive data if key naming is unexpected
- Medium: permission card shows raw tool input without masking (line 118, `safeInput` is for logs only)

**Mitigation:**
- Apply masking to renderer-facing tool input, not just logs
- Use allowlist of safe fields instead of denylist of sensitive patterns
- Document assumptions about field naming conventions

---

### 4. Stream Parser Doesn't Validate Event Schema
**File:** `/Users/echowreck/Projects/fader/src/main/stream-parser.ts`

**Issue:** Parser accepts any JSON object as a `ClaudeEvent` without validation. Malformed events from Claude CLI could cause downstream issues.

**Evidence:**
- Line 26: `JSON.parse(trimmed) as ClaudeEvent` — no schema validation
- Unknown event types are emitted but assumed well-formed by consumers

**Impact:**
- If Claude CLI output is corrupted, missing fields could cause undefined access in event handlers
- Type casting `as ClaudeEvent` is a lie if JSON doesn't match expected structure

**Mitigation:**
- Add runtime schema validation (Zod, Yup) or discriminated union guards
- Emit structured error events for unparseable input
- Document expected event schema with examples

---

### 5. No Timeout/Resource Limits on Child Processes
**File:** `/Users/echowreck/Projects/fader/src/main/process-manager.ts`

**Issue:** Claude CLI processes are spawned without explicit timeout or resource limits. Long-running or stuck processes could consume resources indefinitely.

**Evidence:**
- Line 115: `spawn()` call with no timeout configured
- Run lifecycle depends entirely on Claude CLI exit signal
- No watchdog or heartbeat mechanism

**Impact:**
- If Claude CLI hangs, tab becomes unresponsive
- User must force-quit app to recover

**Mitigation:**
- Add optional timeout parameter to RunOptions
- Implement heartbeat check (idle timer that kills run after N seconds of no output)
- Document timeout behavior and recovery

---

### 6. Marketplace Plugin Installation Trust
**File:** `/Users/echowreck/Projects/fader/src/main/marketplace/catalog.ts`

**Input Validation Strengths:**
- Lines 13-29: Strict regexes for plugin names, repo format, source paths
- Lines 31-36: assertSkillDirContained() validates no path traversal

**Remaining Concerns:**
- JSON parsing (lines 79, 160) doesn't validate schema — assumes GitHub repo contains well-formed data
- execFile() calls (skill installer) may be vulnerable if skill content contains malicious shell commands
- Plugin marketplace is hardcoded to Anthropic repos, reducing risk

**Impact:** Low (repos are Anthropic-owned), but could be higher if marketplace is extended to user repos.

**Mitigation:**
- Validate marketplace JSON schema on fetch
- Document that plugins run arbitrary code with user's credentials
- Consider sandboxing plugin installation or requiring explicit allowlist

---

## Low-Priority Issues

### 1. Logger Buffer Flushing Assumptions
**File:** `/Users/echowreck/Projects/fader/src/main/logger.ts`

**Issue:** Async log writes (appendFile) race with sync drain on shutdown. In-flight writes may be lost if app crashes.

**Evidence:**
- Line 21: `appendFile()` without await — async fire-and-forget
- Line 45: `flushLogs()` writes pending content synchronously, but already-dispatched async writes may not have landed yet

**Impact:** Low — debug logs, not critical functionality. Loss of last few log lines during crash acceptable.

**Mitigation:**
- Consider awaiting final flush, or document log loss caveat
- Add telemetry for buffer overflow (MAX_BUFFER_SIZE = 64)

---

### 2. Permission Server Port is Hardcoded
**File:** `/Users/echowreck/Projects/fader/src/main/hooks/permission-server.ts`

**Issue:** `DEFAULT_PORT = 19836` is used for all instances. If multiple Fader instances run concurrently, port conflict possible.

**Impact:** Low — single-user desktop app, but could cause issues in multi-account setups.

**Mitigation:**
- Use `listen(0)` to let OS assign port, return assigned port from start()
- Already done in control-plane.ts (line 88) — just need to propagate

---

### 3. ANSI Stripping Regex May Miss Sequences
**File:** `/Users/echowreck/Projects/fader/src/main/claude/pty-run-manager.ts` (lines 51-58)

**Issue:** Regex patterns for ANSI stripping cover common sequences but may miss newer or obscure escape codes.

**Evidence:**
- Line 53: CSI sequences `/\x1b\[[0-9;?]*[ -/]*[@-~]/g` — limited to documented sequences
- Rare sequences like OSC (Operating System Command) partially handled (line 54)

**Impact:** Negligible — unknown ANSI codes will be passed through, worst case displayed as garbage in logs.

---

### 4. No Validation of RunOptions
**File:** `/Users/echowreck/Projects/fader/src/main/process-manager.ts`

**Issue:** `startRun(options: RunOptions)` doesn't validate options before passing to spawn. Invalid values could break CLI invocation.

**Evidence:**
- Lines 73-100: Build args from options without validation
- `--max-budget-usd` argument not validated as number
- `--max-turns` not validated as positive integer

**Impact:** Low — Claude CLI will reject invalid args and close gracefully.

**Mitigation:**
- Add schema validation on options (Zod)
- Fail fast with clear error message instead of letting CLI fail

---

## Dependency Status

**Package Age Check:**
- Electron: 35.7.5 (recent, December 2024)
- React: 19.0.0 (current major version)
- TypeScript: 5.7.0 (recent)
- Zustand: 5.0.x (current)
- Vite: 6.0.0 (current)

**Missing Package Data:** npm outdated shows "MISSING" for all runtime dependencies, suggesting node_modules not installed in analysis environment. No obsolete packages detected based on version strings.

**Note:** No known security vulnerabilities in direct dependencies. Electron auto-updates are handled by electron-builder.

---

## Architecture Notes

### Permission Model (Well-Designed)
- Per-run tokens prevent cross-run confusion
- App secret + run token in HTTP hook URL prevent local spoofing
- Deny-by-default on all failure paths
- Permission server properly isolated to main process

### Driver Abstraction (Healthy)
- Hard wall between Claude and Codex drivers enforced by directory structure
- Interface contract clear (spawn, kill, send, onEvent, resume, capabilities)
- Prevents accidental cross-driver code leakage

### IPC Boundaries (Secure)
- Preload script uses contextBridge, not direct require
- nodeIntegration: false
- Renderer can't directly access filesystem, only through IPC

---

## Summary of Recommendations

| Priority | Issue | Action |
|----------|-------|--------|
| High | PTY parsing fragility | Add confidence telemetry, maintain CLI output samples |
| High | Binary discovery duplication | Consolidate into single module, explicit error handling |
| Medium | Large monolithic files | Refactor into smaller domain modules |
| Medium | Type safety escapes (39 instances) | Replace `any` with discriminated unions, add schema validation |
| Medium | Permission card masking | Apply masking to renderer-facing input, not just logs |
| Low | Port conflict possible | Use OS-assigned ports (listen(0)) |
| Low | Timeout/watchdog missing | Add heartbeat check, timeout parameter |

No security-critical issues require immediate action. Codebase demonstrates good security hygiene with explicit threat modeling (comments in permission-server.ts are exemplary).
