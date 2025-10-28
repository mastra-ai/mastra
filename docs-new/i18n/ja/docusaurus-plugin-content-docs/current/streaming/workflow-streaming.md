---
title: "ワークフローストリーミング"
description: "Mastra におけるワークフローストリーミングの使い方を学びます。ワークフロー実行イベントの処理、ステップのストリーミング、エージェントやツールとの統合までを解説します。"
---

# ワークフローのストリーミング \{#workflow-streaming\}

Mastra のワークフローストリーミングを使うと、完了を待たずに実行中の段階で増分結果を送信できます。これにより、部分的な進捗や中間状態、段階的なデータをユーザーや上流のエージェント／ワークフローに直接提示できます。

ストリームへの書き込み方法は主に次の2つです。

* **ワークフローのステップ内から**: すべてのワークフローステップは `writer` 引数を受け取り、実行の進行に合わせて更新をプッシュできる書き込み可能なストリームとして利用できます。
* **エージェントのストリームから**: エージェントの `stream` 出力をワークフローステップの `writer` に直接パイプでき、余分なグルーコードなしにエージェントの応答をワークフローの結果へと自然に連結できます。

書き込み可能なワークフローストリームとエージェントのストリーミングを組み合わせることで、中間結果がシステム内をどのように流れ、ユーザー体験へと届くかをきめ細かく制御できます。

### `writer` 引数の使用 \{#using-the-writer-argument\}

`writer` 引数はワークフローステップの `execute` 関数に渡され、アクティブなストリームにカスタムイベント、データ、または値を送出するために使用できます。これにより、実行が進行中でもワークフローステップが中間結果や進捗状況の更新を提供できるようになります。

:::warning

`writer.write(...)` の呼び出しは必ず `await` してください。そうしないとストリームがロックされ、`WritableStream is locked` エラーが発生します。

:::

```typescript {5,8,15} showLineNumbers copy
import { createStep } from "@mastra/core/workflows";

export const testStep = createStep({
  // ...
  execute: async ({ inputData, writer }) => {
     const { value } = inputData;

    await writer?.write({
      type: "custom-event",
      status: "pending"
    });

    const response = await fetch(...);

   await writer?.write({
      type: "custom-event",
      status: "success"
    });

    return {
      value: ""
    };
  },
});
```

### ワークフローストリームのペイロードを確認する \{#inspecting-workflow-stream-payloads\}

ストリームに書き込まれたイベントは、出力されるチャンクに含まれます。これらのチャンクを確認することで、イベントタイプ、中間値、ステップ固有のデータなどのカスタムフィールドにアクセスできます。

```typescript showLineNumbers copy
const testWorkflow = mastra.getWorkflow('testWorkflow');

const run = await testWorkflow.createRunAsync();

const stream = await run.stream({
  inputData: {
    value: 'initial data',
  },
});

for await (const chunk of stream) {
  console.log(chunk);
}

if (result!.status === 'suspended') {
  // ワークフローが中断されている場合は、resumeStreamVNextメソッドで再開できます
  const resumedStream = await run.resumeStreamVNext({
    resumeData: { value: 'resume data' },
  });

  for await (const chunk of resumedStream) {
    console.log(chunk);
  }
}
```

### 中断されたワークフロー ストリームの再開 \{#resuming-an-interrupted-workflow-stream\}

ワークフロー ストリームが何らかの理由で閉じられた、または中断された場合は、`resumeStreamVNext` メソッドで再開できます。これにより、新しい `ReadableStream` が返され、ワークフロー イベントを監視できます。

```typescript showLineNumbers copy
const newStream = await run.resumeStreamVNext();

for await (const chunk of newStream) {
  console.log(chunk);
}
```

## エージェントを使ったワークフロー \{#workflow-using-an-agent\}

エージェントの `textStream` をワークフローのステップの `writer` にパイプします。これにより部分的な出力がストリーミングされ、Mastra がエージェントの利用状況をワークフロー実行に自動的に集計します。

```typescript showLineNumbers copy
import { createStep } from '@mastra/core/workflows';
import { z } from 'zod';

export const testStep = createStep({
  // ...
  execute: async ({ inputData, mastra, writer }) => {
    const { city } = inputData;

    const testAgent = mastra?.getAgent('testAgent');
    const stream = await testAgent?.stream(`${city}の天気はどうですか?`);

    await stream!.textStream.pipeTo(writer!);

    return {
      value: await stream!.text,
    };
  },
});
```
