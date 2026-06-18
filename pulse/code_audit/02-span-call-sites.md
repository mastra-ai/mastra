# Span Call Sites

This file lists places in `packages/core/src` that initiate traditional span signals. In most cases the concrete `span_started`, `span_updated`, or `span_ended` event is emitted by the active observability implementation behind these APIs.

## Shared Span Helpers

| Location | Signal | Notes |
| --- | --- | --- |
| `packages/core/src/observability/utils.ts:110` | start root span or child span | `getOrCreateSpan(...)` is the main helper. It creates a child span from `tracingContext.currentSpan`, otherwise calls `observability.getSelectedInstance(...).startSpan(...)`. |
| `packages/core/src/observability/utils.ts:120` | `span_started` | Child-span branch of `getOrCreateSpan(...)`. |
| `packages/core/src/observability/utils.ts:130` | `span_started` | Root-span branch via `instance.startSpan(...)`. |
| `packages/core/src/observability/rag-ingestion.ts:82` | `span_started` | `startRagIngestion(...)` wraps `getOrCreateSpan(...)` for `SpanType.RAG_INGESTION`. |
| `packages/core/src/observability/rag-ingestion.ts:131` | `span_ended` | `withRagIngestion(...)` ends the ingestion span with output. |
| `packages/core/src/observability/rag-ingestion.ts:134` | span error / optional end | `withRagIngestion(...)` records thrown errors with `endSpan: true`. |
| `packages/core/src/workspace/tools/tracing.ts:127` | workspace helper | `startWorkspaceSpan(...)` returns a handle with `end(...)` and `error(...)`. |
| `packages/core/src/workspace/tools/tracing.ts:140` | `span_started` | Starts `SpanType.WORKSPACE_ACTION`. |
| `packages/core/src/workspace/tools/tracing.ts:155` | `span_ended` | Workspace handle `end(...)`. |
| `packages/core/src/workspace/tools/tracing.ts:164` | span error | Workspace handle `error(...)`. |

## Agent Spans

| Location | Span Type | Lifecycle |
| --- | --- | --- |
| `packages/core/src/agent/agent.ts:6308` | `AGENT_RUN` | Modern agent root via `getOrCreateSpan(...)`. |
| `packages/core/src/agent/agent.ts:6690` | `AGENT_RUN` | Ends modern agent span. |
| `packages/core/src/agent/agent-legacy.ts:273` | `AGENT_RUN` | Legacy agent root via `getOrCreateSpan(...)`. |
| `packages/core/src/agent/agent-legacy.ts:393` | `AGENT_RUN` | Error path. |
| `packages/core/src/agent/agent-legacy.ts:643` | `AGENT_RUN` | Error path. |
| `packages/core/src/agent/agent-legacy.ts:661` | `AGENT_RUN` | Error path. |
| `packages/core/src/agent/agent-legacy.ts:708` | `AGENT_RUN` | End path. |
| `packages/core/src/agent/agent-legacy.ts:992` | `AGENT_RUN` | End path on `beforeResult.agentSpan`. |
| `packages/core/src/agent/agent-legacy.ts:1067` | `AGENT_RUN` | End path. |
| `packages/core/src/agent/agent-legacy.ts:1197` | `AGENT_RUN` | End path. |
| `packages/core/src/agent/agent-legacy.ts:1331` | `AGENT_RUN` | End path on `beforeResult.agentSpan`. |
| `packages/core/src/agent/agent-legacy.ts:1427` | `AGENT_RUN` | End path. |
| `packages/core/src/agent/agent-legacy.ts:1505` | `AGENT_RUN` | End path. |
| `packages/core/src/agent/workflows/prepare-stream/prepare-tools-step.ts:69` | `AGENT_RUN` | Updates agent span with prepared tool metadata. |
| `packages/core/src/agent/workflows/prepare-stream/map-results-step.ts:133` | `AGENT_RUN` | End path. |
| `packages/core/src/agent/workflows/prepare-stream/map-results-step.ts:148` | `AGENT_RUN` | Error path. |
| `packages/core/src/agent/workflows/prepare-stream/map-results-step.ts:285` | `AGENT_RUN` | Error path with `endSpan: true`. |
| `packages/core/src/agent/workflows/prepare-stream/map-results-step.ts:290` | `AGENT_RUN` | End path. |
| `packages/core/src/agent/workflows/prepare-stream/map-results-step.ts:302` | `AGENT_RUN` | End path. |
| `packages/core/src/agent/workflows/prepare-stream/map-results-step.ts:358` | `AGENT_RUN` | Error path with `endSpan: true`. |
| `packages/core/src/agent/workflows/prepare-stream/map-results-step.ts:361` | `AGENT_RUN` | End path. |

