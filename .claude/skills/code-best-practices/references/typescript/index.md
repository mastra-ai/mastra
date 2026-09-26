# TypeScript and JavaScript

## Eliminating Waterfalls

| Rule             | Title                                    | Impact   | Summary                                                                 | Canonical file                            |
| ---------------- | ---------------------------------------- | -------- | ----------------------------------------------------------------------- | ----------------------------------------- |
| `async-parallel` | Promise.all() for Independent Operations | CRITICAL | Execute independent async operations concurrently with `Promise.all()`. | [async-parallel](async/async-parallel.md) |

## JavaScript Performance

| Rule                    | Title                                             | Impact     | Summary                                                                                     | Canonical file                                                |
| ----------------------- | ------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `js-set-map-lookups`    | Use Set/Map for O(1) Lookups                      | LOW-MEDIUM | Convert arrays to `Set` or `Map` for repeated membership checks.                            | [js-set-map-lookups](performance/js-set-map-lookups.md)       |
| `js-tosorted-immutable` | Use toSorted() Instead of sort() for Immutability | MEDIUM     | Use `toSorted()` instead of mutating arrays with `sort()`.                                  | [js-tosorted-immutable](performance/js-tosorted-immutable.md) |
| `js-length-check-first` | Early Length Check for Array Comparisons          | HIGH       | Check array lengths before expensive comparisons, sorting, serialization, or deep equality. | [js-length-check-first](performance/js-length-check-first.md) |

## Code Structure

| Rule                              | Title                                          | Impact      | Summary                                                                                                                                                                                                                                                                   | Canonical file                                                                  |
| --------------------------------- | ---------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `structure-narrow-apis`           | Keep Input and Output APIs Narrow              | MEDIUM-HIGH | Split units with oversized props, arguments, or return objects; wrapping values in one object does not reduce responsibility.                                                                                                                                             | [structure-narrow-apis](structure/structure-narrow-apis.md)                     |
| `structure-derive-dont-duplicate` | Derive Props and Params, Don't Pass Duplicates | MEDIUM      | Compute a value from a param/prop already in scope instead of accepting it as a separate arg.                                                                                                                                                                             | [structure-derive-dont-duplicate](structure/structure-derive-dont-duplicate.md) |
| `structure-complex-derived-logic` | Extract Complex Derived Logic                  | MEDIUM-HIGH | Treat oversized conditions, nested ternaries, ternaries that compute instead of picking, fallback chains, and `let`-based prep as smells in render prep, hook options, request builders, config maps, and reducers alike; move them into named locals and helper returns. | [structure-complex-derived-logic](structure/structure-complex-derived-logic.md) |

## Type Safety

| Rule                       | Title                                     | Impact | Summary                                                                                                                | Canonical file                                          |
| -------------------------- | ----------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `types-no-type-assertions` | No `as` Type Assertions (Including Tests) | HIGH   | Never use `as` casts (production or tests); narrow with real guards, query generics, typed factories, or `implements`. | [types-no-type-assertions](types-no-type-assertions.md) |
| `types-no-null`            | Use undefined for Absence, Not null       | HIGH   | Model absence with optional `?`/`undefined`; convert external `null` at boundaries and keep internal types null-free.  | [types-no-null](types-no-null.md)                       |
