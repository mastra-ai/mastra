---
title: "Human-in-the-loop（人間の関与）"
description: "Mastra のワークフローでは、.sleep()、.sleepUntil()、.waitForEvent() を使って外部からの入力やリソースを待つ間、実行を一時停止できます。"
sidebar_position: 7
---

# スリープとイベント \{#sleep-events\}

Mastra は、外部入力や時間条件を待つ間、ワークフローの実行を一時停止できます。これは、ポーリングや遅延リトライ、ユーザー操作の待機などに役立ちます。

実行を一時停止するには、次のメソッドを使用します:

* `sleep()`: 指定したミリ秒数だけ一時停止
* `sleepUntil()`: 指定したタイムスタンプまで一時停止
* `waitForEvent()`: 外部イベントを受信するまで一時停止
* `sendEvent()`: 待機中のワークフローを再開するイベントを送信

これらのいずれかのメソッドを使用すると、実行が再開されるまで、ワークフローのステータスは `waiting` に設定されます。

## `.sleep()` で一時停止する \{#pausing-with-sleep\}

`sleep()` メソッドは、指定したミリ秒間、ステップ間の処理を一時停止します。

```typescript {9} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const step1 = createStep({...});
const step2 = createStep({...});

export const testWorkflow = createWorkflow({...})
  .then(step1)
  .sleep(1000)
  .then(step2)
  .commit();
```

### `.sleep(callback)` で一時停止する \{#pausing-with-sleepcallback\}

`sleep()` メソッドは、一時停止するミリ秒数を返すコールバックも受け取ります。コールバックは `inputData` を受け取り、遅延時間を動的に算出できます。

```typescript {9} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const step1 = createStep({...});
const step2 = createStep({...});

export const testWorkflow = createWorkflow({...})
  .then(step1)
  .sleep(async ({ inputData }) => {
    const { delayInMs }  = inputData
    return delayInMs;
  })
  .then(step2)
  .commit();
```

## `.sleepUntil()` で一時停止する \{#pausing-with-sleepuntil\}

`sleepUntil()` メソッドは、指定した日時になるまで、ステップ間の処理を一時停止します。

```typescript {9} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const step1 = createStep({...});
const step2 = createStep({...});

export const testWorkflow = createWorkflow({...})
  .then(step1)
  .sleepUntil(new Date(Date.now() + 5000))
  .then(step2)
  .commit();
```

### `.sleepUntil(callback)` で一時停止する \{#pausing-with-sleepuntilcallback\}

`sleepUntil()` メソッドは、`Date` オブジェクトを返すコールバックも受け取ります。コールバックは `inputData` を受け取り、目標時刻を動的に算出できます。

```typescript {9} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const step1 = createStep({...});
const step2 = createStep({...});

export const testWorkflow = createWorkflow({...})
  .then(step1)
  .sleepUntil(async ({ inputData }) => {
    const { delayInMs }  = inputData
    return new Date(Date.now() + delayInMs);
  })
  .then(step2)
  .commit();
```

> `Date.now()` は、ワークフローの開始時に評価され、`sleepUntil()` メソッドが呼び出される瞬間に評価されるわけではありません。

## `.waitForEvent()` で一時停止する \{#pausing-with-waitforevent\}

`waitForEvent()` メソッドは、特定のイベントを受信するまで実行を一時停止します。イベントを送信するには `run.sendEvent()` を使用します。イベント名と、再開するステップの両方を指定する必要があります。

![.waitForEvent() で一時停止する](/img/workflows/workflows-sleep-events-waitforevent.jpg)

```typescript {10} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const step1 = createStep({...});
const step2 = createStep({...});
const step3 = createStep({...});

export const testWorkflow = createWorkflow({...})
  .then(step1)
  .waitForEvent("my-event-name", step2)
  .then(step3)
  .commit();
```

## `.sendEvent()` でイベントを送信する \{#sending-an-event-with-sendevent\}

`.sendEvent()` メソッドはワークフローにイベントを送信します。イベント名と、任意のイベントデータを受け取ります。イベントデータには、JSON でシリアライズ可能な任意の値を指定できます。

```typescript {5,12,15} filename="src/test-workflow.ts" showLineNumbers copy
import { mastra } from './mastra';

const run = await mastra.getWorkflow('testWorkflow').createRunAsync();

const result = run.start({
    value: 'こんにちは',
    value: 'hello',
  },
});

setTimeout(() => {
  run.sendEvent('my-event-name', { value: 'イベントより' });
}, 3000);

console.log(JSON.stringify(await result, null, 2));
```

> この例では、`await run.start()` を直接使用しないでください。ワークフローが待機状態に入る前にイベントの送信がブロックされてしまいます。
