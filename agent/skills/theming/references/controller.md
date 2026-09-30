# Controller API

This reference covers controller and shared theme types from `@pierre/theming`.

## Exports

| Export                        | Kind     | Purpose                                                            |
| ----------------------------- | -------- | ------------------------------------------------------------------ |
| `createThemeController`       | Function | Creates state for a color mode and selected light and dark themes. |
| `ThemeController`             | Type     | Defines controller state, mutations, subscription, and cleanup.    |
| `ThemeControllerOptions`      | Type     | Selects a catalog or resolver and configures initial state.        |
| `ThemeControllerState`        | Type     | Describes the current selection and resolved theme.                |
| `PendingThemeResolution`      | Type     | Identifies the active theme load.                                  |
| `ThemeResolutionError`        | Type     | Describes a failed active theme load.                              |
| `ThemeResolutionErrorContext` | Type     | Identifies the name and scheme for a failed load callback.         |
| `ThemePersistence`            | Type     | Defines custom `load` and `save` methods.                          |
| `ThemeSelection`              | Type     | Describes the persisted mode and theme names.                      |
| `ColorMode`                   | Type     | Accepts `light`, `dark`, or `system`.                              |
| `ColorScheme`                 | Type     | Accepts concrete `light` or `dark`.                                |
| `ThemeLike`                   | Type     | Defines the shared resolved-theme shape.                           |

## `ThemeControllerOptions` fields

| Field                   | Purpose                                                             |
| ----------------------- | ------------------------------------------------------------------- |
| `catalog`               | Supplies descriptors and catalog default names.                     |
| `resolver`              | Supplies an existing resolver or shares one with other controllers. |
| `defaultLightThemeName` | Overrides the initial light theme name.                             |
| `defaultDarkThemeName`  | Overrides the initial dark theme name.                              |
| `defaultMode`           | Sets the initial color mode.                                        |
| `storageKey`            | Stores the selection in browser local storage.                      |
| `persistence`           | Supplies custom selection storage.                                  |
| `preloadInactive`       | Resolves the inactive color-scheme theme too.                       |
| `onResolutionError`     | Receives an active theme load error.                                |

Pass a `catalog`, a `resolver`, or a catalog with a shared resolver.

## `ThemeController` members

| Member                                | Purpose                                                          |
| ------------------------------------- | ---------------------------------------------------------------- |
| `resolver`                            | Exposes the controller's resolver.                               |
| `getState()`                          | Returns the current immutable state object.                      |
| `setColorMode(mode)`                  | Selects light, dark, or system mode.                             |
| `setThemeNameForScheme(scheme, name)` | Selects the theme for one color scheme.                          |
| `subscribe(listener)`                 | Subscribes to state changes and returns an unsubscribe function. |
| `destroy()`                           | Removes the system color-scheme listener.                        |

## `ThemeControllerState` fields

| Field                    | Purpose                                            |
| ------------------------ | -------------------------------------------------- |
| `lightThemeName`         | Stores the selected light theme name.              |
| `darkThemeName`          | Stores the selected dark theme name.               |
| `mode`                   | Stores the selected color mode.                    |
| `resolvedColorScheme`    | Provides the active concrete light or dark scheme. |
| `resolvedTheme`          | Provides the active resolved theme object.         |
| `pendingThemeResolution` | Identifies an active theme load.                   |
| `resolutionError`        | Describes the latest active load failure.          |
