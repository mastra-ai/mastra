# Typography review screenshots

Captured with Chromium against the actual Factory sign-in page and Playground UI Storybook. Screens show the shared DS in dark and light themes at desktop (1440×1000), tablet (768×1024), and mobile (390×844). The Signals story renders the actual empty-state component. Technical-values and text-role stories demonstrate the API contracts.

Factory authentication uses a network fixture (`/auth/me`, unauthenticated Better Auth); the install banner is dismissed so it does not obscure the comparison. Factory’s decorative canvas animation keeps running, so its pixels differ independently of typography. Factory images use viewport screenshots; Storybook images use full-page screenshots.

Factory before images were captured from the baseline page. Signals before images render the baseline component, and Command before images render the baseline shared component with the same story content. The temporary baseline components were removed after capture. Existing typography tokens stayed unchanged during baseline rendering. The new role/font stories have no before image because they are API examples added by this PR.

No browser page errors occurred during capture. These captures cover the major visual changes and reusable contracts; the complete call-site inventory is in [AUDIT.md](AUDIT.md).

## Factory sign-in — shared hero and lead

| Viewport / theme | Before                                                           | After                                                          |
| ---------------- | ---------------------------------------------------------------- | -------------------------------------------------------------- |
| desktop / dark   | ![Before desktop dark](before/factory-signin-desktop-dark.png)   | ![After desktop dark](after/factory-signin-desktop-dark.png)   |
| desktop / light  | ![Before desktop light](before/factory-signin-desktop-light.png) | ![After desktop light](after/factory-signin-desktop-light.png) |
| tablet / dark    | ![Before tablet dark](before/factory-signin-tablet-dark.png)     | ![After tablet dark](after/factory-signin-tablet-dark.png)     |
| tablet / light   | ![Before tablet light](before/factory-signin-tablet-light.png)   | ![After tablet light](after/factory-signin-tablet-light.png)   |
| mobile / dark    | ![Before mobile dark](before/factory-signin-mobile-dark.png)     | ![After mobile dark](after/factory-signin-mobile-dark.png)     |
| mobile / light   | ![Before mobile light](before/factory-signin-mobile-light.png)   | ![After mobile light](after/factory-signin-mobile-light.png)   |

## Trace Intelligence empty state — headings, prose, labels, trace IDs

| Viewport / theme | Before                                                               | After                                                              |
| ---------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------ |
| desktop / dark   | ![Before desktop dark](before/playground-signals-desktop-dark.png)   | ![After desktop dark](after/playground-signals-desktop-dark.png)   |
| desktop / light  | ![Before desktop light](before/playground-signals-desktop-light.png) | ![After desktop light](after/playground-signals-desktop-light.png) |
| tablet / dark    | ![Before tablet dark](before/playground-signals-tablet-dark.png)     | ![After tablet dark](after/playground-signals-tablet-dark.png)     |
| tablet / light   | ![Before tablet light](before/playground-signals-tablet-light.png)   | ![After tablet light](after/playground-signals-tablet-light.png)   |
| mobile / dark    | ![Before mobile dark](before/playground-signals-mobile-dark.png)     | ![After mobile dark](after/playground-signals-mobile-dark.png)     |
| mobile / light   | ![Before mobile light](before/playground-signals-mobile-light.png)   | ![After mobile light](after/playground-signals-mobile-light.png)   |

## Command groups — shared eyebrow instead of overridden meta

| Viewport / theme | Before                                                    | After                                                   |
| ---------------- | --------------------------------------------------------- | ------------------------------------------------------- |
| desktop / dark   | ![Before desktop dark](before/command-desktop-dark.png)   | ![After desktop dark](after/command-desktop-dark.png)   |
| desktop / light  | ![Before desktop light](before/command-desktop-light.png) | ![After desktop light](after/command-desktop-light.png) |
| tablet / dark    | ![Before tablet dark](before/command-tablet-dark.png)     | ![After tablet dark](after/command-tablet-dark.png)     |
| tablet / light   | ![Before tablet light](before/command-tablet-light.png)   | ![After tablet light](after/command-tablet-light.png)   |
| mobile / dark    | ![Before mobile dark](before/command-mobile-dark.png)     | ![After mobile dark](after/command-mobile-dark.png)     |
| mobile / light   | ![Before mobile light](before/command-mobile-light.png)   | ![After mobile light](after/command-mobile-light.png)   |

## Monospace control and technical-value contracts

| Viewport | Dark                                                     | Light                                                      |
| -------- | -------------------------------------------------------- | ---------------------------------------------------------- |
| desktop  | ![desktop dark](after/technical-values-desktop-dark.png) | ![desktop light](after/technical-values-desktop-light.png) |
| tablet   | ![tablet dark](after/technical-values-tablet-dark.png)   | ![tablet light](after/technical-values-tablet-light.png)   |
| mobile   | ![mobile dark](after/technical-values-mobile-dark.png)   | ![mobile light](after/technical-values-mobile-light.png)   |

## All text roles, including hero, lead, and eyebrow

| Viewport | Dark                                               | Light                                                |
| -------- | -------------------------------------------------- | ---------------------------------------------------- |
| desktop  | ![desktop dark](after/text-roles-desktop-dark.png) | ![desktop light](after/text-roles-desktop-light.png) |
| tablet   | ![tablet dark](after/text-roles-tablet-dark.png)   | ![tablet light](after/text-roles-tablet-light.png)   |
| mobile   | ![mobile dark](after/text-roles-mobile-dark.png)   | ![mobile light](after/text-roles-mobile-light.png)   |

## Prose editor — shared font prop in both editor themes

| Viewport | Dark                                                 | Light                                                  |
| -------- | ---------------------------------------------------- | ------------------------------------------------------ |
| desktop  | ![desktop dark](after/prose-editor-desktop-dark.png) | ![desktop light](after/prose-editor-desktop-light.png) |
| tablet   | ![tablet dark](after/prose-editor-tablet-dark.png)   | ![tablet light](after/prose-editor-tablet-light.png)   |
| mobile   | ![mobile dark](after/prose-editor-mobile-dark.png)   | ![mobile light](after/prose-editor-mobile-light.png)   |
