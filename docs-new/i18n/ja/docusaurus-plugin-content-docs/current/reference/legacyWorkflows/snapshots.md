---
title: "スナップショット"
description: "Mastra におけるスナップショットの技術リファレンス — 一時停止と再開を可能にするシリアライズ済みのワークフロー状態"
---

# スナップショット \{#snapshots\}

Mastra において、スナップショットは、特定の時点におけるワークフローの完全な実行状態をシリアライズ可能な形式で表現したものです。スナップショットは、次の情報を含め、ワークフローを中断した正確な地点から再開するために必要なあらゆる情報を記録します。

* ワークフロー内の各ステップの現在の状態
* 完了したステップの出力
* ワークフロー内でたどった実行パス
* 一時停止中のステップとそのメタデータ
* 各ステップに残っている再試行回数
* 実行を再開するために必要な追加のコンテキストデータ

スナップショットは、ワークフローが一時停止されるたびに Mastra によって自動的に作成・管理され、設定済みのストレージシステムに永続化されます。

## サスペンドとレジュームにおけるスナップショットの役割 \{#the-role-of-snapshots-in-suspend-and-resume\}

スナップショットは、Mastra のサスペンド／レジューム機能を支える中核的な仕組みです。ワークフローのステップで `await suspend()` が呼び出されると：

1. ワークフローの実行がその時点で一時停止される
2. ワークフローの現在状態がスナップショットとして取得される
3. スナップショットがストレージに永続化される
4. ワークフローのステップはステータス `'suspended'` の「suspended」としてマークされる
5. 後で、サスペンドされたステップで `resume()` が呼び出されると、スナップショットが取得される
6. ワークフローの実行は中断したまさにその地点から再開される

この仕組みにより、Human-in-the-Loop のワークフローの実装、レート制限への対応、外部リソースの待機、長時間の一時停止を要する複雑な分岐ワークフローの実装が強力に可能になります。

## スナップショットの概要 \{#snapshot-anatomy\}

Mastra のワークフローのスナップショットは、いくつかの重要なコンポーネントで構成されます。

```typescript
export interface LegacyWorkflowRunState {
  // コア状態情報
  value: Record<string, string>; // 現在のステートマシンの値
  context: {
    // ワークフローのコンテキスト
    steps: Record<
      string,
      {
        // ステップの実行結果
        status: 'success' | 'failed' | 'suspended' | 'waiting' | 'skipped';
        payload?: any; // ステップ固有のデータ
        error?: string; // 失敗時のエラー情報
      }
    >;
    triggerData: Record<string, any>; // 初期トリガー データ
    attempts: Record<string, number>; // 残りリトライ回数
    inputData: Record<string, any>; // 初期入力データ
  };

  activePaths: Array<{
    // 現在アクティブな実行パス
    stepPath: string[];
    stepId: string;
    status: string;
  }>;

  // メタデータ
  runId: string; // 実行の一意識別子
  timestamp: number; // このスナップショットの作成時刻

  // ネストされたワークフローおよびサスペンドされたステップ用
  childStates?: Record<string, WorkflowRunState>; // 子ワークフローの状態
  suspendedSteps?: Record<string, string>; // サスペンド中のステップのマッピング
}
```

## スナップショットの保存と取得方法 \{#how-snapshots-are-saved-and-retrieved\}

Mastra は、設定されたストレージシステムにスナップショットを永続化します。既定ではスナップショットは libSQL データベースに保存されますが、Upstash などの他のストレージプロバイダーを使用するように設定できます。
スナップショットは `workflow_snapshots` テーブルに保存され、libSQL を使用している場合、対応する実行の `run_id` によって一意に識別されます。
永続化レイヤーを利用することで、ワークフロー実行間でスナップショットを保持でき、人間参加型（human-in-the-loop）の高度な機能が可能になります。

[libsql ストレージ](../storage/libsql) と [upstash ストレージ](../storage/upstash) の詳細はこちらをご覧ください。

### スナップショットの保存 \{#saving-snapshots\}

ワークフローが一時停止されると、Mastra は次の手順でワークフローのスナップショットを自動的に永続化します:

1. ステップ実行内の `suspend()` 関数がスナップショット処理をトリガーする
2. `WorkflowInstance.suspend()` メソッドが一時停止中のマシンを記録する
3. 現在の状態を保存するために `persistWorkflowSnapshot()` が呼び出される
4. スナップショットはシリアライズされ、設定されたデータベースの `workflow_snapshots` テーブルに保存される
5. 保存レコードには、ワークフロー名、実行 ID、シリアライズ済みスナップショットが含まれる

