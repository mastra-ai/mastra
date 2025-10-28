---
title: "ツール ストリーミング"
description: "Mastra におけるツール ストリーミングの使い方を学びます。ストリーミング中のツール呼び出し、ツール結果、ツール実行イベントの扱いを含みます。"
---

# ツールのストリーミング \{#tool-streaming\}

Mastra のツール・ストリーミングでは、実行が終わるのを待たずに、ツールが実行中の段階的な結果を送信できます。これにより、部分的な進捗や中間状態、逐次的なデータをユーザーや上流のエージェント／ワークフローへ直接提示できます。

ストリームへ書き込む方法は主に次の2つです。

* **ツール内から**: すべてのツールは `writer` 引数を受け取ります。これは、実行の進行に合わせて更新をプッシュできる書き込み可能なストリームです。
* **エージェントのストリームから**: エージェントの `stream` 出力をツールの `writer` に直接パイプでき、余計なグルーコードなしでエージェントの応答をツールの結果へシームレスにつなげられます。

書き込み可能なツール・ストリームとエージェントのストリーミングを組み合わせることで、中間結果がシステム内をどのように流れ、ユーザー体験へ届くかをきめ細かく制御できます。

## ツールを使うエージェント \{#agent-using-tool\}

エージェントのストリーミングはツール呼び出しと組み合わせられ、ツールの出力をエージェントのストリーミング応答に直接書き込めます。これにより、ツールの動作を全体のインタラクションの一部として可視化できます。

```typescript {4,10} showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';

import { testTool } from '../tools/test-tool';

export const testAgent = new Agent({
  name: 'test-agent',
  instructions: 'あなたは天気情報を提供するエージェントです。',
  model: openai('gpt-4o-mini'),
  tools: { testTool },
});
```

### `writer` 引数の使用 \{#using-the-writer-argument\}

`writer` 引数はツールの `execute` 関数に渡され、アクティブなストリームにカスタムイベント、データ、または値を出力するために使用できます。これにより、実行中でもツールが中間結果や進捗状況の更新を提供できるようになります。

:::warning

`writer.write(...)` の呼び出しは必ず `await` してください。そうしないとストリームがロックされ、`WritableStream is locked` エラーが発生します。

:::

```typescript {5,8,15} showLineNumbers copy
import { createTool } from "@mastra/core/tools";

export const testTool = createTool({
  // ...
  execute: async ({ context, writer }) => {
    const { value } = context;

   await writer?.write({
      status: "pending"
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
  }
});
```

### ストリームのペイロードを確認する \{#inspecting-stream-payloads\}

ストリームに書き込まれたイベントは、出力されるチャンクに含まれます。これらのチャンクを確認することで、イベントタイプや中間値、ツール固有のデータなどのカスタムフィールドにアクセスできます。

```typescript showLineNumbers copy
const stream = await testAgent.stream(['ロンドンの天気は?', 'testToolを使用してください']);

for await (const chunk of stream) {
  if (chunk.payload.output?.type === 'custom-event') {
    console.log(JSON.stringify(chunk, null, 2));
  }
}
```

## エージェントを使うツール \{#tool-using-an-agent\}

エージェントの `textStream` をツールの `writer` にパイプします。これにより部分出力がストリーミングされ、Mastra がエージェントの利用状況をツール実行に自動的に集約します。

```typescript showLineNumbers copy
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const testTool = createTool({
  // ...
  execute: async ({ context, mastra, writer }) => {
    const { city } = context;

    const testAgent = mastra?.getAgent('testAgent');
    const stream = await testAgent?.stream(`${city}の天気はどうですか?`);

    await stream!.textStream.pipeTo(writer!);

    return {
      value: await stream!.text,
    };
  },
});
```
