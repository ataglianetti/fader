# Project Structure

## Directory Layout

```
fader/
├── src/
│   ├── main/                          # Electron main process (Node)
│   │   ├── index.ts                   # Window creation, IPC handlers, lifecycle
│   │   ├── claude/                    # Claude Code integration (driver abstraction)
│   │   │   ├── control-plane.ts       # Tab registry, request queue, event routing
│   │   │   ├── run-manager.ts         # Subprocess spawning, NDJSON parsing
│   │   │   ├── pty-run-manager.ts     # Alternative: PTY-based interactive permissions
│   │   │   ├── event-normalizer.ts    # Raw event → normalized event conversion
│   │   ├── hooks/                     # Permission system
│   │   │   └── permission-server.ts   # HTTP server for pre-tool-use hooks
│   │   ├── marketplace/               # Plugin catalog & installation
│   │   │   └── catalog.ts             # Fetch/validate/install plugins from GitHub
│   │   ├── skills/                    # Bundled skill provisioning
│   │   │   ├── installer.ts           # Install/update bundled skills on startup
│   │   │   └── manifest.ts            # Skill entry definitions
│   │   ├── cli-env.ts                 # Environment preparation for Claude subprocess
│   │   ├── process-manager.ts         # Legacy process spawning (superseded by RunManager)
│   │   ├── stream-parser.ts           # NDJSON line parsing
│   │   └── logger.ts                  # Debug logging to ~/.clui-debug.log
│   │
│   ├── renderer/                      # React frontend (Electron renderer process)
│   │   ├── main.tsx                   # React DOM root
│   │   ├── App.tsx                    # Top-level layout (tabs, input, marketplace panel)
│   │   ├── index.css                  # Global styles + Tailwind directives
│   │   ├── index.html                 # HTML template
│   │   ├── env.d.ts                   # TypeScript ambient types
│   │   ├── components/                # React components
│   │   │   ├── ConversationView.tsx   # Chat history rendering (grouped messages)
│   │   │   ├── InputBar.tsx           # Text input, model selector, send button
│   │   │   ├── TabStrip.tsx           # Tab CRUD UI (new/close/switch)
│   │   │   ├── StatusBar.tsx          # Token usage, cost, duration, rate limit
│   │   │   ├── MarketplacePanel.tsx   # Plugin catalog browse/install UI
│   │   │   ├── PermissionCard.tsx     # Tool permission request cards
│   │   │   ├── PermissionDeniedCard.tsx # Fallback when tools were denied
│   │   │   ├── SettingsPopover.tsx    # Model, theme, permission mode selector
│   │   │   ├── HistoryPicker.tsx      # Session resume dialog
│   │   │   ├── SlashCommandMenu.tsx   # Slash command palette
│   │   │   ├── AttachmentChips.tsx    # File/image preview chips
│   │   │   └── PopoverLayer.tsx       # Portal for popovers
│   │   ├── stores/                    # State management (Zustand)
│   │   │   └── sessionStore.ts        # Tabs, messages, attachments, marketplace state
│   │   ├── hooks/                     # Custom React hooks
│   │   │   ├── useClaudeEvents.ts     # IPC listener + RAF batching for text chunks
│   │   │   └── useHealthReconciliation.ts # Periodic health polling for sync
│   │   └── theme.ts                   # Zustand color store, dual theme (dark/light)
│   │
│   ├── preload/                       # Electron preload (isolated context bridge)
│   │   └── index.ts                   # CluiAPI definition + contextBridge.exposeInMainWorld
│   │
│   └── shared/                        # Shared types (main + renderer)
│       └── types.ts                   # Event schemas, tab state, run options, IPC constants
│
├── resources/                         # Static assets
│   ├── icon.icns                      # macOS app icon
│   ├── icon.iconset/                  # Source icons for icns
│   ├── entitlements.mac.plist         # macOS sandbox entitlements
│   ├── trayTemplate.png               # Tray icon
│   ├── notification.mp3               # Audio notification
│   └── icon.png                       # General icon
│
├── skills/                            # Bundled skill sources (installed to ~/.claude/skills/)
│   └── [skill-name]/                  # One dir per skill (e.g., map-codebase)
│       ├── SKILL.md                   # Skill definition
│       └── [supporting files]
│
├── docs/                              # Documentation (currently minimal)
├── commands/                          # Slash command definitions (future extensibility)
├── scripts/                           # Build/dev scripts
│   ├── doctor.sh                      # Diagnostics
│   └── patch-dev-icon.sh              # Icon preparation
│
├── .planning/                         # Planning state & codebase maps
│   ├── STATE.md                       # Current work, blockers, next steps
│   └── codebase/                      # Reference docs (ARCHITECTURE.md, STRUCTURE.md)
│
├── .claude/                           # Claude agent templates & session data
├── .git/                              # Git repo
├── package.json                       # npm metadata, build scripts, deps
├── package-lock.json
├── tsconfig.json                      # TypeScript config
├── electron.vite.config.ts            # Vite build config for Electron
├── CLAUDE.md                          # Project conventions & hard walls
├── README.md
└── LICENSE
```

