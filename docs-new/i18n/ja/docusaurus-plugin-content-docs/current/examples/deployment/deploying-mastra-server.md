---
title: Mastra サーバーのデプロイ
description: '```bash showLineNumbers'
---

アプリケーションをビルドし、生成された HTTP サーバーを起動します：

```bash showLineNumbers
mastra build
node .mastra/output/index.mjs
```

生成されたサーバーにテレメトリーを組み込むには:

```bash showLineNumbers
node --import=./.mastra/output/instrumentation.mjs .mastra/output/index.mjs
```
