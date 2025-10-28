---
title: "チャンク配列への埋め込み"
description: 類似検索のために Mastra を使用して、テキストチャンクの配列に埋め込みを生成する例。
---

# チャンク配列を埋め込む \{#embed-chunk-array\}

ドキュメントをチャンク化した後、テキストチャンクを類似検索に使える数値ベクトルに変換する必要があります。`embed` メソッドは、選択したプロバイダーとモデルを用いてテキストチャンクを埋め込みベクトルに変換します。次の例では、テキストチャンクの配列に対して埋め込みを生成する方法を示します。

```tsx copy
import { openai } from '@ai-sdk/openai';
import { MDocument } from '@mastra/rag';
import { embed } from 'ai';

const doc = MDocument.fromText('テキストの内容...');

const chunks = await doc.chunk();

const { embeddings } = await embedMany({
  model: openai.embedding('text-embedding-3-small'),
  values: chunks.map(chunk => chunk.text),
});
```

<br />

<br />

<hr className="dark:border-[#404040] border-gray-300" />

<br />

<br />

<GithubLink
  link={
"https://github.com/mastra-ai/mastra/blob/main/examples/basics/rag/embed-chunk-array"
}
/>
