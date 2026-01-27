# Architecture Patterns

**Domain:** Browser toolset for AI agents
**Researched:** 2026-01-26

## Recommended Architecture

```
+------------------+     +-------------------+     +------------------+
|   Mastra Agent   |---->|  Browser Toolset  |---->|  agent-browser   |
|                  |     |   (Integration)   |     |  BrowserManager  |
+------------------+     +-------------------+     +------------------+
                                 |
                                 v
                    +------------------------+
                    |    Individual Tools    |
                    +------------------------+
                    | - navigate            |
                    | - snapshot            |
                    | - click               |
                    | - type                |
                    | - scroll              |
                    | - screenshot          |
                    +------------------------+
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `BrowserToolset` | Tool collection, lifecycle management, browser instance ownership | Mastra Agent (via tools interface), BrowserManager |
| `BrowserManager` | Browser automation, Playwright wrapper, accessibility tree generation | Toolset methods, underlying Chromium |
| Individual Tools | Single-purpose browser operations with Zod schemas | Toolset (shared browser), Agent (via tool calls) |
| Element Refs Registry | Maps `@e1`, `@e2` etc. to DOM elements within snapshot scope | Snapshot (generates), interaction tools (consume) |

### Data Flow

**Agent-to-Browser Flow:**

```
1. Agent receives task requiring web interaction
2. Agent calls navigate tool with URL
3. Toolset ensures browser is launched (lazy init)
4. BrowserManager navigates to URL
5. Agent calls snapshot tool
6. Snapshot returns accessibility tree with refs (@e1, @e2, etc.)
7. Agent reasons about page structure
8. Agent calls click/type with ref identifier
9. Toolset resolves ref to DOM element
10. BrowserManager executes action
```

**Ref Lifecycle:**

```
snapshot() → generates fresh refs → refs valid until next snapshot
click(@e5) → uses current refs → action executed
snapshot() → invalidates old refs → new refs generated
```

**Key insight:** Refs are snapshot-scoped. Each snapshot invalidates previous refs.

## Component Details

### 1. BrowserToolset Class

```typescript
class BrowserToolset {
  readonly name = 'agent-browser';
  private browserManager: BrowserManager | null = null;
  private currentRefs: Map<string, ElementHandle> = new Map();

  // Lazy initialization
  private async ensureBrowser(): Promise<BrowserManager> {
    if (!this.browserManager) {
      this.browserManager = new BrowserManager();
      await this.browserManager.launch({ headless: true });
    }
    return this.browserManager;
  }

  readonly tools = {
    navigate: createTool({ ... }),
    snapshot: createTool({ ... }),
    click: createTool({ ... }),
    type: createTool({ ... }),
    scroll: createTool({ ... }),
    screenshot: createTool({ ... }),
  };

  async close(): Promise<void> {
    if (this.browserManager) {
      await this.browserManager.close();
      this.browserManager = null;
    }
    this.currentRefs.clear();
  }
}
```

### 2. Tool Schemas

**Navigate:**
```typescript
inputSchema: z.object({
  url: z.string().url(),
  waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle']).optional().default('load'),
})
```

**Snapshot:**
```typescript
inputSchema: z.object({
  interactiveOnly: z.boolean().optional().default(true),
  maxDepth: z.number().optional(),
})
outputSchema: z.object({
  tree: z.string(),
  refs: z.record(z.string(), z.object({
    role: z.string(),
    name: z.string().optional(),
  })),
  elementCount: z.number(),
})
```

**Click:**
```typescript
inputSchema: z.object({
  ref: z.string().regex(/^@e\d+$/),
  button: z.enum(['left', 'right', 'middle']).optional().default('left'),
})
```

## Patterns to Follow

### Pattern 1: Lazy Browser Initialization
Browser instance created on first tool use, not at toolset construction.

### Pattern 2: Ref-Based Element Targeting
Use accessibility refs (`@e1`) instead of CSS selectors. Refs are deterministic within snapshot scope.

### Pattern 3: Snapshot-Before-Act
Always capture fresh snapshot before interactions. Refs become stale after DOM changes.

### Pattern 4: Tool Independence
Each tool callable independently. Navigate handles "no browser" case. Click handles "no snapshot taken" case.

### Pattern 5: Structured Error Returns
Return error information in output schema, don't throw for recoverable errors.

## Anti-Patterns to Avoid

1. **CSS Selector Exposure** - Selectors are brittle, LLMs hallucinate invalid selectors
2. **Browser Instance Per Tool Call** - Extremely slow, loses session state
3. **Unscoped Refs** - Refs must be cleared on every snapshot
4. **Raw DOM Dump** - Too many tokens, hard for LLM to parse

## Build Order Dependencies

```
1. BrowserToolset skeleton
   └── Lazy browser initialization
   └── Close/cleanup method

