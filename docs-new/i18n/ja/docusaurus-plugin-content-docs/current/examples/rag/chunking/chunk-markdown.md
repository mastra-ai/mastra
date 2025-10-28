---
title: "Markdown をセマンティックにチャンク化する"
description: 検索や検索補助の目的で、Mastra を使って Markdown ドキュメントをチャンク化する例。
---

# Markdown のチャンク化 \{#chunk-markdown\}

Markdown は生の HTML より情報密度が高く、RAG パイプラインで扱いやすい形式です。Markdown を扱う際は、見出しや書式を保ったままより小さな単位に分割する必要があります。`chunk` メソッドは、見出し、リスト、コードブロックといった Markdown 固有の要素を賢く扱います。この例では、検索やリトリーバルの目的で Markdown ドキュメントをどのようにチャンク化するかを示します。

```tsx copy
import { MDocument } from '@mastra/rag';

const doc = MDocument.fromMarkdown('# マークダウンコンテンツ...');

const chunks = await doc.chunk();
```

<br />

<br />

<hr className="dark:border-[#404040] border-gray-300" />

<br />

<br />

<GithubLink
  link={
"https://github.com/mastra-ai/mastra/blob/main/examples/basics/rag/chunk-markdown"
}
/>
