# Testing Strategy

## Current State

**No test framework is currently configured.** The project contains:
- TypeScript strict mode enabled
- Vite + electron-vite for builds
- No Jest, Vitest, or test runner dependencies
- No test files (*.test.ts, *.spec.ts) in the codebase

---

## When to Add Testing

Testing should be introduced incrementally, following this priority:

### High Priority (Add Tests First)
1. **Event normalizer** (`src/main/claude/event-normalizer.ts`)
   - Pure functions with clear input/output
   - Multiple branches and edge cases
   - No external dependencies
   - **Candidate framework:** Vitest (fast, ESM-native)

2. **Zustand store selectors** (especially `sessionStore.ts`)
   - Immutability constraints
   - Complex state transitions (tab lifecycle, queue management)
   - Event handler chains
   - **Framework:** Vitest + @testing-library/react

3. **IPC validation** (preload + main process)
   - Input sanitization
   - Type safety
   - **Framework:** Vitest

### Medium Priority
4. **React components** (InputBar, ConversationView, etc.)
   - Test user interactions (keyboard, voice)
   - Test conditional rendering based on state
   - **Framework:** Vitest + @testing-library/react

5. **Process manager** (`src/main/process-manager.ts`)
   - Subprocess spawning logic
   - Error scenarios
   - **Framework:** Vitest with mocked child_process

### Low Priority (or Manual)
6. **End-to-end flows** (if at all)
   - Full Claude Code invocation
   - Multi-tab session management
   - Better tested via manual integration testing

---

## Recommended Test Stack

If a test framework is to be added, use this stack:

```json
{
  "devDependencies": {
    "vitest": "^2.0.0",
    "@vitest/ui": "^2.0.0",
    "@testing-library/react": "^15.0.0",
    "@testing-library/user-event": "^14.0.0",
    "jsdom": "^24.0.0"
  }
}
```

**Why Vitest:**
- ESM-native (matches Vite setup)
- Fast (Rust-based)
- Jest-compatible API (easy migration if needed later)
- No config required for basic usage
- Integrated UI (`--ui` flag for debugging)

---

## Example Test Patterns (If Tests Are Added)

### Pure Function Testing (Event Normalizer)

```typescript
// src/main/claude/__tests__/event-normalizer.test.ts
import { describe, it, expect } from 'vitest'
import { normalize } from '../event-normalizer'
import type { InitEvent, StreamEvent } from '../../shared/types'

describe('normalize', () => {
  describe('system events', () => {
    it('converts init event to session_init', () => {
      const event: InitEvent = {
        type: 'system',
        subtype: 'init',
        session_id: 'test-session',
        tools: ['bash', 'python'],
        model: 'claude-opus-4-6',
        // ... other fields
      }

      const result = normalize(event)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        type: 'session_init',
        sessionId: 'test-session',
        tools: ['bash', 'python'],
        model: 'claude-opus-4-6',
        // ...
      })
    })

    it('returns empty array for non-init system events', () => {
      const event: InitEvent = {
        type: 'system',
        subtype: 'other',
        // ...
      }

      const result = normalize(event)

      expect(result).toEqual([])
    })
  })

  describe('stream events', () => {
    it('extracts text deltas as text_chunk', () => {
      const event: StreamEvent = {
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: 'Hello' },
        },
        session_id: 'test',
        parent_tool_use_id: null,
        uuid: 'uuid',
      }

      const result = normalize(event)

      expect(result).toEqual([{ type: 'text_chunk', text: 'Hello' }])
    })

    it('returns empty array for unknown event types', () => {
      const event = { type: 'unknown' } as any

      const result = normalize(event)

      expect(result).toEqual([])
    })
  })
})
```

### Store Testing (Zustand)

```typescript
// src/renderer/stores/__tests__/sessionStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useSessionStore } from '../sessionStore'
import type { TabState } from '../../../shared/types'

describe('useSessionStore', () => {
  beforeEach(() => {
    useSessionStore.setState({
      tabs: [
        {
          id: 'tab-1',
          claudeSessionId: null,
          status: 'idle',
          messages: [],
          title: 'Test Tab',
          // ... other fields
        },
      ],
      activeTabId: 'tab-1',
    })
  })

  describe('selectTab', () => {
    it('switches to a different tab', () => {
      const store = useSessionStore.getState()
      const tab2: TabState = {
        id: 'tab-2',
        status: 'idle',
        // ...
      }

      useSessionStore.setState((s) => ({
        tabs: [...s.tabs, tab2],
      }))

      store.selectTab('tab-2')

      expect(useSessionStore.getState().activeTabId).toBe('tab-2')
    })

    it('toggles expansion when clicking active tab', () => {
      const store = useSessionStore.getState()

      store.selectTab('tab-1')
      expect(useSessionStore.getState().isExpanded).toBe(true)

      store.selectTab('tab-1')
      expect(useSessionStore.getState().isExpanded).toBe(false)
    })

    it('clears unread flag when switching tabs', () => {
      const store = useSessionStore.getState()

      // Create second tab and mark it unread
      const tab2: TabState = {
        id: 'tab-2',
        status: 'idle',
        hasUnread: true,
        // ...
      }

      useSessionStore.setState((s) => ({
        tabs: [...s.tabs, tab2],
      }))

      store.selectTab('tab-2')

      const activeTab = useSessionStore
        .getState()
        .tabs.find((t) => t.id === 'tab-2')

      expect(activeTab?.hasUnread).toBe(false)
    })
  })

  describe('sendMessage', () => {
    it('adds message to active tab', () => {
      const store = useSessionStore.getState()

      // Mock window.clui.prompt
      window.clui = {
        prompt: async () => ({}),
      } as any

      store.sendMessage('Hello')

      const activeTab = useSessionStore
        .getState()
        .tabs.find((t) => t.id === 'tab-1')

      expect(activeTab?.messages).toHaveLength(1)
      expect(activeTab?.messages[0].role).toBe('user')
      expect(activeTab?.messages[0].content).toBe('Hello')
    })

    it('clears attachments after sending', () => {
      const store = useSessionStore.getState()

      window.clui = { prompt: async () => ({}) } as any

      useSessionStore.setState((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === 'tab-1'
            ? { ...t, attachments: [{ id: '1', type: 'image', path: '/test.png', name: 'test.png' }] }
            : t
        ),
      }))

      store.sendMessage('Test')

      const activeTab = useSessionStore
        .getState()
        .tabs.find((t) => t.id === 'tab-1')

      expect(activeTab?.attachments).toHaveLength(0)
    })
  })
})
```

