---
title: Extract Complex Derived Logic
impact: MEDIUM
impactDescription: dense derived logic hides business rules inside operator soup, makes review harder, and turns declarative composition into step-by-step state tracking
tags: structure, readability, control-flow, mutation, conditions, maintainability
---

## Extract Complex Derived Logic

When a component derives a final render value, nav model, visibility flag, active state, or route target, keep that derivation readable. If a few lines combine large boolean conditions, nested ternaries, local mutation, `||`, `??`, optional chaining, spreads, and default fallbacks, move the logic into named predicates or small pure helpers with guard clauses and explicit returns.

This is not a ban on `let`. Use `let` for real sequential algorithms, counters, loops, resource handles, or cases where each step intentionally depends on the previous step. Avoid it when the local represents a final derived UI/data shape; mutation there makes the final value harder to anticipate.

**Incorrect (large condition, nested ternaries, and mutable composition in one place):**

```tsx
function Sidebar({ orgId, projectId, isSettingsActive }: SidebarProps) {
  const isProjectsHeaderActive =
    (product === 'studio' && !projectId && !isSettingsActive && pathname === `/orgs/${orgId}`) ||
    (product === 'gateway' && !projectId && !isSettingsActive);

  let sections = isSettingsActive
    ? getSettingsSections(orgId ?? fallbackOrgId)
    : projectId
      ? getProjectSections(orgId || fallbackOrgId, projectId)
      : getOrgSections(orgId ?? fallbackOrgId);

  const [mainSection, ...restSections] = sections ?? [];
  sections =
    orgId && product === 'studio' && !isSettingsActive
      ? [
          {
            ...(mainSection ?? { key: 'main', links: [] }),
            links: [projectId ? getBackLink(orgId) : getProjectsLink(orgId), ...(mainSection?.links ?? [])],
          },
          ...restSections,
        ]
      : sections;

  return <Nav sections={sections} activeProjects={isProjectsHeaderActive} />;
}
```

The reader has to parse several business rules, fallback operators, and a reassigned local before they can know what renders. None of that complexity is essential; it is just derived UI state.

**Correct (named predicates and derivation helpers with clean returns):**

```tsx
function isProjectsHeaderActive({
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

function getSectionsWithProjectsLink({
  sections,
  orgId,
  projectId,
  product,
  isSettingsActive,
}: {
  sections: NavSection[];
  orgId?: string;
  projectId?: string;
  product: Product;
  isSettingsActive: boolean;
}) {
  if (!orgId || product !== 'studio' || isSettingsActive) return sections;

  const projectsLink = getProjectsLink(projectId);
  const [mainSection, ...restSections] = sections;

  if (!mainSection) {
    return [{ key: 'main', links: [projectsLink] }];
  }

  return [
    {
      ...mainSection,
      links: [projectsLink, ...(mainSection.links ?? [])],
    },
    ...restSections,
  ];
}

function Sidebar({ orgId, projectId, isSettingsActive }: SidebarProps) {
  const resolvedOrgId = orgId ?? fallbackOrgId;
  const projectsHref = `/orgs/${resolvedOrgId}`;
  const baseSections = isSettingsActive
    ? getSettingsSections(resolvedOrgId)
    : projectId
      ? getProjectSections(resolvedOrgId, projectId)
      : getOrgSections(resolvedOrgId);
  const sections = getSectionsWithProjectsLink({
    sections: baseSections,
    orgId,
    projectId,
    product,
    isSettingsActive,
  });

  return (
    <Nav
      sections={sections}
      activeProjects={isProjectsHeaderActive({
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

Keep helpers local to the file unless multiple domains genuinely share the same concept. The point is to name the condition or derivation and remove useless complexity, not to create a generic utility layer.

Smells: very large `&&`/`||` conditions inline in JSX or render prep; nested ternaries that choose structural data; `let result = ...` followed by `if (...) result = ...`; four-line blocks mixing `? :`, `||`, `??`, `?.`, spreads, and default objects; comments explaining mutation order; review comments like "feels intense", "can we simplify this?", or "why do we need let?"; derived arrays/objects that are later rendered or passed as props.
