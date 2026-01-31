# Phase 10: Dataset Layout Update - Research

**Researched:** 2026-01-30
**Domain:** React UI Layout/Component Design (Playground UI)
**Confidence:** HIGH

## Summary

This phase focuses on restructuring the Dataset Detail page layout from a dialog-based item detail view to a master-detail pattern with inline item viewing, reorganized header actions, and a new split button component. The implementation leverages existing codebase patterns and design system components.

Key findings:

- The codebase already has `CombinedButtons` component that can be extended for split button behavior
- `react-resizable-panels` is already installed and used (WorkflowLayout) for panel-based layouts
- Radix UI Popover is used for dropdown menus throughout the codebase
- Tailwind CSS animations via `tailwindcss-animate` provide built-in transition utilities
- Existing `transitions` primitives define consistent animation timing (200ms normal, 300ms slow)

**Primary recommendation:** Implement the master-detail layout using CSS Grid for the two-column view (with conditional rendering based on selection state), and create a dedicated `SplitButton` component by composing `CombinedButtons` + `Popover` for dropdown functionality.

## Standard Stack

The established libraries/tools for this domain:

### Core

| Library             | Version | Purpose        | Why Standard                    |
| ------------------- | ------- | -------------- | ------------------------------- |
| React               | 19.x    | UI framework   | Already in codebase             |
| Tailwind CSS        | 3.4.x   | Styling        | Design system is Tailwind-based |
| Radix UI Popover    | 1.1.14  | Dropdown menus | Used throughout for menus       |
| tailwindcss-animate | 1.0.7   | CSS animations | Already configured              |

### Supporting

| Library                | Version | Purpose                 | When to Use                       |
| ---------------------- | ------- | ----------------------- | --------------------------------- |
| react-resizable-panels | 4.0.15  | Resizable panel layouts | If user-resizable columns desired |
| lucide-react           | 0.474.x | Icons                   | All icons in codebase             |
| clsx / tailwind-merge  | varies  | Class composition       | Via `cn()` utility                |

### Alternatives Considered

| Instead of          | Could Use              | Tradeoff                                            |
| ------------------- | ---------------------- | --------------------------------------------------- |
| CSS Grid layout     | react-resizable-panels | CSS Grid simpler, panels add user resize capability |
| Custom split button | Third-party dropdown   | Keeps design system consistent                      |
| CSS transitions     | Framer Motion          | Tailwind-animate sufficient for simple transitions  |

**Installation:**
No new packages needed - all required libraries are already in `packages/playground-ui/package.json`.

## Architecture Patterns

### Recommended Component Structure

```
packages/playground-ui/src/
├── ds/components/
│   └── SplitButton/
│       ├── split-button.tsx        # New reusable component
│       ├── split-button.stories.tsx
│       └── index.ts
└── domains/datasets/components/
    └── dataset-detail/
        ├── dataset-detail.tsx      # Updated with new layout
        ├── dataset-header.tsx      # Extract header component
        ├── items-toolbar.tsx       # Extract toolbar component
        ├── items-master-detail.tsx # New master-detail container
        └── item-detail-panel.tsx   # Extracted from dialog
```

### Pattern 1: Master-Detail with CSS Grid

**What:** Two-column layout that conditionally renders based on selection state
**When to use:** When displaying list + detail views side-by-side
**Example:**

```typescript
// Source: Existing codebase pattern in MainContentContent
<div className={cn(
  "grid h-full overflow-hidden",
  selectedItemId
    ? "grid-cols-[minmax(300px,45%)_1fr]" // Two columns when item selected
    : "grid-cols-1" // Single column otherwise
)}>
  <div className="overflow-y-auto border-r border-border1">
    {/* List column */}
  </div>
  {selectedItemId && (
    <div className="overflow-y-auto">
      {/* Detail column */}
    </div>
  )}
</div>
```

### Pattern 2: Split Button with Popover

**What:** Button with main action + dropdown chevron using existing CombinedButtons
**When to use:** Primary action with alternative options
**Example:**

```typescript
// Source: CombinedButtons stories pattern + Popover usage
<Popover>
  <CombinedButtons>
    <Button variant="primary" onClick={onMainAction}>
      <Icon><Plus /></Icon>
      New Item
    </Button>
    <PopoverTrigger asChild>
      <Button variant="primary">
        <Icon><ChevronDown /></Icon>
      </Button>
    </PopoverTrigger>
  </CombinedButtons>
  <PopoverContent align="end">
    {/* Dropdown options */}
  </PopoverContent>
</Popover>
```

### Pattern 3: Actions Menu with Popover

**What:** Three-dot menu for secondary actions (existing pattern)
**When to use:** Header actions, toolbar overflow menus
**Example:**

