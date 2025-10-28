---
title: "ロギング"
description: Mastraでロギングを用いて実行状況を監視し、アプリケーションの動作を記録し、AIアプリケーションの精度を向上させる方法を学びます。
sidebar_position: 3
---

# ロギング \{#logging\}

Mastra のロギングシステムは、関数の実行、入力データ、出力レスポンスを構造化形式で記録します。

Mastra Cloud にデプロイすると、ログは [Logs](../mastra-cloud/observability) ページに表示されます。セルフホストや独自環境では、設定したトランスポートに応じて、ログをファイルや外部サービスへ出力できます。

## PinoLogger \{#pinologger\}

CLI を使って[新しい Mastra プロジェクトを初期化](../getting-started/installation)すると、`PinoLogger` は標準で含まれています。

```typescript filename="src/mastra/index.ts" showLineNumbers copy
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';

export const mastra = new Mastra({
  // ...
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
```

> 利用可能なすべての設定オプションについては、[PinoLogger](/docs/reference/observability/logging/pino-logger) の API リファレンスをご参照ください。

## ワークフローやツールからのロギング \{#logging-from-workflows-and-tools\}

Mastra では、ワークフローのステップ内とツール内の両方で利用できる `mastra.getLogger()` メソッドを通じて、ロガーインスタンスにアクセスできます。ロガーは `debug`、`info`、`warn`、`error` の標準的な重大度レベルをサポートします。

### ワークフローのステップからのロギング \{#logging-from-workflow-steps\}

ワークフローのステップ内では、`execute` 関数の `mastra` パラメータ経由でロガーにアクセスできます。これにより、そのステップの実行に関するメッセージを記録できます。

```typescript {8-9} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const step1 = createStep({
  //...
  execute: async ({ mastra }) => {

    const logger = mastra.getLogger();
    logger.info("ワークフロー情報ログ");

    return {
      output: ""
    };
  }
});

export const testWorkflow = createWorkflow({...})
  .then(step1)
  .commit();
```

### ツールからのログ出力 \{#logging-from-tools\}

同様に、ツールは `mastra` パラメータ経由でロガーインスタンスにアクセスできます。これを使って、実行中のツール固有の処理をログに記録します。

```typescript {8-9} filename="src/mastra/tools/test-tool.ts" showLineNumbers copy
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const testTool = createTool({
  // ...
  execute: async ({ mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info('tool info log');

    return {
      output: '',
    };
  },
});
```

## 追加データ付きのロギング \{#logging-with-additional-data\}

Logger の各メソッドは、追加データを渡すための任意の第2引数を受け取ります。これはオブジェクト、文字列、数値など、あらゆる値を指定できます。

この例では、ログメッセージに、キーが `agent`、値が `testAgent` インスタンスのオブジェクトが含まれます。

```typescript {11} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const step1 = createStep({
  //...
  execute: async ({ mastra }) => {

    const testAgent = mastra.getAgent("testAgent");

    const logger = mastra.getLogger();
    logger.info("ワークフロー情報ログ", { agent: testAgent });

    return {
      output: ""
    };
  }
});

export const testWorkflow = createWorkflow({...})
  .then(step1)
  .commit();
```
