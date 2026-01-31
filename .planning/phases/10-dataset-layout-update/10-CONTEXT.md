# Phase 10: Dataset Layout Update - Context

**Gathered:** 2026-01-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Redesign the DatasetDetail page layout: master-detail pattern for item viewing, reorganized header with actions, split button components, and toolbar restructuring. This phase focuses on layout and UI structure — new functionality (Import JSON, Duplicate Dataset, Add to another Dataset) shows in UI but is deferred.

</domain>

<decisions>
## Implementation Decisions

### Page Layout

- CSS Grid with two rows: `auto` (header) + `1fr` (content)
- Header and Tabs remain fixed at top
- Tab content area scrolls independently
- Max-width increases from 50rem to 100rem when detail panel opens

### Header Structure

- Flexbox horizontal layout, `justify-between`, `items-start`
- Left side: Dataset name (`text-xl`/`text-2xl`, `font-semibold`) + description below (`text-sm`, `text-muted-foreground`)
- Right side: `...` menu button + "Run Experiment" button (outline variant)
- Header `...` menu options:
  - Edit Dataset
  - Duplicate Dataset (disabled — deferred)
  - Delete Dataset

### Tabs

- Two tabs: "Items" (default active) and "Runs"
- Existing implementation unchanged

### Items Tab - List View (no item selected)

- Single column, full width
- Toolbar above list with:
  - Split button (primary): "+ New Item" main action, dropdown with:
    - Import CSV with items (existing)
    - Import JSON with items (disabled — deferred)
  - `...` menu button with:
    - Select and Export Items
    - Select Items to Create a new Dataset
    - Select and Add Items to another Dataset (disabled — deferred)
    - Select Items to Delete
- EntryList stays as currently implemented (4 columns: INPUT, EXPECTED OUTPUT, METADATA, CREATED AT)

### Items Tab - Master-Detail View (item selected)

- Two column layout when item is clicked
- Left column (~40-50%): Toolbar + compressed item list
- Right column (~50-60%): Item toolbar + item details
- Each column scrolls independently
- Smooth transition/animation when opening detail panel

### Item Detail Toolbar (right column)

- Left side: Previous/Next navigation buttons (outline variant, disabled at boundaries)
- Right side: Edit split button
  - Main action: "Edit" (switches to edit mode)
  - Dropdown options:
    - Delete Item
    - Duplicate Item

### Item Detail Content

- Item ID as heading
- Created at / Updated at metadata
- Sections: INPUT, EXPECTED OUTPUT, METADATA (each with label + content)
- Content displayed read-only by default

### Split Button Component

- New reusable component
- Visual: Label section | Chevron section with divider
- Behavior: Label click = primary action, chevron click = dropdown
- Dropdown aligns to full button width
- States: default, hover (individual sides), active, dropdown open

### Claude's Discretion

- Exact column width ratios in master-detail
- Transition/animation timing and easing
- Split button hover state details (whole button vs individual sides)
- How list columns compress in narrow view (truncation, hiding columns)
- Exact spacing and typography details
- Edit mode implementation details (reuse existing or new)

</decisions>

<specifics>
## Specific Ideas

- Wireframes provided showing exact layout structure
- Split button pattern: label + chevron with visual divider
- "Select and Add Items to another Database" in spec — should be "Dataset" (typo)
- Follow existing playground patterns for buttons, menus, tabs

</specifics>

<deferred>
## Deferred Ideas

- **Import JSON with items** — show in dropdown but disabled, implement in future phase
- **Duplicate Dataset** — show in menu but disabled, implement in future phase
- **Add Items to another Dataset** — show in menu but disabled, implement in future phase
- Duplicate Item functionality — show in Edit dropdown but may need backend support

</deferred>

---

_Phase: 10-dataset-layout-update_
_Context gathered: 2026-01-30_
