---
title: "リファレンス: embed()"
description: Mastra における AI SDK を用いた埋め込み機能のドキュメント。
---

# 埋め込み \{#embed\}

Mastra は AI SDK の `embed` と `embedMany` 関数を用いてテキスト入力のベクトル埋め込みを生成し、類似検索や RAG ワークフローを実現します。

## 単一の埋め込み \{#single-embedding\}

`embed` 関数は、1件のテキスト入力に対してベクトル表現（埋め込み）を生成します。

```typescript
import { embed } from 'ai';

const result = await embed({
  model: openai.embedding('text-embedding-3-small'),
  value: '埋め込み対象のテキスト',
  maxRetries: 2, // 省略可能、デフォルトは2
});
```

### パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "model",
type: "EmbeddingModel",
description:
"使用する埋め込みモデル（例: openai.embedding('text-embedding-3-small')）",
},
{
name: "value",
type: "string | Record<string, any>",
description: "埋め込み対象のテキストまたはオブジェクト",
},
{
name: "maxRetries",
type: "number",
description:
"埋め込み呼び出しごとの最大再試行回数。再試行を無効にするには 0 を設定します。",
isOptional: true,
defaultValue: "2",
},
{
name: "abortSignal",
type: "AbortSignal",
description: "リクエストをキャンセルするためのオプションのアボートシグナル",
isOptional: true,
},
{
name: "headers",
type: "Record<string, string>",
description:
"リクエストに付与する追加の HTTP ヘッダー（HTTP ベースのプロバイダーのみ）",
isOptional: true,
},
]}
/>

### 戻り値 \{#return-value\}

<PropertiesTable
  content={[
{
name: "embedding",
type: "number[]",
description: "入力に対応する埋め込みベクトル",
},
]}
/>

## 複数の埋め込み \{#multiple-embeddings\}

複数のテキストをまとめて埋め込みするには、`embedMany` 関数を使用します。

```typescript
import { embedMany } from 'ai';

const result = await embedMany({
  model: openai.embedding('text-embedding-3-small'),
  values: ['最初のテキスト', '2番目のテキスト', '3番目のテキスト'],
  maxRetries: 2, // 省略可能、デフォルトは2
});
```

### パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "model",
type: "EmbeddingModel",
description:
"使用する埋め込みモデル（例: openai.embedding('text-embedding-3-small')）",
},
{
name: "values",
type: "string[] | Record<string, any>[]",
description: "埋め込むテキストまたはオブジェクトの配列",
},
{
name: "maxRetries",
type: "number",
description:
"埋め込み呼び出しごとの最大再試行回数。再試行を無効にするには 0 に設定します。",
isOptional: true,
defaultValue: "2",
},
{
name: "abortSignal",
type: "AbortSignal",
description: "リクエストをキャンセルするためのオプションの中断シグナル",
isOptional: true,
},
{
name: "headers",
type: "Record<string, string>",
description:
"リクエストに追加する HTTP ヘッダー（HTTP ベースのプロバイダーのみ）",
isOptional: true,
},
]}
/>

### 戻り値 \{#return-value\}

<PropertiesTable
  content={[
{
name: "embeddings",
type: "number[][]",
description:
"入力に対応する埋め込みベクトルの配列",
},
]}
/>

## 使用例 \{#example-usage\}

```typescript
import { embed, embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';

// 単一の埋め込み
const singleResult = await embed({
  model: openai.embedding('text-embedding-3-small'),
  value: '人生の意味とは何か?',
});

// 複数の埋め込み
const multipleResult = await embedMany({
  model: openai.embedding('text-embedding-3-small'),
  values: ['人生についての最初の質問', '宇宙についての2番目の質問', 'すべてについての3番目の質問'],
});
```

Vercel AI SDK の埋め込み（embeddings）に関する詳細は、以下をご覧ください：

* [AI SDK Embeddings の概要](https://sdk.vercel.ai/docs/ai-sdk-core/embeddings)
* [embed()](https://sdk.vercel.ai/docs/reference/ai-sdk-core/embed)
* [embedMany()](https://sdk.vercel.ai/docs/reference/ai-sdk-core/embed-many)