2. navigate tool
   └── Triggers browser launch

3. snapshot tool
   └── Ref generation
   └── Ref registry management

4. click tool (depends on snapshot)
5. type tool (depends on snapshot)
6. scroll tool
7. screenshot tool
```

## File Structure

```
integrations/agent-browser/
├── src/
│   ├── index.ts
│   ├── toolset.ts
│   ├── types.ts
│   ├── tools/
│   │   ├── navigate.ts
│   │   ├── snapshot.ts
│   │   ├── click.ts
│   │   ├── type.ts
│   │   ├── scroll.ts
│   │   └── screenshot.ts
│   └── __tests__/
├── package.json
└── README.md
```

---

# Browser Live View Architecture (Milestone 2)

**Domain:** Browser screencast streaming for Mastra Studio
**Researched:** 2026-01-27
**Confidence:** HIGH (verified with codebase analysis and agent-browser documentation)

## Recommended Architecture

```
+-------------------+     WebSocket      +-------------------+
|  Studio UI        |<------------------>|  Mastra Server    |
| (playground-ui)   |     frames/input   | (packages/server) |
+-------------------+                    +-------------------+
        |                                        |
        | React Components                       | Route Handler
        v                                        v
+-------------------+                    +-------------------+
| BrowserViewPanel  |                    | /browser/stream   |
| - frame display   |                    | - WS upgrade      |
| - input relay     |                    | - session mgmt    |
+-------------------+                    +-------------------+
                                                 |
                                                 | getBrowser()
                                                 v
                                         +-------------------+
                                         | BrowserToolset    |
                                         | (agent-browser)   |
                                         +-------------------+
                                                 |
                                                 | CDP
                                                 v
                                         +-------------------+
                                         | BrowserManager    |
                                         | - startScreencast |
                                         | - injectMouse     |
                                         | - injectKeyboard  |
                                         +-------------------+
```

### Live View Data Flow

1. **Screencast Start:** Studio connects via WebSocket to `/browser/:sessionId/stream`
2. **Frame Capture:** Server calls `browserManager.startScreencast(callback, options)`
3. **Frame Transmission:** Callback pushes base64 JPEG frames over WebSocket
4. **Input Relay:** User mouse/keyboard events sent via WebSocket to server
5. **Input Injection:** Server calls `browserManager.injectMouseEvent/injectKeyboardEvent`
6. **Cleanup:** On disconnect, server calls `stopScreencast()` and closes WS

### Component Boundaries

| Component | Responsibility | Location | Status |
|-----------|---------------|----------|--------|
| BrowserToolset | Browser lifecycle, tool execution | `integrations/agent-browser/` | EXISTS |
| BrowserManager | CDP interaction, screencast API | `agent-browser` npm package | EXISTS |
| BrowserStreamHandler | WS upgrade, session routing, frame relay | `packages/server/` | NEW |
| BrowserViewPanel | Frame display, input capture | `packages/playground-ui/` | NEW |
| AgentLayout | Panel composition with browser slot | `packages/playground-ui/` | MODIFY |

## Integration Points

### 1. BrowserToolset Extension (Minimal Changes)

The existing `BrowserToolset` class already has `getBrowser()` for lazy initialization. Screencast should be exposed through a controlled interface.

**Recommended approach:** Add screencast control methods to BrowserToolset:

```typescript
// integrations/agent-browser/src/toolset.ts (additions)
class BrowserToolset {
  // Existing: browserManager, tools, getBrowser(), close()

