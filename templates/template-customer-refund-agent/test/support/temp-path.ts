import { tmpdir } from "node:os";
import { join } from "node:path";

/** A portable per-test SQLite path. */
export function temporaryDatabasePath(prefix: string) {
  return join(tmpdir(), `${prefix}-${crypto.randomUUID()}.db`);
}
