---
title: "テキストチャンクの埋め込み"
description: 類似検索用に単一のテキストチャンクの埋め込みをMastraで生成する例。
---

# テキストチャンクの埋め込み \{#embed-text-chunk\}

個別のテキストチャンクを扱う場合、類似検索のために数値ベクトルに変換する必要があります。`embed` メソッドは、選択したプロバイダーとモデルを用いて、単一のテキストチャンクを埋め込みベクトルに変換します。

```tsx copy
import { openai } from '@ai-sdk/openai';
import { MDocument } from '@mastra/rag';
import { embed } from 'ai';

const doc = MDocument.fromText('テキストコンテンツをここに入力...');

const chunks = await doc.chunk();

const { embedding } = await embed({
  model: openai.embedding('text-embedding-3-small'),
  value: chunks[0].text,
});
```

<br />

<br />

<hr className="dark:border-[#404040] border-gray-300" />

<br />

<br />

<GithubLink
  link={
"https://github.com/mastra-ai/mastra/blob/main/examples/basics/rag/embed-text-chunk"
}
/>