  // NEW: Screencast control
  async startScreencast(
    callback: (frame: ScreencastFrame) => void,
    options?: ScreencastOptions
  ): Promise<void> {
    const browser = await this.getBrowser();
    return browser.startScreencast(callback, options);
  }

  async stopScreencast(): Promise<void> {
    if (this.browserManager) {
      return this.browserManager.stopScreencast();
    }
  }

  async injectMouseEvent(event: MouseEvent): Promise<void> {
    const browser = await this.getBrowser();
    return browser.injectMouseEvent(event);
  }

  async injectKeyboardEvent(event: KeyboardEvent): Promise<void> {
    const browser = await this.getBrowser();
    return browser.injectKeyboardEvent(event);
  }
}
```

**Rationale:** Keep screencast control co-located with browser lifecycle. BrowserToolset already manages the singleton BrowserManager.

### 2. Server WebSocket Endpoint (New Handler)

The Mastra server currently uses Hono and does not have WebSocket routes. Need to add WebSocket support.

**Endpoint design:**

```typescript
// packages/server/src/server/handlers/browser-stream.ts (new file)

// Schema
const browserStreamPathParams = z.object({
  agentId: z.string(),  // Links to agent's BrowserToolset
});

// WebSocket message types
interface ServerMessage {
  type: 'frame' | 'metadata' | 'error';
  data: string;  // base64 for frames
  metadata?: ScreencastFrame['metadata'];
}

interface ClientMessage {
  type: 'mouse' | 'keyboard' | 'start' | 'stop';
  event?: MouseEvent | KeyboardEvent;
  options?: ScreencastOptions;
}
```

**Integration challenge:** Mastra server uses Hono which supports WebSockets via `upgradeWebSocket` adapter. However, this requires explicit adapter configuration.

**Recommended approach:**

```typescript
// packages/server/src/server/handlers/browser-stream.ts
import { createBunWebSocket } from 'hono/bun';

export function createBrowserStreamRoute(getToolset: (agentId: string) => BrowserToolset | null) {
  return {
    method: 'GET',
    path: '/browser/:agentId/stream',
    handler: async (c) => {
      const { upgradeWebSocket } = createBunWebSocket();

      return upgradeWebSocket(c, {
        onOpen(ws, c) {
          const agentId = c.req.param('agentId');
          const toolset = getToolset(agentId);
          if (!toolset) {
            ws.close(1008, 'Browser toolset not found');
            return;
          }

          toolset.startScreencast((frame) => {
            ws.send(JSON.stringify({
              type: 'frame',
              data: frame.data,
              metadata: frame.metadata,
            }));
          }, { format: 'jpeg', quality: 70, maxWidth: 1280 });
        },

        onMessage(ws, message) {
          const msg = JSON.parse(message.data) as ClientMessage;
          // Handle input events
        },

        onClose() {
          toolset?.stopScreencast();
        }
      });
    }
  };
}
```

**Alternative (simpler):** Use Server-Sent Events (SSE) instead of WebSocket for frames, with separate POST endpoints for input. This fits the existing `responseType: 'stream'` pattern better.

### 3. Toolset Registry Problem

**Key challenge:** How does the server know which BrowserToolset instance to use?

Current state:
- Agents have tools, including browser tools from BrowserToolset
- BrowserToolset instances are created by user code, not the Mastra server
- No registry maps agentId to BrowserToolset instance

**Options:**

**Option A: Agent-scoped toolset registry (Recommended)**
```typescript
// In Mastra or agent configuration
const browserTools = new BrowserToolset({ headless: false });
const agent = new Agent({
  tools: browserTools.tools,
  metadata: { browserToolset: browserTools }  // Register for streaming
});
```

**Option B: Global toolset registry**
```typescript
// Singleton registry
BrowserToolsetRegistry.register(agentId, browserToolset);
```

**Option C: On-demand toolset creation**
- Server creates BrowserToolset when stream requested
- Problem: Loses shared state with agent's browser session

**Recommendation:** Option A - store reference in agent metadata. This maintains the existing ownership model where user code controls BrowserToolset lifecycle.

### 4. Studio UI Components (New + Modify)

**New component: BrowserViewPanel**

```typescript
// packages/playground-ui/src/domains/browser/components/BrowserViewPanel.tsx

