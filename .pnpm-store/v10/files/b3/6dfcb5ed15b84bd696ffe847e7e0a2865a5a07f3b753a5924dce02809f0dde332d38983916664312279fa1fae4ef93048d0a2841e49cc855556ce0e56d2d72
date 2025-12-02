import { vi, test, expect, beforeEach, MockInstance, beforeAll } from "vitest";
import {
  parseProjectConfig,
  ProjectConfig,
  writeProjectConfig,
  readProjectConfig,
  resetUnknownKeyWarnings,
} from "./config.js";
import { Context, oneoffContext } from "../../bundler/context.js";
import { logFailure } from "../../bundler/log.js";
import { stripVTControlCharacters } from "util";

let ctx: Context;
let stderrSpy: MockInstance;

beforeAll(async () => {
  stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
});

beforeEach(async () => {
  const originalContext = await oneoffContext({
    url: undefined,
    adminKey: undefined,
    envFile: undefined,
  });
  ctx = {
    ...originalContext,
    crash: (args: { printedMessage: string | null }) => {
      if (args.printedMessage !== null) {
        logFailure(args.printedMessage);
      }
      throw new Error();
    },
  };
  stderrSpy.mockClear();
  resetUnknownKeyWarnings(); // Reset warning state between tests
});

const assertParses = async (
  inp: Record<string, any>,
  expected?: ProjectConfig,
) => {
  const result = await parseProjectConfig(ctx, inp);
  expect(result).toEqual(expected ?? inp);
};

const assertParseError = async (inp: any, err: string) => {
  stderrSpy.mockClear();
  await expect(parseProjectConfig(ctx, inp)).rejects.toThrow();
  const calledWith = stderrSpy.mock.calls as string[][];
  expect(stripVTControlCharacters(calledWith[0][0])).toEqual(err);
};

test("parseProjectConfig basic valid configs", async () => {
  await assertParses(
    {
      functions: "functions/",
    },
    {
      functions: "functions/",
      // default values (note that node version *has no default*
      node: { externalPackages: [] },
      generateCommonJSApi: false,
      codegen: { staticApi: false, staticDataModel: false },
    },
  );

  await assertParses(
    {
      functions: "functions/",

      // unknown property
      futureFeature: 123,

      // deprecated
      team: "team",
      project: "proj",
      prodUrl: "prodUrl",
      authInfo: [
        {
          applicationID: "hello",
          domain: "world",
        },
      ],
    },
    {
      functions: "functions/",
      // default values
      node: { externalPackages: [] },
      generateCommonJSApi: false,
      codegen: { staticApi: false, staticDataModel: false },

      // unknown properties are preserved
      ...({ futureFeature: 123 } as any),

      // deprecated
      team: "team",
      project: "proj",
      prodUrl: "prodUrl",
      authInfo: [
        {
          applicationID: "hello",
          domain: "world",
        },
      ],
    },
  );
});

test("parseProjectConfig - node defaults", async () => {
  // No node field -> gets defaulted
  await assertParses(
    {},
    {
      functions: "convex/",
      node: { externalPackages: [] },
      generateCommonJSApi: false,
      codegen: { staticApi: false, staticDataModel: false },
    },
  );

  // node exists but externalPackages missing -> gets defaulted
  await assertParses(
    { node: { extraField: 123 } },
    {
      functions: "convex/",
      node: { externalPackages: [], ...{ extraField: 123 } },
      generateCommonJSApi: false,
      codegen: { staticApi: false, staticDataModel: false },
    },
  );

  // node with nodeVersion but no externalPackages
  await assertParses(
    { node: { nodeVersion: "18", extraField: 123 } },
    {
      functions: "convex/",
      node: { externalPackages: [], nodeVersion: "18", ...{ extraField: 123 } },
      generateCommonJSApi: false,
      codegen: { staticApi: false, staticDataModel: false },
    },
  );
});

