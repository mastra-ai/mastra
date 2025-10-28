---
title: "テキストを意味単位でチャンク化する"
description: 大規模なテキストドキュメントを処理しやすい小さなチャンクに分割するために Mastra を使う例。
---

# チャンクテキスト \{#chunk-text\}

大きなテキスト文書を扱う場合は、処理しやすい小さな単位に分割する必要があります。チャンク手法は、テキストコンテンツを検索・分析・取得に利用できるセグメントに分割します。次の例では、デフォルト設定でプレーンテキストをチャンクに分割する方法を示します。

```tsx copy
import { MDocument } from '@mastra/rag';

const doc = MDocument.fromText('プレーンテキストの内容...');

const chunks = await doc.chunk();
```

<br />

<br />

<hr className="dark:border-[#404040] border-gray-300" />

<br />

<br />

<GithubLink
  link={
"https://github.com/mastra-ai/mastra/blob/main/examples/basics/rag/chunk-text"
}
/>