## Model / LLM Spans

| Location | Span Type | Lifecycle |
| --- | --- | --- |
| `packages/core/src/llm/model/model.ts:185` | `MODEL_GENERATION` | Starts generate-text span. |
| `packages/core/src/llm/model/model.ts:261` | `GENERIC` | Starts rate-limit retry child span. |
| `packages/core/src/llm/model/model.ts:267` | `GENERIC` | Ends rate-limit retry span. |
| `packages/core/src/llm/model/model.ts:286` | `MODEL_GENERATION` | Ends generate-text span. |
| `packages/core/src/llm/model/model.ts:330` | `MODEL_GENERATION` | Error path. |
| `packages/core/src/llm/model/model.ts:349` | `MODEL_GENERATION` | Starts generate-object span. |
| `packages/core/src/llm/model/model.ts:389` | `MODEL_GENERATION` | Update path. |
| `packages/core/src/llm/model/model.ts:408` | `MODEL_GENERATION` | End path. |
| `packages/core/src/llm/model/model.ts:447` | `MODEL_GENERATION` | Error path. |
| `packages/core/src/llm/model/model.ts:478` | `MODEL_GENERATION` | Error path for schema conversion. |
| `packages/core/src/llm/model/model.ts:513` | `MODEL_GENERATION` | Starts stream-text span. |
| `packages/core/src/llm/model/model.ts:602` | `MODEL_GENERATION` | Error path. |
| `packages/core/src/llm/model/model.ts:618` | `GENERIC` | Starts rate-limit retry child span. |
| `packages/core/src/llm/model/model.ts:624` | `GENERIC` | Ends rate-limit retry span. |
| `packages/core/src/llm/model/model.ts:630` | `MODEL_GENERATION` | End path. |
| `packages/core/src/llm/model/model.ts:668` | `MODEL_GENERATION` | Error path. |
| `packages/core/src/llm/model/model.ts:708` | `MODEL_GENERATION` | Error path. |
| `packages/core/src/llm/model/model.ts:745` | `MODEL_GENERATION` | Error path. |
| `packages/core/src/llm/model/model.ts:768` | `MODEL_GENERATION` | Starts stream-object span. |
| `packages/core/src/llm/model/model.ts:803` | `MODEL_GENERATION` | Update path. |
| `packages/core/src/llm/model/model.ts:816` | `MODEL_GENERATION` | End path. |
| `packages/core/src/llm/model/model.ts:855` | `MODEL_GENERATION` | Error path. |
| `packages/core/src/llm/model/model.ts:890` | `MODEL_GENERATION` | Error path. |
| `packages/core/src/llm/model/model.ts:923` | `MODEL_GENERATION` | Error path. |
| `packages/core/src/llm/model/model.ts:928` | `MODEL_GENERATION` | Error path. |
| `packages/core/src/llm/model/model.ts:955` | `MODEL_GENERATION` | Error path. |
| `packages/core/src/llm/model/model.loop.ts:158` | `MODEL_GENERATION` | Loop model span. |
| `packages/core/src/llm/model/model.loop.ts:262` | `MODEL_GENERATION` | `reportGenerationError(...)`. |
| `packages/core/src/llm/model/model.loop.ts:279` | `GENERIC` | Starts rate-limit retry child span. |
| `packages/core/src/llm/model/model.loop.ts:285` | `GENERIC` | Ends rate-limit retry span. |
| `packages/core/src/llm/model/model.loop.ts:293` | `MODEL_GENERATION` | `endGeneration(...)`. |
| `packages/core/src/llm/model/model.loop.ts:337` | `MODEL_GENERATION` | `reportGenerationError(...)`. |
| `packages/core/src/llm/model/model.loop.ts:374` | `MODEL_GENERATION` | `reportGenerationError(...)`. |
| `packages/core/src/loop/workflows/agentic-execution/llm-execution-step.ts:439` | `CLIENT_TOOL_CALL` | Ends client tool span once args are available. |
| `packages/core/src/loop/workflows/agentic-execution/llm-execution-step.ts:502` | `CLIENT_TOOL_CALL` | Starts server-side marker span for client-side tool execution. |
| `packages/core/src/loop/workflows/agentic-execution/llm-execution-step.ts:756` | `CLIENT_TOOL_CALL` | Ends client tool span with parsed args. |
| `packages/core/src/loop/workflows/agentic-execution/llm-execution-step.ts:901` | `MODEL_GENERATION` | `updateGeneration(...)`. |
| `packages/core/src/loop/workflows/agentic-execution/llm-execution-step.ts:1028` | `MODEL_GENERATION` | `updateGeneration(...)`. |
| `packages/core/src/loop/workflows/agentic-execution/llm-execution-step.ts:1055` | `AGENT_RUN` | Updates parent agent span with model/provider details. |
| `packages/core/src/agent/durable/workflows/steps/llm-execution.ts:217` | `MODEL_GENERATION` | Rebuilds durable model-generation span. |
| `packages/core/src/agent/durable/workflows/steps/llm-execution.ts:475` | `MODEL_GENERATION` | `reportGenerationError(...)`. |
| `packages/core/src/agent/durable/workflows/steps/llm-execution.ts:477` | `MODEL_GENERATION` | Direct model span error path. |
| `packages/core/src/agent/durable/workflows/steps/llm-execution.ts:491` | `MODEL_GENERATION` | `reportGenerationError(...)`. |
| `packages/core/src/agent/durable/workflows/steps/llm-execution.ts:493` | `MODEL_GENERATION` | Direct model span error path. |
| `packages/core/src/agent/durable/workflows/steps/llm-execution.ts:585` | `MODEL_STEP` | Rebuilds durable step span. |
| `packages/core/src/agent/durable/workflows/steps/llm-execution.ts:586` | `MODEL_STEP` | Ends rebuilt step span. |

