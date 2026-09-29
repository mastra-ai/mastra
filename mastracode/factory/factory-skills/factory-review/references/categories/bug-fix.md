# Bug fix

**Reviewing:** a causal claim — "X was the cause, and this removes it."
**Read first:** the issue and its repro → the test → the diff. Never the diff first.
**Done means:** you believe the cause; the fix lives at the cause; the evidence distinguishes the regression from working behavior.
**Trap:** symptom patch; "why now" unanswered.
**Attention:** the cause, not the code. The code is judged by whether it addresses the cause you independently arrived at.

## Questions

- **Where does the value first become wrong?** The tell is _where_ the fix lives relative to where the bug was _observed_. A fix at the observation site — a null check where it crashed, a `?.`, a re-sort before display, a retry around the failing call — is almost always a symptom patch. Ask _why_ was the value null / out of order / failing, and follow the data backwards until you find where it _became_ wrong. That's where the fix belongs.
- **Does this make the bug impossible, or just unobserved here?** If the same bad state can reach another consumer, it's a patch.
- **Why now?** Bugs have a cause. Either the code was always wrong (then why did it work before — what assumption changed?) or something changed (which commit — `git log -S`, bisect). A real fix can name the cause. "It was broken so I made it not broken" can't.
- **Does your theory match theirs?** Your prediction included your own theory of the cause. If the author's fix is somewhere other than where your theory says the value goes wrong, one of you is wrong, and finding out which is the review's first job.
- **Is the fix more defensive, or more correct?** More checks, more fallbacks, more catch blocks — correct code has fewer branches, not more. A fix that adds branches is a symptom patch until proven otherwise.
- **Did the fix turn a loud failure into a silent one?** A swallowing try/catch or a masking default that makes the symptom disappear without fixing the state.
- **Would the test have failed before the fix?** For a bug fix this is the central test question. Establish the counterfactual from the assertion and base implementation; code reasoning is enough when the answer is deterministic. Green on base means the test proves nothing, but executing on base is useful only when the answer remains uncertain.
- **Does the test name match the claim?** "Fixes ordering under concurrent writes" → is there a test with concurrent writes, or one write that checks order? The gap between claim and test scope is where the bugs live.
- **What does the assertion actually assert?** `toBeDefined()`, `toHaveBeenCalled()`, `not.toThrow()` pass for almost any implementation. A real test asserts the specific value or behavior.
- **Is the code under test the real code?** If the thing being fixed is mocked out, the test is testing the mock.
- **Who else calls the changed function?** The author fixed it for their caller. Do the others still work?

## Signals → branches

- Fix lives at the observation site (null check, `?.`, retry, re-sort) → trace the data backwards to where it becomes wrong; that's the finding
- Fix adds branches rather than removing them → symptom patch until proven otherwise
- Description can't name the cause, only the symptom → "why now" is unanswered; go deep on history
- Old, stable code → deep history; something changed, find the commit
- Test asserts weakly or mocks the fixed module → run test-on-base; expect it to be green (i.e. useless)
- The same pattern (e.g. the same null check) appears in more than one place in the diff → the fix is at the consumers, not the source

## Verify

- **test-on-base** (`archaeology.md` → Test on base): use it when the regression test is central and code reasoning cannot establish whether it distinguishes the bug—for example, weak assertions, mocked paths, concurrency, integration behavior, or multiple code paths that could satisfy it. Green means it does not distinguish the regression; whether that blocks depends on what other evidence proves the fix.
- Use `git log -S "<removed or changed string>"` when a deletion or condition change has unclear history.
- Account for callers whose behavior could change.
- If the issue has a useful repro, run it on base and on the branch and record the observed difference.
