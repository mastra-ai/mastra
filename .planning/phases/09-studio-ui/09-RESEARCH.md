# Phase 9: Studio UI - Research

**Researched:** 2026-01-27
**Domain:** React UI components for real-time WebSocket-based screencast viewing
**Confidence:** HIGH

## Summary

Phase 9 implements a BrowserViewPanel component in Mastra Studio that displays live browser screencast frames alongside the agent chat. The codebase already uses `react-resizable-panels` for all panel layouts, `zustand` for state management, and `@tanstack/react-query` for server state. The design system (`packages/playground-ui/src/ds/`) provides Skeleton, StatusBadge, and Badge components that match the required loading and status indicator patterns.

The WebSocket client will connect to the Phase 8 endpoint (`/browser/:agentId/stream`) and receive JSON status messages and base64-encoded JPEG frames. The key performance optimization is using `useRef` with direct DOM manipulation to update the `<img>` element's `src` attribute, avoiding React virtual DOM diffing for high-frequency frame updates.

**Primary recommendation:** Build BrowserViewPanel in `packages/playground-ui/src/domains/agents/components/` using existing CollapsiblePanel, Skeleton, and StatusBadge primitives, with a custom `useBrowserStream` hook for WebSocket management.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already in Codebase)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-resizable-panels | ^4.0.15 | Resizable panel layout | Already used for AgentLayout and WorkflowLayout |
| zustand | ^5.0.9 | State management | Already used for PlaygroundStore |
| @tanstack/react-query | ^5.90.9 | Server state | Already used for all API calls |

### Supporting (Already in Codebase)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| class-variance-authority | ^0.7.1 | Component variants | Status indicator styling |
| clsx | ^2.1.1 | Class name merging | Dynamic class composition |
| tailwind-merge | ^3.3.1 | Tailwind class deduplication | Via `cn()` utility |
| lucide-react | ^0.522.0 | Icons | Connection status icons |

### No New Dependencies Required
The codebase has everything needed. No new npm packages required.

**Installation:**
```bash
# No new dependencies needed - all required packages already in playground-ui
```

## Architecture Patterns

### Recommended File Structure
```
packages/playground-ui/src/domains/agents/
├── components/
│   ├── browser-view/
│   │   ├── browser-view-panel.tsx    # Main panel component
│   │   ├── browser-view-frame.tsx    # Frame renderer with useRef
│   │   ├── browser-view-header.tsx   # URL bar header
│   │   └── browser-view-status.tsx   # Connection status indicator
│   └── agent-layout.tsx              # Modify to include browser panel
├── hooks/
│   └── use-browser-stream.ts         # WebSocket hook for screencast
└── context/
    └── browser-stream-context.tsx    # Optional: share stream across components
```

### Pattern 1: useRef for Frame Rendering (Critical for Performance)
**What:** Direct DOM manipulation to update image source without React re-renders
**When to use:** When receiving 10-30 frame updates per second
**Example:**
```typescript
// Source: React Official Docs - https://react.dev/reference/react/useRef
const imgRef = useRef<HTMLImageElement>(null);

// In WebSocket message handler - called 10-30 times per second
const handleFrame = (base64Data: string) => {
  if (imgRef.current) {
    // Direct DOM update - bypasses virtual DOM entirely
    imgRef.current.src = `data:image/jpeg;base64,${base64Data}`;
  }
};

// Render once - never re-renders due to frame updates
return <img ref={imgRef} className="w-full h-auto" alt="Browser view" />;
```

### Pattern 2: WebSocket Reconnection with Exponential Backoff
**What:** Auto-reconnect with increasing intervals on disconnect
**When to use:** For resilient real-time connections
**Example:**
```typescript
// Source: react-use-websocket patterns - https://github.com/robtaussig/react-use-websocket
const [reconnectAttempt, setReconnectAttempt] = useState(0);

const getReconnectInterval = (attempt: number): number => {
  // Exponential backoff: 1s, 2s, 4s, 8s, capped at 30s
  return Math.min(1000 * Math.pow(2, attempt), 30000);
};

useEffect(() => {
  if (status === 'disconnected' && shouldReconnect) {
    const timeout = setTimeout(() => {
      connect();
      setReconnectAttempt(prev => prev + 1);
    }, getReconnectInterval(reconnectAttempt));
    return () => clearTimeout(timeout);
  }
}, [status, shouldReconnect, reconnectAttempt]);
```

