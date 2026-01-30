# Phase 14: Visual Feedback and Polish - Research

**Researched:** 2026-01-29
**Domain:** CSS click ripple overlay in React with letterbox-aware coordinate mapping
**Confidence:** HIGH

## Summary

This phase adds immediate visual confirmation when users click inside the browser live view panel. The primary deliverable is a click ripple effect (VIS-02) that appears instantly at the click position, bridging the latency gap before the remote browser's screencast frame updates. VIS-01 (interactive mode indicator) was already delivered in Phase 13 via `ring-2 ring-accent1` + cursor changes and requires no further work.

The implementation is a pure CSS animation overlay inside the existing `BrowserViewFrame` component. No external animation libraries are needed -- the project already has `tailwindcss-animate` installed and custom keyframes can be added to `tailwind.config.ts` under `theme.extend.keyframes`. The ripple uses the same `getBoundingClientRect()` + letterbox offset math from the existing `coordinate-mapping.ts` utility to position correctly on the scaled `<img>` element.

The standard approach is: maintain an array of active ripples in React state, render them as absolutely-positioned `<span>` elements inside the frame container, animate via CSS keyframes (scale + fade), and clean up via `onAnimationEnd`. This pattern is lightweight, requires no additional dependencies, and integrates cleanly with the existing component architecture.

**Primary recommendation:** Add a custom `ripple-click` keyframe to the Tailwind config, create a `ClickRipple` component rendered inside `BrowserViewFrame`, and compute ripple display coordinates using the existing letterbox-offset math from `coordinate-mapping.ts`.

## Standard Stack

No new dependencies are needed. This phase uses existing infrastructure only.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | >=19.0.0 | State management for ripple array, `onAnimationEnd` cleanup | Already in use |
| Tailwind CSS | (project version) | Custom keyframes, utility classes for animation | Already configured |
| tailwindcss-animate | (installed) | `animate-in` / `animate-out` utilities (optional, project already uses) | Already a plugin |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| coordinate-mapping.ts | (project) | Letterbox-aware position calculation | Ripple position must match click target |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom CSS keyframe | Framer Motion / motion.dev | Overkill for a single expand+fade animation; adds bundle size |
| `onAnimationEnd` cleanup | `setTimeout(300)` | `setTimeout` couples to magic number; `onAnimationEnd` is DOM-native and handles timing perfectly |
| React state array | DOM manipulation (appendChild) | DOM manipulation breaks React reconciliation; state array is idiomatic React |

**Installation:**
```bash
# No installation needed -- all dependencies already present
```

## Architecture Patterns

### Recommended Component Structure
```
packages/playground-ui/src/domains/agents/
  components/browser-view/
    browser-view-frame.tsx    # Modified: renders <ClickRippleOverlay> inside container
    click-ripple-overlay.tsx  # NEW: manages ripple state + renders ripple spans
  hooks/
    use-click-ripple.ts       # NEW: hook encapsulating ripple state + creation logic
  utils/
    coordinate-mapping.ts     # EXISTING: reuse mapClientToDisplay (new pure function)
```

### Pattern 1: Ripple State Array with onAnimationEnd Cleanup
**What:** Track active ripples as an array of `{ id, x, y }` objects. Render each as an absolutely-positioned `<span>`. Remove from state when CSS animation completes via `onAnimationEnd`.
**When to use:** Any time you need overlapping ephemeral animations that clean themselves up.
**Example:**
```typescript
// Source: Standard React pattern, verified via multiple references
interface Ripple {
  id: number;
  x: number;  // CSS px relative to container
  y: number;  // CSS px relative to container
}

// In hook:
const [ripples, setRipples] = useState<Ripple[]>([]);
const idRef = useRef(0);

const addRipple = useCallback((x: number, y: number) => {
  const id = ++idRef.current;
  setRipples(prev => [...prev, { id, x, y }]);
}, []);

const removeRipple = useCallback((id: number) => {
  setRipples(prev => prev.filter(r => r.id !== id));
}, []);

// In render:
{ripples.map(ripple => (
  <span
    key={ripple.id}
    className="absolute rounded-full pointer-events-none animate-click-ripple bg-accent1/40"
    style={{
      left: ripple.x - RIPPLE_RADIUS,
      top: ripple.y - RIPPLE_RADIUS,
      width: RIPPLE_SIZE,
      height: RIPPLE_SIZE,
    }}
    onAnimationEnd={() => removeRipple(ripple.id)}
  />
))}
```