## Tool Spans

| Location | Span Type | Lifecycle |
| --- | --- | --- |
| `packages/core/src/tools/tool-builder/builder.ts:743` | `TOOL_CALL` or `MCP_TOOL_CALL` | Starts tool span through `getOrCreateSpan(...)`. |
| `packages/core/src/tools/tool-builder/builder.ts:687` | `TOOL_CALL` or `MCP_TOOL_CALL` | End path for resume validation failure. |
| `packages/core/src/tools/tool-builder/builder.ts:700` | `TOOL_CALL` or `MCP_TOOL_CALL` | End path for suspend validation failure. |
| `packages/core/src/tools/tool-builder/builder.ts:708` | `TOOL_CALL` or `MCP_TOOL_CALL` | End success path. |
| `packages/core/src/tools/tool-builder/builder.ts:720` | `TOOL_CALL` or `MCP_TOOL_CALL` | End path for output validation failure. |
| `packages/core/src/tools/tool-builder/builder.ts:727` | `TOOL_CALL` or `MCP_TOOL_CALL` | End success path. |
| `packages/core/src/tools/tool-builder/builder.ts:730` | `TOOL_CALL` or `MCP_TOOL_CALL` | Error path. |
| `packages/core/src/tools/tool-builder/builder.ts:810` | `TOOL_CALL` or `MCP_TOOL_CALL` | End path for tool execution error object. |
| `packages/core/src/tools/tool-builder/builder.ts:841` | `TOOL_CALL` or `MCP_TOOL_CALL` | Error path for normalized Mastra error. |

## Processor / Mapping / Memory Spans

