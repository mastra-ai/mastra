# Mechanical

Typo, formatting, lockfile, version bump, dependency bump, generated code, rename-only.

**Reviewing:** that it's _only_ that.
**Read first:** the file list and the line count. Not the content.
**Done means:** CI green; nothing else in the diff; the generated output matches the generator.
**Trap:** something real hiding in 2,000 lines of generated noise.
**Attention:** the parts that aren't mechanical. Find them, or confirm there are none.

## Questions

- **Is every hunk the same kind of change?** A formatting PR with one hunk that isn't formatting. A rename with one hunk that changes a default. Scan for the odd one out; that's the whole review.
- **Line count vs. what the change should need.** A version bump that touches 40 files — why? A typo fix that touches a lockfile — why?
- **Generated code: does it match the generator?** Regenerate and diff. Hand edits to generated files are a finding.
- **Dependency bump: what changed in the dependency?** Read the dependency's changelog between the two versions. A "patch" bump can carry a behavior change. A major bump is not mechanical — re-categorize.
- **Lockfile: is the diff explained by the `package.json` diff?** Unexplained lockfile churn is a question.
- **Rename: every caller?** A rename that misses a string reference (config key, docs, error message, a dynamic import) breaks silently.
- **Does CI actually cover it?** Formatting changes in files CI doesn't lint; generated files CI doesn't regenerate.

## Signals → branches

- One hunk that isn't the same kind as the rest → re-categorize that hunk under its real category; the mixing is itself a finding (it hid a real change in noise)
- Dependency major bump → not mechanical; load `behavior-change.md` and read the dependency's migration guide
- Generated file with no generator run in the commit list → regenerate and diff
- Rename with fewer callers updated than the grep finds → request the missing callers before merge

## Verify

- Categorize every hunk by kind: `git diff <base>...HEAD --stat` then skim each file's diff for the odd hunk.
- Generated code: run the generator on the branch; `git status` should be clean.
- Dependency bump: `gh api repos/<dep-owner>/<dep-repo>/releases` or the package's CHANGELOG for the range; note anything behavioral.
- Rename: grep the old name repo-wide on the branch, including docs, config, and string literals.
- CI green: `gh pr checks`.

Most mechanical PRs produce a handoff of Triage + Verdict. That's correct, not lazy.
