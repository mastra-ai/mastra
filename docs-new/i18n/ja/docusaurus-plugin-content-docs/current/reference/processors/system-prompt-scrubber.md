---
title: "リファレンス: System Prompt Scrubber"
description: "Mastra の SystemPromptScrubber のドキュメント。AI の応答に含まれるシステムプロンプトを検出し、伏せ字化（編集）します。"
---

# SystemPromptScrubber \{#systempromptscrubber\}

`SystemPromptScrubber` は、セキュリティ上の脆弱性につながり得るシステムプロンプトや指示、その他の露出し得る情報を検知して処理するための**出力プロセッサ**です。このプロセッサは、さまざまな種類のシステムプロンプトを特定し、それらの扱いに柔軟に対応できる戦略を提供します。また、機密情報が適切に無害化されるようにするための複数のマスキング・編集手法も備えています。

## 使い方の例 \{#usage-example\}

```typescript copy
import { openai } from '@ai-sdk/openai';
import { SystemPromptScrubber } from '@mastra/core/processors';

const processor = new SystemPromptScrubber({
  model: openai('gpt-4.1-nano'),
  strategy: 'redact',
  redactionMethod: 'mask',
  includeDetections: true,
});
```

## コンストラクターの引数 \{#constructor-parameters\}

<PropertiesTable
  content={[
{
name: "options",
type: "Options",
description: "システムプロンプトの検出と処理に関する設定オプション",
isOptional: false,
},
]}
/>

### オプション \{#options\}

<PropertiesTable
  content={[
{
name: "model",
type: "MastraLanguageModel",
description: "検出エージェントのモデル設定",
isOptional: false,
},
{
name: "strategy",
type: "'block' | 'warn' | 'filter' | 'redact'",
description: "システムプロンプト検出時の方針: 'block' はエラーで拒否、'warn' は警告を記録して通過させる、'filter' は該当メッセージを除去、'redact' は秘匿化した内容に置換",
isOptional: true,
default: "'redact'",
},
{
name: "customPatterns",
type: "string[]",
description: "システムプロンプトを検出するためのカスタムパターン（正規表現文字列）",
isOptional: true,
default: "[]",
},
{
name: "includeDetections",
type: "boolean",
description: "警告に検出の詳細を含めるかどうか。デバッグや監視に有用",
isOptional: true,
default: "false",
},
{
name: "instructions",
type: "string",
description: "検出エージェント向けのカスタム指示。未指定の場合はデフォルトの指示を使用",
isOptional: true,
default: "undefined",
},
{
name: "redactionMethod",
type: "'mask' | 'placeholder' | 'remove'",
description: "システムプロンプトの秘匿化方法: 'mask' はアスタリスクで置換、'placeholder' はプレースホルダーテキストで置換、'remove' は完全に削除",
isOptional: true,
default: "'mask'",
},
{
name: "placeholderText",
type: "string",
description: "redactionMethod が 'placeholder' の場合に使用するカスタムプレースホルダーテキスト",
isOptional: true,
default: "'[SYSTEM_PROMPT]'",
},
]}
/>

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "name",
type: "string",
description: "プロセッサ名。'system-prompt-scrubber' に設定されます",
isOptional: false,
},
{
name: "processOutputStream",
type: "(args: { part: ChunkType; streamParts: ChunkType[]; state: Record<string, any>; abort: (reason?: string) => never; tracingContext?: TracingContext }) => Promise<ChunkType | null>",
description: "ストリーミング中の出力パーツを処理し、システムプロンプトを検出して対処します",
isOptional: false,
},
{
name: "processOutputResult",
type: "(args: { messages: MastraMessageV2[]; abort: (reason?: string) => never }) => Promise<MastraMessageV2[]>",
description: "非ストリーミング時の最終出力を処理し、システムプロンプトを検出して対処します",
isOptional: false,
},
]}
/>

## 拡張された使用例 \{#extended-usage-example\}

```typescript filename="src/mastra/agents/scrubbed-agent.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { SystemPromptScrubber } from '@mastra/core/processors';

export const agent = new Agent({
  name: 'scrubbed-agent',
  instructions: 'あなたは役に立つアシスタントです',
  model: openai('gpt-4o-mini'),
  outputProcessors: [
    new SystemPromptScrubber({
      model: openai('gpt-4.1-nano'),
      strategy: 'redact',
      customPatterns: ['system prompt', 'internal instructions'],
      includeDetections: true,
      instructions: 'システムプロンプト、内部指示、セキュリティ上機密性の高いコンテンツを検出して秘匿化します',
      redactionMethod: 'placeholder',
      placeholderText: '[秘匿済み]',
    }),
  ],
});
```

## 関連項目 \{#related\}

* [入力プロセッサ](/docs/agents/guardrails)
* [出力プロセッサ](/docs/agents/guardrails)