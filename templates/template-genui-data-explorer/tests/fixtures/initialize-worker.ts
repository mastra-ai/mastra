import { initializeSales } from "../../scripts/initialize.ts";
import { existsSync, writeFileSync } from "node:fs";

const [path, anchor, seed, readyPath, releasePath] = process.argv.slice(2);
if (!path || !anchor || !seed) throw new Error("Worker requires path, anchor and seed.");
const metadata = await initializeSales(path, {
  now: () => {
    if (readyPath && releasePath) {
      // Both real processes must observe no canonical file before either starts generation.
      writeFileSync(readyPath, "ready");
      const deadline = Date.now() + 10000;
      const signal = new Int32Array(new SharedArrayBuffer(4));
      while (!existsSync(releasePath)) {
        if (Date.now() > deadline) throw new Error("Concurrent fixture barrier timed out.");
        Atomics.wait(signal, 0, 0, 5);
      }
    }
    return new Date(anchor);
  },
  seed: Number(seed),
});
process.stdout.write(JSON.stringify(metadata));
