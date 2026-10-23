## How to run the examples

Navigate to the example directory you want to run. For example:

```bash
cd examples/agent
```

Install the packages:

```bash
pnpm install --ignore-workspace
```

> The examples have a separate `package.json` file and are not part of the Mastra workspace.
> Most examples can use `npm install`.
> If an example links local workspace packages, use `pnpm install --ignore-workspace` from that example directory instead.

Run the appropriate CLI command in your terminal (may vary by example). For example for the `agent` example:

```bash
pnpm mastra:dev
```