test("parseProjectConfig - node validation errors", async () => {
  await assertParseError(
    { node: { externalPackages: "not-an-array" } },
    "✖ `node.externalPackages` in `convex.json`: Expected array, received string\n",
  );

  await assertParseError(
    { node: { externalPackages: [123] } },
    "✖ `node.externalPackages.0` in `convex.json`: Expected string, received number\n",
  );

  await assertParseError(
    { node: { nodeVersion: 18 } },
    "✖ `node.nodeVersion` in `convex.json`: Expected string, received number\n",
  );
});

test("parseProjectConfig - codegen fields", async () => {
  // fileType with valid values
  await assertParses(
    { codegen: { fileType: "ts" } },
    {
      functions: "convex/",
      node: { externalPackages: [] },
      generateCommonJSApi: false,
      codegen: { staticApi: false, staticDataModel: false, fileType: "ts" },
    },
  );

  await assertParses(
    { codegen: { fileType: "js/dts" } },
    {
      functions: "convex/",
      node: { externalPackages: [] },
      generateCommonJSApi: false,
      codegen: { staticApi: false, staticDataModel: false, fileType: "js/dts" },
    },
  );

  // legacyComponentApi
  await assertParses(
    { codegen: { legacyComponentApi: false } },
    {
      functions: "convex/",
      node: { externalPackages: [] },
      generateCommonJSApi: false,
      codegen: {
        staticApi: false,
        staticDataModel: false,
        legacyComponentApi: false,
      },
    },
  );

  await assertParses(
    { codegen: { legacyComponentApi: true } },
    {
      functions: "convex/",
      node: { externalPackages: [] },
      generateCommonJSApi: false,
      codegen: {
        staticApi: false,
        staticDataModel: false,
        legacyComponentApi: true,
      },
    },
  );
});

test("parseProjectConfig - codegen validation errors", async () => {
  // Invalid fileType value
  await assertParseError(
    { codegen: { fileType: "invalid" } },
    "✖ `codegen.fileType` in `convex.json`: Invalid enum value. Expected 'ts' | 'js/dts', received 'invalid'\n",
  );

  // Invalid legacyComponentApi type
  await assertParseError(
    { codegen: { legacyComponentApi: "yes" } },
    "✖ `codegen.legacyComponentApi` in `convex.json`: Expected boolean, received string\n",
  );

  // Cross-field validation: generateCommonJSApi: true with fileType: "ts" should fail
  await assertParseError(
    { generateCommonJSApi: true, codegen: { fileType: "ts" } },
    '✖ `generateCommonJSApi` in `convex.json`: Cannot use `generateCommonJSApi: true` with `codegen.fileType: "ts"`. CommonJS modules require JavaScript generation. Either set `codegen.fileType: "js/dts"` or remove `generateCommonJSApi`.\n',
  );
});

test("parseProjectConfig - top-level validation", async () => {
  await assertParseError(
    "not-an-object",
    "✖ Expected `convex.json` to contain an object\n",
  );
  await assertParseError(
    123,
    "✖ Expected `convex.json` to contain an object\n",
  );
  await assertParseError(
    null,
    "✖ Expected `convex.json` to contain an object\n",
  );
  await assertParseError(
    [],
    "✖ Expected `convex.json` to contain an object\n",
  );
});

