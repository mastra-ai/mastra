---
title: "チャンクサイズの調整"
description: Mastra でチャンクサイズを調整し、コンテンツやメモリ要件により適合させます。
---

# チャンクサイズの調整 \{#adjust-chunk-size\}

大規模なドキュメントを処理する際は、各チャンクに含めるテキスト量を調整する必要が生じることがあります。デフォルトではチャンクの長さは1024文字ですが、コンテンツやメモリ要件に合わせてこのサイズをカスタマイズできます。以下の例では、ドキュメントを分割する際にカスタムのチャンクサイズを設定する方法を示します。

```tsx copy
import { MDocument } from '@mastra/rag';

const doc = MDocument.fromText('プレーンテキストの内容…');

const chunks = await doc.chunk({
  size: 512,
});
```

<br />

<br />

<hr className="dark:border-[#404040] border-gray-300" />

<br />

<br />

<GithubLink
  link={
"https://github.com/mastra-ai/mastra/blob/main/examples/basics/rag/adjust-chunk-size"
}
/>