| Location | Span Type | Lifecycle |
| --- | --- | --- |
| `packages/core/src/processors/runner.ts:99` | `PROCESSOR_RUN` | Starts processor span for stream state. |
| `packages/core/src/processors/runner.ts:628` | `PROCESSOR_RUN` | Starts processor span. |
| `packages/core/src/processors/runner.ts:697` | `PROCESSOR_RUN` | End path. |
| `packages/core/src/processors/runner.ts:713` | `PROCESSOR_RUN` | Error path. |
| `packages/core/src/processors/runner.ts:727` | `PROCESSOR_RUN` | Error path with `endSpan: true`. |
| `packages/core/src/processors/runner.ts:887` | `PROCESSOR_RUN` | End stream-state span. |
| `packages/core/src/processors/runner.ts:1129` | `PROCESSOR_RUN` | Starts processor span. |
| `packages/core/src/processors/runner.ts:1265` | `PROCESSOR_RUN` | End path. |
| `packages/core/src/processors/runner.ts:1281` | `PROCESSOR_RUN` | Error path. |
| `packages/core/src/processors/runner.ts:1295` | `PROCESSOR_RUN` | Error path with `endSpan: true`. |
| `packages/core/src/processors/runner.ts:1428` | `PROCESSOR_RUN` | Starts processor span. |
| `packages/core/src/processors/runner.ts:1559` | `PROCESSOR_RUN` | End path. |
| `packages/core/src/processors/runner.ts:1576` | `PROCESSOR_RUN` | Error path. |
| `packages/core/src/processors/runner.ts:1590` | `PROCESSOR_RUN` | Error path with `endSpan: true`. |
| `packages/core/src/processors/runner.ts:1864` | `PROCESSOR_RUN` | Starts processor span. |
| `packages/core/src/processors/runner.ts:1948` | `PROCESSOR_RUN` | End path. |
| `packages/core/src/processors/runner.ts:1964` | `PROCESSOR_RUN` | Error path. |
| `packages/core/src/processors/runner.ts:1978` | `PROCESSOR_RUN` | Error path with `endSpan: true`. |
| `packages/core/src/processors/runner.ts:2040` | `PROCESSOR_RUN` | Starts processor span. |
| `packages/core/src/processors/runner.ts:2112` | `PROCESSOR_RUN` | End path. |
| `packages/core/src/processors/runner.ts:2125` | `PROCESSOR_RUN` | Error path. |
| `packages/core/src/processors/runner.ts:2140` | `PROCESSOR_RUN` | Error path with `endSpan: true`. |
| `packages/core/src/loop/workflows/agentic-execution/llm-mapping-step.ts:206` | `MAPPING` | Starts mapping span. |
| `packages/core/src/loop/workflows/agentic-execution/llm-mapping-step.ts:222` | `MAPPING` | End path. |
| `packages/core/src/loop/workflows/agentic-execution/llm-mapping-step.ts:224` | `MAPPING` | Error path with `endSpan: true`. |
| `packages/core/src/processors/memory/message-history.ts:73` | `MEMORY_OPERATION` | Starts memory-operation child span. |

## Workflow Spans

