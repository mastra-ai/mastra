import { applyModeToEnvironment } from "../config/app-mode.mjs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

// npm starts this preload from the project root. Export an absolute URL before
// Mastra launches children from src/mastra/public or .mastra/output.
process.env.TEMPLATE_ROOT = resolve(
  fileURLToPath(new URL("..", import.meta.url)),
);
if (!Object.hasOwn(process.env, "ORIGINAL_DATABASE_URL"))
  process.env.ORIGINAL_DATABASE_URL = process.env.DATABASE_URL ?? "";
if (!Object.hasOwn(process.env, "ORIGINAL_TURSO_DATABASE_URL"))
  process.env.ORIGINAL_TURSO_DATABASE_URL =
    process.env.TURSO_DATABASE_URL ?? "";
if (!Object.hasOwn(process.env, "ORIGINAL_DEMO_DATABASE_URL"))
  process.env.ORIGINAL_DEMO_DATABASE_URL = process.env.DEMO_DATABASE_URL ?? "";
const profile = applyModeToEnvironment();
process.env.DATABASE_URL = profile.backend;
