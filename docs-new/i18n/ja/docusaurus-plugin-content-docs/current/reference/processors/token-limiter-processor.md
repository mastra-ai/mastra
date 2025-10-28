---
title: "リファレンス：Token Limiter Processor"
description: "Mastra の TokenLimiterProcessor のドキュメント。AI の応答に含まれるトークン数を制限します。"
---

# TokenLimiterProcessor \{#tokenlimiterprocessor\}

`TokenLimiterProcessor` は、AI の応答に含まれるトークン数を制限する**出力プロセッサ**です。トークンをカウントし、上限超過時の扱いを設定可能な戦略で制御することで、応答の長さを管理します。ストリーミング／非ストリーミングのいずれの場合も、トランケーション（切り詰め）や中止などのオプションをサポートします。

## 使用例 \{#usage-example\}

```typescript copy
import { TokenLimiterProcessor } from '@mastra/core/processors';

const processor = new TokenLimiterProcessor({
  limit: 1000,
  strategy: 'truncate',
  countMode: 'cumulative',
});
```

## コンストラクターの引数 \{#constructor-parameters\}

<PropertiesTable
  content={[
{
name: "options",
type: "number | Options",
description: "トークン上限を表す単純な数値、または構成オプションのオブジェクト",
isOptional: false,
},
]}
/>

### オプション \{#options\}

<PropertiesTable
  content={[
{
name: "limit",
type: "number",
description: "レスポンスで許可するトークンの最大数",
isOptional: false,
},
{
name: "encoding",
type: "TiktokenBPE",
description: "使用するエンコーディング（省略可）。デフォルトは gpt-4o で使用される o200k_base です",
isOptional: true,
default: "o200k_base",
},
{
name: "strategy",
type: "'truncate' | 'abort'",
description: "トークン上限到達時の動作: 'truncate' はチャンクの出力を止め、'abort' は abort() を呼び出してストリームを停止します",
isOptional: true,
default: "'truncate'",
},
{
name: "countMode",
type: "'cumulative' | 'part'",
description: "ストリームの冒頭から数えるか、現在の部分のみ数えるか: 'cumulative' は開始からの全トークンを、'part' は現在の部分のトークンのみをカウントします",
isOptional: true,
default: "'cumulative'",
},
]}
/>

## 返り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "name",
type: "string",
description: "プロセッサ名は 'token-limiter' に設定されます",
isOptional: false,
},
{
name: "processOutputStream",
type: "(args: { part: ChunkType; streamParts: ChunkType[]; state: Record<string, any>; abort: (reason?: string) => never }) => Promise<ChunkType | null>",
description: "ストリーミング中のトークン数を制限するために、ストリーミング出力の各パーツを処理します",
isOptional: false,
},
{
name: "processOutputResult",
type: "(args: { messages: MastraMessageV2[]; abort: (reason?: string) => never }) => Promise<MastraMessageV2[]>",
description: "非ストリーミング時のトークン数を制限するために、最終的な出力結果を処理します",
isOptional: false,
},
{
name: "reset",
type: "() => void",
description: "トークンカウンタをリセットします（テストやプロセッサの再利用に便利）",
isOptional: false,
},
{
name: "getCurrentTokens",
type: "() => number",
description: "現在のトークン数を取得します",
isOptional: false,
},
{
name: "getMaxTokens",
type: "() => number",
description: "トークンの最大上限を取得します",
isOptional: false,
},
]}
/>

## 拡張された使用例 \{#extended-usage-example\}

```typescript filename="src/mastra/agents/limited-agent.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { TokenLimiterProcessor } from '@mastra/core/processors';

export const agent = new Agent({
  name: 'limited-agent',
  instructions: 'あなたは親切なアシスタントです',
  model: openai('gpt-4o-mini'),
  outputProcessors: [
    new TokenLimiterProcessor({
      limit: 1000,
      strategy: 'truncate',
      countMode: 'cumulative',
    }),
  ],
});
```

## 関連項目 \{#related\}

* [入力プロセッサ](/docs/agents/guardrails)
* [出力プロセッサ](/docs/agents/guardrails)