### スナップショットの取得 \{#retrieving-snapshots\}

ワークフローが再開されると、Mastra は次の手順で永続化されたスナップショットを取得します。

1. 特定のステップ ID を指定して `resume()` メソッドが呼び出される
2. `loadWorkflowSnapshot()` を使ってストレージからスナップショットを読み込む
3. スナップショットを解析し、再開の準備を行う
4. スナップショットの状態を用いてワークフローの実行を再構成する
5. 中断されていたステップを再開し、実行を継続する

## スナップショットのストレージオプション \{#storage-options-for-snapshots\}

Mastra はスナップショットを永続化するための複数のストレージオプションを提供します。

`storage` インスタンスは `Mastra` クラスで設定され、`Mastra` インスタンスに登録されたすべてのワークフロー向けのスナップショット永続化レイヤーを構成するために使用されます。つまり、同じ `Mastra` インスタンスに登録されたすべてのワークフロー間でストレージが共有されます。

### LibSQL（デフォルト） \{#libsql-default\}

デフォルトのストレージオプションは LibSQL で、SQLite 互換のデータベースです。

```typescript
import { Mastra } from '@mastra/core/mastra';
import { DefaultStorage } from '@mastra/core/storage/libsql';

const mastra = new Mastra({
  storage: new DefaultStorage({
    config: {
      url: 'file:storage.db', // ローカルのファイルベースのデータベース
      // 本番環境では:
      // url: process.env.DATABASE_URL,
      // authToken: process.env.DATABASE_AUTH_TOKEN,
    },
  }),
  legacy_workflows: {
    weatherWorkflow,
    travelWorkflow,
  },
});
```

### Upstash（Redis 互換） \{#upstash-redis-compatible\}

サーバーレス環境向け：

```typescript
import { Mastra } from '@mastra/core/mastra';
import { UpstashStore } from '@mastra/upstash';

const mastra = new Mastra({
  storage: new UpstashStore({
    url: process.env.UPSTASH_URL,
    token: process.env.UPSTASH_TOKEN,
  }),
  workflows: {
    weatherWorkflow,
    travelWorkflow,
  },
});
```

## スナップショットを扱う際のベストプラクティス \{#best-practices-for-working-with-snapshots\}

1. **シリアライズ可能であることを確認**: スナップショットに含める必要があるデータは、必ずシリアライズ可能（JSON に変換可能）である必要があります。

2. **スナップショットのサイズを最小化**: 大きなデータオブジェクトをワークフローのコンテキストに直接保存するのは避けましょう。代わりに参照（ID など）を保存し、必要に応じてデータを取得します。

3. **再開時のコンテキストを慎重に取り扱う**: ワークフローを再開する際、どのコンテキストを渡すかを慎重に検討してください。渡した内容は既存のスナップショットデータにマージされます。

4. **適切なモニタリングを設定**: 中断されたワークフロー、とくに長時間実行されるものについてはモニタリングを実装し、確実に再開されるようにしましょう。

5. **ストレージのスケールを検討**: 多数の中断中ワークフローを抱えるアプリケーションでは、ストレージソリューションが適切にスケールしていることを確認してください。

## 高度なスナップショット・パターン \{#advanced-snapshot-patterns\}

### カスタムスナップショットのメタデータ \{#custom-snapshot-metadata\}

ワークフローを一時停止する際に、再開時に役立つカスタムメタデータを含めることができます。

```typescript
await suspend({
  reason: '顧客承認待ち',
  requiredApprovers: ['マネージャー', '財務担当'],
  requestedBy: currentUser,
  urgency: '高',
  expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
});
```

このメタデータはスナップショットに保存され、再開時に利用できます。

### 条件付きの再開 \{#conditional-resumption\}

再開時には、suspend のペイロードに基づいて条件分岐のロジックを実装できます。

```typescript
run.watch(async ({ activePaths }) => {
  const isApprovalStepSuspended = activePaths.get('approval')?.status === 'suspended';
  if (isApprovalStepSuspended) {
    const payload = activePaths.get('approval')?.suspendPayload;
    if (payload.urgency === 'high' && currentUser.role === 'manager') {
      await resume({
        stepId: 'approval',
        context: { approved: true, approver: currentUser.id },
      });
    }
  }
});
```

## 関連項目 \{#related\}

* [Suspend 関数リファレンス](./suspend)
* [Resume 関数リファレンス](./resume)
* [Watch 関数リファレンス](./watch)
* [Suspend と Resume のガイド](/docs/workflows/suspend-and-resume)