# Parallel Improvement Tracks

Work is organized into independent tracks that can be executed simultaneously.

---

## Track Overview

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Track A       │  │   Track B       │  │   Track C       │  │   Track D       │
│   UX Polish     │  │   New Features  │  │   Code Quality  │  │   Infrastructure│
├─────────────────┤  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤
│ • Animations    │  │ • Search        │  │ • Split files   │  │ • Tests         │
│ • Transitions   │  │ • Cmd palette   │  │ • Remove `any`  │  │ • Storybook     │
│ • Hover states  │  │ • Multi-select  │  │ • Shared comps  │  │ • Docs          │
│ • Edge styling  │  │ • Copy/paste    │  │ • Use new hooks │  │ • Performance   │
│ • Empty states  │  │ • Box select    │  │ • Constants     │  │ • A11y audit    │
└─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘
     CSS/Visual         Store/Logic         Refactoring          Tooling
```

---

## Track A: UX Polish (Visual/CSS)

**No store changes, no new features - just making existing things look better**

### A1: Node Hover Polish

Files: `base-node.tsx`

- Add CSS transitions (transform, shadow, border)
- Smooth scale on hover (1.02)
- Shadow depth increase on hover
- Animate quick-add button fade-in

### A2: Edge Styling

Files: `builder-canvas.tsx`, new `edges/` folder

- Create custom edge component
- Hover state with glow
- Delete button on hover
- Animated dashes during test run

### A3: Loading & Empty States

Files: new `empty-state.tsx`, `loading-skeleton.tsx`

- Empty canvas guidance
- Loading skeletons for panels
- Saving indicator improvements

### A4: Drag Preview

Files: `step-item.tsx`, `builder-canvas.tsx`

- Better drag ghost appearance
- Drop zone highlighting

---

## Track B: New Features (Store/Logic)

**Adds new capabilities to the builder**

### B1: Search System

Files: new `hooks/use-search.ts`, `quick-add-popover.tsx`, `builder-sidebar.tsx`

- Fuzzy search hook
- Search input in quick-add
- Search input in sidebar
- Keyboard nav in results

### B2: Command Palette

Files: new `command-palette.tsx`, `hooks/use-commands.ts`

- Cmd+K to open
- Register all actions
- Fuzzy search commands

### B3: Multi-Select Foundation

Files: `workflow-builder-store.ts`, `base-node.tsx`

- `selectedNodeIds` Set in store
- Shift+click behavior
- Multi-select visual state

### B4: Copy/Paste

Files: `workflow-builder-store.ts`, keyboard shortcuts

- Clipboard state
- Serialize/deserialize nodes
- Preserve internal edges

### B5: Box Selection

Files: new `selection-box.tsx`, `builder-canvas.tsx`

- Drag rectangle on canvas
- Calculate node intersection
- Add to selection

---

## Track C: Code Quality (Refactoring)

**No behavior changes - internal improvements only**

### C1: Config Panel Shared Components

Files: new `panels/shared/` folder

- `ConfigSection` component
- `ConfigField` component
- `SchemaFieldEditor` component

### C2: Use Shared Hooks

Files: All config panels

- Replace inline predecessor calc with `usePredecessorIds`
- Replace inline colors with constants

### C3: Type Safety

Files: `visual-schema-editor.tsx`, others

- Replace `any` with proper types
- Add missing type exports

### C4: Split Large Files

Files: `condition-config.tsx`, `tool-config.tsx`, `workflow-builder-store.ts`

- Extract sub-components
- Extract store slices

---

## Track D: Infrastructure (Tooling)

**Testing, docs, performance - supports all other tracks**

### D1: Component Tests

Files: new `__tests__/` folders

- Test node components
- Test store actions
- Test validation logic

### D2: Storybook Stories

Files: new `*.stories.tsx` files

- Stories for each node type
- Stories for panels
- Stories for shared components

### D3: Accessibility Audit

Files: All components

- Add ARIA labels
- Test keyboard navigation
- Screen reader testing

### D4: Performance

Files: Various

- Profile render performance
- Add React.memo where missing
- Virtualize long lists

---

## Dependency Graph

```
Track A (Visual)     Track B (Features)     Track C (Quality)     Track D (Infra)
     │                     │                      │                     │
     │                     │                      │                     │
     ▼                     ▼                      ▼                     ▼
┌─────────┐          ┌─────────┐           ┌─────────┐           ┌─────────┐
│   A1    │          │   B1    │           │   C1    │           │   D1    │
│ Hover   │          │ Search  │           │ Shared  │           │ Tests   │
└─────────┘          └─────────┘           │ Comps   │           └─────────┘
     │                     │               └─────────┘                 │
     ▼                     ▼                    │                      ▼
