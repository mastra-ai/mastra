---
title: "Cohere でテキストを埋め込む"
description: Cohere の埋め込みモデルを使用して Mastra でベクトル埋め込みを生成する例。
---

# Cohere でテキストを埋め込む \{#embed-text-with-cohere\}

他の埋め込みプロバイダーを使う場合は、選択したモデルの仕様に合ったベクトルを生成する必要があります。`embed` メソッドは複数のプロバイダーに対応しており、さまざまな埋め込みサービスを切り替えて利用できます。この例では、Cohere の埋め込みモデルを使って埋め込みを生成する方法を示します。

```tsx copy
import { cohere } from '@ai-sdk/cohere';
import { MDocument } from '@mastra/rag';
import { embedMany } from 'ai';

const doc = MDocument.fromText('テキストの内容...');

const chunks = await doc.chunk();

const { embeddings } = await embedMany({
  model: cohere.embedding('embed-english-v3.0'),
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
"https://github.com/mastra-ai/mastra/blob/main/examples/basics/rag/embed-text-with-cohere"
}
/>
