import { defineConfig } from "tsup"

export default defineConfig({
    entry: [
        "src/main.ts",
        "src/index.ts",
        "src/tools/index.ts",
        "src/agents/index.ts",
    ],
    splitting: true,
    format: ["esm"],
    clean: true,
    dts: false,
    sourcemap: true,
    target: "es2022",
    outDir: "dist",
    external: [
        "@mastra/core",
        "@ai-sdk/anthropic",
        "@ai-sdk/openai",
        "@mariozechner/pi-tui",
        "ai",
        "chalk",
        "cli-highlight",
        "execa",
        "fastest-levenshtein",
        "js-tiktoken",
        "strip-ansi",
        "tree-kill",
        "zod",
    ],
})
