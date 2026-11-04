import { SalesSource, salesRequestSchema } from "./source.ts";
import { SourceError, resultRecordCount } from "../source.ts";

function reply(message: object) {
  process.send?.(message, () => process.exit(0));
}

process.once(
  "message",
  (input: { path: string; request: unknown; maxRows: number; maxBytes: number }) => {
    let source: SalesSource | undefined;
    try {
      const request = salesRequestSchema.safeParse(input.request);
      if (!request.success) {
        reply({
          ok: false,
          code: "invalid-input",
          message: request.error.issues[0]?.message ?? "Invalid Sales request.",
        });
        return;
      }
      source = new SalesSource(input.path);
      const result = source.executeRead(request.data);
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
      const invalid = source && error instanceof SourceError && error.code === "invalid-input";
      reply({
        ok: false,
        code: invalid ? "invalid-input" : "source-unavailable",
        message: invalid
          ? error.message
          : "The Sales dataset is unavailable. Preserve the data file and check local setup before retrying.",
      });
    } finally {
      source?.close();
    }
  },
);
