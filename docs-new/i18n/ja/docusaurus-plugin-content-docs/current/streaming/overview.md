---
title: "ストリーミング概要"
description: "Mastraのストリーミングは、エージェントとワークフローの両方からリアルタイムで逐次的な応答を可能にし、AIによる生成過程で即時のフィードバックを提供します。"
---

# ストリーミングの概要 \{#streaming-overview\}

Mastra はエージェントやワークフローからのリアルタイムな逐次応答をサポートしており、ユーザーは処理の完了を待たずに、生成されるそばから出力を確認できます。これは、チャット、長文コンテンツ、複数ステップのワークフローなど、即時のフィードバックが重要となるあらゆる場面で有用です。

## はじめに \{#getting-started\}

Mastra のストリーミング API は、モデルのバージョンに応じて動作が変わります：

* **`.stream()`**：V2 モデル向け。**AI SDK v5**（`LanguageModelV2`）をサポートします。
* **`.streamLegacy()`**：V1 モデル向け。**AI SDK v4**（`LanguageModelV1`）をサポートします。

## エージェントでのストリーミング \{#streaming-with-agents\}

シンプルなプロンプトには単一の文字列を渡せます。複数の文脈を提供する場合は文字列の配列を、役割や会話の流れを細かく制御する場合は `role` と `content` を持つメッセージオブジェクトの配列を渡せます。

### `Agent.stream()` の使用 \{#using-agentstream\}

`textStream` はレスポンスを生成しながらチャンクに分割し、すべてが一度に届くのではなく段階的にストリーミングできるようにします。各チャンクを確認するために、`for await` ループで `textStream` を反復処理します。

```typescript {3,7} showLineNumbers copy
const testAgent = mastra.getAgent('testAgent');

const stream = await testAgent.stream([{ role: 'user', content: '一日の予定を立てるのを手伝って' }]);

for await (const chunk of stream.textStream) {
  process.stdout.write(chunk);
}
```

> 詳細は [Agent.stream()](/docs/reference/streaming/agents/stream) をご覧ください。

### `Agent.stream()` の出力 \{#output-from-agentstream\}

エージェントが生成する応答をストリーミング出力します。

```text
もちろんです！
一日を効果的に計画するために、もう少し情報をいただけますか。
ご検討いただきたい質問は次のとおりです。
…
```

## エージェント ストリームのプロパティ \{#agent-stream-properties\}

エージェント ストリームでは、さまざまなレスポンスのプロパティにアクセスできます:

* **`stream.textStream`**: テキストのチャンクを出力する読み取り可能なストリーム。
* **`stream.text`**: 完全なテキストレスポンスで解決される Promise。
* **`stream.finishReason`**: エージェントがストリーミングを終了した理由。
* **`stream.usage`**: トークン使用量に関する情報。

### AI SDK v5 の互換性 \{#ai-sdk-v5-compatibility\}

AI SDK v5 はモデルプロバイダーとして `LanguageModelV2` を使用します。AI SDK v4 のモデルを使用しているというエラーが表示される場合は、モデルパッケージを次のメジャーバージョンにアップグレードしてください。

AI SDK v5 と統合するには、`format` &#39;aisdk&#39; を指定して `AISDKV5OutputStream` を取得します:

```typescript {5} showLineNumbers copy
const testAgent = mastra.getAgent('testAgent');

const stream = await testAgent.stream([{ role: 'user', content: '今日の予定を立てるのを手伝って' }], { format: 'aisdk' });

for await (const chunk of stream.textStream) {
  process.stdout.write(chunk);
}
```

## ワークフローでのストリーミング \{#streaming-with-workflows\}

ワークフローからのストリーミングでは、増分的なテキストチャンクではなく、実行のライフサイクルを表す一連の構造化イベントが返されます。このイベントベースの形式により、`.createRunAsync()` で実行が作成されると、ワークフローの進行状況をリアルタイムに追跡して応答できます。

### `Run.streamVNext()` の使用 \{#using-runstreamvnext\}

これは実験的な API です。イベントの `ReadableStream` を直接返します。

```typescript {3,9} showLineNumbers copy
const run = await testWorkflow.createRunAsync();

const stream = await run.streamVNext({
  inputData: {
    value: '初期データ',
  },
});

for await (const chunk of stream) {
  console.log(chunk);
}
```

> 詳細は [Run.streamVNext()](/docs/reference/streaming/workflows/streamVNext) をご覧ください。

### `Run.stream()` の出力 \{#output-from-runstream\}

実験的な API のイベント構造では、トップレベルに `runId` と `from` が含まれているため、ペイロードを掘り下げなくてもワークフロー実行の特定と追跡が容易になります。

```typescript
// …
{
  type: 'step-start',
  runId: '1eeaf01a-d2bf-4e3f-8d1b-027795ccd3df',
  from: 'WORKFLOW',
  payload: {
    stepName: 'step-1',
    args: { value: 'initial data' },
    stepCallId: '8e15e618-be0e-4215-a5d6-08e58c152068',
    startedAt: 1755121710066,
    status: 'running'
  }
}
```

## ワークフローストリームのプロパティ \{#workflow-stream-properties\}

ワークフローストリームでは、次のレスポンスプロパティにアクセスできます:

* **`stream.status`**: ワークフロー実行のステータス
* **`stream.result`**: ワークフロー実行の結果
* **`stream.usage`**: ワークフロー実行で消費したトークンの合計

## 関連項目 \{#related\}

* [イベントのストリーミング](./events)
* [エージェントの使用](../agents/overview)
* [ワークフローの概要](../workflows/overview)