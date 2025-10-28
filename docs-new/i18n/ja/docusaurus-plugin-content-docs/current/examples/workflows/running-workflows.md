---
title: "ワークフローを実行する"
description: ワークフローの実行方法の例。
---

# ワークフローの実行 \{#running-workflows\}

ワークフローはさまざまな環境で実行できます。以下の例では、コマンドラインスクリプトを使って実行する方法、またはクライアントサイドコンポーネントから[Mastra Client SDK](/docs/server-db/mastra-client)を呼び出して実行する方法を示します。

## Mastra Client から \{#from-mastra-client\}

この例では、クライアント側のリクエストを [Mastra Client SDK](/docs/server-db/mastra-client) を使って実行します。`inputData` は、[sequentialSteps](./sequential-steps) の例で使用している `inputSchema` と一致しています。

```typescript filename="src/components/test-run-workflow.tsx"
import { mastraClient } from "../../lib/mastra-client";

export const TestWorkflow = () => {
  async function handleClick() {
    const workflow = await mastraClient.getWorkflow("sequentialSteps");

    const run = await workflow.createRunAsync();

    const result = await workflow.startAsync({
      runId: run.runId,
      inputData: {
        value: 10
      }
    });

    console.log(JSON.stringify(result, null, 2));
  }

  return <button onClick={handleClick}>ワークフローをテスト</button>;
};
```

> 詳細は [Mastra Client SDK](/docs/server-db/mastra-client) をご確認ください。

## コマンドラインから \{#from-the-command-line\}

この例では、`src` ディレクトリに実行スクリプトを追加しています。`inputData` は、[sequentialSteps](./sequential-steps) の例の `inputSchema` に適合しています。

```typescript filename="src/test-run-workflow.ts" showLineNumbers copy
import { mastra } from './mastra';

const run = await mastra.getWorkflow('sequentialSteps').createRunAsync();

const result = await run.start({
  inputData: {
    value: 10,
  },
});

console.log(result);
```

### スクリプトを実行する \{#run-the-script\}

次のコマンドでワークフローを実行します：

```bash
npx tsx src/test-run-workflow.ts
```

## curl から \{#from-curl\}

Mastra アプリケーションの `/start-async` エンドポイントに `POST` リクエストを送信すると、ワークフローを実行できます。ワークフローの `inputSchema` に適合する `inputData` を含めてください。

```bash
curl -X POST http://localhost:4111/api/workflows/sequentialSteps/start-async \
  -H "Content-Type: application/json" \
  -d '{
    "inputData": {
      "value": 10
    }
  }' | jq
```

## 出力例 \{#example-output\}

このワークフロー実行の出力は、次のようになります。

```json
{
  "status": "success",
  "steps": {
    "input": {
      "value": 10
    },
    "step-1": {
      "payload": {
        "value": 10
      },
      "startedAt": 1756823641918,
      "status": "success",
      "output": {
        "value": 10
      },
      "endedAt": 1756823641918
    },
    "step-2": {
      "payload": {
        "value": 10
      },
      "startedAt": 1756823641918,
      "status": "success",
      "output": {
        "value": 10
      },
      "endedAt": 1756823641918
    }
  },
  "result": {
    "value": 10
  }
}
```