interface BrowserViewPanelProps {
  agentId: string;
  enabled: boolean;  // Whether to connect to stream
}

export function BrowserViewPanel({ agentId, enabled }: BrowserViewPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [connected, setConnected] = useState(false);
  const [metadata, setMetadata] = useState<FrameMetadata | null>(null);

  // WebSocket connection to /browser/:agentId/stream
  useEffect(() => {
    if (!enabled) return;

    const ws = new WebSocket(`ws://${host}/browser/${agentId}/stream`);
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'frame') {
        drawFrame(canvasRef.current, msg.data);
        setMetadata(msg.metadata);
      }
    };

    return () => ws.close();
  }, [agentId, enabled]);

  // Input capture and relay
  const handleMouseEvent = (e: React.MouseEvent) => {
    // Scale coordinates to browser viewport
    // Send via WebSocket
  };

  return (
    <div className="browser-view-panel">
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseEvent}
        onMouseDown={handleMouseEvent}
        onMouseUp={handleMouseEvent}
        onKeyDown={handleKeyEvent}
      />
      {metadata && <BrowserMetadataOverlay metadata={metadata} />}
    </div>
  );
}
```

**Modify: AgentLayout**

The existing `AgentLayout` has `leftSlot` and `rightSlot` props. Browser view should go in a new slot or replace the right slot conditionally.

```typescript
// packages/playground-ui/src/domains/agents/components/agent-layout.tsx

export interface AgentLayoutProps {
  agentId: string;
  children: React.ReactNode;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  browserSlot?: React.ReactNode;  // NEW: Browser view slot
}

// Render browserSlot when agent has browser tools
{hasBrowserTools && browserSlot && (
  <>
    <PanelSeparator />
    <CollapsiblePanel
      direction="right"
      id="browser-slot"
      minSize={400}
      maxSize={'60%'}
      defaultSize={'40%'}
    >
      {browserSlot}
    </CollapsiblePanel>
  </>
)}
```

**Modify: Agent page (packages/playground)**

```typescript
// Detect if agent has browser tools
const hasBrowserTools = Object.keys(agent.tools || {}).some(
  name => name.startsWith('browser_')
);

<AgentLayout
  agentId={agentId}
  browserSlot={hasBrowserTools ? (
    <BrowserViewPanel agentId={agentId} enabled={true} />
  ) : undefined}
>
  <AgentChat ... />
</AgentLayout>
```

## Anti-Patterns to Avoid (Live View Specific)

### Anti-Pattern 1: Polling for Frames
**What:** Using HTTP polling instead of WebSocket/SSE for frame delivery
**Why bad:** High latency (200-500ms vs 16ms), excessive bandwidth, poor UX
**Instead:** Use WebSocket or SSE for push-based frame delivery

### Anti-Pattern 2: Sending Full-Resolution Frames
**What:** Sending raw CDP frames without size limits
**Why bad:** CDP can send 4K frames at 60fps = massive bandwidth
**Instead:** Configure `maxWidth: 1280, maxHeight: 720, quality: 70`

### Anti-Pattern 3: Creating New BrowserManager per Stream
**What:** Each stream request creates a new browser instance
**Why bad:** Loses agent's browser state, resource waste
**Instead:** Share BrowserManager between tools and stream via BrowserToolset

### Anti-Pattern 4: Blocking Tool Execution During Stream
**What:** Screencast frames blocking tool execution
**Why bad:** Agent actions become slow/unresponsive
**Instead:** CDP screencast is async, frames come via callback, non-blocking

## Patterns to Follow (Live View Specific)

### Pattern 1: Session-Based Streaming
**What:** Each agent+thread has one active stream session
**When:** Always - prevents multiple viewers fighting over one browser
**Example:**
```typescript
const sessions = new Map<string, StreamSession>();