### Pattern 2: Display-Space Coordinate Calculation for Ripple Positioning
**What:** The ripple must appear at the click position relative to the container `<div>`, not the viewport coordinates sent to CDP. The existing `mapClientToViewport` maps to CDP viewport space. For ripple positioning, we need the inverse: map `clientX/clientY` to the position within the container element (accounting for letterbox offset so the ripple appears exactly over the rendered image area).
**When to use:** When positioning an overlay element on top of a `object-fit: contain` image.
**Example:**
```typescript
// Source: Derived from existing coordinate-mapping.ts patterns
/**
 * Map a client mouse position to display-space coordinates relative to the
 * container element. This gives the CSS pixel position within the container
 * where the ripple should appear -- accounting for letterbox offset so it
 * aligns with the rendered image area.
 *
 * Unlike mapClientToViewport (which maps to CDP viewport space), this
 * returns coordinates suitable for absolute positioning within the container.
 *
 * Returns null if the click lands in the letterbox/pillarbox region.
 */
export function mapClientToDisplay(
  clientX: number,
  clientY: number,
  containerRect: ElementRect,
  viewport: ViewportDimensions,
): MappedCoordinates | null {
  const relX = clientX - containerRect.left;
  const relY = clientY - containerRect.top;

  // Compute letterbox offset to check if click is within rendered area
  const scale = Math.min(
    containerRect.width / viewport.width,
    containerRect.height / viewport.height,
  );
  const renderedWidth = viewport.width * scale;
  const renderedHeight = viewport.height * scale;
  const offsetX = (containerRect.width - renderedWidth) / 2;
  const offsetY = (containerRect.height - renderedHeight) / 2;

  const imageX = relX - offsetX;
  const imageY = relY - offsetY;

  if (imageX < 0 || imageY < 0 || imageX > renderedWidth || imageY > renderedHeight) {
    return null;
  }

  // Return position relative to container (not viewport)
  // This is the CSS left/top for absolute positioning within the container
  return { x: relX, y: relY };
}
```

### Pattern 3: Custom Tailwind Keyframe for Ripple Animation
**What:** Define a `click-ripple` keyframe in `tailwind.config.ts` that scales from 0 to 1 while fading out, producing a clean expanding-ring effect.
**When to use:** Any custom animation that needs to be a Tailwind utility class.
**Example:**
```typescript
// In tailwind.config.ts, under theme.extend
keyframes: {
  shimmer: {
    '100%': { transform: 'translateX(100%)' },
  },
  'click-ripple': {
    '0%': { transform: 'scale(0)', opacity: '0.5' },
    '100%': { transform: 'scale(1)', opacity: '0' },
  },
},
animation: {
  'click-ripple': 'click-ripple 300ms ease-out forwards',
},
```

### Anti-Patterns to Avoid
- **DOM manipulation for ripples:** Never use `document.createElement` or `appendChild` to add ripple elements. This breaks React's reconciliation. Use state array + JSX rendering.
- **Positioning from CDP viewport coordinates:** The ripple position needs to be in CSS pixels relative to the container, not in remote browser viewport coordinates. Do NOT use the output of `mapClientToViewport` for ripple positioning.
- **Hardcoded color values:** Use `bg-accent1/40` (Tailwind opacity modifier) rather than `rgba(26, 251, 111, 0.4)`. The accent1 token (`#1AFB6F`) is already registered in the Tailwind config.
- **Removing the existing `overflow-hidden` class:** The container already has `overflow-hidden` which correctly clips ripple animations at the container boundary. Do not remove it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Animation timing | Manual setTimeout matching CSS duration | `onAnimationEnd` DOM event | Perfectly syncs cleanup to actual animation end; immune to CSS duration changes |
| Unique ripple IDs | `Date.now()` or `Math.random()` | `useRef` counter (incrementing integer) | Deterministic, no collisions, no unnecessary entropy |
| Letterbox offset calculation | New math from scratch | Reuse the scale/offset logic from `coordinate-mapping.ts` | Already tested with 10+ test cases covering pillarbox, letterbox, non-zero offsets |
| Animation library | framer-motion, react-spring, GSAP | CSS keyframes + Tailwind config | Single 300ms animation does not warrant an animation library |

**Key insight:** The entire ripple feature is achievable with ~60 lines of new code (hook + component) plus ~10 lines of Tailwind config changes. The coordinate mapping logic already exists and is tested. No new dependencies are needed.

## Common Pitfalls

### Pitfall 1: Ripple Positioned in Viewport Space Instead of Display Space
**What goes wrong:** Ripple appears at the wrong position (offset from where the user actually clicked) because the developer used `mapClientToViewport` output (which is in remote browser CSS pixels) instead of container-relative CSS pixels.
**Why it happens:** The existing codebase has `mapClientToViewport` which sounds like the right function, but it maps to the remote browser's coordinate space, not the local DOM element's coordinate space.
**How to avoid:** Create a separate `mapClientToDisplay` function (or compute `clientX - containerRect.left`, `clientY - containerRect.top` directly) that returns coordinates relative to the container element. Validate the ripple position by comparing it to `clientX - rect.left`.
**Warning signs:** Ripple appears shifted left/right (pillarbox offset error) or up/down (letterbox offset error) from where the user clicked.

