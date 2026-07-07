---
title: Extract Derived Composition Helpers
impact: MEDIUM
impactDescription: mutating a local derived value hides temporal control flow, makes review harder, and turns declarative composition into step-by-step state changes
tags: structure, readability, control-flow, mutation, maintainability
---

## Extract Derived Composition Helpers

When a component derives the final value it renders or passes onward, keep that derivation declarative. If the code starts with `let value = base` and then conditionally rewrites `value`, move the composition into a small pure helper with guard clauses and explicit returns.

This is not a ban on `let`. Use `let` for real sequential algorithms, counters, loops, resource handles, or cases where each step intentionally depends on the previous step. Avoid it when the local represents a final derived UI/data shape; mutation there makes the final value harder to anticipate.

**Incorrect (derived composition hidden behind mutation):**

```tsx
function Sidebar({ orgId, projectId, isSettingsActive }: SidebarProps) {
  let sections = getBaseSections(orgId, projectId);

  if (orgId && !isSettingsActive) {
    const [mainSection, ...restSections] = sections;
    sections = [
      {
        ...mainSection,
        links: [getProjectsLink(projectId), ...mainSection.links],
      },
      ...restSections,
    ];
  }

  return <Nav sections={sections} />;
}
```

The reader has to track the variable over time to understand what `sections` means at render time.

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
      links: [projectsLink, ...mainSection.links],
    },
    ...restSections,
  ];
}

function Sidebar({ orgId, projectId, isSettingsActive }: SidebarProps) {
  const baseSections = getBaseSections(orgId, projectId);
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

Smells: `let result = ...` followed by `if (...) result = ...`; comments explaining mutation order; review comments like "feels intense", "can we simplify this?", or "why do we need let?"; derived arrays/objects that are later rendered or passed as props.
