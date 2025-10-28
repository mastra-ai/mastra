---
title: "インターフェース"
description: AI Tracing の型定義とインターフェース
---

# インターフェース \{#interfaces\}

## コア インターフェイス \{#core-interfaces\}

### AITracing \{#aitracing\}

AI Tracingの主要なインターフェース。

```typescript
interface AITracing {
  /** 現在の設定を取得 */
  getConfig(): Readonly<Required<TracingConfig>>;

  /** すべてのエクスポーターを取得 */
  getExporters(): readonly AITracingExporter[];

  /** すべてのプロセッサーを取得 */
  getProcessors(): readonly AISpanProcessor[];

  /** ロガーインスタンスを取得(エクスポーターおよびその他のコンポーネント用) */
  getLogger(): IMastraLogger;

  /** 特定のAISpanTypeの新しいスパンを開始 */
  startSpan<TType extends AISpanType>(options: StartSpanOptions<TType>): AISpan<TType>;

  /** AIトレーシングをシャットダウンしてリソースをクリーンアップ */
  shutdown(): Promise<void>;
}
```

### AISpanTypeMap \{#aispantypemap\}

スパン型と対応する属性インターフェースの対応付け。

```typescript
interface AISpanTypeMap {
  AGENT_RUN: AgentRunAttributes;
  WORKFLOW_RUN: WorkflowRunAttributes;
  LLM_GENERATION: LLMGenerationAttributes;
  LLM_CHUNK: LLMChunkAttributes;
  TOOL_CALL: ToolCallAttributes;
  MCP_TOOL_CALL: MCPToolCallAttributes;
  WORKFLOW_STEP: WorkflowStepAttributes;
  WORKFLOW_CONDITIONAL: WorkflowConditionalAttributes;
  WORKFLOW_CONDITIONAL_EVAL: WorkflowConditionalEvalAttributes;
  WORKFLOW_PARALLEL: WorkflowParallelAttributes;
  WORKFLOW_LOOP: WorkflowLoopAttributes;
  WORKFLOW_SLEEP: WorkflowSleepAttributes;
  WORKFLOW_WAIT_EVENT: WorkflowWaitEventAttributes;
  GENERIC: AIBaseAttributes;
}
```

このマッピングは、スパンの作成や処理の際に、各スパンタイプで使用される属性インターフェースを定義します。

### AISpan \{#aispan\}

内部のトレース用途で使用される AI Span インターフェイス。

```typescript
interface AISpan<TType extends AISpanType> {
  readonly id: string;
  readonly traceId: string;
  readonly type: TType;
  readonly name: string;

  /** 内部スパンかどうか(mastraの内部処理用スパン) */
  isInternal: boolean;

  /** 親スパンへの参照(ルートスパンの場合はundefined) */
  parent?: AnyAISpan;

  /** AITracingインスタンスへのポインタ */
  aiTracing: AITracing;

  attributes?: AISpanTypeMap[TType];
  metadata?: Record<string, any>;
  input?: any;
  output?: any;
  errorInfo?: any;

  /** スパンを終了する */
  end(options?: EndSpanOptions<TType>): void;

  /** スパンのエラーを記録し、オプションでスパンも終了する */
  error(options: ErrorSpanOptions<TType>): void;

  /** スパンの属性を更新する */
  update(options: UpdateSpanOptions<TType>): void;

  /** 子スパンを作成する - 親から独立した任意のスパンタイプを指定可能 */
  createChildSpan<TChildType extends AISpanType>(options: ChildSpanOptions<TChildType>): AISpan<TChildType>;

  /** イベントスパンを作成する - 親から独立した任意のスパンタイプを指定可能 */
  createEventSpan<TChildType extends AISpanType>(options: ChildEventOptions<TChildType>): AISpan<TChildType>;

  /** トレースのルートスパンである場合にTRUEを返す */
  get isRootSpan(): boolean;

  /** 有効なスパンである場合にTRUEを返す(NO-OPスパンではない) */
  get isValid(): boolean;
}
```

### AITracingExporter \{#aitracingexporter\}

トレースエクスポーター用のインターフェース。

```typescript
interface AITracingExporter {
  /** エクスポーター名 */
  name: string;

  /** エクスポーターを初期化（すべての依存関係の準備完了後に呼び出される） */
  init?(): void;

  /** トレーシングイベントをエクスポート */
  exportEvent(event: AITracingEvent): Promise<void>;

  /** エクスポーターをシャットダウン */
  shutdown(): Promise<void>;
}
```

### AISpanProcessor \{#aispanprocessor\}