test("writeProjectConfig strips defaults hierarchically", async () => {
  let writtenContent = "";
  const testCtx = {
    ...ctx,
    fs: {
      ...ctx.fs,
      exists: (path: string) => path === "convex.json",
      writeUtf8File: (_path: string, content: string) => {
        writtenContent = content;
      },
      mkdir: () => {},
    },
  };

  // Test full defaults - no file written when all defaults
  const fullDefaults: ProjectConfig = {
    functions: "convex/",
    node: { externalPackages: [] },
    generateCommonJSApi: false,
    codegen: { staticApi: false, staticDataModel: false },
  };

  await writeProjectConfig(testCtx, fullDefaults);
  // When all defaults are stripped, no file is written
  expect(writtenContent).toBe("");

  // - node should be stripped
  // - extra fields should pass through
  const partialNode: ProjectConfig = {
    functions: "my-functions/",
    node: { externalPackages: [] }, // All defaults
    generateCommonJSApi: true,
    codegen: { staticApi: false, staticDataModel: false },

    ...{ extraField: 123 },
  };

  await writeProjectConfig(testCtx, partialNode);
  const written2 = JSON.parse(writtenContent);
  expect(written2.node).toBeUndefined(); // Stripped
  expect(written2.functions).toBe("my-functions/");
  expect(written2.generateCommonJSApi).toBe(true);
  expect(written2.codegen).toBeUndefined(); // All false, so stripped
  expect(written2.extraField).toBe(123); // preserved

  // Test hierarchical - codegen partially set
  const partialCodegen: ProjectConfig = {
    functions: "convex/",
    node: { externalPackages: [], nodeVersion: "18" },
    generateCommonJSApi: false,
    codegen: { staticApi: true, staticDataModel: false },
  };

  await writeProjectConfig(testCtx, partialCodegen);
  const written3 = JSON.parse(writtenContent);
  expect(written3.codegen).toEqual({ staticApi: true }); // false stripped
  expect(written3.node).toEqual({ nodeVersion: "18" }); // externalPackages stripped
});

test("writeProjectConfig - filters deprecated fields", async () => {
  let writtenContent = "";
  const testCtx = {
    ...ctx,
    fs: {
      ...ctx.fs,
      exists: (path: string) => path === "convex.json",
      writeUtf8File: (_path: string, content: string) => {
        writtenContent = content;
      },
      mkdir: () => {},
    },
  };

  const withDeprecated: ProjectConfig = {
    functions: "my-functions/", // Non-default to ensure writing
    node: { externalPackages: [] },
    generateCommonJSApi: false,
    codegen: { staticApi: false, staticDataModel: false },
    project: "my-project",
    team: "my-team",
    prodUrl: "https://example.com",
  };

  await writeProjectConfig(testCtx, withDeprecated);
  const written = JSON.parse(writtenContent);
  // Deprecated fields should not be written
  expect(written.project).toBeUndefined();
  expect(written.team).toBeUndefined();
  expect(written.prodUrl).toBeUndefined();
  // But non-deprecated fields should be written
  expect(written.functions).toBe("my-functions/");
});

test("writeProjectConfig - preserves optional codegen fields", async () => {
  let writtenContent = "";
  const testCtx = {
    ...ctx,
    fs: {
      ...ctx.fs,
      exists: (path: string) => path === "convex.json",
      writeUtf8File: (_path: string, content: string) => {
        writtenContent = content;
      },
      mkdir: () => {},
    },
  };

  // fileType and legacyComponentApi should NOT be stripped even when explicitly set
  const withOptionalFields: ProjectConfig = {
    functions: "my-functions/", // Non-default to ensure writing
    node: { externalPackages: [] },
    generateCommonJSApi: false,
    codegen: {
      staticApi: false,
      staticDataModel: false,
      fileType: "ts",
      legacyComponentApi: false,
    },
  };

  await writeProjectConfig(testCtx, withOptionalFields);
  const written = JSON.parse(writtenContent);
  // fileType and legacyComponentApi should be preserved even though staticApi/staticDataModel are stripped
  expect(written.codegen).toEqual({
    fileType: "ts",
    legacyComponentApi: false,
  });
  expect(written.functions).toBe("my-functions/");
});

test("readProjectConfig - returns defaults when file doesn't exist", async () => {
  const testCtx = {
    ...ctx,
    fs: {
      ...ctx.fs,
      exists: () => false,
      readUtf8File: (path: string) => {
        // Mock package.json without react-scripts
        if (path === "package.json") {
          return JSON.stringify({ name: "test-app" });
        }
        throw new Error(`Unexpected read: ${path}`);
      },
    },
  };

  const { projectConfig, configPath } = await readProjectConfig(testCtx);

  expect(configPath).toBe("convex.json");
  expect(projectConfig).toEqual({
    functions: "convex/",
    node: { externalPackages: [] },
    generateCommonJSApi: false,
    codegen: { staticApi: false, staticDataModel: false },
  });
});

