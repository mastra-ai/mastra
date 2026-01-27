# Feature Landscape: Browser Live View

**Domain:** Browser live view for AI agent debugging in Mastra Studio
**Researched:** 2026-01-27
**Confidence:** HIGH
**Milestone:** Live view addition to existing browser toolset

## Context

This research focuses specifically on live view features for watching browser agents work in real-time. The existing browser toolset already provides:
- navigate, snapshot, click, type, select, scroll, screenshot tools
- Accessibility refs (@e1, @e2) for element targeting
- BrowserToolError with recovery hints

The live view will integrate with Mastra Studio, appearing inline with agent chat.

## Table Stakes

Features users expect from a browser live view. Without these, the feature feels broken or incomplete.

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| **Real-time video stream** | Core purpose of live view - users must see what browser is doing NOW | Medium | CDP Page.startScreencast |
| **Connection status indicator** | Users need to know if stream is active, loading, or disconnected | Low | WebSocket state |
| **Stream start/stop lifecycle** | Stream must start when agent uses browser, stop when conversation ends | Low | Browser session events |
| **Graceful degradation** | Show "no active browser" state instead of broken UI when browser not running | Low | Session state check |
| **Basic loading state** | Show skeleton/spinner during stream initialization (1-3 seconds) | Low | None |
| **Reasonable latency** | Under 500ms glass-to-glass for interactive feel; under 2s is acceptable | Medium | Frame delivery pipeline |

### Rationale

**Real-time video stream** is the entire point. Users want to watch the browser agent work. Without this, there's no live view.

**Connection status** prevents user confusion. Research shows users assume processes have "silently failed" without status indicators. A simple indicator (connected/connecting/disconnected) sets expectations.

**Stream lifecycle** must be automatic. Users should not manually start/stop streams. Stream activates when browser tools are used, deactivates when browser closes or conversation ends.

**Graceful degradation** handles the common case where a user opens a conversation but the agent hasn't launched a browser yet. Show a clear "waiting for browser" state, not an error.

**Loading state** covers the 1-3 second startup time for CDP screencast initialization. UX research indicates indeterminate spinners are appropriate for 1-3 second waits.

**Reasonable latency** is subjective but important. CDP screencast typically achieves 200-500ms latency at 720p/30fps. Anything over 2 seconds makes the "live" view feel like a slideshow.

## Differentiators

Features that would make the live view exceptional. Not required for v1, but would significantly enhance the experience.

| Feature | Value Proposition | Complexity | Phase |
|---------|-------------------|------------|-------|
| **Action overlay/highlights** | Show what element was clicked/typed with visual indicator | Medium | v1.5 |
| **Current URL display** | Show URL bar so users know what page agent is on | Low | v1.5 |
| **Page title in header** | Quick identification of current page without reading URL | Low | v1.5 |
| **Timestamp on frames** | Know when each frame was captured for debugging | Low | v1.5 |
| **Snapshot history gallery** | View past snapshots from session, not just live stream | Medium | v2 |
| **Timeline scrubbing** | Scrub back through recorded session to see what happened | High | v2 |
| **Action log overlay** | Show tool calls (navigate, click, type) alongside video | Medium | v1.5 |
| **Resize/zoom controls** | Adjust viewport size for different screens | Low | v1.5 |
| **Picture-in-picture mode** | Keep browser view visible while scrolling chat | Medium | v2 |
| **Session recording/export** | Download video of browser session for sharing/debugging | High | v2 |
| **Adaptive quality** | Automatically adjust quality based on network conditions | Medium | v2 |
| **Multi-tab indicators** | Show tab count and active tab (when multi-tab supported) | Medium | v2+ |

### Prioritized Differentiators

**High Value, Low Complexity (v1.5 candidates):**
1. **Current URL display** - Users constantly wonder "what page is it on?"
2. **Page title in header** - Quick context without parsing URLs
3. **Timestamp on frames** - Helps debug timing issues
4. **Resize/zoom controls** - Essential for smaller screens

**High Value, Medium Complexity (v1.5-v2 candidates):**
1. **Action overlay/highlights** - Visual feedback for what agent did
2. **Action log overlay** - Correlate tool calls with visual changes

**Medium Value, High Complexity (v2+ candidates):**
1. **Timeline scrubbing** - Requires full session recording infrastructure
2. **Session recording/export** - Requires video encoding (ffmpeg)

## Anti-Features

Features to explicitly NOT build for v1. These add complexity without proportional value or conflict with the view-only requirement.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **User interaction with browser** | Scope says view-only for v1; interaction adds complexity (click forwarding, keyboard events, focus management) | Display "View only - the agent controls this browser" message |
| **Full session replay from recording** | Requires video encoding/storage infrastructure | For history, show static screenshots captured by screenshot tool |
| **Audio streaming** | Browser automation rarely needs audio; adds bandwidth/complexity | Not applicable - browser sessions are typically silent |
| **Simultaneous multi-tab view** | Multi-tab support deferred to v2; showing multiple streams multiplies complexity | Show single active tab; indicate if other tabs exist |
| **DOM inspector integration** | Adds massive complexity; agents use accessibility tree not DOM | Keep DOM inspection in actual browser DevTools |
| **Custom viewport sizes** | Let the browser toolset control viewport; live view should mirror exactly | Mirror whatever viewport the browser actually has |
| **High-def 60fps streaming** | Overkill for debugging; increases bandwidth 2-4x | 30fps at 720p-1080p is sufficient for observing agent actions |
| **WebRTC-based streaming** | Over-engineered for single viewer; CDP screencast is simpler | Use CDP Page.startScreencast with WebSocket frame delivery |
| **Offline viewing** | View-only means live; offline requires recording infrastructure | Add in v2 with session recording feature |
| **Network request overlay** | Adds complexity; not essential for watching agent work | Leave network debugging to browser DevTools |

