---
title: "上位K件の結果を取得する"
description: Mastra を使ってベクターデータベースにクエリを実行し、意味的に類似したチャンクを取得する例。
---

# Top-K 結果の取得 \{#retrieving-top-k-results\}

ベクターデータベースに埋め込みを保存した後、類似するコンテンツを見つけるためにそれらを検索する必要があります。

`query` メソッドは、入力埋め込みに最も意味的に類似したチャンクを関連度順に返します。`topK` パラメータで返す結果数を指定できます。

この例では、Pinecone のベクターデータベースから類似チャンクを取得する方法を示します。

```tsx copy
import { openai } from '@ai-sdk/openai';
import { PineconeVector } from '@mastra/pinecone';
import { MDocument } from '@mastra/rag';
import { embedMany } from 'ai';

const doc = MDocument.fromText('テキストの内容...');

const chunks = await doc.chunk();

const { embeddings } = await embedMany({
  values: chunks.map(chunk => chunk.text),
  model: openai.embedding('text-embedding-3-small'),
});

const pinecone = new PineconeVector({
  apiKey: 'APIキー',
});

await pinecone.createIndex({
  indexName: 'test_index',
  dimension: 1536,
});

await pinecone.upsert({
  indexName: 'test_index',
  vectors: embeddings,
  metadata: chunks?.map((chunk: any) => ({ text: chunk.text })),
});

const topK = 10;

const results = await pinecone.query({
  indexName: 'test_index',
  queryVector: embeddings[0],
  topK,
});

console.log(results);
```

<br />

<br />

<hr className="dark:border-[#404040] border-gray-300" />

<br />

<br />

<GithubLink
  link={
"https://github.com/mastra-ai/mastra/blob/main/examples/basics/rag/retrieve-results"
}
/>
