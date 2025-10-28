---
title: "HTML のセマンティック・チャンク化"
description: Mastra で HTML コンテンツをチャンク化し、ドキュメントをセマンティックに分割します。
---

# HTML を意味的に分割する \{#semantically-chunking-html\}

HTML コンテンツを扱う際には、ドキュメント構造を保ちつつ、より小さく管理しやすい単位に分割する必要がよくあります。chunk メソッドは、HTML のタグや要素の整合性を保ちながら、HTML コンテンツを賢く分割します。この例では、検索や検索結果の取得などの目的で、HTML ドキュメントをどのように分割するかを示します。

```tsx copy
import { MDocument } from '@mastra/rag';

const html = `
<div>
    <h1>h1 content...</h1>
    <p>p content...</p>
</div>
`;

const doc = MDocument.fromHTML(html);

const chunks = await doc.chunk({
  headers: [
    ['h1', '見出し 1'],
    ['p', '段落'],
  ],
});

console.log(chunks);
```

<br />

<br />

<hr className="dark:border-[#404040] border-gray-300" />

<br />

<br />

<GithubLink
  link={
"https://github.com/mastra-ai/mastra/blob/main/examples/basics/rag/chunk-html"
}
/>
