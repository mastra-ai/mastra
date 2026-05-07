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

## Optional: Linting

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

1. Install `mdx2vast` globally, which is a dependency for Vale to lint MDX files:

   ```bash
   npm install -g mdx2vast
   ```

1. Then you can run the Vale linter:

   ```bash
   pnpm run lint:vale
   ```
