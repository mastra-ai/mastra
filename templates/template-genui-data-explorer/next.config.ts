import type { NextConfig } from "next";
const config: NextConfig = {
  typescript: { tsconfigPath: "tsconfig.app.json" },
  devIndicators: false,
  agentRules: false,
};
export default config;