test("read-write-read - deprecated fields are removed", async () => {
  // Helper to test that reading, writing, and reading again cleans up deprecated fields
  const assertCleansUpDeprecated = async (
    rawJson: any,
    expectedAfterCleanup: ProjectConfig,
  ) => {
    let writtenContent: string | null = null;
    let hasBeenWritten = false;
    const testCtx = {
      ...ctx,
      fs: {
        ...ctx.fs,
        exists: (path: string) => {
          if (path === "convex.json") {
            // File exists initially (with deprecated fields), and after writing if content was written
            return !hasBeenWritten || writtenContent !== null;
          }
          if (path === "package.json") {
            return true;
          }
          return false;
        },
        readUtf8File: (path: string) => {
          if (path === "convex.json") {
            if (!hasBeenWritten) {
              // First read - return the raw JSON with deprecated fields
              return JSON.stringify(rawJson);
            }
            // Second read - return what was written
            if (writtenContent === null) {
              throw new Error("File doesn't exist");
            }
            return writtenContent;
          }
          if (path === "package.json") {
            return JSON.stringify({ name: "test-app" });
          }
          throw new Error(`Unexpected read: ${path}`);
        },
        writeUtf8File: (_path: string, content: string) => {
          writtenContent = content;
          hasBeenWritten = true;
        },
        mkdir: () => {},
      },
    };

    // First read - should parse deprecated fields but keep them
    const { projectConfig: firstRead } = await readProjectConfig(testCtx);

    // Write it
    await writeProjectConfig(testCtx, firstRead);

    // Read again - deprecated fields should be gone
    const { projectConfig: secondRead } = await readProjectConfig(testCtx);

    expect(secondRead).toEqual(expectedAfterCleanup);
  };

  // Test 1: Config with all deprecated fields
  await assertCleansUpDeprecated(
    {
      functions: "my-functions/",
      project: "my-project",
      team: "my-team",
      prodUrl: "https://example.com",
    },
    {
      functions: "my-functions/",
      node: { externalPackages: [] },
      generateCommonJSApi: false,
      codegen: { staticApi: false, staticDataModel: false },
    },
  );

  // Test 2: Config with deprecated fields AND non-default values
  await assertCleansUpDeprecated(
    {
      functions: "backend/",
      project: "my-project",
      team: "my-team",
      prodUrl: "https://example.com",
      node: { externalPackages: ["axios"], nodeVersion: "20" },
      generateCommonJSApi: true,
    },
    {
      functions: "backend/",
      node: { externalPackages: ["axios"], nodeVersion: "20" },
      generateCommonJSApi: true,
      codegen: { staticApi: false, staticDataModel: false },
    },
  );

  // Test 3: Config with authInfo (deprecated but still written if non-empty)
  await assertCleansUpDeprecated(
    {
      authInfo: [{ applicationID: "app123", domain: "example.com" }],
      project: "my-project",
    },
    {
      functions: "convex/",
      node: { externalPackages: [] },
      generateCommonJSApi: false,
      codegen: { staticApi: false, staticDataModel: false },
      authInfo: [{ applicationID: "app123", domain: "example.com" }],
    },
  );

  // Test 4: Config with empty authInfo (should be stripped like other defaults)
  await assertCleansUpDeprecated(
    {
      functions: "my-functions/",
      authInfo: [],
      project: "my-project",
    },
    {
      functions: "my-functions/",
      node: { externalPackages: [] },
      generateCommonJSApi: false,
      codegen: { staticApi: false, staticDataModel: false },
      // authInfo should be gone since it was empty
    },
  );
});

