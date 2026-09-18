---
'@mastra/core': patch
---

Fixed idle wake signals losing the caller's request context and misreporting their outcome when the thread had a claimed owner.

A wake that starts a run on a locally claimed owner now applies the incoming `streamOptions.requestContext` to that run. The claimed owner's own stream options were used verbatim, so a dispatcher waking a session on behalf of an authenticated caller started the run without that identity, and downstream lookups that require a caller — a workspace resolver, for example — failed. The owner's remaining options stay authoritative, since the run executes inside the owner's session.

The same path now reports `wake` instead of `deliver`. `deliver` promises that no run started locally and that the signal joined a run already in flight; callers that waited on that run, or re-sent because they believed it was still busy, never saw the work happen.

A claimed owner in another process is unchanged: the wake event carries no `requestContext`, so a remote owner still starts the run with its own options.
