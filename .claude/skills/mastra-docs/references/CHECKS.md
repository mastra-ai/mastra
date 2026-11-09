# Docs checks

`pnpm check` runs every docs check through one command and reports each finding with a stable `mastra/` rule ID. Run it from `docs/`:

```bash
pnpm check                                  # everything, human-readable
pnpm check src/content/en/docs/agents/overview.mdx   # file-level checks for one page
pnpm check --fix                            # apply safe fixes
pnpm check --json                           # machine-readable report
pnpm check --category links --category structure
pnpm check --rule 'mastra/link-*'
pnpm check --quiet                          # errors only
pnpm check --no-vale                        # skip Vale (CI runs Vale separately on changed files)
```

The command exits `1` when any error is reported and `0` otherwise. Warnings and info findings never fail it. New rules start as warnings and become errors once existing content is clean.

With file arguments, file-level checks (frontmatter, structure, links, prose, format) only look at those files. Sidebar and redirect checks always run repo-wide. Vale is skipped with a note when its binary isn't installed; run `pnpm vale:download` first.

## JSON output

`--json` prints one object:

```json
{
  "version": 1,
  "summary": {
    "ok": false,
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
      "ruleId": "mastra/link-broken",
      "severity": "warning",
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

## Disabling a rule on one page

List rule IDs in the page's `lintDisable` frontmatter. Unknown IDs are reported as `mastra/lint-disable-invalid`.

```yaml
---
title: 'Example'
description: 'An example page that intentionally shows bare URLs in prose.'
packages:
  - '@mastra/core'
lintDisable:
  - mastra/bare-url
  - mastra/vale-mastra-headings
---
```

## Rules

| Rule                                    | Category    | Severity | Fixable | Description                                                                                                                                              |
| --------------------------------------- | ----------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mastra/frontmatter-missing`            | frontmatter | error    | No      | The page has no `---` frontmatter block.                                                                                                                 |
| `mastra/frontmatter-parse`              | frontmatter | error    | No      | The frontmatter is not valid YAML.                                                                                                                       |
| `mastra/frontmatter-title`              | frontmatter | error    | No      | The frontmatter has no non-empty `title`.                                                                                                                |
| `mastra/frontmatter-description`        | frontmatter | warning  | No      | The frontmatter has no non-empty `description`.                                                                                                          |
| `mastra/frontmatter-description-length` | frontmatter | warning  | No      | The `description` is shorter than 50 or longer than 200 characters.                                                                                      |
| `mastra/frontmatter-packages`           | frontmatter | error    | No      | The `packages` field is missing, empty, or lists an invalid package name.                                                                                |
| `mastra/frontmatter-packages-max`       | frontmatter | warning  | No      | The `packages` field lists more than 4 packages. Each package embeds a full copy of the page.                                                            |
| `mastra/lint-disable-invalid`           | frontmatter | error    | No      | `lintDisable` is not a list of known rule IDs.                                                                                                           |
| `mastra/sidebar-unlinked-page`          | sidebar     | error    | No      | An MDX page is not linked from its section sidebar.                                                                                                      |
| `mastra/sidebar-reference-sort`         | sidebar     | error    | Yes     | The reference sidebar is not sorted alphabetically.                                                                                                      |
| `mastra/sidebar-duplicate-id`           | sidebar     | error    | No      | A doc ID appears more than once in the reference sidebar.                                                                                                |
| `mastra/sidebar-reference-item`         | sidebar     | warning  | No      | A reference sidebar item has an unknown type, or a property the sort fixer would drop.                                                                   |
| `mastra/sidebar-stale-new-tag`          | sidebar     | warning  | No      | A sidebar `new` tag was added more than 30 days ago.                                                                                                     |
| `mastra/single-h1`                      | structure   | warning  | No      | The page must have exactly one `#` heading.                                                                                                              |
| `mastra/code-block-language`            | structure   | warning  | No      | A fenced code block has no language, e.g. ` ```typescript `.                                                                                             |
| `mastra/link-broken`                    | links       | warning  | No      | An internal link points to a route that does not exist.                                                                                                  |
| `mastra/link-redirected`                | links       | warning  | Yes     | An internal link points to a redirect source. The fix rewrites it to the destination.                                                                    |
| `mastra/link-self-host`                 | links       | warning  | Yes     | A link uses `https://mastra.ai/...` for a docs route. The fix rewrites it to a root-relative path.                                                       |
| `mastra/bare-url`                       | prose       | warning  | No      | A URL appears as plain text instead of a Markdown link.                                                                                                  |
| `mastra/format`                         | format      | error    | Yes     | The file is not formatted with oxfmt (MDX via `@mastra/lint-docs/oxfmt-mdx`).                                                                            |
| `mastra/redirect-duplicate`             | redirects   | error    | No      | `vercel.redirects.json` has two redirects with the same source.                                                                                          |
| `mastra/redirect-chain`                 | redirects   | error    | No      | A redirect points to the source of another redirect.                                                                                                     |
| `mastra/redirect-destination`           | redirects   | error    | No      | An internal redirect destination does not resolve to a page.                                                                                             |
| `mastra/redirect-generated-drift`       | redirects   | error    | Yes     | `vercel.json` is out of date with `vercel.redirects.json`. The fix regenerates it.                                                                       |
| `mastra/remark-*`                       | prose       | error    | No      | remark-lint rules from `@mastra/lint-docs/remark-preset`, e.g. `mastra/remark-heading-increment`.                                                        |
| `mastra/vale-*`                         | prose       | warning  | No      | Vale checks from `.vale.ini`, e.g. `mastra/vale-mastra-headings`. Severity follows the Vale level (error → error, warning → warning, suggestion → info). |

## Existing scripts

The individual scripts still work and are unchanged in behavior: `pnpm validate`, `pnpm validate:frontmatter`, `pnpm validate:sidebar-docs`, `pnpm validate:reference-sidebar`, `pnpm lint:remark`, `pnpm lint:vale`, `pnpm format:check`, and `pnpm generate-vercel-redirects`.
