import type { NextConfig } from "next";
const config: NextConfig = {
  distDir: ".next",
  typescript: { tsconfigPath: "tsconfig.app.json" },
  devIndicators: false,
  agentRules: false,
};
export default config;
