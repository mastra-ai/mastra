---
title: Extract Derived Composition Helpers
impact: MEDIUM
impactDescription: mutating a local derived value hides temporal control flow, makes review harder, and turns declarative composition into step-by-step state changes
tags: structure, readability, control-flow, mutation, maintainability
---

## Extract Derived Composition Helpers

When a component derives the final value it renders or passes onward, keep that derivation declarative. If a few lines combine local mutation, nested ternaries, `||`, `??`, optional chaining, and spread/default fallbacks, move the composition into a small pure helper with guard clauses and explicit returns.

This is not a ban on `let`. Use `let` for real sequential algorithms, counters, loops, resource handles, or cases where each step intentionally depends on the previous step. Avoid it when the local represents a final derived UI/data shape; mutation there makes the final value harder to anticipate.

**Incorrect (dense derived composition hidden behind mutation and fallbacks):**

```tsx
function Sidebar({ orgId, projectId, isSettingsActive }: SidebarProps) {
  let sections = isSettingsActive
    ? getSettingsSections(orgId ?? fallbackOrgId)
    : projectId
      ? getProjectSections(orgId || fallbackOrgId, projectId)
      : getOrgSections(orgId ?? fallbackOrgId);

  const [mainSection, ...restSections] = sections ?? [];
  sections =
    orgId && !isSettingsActive
      ? [
          {
            ...(mainSection ?? { key: 'main', links: [] }),
            links: [projectId ? getBackLink(orgId) : getProjectsLink(orgId), ...(mainSection?.links ?? [])],
          },
          ...restSections,
        ]
      : sections;

  return <Nav sections={sections} />;
}
```

The reader has to parse several fallback operators and track `sections` over time before they can know what renders. None of that state is actually sequential; it is just one derived value.

**Correct (one named derivation with early returns):**

```tsx
function getSectionsWithProjectsLink({
  sections,
  orgId,
  projectId,
  isSettingsActive,
}: {
  sections: NavSection[];
  orgId?: string;
  projectId?: string;
  isSettingsActive: boolean;
}) {
  if (!orgId || isSettingsActive) return sections;

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
  const baseSections = isSettingsActive
    ? getSettingsSections(resolvedOrgId)
    : projectId
      ? getProjectSections(resolvedOrgId, projectId)
      : getOrgSections(resolvedOrgId);
  const sections = getSectionsWithProjectsLink({
    sections: baseSections,
    orgId,
    projectId,
    isSettingsActive,
  });

  return <Nav sections={sections} />;
}
```

Keep the helper local to the file unless multiple domains genuinely share the same concept. The point is to name the derivation and remove temporal mutation, not to create a generic utility layer.

Smells: `let result = ...` followed by `if (...) result = ...`; four-line blocks mixing `? :`, `||`, `??`, `?.`, spreads, and default objects; comments explaining mutation order; review comments like "feels intense", "can we simplify this?", or "why do we need let?"; derived arrays/objects that are later rendered or passed as props.
