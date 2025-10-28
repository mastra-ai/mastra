---
title: "Run.observeStream()"
description: ワークフローの `Run.observeStream()` メソッドに関するドキュメント。既にアクティブなワークフロー実行のストリームを再度開くことができます。
---

# Run.observeStream() \{#runobservestream\}

`.observeStream()` メソッドは、現在進行中のワークフロー実行に対して新たに `ReadableStream` を開き、元のストリームが利用できない場合でもイベントのストリームを監視できるようにします。

## 使用例 \{#usage-example\}

```typescript showLineNumbers copy
const run = await workflow.createRunAsync();

run.stream({
  inputData: {
    value: '初期データ',
  },
});

const { stream } = await run.observeStream();

for await (const chunk of stream) {
  console.log(chunk);
}
```

## 戻り値 \{#returns\}

`ReadableStream<ChunkType>`

## ストリームイベント \{#stream-events\}

ストリームはワークフローの実行中にさまざまなイベントを発行します。各イベントには `type` フィールドと、関連データを含む `payload` が含まれます。

* **`start`**: ワークフローの実行が開始される
* **`step-start`**: ステップの実行が開始される
* **`tool-call`**: ツール呼び出しが開始される
* **`tool-call-streaming-start`**: ツール呼び出しのストリーミングが開始される
* **`tool-call-delta`**: ツール出力の増分更新
* **`step-result`**: ステップが結果とともに完了する
* **`step-finish`**: ステップの実行が終了する
* **`finish`**: ワークフローの実行が完了する

## 関連情報 \{#related\}

* [Workflows の概要](/docs/workflows/overview#testing-workflows-locally)
* [Workflow.createRunAsync()](../../../reference/workflows/workflow-methods/create-run)
* [Run.stream()](./stream)