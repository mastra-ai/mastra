import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { globby } from 'globby';
import { describe, expect, it } from 'vitest';
import { getPackageExportsManifest } from 'vitest-package-exports';
import pkg from './package.json';

const cwd = fileURLToPath(import.meta.url);
const pkgRoot = dirname(cwd);

async function getWildcardExportsManifest() {
  const exportsObj = pkg.exports as Record<string, { import?: { default?: string } }>;
  const wildcardEntry = exportsObj['./*'];
  const pattern = wildcardEntry?.import?.default;
  if (!pattern) return {};

  const files = await globby(pattern.replace(/^\.\//, ''), { cwd: pkgRoot, onlyFiles: true });
  const exports: Record<string, Record<string, string>> = {};

  for (const file of files) {
    const match = file.replace('dist/', '').replace('/index.js', '');
    const exportKey = `./${match}`;

    // Skip explicit exports
    if (exportKey in exportsObj && exportKey !== './*') continue;

    try {
      const mod = await import(join(pkgRoot, file));
      exports[exportKey] = Object.fromEntries(
        Object.entries(mod)
          .map(([k, v]) => [k, typeof v])
          .sort((a, b) => a[0].localeCompare(b[0])),
      );
    } catch {
      // Skip files that can't be imported
    }
  }

  return exports;
}

describe('public exports', () => {
  it('defined paths', async () => {
    const manifest = await getPackageExportsManifest({
      importMode: 'dist',
      cwd,
      resolveExportsValue: value => {
        // @ts-expect-error
        return value.import.default;
      },
    });

    expect(manifest.exports).toMatchInlineSnapshot(`
      {
        ".": {
          "Mastra": "function",
        },
        "./agent/message-list": {
          "MessageList": "function",
        },
        "./base": {
          "MastraBase": "function",
        },
        "./evals/scoreTraces": {
          "scoreTraces": "function",
          "scoreTracesWorkflow": "object",
        },
        "./features": {
          "coreFeatures": "object",
        },
        "./processors": {
          "BatchPartsProcessor": "function",
          "LanguageDetector": "function",
          "ModerationProcessor": "function",
          "PIIDetector": "function",
          "ProcessorState": "function",
          "PromptInjectionDetector": "function",
          "StructuredOutputProcessor": "function",
          "SystemPromptScrubber": "function",
          "TokenLimiterProcessor": "function",
          "UnicodeNormalizer": "function",
        },
        "./test-utils/llm-mock": {
          "MockProvider": "function",
          "createMockModel": "function",
        },
        "./tools/is-vercel-tool": {
          "isVercelTool": "function",
        },
        "./utils": {
          "checkEvalStorageFields": "function",
          "createMastraProxy": "function",
          "deepMerge": "function",
          "delay": "function",
          "ensureToolProperties": "function",
          "fetchWithRetry": "function",
          "generateEmptyFromSchema": "function",
          "getNestedValue": "function",
          "isCoreMessage": "function",
          "isUiMessage": "function",
          "isZodType": "function",
          "makeCoreTool": "function",
          "makeCoreToolV5": "function",
          "maskStreamTags": "function",
          "omitKeys": "function",
          "parseFieldKey": "function",
          "parseSqlIdentifier": "function",
          "removeUndefinedValues": "function",
          "resolveSerializedZodOutput": "function",
          "selectFields": "function",
          "setNestedValue": "function",
        },
        "./utils/zod-to-json": {
          "zodToJsonSchema": "function",
        },
        "./vector/filter": {
          "BaseFilterTranslator": "function",
        },
        "./workflows/_constants": {
          "EMITTER_SYMBOL": "symbol",
          "STREAM_FORMAT_SYMBOL": "symbol",
        },
        "./workflows/evented": {
          "EventedExecutionEngine": "function",
          "EventedRun": "function",
          "EventedWorkflow": "function",
          "StepExecutor": "function",
          "WorkflowEventProcessor": "function",
          "cloneStep": "function",
          "cloneWorkflow": "function",
          "createStep": "function",
          "createWorkflow": "function",
        },
      }
    `);
  });

  it('wildcard paths', async () => {
    const exports = await getWildcardExportsManifest();

    expect(exports).toMatchInlineSnapshot(`
      {
        "./a2a": {
          "MastraA2AError": "function",
        },
        "./agent": {
          "Agent": "function",
          "MessageList": "function",
          "TripWire": "function",
          "convertMessages": "function",
          "resolveThreadIdFromArgs": "function",
          "tryGenerateWithJsonFallback": "function",
          "tryStreamWithJsonFallback": "function",
        },
        "./bundler": {
          "MastraBundler": "function",
        },
        "./cache": {
          "InMemoryServerCache": "function",
          "MastraServerCache": "function",
        },
        "./deployer": {
          "MastraDeployer": "function",
        },
        "./di": {
          "RequestContext": "function",
        },
        "./error": {
          "ErrorCategory": "object",
          "ErrorDomain": "object",
          "MastraBaseError": "function",
          "MastraError": "function",
          "getErrorFromUnknown": "function",
        },
        "./evals": {
          "MastraScorer": "function",
          "createScorer": "function",
          "runEvals": "function",
          "saveScorePayloadSchema": "object",
          "scoreResultSchema": "object",
          "scoringExtractStepResultSchema": "object",
          "scoringValueSchema": "object",
        },
        "./events": {
          "PubSub": "function",
        },
        "./hooks": {
          "AvailableHooks": "object",
          "executeHook": "function",
          "registerHook": "function",
        },
        "./integration": {
          "Integration": "function",
          "OpenAPIToolset": "function",
        },
        "./llm": {
          "MastraModelGateway": "function",
          "ModelRouterEmbeddingModel": "function",
          "ModelRouterLanguageModel": "function",
          "ModelsDevGateway": "function",
          "NetlifyGateway": "function",
          "PROVIDER_REGISTRY": "object",
          "getProviderConfig": "function",
          "parseModelString": "function",
          "resolveModelConfig": "function",
        },
        "./logger": {
          "ConsoleLogger": "function",
          "LogLevel": "object",
          "LoggerTransport": "function",
          "MastraLogger": "function",
          "MultiLogger": "function",
          "RegisteredLogger": "object",
          "createCustomTransport": "function",
          "createLogger": "function",
          "noopLogger": "object",
        },
        "./loop": {
          "loop": "function",
        },
        "./mastra": {
          "Mastra": "function",
        },
        "./mcp": {
          "MCPServerBase": "function",
        },
        "./memory": {
          "MastraMemory": "function",
          "MemoryProcessor": "function",
          "MockMemory": "function",
          "memoryDefaultOptions": "object",
        },
        "./observability": {
          "InternalSpans": "object",
          "NoOpObservability": "function",
          "SamplingStrategyType": "object",
          "SpanType": "object",
          "TracingEventType": "object",
          "getOrCreateSpan": "function",
          "wrapMastra": "function",
        },
        "./relevance": {
          "MastraAgentRelevanceScorer": "function",
          "createSimilarityPrompt": "function",
        },
        "./request-context": {
          "RequestContext": "function",
        },
        "./server": {
          "MastraAuthProvider": "function",
          "defineAuth": "function",
          "registerApiRoute": "function",
        },
        "./storage": {
          "InMemoryMemory": "function",
          "InMemoryStore": "function",
          "MastraStorage": "function",
          "MemoryStorage": "function",
          "MockStore": "function",
          "ObservabilityInMemory": "function",
          "ObservabilityStorage": "function",
          "SCORERS_SCHEMA": "object",
          "SPAN_SCHEMA": "object",
          "ScoresInMemory": "function",
          "ScoresStorage": "function",
          "StoreOperations": "function",
          "StoreOperationsInMemory": "function",
          "TABLE_MESSAGES": "string",
          "TABLE_RESOURCES": "string",
          "TABLE_SCHEMAS": "object",
          "TABLE_SCORERS": "string",
          "TABLE_SPANS": "string",
          "TABLE_THREADS": "string",
          "TABLE_TRACES": "string",
          "TABLE_WORKFLOW_SNAPSHOT": "string",
          "WorkflowsInMemory": "function",
          "WorkflowsStorage": "function",
          "calculatePagination": "function",
          "ensureDate": "function",
          "normalizePerPage": "function",
          "safelyParseJSON": "function",
          "serializeDate": "function",
        },
        "./stream": {
          "AISDKV5OutputStream": "function",
          "ChunkFrom": "object",
          "DefaultGeneratedFile": "function",
          "DefaultGeneratedFileWithType": "function",
          "MastraAgentNetworkStream": "function",
          "MastraModelOutput": "function",
          "WorkflowRunOutput": "function",
          "convertFullStreamChunkToUIMessageStream": "function",
          "convertMastraChunkToAISDKv5": "function",
        },
        "./tools": {
          "Tool": "function",
          "ToolStream": "function",
          "createTool": "function",
          "isVercelTool": "function",
        },
        "./tts": {
          "MastraTTS": "function",
        },
        "./types": {},
        "./vector": {
          "BaseFilterTranslator": "function",
          "MastraVector": "function",
          "embedV1": "function",
          "embedV2": "function",
        },
        "./voice": {
          "AISDKSpeech": "function",
          "AISDKTranscription": "function",
          "CompositeVoice": "function",
          "DefaultVoice": "function",
          "MastraVoice": "function",
        },
        "./workflows": {
          "DefaultExecutionEngine": "function",
          "ExecutionEngine": "function",
          "Run": "function",
          "Workflow": "function",
          "cloneStep": "function",
          "cloneWorkflow": "function",
          "createDeprecationProxy": "function",
          "createStep": "function",
          "createTimeTravelExecutionParams": "function",
          "createWorkflow": "function",
          "getResumeLabelsByStepId": "function",
          "getStepIds": "function",
          "getStepResult": "function",
          "getZodErrors": "function",
          "mapVariable": "function",
          "runCountDeprecationMessage": "string",
          "validateStepInput": "function",
          "validateStepResumeData": "function",
          "validateStepSuspendData": "function",
        },
      }
    `);
  });
});