### Pitfall 2: Ripple Appears in Letterbox/Pillarbox Dead Zone
**What goes wrong:** User clicks in the black bar area around the rendered image and a ripple appears there, even though no click is sent to the remote browser.
**Why it happens:** The ripple creation does not check whether the click falls within the rendered image area.
**How to avoid:** Use the same letterbox boundary check that `mapClientToViewport` uses (the `imageX < 0` / `imageY < 0` / `imageX > renderedWidth` / `imageY > renderedHeight` guards). Only create a ripple when the click is within the rendered image bounds.
**Warning signs:** Ripples appear in the black bars; ripples appear but no corresponding action happens in the remote browser.

### Pitfall 3: Ripple Blocks Mouse Events on the Image
**What goes wrong:** The ripple `<span>` elements intercept mouse events, preventing the `<img>` element's `mousedown`/`mouseup` handlers from firing.
**Why it happens:** Absolutely-positioned elements above the image in the z-order capture pointer events by default.
**How to avoid:** Add `pointer-events-none` (Tailwind) or `pointer-events: none` (CSS) to ALL ripple elements and their container. This is critical.
**Warning signs:** First click works, subsequent clicks fail; double-click fails; clicks near a fading ripple fail.

### Pitfall 4: Memory Leak from Unbounded Ripple Array
**What goes wrong:** If `onAnimationEnd` never fires (e.g., element unmounts mid-animation, or animation is interrupted), ripple objects accumulate in state forever.
**Why it happens:** `onAnimationEnd` only fires when the animation completes normally. If the component unmounts or the element is removed before the animation finishes, the event never fires.
**How to avoid:** Add a safety `setTimeout` fallback (e.g., 500ms) as a secondary cleanup mechanism. Also, cap the array at a reasonable maximum (e.g., 10 ripples) and remove oldest when exceeded. The primary cleanup remains `onAnimationEnd`.
**Warning signs:** Growing memory usage in long sessions; React DevTools shows ever-growing state array.

### Pitfall 5: Ripple Renders Before Container Has Dimensions
**What goes wrong:** If a ripple is somehow triggered before the container has been laid out (or during the loading skeleton phase), `getBoundingClientRect()` returns zero dimensions and the ripple calculation breaks.
**Why it happens:** Edge case during initial render or reconnection.
**How to avoid:** Only enable ripple creation when `status === 'streaming'` and `hasFrame === true`. The existing `handleFrameClick` already gates on `status === 'streaming'`.
**Warning signs:** Ripple appears at position (0,0) in the top-left corner.

## Code Examples

### Custom Keyframe in Tailwind Config
```typescript
// Source: Tailwind CSS official docs + existing project tailwind.config.ts pattern
// In tailwind.config.ts, add to theme.extend:
keyframes: {
  shimmer: {
    '100%': { transform: 'translateX(100%)' },
  },
  'click-ripple': {
    '0%': { transform: 'scale(0)', opacity: '0.5' },
    '100%': { transform: 'scale(1)', opacity: '0' },
  },
},
animation: {
  'click-ripple': 'click-ripple 300ms ease-out forwards',
},
```

### useClickRipple Hook
```typescript
// Encapsulates ripple state management
import { useState, useCallback, useRef } from 'react';

interface Ripple {
  id: number;
  x: number;
  y: number;
}

const MAX_RIPPLES = 10;

export function useClickRipple() {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const idRef = useRef(0);

  const addRipple = useCallback((x: number, y: number) => {
    const id = ++idRef.current;
    setRipples(prev => {
      const next = [...prev, { id, x, y }];
      // Safety cap: drop oldest if too many
      return next.length > MAX_RIPPLES ? next.slice(-MAX_RIPPLES) : next;
    });
  }, []);

  const removeRipple = useCallback((id: number) => {
    setRipples(prev => prev.filter(r => r.id !== id));
  }, []);

  return { ripples, addRipple, removeRipple };
}
```

### ClickRippleOverlay Component
```typescript
// Renders active ripples as absolutely-positioned spans
interface ClickRippleOverlayProps {
  ripples: Array<{ id: number; x: number; y: number }>;
  onAnimationEnd: (id: number) => void;
}

const RIPPLE_SIZE = 32; // px diameter
const RIPPLE_OFFSET = RIPPLE_SIZE / 2;

export function ClickRippleOverlay({ ripples, onAnimationEnd }: ClickRippleOverlayProps) {
  if (ripples.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {ripples.map(ripple => (
        <span
          key={ripple.id}
          className="absolute rounded-full pointer-events-none animate-click-ripple bg-accent1/40"
          style={{
            left: ripple.x - RIPPLE_OFFSET,
            top: ripple.y - RIPPLE_OFFSET,
            width: RIPPLE_SIZE,
            height: RIPPLE_SIZE,
          }}
          onAnimationEnd={() => onAnimationEnd(ripple.id)}
        />
      ))}
    </div>
  );
}
```

