# Security fix

**Reviewing:** completeness — every path that reaches the vulnerable code, not just the reported one.
**Read first:** every path to the vulnerable code, on the base, before reading the fix.
**Done means:** all paths covered; a backport plan for supported versions; disclosure handled (no details in a public PR before release, if applicable).
**Trap:** fixed the one reported path.
**Attention:** the paths you enumerate yourself. The reporter found one; your job is the rest.

## Questions

- **Enumerate the paths.** Grep every caller of the vulnerable function, every entry point that feeds it, every surface that accepts the input class (user input, network, disk, another package). Each is a path; each must be covered or shown unreachable.
- **Is the fix at the boundary or at the symptom?** Validation belongs where data enters. A fix deep inside that sanitizes one consumer leaves the others exposed.
- **Does the fix change the trust model?** New permission checks, new assumptions about who calls this.
- **Same class elsewhere?** If this is path traversal in one file handler, are there other file handlers? Injection in one query builder — other builders? The reported instance is a sample of a pattern.
- **Backport.** Which released versions are affected? Is there a plan?
- **Disclosure.** Is the PR public before a release is ready? Does the description contain a working exploit?
- **Test.** Is there a test that exercises the attack, and does it fail on base?
- **Secrets in logs / errors.** Did the fix add logging that includes the sensitive input?
- **Dependencies.** If this is a dependency bump for a CVE, is the vulnerable code path actually reachable from this repo? Is the bump minimal, or does it drag a major?

## Signals → branches

- Fix touches one call site → enumerate the others; expect a finding
- No test → request one before merge; a security fix without a red-on-base test is unverified
- Fix adds a sanitizer inside a consumer → look for the boundary; the fix probably belongs there
- Working exploit in the public PR description → flag disclosure immediately, before anything else
- Dependency bump → confirm reachability; a CVE in unreachable code is noise, not a fix

## Verify

- **Test-on-base** must be red (`archaeology.md` → Test on base).
- Caller enumeration: `archaeology.md` → Callers, for the vulnerable function and for every function that produces its input.
- Grep for the same vulnerable pattern repo-wide (the API shape, not just the function name).
- If safely reachable, reproduce the exploit on base in an isolated scratch project and confirm it fails on the branch. Record only a redacted result; never preserve dangerous exploit material in the review file.
- `gh release list` / tags to identify affected versions for the backport question.
