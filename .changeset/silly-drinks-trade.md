---
'@mastra/factory': minor
---

Removed the unused `sandboxProvider` field from linked project repositories. Factory always uses the sandbox you configure, so the stored value was never read, and the GitHub and GitLab repository listings only ever filled it with `custom` or `none`.

- Linking or updating a project repository no longer accepts `sandboxProvider`, and project repository responses no longer include it.
- The GitHub and GitLab repository listings used during setup no longer include `sandboxProvider`.
- New factories no longer create the `sandbox_provider` column. Existing factories keep the column and its stored values, and Factory simply stops writing it.

**Upgrading**

Update `mastra` together with `@mastra/factory`. The Factory UI ships with `mastra`, and repository linking fails when one of the two is older than the other.