```typescript
// Source: items-list-actions.tsx
<Popover open={open} onOpenChange={setOpen}>
  <PopoverTrigger asChild>
    <Button variant="ghost" size="sm">
      <Icon><MoreVertical /></Icon>
    </Button>
  </PopoverTrigger>
  <PopoverContent align="end" className="w-48 p-1">
    <div className="flex flex-col">
      <Button variant="ghost" className="justify-start">Option 1</Button>
      <Button variant="ghost" className="justify-start" disabled>Option 2 (deferred)</Button>
    </div>
  </PopoverContent>
</Popover>
```

### Pattern 4: Smooth Width Transition

**What:** Animate container max-width changes
**When to use:** When detail panel opens/closes
**Example:**

```typescript
// Use Tailwind transition classes from primitives
<div className={cn(
  "transition-all duration-slow ease-out-custom",
  selectedItemId ? "max-w-[100rem]" : "max-w-[50rem]"
)}>
```

### Anti-Patterns to Avoid

- **Don't use SideDialog for inline content:** SideDialog is for overlays, not inline panels
- **Don't create new dropdown menu component:** Use existing Popover pattern
- **Don't import animation libraries:** tailwindcss-animate provides what's needed
- **Don't put business logic in packages/playground:** It belongs in packages/playground-ui

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem        | Don't Build             | Use Instead               | Why                             |
| -------------- | ----------------------- | ------------------------- | ------------------------------- |
| Dropdown menus | Custom dropdown         | `Popover` + `Button` list | Accessibility, focus management |
| Button groups  | Manual border styling   | `CombinedButtons`         | Handles border radius, dividers |
| Transitions    | Manual CSS animations   | `transitions` primitives  | Consistent timing, easing       |
| Icon rendering | Raw Lucide usage        | `Icon` wrapper component  | Consistent sizing               |
| Layout columns | Flex with manual widths | CSS Grid with minmax      | Better responsive behavior      |

**Key insight:** The codebase has established patterns for menus (Popover), button combinations (CombinedButtons), and transitions (primitives). Using these ensures consistency and avoids reimplementing accessibility features.

## Common Pitfalls

### Pitfall 1: Breaking the SideDialog Detail View

**What goes wrong:** Replacing dialog with inline panel without maintaining all features
**Why it happens:** Underestimating the functionality in ItemDetailDialog (edit mode, delete confirmation, navigation)
**How to avoid:** Extract the content/logic into a new ItemDetailPanel component, reuse in both contexts
**Warning signs:** Edit/delete/navigation stops working after refactor

### Pitfall 2: Z-index Issues with Nested Popovers

**What goes wrong:** Dropdown menus in detail panel render behind other elements
**Why it happens:** Popover portal rendering conflicts with parent stacking context
**How to avoid:** Ensure Popover uses portal (it does by default), test in actual layout
**Warning signs:** Dropdowns appear clipped or behind toolbar

### Pitfall 3: Independent Scroll Containers Breaking

**What goes wrong:** List and detail columns scroll together instead of independently
**Why it happens:** Missing `overflow-hidden` on parent, or improper height constraints
**How to avoid:** Set explicit `h-full` on both columns, `overflow-y-auto` only on content
**Warning signs:** Scrolling one column scrolls both, or content overflows container

### Pitfall 4: Transition Flicker on Initial Render

**What goes wrong:** Elements flash/jump when component first renders
**Why it happens:** Transitions apply before initial state is set
**How to avoid:** Use `transition-none` on initial render or apply transitions only after mount
**Warning signs:** Quick visual jump when page loads

### Pitfall 5: Selection State Duplication

**What goes wrong:** Multiple sources of truth for selected item ID
**Why it happens:** Adding state to new panel component instead of lifting to parent
**How to avoid:** Keep selection state in DatasetDetail (already there), pass down as props
**Warning signs:** Navigation works in one place but not another

## Code Examples

Verified patterns from official sources:

### Max-Width Transition (CSS Grid + Tailwind)

```typescript
// Source: tailwind.config.ts animation tokens + transitions.ts
const DatasetDetailContent = ({ hasSelection }: { hasSelection: boolean }) => {
  return (
    <div className={cn(
      "mx-auto w-full",
      transitions.allSlow, // 300ms transition
      hasSelection ? "max-w-[100rem]" : "max-w-[50rem]"
    )}>
      {/* content */}
    </div>
  );
};
```

### SplitButton Component Structure

