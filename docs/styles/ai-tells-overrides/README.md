# Mastra's project-owned Vale rules

`ai-tells-overrides` contains narrowed replacements for selected `ai-tells` rules. It flags specific clichés without prohibiting ordinary technical terminology or grammatical constructions.

The rules are maintained here rather than inside the downloaded `ai-tells` style. `docs/.vale.ini` enables `ai-tells-overrides` and disables the corresponding upstream rules. Keep this directory out of the `Packages` list so package synchronization does not manage it.

## Policy

- Allow state, lifetime, data flow, precedence, and range terminology.
- Allow question headings, meaningful contrasts, and parallel explanations of API cases.
- Prefer specific phrase patterns over open-ended subject or object matches.
- Treat subjective repetition and framing checks as suggestions, not CI errors. `ExplainerLeads`, `ShellNounCopula`, `RestatementMarkers`, and `StackedAnaphora` are advisory.
- Do not re-enable an upstream counterpart alongside its replacement.
- Do not assume a matched phrase proves AI authorship. Messages describe an editorial concern instead.

The patterns are adapted from the vendored rules in `../ai-tells/`. They are independently maintained, not automatically regenerated when the upstream package changes.

## Validation

From `docs`, run:

```sh
pnpm vale:download # Only needed if the local Vale binary is missing.
pnpm lint:vale:ai
```

`lint:vale:ai` checks the full configured rule set, including the project-owned overrides.
