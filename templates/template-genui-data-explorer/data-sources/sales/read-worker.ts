import { SalesSource } from "./source.ts";
import { resultRecordCount } from "../source.ts";
import type { AnalysisRequest } from "../source.ts";

function reply(message: object) {
  process.send?.(message, () => process.exit(0));
}

process.once(
  "message",
  (input: { path: string; request: AnalysisRequest; maxRows: number; maxBytes: number }) => {
    let source: SalesSource | undefined;
    try {
      source = new SalesSource(input.path);
      const result = source.executeRead(input.request);
      if (
        resultRecordCount(result) > input.maxRows ||
        Buffer.byteLength(JSON.stringify(result)) > input.maxBytes
      ) {
        reply({
          ok: false,
          code: "incomplete-result",
          message:
            "The result exceeds its row or byte limit. Narrow the analysis; partial totals are unavailable.",
        });
      } else reply({ ok: true, result });
    } catch (error) {
      reply({
        ok: false,
        code: source ? "invalid-input" : "source-unavailable",
        message:
          source && error instanceof Error
            ? error.message
            : "The Sales dataset is unavailable. Preserve the data file and check local setup before retrying.",
      });
    } finally {
      source?.close();
    }
  },
);
