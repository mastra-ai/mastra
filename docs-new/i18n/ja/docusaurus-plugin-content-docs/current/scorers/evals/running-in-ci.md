---
title: "CI での実行"
description: "CI/CD パイプラインで Mastra の評価を実行し、エージェントの品質を継続的に監視する方法を学びます。"
---

# CI で Evals を実行する \{#running-evals-in-ci\}

:::info 新しい Scorer API

より扱いやすい API、エラー分析のための豊富なメタデータ、データ構造を評価する柔軟性を備えた新しい Evals 用 API「Scorers」をリリースしました。移行は比較的容易ですが、既存の Evals API も引き続きサポートします。

:::

CI パイプラインで Evals を実行することで、エージェントの品質を経時的に測定するための定量的な指標が得られ、このギャップを埋めるのに役立ちます。

## CI 連携のセットアップ \{#setting-up-ci-integration\}

ESM モジュールに対応したあらゆるテストフレームワークを利用できます。たとえば、CI/CD パイプラインで evals を実行するために [Vitest](https://vitest.dev/)、[Jest](https://jestjs.io/)、[Mocha](https://mochajs.org/) などを使用できます。

```typescript copy showLineNumbers filename="src/mastra/agents/index.test.ts"
import { describe, it, expect } from 'vitest';
import { evaluate } from '@mastra/evals';
import { ToneConsistencyMetric } from '@mastra/evals/nlp';
import { myAgent } from './index';

describe('My Agent', () => {
  it('トーンの一貫性を検証する', async () => {
    const metric = new ToneConsistencyMetric();
    const result = await evaluate(myAgent, 'Hello, world!', metric);

    expect(result.score).toBe(1);
  });
});
```

テストフレームワークで eval の結果を取得するには、testSetup と globalSetup のスクリプトを設定する必要があります。これにより、これらの結果を mastra のダッシュボードに表示できるようになります。

## フレームワークの構成 \{#framework-configuration\}

### Vitest のセットアップ \{#vitest-setup\}

CI/CD パイプラインで eval を実行するには、次のファイルをプロジェクトに追加してください：

```typescript copy showLineNumbers filename="globalSetup.ts"
import { globalSetup } from '@mastra/evals';

export default function setup() {
  globalSetup();
}
```

```typescript copy showLineNumbers filename="testSetup.ts"
import { beforeAll } from 'vitest';
import { attachListeners } from '@mastra/evals';

beforeAll(async () => {
  await attachListeners();
});
```

```typescript copy showLineNumbers filename="vitest.config.ts"
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: './globalSetup.ts',
    setupFiles: ['./testSetup.ts'],
  },
});
```

## ストレージの設定 \{#storage-configuration\}

評価結果を Mastra Storage に保存し、Mastra ダッシュボードで結果を確認するには:

```typescript copy showLineNumbers filename="testSetup.ts"
import { beforeAll } from 'vitest';
import { attachListeners } from '@mastra/evals';
import { mastra } from './your-mastra-setup';

beforeAll(async () => {
  // Mastra Storageに評価を保存(ストレージの有効化が必要)
  await attachListeners(mastra);
});
```

ファイルストレージを使用すると、eval は永続化され、後から照会できます。メモリストレージを使用すると、eval はテストプロセス内に限定されます。
