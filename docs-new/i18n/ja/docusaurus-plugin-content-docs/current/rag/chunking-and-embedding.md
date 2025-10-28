---
title: チャンク化と埋め込み
description: Mastra におけるドキュメントのチャンク化と埋め込みによって、効率的な処理と検索を実現するためのガイド。
sidebar_position: 2
---

処理に先立って、コンテンツから MDocument インスタンスを作成します。さまざまな形式から初期化できます：

```ts showLineNumbers copy
const docFromText = MDocument.fromText('プレーンテキストの内容…');
const docFromHTML = MDocument.fromHTML('<html>HTMLの内容…</html>');
const docFromMarkdown = MDocument.fromMarkdown('# Markdownの内容…');
const docFromJSON = MDocument.fromJSON(`{ "key": "value" }`);
```

## ステップ 1: ドキュメント処理 \{#step-1-document-processing\}

`chunk` を使ってドキュメントを扱いやすい単位に分割します。Mastra では、各種ドキュメントタイプに最適化された複数のチャンク分割戦略をサポートしています:

* `recursive`: コンテンツ構造に基づく賢い分割
* `character`: シンプルな文字ベースの分割
* `token`: トークンを考慮した分割
* `markdown`: Markdown を考慮した分割
* `semantic-markdown`: 関連する見出しグループに基づく Markdown 分割
* `html`: HTML 構造を考慮した分割
* `json`: JSON 構造を考慮した分割
* `latex`: LaTeX 構造を考慮した分割
* `sentence`: 文構造を考慮した分割

**注:** 戦略ごとに、手法に最適化された異なるパラメータを受け取ります。

`recursive` 戦略の使用例は次のとおりです:

```ts showLineNumbers copy
const chunks = await doc.chunk({
  strategy: 'recursive',
  maxSize: 512,
  overlap: 50,
  separators: ['\n'],
  extract: {
    metadata: true, // メタデータを任意で抽出
  },
});
```

文の構造を保持することが重要なテキストについて、`sentence` 戦略の使用例は次のとおりです。

```ts showLineNumbers copy
const chunks = await doc.chunk({
  strategy: 'sentence',
  maxSize: 450,
  minSize: 50,
  overlap: 0,
  sentenceEnders: ['.'],
  keepSeparator: true,
});
```

セクション間の意味的関係を維持することが重要な Markdown ドキュメント向けに、`semantic-markdown` 戦略の使用例を次に示します：

```ts showLineNumbers copy
const chunks = await doc.chunk({
  strategy: 'semantic-markdown',
  joinThreshold: 500,
  modelName: 'gpt-3.5-turbo',
});
```

**注意:** メタデータ抽出では LLM を呼び出す場合があるため、API キーが設定されていることを確認してください。

チャンク化の戦略については、[チャンクに関するドキュメント](/docs/reference/rag/chunk)でさらに詳しく説明しています。

## ステップ 2: 埋め込みの生成 \{#step-2-embedding-generation\}

お好みのプロバイダーを使ってチャンクを埋め込みに変換します。Mastra は、OpenAI や Cohere など、多くの埋め込みプロバイダーをサポートしています。

### OpenAI の利用 \{#using-openai\}

```ts showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { embedMany } from 'ai';

const { embeddings } = await embedMany({
  model: openai.embedding('text-embedding-3-small'),
  values: chunks.map(chunk => chunk.text),
});
```

### Cohere を使用する \{#using-cohere\}

```ts showLineNumbers copy
import { cohere } from '@ai-sdk/cohere';
import { embedMany } from 'ai';

const { embeddings } = await embedMany({
  model: cohere.embedding('embed-english-v3.0'),
  values: chunks.map(chunk => chunk.text),
});
```

埋め込み関数は、テキストの意味を表す数値の配列であるベクトルを返し、ベクトルデータベースでの類似検索にすぐに使える状態になります。

### 埋め込み次元の設定 \{#configuring-embedding-dimensions\}

Embeddingモデルは通常、固定された次元数のベクトルを出力します（例：OpenAI の `text-embedding-3-small` は 1536 次元）。
一部のモデルでは次元数の削減が可能で、次の利点があります：

* ベクターデータベースに必要なストレージ容量を削減
* 類似度検索の計算コストを削減

サポートされているモデルの例：

OpenAI（text-embedding-3 系のモデル）:

```ts
const { embeddings } = await embedMany({
  model: openai.embedding('text-embedding-3-small', {
    dimensions: 256, // text-embedding-3 以降のみサポート
  }),
  values: chunks.map(chunk => chunk.text),
});
```

Google（text-embedding-004）：

```ts
const { embeddings } = await embedMany({
  model: google.textEmbeddingModel('text-embedding-004', {
    outputDimensionality: 256, // 末尾側の余分な次元を切り捨てます
  }),
  values: chunks.map(chunk => chunk.text),
});
```

### ベクターデータベースの互換性 \{#vector-database-compatibility\}

埋め込みを保存する際は、使用する埋め込みモデルの出力サイズに合わせて、ベクターデータベースのインデックスを設定する必要があります。次元が一致しない場合は、エラーが発生したり、データが破損したりするおそれがあります。

## 例: 完全なパイプライン \{#example-complete-pipeline\}

以下は、両方のプロバイダーを使用したドキュメント処理と埋め込み生成の例です。

```ts showLineNumbers copy
import { embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';
import { cohere } from '@ai-sdk/cohere';

import { MDocument } from '@mastra/rag';

// ドキュメントを初期化
const doc = MDocument.fromText(`
  気候変動は世界の農業に重大な課題をもたらしています。
  気温の上昇と降水パターンの変化が作物の収量に影響を与えています。
`);

// チャンクを作成
const chunks = await doc.chunk({
  strategy: 'recursive',
  maxSize: 256,
  overlap: 50,
});

// OpenAIで埋め込みを生成
const { embeddings: openAIEmbeddings } = await embedMany({
  model: openai.embedding('text-embedding-3-small'),
  values: chunks.map(chunk => chunk.text),
});

// または

// Cohereで埋め込みを生成
const { embeddings: cohereEmbeddings } = await embedMany({
  model: cohere.embedding('embed-english-v3.0'),
  values: chunks.map(chunk => chunk.text),
});

// ベクトルデータベースに埋め込みを保存
await vectorStore.upsert({
  indexName: 'embeddings',
  vectors: embeddings,
});
```

##

さまざまなチャンク手法や埋め込み設定の例については、以下をご参照ください:

* [チャンクサイズの調整](/docs/reference/rag/chunk#parameters)
* [チャンクの区切りの調整](/docs/reference/rag/chunk#parameters)
* [Cohere を使ったテキストの埋め込み](/docs/reference/rag/embeddings#example-usage)

ベクターデータベースや埋め込みの詳細については、以下をご参照ください:

* [ベクターデータベース](./vector-databases)
* [Embedding API リファレンス](/docs/reference/rag/embeddings)