```typescript
// Source: CombinedButtons pattern + Popover usage from items-list-actions.tsx
export interface SplitButtonProps {
  mainLabel: React.ReactNode;
  onMainClick: () => void;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  children: React.ReactNode; // Dropdown content
  disabled?: boolean;
}

export function SplitButton({
  mainLabel,
  onMainClick,
  variant = 'primary',
  size = 'sm',
  children,
  disabled,
}: SplitButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <CombinedButtons>
        <Button
          variant={variant}
          size={size}
          onClick={onMainClick}
          disabled={disabled}
        >
          {mainLabel}
        </Button>
        <PopoverTrigger asChild>
          <Button variant={variant} size={size} disabled={disabled}>
            <Icon><ChevronDown /></Icon>
          </Button>
        </PopoverTrigger>
      </CombinedButtons>
      <PopoverContent align="end" className="w-48 p-1">
        {children}
      </PopoverContent>
    </Popover>
  );
}
```

### Master-Detail Layout Structure

```typescript
// Source: MainContentContent pattern + WorkflowLayout concepts
export function ItemsMasterDetail({
  items,
  selectedItemId,
  onItemSelect,
  onItemClose,
  // ... other props
}: ItemsMasterDetailProps) {
  return (
    <div className={cn(
      "grid h-full overflow-hidden",
      selectedItemId
        ? "grid-cols-[minmax(300px,45%)_minmax(400px,55%)]"
        : "grid-cols-1",
      transitions.allSlow,
    )}>
      {/* List column - always visible */}
      <div className="flex flex-col h-full overflow-hidden border-r border-border1">
        <ItemsToolbar />
        <div className="flex-1 overflow-y-auto">
          <ItemsList
            items={items}
            selectedItemId={selectedItemId}
            onItemClick={onItemSelect}
          />
        </div>
      </div>

      {/* Detail column - conditional */}
      {selectedItemId && (
        <div className="flex flex-col h-full overflow-hidden">
          <ItemDetailToolbar onClose={onItemClose} />
          <div className="flex-1 overflow-y-auto">
            <ItemDetailContent itemId={selectedItemId} />
          </div>
        </div>
      )}
    </div>
  );
}
```

### Disabled Menu Item Pattern

```typescript
// Source: Button component disabled styling
<Button
  variant="ghost"
  size="sm"
  className="w-full justify-start"
  disabled
>
  <Icon><Plus /></Icon>
  Import JSON (Coming Soon)
</Button>
```

## State of the Art

| Old Approach               | Current Approach                 | When Changed | Impact                      |
| -------------------------- | -------------------------------- | ------------ | --------------------------- |
| SideDialog for item detail | Inline panel in master-detail    | Phase 10     | Better UX for item browsing |
| Single Add Item button     | Split button with import options | Phase 10     | Consolidated actions        |
| Edit/Delete in header      | Three-dot menu                   | Phase 10     | Cleaner header              |

**Deprecated/outdated:**

- None - this is net-new layout restructuring

## Open Questions

Things that couldn't be fully resolved:

1. **Exact column width ratios**
   - What we know: Left ~40-50%, Right ~50-60% per CONTEXT.md
   - What's unclear: Exact pixel breakpoints for responsive behavior
   - Recommendation: Start with `minmax(300px,45%)` / `minmax(400px,55%)`, adjust in implementation

2. **Animation timing for panel open**
   - What we know: `duration-slow` = 300ms per tokens
   - What's unclear: Whether faster/slower feels better for this use case
   - Recommendation: Use 300ms, adjust if feels sluggish or jarring

3. **List compression behavior**
   - What we know: Columns should compress in narrow view
   - What's unclear: Which columns hide vs truncate
   - Recommendation: Claude's discretion per CONTEXT.md - suggest hiding Metadata column first, then truncating Input

## Sources

### Primary (HIGH confidence)

- `packages/playground-ui/package.json` - Verified installed dependencies
- `packages/playground-ui/src/ds/components/CombinedButtons/` - Split button pattern
- `packages/playground-ui/src/ds/components/Popover/` - Dropdown menu pattern
- `packages/playground-ui/src/ds/primitives/transitions.ts` - Animation tokens
- `packages/playground-ui/src/domains/datasets/components/dataset-detail/items-list-actions.tsx` - Menu pattern

### Secondary (MEDIUM confidence)

- `packages/playground-ui/src/domains/workflows/components/workflow-layout.tsx` - Resizable panel pattern
- `packages/playground-ui/src/ds/components/MainContent/` - Layout grid pattern

### Tertiary (LOW confidence)

- None - all findings verified against codebase

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - All libraries verified in package.json
- Architecture: HIGH - Patterns derived from existing codebase
- Pitfalls: MEDIUM - Based on common React patterns and codebase inspection

**Research date:** 2026-01-30
**Valid until:** 2026-02-28 (stable codebase, low churn expected)
