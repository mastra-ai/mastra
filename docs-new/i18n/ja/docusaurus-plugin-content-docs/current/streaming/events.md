---
title: "イベント"
description: "Mastra におけるストリーミングイベントの種類（テキストデルタ、ツール呼び出し、ステップイベントなど）と、それらをアプリケーションでの扱い方について学びます。"
---

# イベント \{#events\}

エージェントやワークフローからのストリーミングは、LLM の出力やワークフロー実行の状態をリアルタイムに可視化します。このフィードバックはユーザーに直接届けることも、アプリ内でワークフローの状態管理に活用して、よりスムーズで応答性の高い体験を実現することもできます。

エージェントやワークフローが発行するイベントは、実行の開始、テキストの生成、ツールの呼び出しなど、生成や実行の各段階を表します。

## イベントタイプ \{#event-types\}

以下は、`.stream()` から送出されるイベントの全一覧です。
**agent** か **workflow** のどちらをストリーミングするかによって、発生するイベントはその一部に限られます:

* **start**: agent または workflow の実行開始を示します。
* **step-start**: workflow のステップの実行が開始されたことを示します。
* **text-delta**: LLM が生成するテキストの増分チャンク。
* **tool-call**: agent がツールの使用を決定したとき（ツール名と引数を含む）。
* **tool-result**: ツール実行の結果。
* **step-finish**: 特定のステップが完全に終了したことを示し、そのステップの終了理由などのメタデータを含む場合があります。
* **finish**: agent または workflow の処理が完了したとき（使用量の統計を含む）。

## エージェントのストリームを確認する \{#inspecting-agent-streams\}

発生したすべてのイベントチャンクを確認するには、`for await` ループで `stream` を反復処理します。

```typescript {3,7} showLineNumbers copy
const testAgent = mastra.getAgent('testAgent');

const stream = await testAgent.stream([{ role: 'user', content: '今日の予定を整理するのを手伝って' }]);

for await (const chunk of stream) {
  console.log(chunk);
}
```

> 詳細は [Agent.stream()](/docs/reference/streaming/agents/stream) をご覧ください。

### エージェント出力の例 \{#example-agent-output\}

以下は、送出される可能性のあるイベントの例です。各イベントには必ず `type` が含まれ、`from` や `payload` などの追加フィールドが含まれる場合があります。

```typescript {2,7,15}
{
  type: 'start',
  from: 'AGENT',
  // ..
}
{
  type: 'step-start',
  from: 'AGENT',
  payload: {
    messageId: 'msg-cdUrkirvXw8A6oE4t5lzDuxi',
    // ...
  }
}
{
  type: 'tool-call',
  from: 'AGENT',
  payload: {
    toolCallId: 'call_jbhi3s1qvR6Aqt9axCfTBMsA',
    toolName: 'testTool'
    // ..
  }
}
```

## ワークフローのストリームを確認する \{#inspecting-workflow-streams\}

発行されたすべてのイベントチャンクを確認するには、`for await` ループで `stream` を反復処理します。

```typescript {5,11} showLineNumbers copy
const testWorkflow = mastra.getWorkflow('testWorkflow');

const run = await testWorkflow.createRunAsync();

const stream = await run.stream({
  inputData: {
    value: '初期データ',
  },
});

for await (const chunk of stream) {
  console.log(chunk);
}
```

### ワークフロー出力の例 \{#example-workflow-output\}

以下は、送出される可能性のあるイベントの例です。各イベントには必ず `type` が含まれ、`from` や `payload` などの追加フィールドが含まれる場合があります。

```typescript {2,8,11}
{
  type: 'workflow-start',
  runId: '221333ed-d9ee-4737-922b-4ab4d9de73e6',
  from: 'WORKFLOW',
  // ...
}
{
  type: 'workflow-step-start',
  runId: '221333ed-d9ee-4737-922b-4ab4d9de73e6',
  from: 'WORKFLOW',
  payload: {
    stepName: 'step-1',
    args: { value: '初期データ' },
    stepCallId: '9e8c5217-490b-4fe7-8c31-6e2353a3fc98',
    startedAt: 1755269732792,
    status: '実行中'
  }
}
```
