---
title: Extract Complex Derived Logic
impact: MEDIUM-HIGH
impactDescription: dense derived logic hides business rules inside operator soup, makes review harder, and turns declarative composition into step-by-step state tracking
tags: structure, readability, control-flow, mutation, conditions, maintainability
---

## Extract Complex Derived Logic

When a component derives a final render value, nav model, visibility flag, active state, or route target, keep that derivation readable. If a few lines combine large boolean conditions, nested ternaries, local mutation, `||`, `??`, optional chaining, spreads, and default fallbacks, move the logic into named predicates or small pure helpers with guard clauses and explicit returns.

This is not a render-only rule. Hook option objects, query and request builders, config maps, and reducers derive values too, and the same operator soup hurts them the same way.

Treat `let` in render prep as a code smell by default. Prefer a named helper that returns the final value through guard clauses and explicit returns. Reserve `let` for real sequential algorithms, counters, loops, resource handles, or cases where each step intentionally depends on the previous step. Avoid it when the local represents a final derived UI/data shape; mutation there makes the final value harder to anticipate.

Do not fix one smell while leaving another. Extracting a reassigned `let` into `const base = condition ? a : b` is still a problem when the ternary is choosing structural data. The cleaned-up version should remove the operator soup, nested control flow, and mutation together.

### Large Conditions

**Incorrect:**

```tsx
function Sidebar({ orgId, projectId, isSettingsActive, product, pathname }: SidebarProps) {
  const isProjectsHeaderActive =
    (product === 'studio' && !projectId && !isSettingsActive && pathname === `/orgs/${orgId}`) ||
    (product === 'gateway' && !projectId && !isSettingsActive);

  return <Nav activeProjects={isProjectsHeaderActive} />;
}
```

**Correct:**

```tsx
function shouldHighlightProjects({
  product,
  projectId,
  isSettingsActive,
  pathname,
  projectsHref,
}: {
  product: Product;
  projectId?: string;
  isSettingsActive: boolean;
  pathname: string;
  projectsHref: string;
}) {
  if (projectId || isSettingsActive) return false;
  if (product === 'gateway') return true;
  return pathname === projectsHref;
}

function Sidebar({ orgId, projectId, isSettingsActive, product, pathname }: SidebarProps) {
  const projectsHref = `/orgs/${orgId}`;
  const isProjectsHeaderActive = shouldHighlightProjects({
    product,
    projectId,
    isSettingsActive,
    pathname,
    projectsHref,
  });

  return <Nav activeProjects={isProjectsHeaderActive} />;
}
```

The callsite names the derived boolean before JSX; the helper owns the ordering of the rules.

### Nested Structural Ternaries

**Incorrect:**

```tsx
function Sidebar({ orgId, projectId, isSettingsActive }: SidebarProps) {
  const resolvedOrgId = orgId ?? fallbackOrgId;
  const sections = isSettingsActive
    ? getSettingsSections(resolvedOrgId)
    : projectId
      ? getProjectSections(resolvedOrgId, projectId)
      : getOrgSections(resolvedOrgId);

  return <Nav sections={sections} />;
}
```

**Correct:**

```tsx
function getBaseSections({
  orgId,
  projectId,
  isSettingsActive,
}: {
  orgId: string;
  projectId?: string;
  isSettingsActive: boolean;
}) {
  if (isSettingsActive) return getSettingsSections(orgId);
  if (projectId) return getProjectSections(orgId, projectId);
  return getOrgSections(orgId);
}

function Sidebar({ orgId, projectId, isSettingsActive }: SidebarProps) {
  const resolvedOrgId = orgId ?? fallbackOrgId;
  const sections = getBaseSections({
    orgId: resolvedOrgId,
    projectId,
    isSettingsActive,
  });

  return <Nav sections={sections} />;
}
```

Nested ternaries are especially costly when they select structural data, routes, or components. Use `if` returns so each case gets a nameable line.

### Ternaries That Do Work

A ternary picks between two values. It has stopped picking and started computing once a branch grows a body — a block arrow, an IIFE, a multi-line object — or once its condition tests a shape that the branch then has to re-assert with `as`. Both mean the same fix: a named function with guard clauses.

**Incorrect:**

```ts
export function buildPreview(input: unknown) {
  const value = parseIfJson(input);

  const messages = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray((value as { messages?: unknown }).messages)
      ? (value as { messages: unknown[] }).messages
      : undefined;

  if (!messages) return undefined;
  return previewFrom(messages);
}
```

**Correct:**

```ts
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toMessages(value: unknown): unknown[] | undefined {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return undefined;
  if (!Array.isArray(value.messages)) return undefined;

  return value.messages;
}

export function buildPreview(input: unknown) {
  const messages = toMessages(parseIfJson(input));
  if (!messages) return undefined;

  return previewFrom(messages);
}
```

