# Code Conventions

## TypeScript Configuration

**Target:** ESNext with strict mode enabled
- `strict: true` — strict null checks, implicit any detection
- `jsx: "react-jsx"` — modern JSX transform (no React import needed)
- `moduleResolution: "bundler"` — node_modules resolution
- `declaration: true` — generates .d.ts files

**Source structure:**
- `src/main/` — Electron main process
- `src/renderer/` — React UI (Vite)
- `src/preload/` — IPC bridge
- `src/shared/` — Types shared between processes

---

## Naming Conventions

### Files
- **Components:** PascalCase, one per file
  - File: `InputBar.tsx`
  - Export: `function InputBar() { ... }`
- **Stores/Hooks:** camelCase prefix with `use` or descriptive name
  - File: `sessionStore.ts`, `useClaudeEvents.ts`
  - Export: `useSessionStore`, `useClaudeEvents`
- **Utilities/Types:** camelCase (functions) or PascalCase (types)
  - File: `process-manager.ts`, `event-normalizer.ts`
  - Functions: `startRun()`, `normalize()`
  - Types: `ProcessManager`, `NormalizedEvent`, `TabState`
- **Config:** lowercase with dashes
  - `electron.vite.config.ts`, `tsconfig.json`

### Variables & Functions
- **camelCase for functions and variables:**
  ```typescript
  function getModelDisplayLabel(modelId: string): string { }
  const normalizeModelId = (id: string) => { }
  let msgCounter = 0
  ```

- **UPPER_SNAKE_CASE for constants:**
  ```typescript
  const AVAILABLE_MODELS = [...]
  const INPUT_MAX_HEIGHT = 140
  const LOG_FILE = join(homedir(), '.clui-debug.log')
  ```

- **Semantic prefixes for booleans:**
  ```typescript
  const isExpanded = true
  const hasUnread = false
  const canSend = !!tab && !isConnecting
  ```

### Types & Interfaces
- **PascalCase for all type definitions:**
  ```typescript
  interface TabState { }
  interface Message { }
  type TabStatus = 'connecting' | 'idle' | 'running' | ...
  type NormalizedEvent = { type: 'session_init'; ... } | ...
  ```

---

## Code Style

### Imports
- **Absolute imports from tsconfig (baseUrl not set, use relative paths or `src/` prefix)**
- **Group imports by category:**
  ```typescript
  // React/UI libraries first
  import React, { useState, useRef } from 'react'
  import { motion, AnimatePresence } from 'framer-motion'
  import { Microphone, ArrowUp } from '@phosphor-icons/react'

  // Internal: stores
  import { useSessionStore } from '../stores/sessionStore'

  // Internal: components
  import { InputBar } from './InputBar'
  import { AttachmentChips } from './AttachmentChips'

  // Internal: utilities
  import { useColors } from '../theme'
  import type { NormalizedEvent } from '../../shared/types'
  ```

- **Use `type` imports for types only:**
  ```typescript
  import type { VoiceState, Message } from '../stores/sessionStore'
  ```

### Sections & Comments
- **Sectioning with visual separators:**
  ```typescript
  // ─── Known models ───
  export const AVAILABLE_MODELS = [...]

  // ─── Store ───
  interface State { }

  // ─── Notification sound ───
  const notificationAudio = new Audio(notificationSrc)
  ```
- Use em-dashes in comments sparingly (max 1 per logical section)

### Store Structure (Zustand)

**sessionStore.ts pattern:**
```typescript
// 1. Constants section
export const AVAILABLE_MODELS = [...]

// 2. Utility functions (pure, module-scoped)
function getModelDisplayLabel(modelId: string): string { }
function makeLocalTab(): TabState { }

// 3. Types section
interface StaticInfo { }
interface State { }

// 4. Module-level state
let msgCounter = 0
const nextMsgId = () => `msg-${++msgCounter}`

// 5. Store creation with create<State>((set, get) => ({ ... }))
export const useSessionStore = create<State>((set, get) => ({
  // Initial values
  tabs: [initialTab],

  // Action methods (alphabetical or grouped by domain)
  initStaticInfo: async () => { },
  setPreferredModel: (model) => { },

  // Event handlers (grouped together)
  handleNormalizedEvent: (tabId, event) => { },
  handleStatusChange: (tabId, newStatus) => { },
}))
```

### Components

