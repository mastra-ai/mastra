---
title: "Networks"
description: "Mastra の Networks は、単一の API で個別または複数の Mastra プリミティブを非決定的に実行できる仕組みです。"
sidebar_position: 4
---

# Agent.network() \{#agentnetwork\}

`Agent.network()` は、複数の特化エージェントやワークフローを柔軟かつ組み合わせ可能、そして非決定的にオーケストレーションする手法を導入し、複雑な推論とタスクの完遂を可能にします。

このシステムは主に次の2つの課題を解決するために設計されています。

* 単一のエージェントでは不十分で、複数のエージェントやワークフロー間での協調、ルーティング、または逐次/並列実行が必要となるシナリオ。
* タスクが十分に定義されておらず、非構造化な入力から開始されるシナリオ。ネットワークにより、Agent は呼び出すべきプリミティブを見極め、非構造化の入力を構造化されたタスクへと変換できます。

## Workflows との違い \{#differences-from-workflows\}

* Workflows は、直線的または分岐型の手順の連なりで、実行フローは決定的になります。
* `Agent.network()` は LLM を用いた非決定的なオーケストレーション層を追加し、動的なマルチエージェント協調やルーティングを可能にします。これにより、実行フローは非決定的になります。

## 重要なポイント \{#important-details\}

* `network()` を使う際にエージェントへメモリを提供することは、任意ではありません。タスク履歴の保存に必須です。メモリは、どのプリミティブを実行するかの判断や、タスク完了の判定に用いられる中核的な要素です。
* 利用可能なプリミティブ（agent、workflow）は、それぞれの説明に基づいて選択されます。説明が的確であるほど、ルーティングエージェントは適切なプリミティブを選びやすくなります。workflow については、呼び出し時にどの入力を使うべきかを判断するため、入力スキーマも参照されます。より説明的でわかりやすい命名ほど、良い結果につながります。
* 機能が重複するプリミティブがある場合、エージェントはより特化度の高いプリミティブを使用します。たとえば agent と workflow の両方がリサーチを実行できるなら、workflow の入力スキーマを用いて、どのプリミティブを選ぶべきかを判断します。

## エージェントをネットワーク化する \{#turning-an-agent-into-a-network\}

例として、エージェントが利用できるプリミティブが3つあります:

* `agent1`: 指定されたトピックについて調査できる汎用のリサーチエージェント。
* `agent2`: 調査資料に基づいて完全なレポートを作成できる汎用のライティングエージェント。
* `workflow1`: 指定された都市について調査し、調査資料に基づいて完全なレポートを作成するワークフロー（agent1 と agent2 の両方を使用）。

複数のプリミティブを必要とするタスクを作成するには `network` メソッドを使用します。エージェントはメモリを用いて、どのプリミティブをどの順序で呼び出すか、またタスクがいつ完了したかを判断します。

```typescript
import { Agent } from '@mastra/core/agent';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { Memory } from '@mastra/memory';
import { openai } from '@ai-sdk/openai';
import { LibSQLStore } from '@mastra/libsql';
import { z } from 'zod';

const memory = new Memory({
  storage: new LibSQLStore({
    url: 'file:../mastra.db', // またはデータベースURL
  }),
});

const agentStep1 = createStep({
  id: 'agent-step',
  description: 'このステップは調査とテキスト合成に使用されます。',
  inputSchema: z.object({
    city: z.string().describe('調査対象の都市'),
  }),
  outputSchema: z.object({
    text: z.string(),
  }),
  execute: async ({ inputData }) => {
    const resp = await agent1.generate(inputData.city, {
      structuredOutput: {
        schema: z.object({
          text: z.string(),
        }),
      },
      maxSteps: 1,
    });

    return { text: resp.object.text };
  },
});

const agentStep2 = createStep({
  id: 'agent-step-two',
  description: 'このステップは調査とテキスト合成に使用されます。',
  inputSchema: z.object({
    text: z.string().describe('調査対象の都市'),
  }),
  outputSchema: z.object({
    text: z.string(),
  }),
  execute: async ({ inputData }) => {
    const resp = await agent2.generate(inputData.text, {
      structuredOutput: {
        schema: z.object({
          text: z.string(),
        }),
      },
      maxSteps: 1,
    });

    return { text: resp.object.text };
  },
});

const workflow1 = createWorkflow({
  id: 'workflow1',
  description:
    'このワークフローは特定の都市を調査するのに最適です。調査したい都市がある場合に使用してください。',
  steps: [],
  inputSchema: z.object({
    city: z.string(),
  }),
  outputSchema: z.object({
    text: z.string(),
  }),
})
  .then(agentStep1)
  .then(agentStep2)
  .commit();

const agent1 = new Agent({
  name: 'agent1',
  instructions:
    'このエージェントは調査に使用されますが、完全な回答は作成しません。箇条書きのみで簡潔に回答してください。',
  description:
    'このエージェントは調査に使用されますが、完全な回答は作成しません。箇条書きのみで簡潔に回答してください。',
  model: openai('gpt-4o'),
});

const agent2 = new Agent({
  name: 'agent2',
  description:
    'このエージェントは調査資料のテキスト合成に使用されます。調査資料に基づいて完全なレポートを作成します。レポートは完全な段落形式で記述します。異なるソースからのテキストを最終レポートとして統合する際に使用してください。',
  instructions:
    'このエージェントは調査資料のテキスト合成に使用されます。調査資料に基づいて完全なレポートを作成してください。箇条書きは使用せず、完全な段落形式で記述してください。最終レポートに箇条書きを一切含めないでください。',
  model: openai('gpt-4o'),
});

const routingAgent = new Agent({
  id: 'test-network',
  name: 'Test Network',
  instructions:
    'あなたはライターと調査員のネットワークです。ユーザーはトピックの調査を依頼します。常に完全なレポート形式で回答する必要があります。箇条書きは完全なレポートではありません。ブログ記事のような完全な段落形式で記述してください。部分的な情報に依存しないでください。',
  model: openai('gpt-4o'),
  agents: {
    agent1,
    agent2,
  },
  workflows: {
    workflow1,
  },
  memory: memory,
});

const runtimeContext = new RuntimeContext();

console.log(
  // タスクを指定します。ここで合成用のエージェント使用について言及していることに注意してください。これは、ルーティングエージェントが実際に結果を独自に合成できるため、代わりにagent2を使用させるためです
  await routingAgent.network(
    'フランスで最大の都市は何ですか?3つ教えてください。それらはどのような都市ですか?都市を見つけてから、各都市について徹底的に調査し、その情報をすべて統合した完全なレポートを作成してください。必ず合成用のエージェントを使用してください。',
    { runtimeContext },
  ),
);
```

与えられたタスク（フランスの主要3都市を調査し、詳細なレポートを作成する）に対して、AgentNetwork は次のプリミティブを呼び出します：

1. フランスの人口が多い都市トップ3を見つけるために `agent1` を使用します。
2. 各都市を順番に調査するために `workflow1` を使用します。ワークフローは、どの都市がすでに調査済みかを把握するために `memory` を使い、先に進む前にすべての都市の調査が完了していることを確認します。
3. 最終レポートを作成・統合するために `agent2` を使用します。

### 仕組み \{#how-it-works\}

* 基盤となるエンジンは、単一呼び出しの `generate` ワークフローをラップした Mastra のワークフローです。
* このワークフローは、ルーティングモデルがタスク完了と判断するまで、`dountil` 構造を用いてネットワーク実行ワークフローを繰り返し呼び出します。この判定は `dountil` の条件として使用されます。