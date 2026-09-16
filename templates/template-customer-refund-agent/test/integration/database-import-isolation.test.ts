import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { caseStore } from "../../src/mastra/lib/case-store";

describe("database initialization during test imports", () => {
  it("uses a disposable local database after replacing inherited configuration", async () => {
    const databaseDirectory = process.env.PHASE001_TEST_DATABASE_DIRECTORY;
    const databaseUrl = process.env.PHASE001_TEST_DATABASE_URL;
    const inheritedDatabaseSentinel =
      process.env.PHASE001_TEST_INHERITED_DATABASE_SENTINEL_PATH;
    const inheritedLegacyDatabaseSentinel =
      process.env.PHASE001_TEST_INHERITED_LEGACY_DATABASE_SENTINEL_PATH;

    expect(process.env.PHASE001_TEST_INHERITED_DATABASE_SENTINEL).toBe(
      "present",
    );
    expect(databaseDirectory).toMatch(/phase001-vitest-/);
    expect(process.env.DATABASE_URL).toBe(databaseUrl);
    expect(process.env.TURSO_DATABASE_URL).toBe(databaseUrl);
    expect(process.env.TURSO_AUTH_TOKEN).toBeUndefined();
    expect(inheritedDatabaseSentinel).toMatch(/phase001-vitest-inherited-/);
    expect(existsSync(inheritedDatabaseSentinel)).toBe(false);
    expect(inheritedLegacyDatabaseSentinel).toMatch(
      /phase001-vitest-inherited-legacy-sentinel-/,
    );
    expect(existsSync(inheritedLegacyDatabaseSentinel)).toBe(false);

    await caseStore.list();

    expect(existsSync(databaseUrl!.replace("file:", ""))).toBe(true);
    expect(existsSync(inheritedDatabaseSentinel)).toBe(false);
    expect(existsSync(inheritedLegacyDatabaseSentinel)).toBe(false);
  });
});
