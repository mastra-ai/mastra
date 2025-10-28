---
title: "チャンク区切りの調整"
description: コンテンツ構造により適合させるために、Mastra のチャンク区切りを調整します。
---

# チャンクの区切り文字を調整する \{#adjust-chunk-delimiters\}

大規模なドキュメントを処理する際、テキストを小さなチャンクに分割する方法を制御したい場合があります。既定ではドキュメントは改行で分割されますが、コンテンツの構造により適合するようにこの動作をカスタマイズできます。次の例では、ドキュメントをチャンク化するためのカスタム区切り文字を指定する方法を示します。

```tsx copy
import { MDocument } from '@mastra/rag';

const doc = MDocument.fromText('プレーンテキストの内容...');

const chunks = await doc.chunk({
  separator: '\n',
});
```

<br />

<br />

<hr className="dark:border-[#404040] border-gray-300" />

<br />

<br />

<GithubLink
  link={
"https://github.com/mastra-ai/mastra/blob/main/examples/basics/rag/adjust-chunk-delimiters"
}
/>
