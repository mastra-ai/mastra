# Mastra Documentation

Welcome to the home of Mastra's documentation! Everything you see on [mastra.ai/docs](https://mastra.ai/docs/) is sourced from this directory.

Want to contribute? Check out our [contribution guidelines](./CONTRIBUTING.md) for details on how to get started.

Here's a quick start to run the docs locally

- Install dependencies:

  ```bash
  pnpm install
  ```

- Start the development server:

  ```bash
  pnpm run dev
  ```

## Linting

Run every docs check (formatting, frontmatter, sidebars, structure, links, remark, Vale, and redirects) with one command:

```bash
pnpm run check
```

Add `--fix` to apply safe fixes or `--format json` for machine-readable output. See [`styleguides/CHECKS.md`](./styleguides/CHECKS.md) for every rule ID. The individual linters below still work on their own.

### Remark

To lint Markdown files according to remark rules (e.g. enforcing consistent heading levels, list markers, etc.), you can use `remark`:

```bash
pnpm run lint:remark
```

### Vale

Vale is a syntax-aware linter for prose that can help enforce style and grammar rules. We use it to maintain consistency across our documentation.

1. Run the Vale download script to fetch a binary:

   ```bash
   pnpm run vale:download
   ```

1. Then you can run the Vale linter:

   ```bash
   pnpm run lint:vale
   ```

## Agent features

### WebMCP

[WebMCP](https://webmachinelearning.github.io/webmcp/) is an experimental browser API that lets a page offer tools to an agent running in the reader's browser. Every docs page registers one tool, `search_documentation`, from [`src/theme/webmcp/`](./src/theme/webmcp/) (mounted in `src/theme/Root.tsx`).

- **Input:** `query` (string, required, at most 500 characters) and `limit` (integer, 1 to 20, default 5).
- **Result:** `{ results: [{ title, heading, url, markdownUrl, excerpt }] }`, where `url` is absolute and anchored, `markdownUrl` is the page's `.md` version (left out for `/learn` pages, which have none), and `excerpt` is plain text of at most 1,000 characters. Records for a page title or heading have no text in the index, so their excerpt is the heading path, such as `Docs > Memory > Working memory`. The tool description tells agents to fetch `markdownUrl` for the full page. Failures come back as `{ error: { code, message } }` with the code `invalid_input` or `search_failed`.
- It searches the same Algolia index as the search bar, using the `@mastra/docusaurus-plugin-algolia` credentials. Without those credentials (for example, local builds without `ALGOLIA_*` env vars) the tool isn't registered.
- Browsers without `document.modelContext` (or the older `navigator.modelContext`) skip it entirely. The tool code loads on mount when the API and the Algolia credentials exist; the search code and the Algolia client load on the first call.

To try it, build with the `ALGOLIA_APP_ID` and `ALGOLIA_SEARCH_API_KEY` env vars set, run `pnpm serve`, and open a page in a browser with WebMCP enabled. In tests, inject a `document.modelContext` stub before the page loads (for example with Playwright's `page.addInitScript`) and call the registered tool's `execute`.