### Pattern 3: Conditional Panel with Auto-Hide
**What:** Panel appears only when browser is active
**When to use:** AgentLayout browser panel slot
**Example:**
```typescript
// Source: Existing AgentLayout pattern in codebase
// packages/playground-ui/src/domains/agents/components/agent-layout.tsx
<AgentLayout
  agentId={agentId}
  leftSlot={memory && <AgentSidebar />}
  rightSlot={<AgentInformation />}
  browserSlot={browserActive && <BrowserViewPanel agentId={agentId} />}  // New slot
>
  <AgentChat />
</AgentLayout>
```

### Pattern 4: Status Message Types from Phase 8
**What:** WebSocket message protocol from server
**When to use:** Parsing incoming messages
**Example:**
```typescript
// Source: packages/deployer/src/server/browser-stream/types.ts
type ConnectionStatus = 'connected' | 'browser_starting' | 'streaming' | 'browser_closed';

interface StatusMessage {
  status: ConnectionStatus;
}

interface ErrorMessage {
  error: 'browser_crashed' | 'screencast_failed' | 'auth_failed';
  message: string;
}

// Message parsing in hook
const handleMessage = (event: MessageEvent) => {
  const data = event.data;

  // Check if JSON (status message) or base64 (frame)
  if (data.startsWith('{')) {
    const message = JSON.parse(data) as StatusMessage | ErrorMessage;
    if ('status' in message) {
      setStatus(message.status);
    } else if ('error' in message) {
      setError(message);
    }
  } else {
    // Base64 frame data - update ref directly
    handleFrame(data);
  }
};
```

### Anti-Patterns to Avoid
- **useState for frames:** Never store frame data in React state - causes 10-30 re-renders per second
- **Reconnect without backoff:** Always use exponential backoff to avoid hammering server
- **Full image decode on every frame:** Let browser handle data URL decoding natively
- **Creating new WebSocket on every render:** Use useRef or useEffect cleanup properly

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Resizable panels | Custom drag handling | `react-resizable-panels` | Keyboard accessibility, touch support, persistence |
| Panel collapse/expand | Custom animation | `CollapsiblePanel` component | Already handles expand button, resize events |
| Status indicator dot | Custom span with colors | `StatusBadge` component | Consistent variants (success/warning/error), pulse animation |
| Loading skeleton | Custom shimmer effect | `Skeleton` component | Design system shimmer animation already defined |
| Class name merging | String concatenation | `cn()` utility | Handles Tailwind conflicts properly |
| WebSocket cleanup | Manual close() | `useEffect` cleanup function | Prevents memory leaks and orphan connections |

**Key insight:** The design system already has components for every UI requirement (StatusBadge with dots, Skeleton with shimmer, CollapsiblePanel with resize). Use them.

## Common Pitfalls

### Pitfall 1: Frame Updates Causing UI Lag
**What goes wrong:** Storing frames in useState causes React reconciliation on every frame
**Why it happens:** Developer treats frames like normal state updates
**How to avoid:** Use useRef pattern exclusively for image element, update src directly
**Warning signs:** UI feels sluggish, React DevTools shows excessive renders

### Pitfall 2: WebSocket Connection on Every Render
**What goes wrong:** New WebSocket created on each render, orphaned connections
**Why it happens:** WebSocket created inside component body without useRef/useEffect
**How to avoid:** Create WebSocket in useEffect with cleanup, store in useRef
**Warning signs:** Multiple connections in Network tab, "WebSocket is already in CLOSING or CLOSED state" errors

### Pitfall 3: Missing Reconnect on Tab Visibility Change
**What goes wrong:** User switches tabs, connection drops, never reconnects when returning
**Why it happens:** Only handling WebSocket close event, not visibility changes
**How to avoid:** Add `visibilitychange` event listener to trigger reconnect
**Warning signs:** Stale frame shown when returning to tab

### Pitfall 4: Panel Remounts Breaking WebSocket
**What goes wrong:** Panel hides then shows, WebSocket recreated, brief disconnect
**Why it happens:** Conditional rendering unmounts component entirely
**How to avoid:** Use CSS visibility/opacity for hide instead of removing from DOM, OR accept brief reconnect
**Warning signs:** Flash of "connecting" state when panel reappears

### Pitfall 5: Memory Leak from Uncleared Frame Data
**What goes wrong:** Large base64 strings accumulate if stored anywhere
**Why it happens:** Developer stores "last frame" for disconnected overlay
**How to avoid:** If storing last frame, use a single ref that gets overwritten, not an array
**Warning signs:** Memory usage grows over time in Chrome DevTools