| Location | Span Type | Lifecycle |
| --- | --- | --- |
| `packages/core/src/workflows/handlers/control-flow.ts:91` | `WORKFLOW_PARALLEL` | Starts parallel-control span. |
| `packages/core/src/workflows/handlers/control-flow.ts:292` | `WORKFLOW_CONDITIONAL` | Starts conditional span. |
| `packages/core/src/workflows/handlers/control-flow.ts:311` | `WORKFLOW_CONDITIONAL_EVAL` | Starts condition-evaluation span. |
| `packages/core/src/workflows/handlers/control-flow.ts:425` | `WORKFLOW_CONDITIONAL` | Updates conditional span. |
| `packages/core/src/workflows/handlers/control-flow.ts:598` | `WORKFLOW_LOOP` | Starts loop span. |
| `packages/core/src/workflows/handlers/control-flow.ts:708` | `WORKFLOW_CONDITIONAL_EVAL` | Starts loop-condition eval span. |
| `packages/core/src/workflows/handlers/control-flow.ts:880` | `WORKFLOW_LOOP` | Starts loop span. |
| `packages/core/src/workflows/handlers/sleep.ts:65` | `WORKFLOW_SLEEP` | Starts sleep span. |
| `packages/core/src/workflows/handlers/sleep.ts:119` | `WORKFLOW_SLEEP` | Updates sleep span. |
| `packages/core/src/workflows/handlers/sleep.ts:190` | `WORKFLOW_SLEEP` | Starts sleep-until span. |
| `packages/core/src/workflows/handlers/sleep.ts:248` | `WORKFLOW_SLEEP` | Updates sleep-until span. |
| `packages/core/src/workflows/handlers/step.ts:159` | `WORKFLOW_STEP` | Starts workflow-step span through engine. |
| `packages/core/src/workflows/default.ts:275` | passthrough | Default engine child-span creation. |
| `packages/core/src/workflows/default.ts:295` | passthrough | Default engine span end. |
| `packages/core/src/workflows/default.ts:315` | passthrough | Default engine span error. |
| `packages/core/src/workflows/default.ts:340` | passthrough | Default engine child-span creation. |
| `packages/core/src/workflows/default.ts:360` | passthrough | Default engine span end. |
| `packages/core/src/workflows/default.ts:380` | passthrough | Default engine span error. |
| `packages/core/src/workflows/default.ts:447` | `WORKFLOW_STEP` | Step error path. |
| `packages/core/src/workflows/default.ts:749` | `WORKFLOW_RUN` | Empty-graph error path. |
| `packages/core/src/workflows/default.ts:863` | `WORKFLOW_RUN` | Error path. |
| `packages/core/src/workflows/default.ts:870` | `WORKFLOW_RUN` | End path. |
| `packages/core/src/workflows/default.ts:938` | `WORKFLOW_RUN` | End path. |
| `packages/core/src/workflows/default.ts:971` | `WORKFLOW_RUN` | End path. |
| `packages/core/src/workflows/workflow.ts:957` | `PROCESSOR_RUN` | Starts workflow processor span. |
| `packages/core/src/workflows/workflow.ts:1073` | `PROCESSOR_RUN` | End path. |
| `packages/core/src/workflows/workflow.ts:1078` | `PROCESSOR_RUN` | End path for tripwire. |
| `packages/core/src/workflows/workflow.ts:1080` | `PROCESSOR_RUN` | Error path with `endSpan: true`. |
| `packages/core/src/workflows/workflow.ts:1248` | `PROCESSOR_RUN` | Starts streaming workflow processor span. |
| `packages/core/src/workflows/workflow.ts:1283` | `PROCESSOR_RUN` | End path. |
| `packages/core/src/workflows/workflow.ts:1291` | `PROCESSOR_RUN` | End path for tripwire. |
| `packages/core/src/workflows/workflow.ts:1293` | `PROCESSOR_RUN` | Error path with `endSpan: true`. |
| `packages/core/src/workflows/workflow.ts:3245` | `WORKFLOW_RUN` | Starts workflow run span. |
| `packages/core/src/workflows/workflow.ts:4083` | `WORKFLOW_RUN` | Starts workflow run span. |
| `packages/core/src/workflows/workflow.ts:4189` | `WORKFLOW_RUN` | Starts workflow run span. |
| `packages/core/src/workflows/workflow.ts:4326` | `WORKFLOW_RUN` | Starts workflow run span. |
| `packages/core/src/workflows/evented/step-executor.ts:137` | `WORKFLOW_STEP` | Starts evented workflow-step span. |
| `packages/core/src/workflows/evented/step-executor.ts:293` | `WORKFLOW_STEP` | End success path. |
| `packages/core/src/workflows/evented/step-executor.ts:295` | `WORKFLOW_STEP` | End terminal-status path. |
| `packages/core/src/workflows/evented/step-executor.ts:307` | `WORKFLOW_STEP` | Error path. |
| `packages/core/src/workflows/evented/workflow.ts:998` | `PROCESSOR_RUN` | Starts evented workflow processor span. |
| `packages/core/src/workflows/evented/workflow.ts:1109` | `PROCESSOR_RUN` | End path. |
| `packages/core/src/workflows/evented/workflow.ts:1114` | `PROCESSOR_RUN` | End path for tripwire. |
| `packages/core/src/workflows/evented/workflow.ts:1116` | `PROCESSOR_RUN` | Error path with `endSpan: true`. |
| `packages/core/src/workflows/evented/workflow.ts:1274` | `PROCESSOR_RUN` | Starts streaming evented workflow processor span. |
| `packages/core/src/workflows/evented/workflow.ts:1308` | `PROCESSOR_RUN` | End path. |
| `packages/core/src/workflows/evented/workflow.ts:1314` | `PROCESSOR_RUN` | End path for tripwire. |
| `packages/core/src/workflows/evented/workflow.ts:1316` | `PROCESSOR_RUN` | Error path with `endSpan: true`. |
| `packages/core/src/workflows/evented/workflow.ts:1809` | `WORKFLOW_RUN` | Starts evented workflow run span. |
| `packages/core/src/workflows/evented/workflow.ts:1844` | `WORKFLOW_RUN` | Error path. |
| `packages/core/src/workflows/evented/workflow.ts:1852` | `WORKFLOW_RUN` | Error path. |
| `packages/core/src/workflows/evented/workflow.ts:1854` | `WORKFLOW_RUN` | End path. |

## Eval / Scorer Spans