function getOrCreateSession(agentId: string, threadId: string) {
  const key = `${agentId}:${threadId}`;
  if (!sessions.has(key)) {
    sessions.set(key, new StreamSession(agentId, threadId));
  }
  return sessions.get(key);
}
```

### Pattern 2: Graceful Degradation
**What:** Browser view works even if streaming fails
**When:** Always - stream is enhancement, not requirement
**Example:**
```typescript
// UI shows placeholder if stream unavailable
{streamError ? (
  <BrowserPlaceholder message="Live view unavailable" />
) : (
  <BrowserCanvas frames={frames} />
)}
```

### Pattern 3: Coordinate Transformation
**What:** Transform UI coordinates to browser viewport coordinates
**When:** All input injection
**Example:**
```typescript
function transformCoords(
  uiX: number, uiY: number,
  canvasWidth: number, canvasHeight: number,
  metadata: FrameMetadata
) {
  const scaleX = metadata.deviceWidth / canvasWidth;
  const scaleY = metadata.deviceHeight / canvasHeight;
  return {
    x: uiX * scaleX + metadata.scrollOffsetX,
    y: uiY * scaleY + metadata.scrollOffsetY,
  };
}
```

## Suggested Build Order for Live View

Based on dependencies, build in this order:

### Phase 1: BrowserToolset Extension (Foundation)
1. Add screencast methods to BrowserToolset
2. Add input injection methods to BrowserToolset
3. Unit tests for new methods
4. **No server/UI changes yet** - enables incremental testing

### Phase 2: Server WebSocket Handler (Bridge)
1. Research Hono WebSocket adapter for server runtime (Bun/Node)
2. Create browser-stream handler with session management
3. Add route to SERVER_ROUTES
4. Integration test with mock BrowserToolset
5. **Dependency:** Phase 1 complete

### Phase 3: UI Components (Experience)
1. Create BrowserViewPanel component
2. Add canvas rendering utilities
3. Add input capture and relay
4. Unit test with mock WebSocket
5. **Dependency:** Phase 2 complete (need real endpoint)

### Phase 4: Integration (Polish)
1. Modify AgentLayout for browser slot
2. Add agent browser detection
3. Wire up in playground routes
4. E2E test full flow
5. **Dependency:** Phases 1-3 complete

## Open Questions for Phase-Specific Research

| Question | When to Research | Why |
|----------|------------------|-----|
| Hono WS adapter compatibility | Phase 2 start | Need to verify Bun vs Node runtime support |
| Frame rate throttling strategy | Phase 2 | May need adaptive quality based on connection |
| Touch event support | Phase 3 | Mobile Studio users may want touch input |
| Multi-viewer support | Phase 4 | Whether to support multiple concurrent viewers |

## Sources

- **agent-browser v0.8.4**: npm package, GitHub repository (vercel-labs/agent-browser)
  - Screencast API: startScreencast, stopScreencast, frame callback
  - Input injection: injectMouseEvent, injectKeyboardEvent
  - Confidence: HIGH (verified from source)

- **BrowserToolset**: `/Users/abhiramaiyer/.superset/worktrees/mastra/ab-tools/integrations/agent-browser/src/toolset.ts`
  - Lazy BrowserManager initialization via getBrowser()
  - Singleton pattern for browser instance
  - Confidence: HIGH (direct codebase inspection)

- **Mastra Server**: `/Users/abhiramaiyer/.superset/worktrees/mastra/ab-tools/packages/server/src/server/`
  - Route pattern: createRoute with pathParamSchema, handler
  - Streaming support via responseType: 'stream'
  - No existing WebSocket routes
  - Confidence: HIGH (direct codebase inspection)

- **playground-ui**: `/Users/abhiramaiyer/.superset/worktrees/mastra/ab-tools/packages/playground-ui/`
  - AgentLayout: Supports leftSlot, rightSlot via CollapsiblePanel
  - Thread: Main chat interface, separate from layout slots
  - Uses @assistant-ui/react for message handling
  - Confidence: HIGH (direct codebase inspection)

---

*Architecture research: 2026-01-26 (v1.0), 2026-01-27 (live view)*
