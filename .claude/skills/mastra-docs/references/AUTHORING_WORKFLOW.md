# Documentation authoring workflow

Use this workflow for documentation edits, reviews, moves, deletions, and new pages.

## 1. Prepare the change

- Apply `STYLEGUIDE.md` when checking source accuracy and writing.
- Use `INFORMATION_ARCHITECTURE.md` to find the canonical owner and overlapping pages.
- Read the page, neighboring pages, and relevant sidebar.
- Check recent history when the page or subsystem is changing quickly.
- Read the applicable page guide and `COMPONENTS.md` when needed.

## 2. Move pages with the repository script

Run from `docs/`:

```bash
pnpm tsx scripts/move-doc.ts /docs/old-route /docs/new-route --dry-run
pnpm tsx scripts/move-doc.ts /docs/old-route /docs/new-route
```

The script supports editable `/docs`, `/integrations`, and `/reference` routes. It updates supported sidebar IDs, inbound Markdown and MDX links, and redirects.

After the move:

- Review every changed link for natural anchor text.
- Check JSX `href` and `link` targets.
- Confirm the destination route matches the intended content family.
- Confirm no old authored links remain.
- Regenerate redirects and run a production build.

## 3. Delete or consolidate pages with the repository script

Run from `docs/`:

```bash
pnpm tsx scripts/delete-doc.ts /docs/old-page /docs/replacement --dry-run
pnpm tsx scripts/delete-doc.ts /docs/old-page /docs/replacement
```

The replacement can be a supported internal route or an HTTPS URL. The script updates inbound links, sidebars, redirects, and empty parent categories where applicable.

After deletion:

- Confirm crucial information was incorporated into the replacement.
- Review rewritten link text and anchors.
- Restore the intended sidebar item if removing a child also removed an empty category.
- Regenerate redirects and run a production build.

## 4. Maintain redirects

`vercel.redirects.json` is the authored source of truth. `vercel.json` is generated.

After changing authored redirects, run:

```bash
pnpm generate-vercel-redirects
```

The generator:

- rejects duplicate sources;
- rejects redirect chains;
- creates eligible `/llms.txt` companion redirects;
- removes fragments from generated llms-txt destinations.

Never edit generated `vercel.json` directly. Commit it only when the task includes repository changes; for an uncommitted review, leave both files in the working tree.

## 5. Verify the change

Run the narrowest checks that cover the change.

| Change                            | Minimum checks                                                          |
| --------------------------------- | ----------------------------------------------------------------------- |
| Prose-only MDX                    | Focused MDX formatting, Remark, Vale                                    |
| Frontmatter                       | Formatting and `pnpm validate`                                          |
| Sidebar                           | Formatting, `pnpm validate`, and build when routes or navigation change |
| Move or deletion                  | Focused script tests, redirects, validation, and build                  |
| Redirect                          | Redirect generator tests, generation, validation, and build             |
| MDX component or llms-txt handler | Focused Vitest tests, formatting, validation, and build                 |
| Theme or navigation behavior      | Focused unit or Playwright test and build                               |

Common commands from `docs/`:

```bash
pnpm format:mdx:check
pnpm format:check
pnpm lint:remark
pnpm lint:vale:ai
pnpm validate
pnpm test
pnpm build
```

Use focused file arguments or focused test files when supported. A production build is the final proof for route resolution, MDX compilation, and generated llms-txt output.

## 6. Review the final diff

Before handing off:

- Run `git diff --check`.
- Confirm only intended files changed.
- Check for stale route names, temporary text, debug output, and generated artifacts.
- Compare the final page against the task and source findings.
- State any unrelated failures separately rather than weakening or skipping checks.
