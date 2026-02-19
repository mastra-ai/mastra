# Changeset

Create a changeset using the CLI. The CLI will automatically detect changed packages and create the changeset file.

## CLI Usage

```bash
pnpm changeset -s -m "your changeset message" [--major pkg1] [--minor pkg2] [--patch pkg3]
```

**Arguments:**

- `-s` or `--skipPrompt` - Run non-interactively (required for automation)
- `-m "message"` or `--message "message"` - The changeset message (required)
- `--major @scope/pkg` - Packages that should have a major version bump
- `--minor @scope/pkg` - Packages that should have a minor version bump
- `--patch @scope/pkg` - Packages that should have a patch version bump (default for detected changes)

**Notes:**

- The CLI auto-detects changed packages from git and defaults them to `patch` bumps
- You can override the bump type by specifying `--major` or `--minor` for specific packages
- Multiple packages can be specified by repeating the flag: `--minor @mastra/core --minor mastra`

## Version Bump Types

- `patch` - Bugfixes with backward-compatible changes
- `minor` - New features with backward-compatible changes
- `major` - Breaking changes that are not backward-compatible

## Message Guidelines

- The target audience are developers
- Write short, direct sentences that anyone can understand. Avoid commit messages, technical jargon, and acronyms. Use action-oriented verbs (Added, Fixed, Improved, Deprecated, Removed)
- Avoid generic phrases like "Update code", "Miscellaneous improvements", or "Bug fixes"
- Highlight outcomes! What does change for the end user? Do not focus on internal implementation details
- Add context like links to issues or PRs when relevant
- If the change is a breaking change or is adding a new feature, ensure that a code example is provided. This code example should show the public API usage (the before and after). Do not show code examples of internal implementation details.
- Keep the formatting easy-to-read and scannable. If necessary, use bullet points or multiple paragraphs (Use **bold** text as the heading for these sections, do not use markdown headings).
- For larger, more substantial changes, also answer the "Why" behind the changes

If the changes span multiple packages (e.g. `@mastra/core`, `@mastra/memory`, `mastra`, so 3 packages) and each change is different from another, you MUST create multiple changeset files. Otherwise you'll mix different changes into changeset files where they don't belong. For this you must decide what logical groups exist. Example: The majority of the main feature was changed in `@mastra/memory` and only supporting changes were done in `@mastra/core` and `mastra`. Then `@mastra/memory` needs its own changeset separate from the others. You can achieve this by running the CLI multiple times and selecting the appropriate packages for each changeset.

**Important:** Very long changesets in one file (with multiple packages in the frontmatter) are an anti-pattern. This will lead to multiple packages having really large changelog entries. This must be avoided.
