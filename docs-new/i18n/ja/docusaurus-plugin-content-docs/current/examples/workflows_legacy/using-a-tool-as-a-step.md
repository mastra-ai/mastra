---
title: "ステップとしてツールを使用する"
description: レガシーなワークフローにカスタムツールをステップとして統合するためにMastraを使用する例。
---

# ワークフローのステップとしてのツール（レガシー） \{#tool-as-a-workflow-step-legacy\}

この例では、カスタムツールをワークフローのステップとして作成して統合する方法を示し、入力・出力スキーマの定義とツールの実行ロジックの実装方法を解説します。

```ts showLineNumbers copy
import { createTool } from '@mastra/core/tools';
import { LegacyWorkflow } from '@mastra/core/workflows/legacy';
import { z } from 'zod';

const crawlWebpage = createTool({
  id: 'Crawl Webpage',
  description: 'ウェブページをクロールしてテキスト内容を抽出します',
  inputSchema: z.object({
    url: z.string().url(),
  }),
  outputSchema: z.object({
    rawText: z.string(),
  }),
  execute: async ({ context }) => {
    const response = await fetch(context.triggerData.url);
    const text = await response.text();
    return { rawText: 'ウェブページのテキスト内容: ' + text };
  },
});

const contentWorkflow = new LegacyWorkflow({ name: 'content-review' });

contentWorkflow.step(crawlWebpage).commit();

const { start } = contentWorkflow.createRun();

const res = await start({ triggerData: { url: 'https://example.com' } });

console.log(res.results);
```

<br />

<br />

<hr className="dark:border-[#404040] border-gray-300" />

<br />

<br />

<GithubLink
  link={
"https://github.com/mastra-ai/mastra/blob/main/examples/basics/workflows-legacy/tool-as-workflow-step"
}
/>

## ワークフロー（レガシー） \{#workflows-legacy\}

以下のリンクは、レガシー版ワークフローのサンプルドキュメントです。

* [シンプルなワークフローの作成（レガシー）](/docs/examples/workflows_legacy/creating-a-workflow)
* [順次ステップのワークフロー（レガシー）](/docs/examples/workflows_legacy/sequential-steps)
* [ステップの並列実行](/docs/examples/workflows_legacy/parallel-steps)
* [分岐パス](/docs/examples/workflows_legacy/branching-paths)
* [条件分岐付きワークフロー（レガシー・実験的）](/docs/examples/workflows_legacy/conditional-branching)
* [ワークフロー（レガシー）からのエージェント呼び出し](/docs/examples/workflows_legacy/calling-agent)
* [循環依存関係のあるワークフロー（レガシー）](/docs/examples/workflows_legacy/cyclical-dependencies)
* [ワークフロー変数によるデータマッピング（レガシー）](/docs/examples/workflows_legacy/workflow-variables)
* [Human-in-the-Loop ワークフロー（レガシー）](/docs/examples/workflows_legacy/human-in-the-loop)
* [一時停止と再開に対応したワークフロー（レガシー）](/docs/examples/workflows_legacy/suspend-and-resume)