スパンプロセッサ用のインターフェイス。

```typescript
interface AISpanProcessor {
  /** プロセッサー名 */
  name: string;

  /** エクスポート前にスパンを処理する */
  process(span?: AnyAISpan): AnyAISpan | undefined;

  /** プロセッサーをシャットダウンする */
  shutdown(): Promise<void>;
}
```

## スパンの型 \{#span-types\}

### AISpanType \{#aispantype\}

AI 固有のスパンタイプと、それに付随するメタデータ。

```typescript
enum AISpanType {
  /** エージェント実行 - エージェントプロセスのルートスパン */
  AGENT_RUN = 'agent_run',

  /** カスタム操作用の汎用スパン */
  GENERIC = 'generic',

  /** モデル呼び出し、トークン使用量、プロンプト、生成結果を含むLLM生成 */
  LLM_GENERATION = 'llm_generation',

  /** 個別のLLMストリーミングチャンク/イベント */
  LLM_CHUNK = 'llm_chunk',

  /** MCP (Model Context Protocol) ツール実行 */
  MCP_TOOL_CALL = 'mcp_tool_call',

  /** 入力、出力、エラーを含む関数/ツール実行 */
  TOOL_CALL = 'tool_call',

  /** ワークフロー実行 - ワークフロープロセスのルートスパン */
  WORKFLOW_RUN = 'workflow_run',

  /** ステップステータス、データフローを含むワークフローステップ実行 */
  WORKFLOW_STEP = 'workflow_step',

  /** 条件評価を含むワークフロー条件分岐実行 */
  WORKFLOW_CONDITIONAL = 'workflow_conditional',

  /** 条件分岐内の個別の条件評価 */
  WORKFLOW_CONDITIONAL_EVAL = 'workflow_conditional_eval',

  /** ワークフロー並列実行 */
  WORKFLOW_PARALLEL = 'workflow_parallel',

  /** ワークフローループ実行 */
  WORKFLOW_LOOP = 'workflow_loop',

  /** ワークフロースリープ操作 */
  WORKFLOW_SLEEP = 'workflow_sleep',

  /** ワークフローイベント待機操作 */
  WORKFLOW_WAIT_EVENT = 'workflow_wait_event',
}
```

### AnyAISpan \{#anyaispan\}

あらゆるスパンを扱う必要がある場合に用いるユニオン型。

```typescript
type AnyAISpan = AISpan<keyof AISpanTypeMap>;
```

## span 属性 \{#span-attributes\}

### AgentRunAttributes \{#agentrunattributes\}

Agent Run の属性です。

```typescript
interface AgentRunAttributes {
  /** エージェント識別子 */
  agentId: string;

  /** エージェントへの指示 */
  instructions?: string;

  /** エージェントプロンプト */
  prompt?: string;

  /** この実行で使用可能なツール */
  availableTools?: string[];

  /** 最大ステップ数 */
  maxSteps?: number;
}
```

### LLMGenerationAttributes \{#llmgenerationattributes\}

LLM の生成属性。

```typescript
interface LLMGenerationAttributes {
  /** モデル名(例: 'gpt-4', 'claude-3') */
  model?: string;

  /** モデルプロバイダー(例: 'openai', 'anthropic') */
  provider?: string;

  /** このLLM呼び出しが生成した結果/出力の種類 */
  resultType?: 'tool_selection' | 'response_generation' | 'reasoning' | 'planning';

  /** トークン使用量の統計 */
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    promptCacheHitTokens?: number;
    promptCacheMissTokens?: number;
  };

  /** モデルパラメータ */
  parameters?: {
    maxOutputTokens?: number;
    temperature?: number;
    topP?: number;
    topK?: number;
    presencePenalty?: number;
    frequencyPenalty?: number;
    stopSequences?: string[];
    seed?: number;
    maxRetries?: number;
  };

  /** ストリーミングレスポンスかどうか */
  streaming?: boolean;

  /** 生成が終了した理由 */
  finishReason?: string;
}
```

### LLMChunkAttributes \{#llmchunkattributes\}

LLM チャンクの属性 — 各ストリーミングチャンク／イベントごとの情報。

```typescript
interface LLMChunkAttributes {
  /** チャンクの種類(text-delta、reasoning-delta、tool-callなど) */
  chunkType?: string;

  /** ストリーム内でのこのチャンクの順序番号 */
  sequenceNumber?: number;
}
```

### ToolCallAttributes \{#toolcallattributes\}

Tool Call の属性。

```typescript
interface ToolCallAttributes {
  toolId?: string;
  toolType?: string;
  toolDescription?: string;
  success?: boolean;
}
```