### Anti-Feature Rationale

**User interaction** is the most critical anti-feature. The scope explicitly states "view-only for v1." Interaction requires:
- Click coordinate translation (stream size != actual viewport)
- Keyboard event forwarding
- Focus management between Studio UI and browser
- Race conditions between user and agent actions

This is a full feature set, not a small addition. Defer to v2 if ever.

**Full session replay** sounds simple but requires:
- Recording infrastructure (ffmpeg, storage)
- Timeline UI with seek controls
- Synchronized action logs
- Significant backend complexity

For v1, showing static screenshots from the existing screenshot tool is sufficient for history.

**60fps streaming** is unnecessary. Agent actions (click, type, navigate) happen at human speed. 30fps is more than sufficient to observe what the agent does. 60fps would double bandwidth requirements.

## Feature Dependencies

```
Browser toolset (existing)
    |
    v
Live view infrastructure
    |
    +---> CDP screencast (captures frames)
    |         |
    |         v
    +---> WebSocket transport (delivers frames to client)
    |         |
    |         v
    +---> React component (displays frames)
              |
              +---> Connection status indicator
              +---> Loading state
              +---> Graceful empty state

Screenshot tool (existing)
    |
    v
Snapshot history (v2) - uses existing screenshots for history view
```

**Key insight:** Live view is a parallel system to the existing tools. It observes but doesn't interact with the tool execution. The browser toolset continues to work exactly as before; live view just provides visibility.

## Technical Requirements

### Frame Delivery

| Requirement | Target | Rationale |
|-------------|--------|-----------|
| Frame rate | 15-30 fps | Sufficient for observing agent actions; balances quality vs bandwidth |
| Resolution | 720p-1080p | Match browser viewport; no upscaling needed |
| Format | JPEG (quality 70-85) | Smaller than PNG; acceptable quality for observation |
| Latency | < 500ms target, < 2s acceptable | Interactive feel; not a slideshow |
| Frame acknowledgment | Required | CDP requires ack; prevents frame backup |

### Transport

| Requirement | Target | Rationale |
|-------------|--------|-----------|
| Protocol | WebSocket | Bidirectional, low latency, browser-native |
| Reconnection | Auto-reconnect with backoff | Network hiccups shouldn't require manual refresh |
| Heartbeat | Every 5-10 seconds | Detect dead connections |
| Compression | None (JPEG already compressed) | Double-compression wastes CPU |

### Client Display

| Requirement | Target | Rationale |
|-------------|--------|-----------|
| Aspect ratio | Preserve from source | Don't distort the view |
| Scaling | Fit container, maintain aspect | Work in various Studio layouts |
| Empty state | "Waiting for browser..." | Clear communication when no browser active |
| Error state | "Connection lost - reconnecting..." | Clear communication on failure |

## MVP Recommendation

For v1 live view, implement the six table stakes:

1. **Real-time video stream** - CDP screencast -> WebSocket -> canvas/img element
2. **Connection status indicator** - Simple badge: Connected/Connecting/Disconnected
3. **Stream start/stop lifecycle** - Hook into browser launch/close events
4. **Graceful degradation** - Empty state when no browser active
5. **Basic loading state** - Spinner during initialization
6. **Reasonable latency** - Target < 500ms, optimize frame pipeline

Defer to v1.5:
- URL/title display
- Action overlay
- Resize controls
- Timestamps

Defer to v2:
- Timeline scrubbing
- Session recording
- Picture-in-picture

## Competitive Landscape

| Feature | Browserbase | Amazon AgentCore | Browser-use (Laminar) | Our Live View |
|---------|-------------|------------------|----------------------|---------------|
| Real-time stream | Yes | Yes | Yes | Yes (v1) |
| Session recording | Video-based | Yes | Yes | No (v2) |
| Action overlay | No | Limited | Yes (via Laminar) | No (v1.5) |
| User interaction | No | Yes (take over) | No | No (view-only) |
| Timeline scrubbing | Yes | Yes | Yes | No (v2) |
| Console/Network logs | No | No | Yes | No (defer) |

**Our positioning:** Simple, focused, view-only observation. Users can watch their agent work without the complexity of interaction or recording infrastructure. This matches the stated v1 scope perfectly.

## Sources

### Primary (HIGH confidence)
- [Chrome DevTools Protocol - Page domain](https://chromedevtools.github.io/devtools-protocol/tot/Page/) - CDP screencast API reference
- [Playwright Debug Documentation](https://playwright.dev/docs/debug) - UI Mode and debugging patterns
- [Puppeteer screencast method](https://pptr.dev/api/puppeteer.page.screencast) - Implementation reference
- Existing codebase (`integrations/agent-browser/src/`) - Current tool patterns

### Secondary (MEDIUM confidence)
- [Amazon Bedrock AgentCore Live View](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/session-replay-console-usage.html) - Competitive feature analysis
- [Browserbase Session Replay](https://docs.browserbase.com/features/session-replay) - Competitive feature analysis
- [Browser-use Observability](https://docs.browser-use.com/development/monitoring/observability) - Laminar integration patterns
- [rrweb](https://www.rrweb.io/) - Session recording library (for v2 reference)

### UX Research (MEDIUM confidence)
- [Loading State Patterns](https://carbondesignsystem.com/patterns/loading-pattern/) - IBM Carbon design system guidance
- [NN/g Skeleton Screens](https://www.nngroup.com/articles/skeleton-screens/) - Loading state best practices

---

*Research completed: 2026-01-27*
*Focus: Browser live view features for Mastra Studio*