## Code Examples

Verified patterns from official sources and codebase:

### useBrowserStream Hook
```typescript
// New hook to create: packages/playground-ui/src/domains/agents/hooks/use-browser-stream.ts
import { useRef, useEffect, useState, useCallback } from 'react';

export type StreamStatus =
  | 'idle'           // Not connected
  | 'connecting'     // WebSocket connecting
  | 'connected'      // WebSocket open, waiting for stream
  | 'browser_starting' // Browser launching
  | 'streaming'      // Receiving frames
  | 'disconnected'   // Connection lost
  | 'error';         // Error state

interface UseBrowserStreamOptions {
  agentId: string;
  enabled?: boolean;
  onFrame?: (data: string) => void;
  maxReconnectAttempts?: number;
}

export function useBrowserStream({
  agentId,
  enabled = true,
  onFrame,
  maxReconnectAttempts = 10
}: UseBrowserStreamOptions) {
  const [status, setStatus] = useState<StreamStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    // Determine WebSocket URL based on current page protocol
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/browser/${agentId}/stream`;

    setStatus('connecting');
    setError(null);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptRef.current = 0; // Reset on successful connect
    };

    ws.onmessage = (event) => {
      const data = event.data;

      // JSON messages are status/error, plain text is frame data
      if (data.startsWith('{')) {
        try {
          const message = JSON.parse(data);
          if ('status' in message) {
            setStatus(message.status);
          }
          if ('error' in message) {
            setStatus('error');
            setError(message.message);
          }
          if ('url' in message) {
            setCurrentUrl(message.url);
          }
        } catch {
          // Not JSON, treat as frame
          onFrame?.(data);
        }
      } else {
        // Base64 frame data
        onFrame?.(data);
      }
    };

    ws.onclose = () => {
      setStatus('disconnected');
      scheduleReconnect();
    };

    ws.onerror = () => {
      setStatus('error');
      setError('Connection error');
    };
  }, [agentId, onFrame]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectAttemptRef.current >= maxReconnectAttempts) {
      setError('Max reconnect attempts reached');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 30000);
    reconnectAttemptRef.current++;

    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, delay);
  }, [connect, maxReconnectAttempts]);

  const disconnect = useCallback(() => {
    clearTimeout(reconnectTimeoutRef.current);
    wsRef.current?.close();
    wsRef.current = null;
    setStatus('idle');
  }, []);

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  // Handle tab visibility - reconnect when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabled && status === 'disconnected') {
        connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [enabled, status, connect]);

  return {
    status,
    error,
    currentUrl,
    connect,
    disconnect,
    isActive: status === 'streaming',
  };
}
```

### BrowserViewFrame Component (useRef Pattern)
```typescript
// packages/playground-ui/src/domains/agents/components/browser-view/browser-view-frame.tsx
import { useRef, useEffect } from 'react';
import { Skeleton } from '@/ds/components/Skeleton';
import { useBrowserStream } from '../../hooks/use-browser-stream';
import { cn } from '@/lib/utils';

interface BrowserViewFrameProps {
  agentId: string;
  className?: string;
}

export function BrowserViewFrame({ agentId, className }: BrowserViewFrameProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const hasFrameRef = useRef(false);

  // Direct DOM update - bypasses React rendering
  const handleFrame = (base64Data: string) => {
    if (imgRef.current) {
      imgRef.current.src = `data:image/jpeg;base64,${base64Data}`;
      hasFrameRef.current = true;
    }
  };

  const { status, error } = useBrowserStream({
    agentId,
    onFrame: handleFrame,
  });

  const showSkeleton = status === 'connecting' || status === 'browser_starting';
  const showError = status === 'error' && error;
  const showDisconnected = status === 'disconnected' && hasFrameRef.current;

  return (
    <div className={cn('relative w-full aspect-video bg-surface2 rounded-md overflow-hidden', className)}>
      {/* Image element - only mounted once, updated via ref */}
      <img
        ref={imgRef}
        className={cn(
          'w-full h-full object-contain',
          !hasFrameRef.current && 'hidden'
        )}
        alt="Browser screencast"
      />

      {/* Loading skeleton */}
      {showSkeleton && (
        <Skeleton className="absolute inset-0" />
      )}

      {/* Disconnected overlay */}
      {showDisconnected && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface1/80">
          <span className="text-neutral3">Reconnecting...</span>
        </div>
      )}

      {/* Error overlay */}
      {showError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface1/80 gap-2">
          <span className="text-accent2">{error}</span>
        </div>
      )}
    </div>
  );
}
```

### BrowserViewStatus Component
```typescript
// packages/playground-ui/src/domains/agents/components/browser-view/browser-view-status.tsx
import { StatusBadge } from '@/ds/components/StatusBadge';
import type { StreamStatus } from '../../hooks/use-browser-stream';