test("roundtrip - write then read gives same config", async () => {
  // Helper function to test roundtrip
  const assertRoundtrips = async (config: ProjectConfig) => {
    let writtenContent: string | null = null;
    const testCtx = {
      ...ctx,
      fs: {
        ...ctx.fs,
        exists: (path: string) => {
          if (path === "convex.json") {
            return writtenContent !== null;
          }
          if (path === "package.json") {
            return true;
          }
          return false;
        },
        readUtf8File: (path: string) => {
          if (path === "convex.json") {
            if (writtenContent === null) {
              throw new Error("File doesn't exist");
            }
            return writtenContent;
          }
          if (path === "package.json") {
            return JSON.stringify({ name: "test-app" });
          }
          throw new Error(`Unexpected read: ${path}`);
        },
        writeUtf8File: (_path: string, content: string) => {
          writtenContent = content;
        },
        mkdir: () => {},
      },
    };

    await writeProjectConfig(testCtx, config);
    const { projectConfig: readBack } = await readProjectConfig(testCtx);
    expect(readBack).toEqual(config);
  };

  // Test 1: All defaults (file won't be written, but reading returns defaults)
  await assertRoundtrips({
    functions: "convex/",
    node: { externalPackages: [] },
    generateCommonJSApi: false,
    codegen: { staticApi: false, staticDataModel: false },
  });

  // Test 2: Custom functions path
  await assertRoundtrips({
    functions: "my-functions/",
    node: { externalPackages: [] },
    generateCommonJSApi: false,
    codegen: { staticApi: false, staticDataModel: false },
  });

  // Test 3: External packages
  await assertRoundtrips({
    functions: "convex/",
    node: { externalPackages: ["axios", "lodash"] },
    generateCommonJSApi: false,
    codegen: { staticApi: false, staticDataModel: false },
  });

  // Test 4: Node version
  await assertRoundtrips({
    functions: "convex/",
    node: { externalPackages: [], nodeVersion: "18" },
    generateCommonJSApi: false,
    codegen: { staticApi: false, staticDataModel: false },
  });

  // Test 5: Generate CommonJS API
  await assertRoundtrips({
    functions: "convex/",
    node: { externalPackages: [] },
    generateCommonJSApi: true,
    codegen: { staticApi: false, staticDataModel: false },
  });

  // Test 6: Codegen options
  await assertRoundtrips({
    functions: "convex/",
    node: { externalPackages: [] },
    generateCommonJSApi: false,
    codegen: { staticApi: true, staticDataModel: true },
  });

  // Test 7: AuthInfo (deprecated but still supported)
  await assertRoundtrips({
    functions: "convex/",
    node: { externalPackages: [] },
    generateCommonJSApi: false,
    codegen: { staticApi: false, staticDataModel: false },
    authInfo: [{ applicationID: "app123", domain: "example.com" }],
  });

  // Test 8: Complex config with multiple non-defaults
  await assertRoundtrips({
    functions: "backend/",
    node: { externalPackages: ["@aws-sdk/client-s3"], nodeVersion: "20" },
    generateCommonJSApi: true,
    codegen: { staticApi: true, staticDataModel: false },
  });
});

test("parseProjectConfig - preserves unknown properties", async () => {
  // Unknown properties should be preserved for forward/backward compatibility
  await assertParses(
    {
      functions: "convex/",
      unknownField: "some-value",
      futureFeature: {
        nested: "data",
        count: 42,
      },
    },
    {
      functions: "convex/",
      node: { externalPackages: [] },
      generateCommonJSApi: false,
      codegen: { staticApi: false, staticDataModel: false },
      unknownField: "some-value",
      futureFeature: {
        nested: "data",
        count: 42,
      },
    } as any,
  );

  // Unknown properties alongside known ones
  await assertParses(
    {
      functions: "my-functions/",
      generateCommonJSApi: true,
      customMetadata: {
        version: "1.0.0",
        author: "test",
      },
      experimentalFlag: true,
    },
    {
      functions: "my-functions/",
      node: { externalPackages: [] },
      generateCommonJSApi: true,
      codegen: { staticApi: false, staticDataModel: false },
      customMetadata: {
        version: "1.0.0",
        author: "test",
      },
      experimentalFlag: true,
    } as any,
  );
});

