---
title: "再ランキングの結果"
description: OpenAI の埋め込みと PGVector を用いて、Mastra でセマンティック再ランキングを実装する例。
---

# リランキング結果 \{#re-ranking-results\}

この例では、Mastra、OpenAI の埋め込み、PGVector によるベクトルストレージを用いて、リランキング機能付きの Retrieval-Augmented Generation（RAG）システムを実装する方法を示します。

## 概要 \{#overview\}

このシステムは、Mastra と OpenAI を用いて再ランキング付きの RAG を実装しています。行う処理は次のとおりです:

1. テキストドキュメントを小さなセグメントに分割し、それぞれから埋め込みを生成する
2. ベクトルを PostgreSQL データベースに保存する
3. 初回のベクトル類似度検索を実行する
4. ベクトル類似度・セマンティック関連性・位置スコアを組み合わせ、Mastra の rerank 関数で結果を再ランキングする
5. 初回結果と再ランキング後の結果を比較し、改善点を示す

## セットアップ \{#setup\}

### 環境のセットアップ \{#environment-setup\}

環境変数を忘れずに設定してください：

```bash filename=".env"
OPENAI_API_KEY=your_openai_api_key_here
POSTGRES_CONNECTION_STRING=your_connection_string_here
```

### 依存関係 \{#dependencies\}

次に、必要な依存関係をインポートします。

```typescript copy showLineNumbers filename="src/index.ts"
import { openai } from '@ai-sdk/openai';
import { PgVector } from '@mastra/pg';
import { MDocument, rerankWithScorer as rerank, MastraAgentRelevanceScorer } from '@mastra/rag';
import { embedMany, embed } from 'ai';
```

## ドキュメント処理 \{#document-processing\}

ドキュメントを作成し、チャンクに分割して処理します：

```typescript copy showLineNumbers{7} filename="src/index.ts"
const doc1 = MDocument.fromText(`
市場データは価格の抵抗線を示しています。
テクニカルチャートは移動平均線を表示します。
サポートラインは取引判断の指針となります。
ブレイクアウトパターンはエントリーポイントを示します。
価格動向は取引タイミングを決定します。
`);

const chunks = await doc1.chunk({
  strategy: 'recursive',
  size: 150,
  overlap: 20,
  separator: '\n',
});
```

## 埋め込みの作成と保存 \{#creating-and-storing-embeddings\}

チャンクごとの埋め込みを生成し、ベクターデータベースに保存します。

```typescript copy showLineNumbers{36} filename="src/index.ts"
const { embeddings } = await embedMany({
  values: chunks.map(chunk => chunk.text),
  model: openai.embedding('text-embedding-3-small'),
});

const pgVector = new PgVector({
  connectionString: process.env.POSTGRES_CONNECTION_STRING!,
});

await pgVector.createIndex({
  indexName: 'embeddings',
  dimension: 1536,
});

await pgVector.upsert({
  indexName: 'embeddings',
  vectors: embeddings,
  metadata: chunks?.map((chunk: any) => ({ text: chunk.text })),
});
```

## ベクトル検索と再ランキング \{#vector-search-and-re-ranking\}

ベクトル検索を行い、結果を再ランキングします：

```typescript copy showLineNumbers{51} filename="src/index.ts"
const query = 'テクニカルトレーディング分析について説明して';

// クエリの埋め込みを取得
const { embedding: queryEmbedding } = await embed({
  value: query,
  model: openai.embedding('text-embedding-3-small'),
});

// 初期結果を取得
const initialResults = await pgVector.query({
  indexName: 'embeddings',
  queryVector: queryEmbedding,
  topK: 3,
});

// 結果を再ランク付け
const rerankedResults = await rerank({
  results: initialResults,
  query,
  scorer: new MastraAgentRelevanceScorer('relevance-scorer', openai('gpt-4o-mini')),
  options: {
    weights: {
      semantic: 0.5, // コンテンツがクエリと意味的にどれだけ一致するか
      vector: 0.3, // 元のベクトル類似度スコア
      position: 0.2, // 元の結果順序を保持
    },
    topK: 3,
  },
});
```

重みは、各要素が最終的なランキングに与える影響度を調整します：

* `semantic`: 値が高いほど、クエリに対する意味的理解と関連性を優先します
* `vector`: 値が高いほど、元のベクトル類似度スコアを重視します
* `position`: 値が高いほど、結果の元の並び順を保ちやすくなります

## 結果の比較 \{#comparing-results\}

初期結果と再ランキング後の結果を両方出力して、改善を確認します:

```typescript copy showLineNumbers{72} filename="src/index.ts"
console.log('初期結果:');
initialResults.forEach((result, index) => {
  console.log(`結果 ${index + 1}:`, {
    text: result.metadata.text,
    score: result.score,
  });
});

console.log('再ランク付け結果:');
rerankedResults.forEach(({ result, score, details }, index) => {
  console.log(`結果 ${index + 1}:`, {
    text: result.metadata.text,
    score: score,
    semantic: details.semantic,
    vector: details.vector,
    position: details.position,
  });
});
```

再ランク化された結果は、ベクトル類似度と意味的理解を組み合わせることで、検索の品質が向上することを示しています。各結果には次が含まれます：

* すべての要素を統合した総合スコア
* 言語モデルによる意味的関連度スコア
* 埋め込み比較に基づくベクトル類似度スコア
* 適切な場合に元の順序を維持するための位置ベースのスコア

<br />

<br />

<hr className="dark:border-[#404040] border-gray-300" />

<br />

<br />

<GithubLink
  link={
"https://github.com/mastra-ai/mastra/blob/main/examples/basics/rag/rerank"
}
/>