### MCPToolCallAttributes \{#mcptoolcallattributes\}

MCP のツール呼び出し属性。

```typescript
interface MCPToolCallAttributes {
  /** MCPツール/関数のID */
  toolId: string;

  /** MCPサーバー識別子 */
  mcpServer: string;

  /** MCPサーバーバージョン */
  serverVersion?: string;

  /** ツール実行が成功したかどうか */
  success?: boolean;
}
```

### WorkflowRunAttributes \{#workflowrunattributes\}

Workflow Run の属性。

```typescript
interface WorkflowRunAttributes {
  /** ワークフロー識別子 */
  workflowId: string;

  /** ワークフローのバージョン */
  workflowVersion?: string;

  /** ワークフロー実行ID */
  runId?: string;

  /** ワークフロー実行の最終ステータス */
  status?: WorkflowRunStatus;
}
```

### WorkflowStepAttributes \{#workflowstepattributes\}

ワークフロー ステップの属性。

```typescript
interface WorkflowStepAttributes {
  /** ステップ識別子 */
  stepId?: string;

  /** ステップの種類 */
  stepType?: string;

  /** ステップのステータス */
  status?: WorkflowStepStatus;

  /** ステップの実行順序 */
  stepNumber?: number;

  /** 結果格納キー */
  resultKey?: string;
}
```

## オプションの型 \{#options-types\}

### StartSpanOptions \{#startspanoptions\}

新しいスパンを開始するためのオプション。

```typescript
interface StartSpanOptions<TType extends AISpanType> {
  /** スパンの種類 */
  type: TType;

  /** スパン名 */
  name: string;

  /** スパン属性 */
  attributes?: AISpanTypeMap[TType];

  /** スパンのメタデータ */
  metadata?: Record<string, any>;

  /** 入力データ */
  input?: any;

  /** 親スパン */
  parent?: AnyAISpan;

  /** ポリシーレベルのトレース設定 */
  tracingPolicy?: TracingPolicy;

  /** カスタムサンプラー戦略使用時に渡すオプション */
  customSamplerOptions?: CustomSamplerOptions;
}
```

### UpdateSpanOptions \{#updatespanoptions\}

スパン更新用のオプション。

```typescript
interface UpdateSpanOptions<TType extends AISpanType> {
  /** スパン属性 */
  attributes?: Partial<AISpanTypeMap[TType]>;

  /** スパンのメタデータ */
  metadata?: Record<string, any>;

  /** 入力データ */
  input?: any;

  /** 出力データ */
  output?: any;
}
```

### EndSpanOptions \{#endspanoptions\}

スパン終了のオプション。

```typescript
interface EndSpanOptions<TType extends AISpanType> {
  /** 出力データ */
  output?: any;

  /** スパンメタデータ */
  metadata?: Record<string, any>;

  /** スパン属性 */
  attributes?: Partial<AISpanTypeMap[TType]>;
}
```

### ErrorSpanOptions \{#errorspanoptions\}

スパンのエラーを記録するためのオプション。

```typescript
interface ErrorSpanOptions<TType extends AISpanType> {
  /** この問題に関連付けられたエラー */
  error: Error;

  /** true の場合はスパンを終了します */
  endSpan?: boolean;

  /** スパンメタデータ */
  metadata?: Record<string, any>;

  /** スパン属性 */
  attributes?: Partial<AISpanTypeMap[TType]>;
}
```

## コンテキストの型 \{#context-types\}

### TracingContext \{#tracingcontext\}

ワークフローやエージェントの実行を通じて伝播する、AIトレーシング用のコンテキスト。

```typescript
interface TracingContext {
  /** 子スパンの作成とメタデータ追加用の現在のAIスパン */
  currentSpan?: AnyAISpan;
}
```

### TracingProperties \{#tracingproperties\}

トレースを外部で扱うためにユーザーに返されるプロパティ。

```typescript
type TracingProperties = {
  /** 実行時に使用されたトレースID（実行がトレースされた場合） */
  traceId?: string;
};
```

### TracingOptions \{#tracingoptions\}

新しいエージェントまたはワークフローの実行を開始する際に渡すオプション。

```typescript
interface TracingOptions {
  /** ルートトレーススパンに追加するメタデータ */
  metadata?: Record<string, any>;
}
```

### TracingPolicy \{#tracingpolicy\}

ワークフローまたはエージェントの作成時に適用されるポリシーレベルのトレース設定。

