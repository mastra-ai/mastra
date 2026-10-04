import { resolve } from "node:path";
import { createExplorer } from "../src/mastra/index.ts";
import { analysisServer } from "../src/analysis/server.ts";

if (!process.env.OPENAI_API_KEY)
  throw new Error(
    "Set OPENAI_API_KEY on the server for interactive analysis. Deterministic tests and data commands need no key.",
  );
const explorer = await createExplorer({
  settings: { path: resolve(process.env.SALES_DATA_PATH ?? ".data/sales.sqlite") },
});
const server = analysisServer(explorer);
const port = Number(process.env.PORT ?? 4111);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("PORT must be a valid local port.");
server.listen(port, "127.0.0.1", () =>
  console.log(`Local analysis endpoint: http://127.0.0.1:${port}/analysis`),
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () =>
    server.close(() => {
      void explorer.close();
    }),
  );
