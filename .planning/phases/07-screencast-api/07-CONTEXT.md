# Phase 7: Screencast API - Context

**Gathered:** 2026-01-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend BrowserToolset with methods to control CDP screencast capture and input injection. This phase adds the API layer only — no transport or UI. Consumers (Phase 8 WebSocket endpoint) will use these methods to capture and relay frames.

</domain>

<decisions>
## Implementation Decisions

### Method Signatures
- `startScreencast(options?)` accepts configuration with sensible defaults
- Expose all CDP screencast options (format, quality, everyNthFrame, maxWidth, maxHeight)
- Returns a stream/subscription object with `stop()`, status, and event handlers
- Async/await pattern — `startScreencast()` returns Promise resolving to stream object
- Input injection methods are raw CDP passthrough: `injectMouseEvent(cdpEvent)`, `injectKeyboardEvent(cdpEvent)`

### Frame Delivery
- Event emitter pattern: `screencast.on('frame', callback)`
- Full lifecycle events: `frame`, `error`, `stop`
- Structured frame object: `{ data, timestamp, viewport, sessionId }`
- Frame data is base64 encoded (easier to serialize over JSON/WebSocket)
- Backpressure handled by CDP's ack-based flow control — trust it, don't add additional buffering

### Lifecycle Coordination
- Manual start only — screencast does not auto-start with browser
- If `startScreencast()` called before browser exists, wait for browser launch then start
- Multiple independent screencasts allowed — each `startScreencast()` returns independent stream
- Browser close behavior: Claude's discretion (likely emit 'stop' event)

### Error Handling
- Error severity determines surface: Claude decides throw vs emit based on recoverability
- Auto-retry with notification: emit `reconnecting` event, retry, emit `reconnected` on success
- 3 retries before giving up and emitting final error
- Include raw CDP error details in error objects for debugging

### Claude's Discretion
- Exact event emitter implementation (EventEmitter vs custom)
- Browser close behavior (silent stop vs error+stop)
- Default option values for frame rate, quality, format
- Retry backoff strategy

</decisions>

<specifics>
## Specific Ideas

- Stream object should feel like a standard Node.js event emitter
- CDP passthrough for input injection keeps the API flexible for future interaction features
- Waiting for browser (vs erroring) makes the API more forgiving for callers

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-screencast-api*
*Context gathered: 2026-01-27*
