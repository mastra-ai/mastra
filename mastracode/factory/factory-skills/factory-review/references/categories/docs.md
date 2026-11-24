# Docs

**Reviewing:** truth. Not prose quality — whether the claims match the code.
**Read first:** the code the docs describe, on the base (or on the branch if the docs accompany a code change).
**Done means:** material claims match the code; new or changed examples run; nothing that was true is now stated falsely.
**Trap:** reviewing prose quality instead of correctness.
**Attention:** examples and API claims. Adjectives don't matter; signatures, defaults, and behavior do.

## Questions

- **Does each claim match the code?** Every "defaults to X," "returns Y," "throws when Z" — find the line that makes it true. Docs drift from code silently and the drift is what users hit.
- **Do the examples run?** Copy each example into a scratch file, run it against the package. An example that doesn't compile is worse than no example.
- **Is anything now stale?** If the docs accompany a code change, what _else_ in the docs referenced the old behavior? Grep the docs tree for the old name/default.
- **Does it describe what, or why?** "Set `foo` to enable bar" is what. Users need "set `foo` when X; leave it off when Y because Z." Missing _why_ isn't a correctness failure, but it's the difference between docs that get read and docs that get skipped.
- **Would a user find it?** Is it in the place a user would look — next to its siblings, linked from the index?
- **Is it complete for the surface?** A new option documented without its interaction with existing options; an error case not mentioned.
- **Terminology.** Same terms as the rest of the docs and the code? A doc that calls it a "session" when the code says "thread" creates a support ticket.
- **Prose only if it's wrong.** Typos and phrasing are nits at most. Don't spend the review on them.

## Signals → branches

- Example with an import → run it; imports are where examples rot first
- A default or return type stated → find it in the code; if you can't in 30 seconds, it's probably wrong
- Docs accompany a rename or default change → grep the whole docs tree for the old term
- New feature docs with no mention of failure modes → check whether the feature has any; if it does, request that they be documented

## Verify

- Run new or changed examples in a scratch project through the public package surface; sample unchanged examples only when broad edits create uncertainty.
- For each material default/return/throw claim, find the supporting code.
- `grep -rn "<old term>" docs/` on the branch if anything was renamed.
- If the docs site has a build (`pnpm build` in the docs package), run it — broken links and MDX errors surface there.
