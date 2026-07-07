---
title: Extract Complex Derived Logic
impact: MEDIUM
impactDescription: dense derived logic hides business rules inside operator soup, makes review harder, and turns declarative composition into step-by-step state tracking
tags: structure, readability, control-flow, mutation, conditions, maintainability
---

## Extract Complex Derived Logic

When a component derives a final render value, nav model, visibility flag, active state, or route target, keep that derivation readable. If a few lines combine large boolean conditions, nested ternaries, local mutation, `||`, `??`, optional chaining, spreads, and default fallbacks, move the logic into named predicates or small pure helpers with guard clauses and explicit returns.

This is not a ban on `let`. Use `let` for real sequential algorithms, counters, loops, resource handles, or cases where each step intentionally depends on the previous step. Avoid it when the local represents a final derived UI/data shape; mutation there makes the final value harder to anticipate.

Do not fix one smell while leaving another. Extracting a reassigned `let` into `const base = condition ? a : b` is still a problem when the ternary is choosing structural data. The cleaned-up version should remove the operator soup, nested control flow, and mutation together.

### Large Conditions

**Incorrect:**

```tsx
function Sidebar({ orgId, projectId, isSettingsActive }: SidebarProps) {
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

function Sidebar({ orgId, projectId, isSettingsActive }: SidebarProps) {
  const projectsHref = `/orgs/${orgId}`;

  return (
    <Nav
      activeProjects={shouldHighlightProjects({
        product,
        projectId,
        isSettingsActive,
        pathname,
        projectsHref,
      })}
    />
  );
}
```

The callsite names what the condition means; the helper owns the ordering of the rules.

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
function Sidebar({ orgId, projectId, isSettingsActive }: SidebarProps) {
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

function Sidebar({ orgId, projectId, isSettingsActive }: SidebarProps) {
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

Smells: very large `&&`/`||` conditions inline in JSX or render prep; nested ternaries that choose structural data; `let result = ...` followed by `if (...) result = ...`; four-line blocks mixing `? :`, `||`, `??`, `?.`, spreads, and default objects; comments explaining mutation order; review comments like "feels intense", "can we simplify this?", or "why do we need let?"; derived arrays/objects that are later rendered or passed as props.
