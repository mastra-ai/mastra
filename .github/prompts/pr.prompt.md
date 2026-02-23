---
agent: agent
description: Create a changeset and open a pull request
---

# PR

The user will issue this command. You will need to do two things.

## Create a changeset using the CLI

Create a changeset using the CLI. The goal of changesets is to use it for generating changelogs. Individual package changelogs will later be combined into a single changelog that is published with each release.

```bash
pnpm changeset -s -m "your changeset message" (--major | --minor | --patch) pkg-name
```

For each package that has changes, run the CLI once and specify the appropriate version bump type (`--major`, `--minor`, or `--patch`) and message for that package. This will create a separate changeset file for each package, which is important for generating accurate changelogs.

**Arguments:**

- `-s` or `--skipPrompt`: Run non-interactively; requires at least one of `--major`, `--minor`, or `--patch` (required for automation)
- `-m "message"` or `--message "message"`: The changeset message (required)
- `--major pkg-name`: Packages that should have a major version bump
- `--minor pkg-name`: Packages that should have a minor version bump
- `--patch pkg-name`: Packages that should have a patch version bump

**Notes:**

- The bump type must be specified explicitly for each package; use `--major` or `--minor` for non-patch bumps
- Multiple packages can be specified by repeating the flag: `--minor @mastra/core --minor mastra`

**Version Bump Types:**

- `patch`: Bugfixes with backward-compatible changes
- `minor`: New features with backward-compatible changes
- `major`: Breaking changes that are not backward-compatible

**Message guidelines:**

- The target audience are developers
- Write short, direct sentences that anyone can understand. Avoid commit messages, technical jargon, and acronyms. Use action-oriented verbs (Added, Fixed, Improved, Deprecated, Removed)
- Avoid generic phrases like "Update code", "Miscellaneous improvements", or "Bug fixes"
- Highlight outcomes! What does change for the end user? Do not focus on internal implementation details
- Add context like links to issues or PRs when relevant
- If the change is a breaking change or is adding a new feature, ensure that a code example is provided. This code example should show the public API usage (the before and after). Do not show code examples of internal implementation details.
- Keep the formatting easy-to-read and scannable. If necessary, use bullet points or multiple paragraphs (Use **bold** text as the heading for these sections, do not use markdown headings).
- For larger, more substantial changes, also answer the "Why" behind the changes

If the changes span multiple packages (e.g. `@mastra/core`, `@mastra/memory`, `mastra`, so 3 packages) and each change is different from another, you MUST create multiple changeset files. Otherwise you'll mix different changes into changeset files where they don't belong. For this you must decide what logical groups exist. Example: The majority of the main feature was changed in `@mastra/memory` and only supporting changes were done in `@mastra/core` and `mastra`. Then `@mastra/memory` needs its own changeset separate from the others. You can achieve this by running the CLI multiple times and selecting the appropriate packages for each changeset.

**Important:** Very long changesets in one file (with multiple packages in the frontmatter) are an anti-pattern. This will lead to multiple packages having really large changelog entries. This must be avoided. If you have multiple packages likely there is one or two main packages where the majority of change lives.

## Open a PR using the GitHub CLI

Use gh cli to open a PR for the current branch in the user's browser. Do not open it directly, use the web option that opens it in the browser so the user can edit the title/description if needed.

Add a descriptive/concise title, use conventional commits in the title (e.g. "fix: title here" or "feat(pkg-name): title here").

Add a concise, humble PR description without flowery or overly verbose language.
Keep it casual/friendly but get to the point. Show simple code examples before/after for fixes, or just after examples for new features.
Do not add lists or headings. Keep it simple and to the point.