| Location | Span Type | Lifecycle |
| --- | --- | --- |
| `packages/core/src/evals/base.ts:546` | `SCORER_RUN` | Starts scorer run span. |
| `packages/core/src/evals/base.ts:585` | `SCORER_RUN` | Error path with `endSpan: true`. |
| `packages/core/src/evals/base.ts:601` | `SCORER_RUN` | Error path with `endSpan: true`. |
| `packages/core/src/evals/base.ts:610` | `SCORER_RUN` | Error path with `endSpan: true`. |
| `packages/core/src/evals/base.ts:627` | `SCORER_RUN` | End path. |
| `packages/core/src/evals/base.ts:723` | `SCORER_STEP` | Starts scorer step span. |
| `packages/core/src/evals/base.ts:763` | `SCORER_STEP` | Error path with `endSpan: true`. |
| `packages/core/src/evals/base.ts:768` | `SCORER_STEP` | Update path. |
| `packages/core/src/evals/base.ts:776` | `SCORER_STEP` | End path. |

## Workspace Action Spans

All rows here use `startWorkspaceSpan(...)`, which starts `SpanType.WORKSPACE_ACTION` through `packages/core/src/workspace/tools/tracing.ts`.

| Location | Operation |
| --- | --- |
| `packages/core/src/workspace/skills/tools.ts:92` | skill read/list style action. |
| `packages/core/src/workspace/skills/tools.ts:132` | skill search/list style action. |
| `packages/core/src/workspace/skills/tools.ts:187` | skill write/publish style action. |
| `packages/core/src/workspace/tools/index-content.ts:19` | index content. |
| `packages/core/src/workspace/tools/file-stat.ts:19` | file stat. |
| `packages/core/src/workspace/tools/get-process-output.ts:34` | get process output. |
| `packages/core/src/workspace/tools/lsp-inspect.ts:105` | LSP inspect. |
| `packages/core/src/workspace/tools/ast-edit.ts:438` | AST edit. |
| `packages/core/src/workspace/tools/grep.ts:67` | grep. |
| `packages/core/src/workspace/tools/execute-command.ts:141` | execute command. |
| `packages/core/src/workspace/tools/edit-file.ts:52` | edit file. |
| `packages/core/src/workspace/tools/read-file.ts:171` | read file. |
| `packages/core/src/workspace/tools/kill-process.ts:24` | kill process. |
| `packages/core/src/workspace/tools/list-files.ts:76` | list files. |
| `packages/core/src/workspace/tools/write-file.ts:20` | write file. |
| `packages/core/src/workspace/tools/mkdir.ts:23` | mkdir. |
| `packages/core/src/workspace/tools/search.ts:26` | search. |
| `packages/core/src/workspace/tools/delete-file.ts:23` | delete file. |

Workspace lifecycle calls are dense but consistent: each tool calls `span.end(...)` for success or expected failure output, and `span.error(...)` for thrown exceptions. The concrete line inventory from the scan is:

- `packages/core/src/workspace/skills/tools.ts:102`, `109`, `112`, `143`, `147`, `156`, `198`, `215`, `224`, `230`, `233`
- `packages/core/src/workspace/tools/get-process-output.ts:49`, `102`, `121`, `124`
- `packages/core/src/workspace/tools/kill-process.ts:55`, `83`, `86`
- `packages/core/src/workspace/tools/ast-edit.ts:453`, `464`, `471`, `478`, `491`, `501`, `511`, `523`, `529`, `532`, `535`, `549`, `555`, `558`
- `packages/core/src/workspace/tools/mkdir.ts:36`, `39`
- `packages/core/src/workspace/tools/edit-file.ts:67`, `81`, `85`, `89`, `92`
- `packages/core/src/workspace/tools/list-files.ts:99`, `102`
- `packages/core/src/workspace/tools/read-file.ts:194`, `199`, `213`, `230`, `240`, `262`, `265`
- `packages/core/src/workspace/tools/file-stat.ts:33`, `37`, `40`
- `packages/core/src/workspace/tools/write-file.ts:40`, `43`
- `packages/core/src/workspace/tools/grep.ts:78`, `87`, `281`, `284`
- `packages/core/src/workspace/tools/lsp-inspect.ts:123`, `130`, `142`, `166`, `173`, `307`
- `packages/core/src/workspace/tools/index-content.ts:28`, `31`
- `packages/core/src/workspace/tools/execute-command.ts:152`, `194`, `201`, `241`, `263`
- `packages/core/src/workspace/tools/search.ts:59`, `62`
- `packages/core/src/workspace/tools/delete-file.ts:42`, `45`
