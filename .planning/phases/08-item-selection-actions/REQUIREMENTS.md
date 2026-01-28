# Dataset Item Selection & Actions — Requirements

## Overview

Allow users to select items in a dataset to perform bulk actions:
- Export selected items to CSV
- Create a new dataset from selected items
- Delete selected items

---

## UI Components & Layout

| Component | Position | Visibility |
|-----------|----------|------------|
| `Add Item` button | — | Always (default view) |
| `⋮` (3-dot menu) | Right of `Add Item` | Only if dataset has ≥1 item |
| Action button | Right of `⋮` button | After action selected from menu |
| Cancel button | Right of action button | After action selected from menu |
| Select checkbox | — | After action selected |
| Selected count | Right of select checkbox | After action selected |
| Item checkboxes | Per row | After action selected |

---

## User Flow

### 1. Idle State (Default)
- Standard dataset view with `Add Item` and `⋮` button visible
- No checkboxes shown

### 2. Action Selection
- User clicks `⋮` button → dropdown displays three actions
- User selects an action → enters **Selection Mode**

### 3. Selection Mode
- Action button appears (labeled: `Create Dataset`, `Export to CSV`, or `Delete Items`)
- Cancel button appears to the right of action button
- Checkboxes appear for each item
- "Select" checkbox selects all **loaded/visible** items
- Selected item count displays beside the select checkbox
- User can re-select a different action via `⋮` button

### 4. Selection Behavior
| Interaction | Behavior |
|-------------|----------|
| Single click | Toggle individual item |
| Shift + click | Select range from last-clicked item |
| Select checkbox | Select all loaded/visible items |

### 5. Action Button State
| Condition | State | Tooltip |
|-----------|-------|---------|
| 0 items selected | Disabled | "No dataset items have been selected" |
| ≥1 item selected | Enabled | — |

---

## Action-Specific Flows

### Export to CSV
1. User clicks `Export to CSV` button
2. CSV downloads immediately
3. Success banner appears → view resets

### Create Dataset
1. User clicks `Create Dataset` button
2. Modal appears with fields: **Name**, **Description**
3. User submits → new dataset created
4. Success banner appears with **link to new dataset** → view resets

### Delete Items
1. User clicks `Delete Items` button
2. Confirmation dialog appears
3. User confirms → items deleted
4. Success banner appears → view resets

---

## Post-Action Behavior

- View resets to default dataset state (selection mode exits)
- Dismissible banner displays:
  - **Export/Delete:** `"X items exported"` or `"X items deleted"`
  - **Create Dataset:** Link to the newly created dataset

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Empty dataset (0 items) | `⋮` button is **hidden** |
| Cancel clicked | Exit selection mode, return to default view |

---
