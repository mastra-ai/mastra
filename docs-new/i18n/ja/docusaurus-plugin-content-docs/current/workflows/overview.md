---
title: "概要"
description: "Mastra の Workflows は、分岐、並列実行、リソースのサスペンドなどの機能により、複雑なタスクの処理フローを効率的にオーケストレーションできます。"
sidebar_position: 1
---

# ワークフローの概要 \{#workflows-overview\}

ワークフローは、明確で構造化されたプロセスでタスクを結び付け、複雑な一連の作業を定義・管理できるようにします。単独で動作する1つのエージェントとは異なり、ワークフローでは特定のロジックやツール、外部サービスを組み合わせて複数のステップを統合的に制御できます。これにより、どのタスクをいつ実行・完了させるかを明確に定められるため、コントロール性と予測可能性が高まり、一貫した結果を得られます。

![ワークフローの概要](/img/workflows/workflows-overview.jpg)

## ワークフローを使うタイミング \{#when-to-use-a-workflow\}

たとえば、次のような一連のタスクを実行したい場合があります。

1. 「直近の注文を返品できますか？」といったユーザーからの質問に対応する
2. `user_id` を用いてデータベースからユーザー固有のデータを取得する
3. 外部 API やビジネスロジックで返品可否を確認する
4. データに基づいて条件分岐の判断（例：承認・却下・エスカレーション）を行う
5. 結果に応じて適切にカスタマイズした返答を生成する

これらの各タスクはワークフロー内の**ステップ**として作成され、データフロー、実行順序、副作用をきめ細かく制御できます。

