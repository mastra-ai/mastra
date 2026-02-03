# Phase 12: Schema JSON Schema Notification - Research

**Researched:** 2026-02-02
**Domain:** React UI notification patterns for schema configuration
**Confidence:** HIGH

## Summary

This phase adds an educational notification when users enable schema configuration in Create/Edit Dataset dialogs. The notification explains JSON Schema support and its benefits (validation, type checking).

The codebase has two established notification patterns: `Alert` component (inline, static) and `Notification` component (dismissible, animated). For this use case, the `Alert` component with `variant="info"` is the best fit - it's inline, non-intrusive, and doesn't require dismiss state management.

The notification should appear inside `SchemaConfigSection` when the collapsible is expanded. This placement is contextual (appears with schema controls) and non-disruptive (doesn't show until user explicitly opens schema configuration). Since the user has already opened schema configuration, they're actively engaged with schemas - the info helps rather than interrupts.

**Primary recommendation:** Use existing `Alert` component with `variant="info"` inside `SchemaConfigSection`, shown when collapsible is open. No localStorage dismissal needed - the collapsible already controls visibility.

## Standard Stack

The established libraries/tools for this domain:

### Core

| Library  | Version      | Purpose             | Why Standard                                         |
| -------- | ------------ | ------------------- | ---------------------------------------------------- |
| Alert    | -            | Inline info display | Already in design system (`src/ds/components/Alert`) |
| InfoIcon | lucide-react | Icon indicator      | Already used with Alert component                    |

### Supporting

| Library      | Version | Purpose            | When to Use                                     |
| ------------ | ------- | ------------------ | ----------------------------------------------- |
| Notification | -       | Dismissible toasts | When dismiss persistence needed (not this case) |
| toast        | sonner  | Transient messages | Success/error feedback only                     |

### Alternatives Considered

| Instead of            | Could Use                  | Tradeoff                                                    |
| --------------------- | -------------------------- | ----------------------------------------------------------- |
| Alert (inline)        | Notification (dismissible) | Adds complexity - needs localStorage for "don't show again" |
| Alert (inline)        | toast                      | Transient - user might miss educational content             |
| Static in collapsible | Always visible             | Clutters dialog, shows even when user doesn't need schemas  |

**Installation:**
No new dependencies required.

## Architecture Patterns

### Recommended Project Structure

```
src/domains/datasets/components/
├── schema-config-section.tsx    # Add Alert inside CollapsibleContent
└── schema-settings/
    └── schema-field.tsx         # Unchanged
```

### Pattern 1: Inline Info Alert

**What:** Static educational info using Alert component
**When to use:** Contextual help that doesn't need persistence
**Example:**

```typescript
// Source: packages/playground-ui/src/ds/components/Alert/Alert.tsx
<Alert variant="info">
  <AlertTitle>JSON Schema Supported</AlertTitle>
  <AlertDescription as="p">
    Schemas use JSON Schema format for validation and type checking.
  </AlertDescription>
</Alert>
```

### Pattern 2: Helper Text (existing in codebase)

**What:** Small text below form controls
**When to use:** Very brief supplementary info
**Example:**

```typescript
// Source: schema-config-section.tsx lines 227-232
{sourceType === 'scorer' && (
  <p className="text-xs text-neutral3">
    {scorerTargetType === 'agent'
      ? 'For calibrating agent-type scorers'
      : 'For calibrating custom scorers (input/output as any)'}
  </p>
)}
```

### Anti-Patterns to Avoid

- **Toast for educational content:** User may dismiss before reading
- **localStorage dismiss pattern:** Over-engineering for simple info display
- **Always-visible notification:** Clutters UI when user doesn't need schemas
- **Notification at dialog top:** Disconnected from schema context

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem       | Don't Build              | Use Instead            | Why                                 |
| ------------- | ------------------------ | ---------------------- | ----------------------------------- |
| Info banner   | Custom div with styles   | Alert component        | Consistent styling, accessibility   |
| Icon          | Custom SVG               | lucide-react InfoIcon  | Already used throughout codebase    |
| Dismiss state | Custom localStorage hook | Collapsible open state | Section already controls visibility |

**Key insight:** The SchemaConfigSection collapsible already provides natural show/hide behavior. The notification only appears when user opens the collapsible, which is exactly when they need to see it.

## Common Pitfalls

### Pitfall 1: Over-engineering Dismiss Logic

**What goes wrong:** Building localStorage "don't show again" for simple info
**Why it happens:** Treating all notifications as equal
**How to avoid:** Recognize this is contextual help, not an interruption
**Warning signs:** Adding state management for dismiss persistence

### Pitfall 2: Notification Placement

**What goes wrong:** Placing notification outside schema context (e.g., dialog header)
**Why it happens:** Defaulting to "prominent" placement
**How to avoid:** Place inside CollapsibleContent, near schema controls
**Warning signs:** Notification visible when schema section is collapsed

### Pitfall 3: Verbose Content

**What goes wrong:** Long explanation that users skip
**Why it happens:** Trying to be comprehensive
**How to avoid:** One sentence focus: "what it is" + "what it enables"
**Warning signs:** More than 2 short sentences

### Pitfall 4: Missing Link to Documentation

**What goes wrong:** No way for curious users to learn more
**Why it happens:** Assuming the alert is self-sufficient
**How to avoid:** Include "Learn more" link to JSON Schema docs
**Warning signs:** Alert has no external reference

## Code Examples

Verified patterns from official sources:

### Alert with Title and Description

```typescript
// Source: packages/playground-ui/src/ds/components/Alert/alert.stories.tsx
<Alert variant="info">
  <AlertTitle>JSON Schema Supported</AlertTitle>
  <AlertDescription as="p">
    Schemas use JSON Schema format for validation and type checking.
    <a href="https://json-schema.org/" target="_blank" rel="noopener noreferrer"
       className="underline ml-1">
      Learn more
    </a>
  </AlertDescription>
</Alert>
```

### Placement in SchemaConfigSection

```typescript
// Inside CollapsibleContent, before source selector
<CollapsibleContent className="pt-4 space-y-4">
  {/* Info alert at top of expanded section */}
  <Alert variant="info" className="mb-2">
    <AlertTitle>JSON Schema Supported</AlertTitle>
    <AlertDescription as="p">
      Define input and output schemas using JSON Schema for validation.
    </AlertDescription>
  </Alert>

  {/* Source selector */}
  <div className="space-y-2">
    <label className="text-sm font-medium text-neutral4">Import From</label>
    {/* ... */}
  </div>
  {/* ... */}
</CollapsibleContent>
```

### Notification Component (alternative, NOT recommended)

```typescript
// Source: packages/playground-ui/src/ds/components/Notification/notification.tsx
// Only use if dismiss persistence truly needed
<Notification isVisible={true} autoDismiss={false} type="info">
  JSON Schema supported for validation.
</Notification>
```

## State of the Art

| Old Approach        | Current Approach         | When Changed | Impact                            |
| ------------------- | ------------------------ | ------------ | --------------------------------- |
| Toast notifications | Inline contextual alerts | n/a          | Better UX for educational content |

**Deprecated/outdated:**

- None relevant to this phase

## Open Questions

Things that couldn't be fully resolved:

1. **External Documentation Link**
   - What we know: JSON Schema official site is https://json-schema.org/
   - What's unclear: Does Mastra have its own docs page for schema usage?
   - Recommendation: Use json-schema.org link; can update later if Mastra docs exist

2. **Exact Notification Copy**
   - What we know: Should mention JSON Schema and validation
   - What's unclear: Final wording (product decision)
   - Recommendation: Start with "Schemas use JSON Schema format for validation and type checking. Learn more."

## Sources

### Primary (HIGH confidence)

- packages/playground-ui/src/ds/components/Alert/Alert.tsx - Alert component API
- packages/playground-ui/src/ds/components/Alert/alert.stories.tsx - Usage patterns
- packages/playground-ui/src/domains/datasets/components/schema-config-section.tsx - Current structure
- packages/playground-ui/src/ds/components/Notification/notification.tsx - Alternative pattern

### Secondary (MEDIUM confidence)

- Existing helper text pattern in schema-config-section.tsx (lines 227-232)
- localStorage patterns in codebase (agent settings, tracing settings)

### Tertiary (LOW confidence)

- None

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - Using existing Alert component from design system
- Architecture: HIGH - Clear placement in existing CollapsibleContent
- Pitfalls: HIGH - Based on direct codebase analysis

**Research date:** 2026-02-02
**Valid until:** 60 days (stable UI pattern)