test("writeProjectConfig - preserves unknown properties", async () => {
  let writtenContent = "";
  const testCtx = {
    ...ctx,
    fs: {
      ...ctx.fs,
      exists: (path: string) => path === "convex.json",
      writeUtf8File: (_path: string, content: string) => {
        writtenContent = content;
      },
      mkdir: () => {},
    },
  };

  // Unknown properties should be written back
  const configWithUnknown: any = {
    functions: "my-functions/",
    node: { externalPackages: [] },
    generateCommonJSApi: false,
    codegen: { staticApi: false, staticDataModel: false },
    unknownField: "preserve-me",
    futureFeature: {
      enabled: true,
      config: { nested: "value" },
    },
  };

  await writeProjectConfig(testCtx, configWithUnknown);
  const written = JSON.parse(writtenContent);

  // Non-default known fields should be present
  expect(written.functions).toBe("my-functions/");

  // Unknown fields should be preserved
  expect(written.unknownField).toBe("preserve-me");
  expect(written.futureFeature).toEqual({
    enabled: true,
    config: { nested: "value" },
  });

  // Defaults should still be stripped
  expect(written.node).toBeUndefined();
  expect(written.codegen).toBeUndefined();
  expect(written.generateCommonJSApi).toBeUndefined();
});

test("roundtrip - unknown properties survive read-write-read", async () => {
  let writtenContent: string | null = null;
  const testCtx = {
    ...ctx,
    fs: {
      ...ctx.fs,
      exists: (path: string) => {
        if (path === "convex.json") {
          return writtenContent !== null;
        }
        if (path === "package.json") {
          return true;
        }
        return false;
      },
      readUtf8File: (path: string) => {
        if (path === "convex.json") {
          if (writtenContent === null) {
            throw new Error("File doesn't exist");
          }
          return writtenContent;
        }
        if (path === "package.json") {
          return JSON.stringify({ name: "test-app" });
        }
        throw new Error(`Unexpected read: ${path}`);
      },
      writeUtf8File: (_path: string, content: string) => {
        writtenContent = content;
      },
      mkdir: () => {},
    },
  };

  // Start with a config containing unknown properties
  const originalConfig: any = {
    functions: "backend/",
    node: { externalPackages: ["axios"] },
    generateCommonJSApi: true,
    codegen: { staticApi: false, staticDataModel: false },
    // Unknown properties that should survive
    customField: "important-data",
    metadata: {
      version: "2.0",
      internal: true,
    },
    experimentalFeatures: ["feature1", "feature2"],
  };

  // Write
  await writeProjectConfig(testCtx, originalConfig);

  // Read back
  const { projectConfig: readBack } = await readProjectConfig(testCtx);

  // All unknown properties should be preserved
  expect((readBack as any).customField).toBe("important-data");
  expect((readBack as any).metadata).toEqual({
    version: "2.0",
    internal: true,
  });
  expect((readBack as any).experimentalFeatures).toEqual([
    "feature1",
    "feature2",
  ]);

  // Known properties should also be correct
  expect(readBack.functions).toBe("backend/");
  expect(readBack.node.externalPackages).toEqual(["axios"]);
  expect(readBack.generateCommonJSApi).toBe(true);

  // Write again
  await writeProjectConfig(testCtx, readBack);

  // Read again
  const { projectConfig: readBack2 } = await readProjectConfig(testCtx);

  // Everything should still match
  expect(readBack2).toEqual(readBack);
});