interface BrowserViewStatusProps {
  status: StreamStatus;
}

const statusConfig: Record<StreamStatus, { variant: 'success' | 'warning' | 'error' | 'neutral'; label: string; pulse: boolean }> = {
  idle: { variant: 'neutral', label: 'Idle', pulse: false },
  connecting: { variant: 'warning', label: 'Connecting', pulse: true },
  connected: { variant: 'warning', label: 'Connected', pulse: true },
  browser_starting: { variant: 'warning', label: 'Starting', pulse: true },
  streaming: { variant: 'success', label: 'Live', pulse: false },
  disconnected: { variant: 'error', label: 'Disconnected', pulse: true },
  error: { variant: 'error', label: 'Error', pulse: false },
};

export function BrowserViewStatus({ status }: BrowserViewStatusProps) {
  const config = statusConfig[status];

  return (
    <StatusBadge
      variant={config.variant}
      withDot
      pulse={config.pulse}
      size="sm"
    >
      {config.label}
    </StatusBadge>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Polling for screenshots | WebSocket streaming | Phase 8 | Real-time viewing instead of periodic refresh |
| Server-sent events | WebSocket | N/A | Bidirectional for future input (Phase 10+) |
| Canvas drawing | Direct img src | Established | Simpler, browser handles decoding |

**Deprecated/outdated:**
- None for this phase - using established React patterns

## Open Questions

Things that couldn't be fully resolved:

1. **Browser panel slot in AgentLayout**
   - What we know: AgentLayout has leftSlot and rightSlot, browser should be in rightSlot area
   - What's unclear: Should browser replace rightSlot or be adjacent? Should it be above/below AgentInformation?
   - Recommendation: Add new `browserSlot` prop that renders alongside rightSlot when present

2. **Detection of browser availability**
   - What we know: Phase 8 endpoint exists, returns status messages
   - What's unclear: How does UI know browser is available BEFORE connecting? Need API call or always try?
   - Recommendation: Attempt connection, handle gracefully if no toolset. Server sends status indicating availability.

3. **Panel width persistence**
   - What we know: react-resizable-panels supports `useDefaultLayout` with localStorage
   - What's unclear: Should browser panel width persist separately from main layout?
   - Recommendation: Use same pattern as existing layouts - layout ID like `agent-layout-${agentId}-browser`

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `packages/playground-ui/src/domains/agents/components/agent-layout.tsx` - Existing resizable panel pattern
- Codebase analysis: `packages/playground-ui/src/lib/resize/collapsible-panel.tsx` - CollapsiblePanel implementation
- Codebase analysis: `packages/deployer/src/server/browser-stream/` - Phase 8 WebSocket protocol
- Codebase analysis: `packages/playground-ui/src/ds/components/StatusBadge/` - Status indicator with dot variants
- Codebase analysis: `packages/playground-ui/src/ds/components/Skeleton/` - Loading skeleton with shimmer
- [React Official Docs - useRef](https://react.dev/reference/react/useRef) - Authoritative useRef documentation

### Secondary (MEDIUM confidence)
- [react-resizable-panels GitHub](https://github.com/bvaughn/react-resizable-panels) - Library API and patterns
- [react-use-websocket](https://github.com/robtaussig/react-use-websocket) - Reconnection patterns reference
- [WebSockets in React 2026](https://oneuptime.com/blog/post/2026-01-15-websockets-react-real-time-applications/view) - Current best practices

### Tertiary (LOW confidence)
- None required - all patterns verified with primary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in codebase, versions verified
- Architecture: HIGH - Patterns extracted from existing codebase components
- Pitfalls: HIGH - Based on established React patterns and WebSocket best practices
- Code examples: MEDIUM - Synthesized from codebase patterns and verified docs

**Research date:** 2026-01-27
**Valid until:** 2026-02-27 (30 days - stable patterns, no fast-moving dependencies)