> **📹 視聴**: → ワークフローの概要と、エージェントとの比較 [YouTube（7分）](https://youtu.be/0jg2g3sNvgw)

## ワークフローの構築 \{#building-workflows\}

ワークフローは次の手順で作成します:

* `createStep` で**ステップ**を定義し、入出力スキーマとビジネスロジックを指定します。
* `createWorkflow` で**ステップ**を組み合わせ、実行フローを定義します。
* **ワークフロー**を実行して一連の処理を走らせます。サスペンド、再開、結果のストリーミングに標準で対応しています。

この構成により、型安全性が完全に担保され、実行時検証も行われるため、ワークフロー全体でデータ整合性が保証されます。

### ビジュアルテスト \{#visual-testing\}

[Playground](/docs/getting-started/local-dev-playground#workflows) を使って、ワークフローの実行状況をリアルタイムに可視化できます。どのステップが実行中、完了、あるいは一時停止中かが表示されます。

## はじめに \{#getting-started\}

Workflows を使用するには、必要な依存関係をインストールしてください。

```bash
npm install @mastra/core
```

`workflows` サブパスから必要な関数をインポートします：

```typescript filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
```

### ステップの作成 \{#create-step\}

ステップはワークフローの基本単位です。`createStep` を使ってステップを作成します:

```typescript filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
const step1 = createStep({...});
```

> 詳細は [createStep](/docs/reference/workflows/step) をご覧ください。

### ワークフローの作成 \{#create-workflow\}

`createWorkflow` を使ってワークフローを作成し、`.commit()` で確定します。

```typescript {6,17} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const step1 = createStep({...});

export const testWorkflow = createWorkflow({
  id: "test-workflow",
  description: 'テスト用ワークフロー',
  inputSchema: z.object({
    input: z.string()
  }),
  outputSchema: z.object({
    output: z.string()
  })
})
  .then(step1)
  .commit();
```

> 詳細は [workflow](/docs/reference/workflows/workflow) をご覧ください。

#### ステップの組み合わせ \{#composing-steps\}

Workflow のステップは、`.then()` を使って組み合わせ、順次実行できます。

```typescript {17,18} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const step1 = createStep({...});
const step2 = createStep({...});

export const testWorkflow = createWorkflow({
  id: "test-workflow",
  description: 'テストワークフロー',
  inputSchema: z.object({
    input: z.string()
  }),
  outputSchema: z.object({
    output: z.string()
  })
})
  .then(step1)
  .then(step2)
  .commit();
```

> ステップはさまざまな方法で組み合わせて作成できます。詳しくは [Control Flow](./control-flow) を参照してください。

#### 手順のクローン \{#cloning-steps\}

ワークフローの手順は `cloneStep()` でクローンでき、どのワークフロー用メソッドでも使用できます。

```typescript {5,19} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { createWorkflow, createStep, cloneStep } from "@mastra/core/workflows";
import { z } from "zod";

const step1 = createStep({...});
const clonedStep = cloneStep(step1, { id: "cloned-step" });
const step2 = createStep({...});

export const testWorkflow = createWorkflow({
  id: "test-workflow",
  description: 'テストワークフロー'
  inputSchema: z.object({
    input: z.string()
  }),
  outputSchema: z.object({
    output: z.string()
  })
})
  .then(step1)
  .then(clonedStep)
  .then(step2)
  .commit();
```

## ワークフローの登録 \{#register-workflow\}

メインの Mastra インスタンスで `workflows` を使ってワークフローを登録します。

```typescript {8} filename="src/mastra/index.ts" showLineNumbers copy
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';

import { testWorkflow } from './workflows/test-workflow';

export const mastra = new Mastra({
  workflows: { testWorkflow },
  storage: new LibSQLStore({
    // テレメトリや評価などをメモリストレージに保存します。永続化が必要な場合は file:../mastra.db に変更してください
    url: ':memory:',
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
```

## ワークフローをローカルでテストする \{#testing-workflows-locally\}

ワークフローを実行してテストする方法は2通りあります。

### Mastra Playground \{#mastra-playground\}

Mastra Dev Server が稼働している状態で、ブラウザで [http://localhost:4111/workflows](http://localhost:4111/workflows) にアクセスすると、Mastra Playground からワークフローを実行できます。

> 詳細は、[Local Dev Playground](/docs/getting-started/local-dev-playground) のドキュメントをご参照ください。

### コマンドライン \{#command-line\}

`createRunAsync` と `start` を使ってワークフローの実行インスタンスを作成します：

```typescript {3,5} filename="src/test-workflow.ts" showLineNumbers copy
import 'dotenv/config';

import { mastra } from './mastra';

const run = await mastra.getWorkflow('testWorkflow').createRunAsync();

const result = await run.start({
  inputData: {
    city: 'ロンドン',
  },
});

console.log(result);

if (result.status === 'success') {
  console.log(result.result.output);
}
```

> 詳細は [createRunAsync](/docs/reference/workflows/run) と [start](/docs/reference/workflows/run-methods/start) を参照してください。

このワークフローを開始するには、次を実行します:

```bash copy
npx tsx src/test-workflow.ts を実行
```

### ワークフローの実行結果 \{#run-workflow-results\}

`start()` または `resume()` を使ってワークフローを実行すると、結果に応じて次のいずれかの形になります。

#### 成功ステータス \{#status-success\}

```json
{
  "status": "success",
  "steps": {
    // ...
    "step-1": {
      // ...
      "status": "success"
    }
  },
  "result": {
    "output": "ロンドン + ステップ1"
  }
}
```

* **status**: ワークフロー実行の最終状態を示します。`success`、`suspended`、`error` のいずれかです
* **steps**: 入力と出力を含め、ワークフロー内の各ステップを一覧表示します
* **status**: 各ステップの結果を示します
* **result**: `outputSchema` に従って型付けされたワークフローの最終出力を含みます

#### ステータス: 停止中 \{#status-suspended\}

```json
{
  "status": "保留",
  "steps": {
    // ...
    "step-1": {
      // ...
      "status": "保留"
    }
  },
  "suspended": [["step-1"]]
}
```

* **suspended**: 続行前に入力待ちのステップを列挙する任意の配列

#### ステータス: 失敗 \{#status-failed\}

```json
{
  "status": "失敗",
  "steps": {
    // ...
    "step-1": {
      // ...
      "status": "失敗",
      "error": "テストエラー",
    }
  },
  "error": "テストエラー"
}
```

* **error**: ワークフローが失敗した場合にエラーメッセージを含む、任意のフィールド

## ワークフローのストリーミング \{#stream-workflow\}

上で示した run メソッドと同様に、ワークフローもストリーミングできます。

```typescript {5} filename="src/test-workflow.ts" showLineNumbers copy
import { mastra } from './mastra';

const run = await mastra.getWorkflow('testWorkflow').createRunAsync();

const result = await run.stream({
  inputData: {
    city: 'London',
  },
});

for await (const chunk of result.stream) {
  console.log(chunk);
}
```

> 詳細は [stream](/docs/reference/streaming/workflows/stream) をご覧ください。

## ワークフローの監視 \{#watch-workflow\}

ワークフローをウォッチして、発行される各イベントを確認できます。

```typescript {5} filename="src/test-workflow.ts" showLineNumbers copy
import { mastra } from './mastra';

const run = await mastra.getWorkflow('testWorkflow').createRunAsync();

run.watch(event => {
  console.log(event);
});

const result = await run.start({
  inputData: {
    city: 'ロンドン',
  },
});
```

> 詳細は [watch](/docs/reference/workflows/run-methods/watch) をご覧ください。

## 関連 \{#related\}

* ガイドセクションの[Workflow Guide](/docs/guides/guide/ai-recruiter)は、主要概念を解説するチュートリアルです。
* [Parallel Steps のワークフロー例](/docs/examples/workflows/parallel-steps)
* [Conditional Branching のワークフロー例](/docs/examples/workflows/conditional-branching)
* [Inngest のワークフロー例](/docs/examples/workflows/inngest-workflow)
* [Suspend and Resume のワークフロー例](/docs/examples/workflows/human-in-the-loop)

## ワークフロー（レガシー） \{#workflows-legacy\}

レガシー版ワークフローのドキュメントは、[Creating a Workflow (Legacy)](/docs/examples/workflows_legacy/creating-a-workflow) を参照してください。