# Phase 3: Screenshot - Context

**Gathered:** 2026-01-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Tool to capture visual screenshots of the current page for debugging and verification. Supports viewport, full-page, and element capture modes. Returns base64 data with metadata for multimodal use.

</domain>

<decisions>
## Implementation Decisions

### Output format
- Support both PNG and JPEG formats via parameter
- PNG is default (lossless, good for UI screenshots)
- Return raw base64 string (not data URL format)
- Include metadata with every screenshot:
  - dimensions (width, height in pixels)
  - mimeType (image/png or image/jpeg)
  - fileSize (bytes)
  - timestamp (when captured)
  - url (page URL)
  - title (page title)

### Quality/size tradeoffs
- JPEG quality default: 80 (good balance)
- No automatic scaling/resizing
- Soft warning if image is very large (return full image + warning flag)

### Capture modes
- Viewport only (default): Current visible area
- Full page: Entire scrollable page stitched together
- Element by ref: Capture specific element using @e1 ref from snapshot
- No padding for element screenshots (exact bounds)
- Auto-scroll to element if not in viewport before capturing

### Failure handling
- 30 second timeout for screenshot capture
- Full-page timeout: fail with error (agent can retry viewport-only)
- Use same BrowserToolError structure as other tools (code, message, recoveryHint, canRetry)

### Claude's Discretion
- Large image warning threshold (dimensions or file size)
- Recovery hint for element ref not found (consistent with other tools or suggest viewport fallback)
- Error codes for screenshot-specific failures

</decisions>

<specifics>
## Specific Ideas

- Screenshots are primarily for debugging and visual verification by multimodal agents
- Keep output format consistent with other tools for predictable agent behavior
- 30s timeout is longer than action tools because full-page capture can be slow on long pages

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-screenshot*
*Context gathered: 2026-01-26*
