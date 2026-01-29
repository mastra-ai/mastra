# Phase 13: Focus Management and Keyboard - Context

**Gathered:** 2026-01-29
**Status:** Ready for planning

<domain>
## Phase Boundary

User can type in the live view without keyboard events leaking to host page. This phase adds keyboard input forwarding with an explicit "interactive mode" toggled by clicking the frame. It does NOT add visual feedback (Phase 14) or input coordination (Phase 15).

</domain>

<decisions>
## Implementation Decisions

### Focus activation model
- Click on the live view frame enters interactive mode (keyboard capture activated)
- Click outside the frame OR pressing Escape exits interactive mode
- Escape is consumed to exit -- it is NOT forwarded to the browser
- Window/tab blur (user switches away) resets interactive mode. Must click frame again to re-enter
- Any click outside the frame exits interactive mode. No special handling for chat input -- generic "click outside" is sufficient

### Key mapping behavior
- Tab key forwards to browser in interactive mode (navigates browser form fields)
- Arrow keys forward to browser in interactive mode (browser handles scroll vs cursor internally)
- Function keys (F1-F12): Claude's discretion on which to forward
- Browser chrome shortcuts (Ctrl+F, Ctrl+L): Claude's discretion
- All standard printable characters forwarded via 3-event CDP sequence (keyDown -> char -> keyUp)
- Non-printable keys (Enter, Backspace, arrows, etc.) forwarded via 2-event sequence (keyDown -> keyUp)

### Clipboard & modifier shortcuts
- In interactive mode, Ctrl+C/Cmd+C forwards to browser (copies selected text in browser)
- Ctrl+V/Cmd+V: forward the keystroke only (no cross-clipboard injection). Browser paste works if clipboard was set inside the browser via Ctrl+C
- Ctrl+A forwards to browser (select all in focused browser field)
- Only Escape is reserved (exits interactive mode). All other modifier combos forward to browser
- No cross-clipboard paste support in this phase (deferred)

### International input
- IME composition (CJK input) IS in scope for this phase
- Dead keys / accented characters: Claude's discretion on approach (forward raw vs compose on client)
- IME composition visual feedback: Claude's discretion (overlay vs rely on screencast frames)
- Use KeyboardEvent.key (layout-aware) not KeyboardEvent.code (physical position) to match host keyboard layout

### Claude's Discretion
- Visual indicator for interactive mode (border, badge, cursor change) -- specific design
- Function key forwarding policy (all, none, or selective)
- Browser chrome shortcut handling (Ctrl+L, Ctrl+F, etc.)
- Dead key composition approach (forward raw or compose on client)
- IME composition visual feedback (overlay vs no indicator)

</decisions>

<specifics>
## Specific Ideas

- Interactive mode should feel like clicking into an iframe -- natural web behavior where the embedded content "takes over" keyboard input
- Escape as the single exit key is intentional -- it's a universal "get me out" pattern
- Cross-clipboard paste is explicitly deferred -- this phase focuses on keyboard forwarding, not clipboard bridging

</specifics>

<deferred>
## Deferred Ideas

- Cross-clipboard paste (reading host clipboard and injecting into browser via CDP insertText) -- future enhancement
- Selective key filtering based on remote browser focus state (can't detect from screencast) -- architectural limitation, not a deferral

</deferred>

---

*Phase: 13-focus-management-and-keyboard*
*Context gathered: 2026-01-29*
