# TypeScript

## Type Safety

| Rule                       | Title                                     | Impact | Summary                                                                                                                | Canonical file                                          |
| -------------------------- | ----------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `types-no-type-assertions` | No `as` Type Assertions (Including Tests) | HIGH   | Never use `as` casts (production or tests); narrow with real guards, query generics, typed factories, or `implements`. | [types-no-type-assertions](types-no-type-assertions.md) |
| `types-no-null`            | Use undefined for Absence, Not null       | HIGH   | Model absence with optional `?`/`undefined`; convert external `null` at boundaries and keep internal types null-free.  | [types-no-null](types-no-null.md)                       |
