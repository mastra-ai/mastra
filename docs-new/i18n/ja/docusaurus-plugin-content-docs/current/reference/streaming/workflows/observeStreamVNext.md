---
title: "Run.observeStreamVNext() "
description: ワークフローでの `Run.observeStreamVNext()` メソッドのドキュメント。既に実行中のワークフローのストリームを再度開くことができます。
---

# Run.observeStreamVNext() (実験的) \{#runobservestreamvnext-experimental\}

`.observeStreamVNext()` メソッドは、現在実行中のワークフロー ランに対して新しい `ReadableStream` を開き、元のストリームが利用できない場合でもイベントのストリームを監視できるようにします。

## 使い方の例 \{#usage-example\}

```typescript showLineNumbers copy
const run = await workflow.createRunAsync();

run.streamVNext({
  inputData: {
    value: '初期データ',
  },
});

const stream = await run.observeStreamVNext();

for await (const chunk of stream) {
  console.log(chunk);
}
```

## 戻り値 \{#returns\}

`ReadableStream<ChunkType>`

## ストリームイベント \{#stream-events\}

ストリームはワークフローの実行中にさまざまなイベントタイプを発生させます。各イベントには `type` フィールドと、関連データを含む `payload` が含まれます：

* **`workflow-start`**: ワークフローの実行が開始される
* **`workflow-step-start`**: ステップの実行が開始される
* **`workflow-step-output`**: ステップからのカスタム出力
* **`workflow-step-result`**: ステップが結果とともに完了する
* **`workflow-finish`**: 使用状況の統計とともにワークフローの実行が完了する

## 関連項目 \{#related\}

* [Workflows の概要](/docs/workflows/overview#testing-workflows-locally)
* [Workflow.createRunAsync()](../../../reference/workflows/workflow-methods/create-run)
* [Run.streamVNext()](./streamVNext)
* [Run.resumeStreamVNext()](./resumeStreamVNext)