### Integration in BrowserViewFrame
```typescript
// In browser-view-frame.tsx, add ripple overlay inside the container div:
const { ripples, addRipple, removeRipple } = useClickRipple();

// In handleMouseDown or handleFrameClick, compute display coords:
const handleClick = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
  if (status !== 'streaming') return;
  setIsInteractive(true);

  // Compute display-space position for ripple
  const containerEl = containerRef.current;
  if (!containerEl || !viewport) return;
  const rect = containerEl.getBoundingClientRect();
  const display = mapClientToDisplay(e.clientX, e.clientY, rect, viewport);
  if (display) {
    addRipple(display.x, display.y);
  }
}, [status, viewport, addRipple]);

// In JSX, after the <img> element:
<ClickRippleOverlay ripples={ripples} onAnimationEnd={removeRipple} />
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| jQuery ripple plugins | Pure CSS keyframes + React state | ~2020+ | No library dependency needed |
| `setTimeout` cleanup | `onAnimationEnd` event | Always available | Reliable, no timing magic numbers |
| Inline `@keyframes` in CSS | Tailwind config `keyframes` + `animation` | Tailwind v3+ | Consistent with project's Tailwind-first approach |
| Framer Motion `AnimatePresence` for ripple | CSS-only for single expand+fade | Ongoing preference | Simpler; animation libraries warranted only for complex sequences |

**Deprecated/outdated:**
- jQuery ripple plugins ($.ripple, rippleEffect) -- irrelevant in React
- `will-change: transform` on every animated element -- browsers now handle this automatically; only add if profiling shows jank

## Open Questions

1. **Ripple size: fixed vs diameter-based**
   - What we know: Material Design calculates ripple diameter as `2 * Math.sqrt(dx^2 + dy^2)` (distance to farthest corner). A fixed size (e.g., 32px) is simpler and appropriate for a "click dot" rather than a "flood fill".
   - What's unclear: Whether a fixed 32px dot or a slightly larger expanding ring (e.g., 40-48px) feels better as visual feedback.
   - Recommendation: Start with a fixed 32px diameter. This is a visual polish detail that can be tuned by changing one constant. The CONTEXT.md says ~300ms duration and "brief flash to confirm click registered," which suggests a small, quick dot rather than a large expanding wave.

2. **Right-click and middle-click ripples**
   - What we know: The mouse interaction hook forwards right-clicks and middle-clicks to CDP. The CONTEXT.md leaves click scope to Claude's discretion.
   - Recommendation: Show ripple for left-click only (button === 0). Right-click is for context menu and middle-click is rare; showing ripples for those may confuse users since those clicks have different semantics.

## Sources

### Primary (HIGH confidence)
- Project source code: `coordinate-mapping.ts` -- verified letterbox/pillarbox offset math
- Project source code: `use-mouse-interaction.ts` -- verified click event handling pattern
- Project source code: `browser-view-frame.tsx` -- verified component structure and container refs
- Project source code: `tailwind.config.ts` -- verified existing keyframes pattern and plugin setup
- Project source code: `colors.ts` -- verified accent1 = `#1AFB6F`
- Project source code: `animations.ts` -- verified `durationSlow = 300ms` and `easeOut` curve
- [Tailwind CSS Animation docs](https://tailwindcss.com/docs/animation) -- custom keyframes in config
- [tailwindcss-animate GitHub](https://github.com/jamiebuilds/tailwindcss-animate) -- plugin API reference

### Secondary (MEDIUM confidence)
- [CSS-Tricks: Material Design Ripple](https://css-tricks.com/how-to-recreate-the-ripple-effect-of-material-design-buttons/) -- getBoundingClientRect positioning, pointer-events-none requirement, cleanup via animationend
- [Motion.dev: React Material Design Ripple](https://motion.dev/tutorials/react-material-design-ripple) -- React state array pattern with useCallback
- [DhiWise: onAnimationEnd in React](https://www.dhiwise.com/blog/design-converter/using-onanimationend-in-react-for-seamless-animations) -- onAnimationEnd lifecycle and pitfalls

### Tertiary (LOW confidence)
- None -- all findings verified against project source code or official documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all tools already in the project
- Architecture: HIGH -- pattern verified against existing codebase patterns (hooks, coordinate-mapping, Tailwind config)
- Pitfalls: HIGH -- derived from actual codebase structure (letterbox math, pointer-events, React lifecycle)

**Research date:** 2026-01-29
**Valid until:** 2026-02-28 (stable; no external dependencies to version-drift)
