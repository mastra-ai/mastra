---
title: "ステップのリトライ"
description: "設定可能なリトライポリシーで、Mastra のワークフロー内で失敗したステップを自動的に再試行します。"
---

# ステップの再試行 \{#step-retries\}

Mastra には、ワークフローのステップで発生する一時的な失敗に対処するための再試行メカニズムが組み込まれています。これにより、手動での介入なしに、ワークフローは一時的な問題からスムーズに復旧できます。

## 概要 \{#overview\}

ワークフロー内のステップが失敗（例外をスロー）した場合、Mastra は設定可能なリトライポリシーに基づいてそのステップの実行を自動的に再試行できます。これは次のような事象への対処に有効です:

* ネットワーク接続の問題
* サービスの停止・不通
* レート制限
* 一時的なリソース不足
* その他の一過性の障害

## デフォルトの動作 \{#default-behavior\}

デフォルトでは、ステップは失敗しても再試行しません。これは次のことを意味します：

* ステップは1回だけ実行される
* 失敗した場合、そのステップは直ちに失敗としてマークされる
* ワークフローは、失敗したステップに依存しない後続のステップの実行を継続する

## 設定オプション \{#configuration-options\}

リトライは2つのレベルで設定できます：

### 1. ワークフローレベルの設定 \{#1-workflow-level-configuration\}

ワークフロー内のすべてのステップに適用される再試行のデフォルト設定を指定できます。

```typescript
const workflow = new LegacyWorkflow({
  name: 'my-workflow',
  retryConfig: {
    attempts: 3, // リトライ回数(初回試行に加えて)
    delay: 1000, // リトライ間隔(ミリ秒)
  },
});
```

### 2. ステップレベルの設定 \{#2-step-level-configuration\}

個別のステップごとにリトライを設定することもでき、そのステップについてはワークフローレベルの設定が上書きされます。

```typescript
const fetchDataStep = new LegacyStep({
  id: 'fetchData',
  execute: async () => {
    // 外部APIからデータを取得
  },
  retryConfig: {
    attempts: 5, // このステップは最大5回までリトライします
    delay: 2000, // リトライ間の待機時間は2秒です
  },
});
```

## リトライのパラメータ \{#retry-parameters\}

`retryConfig` オブジェクトは次のパラメータをサポートします:

| パラメータ | 型     | 既定値 | 説明                                                            |
| ---------- | ------ | ------ | ---------------------------------------------------------------- |
| `attempts` | number | 0      | リトライの試行回数（初回の試行とは別に行う回数）                 |
| `delay`    | number | 1000   | リトライ間の待機時間（ミリ秒）                                  |

## リトライの仕組み \{#how-retries-work\}

ステップが失敗した場合、Mastra のリトライ機構は次のように動作します:

1. ステップに残りのリトライ回数があるか確認する
2. 残り回数がある場合:
   * 試行回数カウンタをデクリメントする
   * ステップを「waiting」状態へ遷移させる
   * 設定された遅延時間だけ待機する
   * ステップの実行を再試行する
3. 残り回数がない、またはすべての試行を使い切った場合:
   * ステップを「failed」としてマークする
   * （失敗したステップに依存しないステップについては）ワークフローの実行を継続する

リトライ中、ワークフローの実行自体はアクティブのままですが、リトライ対象の特定のステップは一時停止されます。

## 例 \{#examples\}

### 基本的な再試行の例 \{#basic-retry-example\}

```typescript
import { LegacyWorkflow, LegacyStep } from '@mastra/core/workflows/legacy';

// 失敗する可能性のあるステップを定義
const unreliableApiStep = new LegacyStep({
  id: 'callUnreliableApi',
  execute: async () => {
    // 失敗する可能性のある API 呼び出しを模擬
    const random = Math.random();
    if (random < 0.7) {
      throw new Error('API 呼び出しに失敗しました');
    }
    return { data: 'API レスポンスデータ' };
  },
  retryConfig: {
    attempts: 3, // 最大 3 回までリトライ
    delay: 2000, // リトライ間隔は 2 秒
  },
});

// 信頼性の低いステップを用いたワークフローを作成
const workflow = new LegacyWorkflow({
  name: 'retry-demo-workflow',
});

workflow.step(unreliableApiStep).then(processResultStep).commit();
```

### ステップのオーバーライドによるワークフロー全体のリトライ \{#workflow-level-retries-with-step-override\}

```typescript
import { LegacyWorkflow, LegacyStep } from '@mastra/core/workflows/legacy';

// デフォルトのリトライ設定でワークフローを作成
const workflow = new LegacyWorkflow({
  name: 'multi-retry-workflow',
  retryConfig: {
    attempts: 2, // すべてのステップはデフォルトで2回リトライします
    delay: 1000, // 1秒の遅延
  },
});

// このステップはワークフローのデフォルトのリトライ設定を使用します
const standardStep = new LegacyStep({
  id: 'standardStep',
  execute: async () => {
    // 失敗する可能性のある処理
  },
});

// このステップはワークフローのリトライ設定を上書きします
const criticalStep = new LegacyStep({
  id: 'criticalStep',
  execute: async () => {
    // より多くのリトライが必要な重要な処理
  },
  retryConfig: {
    attempts: 5, // 5回のリトライで上書き
    delay: 5000, // より長い5秒の遅延
  },
});

// このステップはリトライを無効にします
const noRetryStep = new LegacyStep({
  id: 'noRetryStep',
  execute: async () => {
    // リトライすべきでない処理
  },
  retryConfig: {
    attempts: 0, // リトライを明示的に無効化
  },
});

workflow.step(standardStep).then(criticalStep).then(noRetryStep).commit();
```

## リトライの監視 \{#monitoring-retries\}

ログでリトライ試行を監視できます。Mastra はリトライ関連のイベントを `debug` レベルで記録します。

```
[DEBUG] ステップ fetchData が失敗しました（runId: abc-123）
[DEBUG] ステップ fetchData の試行回数: 残り 2 回（runId: abc-123）
[DEBUG] ステップ fetchData は待機中（runId: abc-123）
[DEBUG] ステップ fetchData の待機が終了しました（runId: abc-123）
[DEBUG] ステップ fetchData はペンディング（runId: abc-123）
```

## ベストプラクティス \{#best-practices\}

1. **一時的な失敗にはリトライを使う**: 一時的な失敗が起こりうるオペレーションにのみリトライを設定してください。検証エラーのような決定的なエラーに対しては、リトライは効果がありません。

2. **適切な待機時間を設定する**: 外部 API 呼び出しでは、サービスが回復する猶予を持てるように、より長めの待機時間を検討してください。

3. **リトライ回数を制限する**: 過度に高いリトライ回数は設定しないでください。障害発生時にワークフローの実行が不必要に長引く原因になります。

4. **冪等な処理を実装する**: ステップの `execute` 関数は、リトライされる可能性があるため、副作用なく複数回呼び出せる冪等性を備えていることを確認してください。

5. **バックオフ戦略を検討する**: より高度なシナリオでは、レート制限が想定されるオペレーションに対し、ステップのロジックに指数バックオフを実装することを検討してください。

## 関連情報 \{#related\}

* [Step クラス リファレンス](./step-class)
* [ワークフローの構成](./workflow)
* [ワークフローのエラー処理](/docs/workflows/error-handling)