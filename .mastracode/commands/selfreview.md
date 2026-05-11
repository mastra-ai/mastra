Critically review your own PR work before or just after opening the PR.

Review the full branch diff, not just the most recent commit. If there is already an open PR for the current branch, use `gh pr view` and `gh pr diff`. If there is not, diff the current branch against `main` instead. If you already know the PR is open from earlier in the session, do not waste time re-proving it unless you need the PR number or metadata.

Read the entire diff carefully. Do not skim. Re-read any tricky sections until you understand why they changed. When something looks subtle, risky, or surprising, read the surrounding code too and make sure the change really makes sense in context.

As you review, actively look for problems and missing work:
- bugs or logic mistakes
- missing edge cases
- unnecessary complexity
- leftover debug code, logging, TODOs, or commented-out code
- naming that could be clearer
- inconsistent patterns
- dead code or accidental churn
- missing or weak tests
- risky changes that are not obvious from the diff
- PR scope/title/body not matching the actual change
- things that technically work but still feel brittle or hard to maintain

Be skeptical. Do not rubber-stamp your own work just because you wrote it.

Make notes as you go, then produce a concise review with these sections:
- Must fix
- Risks / questions
- Suggested improvements

Call out missing things too, not just bad things that are already present in the diff.

Be specific. Reference files and lines when possible. If you are not fully sure whether something is a real bug, include it anyway as a risk or question. Focus on what should be fixed, simplified, verified, or questioned before the PR is considered ready.

Present the findings directly to the user so they can decide what to act on.

End the response with a short TLDR that lists every item again in compact bullet form, grouped by section (`Must fix`, `Risks / questions`, `Suggested improvements`). Keep the TLDR concise and scannable.
