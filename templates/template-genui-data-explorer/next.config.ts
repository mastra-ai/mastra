import type { NextConfig } from "next";
const config: NextConfig = {
  distDir: process.env.NEXT_DIST_DIRECTORY ?? ".next",
  typescript: { tsconfigPath: process.env.NEXT_TSCONFIG_PATH ?? "tsconfig.app.json" },
  devIndicators: false,
  agentRules: false,
};
export default config;
