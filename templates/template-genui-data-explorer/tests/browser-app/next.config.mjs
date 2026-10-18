import { fileURLToPath } from "node:url";
import config from "../../next.config.ts";
export default {
  ...config,
  distDir: ".next",
  typescript: { tsconfigPath: "../tsconfig.app.json" },
  turbopack: { root: fileURLToPath(new URL("../..", import.meta.url)) },
};