┌─────────┐          ┌─────────┐                ▼               ┌─────────┐
│   A2    │          │   B2    │           ┌─────────┐          │   D2    │
│ Edges   │          │ Cmd+K   │           │   C2    │          │Storybook│
└─────────┘          └─────────┘           │Use Hooks│          └─────────┘
     │                     │               └─────────┘                 │
     ▼                     ▼                    │                      ▼
┌─────────┐          ┌─────────┐                ▼               ┌─────────┐
│   A3    │          │   B3    │           ┌─────────┐          │   D3    │
│ Empty   │          │MultiSel │           │   C3    │          │  A11y   │
└─────────┘          └─────────┘           │ Types   │          └─────────┘
     │                     │               └─────────┘                 │
     ▼                     ▼                    │                      ▼
┌─────────┐          ┌─────────┐                ▼               ┌─────────┐
│   A4    │          │   B4    │           ┌─────────┐          │   D4    │
│ Drag    │          │Copy/Pst │           │   C4    │          │  Perf   │
└─────────┘          └─────────┘           │ Split   │          └─────────┘
                           │               └─────────┘
                           ▼
                     ┌─────────┐
                     │   B5    │
                     │Box Sel  │
                     └─────────┘
```

**Key**: Items within a track are sequential. Items across tracks are parallel.

---

## Execution Strategy

### Option 1: Single Developer

Work on one item from each track in rotation:

1. A1 (Hover) → B1 (Search) → C1 (Shared) → D1 (Tests)
2. A2 (Edges) → B2 (Cmd+K) → C2 (Hooks) → D2 (Stories)
3. ...

### Option 2: Multiple Developers

Assign each track to a different person:

- Dev 1: Track A (Visual)
- Dev 2: Track B (Features)
- Dev 3: Track C (Quality)
- Dev 4: Track D (Infrastructure)

### Option 3: AI-Assisted Parallel

Use Claude to work on multiple items simultaneously:

```
Session: "Work on A1, B1, C1 in parallel"
- A1: CSS changes only
- B1: New hook + component changes
- C1: New shared components
(No conflicts - different files)
```

---

## Parallel Session Examples

### Session: Search + Polish + Shared Components

```
┌─────────────────────────────────────────────────────────────────┐
│ In Parallel:                                                    │
│                                                                 │
│ [A1] base-node.tsx        → Add hover transitions               │
│ [B1] hooks/use-search.ts  → Create fuzzy search hook            │
│ [B1] quick-add-popover    → Add search input                    │
│ [C1] panels/shared/       → Create ConfigSection component      │
│                                                                 │
│ Sequential after:                                               │
│ [B1] builder-sidebar      → Add search (depends on hook)        │
└─────────────────────────────────────────────────────────────────┘
```

### Session: Edges + Multi-select + Types

```
┌─────────────────────────────────────────────────────────────────┐
│ In Parallel:                                                    │
│                                                                 │
│ [A2] edges/data-edge.tsx  → New custom edge component           │
│ [B3] store (selection)    → Add selectedNodeIds                 │
│ [C3] visual-schema-editor → Fix any types                       │
│                                                                 │
│ Sequential after:                                               │
│ [A2] builder-canvas       → Use custom edges                    │
│ [B3] base-node            → Multi-select visuals                │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Ownership (Conflict Prevention)

| File                        | Primary Track | Notes                 |
| --------------------------- | ------------- | --------------------- |
| `base-node.tsx`             | A (Visual)    | B3 needs coordination |
| `builder-canvas.tsx`        | A (Visual)    | B5 needs coordination |
| `workflow-builder-store.ts` | B (Features)  | Exclusive to B        |
| `quick-add-popover.tsx`     | B (Features)  |                       |
| `builder-sidebar.tsx`       | B (Features)  |                       |
| `panels/*.tsx`              | C (Quality)   | Refactoring only      |
| `hooks/use-*.ts`            | B (Features)  | New hooks             |
| `panels/shared/*`           | C (Quality)   | New shared components |
| `__tests__/*`               | D (Infra)     | New tests             |

---

## Next Parallel Session

Ready to execute:

**Track A**: Add hover transitions to `base-node.tsx`
**Track B**: Create `use-search.ts` hook + update `quick-add-popover.tsx`
**Track C**: Create `panels/shared/config-section.tsx`

All three touch different files - no conflicts.
