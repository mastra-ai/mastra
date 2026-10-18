import { writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { AnalysisResult } from "../../data-sources/source.ts";

// Deliberately expensive native SQLite work exists only in this test fixture.
process.once("message", (input: { pidPath: string; result: AnalysisResult }) => {
  const db = new DatabaseSync(":memory:", { allowExtension: false });
  writeFileSync(input.pidPath, String(process.pid));
  db.prepare(
    "WITH RECURSIVE numbers(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM numbers WHERE x<1000000000) SELECT SUM(x) FROM numbers",
  ).get();
  db.close();
  process.send?.({ ok: true, result: input.result });
});
