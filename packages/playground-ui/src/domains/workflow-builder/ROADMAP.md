# Workflow Builder Improvement Roadmap

A structured plan to continuously improve the Mastra workflow builder's UX, code quality, and developer experience.

---

## Current State Assessment

### What We Have

- 12 node types with visual components and config panels
- React Flow canvas with drag-and-drop
- Quick-add popover for fast node creation
- Validation system with visual error states
- Undo/redo support
- Keyboard shortcuts
- Test runner with step status overlays
- Data mapping with variable reference autocomplete
- Error boundaries

### Pain Points

- Config panels are large and repetitive
- No search/filtering in node palette or quick-add
- Missing micro-interactions and polish
- Accessibility gaps
- No onboarding or contextual help
- Limited edge customization
- No copy/paste or multi-select

---

## Improvement Phases

### Phase 1: Polish & Micro-interactions

**Goal**: Make existing features feel refined and responsive

| Task                                          | Priority | Effort |
| --------------------------------------------- | -------- | ------ |
| Add hover states and transitions to all nodes | High     | S      |
| Animate node creation/deletion                | High     | M      |
| Add loading skeletons for async operations    | Medium   | S      |
| Smooth edge connection animations             | Medium   | M      |
| Add subtle sound feedback (optional toggle)   | Low      | S      |
| Improve drag preview appearance               | High     | S      |
| Add node selection ring animation             | Medium   | S      |

### Phase 2: Search & Discovery

**Goal**: Help users find what they need quickly

| Task                               | Priority | Effort |
| ---------------------------------- | -------- | ------ |
| Add search to sidebar node palette | High     | S      |
| Add search to quick-add popover    | High     | S      |
| Add command palette (Cmd+K)        | High     | M      |
| Recently used nodes section        | Medium   | S      |
| Favorites/pinned nodes             | Low      | M      |

### Phase 3: Multi-select & Bulk Operations

**Goal**: Enable efficient manipulation of multiple nodes

| Task                              | Priority | Effort |
| --------------------------------- | -------- | ------ |
| Multi-select with shift+click     | High     | M      |
| Box selection (drag to select)    | High     | M      |
| Copy/paste nodes (Cmd+C/V)        | High     | L      |
| Duplicate selection               | Medium   | S      |
| Delete selection                  | Medium   | S      |
| Group nodes into sub-workflow     | Low      | L      |
| Align nodes (horizontal/vertical) | Medium   | M      |

### Phase 4: Edge Improvements

**Goal**: Make connections informative and beautiful

| Task                                             | Priority | Effort |
| ------------------------------------------------ | -------- | ------ |
| Custom edge component with labels                | High     | M      |
| Edge hover state with data preview               | High     | M      |
| Animated data flow during test runs              | High     | M      |
| Edge path style options (bezier, step, straight) | Medium   | S      |
| Edge delete button on hover                      | Medium   | S      |
| Connection validation feedback                   | High     | S      |

### Phase 5: Contextual Help & Onboarding

**Goal**: Reduce learning curve, increase discoverability

| Task                               | Priority | Effort |
| ---------------------------------- | -------- | ------ |
| Inline tooltips with examples      | High     | M      |
| First-time user tour/walkthrough   | Medium   | L      |
| Empty state with starter templates | High     | M      |
| Contextual help in config panels   | Medium   | M      |
| Example workflows gallery          | Low      | L      |
| Video tutorials integration        | Low      | M      |

### Phase 6: Accessibility (A11y)

**Goal**: Make the builder usable by everyone

| Task                                    | Priority | Effort |
| --------------------------------------- | -------- | ------ |
| Keyboard navigation for all elements    | High     | L      |
| ARIA labels on all interactive elements | High     | M      |
| Focus management in modals/panels       | High     | M      |
| Screen reader announcements             | Medium   | L      |
| High contrast mode support              | Medium   | M      |
| Reduced motion support                  | Medium   | S      |

### Phase 7: Performance & Code Quality

**Goal**: Fast, maintainable codebase

| Task                                 | Priority | Effort |
| ------------------------------------ | -------- | ------ |
| Virtualize large node lists          | Medium   | M      |
| Split large config panel files       | Medium   | M      |
| Eliminate `any` types                | High     | M      |
| Add comprehensive tests              | High     | L      |
| Create shared form components        | High     | M      |
| Document component APIs              | Medium   | M      |
| Performance profiling & optimization | Medium   | L      |