### Component Testing (React)

```typescript
// src/renderer/components/__tests__/InputBar.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InputBar } from '../InputBar'

// Mock window.clui and stores
vi.mock('../stores/sessionStore', () => ({
  useSessionStore: vi.fn((selector) =>
    selector({
      sendMessage: vi.fn(),
      clearTab: vi.fn(),
      activeTabId: 'tab-1',
      tabs: [{ id: 'tab-1', status: 'idle', attachments: [], sessionSkills: [] }],
    })
  ),
}))

describe('InputBar', () => {
  beforeEach(() => {
    window.clui = {
      onWindowShown: vi.fn(() => () => {}),
    } as any
  })

  it('renders textarea and send button', () => {
    render(<InputBar />)

    expect(screen.getByPlaceholderText(/Ask Claude Code/i)).toBeInTheDocument()
    expect(screen.getByTitle('Send (Enter)')).toBeInTheDocument()
  })

  it('sends message on Enter key', async () => {
    const user = userEvent.setup()
    const { sendMessage } = require('../stores/sessionStore').useSessionStore.mock.results[0].value

    render(<InputBar />)

    const textarea = screen.getByPlaceholderText(/Ask Claude Code/i) as HTMLTextAreaElement

    await user.type(textarea, 'Hello')
    await user.keyboard('{Enter}')

    expect(sendMessage).toHaveBeenCalledWith('Hello')
  })

  it('clears input after sending', async () => {
    const user = userEvent.setup()
    render(<InputBar />)

    const textarea = screen.getByPlaceholderText(/Ask Claude Code/i) as HTMLTextAreaElement

    await user.type(textarea, 'Test message')
    await user.keyboard('{Enter}')

    expect(textarea.value).toBe('')
  })

  it('disables send when connecting', () => {
    vi.mocked(useSessionStore).mockReturnValueOnce({
      tabs: [{ id: 'tab-1', status: 'connecting', attachments: [] }],
      activeTabId: 'tab-1',
    } as any)

    render(<InputBar />)

    const sendButton = screen.queryByTitle('Send (Enter)')
    expect(sendButton).not.toBeInTheDocument()
  })
})
```

---

## Test Configuration (If Added)

**vitest.config.ts:**
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'src/test/',
      ],
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
```

**package.json scripts:**
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```

---

## Manual Testing Checklist

Until automated tests are in place, use this checklist for critical flows:

### Tab & Session Management
- [ ] Create new tab — verify ID assigned, state isolated
- [ ] Switch tabs — verify active tab changes, message history correct
- [ ] Close tab — verify remaining tabs shift correctly, no orphaned state
- [ ] Send message in tab A, then switch to tab B — verify they don't interfere

### Message Flow
- [ ] Send prompt — verify appears in chat
- [ ] Receive streaming text — verify chunks appear incrementally
- [ ] Tool call executes — verify tool card renders with status
- [ ] Run completes — verify final result and cost data display
- [ ] Run errors — verify error message displays, tab recovers

### Permissions
- [ ] Tool requires permission — verify permission card appears
- [ ] Allow — verify tool executes, card dismisses
- [ ] Deny — verify tool is skipped, queue advances
- [ ] Auto-approve mode — verify cards don't appear

### Attachments
- [ ] Paste image — verify attachment chip appears
- [ ] Remove attachment — verify chip disappears
- [ ] Send with attachments — verify context included in prompt
- [ ] New tab — verify attachments don't leak between tabs

### Voice
- [ ] Start recording — verify mic button shows recording state
- [ ] Cancel recording — verify state reverts to idle
- [ ] Complete recording — verify transcript appears in input
- [ ] Permission denied — verify error message shows

---

## Integration Testing (Manual or Cypress)

If CI/CD is added later, consider Cypress for:
- Full user workflows (tab → message → result)
- Window interaction (expand/collapse, screenshot, file attach)
- Theme switching
- Marketplace install/uninstall

For now, manual testing of these flows is sufficient.