## Naming Conventions

### Files
- **Main process**: `*.ts` (Node/CommonJS)
- **Renderer**: `*.tsx` (React JSX), `*.css` (Tailwind directives + globals)
- **Shared types**: `types.ts` in `src/shared/`
- **Components**: One file per component (co-located, no separate styles — Tailwind inline classes)
- **Stores**: `*Store.ts` (Zustand)
- **Hooks**: `use*` pattern (React convention)

### Directories
- `src/main/[driver]/` — Driver-specific code (claude/, future: codex/)
- `src/main/[feature]/` — Feature modules (hooks/, marketplace/, skills/)
- `src/renderer/components/` — React components
- `src/renderer/stores/` — Global state (Zustand)
- `src/renderer/hooks/` — Custom React hooks

### Components
- **ConversationView** — Large, complex, handles pagination + scrolling
- **InputBar** — Standalone input, model selector, send logic
- **TabStrip** — Tab bar, CRUD actions
- **PermissionCard** — Tool permission request UI (reusable per question)
- **MarketplacePanel** — Plugin browser (separate from main chat)
- **StatusBar** — Token usage, cost, rate limit info

## Key Directories

| Directory | Purpose | Contains |
|-----------|---------|----------|
| `src/main/` | Electron main process logic | Process spawning, IPC, window management, permission hooks |
| `src/main/claude/` | Claude Code driver (future: multi-driver) | ControlPlane, RunManager, event normalization |
| `src/main/marketplace/` | Plugin installation system | Catalog fetch, plugin validation, GitHub integration |
| `src/main/skills/` | Bundled skill provisioning | Manifest, installer (atomic install pattern) |
| `src/renderer/` | React UI | App, components, stores, hooks, theme |
| `src/renderer/components/` | Reusable React components | Conversation, input, tabs, marketplace, permission cards |
| `src/renderer/stores/` | Zustand state stores | sessionStore (all UI state), theme store |
| `src/renderer/hooks/` | Custom React hooks | IPC listeners, health polling |
| `src/preload/` | Electron context bridge | CluiAPI type-safe IPC definition |
| `src/shared/` | Shared TypeScript types | Event schemas, state interfaces, IPC constants |
| `skills/` | Bundled skill sources | Per-skill directories with SKILL.md + supporting files |
| `resources/` | Static assets | Icons, entitlements, audio |
| `.planning/` | Planning & reference docs | Codebase maps (ARCHITECTURE.md, STRUCTURE.md), execution state |

## Dependency Patterns

### Main → Renderer (IPC only)
- **Entry point**: `src/preload/index.ts` exposes `CluiAPI` to window.clui
- **All communication**: Type-safe IPC via preload bridge
- **Reason**: Security (context isolation) + clean abstraction boundary

### Renderer → State Management (Zustand)
- **Entry point**: `src/renderer/stores/sessionStore.ts`
- **Consumers**: All components call hooks like `useSessionStore((s) => s.property)`
- **Why**: Centralized state, reactive updates, no prop drilling

### Main → Event System (EventEmitter)
- **Entry point**: `ControlPlane` extends EventEmitter
- **Propagation**: Events tagged with tabId, broadcast to renderer via IPC
- **Consumers**: Hooks in renderer subscribe via IPC listeners (useClaudeEvents)

### Driver Abstraction (Claude only, for now)
- **In scope**: `src/main/claude/` (ControlPlane, RunManager, PtyRunManager, event-normalizer)
- **Out of scope**: No Claude-specific code outside this directory
- **Future**: `src/main/codex/` for Codex driver (when needed)
- **Sacred rule**: If code needs to know about Claude/Codex, it must live in the driver directory

### Theme System (Zustand + Electron)
- **Colors**: Defined in `src/renderer/theme.ts` as JS objects
- **Consumption**: `useColors()` hook returns active palette (dark/light)
- **Sync**: Electron nativeTheme change → IPC → store update
- **Rendering**: Tailwind + inline style props (e.g., `style={{ color: colors.textPrimary }}`)

## Build Process

**Entry points** (defined in `electron.vite.config.ts`):
- **Main**: `src/main/index.ts` → `dist/main/index.js`
- **Preload**: `src/preload/index.ts` → `dist/preload/index.js`
- **Renderer**: `src/renderer/index.html` → `dist/renderer/` (Vite + React + Tailwind)

**Dev**: `npm run dev` (electron-vite dev mode, hot reload)
**Build**: `npm run build` (electron-vite build)
**Package**: `npm run dist` (electron-builder, macOS .dmg)

## Session & State Persistence

- **Tabs**: Stored in Zustand store (volatile, reset on app restart)
- **Sessions**: Claude sessions saved by Claude Code in `~/.claude/sessions/`
- **Skills**: Installed to `~/.claude/skills/` (persistent)
- **Marketplace cache**: 5-min TTL in memory
- **Logs**: `~/.clui-debug.log` (unbounded, for diagnostics)
