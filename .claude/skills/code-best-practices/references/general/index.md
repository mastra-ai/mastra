# General Code

## 1. Eliminating Waterfalls

| Rule             | Title                                    | Impact   | Summary                                                                 | Canonical file                      |
| ---------------- | ---------------------------------------- | -------- | ----------------------------------------------------------------------- | ----------------------------------- |
| `async-parallel` | Promise.all() for Independent Operations | CRITICAL | Execute independent async operations concurrently with `Promise.all()`. | [async-parallel](async-parallel.md) |

## 6. JavaScript Performance

| Rule                    | Title                                             | Impact     | Summary                                                                                     | Canonical file                                    |
| ----------------------- | ------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `js-set-map-lookups`    | Use Set/Map for O(1) Lookups                      | LOW-MEDIUM | Convert arrays to `Set` or `Map` for repeated membership checks.                            | [js-set-map-lookups](js-set-map-lookups.md)       |
| `js-tosorted-immutable` | Use toSorted() Instead of sort() for Immutability | MEDIUM     | Use `toSorted()` instead of mutating arrays with `sort()`.                                  | [js-tosorted-immutable](js-tosorted-immutable.md) |
| `js-length-check-first` | Early Length Check for Array Comparisons          | HIGH       | Check array lengths before expensive comparisons, sorting, serialization, or deep equality. | [js-length-check-first](js-length-check-first.md) |

## 7. Component Structure

| Rule                              | Title                                          | Impact      | Summary                                                                                                                                                                                                                                                                   | Canonical file                                                        |
| --------------------------------- | ---------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `structure-narrow-apis`           | Keep Input and Output APIs Narrow              | MEDIUM-HIGH | Split units with oversized props, arguments, or return objects; wrapping values in one object does not reduce responsibility.                                                                                                                                             | [structure-narrow-apis](structure-narrow-apis.md)                     |
| `structure-derive-dont-duplicate` | Derive Props and Params, Don't Pass Duplicates | MEDIUM      | Compute a value from a param/prop already in scope instead of accepting it as a separate arg.                                                                                                                                                                             | [structure-derive-dont-duplicate](structure-derive-dont-duplicate.md) |
| `structure-complex-derived-logic` | Extract Complex Derived Logic                  | MEDIUM-HIGH | Treat oversized conditions, nested ternaries, ternaries that compute instead of picking, fallback chains, and `let`-based prep as smells in render prep, hook options, request builders, config maps, and reducers alike; move them into named locals and helper returns. | [structure-complex-derived-logic](structure-complex-derived-logic.md) |
