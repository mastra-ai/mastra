# Docs checks

`pnpm check` runs every docs check through one command and reports each finding with a stable `mastra/` rule ID. Run it from `docs/`:

```bash
pnpm check                                  # everything, human-readable
pnpm check src/content/en/docs/agents/overview.mdx   # file-level checks for one page
pnpm check --fix                            # apply safe fixes
pnpm check --format json                         # machine-readable report
pnpm check --only links --only structure
pnpm check --rule 'mastra/sidebar-*'
pnpm check --quiet                          # errors only
pnpm check --no-vale                        # skip Vale (CI runs Vale separately on changed files)
```

The command exits `1` when any error is reported and `0` otherwise. Warnings and info findings never fail it. New rules start as warnings and become errors once existing content is clean.

With file arguments, file-level checks (frontmatter, structure, links, prose, format) only look at those files. Sidebar and redirect checks always run repo-wide. Vale is skipped with a note when its binary isn't installed; run `pnpm vale:download` first.

## JSON output

`--format json` (or `--json`) prints one object. `status` is `partial` when no errors were found but a check, usually Vale, was skipped:

```json
{
  "version": 1,
  "summary": {
    "ok": false,
    "status": "failed",
    "errors": 1,
    "warnings": 3,
    "info": 0,
    "fixable": 2,
    "fixed": 0,
    "filesChecked": 1004,
    "checks": ["frontmatter", "sidebar", "structure", "links", "prose", "format", "redirects"],
    "skipped": [],
    "durationMs": 54120
  },
  "findings": [
    {
      "ruleId": "mastra/internal-link",
      "severity": "warn",
      "category": "links",
      "message": "/docs/agents/overveiw does not resolve to a page. Did you mean /docs/agents/overview?",
      "file": "src/content/en/docs/agents/tools.mdx",
      "line": 12,
      "column": 5,
      "fixable": false,
      "suggestion": "/docs/agents/overview"
    }
  ]
}
```

`file` is relative to `docs/` and is omitted for repo-wide findings.

## Disabling a rule

Fix the finding where you can. When a page needs an exception, add an inline MDX comment next to the content, the same way you would with ESLint or remark-lint. Always name the rule IDs. A comment without IDs applies to every rule.

```mdx
{/* lint ignore mastra/bare-url */}
Send requests to https://api.example.com/v1.

{/* lint disable mastra/code-block-lang */}
...
{/* lint enable mastra/code-block-lang */}
```

- `lint ignore <ids>` turns the rules off for the next block (paragraph, list, or code fence).
- `lint disable <ids>` turns them off until a matching `lint enable <ids>` or the end of the file. If it comes before any page content, it also covers the frontmatter, so use that form for frontmatter rules such as `mastra/description-length`.
- IDs accept the same `*` prefix patterns as `--rule`, for example `mastra/vale-*`.
- Unknown IDs are reported as `mastra/lint-comment-invalid`.

Vale also honors its own `{/* vale off */}` and `{/* vale on */}` comments.

## Rules

| Rule                              | Category    | Severity | Fixable | Description                                                                                                                                           |
| --------------------------------- | ----------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mastra/frontmatter-missing`      | frontmatter | error    | No      | The page has no `---` frontmatter block.                                                                                                              |
| `mastra/frontmatter-parse`        | frontmatter | error    | No      | The frontmatter is not valid YAML.                                                                                                                    |
| `mastra/frontmatter-title`        | frontmatter | error    | No      | The frontmatter has no non-empty `title`.                                                                                                             |
| `mastra/description-required`     | frontmatter | warn     | No      | The frontmatter has no non-empty `description`.                                                                                                       |
| `mastra/description-length`       | frontmatter | warn     | No      | The `description` is shorter than 50 or longer than 200 characters.                                                                                   |
| `mastra/frontmatter-packages`     | frontmatter | error    | No      | The `packages` field is missing, empty, or lists an invalid package name.                                                                             |
| `mastra/frontmatter-packages-max` | frontmatter | warn     | No      | The `packages` field lists more than 4 packages. Each package embeds a full copy of the page.                                                         |
| `mastra/sidebar-unlinked-page`    | sidebar     | error    | No      | An MDX page is not linked from its section sidebar.                                                                                                   |
| `mastra/sidebar-reference-sort`   | sidebar     | error    | Yes     | The reference sidebar is not sorted alphabetically.                                                                                                   |
| `mastra/sidebar-duplicate-id`     | sidebar     | error    | No      | A doc ID appears more than once in the reference sidebar.                                                                                             |
| `mastra/sidebar-reference-item`   | sidebar     | warn     | No      | A reference sidebar item has an unknown type, or a property the sort fixer would drop.                                                                |
| `mastra/sidebar-new-tag-stale`    | sidebar     | warn     | No      | A sidebar `new` tag was added more than 30 days ago.                                                                                                  |
| `mastra/single-h1`                | structure   | warn     | No      | The page must have exactly one `#` heading.                                                                                                           |
| `mastra/lint-comment-invalid`     | structure   | error    | No      | An inline `lint disable`, `enable`, or `ignore` comment names an unknown rule ID.                                                                     |
| `mastra/code-block-lang`          | structure   | warn     | No      | A fenced code block has no language, e.g. ` ```typescript `.                                                                                          |
| `mastra/internal-link`            | links       | warn     | No      | An internal link points to a route that does not exist.                                                                                               |
| `mastra/redirected-link`          | links       | warn     | Yes     | An internal link points to a redirect source. The fix rewrites it to the destination.                                                                 |
| `mastra/no-self-host-url`         | links       | warn     | Yes     | A link uses `https://mastra.ai/...` for a docs route. The fix rewrites it to a root-relative path.                                                    |
| `mastra/bare-url`                 | prose       | warn     | No      | A URL appears as plain text instead of a Markdown link.                                                                                               |
| `mastra/format`                   | format      | error    | Yes     | The file is not formatted with oxfmt (MDX via `@mastra/lint-docs/oxfmt-mdx`).                                                                         |
| `mastra/redirect-duplicate`       | redirects   | error    | No      | `vercel.redirects.json` has two redirects with the same source.                                                                                       |
| `mastra/redirect-chain`           | redirects   | error    | No      | A redirect points to the source of another redirect.                                                                                                  |
| `mastra/redirect-destination`     | redirects   | error    | No      | An internal redirect destination does not resolve to a page.                                                                                          |
| `mastra/redirect-generated-drift` | redirects   | error    | Yes     | `vercel.json` is out of date with `vercel.redirects.json`. The fix regenerates it.                                                                    |
| `mastra/remark-*`                 | prose       | error    | No      | remark-lint rules from `@mastra/lint-docs/remark-preset`, e.g. `mastra/remark-heading-increment`.                                                     |
| `mastra/vale-*`                   | prose       | warn     | No      | Vale checks from `.vale.ini`, e.g. `mastra/vale-mastra-headings`. Severity follows the Vale level (error → error, warning → warn, suggestion → info). |

## Existing scripts

The individual scripts still work and are unchanged in behavior: `pnpm validate`, `pnpm validate:frontmatter`, `pnpm validate:sidebar-docs`, `pnpm validate:reference-sidebar`, `pnpm lint:remark`, `pnpm lint:vale`, `pnpm format:check`, and `pnpm generate-vercel-redirects`.
