# Collections API

This reference covers collection APIs from `@pierre/theming` and all exports
from `@pierre/theming/themes`.

## `@pierre/theming` exports

| Export                      | Kind     | Purpose                                                            |
| --------------------------- | -------- | ------------------------------------------------------------------ |
| `createThemeCollection`     | Function | Creates an immutable ordered set of theme descriptors.             |
| `ThemeCollection`           | Type     | Defines collection queries, transforms, and resolver registration. |
| `ThemeCollectionComparator` | Type     | Compares two descriptors for `orderBy`.                            |
| `ThemeCollectionEntry`      | Type     | Accepts one descriptor or collection source.                       |
| `ThemeCollectionFilter`     | Type     | Filters by `collection` and `colorScheme`.                         |
| `ThemeCollectionInput`      | Type     | Accepts one entry or an iterable of entries.                       |
| `ThemeCollectionSource`     | Type     | Defines an object that returns theme descriptors.                  |
| `ThemeDescriptor`           | Type     | Describes one named theme and its lazy loader.                     |
| `createThemeCatalog`        | Function | Creates a collection with default light and dark theme names.      |
| `ThemeCatalog`              | Type     | Adds default theme names to `ThemeCollection`.                     |

## `ThemeDescriptor` fields

| Field         | Purpose                                 |
| ------------- | --------------------------------------- |
| `name`        | Stores the stable theme identifier.     |
| `load`        | Loads the theme object.                 |
| `colorScheme` | Labels the descriptor as light or dark. |
| `collection`  | Groups related themes.                  |
| `displayName` | Supplies a user-facing label.           |

## `ThemeCollection` methods

| Method                   | Purpose                                              |
| ------------------------ | ---------------------------------------------------- |
| `getTheme(name)`         | Gets one descriptor by name.                         |
| `getThemes(filter?)`     | Lists descriptors that match an optional filter.     |
| `getThemeNames(filter?)` | Lists names that match an optional filter.           |
| `hasTheme(name)`         | Tests whether the collection has a name.             |
| `orderBy(compare)`       | Returns a new collection in comparator order.        |
| `pick(names)`            | Returns a new collection in the supplied name order. |
| `registerInto(resolver)` | Adds every descriptor loader to a resolver.          |

## `ThemeCatalog` fields

| Field                   | Purpose                        |
| ----------------------- | ------------------------------ |
| `defaultLightThemeName` | Names the initial light theme. |
| `defaultDarkThemeName`  | Names the initial dark theme.  |

## `@pierre/theming/themes` exports

| Export               | Kind     | Purpose                                                                       |
| -------------------- | -------- | ----------------------------------------------------------------------------- |
| `themes`             | Value    | Combines the Pierre and Shiki collections in stable order.                    |
| `pierreThemes`       | Value    | Provides lazy descriptors for the ten Pierre themes.                          |
| `shikiThemes`        | Value    | Provides lazy descriptors for the bundled Shiki themes.                       |
| `createTheme`        | Function | Creates a descriptor whose loader normalizes a raw Shiki or VS Code theme.    |
| `CreateThemeOptions` | Type     | Defines the name, loader, and optional descriptor metadata for `createTheme`. |

Use `createTheme` for a raw Shiki or VS Code theme. Use a `ThemeDescriptor`
directly when the loader already returns a compatible `ThemeLike` object.
