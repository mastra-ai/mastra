---
title: "リファレンス: BatchPartsProcessor"
description: "Mastra の BatchPartsProcessor に関するドキュメント。複数のストリームパーツをまとめてバッチ化し、出力頻度を抑制します。"
---

# BatchPartsProcessor \{#batchpartsprocessor\}

`BatchPartsProcessor` は、ストリーミング中の発行頻度を下げるために複数のストリームパーツをまとめてバッチ化する**出力プロセッサ**です。このプロセッサは、ネットワークオーバーヘッドの削減、小さなテキスト片の集約によるユーザー体験の向上、そしてクライアントへのパーツの送信タイミングを制御することでストリーミング性能を最適化するのに役立ちます。

## 使い方の例 \{#usage-example\}

```typescript copy
import { BatchPartsProcessor } from '@mastra/core/processors';

const processor = new BatchPartsProcessor({
  batchSize: 5,
  maxWaitTime: 100,
  emitOnNonText: true,
});
```

## コンストラクターの引数 \{#constructor-parameters\}

<PropertiesTable
  content={[
{
name: "options",
type: "Options",
description: "ストリーム部分をバッチ化するための設定オプション",
isOptional: true,
},
]}
/>

### オプション \{#options\}

<PropertiesTable
  content={[
{
name: "batchSize",
type: "number",
description: "出力前に一緒にまとめるパート数",
isOptional: true,
default: "5",
},
{
name: "maxWaitTime",
type: "number",
description: "バッチを出力するまでの最大待機時間（ミリ秒）。設定されている場合、batchSize に達していなくても現在のバッチを出力します",
isOptional: true,
default: "undefined（タイムアウトなし）",
},
{
name: "emitOnNonText",
type: "boolean",
description: "非テキストのパートに遭遇したら即時に出力するかどうか",
isOptional: true,
default: "true",
},
]}
/>

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "name",
type: "string",
description: "プロセッサ名。'batch-parts' に設定されます",
isOptional: false,
},
{
name: "processOutputStream",
type: "(args: { part: ChunkType; streamParts: ChunkType[]; state: Record<string, any>; abort: (reason?: string) => never }) => Promise<ChunkType | null>",
description: "ストリーミング出力のパーツを処理してまとめてバッチ化します",
isOptional: false,
},
{
name: "flush",
type: "(state?: BatchPartsState) => ChunkType | null",
description: "ストリーム終了時に残っているバッチ化済みのパーツを強制的にフラッシュします",
isOptional: false,
},
]}
/>

## 発展的な使用例 \{#extended-usage-example\}

```typescript filename="src/mastra/agents/batched-agent.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { BatchPartsProcessor } from '@mastra/core/processors';

export const agent = new Agent({
  name: 'batched-agent',
  instructions: 'あなたは親切で役立つアシスタントです',
  model: openai('gpt-4o-mini'),
  outputProcessors: [
    new BatchPartsProcessor({
      batchSize: 5,
      maxWaitTime: 100,
      emitOnNonText: true,
    }),
  ],
});
```

## 関連 \{#related\}

* [Output Processors のドキュメント](/docs/agents/guardrails)