```typescript
interface TracingPolicy {
  /**
   * ワークフローまたはエージェント実行において、異なるタイプのスパンを内部として設定するためのビット単位オプション。内部スパンは
   * エクスポートされたトレースでデフォルトで非表示になります。
   */
  internal?: InternalSpans;
}
}
```

## 設定の種類 \{#configuration-types\}

### TracingConfig \{#tracingconfig\}

単一のトレーシングインスタンス用の設定。

```typescript
interface TracingConfig {
  /** AIトレーシングレジストリにおけるこの設定の一意識別子 */
  name: string;

  /** トレーシングのサービス名 */
  serviceName: string;

  /** サンプリング戦略 - トレーシングを収集するかどうかを制御します（デフォルトはALWAYS） */
  sampling?: SamplingStrategy;

  /** カスタムエクスポーター */
  exporters?: AITracingExporter[];

  /** カスタムプロセッサー */
  processors?: AISpanProcessor[];

  /** mastraの内部動作のスパンを表示する場合はtrueに設定してください */
  includeInternalSpans?: boolean;
}
```

### ObservabilityRegistryConfig \{#observabilityregistryconfig\}

AI トレーシング用レジストリの完全な設定。

```typescript
interface ObservabilityRegistryConfig {
  /** デフォルトのエクスポーターを有効化します。サンプリングは常時実行され、機密データのフィルタリングが適用されます */
  default?: {
    enabled?: boolean;
  };

  /** トレーシングインスタンス名とその設定、または事前インスタンス化されたインスタンスのマップ */
  configs?: Record<string, Omit<TracingConfig, 'name'> | AITracing>;

  /** 使用するトレーシングインスタンスを選択するオプションのセレクター関数 */
  configSelector?: ConfigSelector;
}
```

## サンプリングのタイプ \{#sampling-types\}

### SamplingStrategy \{#samplingstrategy\}

サンプリング戦略の構成。

```typescript
type SamplingStrategy =
  | { type: 'always' }
  | { type: 'never' }
  | { type: 'ratio'; probability: number }
  | { type: 'custom'; sampler: (options?: CustomSamplerOptions) => boolean };
```

### CustomSamplerOptions \{#customsampleroptions\}

カスタムサンプラー戦略を使用する際に渡すオプション。

```typescript
interface CustomSamplerOptions {
  runtimeContext?: RuntimeContext;
  metadata?: Record<string, any>;
}
```

## コンフィグのセレクター型 \{#config-selector-types\}

### ConfigSelector \{#configselector\}

指定されたスパンに対して使用する AI トレーシングのインスタンスを選択する関数。

```typescript
type ConfigSelector = (
  options: ConfigSelectorOptions,
  availableConfigs: ReadonlyMap<string, AITracing>,
) => string | undefined;
```

### ConfigSelectorOptions \{#configselectoroptions\}

カスタムのトレーシング設定セレクターを使用する際に渡すオプション。

```typescript
interface ConfigSelectorOptions {
  /** ランタイムコンテキスト */
  runtimeContext?: RuntimeContext;
}
```

## 内部スパン \{#internal-spans\}

### InternalSpans \{#internalspans\}

ワークフローまたはエージェント実行において、各種のスパンを内部扱いに設定するためのビット単位オプション。

```typescript
enum InternalSpans {
  /** スパンは内部としてマークされません */
  NONE = 0,

  /** ワークフロースパンは内部としてマークされます */
  WORKFLOW = 1 << 0,

  /** エージェントスパンは内部としてマークされます */
  AGENT = 1 << 1,

  /** ツールスパンは内部としてマークされます */
  TOOL = 1 << 2,

  /** LLMスパンは内部としてマークされます */
  LLM = 1 << 3,

  /** すべてのスパンは内部としてマークされます */
  ALL = (1 << 4) - 1,
}
```

## 参考 \{#see-also\}

### ドキュメント \{#documentation\}

* [AI トレーシングの概要](/docs/observability/ai-tracing/overview) - AI トレーシングの完全ガイド
* [子スパンの作成](/docs/observability/ai-tracing/overview#creating-child-spans) - スパン階層の扱い方
* [カスタムメタデータの追加](/docs/observability/ai-tracing/overview#adding-custom-metadata) - トレースの情報を充実させる

### リファレンス \{#reference\}

* [Configuration](/docs/reference/observability/ai-tracing/configuration) - レジストリと設定
* [AITracing Classes](/docs/reference/observability/ai-tracing) - コア実装
* [Span Reference](/docs/reference/observability/ai-tracing/span) - Span のライフサイクルメソッド

### 例 \{#examples\}

* [Basic AI Tracing](/docs/examples/observability/basic-ai-tracing) - 実装の例