# Resolver API

This reference covers the resolver exports from `@pierre/theming`.

## Exports

| Export                   | Kind     | Purpose                                                       |
| ------------------------ | -------- | ------------------------------------------------------------- |
| `createThemeResolver`    | Function | Creates an isolated loader registry and resolved-theme cache. |
| `ThemeResolver`          | Type     | Defines the resolver methods.                                 |
| `ThemeLoader`            | Type     | Defines an asynchronous theme loader.                         |
| `DuplicateThemeError`    | Class    | Reports a second registration for the same name.              |
| `UnregisteredThemeError` | Class    | Reports a resolve request for a name with no loader.          |
| `UnresolvedThemeError`   | Class    | Reports a synchronous batch read with an unresolved name.     |

## `ThemeResolver` methods

| Method                                | Purpose                                                  |
| ------------------------------------- | -------------------------------------------------------- |
| `registerTheme(name, loader)`         | Registers one loader.                                    |
| `registerThemeIfAbsent(name, loader)` | Registers one loader only when the name is free.         |
| `hasRegisteredTheme(name)`            | Tests whether a loader exists.                           |
| `resolveTheme(name)`                  | Loads and caches one theme.                              |
| `resolveThemes(names)`                | Loads and caches themes in input order.                  |
| `getResolvedTheme(name)`              | Reads one cached theme or returns `undefined`.           |
| `getResolvedThemes(names)`            | Reads cached themes in input order.                      |
| `getResolvedOrResolveTheme(name)`     | Returns a cached theme or starts its load.               |
| `hasResolvedTheme(name)`              | Tests whether one cached theme exists.                   |
| `hasResolvedThemes(names)`            | Tests whether all named themes exist in the cache.       |
| `seedResolvedTheme(name, theme)`      | Adds one resolved object without a loader.               |
| `seedResolvedThemes(entries)`         | Adds several resolved objects without loaders.           |
| `clearResolvedThemes()`               | Clears cached themes and active loads but keeps loaders. |

Each loader returns a `ThemeLike` object or a module object with that value on
`default`.