test("read-write-read - unknown properties with deprecated fields", async () => {
  // Verify unknown properties survive even when deprecated fields are removed
  let writtenContent: string | null = null;
  let hasBeenWritten = false;
  const testCtx = {
    ...ctx,
    fs: {
      ...ctx.fs,
      exists: (path: string) => {
        if (path === "convex.json") {
          return !hasBeenWritten || writtenContent !== null;
        }
        if (path === "package.json") {
          return true;
        }
        return false;
      },
      readUtf8File: (path: string) => {
        if (path === "convex.json") {
          if (!hasBeenWritten) {
            // First read: has deprecated fields AND unknown properties
            return JSON.stringify({
              functions: "my-functions/",
              project: "my-project", // deprecated
              team: "my-team", // deprecated
              customField: "keep-this", // unknown, should survive
              futureConfig: { value: 123 }, // unknown, should survive
            });
          }
          if (writtenContent === null) {
            throw new Error("File doesn't exist");
          }
          return writtenContent;
        }
        if (path === "package.json") {
          return JSON.stringify({ name: "test-app" });
        }
        throw new Error(`Unexpected read: ${path}`);
      },
      writeUtf8File: (_path: string, content: string) => {
        writtenContent = content;
        hasBeenWritten = true;
      },
      mkdir: () => {},
    },
  };

  // First read
  const { projectConfig: firstRead } = await readProjectConfig(testCtx);

  // Deprecated fields present in memory
  expect(firstRead.project).toBe("my-project");
  expect(firstRead.team).toBe("my-team");

  // Unknown fields also present
  expect((firstRead as any).customField).toBe("keep-this");
  expect((firstRead as any).futureConfig).toEqual({ value: 123 });

  // Write (deprecated fields will be filtered out)
  await writeProjectConfig(testCtx, firstRead);

  // Read again
  const { projectConfig: secondRead } = await readProjectConfig(testCtx);

  // Deprecated fields gone from file (not re-read)
  expect(secondRead.project).toBeUndefined();
  expect(secondRead.team).toBeUndefined();

  // But unknown fields should survive!
  expect((secondRead as any).customField).toBe("keep-this");
  expect((secondRead as any).futureConfig).toEqual({ value: 123 });

  // Known non-default fields still present
  expect(secondRead.functions).toBe("my-functions/");
});

test("parseProjectConfig - warns about unknown properties", async () => {
  // Single unknown property
  stderrSpy.mockClear();
  const config1 = await parseProjectConfig(ctx, {
    functions: "convex/",
    unknownField: "value",
  });
  expect(config1.functions).toBe("convex/");
  expect((config1 as any).unknownField).toBe("value");

  // Check that warning was logged
  const stderr1 = stderrSpy.mock.calls.map((call) => call[0]).join("");
  expect(stripVTControlCharacters(stderr1)).toContain(
    "Warning: Unknown property in `convex.json`: `unknownField`",
  );
  expect(stripVTControlCharacters(stderr1)).toContain(
    "These properties will be preserved but are not recognized by this version of Convex",
  );

  // Multiple unknown properties
  stderrSpy.mockClear();
  const config2 = await parseProjectConfig(ctx, {
    functions: "my-functions/",
    customField1: "value1",
    customField2: 42,
    futureFeature: { nested: true },
  });
  expect((config2 as any).customField1).toBe("value1");
  expect((config2 as any).customField2).toBe(42);

  // No warning for known fields only
  stderrSpy.mockClear();
  await parseProjectConfig(ctx, {
    functions: "convex/",
    generateCommonJSApi: true,
  });
  const stderr3 = stderrSpy.mock.calls.map((call) => call[0]).join("");
  expect(stripVTControlCharacters(stderr3)).not.toContain("Warning");
  expect(stripVTControlCharacters(stderr3)).not.toContain("Unknown");

  // No warning for deprecated fields (they're known, just deprecated)
  stderrSpy.mockClear();
  await parseProjectConfig(ctx, {
    functions: "convex/",
    project: "my-project",
    team: "my-team",
  });
  const stderr4 = stderrSpy.mock.calls.map((call) => call[0]).join("");
  expect(stripVTControlCharacters(stderr4)).not.toContain("Warning");
  expect(stripVTControlCharacters(stderr4)).not.toContain("Unknown");

  // No warning for $schema field (used by JSON schema validation)
  stderrSpy.mockClear();
  await parseProjectConfig(ctx, {
    functions: "convex/",
    $schema: "../../../convex/schemas/convex.schema.json",
  });
  const stderr5 = stderrSpy.mock.calls.map((call) => call[0]).join("");
  expect(stripVTControlCharacters(stderr5)).not.toContain("Warning");
  expect(stripVTControlCharacters(stderr5)).not.toContain("Unknown");
});
