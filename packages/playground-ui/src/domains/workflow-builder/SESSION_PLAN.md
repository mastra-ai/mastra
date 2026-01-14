# Session-by-Session Improvement Plan

Each session is designed to be completable in 1-2 hours with tangible results.

---

## Session 2: Search & Discovery

### Goals

- Add search to quick-add popover
- Add search to sidebar
- Add fuzzy matching

### Tasks

1. Create `useSearch` hook with fuzzy matching
2. Update `QuickAddPopover` with search input
3. Update `BuilderSidebar` with search input
4. Add keyboard navigation (arrow keys) in search results
5. Highlight matching text in results

### Files to Modify

- `components/quick-add-popover.tsx`
- `components/builder-sidebar.tsx`
- `hooks/use-search.ts` (new)

---

## Session 3: Node Hover Polish

### Goals

- Smooth hover transitions on nodes
- Better visual feedback

### Tasks

1. Add CSS transitions to `base-node.tsx`
2. Add subtle scale transform on hover
3. Add shadow depth change on hover
4. Add smooth color transitions for validation states
5. Animate the quick-add button appearance

### Files to Modify

- `components/nodes/base-node.tsx`
- Add shared animation constants

---

## Session 4: Command Palette

### Goals

- Cmd+K opens command palette
- Search nodes, actions, navigation

### Tasks

1. Create `CommandPalette` component using cmdk or similar
2. Register commands: add nodes, undo, redo, save, zoom
3. Add to `workflow-builder.tsx`
4. Style to match design system

### Files to Create

- `components/command-palette.tsx`
- `hooks/use-commands.ts`

---

## Session 5: Edge Improvements

### Goals

- Better edge visuals
- Edge delete button
- Data type labels

### Tasks

1. Create custom `DataEdge` component
2. Add hover state with delete button
3. Show data type flowing through edge (optional)
4. Add connection validation (can this connect?)

### Files to Create

- `components/edges/data-edge.tsx`
- `components/edges/index.ts`

### Files to Modify

- `components/builder-canvas.tsx` (use custom edges)

---

## Session 6: Multi-select Foundation

### Goals

- Shift+click to multi-select
- Visual multi-select state
- Delete multiple nodes

### Tasks

1. Add `selectedNodeIds: Set<string>` to store
2. Update selection logic for shift+click
3. Add multi-select visual state to nodes
4. Enable delete to work on selection
5. Add "Select All" (Cmd+A)

### Files to Modify

- `store/workflow-builder-store.ts`
- `components/nodes/base-node.tsx`
- `components/builder-canvas.tsx`

---

## Session 7: Copy/Paste

### Goals

- Cmd+C to copy selected nodes
- Cmd+V to paste with offset
- Handle edge preservation

### Tasks

1. Add clipboard state to store
2. Serialize selected nodes for clipboard
3. Deserialize and add with position offset
4. Preserve internal edges, remove external

### Files to Modify

- `store/workflow-builder-store.ts`
- Add copy/paste keyboard shortcuts

---

## Session 8: Box Selection

### Goals

- Drag on canvas to select multiple nodes
- Visual selection rectangle

### Tasks

1. Add selection box state
2. Track mouse drag on canvas
3. Calculate which nodes intersect box
4. Visual selection rectangle component

### Files to Create

- `components/selection-box.tsx`

### Files to Modify

- `components/builder-canvas.tsx`

---

## Session 9: Config Panel Refactor

### Goals

- Extract shared form components
- Reduce duplication across panels

### Tasks

1. Create `ConfigSection` component
2. Create `ConfigField` component
3. Create `SchemaFieldEditor` component
4. Refactor `agent-config.tsx` as example
5. Apply pattern to other panels

### Files to Create

- `components/panels/shared/config-section.tsx`
- `components/panels/shared/config-field.tsx`
- `components/panels/shared/index.ts`

---

## Session 10: Empty State & Onboarding

### Goals

- Helpful empty canvas state
- Starter templates

### Tasks

1. Create `EmptyState` component
2. Show when no nodes exist
3. Add "Start from template" option
4. Add "Start from scratch" with trigger

### Files to Create

- `components/empty-state.tsx`
- `data/starter-templates.ts`

---

## Session 11: Accessibility Pass

### Goals

- ARIA labels everywhere
- Keyboard navigation

### Tasks

1. Audit all interactive elements
2. Add missing aria-labels
3. Add keyboard handlers to nodes
4. Test with screen reader
5. Add focus indicators

### Files to Modify

- All node components
- All panel components
- All buttons/inputs

---

## Session 12: Animated Data Flow

### Goals

- Visual data flow during test runs
- Animated edges showing execution

### Tasks

1. Create animated edge variant
2. Track which edges are "active"
3. Show data preview on active edges
4. Particle/flow animation along edges

### Files to Create

- `components/edges/animated-edge.tsx`

### Files to Modify

- `store/test-runner-store.ts`
- `components/builder-canvas.tsx`

---

## Parking Lot (Future Sessions)

Items for later consideration:

- Version history with visual diff
- Real-time collaboration
- Custom node plugin system
- Export to image
- Workflow templates gallery
- AI-assisted workflow building
- Mobile/touch support
- Offline support
- Performance mode for large workflows

---

## How to Use This Plan

1. **Before each session**: Read the session goals and tasks
2. **During session**: Check off tasks as completed
3. **After session**: Update ROADMAP.md with what was done
4. **Between sessions**: Note any new ideas in Parking Lot
5. **Regularly**: Re-prioritize based on user feedback

---

## Notes

- Each session should end with a working build
- Write tests for new hooks/utilities
- Update component documentation
- Consider backward compatibility