The casts were not incidental, and deleting them in place would not have compiled. `typeof value === 'object'` narrows `unknown` to `object | null`, since `typeof null` is `'object'`, and the `value &&` in front strips only the `null`. What is left is `object`, a type with no properties, so reading `.messages` is still an error and the assertion is the way out — and because narrowing tracks references rather than expressions, a condition written over `(value as X).messages` proves nothing for the branch, which asserts a second time. The predicate is what removes both. Ternary branches narrow like any other control flow: the conditional never forced the casts, the missing predicate did. Extraction repairs the other half, the density. This shape usually needs both repairs, so when you meet an `as` cluster inside a dense conditional, look for the missing predicate too (`types-no-type-assertions`).

Extracting is not the same as wrapping. A ternary that picks between two values on one line is fine and gains nothing from a helper; the helper would add a name, an indirection, and often a type argument, without removing any work from the callsite.

### Hook Calls Are Sources, Not Terms

A hook call declares where a value comes from and what the component re-renders on. Buried inside the expression that consumes it, the line reads as a computation and the subscription has to be spotted inside a condition, a template, or an argument list. Bind it first.

**Incorrect:**

```tsx
const Heading = useContext(HeadingLevelContext) === 2 ? 'h2' : 'h3';
```

**Correct:**

```tsx
const headingLevel = useContext(HeadingLevelContext);
const Heading = headingLevel === 2 ? 'h2' : 'h3';
```

The extra line pays for itself twice: the subscription is visible on its own line, and the value gets the name the expression was already using it under.

### Fallback and Operator Soup

**Incorrect:**

```tsx
function Sidebar({ orgId, projectId, sections }: SidebarProps) {
  const [mainSection, ...restSections] = sections ?? [];
  const nextSections = [
    {
      ...(mainSection ?? { key: 'main', links: [] }),
      links: [projectId ? getBackLink(orgId) : getProjectsLink(orgId), ...(mainSection?.links || [])],
    },
    ...restSections,
  ];

  return <Nav sections={nextSections} />;
}
```

**Correct:**

```tsx
function getProjectsEntryLink({ orgId, projectId }: { orgId: string; projectId?: string }) {
  if (projectId) return getBackLink(orgId);
  return getProjectsLink(orgId);
}

function prependLinkToFirstSection(sections: NavSection[], link: NavLink) {
  const [mainSection, ...restSections] = sections;

  if (!mainSection) {
    return [{ key: 'main', links: [link] }];
  }

  return [
    {
      ...mainSection,
      links: [link, ...mainSection.links],
    },
    ...restSections,
  ];
}

function Sidebar({ orgId, projectId, sections }: SidebarProps) {
  const nextSections = prependLinkToFirstSection(sections, getProjectsEntryLink({ orgId, projectId }));

  return <Nav sections={nextSections} />;
}
```

Move fallback behavior and link selection into named helpers. The render prep should not require decoding `? :`, `||`, `??`, `?.`, spreads, and default objects at the same time.

### Mutable Derived Composition

**Incorrect:**

```tsx
function Sidebar({ orgId, projectId, isSettingsActive, product }: SidebarProps) {
  let sections = getBaseSections({
    orgId: orgId ?? fallbackOrgId,
    projectId,
    isSettingsActive,
  });

  if (orgId && product === 'studio' && !isSettingsActive) {
    sections = prependLinkToFirstSection(sections, getProjectsEntryLink({ orgId, projectId }));
  }

  return <Nav sections={sections} />;
}
```

**Correct:**

```tsx
function getSidebarSections({
  orgId,
  projectId,
  product,
  isSettingsActive,
}: {
  orgId?: string;
  projectId?: string;
  product: Product;
  isSettingsActive: boolean;
}) {
  const baseSections = getBaseSections({
    orgId: orgId ?? fallbackOrgId,
    projectId,
    isSettingsActive,
  });

  if (!orgId) return baseSections;
  if (product !== 'studio') return baseSections;
  if (isSettingsActive) return baseSections;

  return prependLinkToFirstSection(baseSections, getProjectsEntryLink({ orgId, projectId }));
}

function Sidebar({ orgId, projectId, isSettingsActive, product }: SidebarProps) {
  const sections = getSidebarSections({
    orgId,
    projectId,
    product,
    isSettingsActive,
  });

  return <Nav sections={sections} />;
}
```

The callsite receives the final value directly. The reader does not have to track a reassigned local or inspect whether earlier fallback behavior changed the later branch.

Keep helpers local to the file unless multiple domains genuinely share the same concept. The point is to name the condition or derivation and remove useless complexity, not to create a generic utility layer.

Smells: a hook call nested inside a condition, ternary, template literal, or argument list; very large `&&`/`||` conditions inline in JSX or render prep; nested ternaries that choose structural data; ternary branches spanning several lines or wrapping a block arrow, IIFE, or multi-line object; an `as` cast in a branch for a shape the condition just tested; the same requirement encoded twice, once in a condition and once in the value it guards; `let result = ...` followed by `if (...) result = ...`; derived props passed as `propName={complexHelper({ ... })}` instead of a named local; four-line blocks mixing `? :`, `||`, `??`, `?.`, spreads, and default objects; comments explaining mutation order; review comments like "feels intense", "can we simplify this?", "could we refactor those lines into an understandable function?", or "why do we need let?"; derived arrays/objects that are later rendered or passed as props.
