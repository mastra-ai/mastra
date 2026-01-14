# Changeset

Create a changeset in `.changeset`, ensuring the naming convention for the changeset file is inline with other changesets in the `.changeset` folder.

The frontmatter of the changeset file should include the package names being changed, along with the type of version bump for each package:

```yaml
---
'package-name': 'type-of-bump'
---
```

Where `type-of-bump` is one of the following:

- `patch` - Bugfixes with backward-compatible changes
- `minor` - New features with backward-compatible changes
- `major` - Breaking changes that are not backward-compatible

The body of the changeset should follow these guidelines:

- The target audience are developers
- Write short, direct sentences that anyone can understand. Avoid commit messages, technical jargon, and acronyms. Use action-oriented verbs (Added, Fixed, Improved, Deprecated, Removed)
- Avoid generic phrases like "Update code", "Miscellaneous improvements", or "Bug fixes"
- Highlight outcomes! What does change for the end user? Do not focus on internal implementation details
- Add context like links to issues or PRs when relevant
- If the change is a breaking change or is adding a new feature, ensure that a code example is provided. This code example should show the public API usage (the before and after). Do not show code examples of internal implementation details.
- Keep the formatting easy-to-read and scannable. If necessary, use bullet points or multiple paragraphs (Use **bold** text as the heading for these sections, do not use markdown headings).
- For larger, more substantial changes, also answer the "Why" behind the changes
- Check that the description inside the changeset file only applies to the packages listed in the frontmatter. Do not allow descriptions that mention changes to packages not listed in the frontmatter. In these cases, you must create a separate changeset file for those packages.
