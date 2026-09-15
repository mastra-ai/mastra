# General Code

Apply these rules to backend and frontend code, shared libraries, scripts, and tests. Some examples use React, but the rules listed here also apply to ordinary functions and utilities.

## Structure

- [Keep input and output APIs narrow](rules/structure-narrow-apis.md).
- [Derive values instead of accepting duplicate parameters](rules/structure-derive-dont-duplicate.md).
- [Extract complex derived logic into named predicates or pure helpers](rules/structure-complex-derived-logic.md).

## Async Operations

- [Run independent operations concurrently with Promise.all](rules/async-parallel.md).

## JavaScript Performance

- [Use Set or Map for repeated lookups](rules/js-set-map-lookups.md).
- [Use toSorted for immutable sorting](rules/js-tosorted-immutable.md).
- [Check array lengths before comparing their contents](rules/js-length-check-first.md).
