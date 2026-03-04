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

To lint the markdown files, you can use `remark`:

```bash
pnpm run lint:remark
```

### Vale

In order to run `lint:vale` you need to globally install `mdx2vast`:

```bash
npm install -g mdx2vast
```

Then you can run the Vale linter:

```bash
pnpm run lint:vale
```