### Phase 8: Advanced Features

**Goal**: Power-user capabilities

| Task                                 | Priority | Effort |
| ------------------------------------ | -------- | ------ |
| Workflow version history             | Medium   | L      |
| Real-time collaboration cursors      | Low      | XL     |
| Minimap enhancements                 | Medium   | M      |
| Zoom to fit selection                | Medium   | S      |
| Canvas bookmarks/waypoints           | Low      | M      |
| Custom node creation (plugin system) | Low      | XL     |
| Export to image/PDF                  | Medium   | M      |

---

## Effort Key

- **S** = Small (1-2 hours)
- **M** = Medium (half day to 1 day)
- **L** = Large (2-3 days)
- **XL** = Extra Large (week+)

---

## Quick Wins (Start Here)

These can be done in a single session and have high impact:

1. **Search in quick-add popover** - Filter nodes as you type
2. **Search in sidebar** - Find nodes quickly
3. **Improve drag preview** - Show node preview while dragging
4. **Add node hover transitions** - Smooth scale/shadow on hover
5. **Command palette skeleton** - Cmd+K to open, wire up later
6. **Edge delete on hover** - X button on edges
7. **Better empty state** - When canvas is empty, show guidance

---

## Session Tracking

Use this section to track progress across sessions:

### Session 1 (Completed)

- [x] Error boundaries
- [x] Node memoization
- [x] Extracted constants (colors, edge options)
- [x] Created shared predecessor hook

### Session 2 (Completed)

- [x] [A1] Node hover transitions (shadow, scale, smooth animations)
- [x] [B1] Created fuzzy search hook (`use-search.ts`)
- [x] [B1] Search in quick-add popover (already existed, verified)
- [x] [B1] Search in sidebar with keyboard shortcut (Cmd+F)
- [x] [C1] Created shared ConfigSection components

### Session 3 (Completed)

- [x] [A2] Custom edge component with hover/delete + glow effects
- [x] [A2] Added `deleteEdge` action to store
- [x] [B2] Command palette (Cmd+K) with fuzzy search
- [x] [B2] Commands: add nodes, undo/redo, zoom, delete
- [x] [C2] Refactored agent-config to use shared components
- [x] [C2] Used `usePredecessorIds` hook (removed duplicate code)

### Session 4 (Completed)

- [x] [A3] Empty state component with guidance and quick actions
- [x] [B3] Multi-select foundation: `selectedNodeIds` Set, `selectAll`, `clearSelection`, `deleteSelected`
- [x] [B3] Shift+click for additive selection
- [x] [B3] Cmd+A to select all, Delete/Backspace to delete selected
- [x] [C3] Refactored tool-config to use `usePredecessorIds` hook

### Session 5 (Completed)

- [x] [A4] Visual multi-select state (cyan ring + checkmark indicator)
- [x] [B4] Copy/paste with clipboard state (Cmd+C/V)
- [x] [B4] Preserves internal edges when pasting
- [x] [C4] Refactored condition-config to use `usePredecessorSet`

### Session 6 (Completed - with caveats)

- [x] [A5] DataEdge component with animated flow (code ready, disabled - needs edge type migration)
- [x] [B5] SelectionBox component (code ready, disabled - needs React Flow event integration)
- [x] [C5] Refactored loop-config and foreach-config to use `usePredecessorSet`

**Note**: Custom edges and box selection code exists but is disabled to prevent canvas issues.
These features need additional work:

- Custom edges: Migrate existing edges to have `type: 'data'`
- Box selection: Fix event handling to not interfere with React Flow

### Session 7 (Next)

- [ ] Fix and enable custom DataEdge (migrate edges)
- [ ] Fix and enable SelectionBox (React Flow integration)
- [ ] Add keyboard shortcut hints in UI

---

## Design Principles

1. **Immediate Feedback** - Every action should have visible response
2. **Graceful Degradation** - Features should work without JS where possible
3. **Progressive Disclosure** - Show simple first, advanced on demand
4. **Consistent Patterns** - Same interactions across all node types
5. **Keyboard First** - Power users shouldn't need the mouse
6. **Error Prevention** - Validate before allowing invalid states

---

## Metrics to Track

- Time to create first workflow (new user)
- Number of undo operations (indicates mistakes)
- Keyboard vs mouse usage ratio
- Most/least used node types
- Common error types from validation
