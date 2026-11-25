# Narrowed copies of `write-good` Vale rules

`write-good` is installed by `vale sync`, so edits inside `styles/write-good/` are
overwritten the next time packages are synchronized. Rule changes that Mastra wants to
keep live here instead: `docs/.vale.ini` enables `write-good-overrides`, disables the
upstream rule it replaces, and keeps this directory out of `Packages`.

## Current overrides

- `Weasel.yml` replaces `write-good.Weasel`. Frequency and quantity words (`several`,
  `usually`, `mostly`, `various`, `substantially`, `relatively`, `significantly`,
  `largely`, `fairly`) are removed from the token list because they describe real
  behavior in technical documentation. Replacing them either loses information or
  invents false precision. Intensifiers and subjective praise (`very`, `excellent`,
  `completely`, `clearly`) are still flagged.

## Maintenance

- Do not re-enable an upstream rule alongside its replacement.
- Re-read the upstream rule after a `vale sync` that bumps `write-good`; port any new
  tokens that Mastra genuinely wants, and record the reason in the rule comment.