**File structure:**
```typescript
// 1. Imports
import React, { useState, useRef } from 'react'
import { useSessionStore } from '../stores/sessionStore'

// 2. Constants
const INPUT_MIN_HEIGHT = 20
const INPUT_MAX_HEIGHT = 140

// 3. Types (if not in separate file)
type VoiceState = 'idle' | 'recording' | 'transcribing'

// 4. Component definition
export function InputBar() {
  // Hooks first
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Selectors from stores
  const sendMessage = useSessionStore((s) => s.sendMessage)

  // Derived values
  const isBusy = tab?.status === 'running'

  // Event handlers (with useCallback if passed to children)
  const handleSend = useCallback(() => { }, [deps])

  // Effects
  useEffect(() => { }, [deps])

  // Render
  return <div>...</div>
}

// 5. Extracted sub-components (if duplication detected)
function VoiceButtons({ ... }) { }
```

### Main Process

**Pattern: Classes for stateful managers, functions for utilities**
```typescript
// Process Manager
export class ProcessManager extends EventEmitter {
  private activeRuns = new Map<string, RunHandle>()
  private claudeBinary: string

  constructor() {
    super()
    this.claudeBinary = this.findClaudeBinary()
  }

  private findClaudeBinary(): string { }
  public startRun(options: RunOptions): RunHandle { }
}

// Event Normalizer (pure functions)
export function normalize(raw: ClaudeEvent): NormalizedEvent[] {
  switch (raw.type) { }
}

function normalizeSystem(event: InitEvent): NormalizedEvent[] { }
```

---

## Styling & Tailwind

**Inline styles are acceptable for:**
- Dynamic values (colors from theme, responsive dimensions)
- One-off CSS properties
- Performance-critical sections

**Tailwind classes for:**
- Static structural layout (`flex`, `flex-col`, `items-center`)
- Spacing (`gap-1`, `px-1`)
- Text utilities (`text-[11px]`, `font-bold`)

**Example:**
```typescript
<div className="flex flex-col w-full gap-2" style={{ background: colors.textPrimary }}>
  <input style={{ fontSize: 14, color: colors.inputText }} />
</div>
```

**Custom data attributes:**
- `data-clui-ui` — marks interactive UI for mouse-event forwarding in App.tsx
  ```tsx
  <div data-clui-ui className="glass-surface">...</div>
  ```

---

## Error Handling

**Defensive patterns (try-catch with silent fallback):**
```typescript
try {
  const result = await window.clui.start()
  set({ staticInfo: result })
} catch {}  // Silent fallback is intentional for non-critical IPC
```

**Type narrowing on error:**
```typescript
catch (err: unknown) {
  set({
    marketplaceError: err instanceof Error ? err.message : String(err),
  })
}
```

---

## Async Patterns

**useEffect + async without separate function:**
```typescript
useEffect(() => {
  ;(async () => {
    const data = await fetch(...)
    setState(data)
  })()
}, [deps])
```

**Explicit async functions in stores:**
```typescript
loadMarketplace: async (forceRefresh) => {
  set({ marketplaceLoading: true })
  try {
    const [catalog, installed] = await Promise.all([...])
    set({ ... })
  } catch (err) {
    set({ marketplaceError: ... })
  }
}
```

---

## DOM Access

**Refs for imperative updates:**
```typescript
const textareaRef = useRef<HTMLTextAreaElement>(null)

const autoResize = useCallback(() => {
  const el = textareaRef.current
  if (!el) return
  el.style.height = `${clampedHeight}px`
}, [])
```

**useLayoutEffect for synchronous DOM reads before paint:**
```typescript
useLayoutEffect(() => {
  autoResize()
}, [input, isMultiLine, autoResize])
```

---

## IPC & Backend Communication

**Normalized event types (shared/types.ts):**
- Events are transformed from raw Claude stream-json to canonical `NormalizedEvent`
- Normalizer is stateless (one event in, zero or more events out)
- RunManager (main) sequences and routes normalized events to renderer via IPC

**Store method pattern for sending:**
```typescript
sendMessage: (prompt, projectPath) => {
  // Optimistic UI update first
  set((s) => ({ tabs: [...] }))

  // Then fire async IPC (errors handled in event listener)
  window.clui.prompt(activeTabId, requestId, {...})
    .catch((err: Error) => {
      get().handleError(activeTabId, {...})
    })
}
```

---

## No Hard Rules, But Patterns

- **Prefer immutable patterns in stores** (spread arrays/objects, don't mutate)
- **Avoid `any` type** — use `unknown` with type guards
- **Explicit typing on component props** (no `PropsWithChildren` unless needed)
- **Extract magic numbers to constants** (especially in layout)
- **Comment "why", not "what"** — code should be readable; comments explain intent
