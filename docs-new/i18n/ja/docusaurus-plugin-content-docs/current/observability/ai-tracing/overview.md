---
title: "概要"
description: "Mastra アプリ向けに AI トレーシングを設定する"
sidebar_position: 1
---

# AI トレーシング \{#ai-tracing\}

AI トレーシングは、アプリケーション内の AI 関連処理に特化した監視とデバッグ機能を提供します。有効化すると、Mastra はエージェントの実行、LLM の生成、ツール呼び出し、ワークフローの各ステップについて、AI 固有のコンテキストとメタデータを含むトレースを自動的に作成します。

従来のアプリケーション・トレーシングと異なり、AI トレーシングは AI パイプラインの把握に特化しています。トークン使用量、モデルのパラメータ、ツール実行の詳細、会話フローを記録し、問題のデバッグ、パフォーマンスの最適化、本番環境における AI システムの挙動の理解を容易にします。

## 仕組み \{#how-it-works\}

AI Traces は次の方法で作成されます:

* **エクスポーターを設定** → トレースデータをオブザーバビリティプラットフォームに送信
* **サンプリング戦略を設定** → 収集対象のトレースを制御
* **エージェントとワークフローを実行** → Mastra が AI Tracing による自動計装を実施

## 設定 \{#configuration\}

### 基本設定 \{#basic-config\}

```ts filename="src/mastra/index.ts" showLineNumbers copy
export const mastra = new Mastra({
  // ... その他の設定
  observability: {
    default: { enabled: true }, // DefaultExporterとCloudExporterを有効にする
  },
  storage: new LibSQLStore({
    url: 'file:./mastra.db', // トレーシングにはストレージが必須
  }),
});
```

有効化すると、デフォルト構成には自動的に以下が含まれます:

* **サービス名**: `"mastra"`
* **サンプリング**: `"always"` - 常時サンプリング（トレースの100%）
* **エクスポーター**:
  * `DefaultExporter` - 設定したストレージにトレースを永続化
  * `CloudExporter` - トレースを Mastra Cloud に送信（`MASTRA_CLOUD_ACCESS_TOKEN` が必要）
* **プロセッサ**: `SensitiveDataFilter` - 機密フィールドを自動的にマスク

### 拡張された基本設定 \{#expanded-basic-config\}

このデフォルト設定は、以下のより詳しい設定と同等となる、最小限のヘルパーです。

```ts filename="src/mastra/index.ts" showLineNumbers copy
import { CloudExporter, DefaultExporter, SensitiveDataFilter } from '@mastra/core/ai-tracing';

export const mastra = new Mastra({
  // ... その他の設定
  observability: {
    configs: {
      default: {
        serviceName: 'mastra',
        sampling: { type: 'always' },
        processors: [new SensitiveDataFilter()],
        exporters: [new CloudExporter(), new DefaultExporter()],
      },
    },
  },
  storage: new LibSQLStore({
    url: 'file:./mastra.db', // トレーシングにはストレージが必要
  }),
});
```

## エクスポーター \{#exporters\}

エクスポーターは、AI のトレースデータをどこへ送信し、どのように保存するかを決定します。適切なエクスポーターを選ぶことで、既存のオブザーバビリティスタックとの統合、データ所在要件の遵守、コストとパフォーマンスの最適化が可能になります。複数のエクスポーターを同時に使用し、同じトレースデータを複数の送信先へ送ることもできます。たとえば、デバッグ用に詳細なトレースをローカルに保存しつつ、本番監視のためにサンプリングデータをクラウドプロバイダーに送信するといった運用が可能です。

### 内蔵エクスポーター \{#internal-exporters\}

Mastra には、すぐに使える 2 種類の組み込みエクスポーターが用意されています:

* **[Default](/docs/observability/ai-tracing/exporters/default)** - Playground での閲覧のためにトレースをローカルストレージに保存します
* **[Cloud](/docs/observability/ai-tracing/exporters/cloud)** - 本番環境での監視とコラボレーションのためにトレースを Mastra Cloud に送信します

### 外部エクスポーター \{#external-exporters\}

内部エクスポーターに加えて、Mastra は一般的なオブザーバビリティプラットフォームとの連携をサポートしています。これらのエクスポーターにより、既存の監視基盤を活用しつつ、アラートやダッシュボード、他のアプリケーションメトリクスとの相関といったプラットフォーム固有の機能を利用できます。

* **[Braintrust](/docs/observability/ai-tracing/exporters/braintrust)** - Braintrust の評価・オブザーバビリティプラットフォームにトレースをエクスポート

* **[Langfuse](/docs/observability/ai-tracing/exporters/langfuse)** - Langfuse のオープンソース LLM エンジニアリングプラットフォームにトレースを送信

* **[LangSmith](/docs/observability/ai-tracing/exporters/langsmith)** - LangSmith のオブザーバビリティ／評価ツールキットにトレースを送信

* **[OpenTelemetry](/docs/observability/ai-tracing/exporters/otel)** - OpenTelemetry 互換のあらゆるオブザーバビリティシステムにトレースを送信
  * 対応: Dash0、Laminar、New Relic、SigNoz、Traceloop、Zipkin など

* **Arize** - 近日公開予定

## サンプリング戦略 \{#sampling-strategies\}

サンプリングは収集対象のトレースを制御し、可観測性の要件とリソースコストのバランスを取るのに役立ちます。トラフィックの多い本番環境では、すべてのトレースを収集すると高コストで、必ずしも必要とは限りません。サンプリング戦略を用いれば、エラーや重要な処理に関する重要な情報を逃さずに、代表性のあるトレースのサブセットを取得できます。

Mastra は 4 つのサンプリング戦略をサポートしています:

### 常時サンプリング \{#always-sample\}

トレースを100%収集します。開発やデバッグ、あるいは完全な可視性が必要な低トラフィック環境に最適です。

```ts
sampling: {
  type: 'always';
}
```

### サンプリングしない \{#never-sample\}

トレーシングを完全に無効にします。トレーシングが有用でない特定の環境や、設定を削除せずに一時的にトレーシングを無効化したい場合に便利です。

```ts
sampling: {
  type: 'never';
}
```

### 比率ベースのサンプリング \{#ratio-based-sampling\}

トレースの一定割合をランダムに抽出します。フル トレーシングのコストをかけずに統計的な示唆を得たい本番環境に最適です。確率の値は 0（トレースなし）から 1（すべてのトレース）までの範囲です。

```ts
sampling: {
  type: 'ratio',
  probability: 0.1  // トレースの10%をサンプリング
}
```

### カスタム サンプリング \{#custom-sampling\}

実行時のコンテキスト、メタデータ、あるいはビジネス ルールに基づいて、独自のサンプリング ロジックを実装します。ユーザー階層、リクエスト種別、エラー条件などに応じたサンプリングといった複雑なシナリオに最適です。

```ts
sampling: {
  type: 'custom',
  sampler: (options) => {
    // プレミアムユーザーは高い割合でサンプリング
    if (options?.metadata?.userTier === 'premium') {
      return Math.random() < 0.5; // 50% サンプリング
    }

    // その他はデフォルトで 1% サンプリング
    return Math.random() < 0.01;
  }
}
```

### 完成例 \{#complete-example\}

```ts filename="src/mastra/index.ts" showLineNumbers copy
export const mastra = new Mastra({
  observability: {
    configs: {
      '10_percent': {
        serviceName: 'my-service',
        // トレースの10%をサンプリング
        sampling: {
          type: 'ratio',
          probability: 0.1,
        },
        exporters: [new DefaultExporter()],
      },
    },
  },
});
```

## マルチコンフィグのセットアップ \{#multi-config-setup\}

複雑なアプリケーションでは、状況に応じて異なるトレーシング設定が必要になることがよくあります。開発中はフルサンプリングで詳細なトレースを行い、本番ではサンプリングしたトレースを外部プロバイダーへ送信し、特定の機能や顧客セグメント向けに専用の設定を用意したい場合もあります。`configSelector` 関数は実行時に設定を動的に選択でき、リクエストコンテキスト、環境変数、フィーチャーフラグ、あるいは任意のカスタムロジックに基づいてトレースの振り分けを行えます。

このアプローチは次のような場合に特に有用です:

* 観測要件の異なる A/B テストを実施する場合
* 特定の顧客やサポート案件向けに強化されたデバッグを提供する場合
* 既存のモニタリングに影響を与えずに新しいトレーシングプロバイダーを段階的にロールアウトする場合
* リクエスト種別ごとにサンプリングレートを変えてコストを最適化する場合
* コンプライアンスやデータ所在地要件に合わせてトレースストリームを分離して運用する場合

:::note

特定の実行で使用できるコンフィグは 1 つだけです。ただし、1 つのコンフィグで同時に複数のエクスポーターへデータを送信できます。

:::

### 動的な設定の選択 \{#dynamic-configuration-selection\}

実行時のコンテキストに応じて適切なトレーシング設定を選ぶには、`configSelector` を使用します。

```ts filename="src/mastra/index.ts" showLineNumbers copy
export const mastra = new Mastra({
  observability: {
    default: { enabled: true }, // 'default' インスタンスを提供
    configs: {
      langfuse: {
        serviceName: 'langfuse-service',
        exporters: [langfuseExporter],
      },
      braintrust: {
        serviceName: 'braintrust-service',
        exporters: [braintrustExporter],
      },
      debug: {
        serviceName: 'debug-service',
        sampling: { type: 'always' },
        exporters: [new DefaultExporter()],
      },
    },
    configSelector: (context, availableTracers) => {
      // サポートリクエストにはデバッグ設定を使用
      if (context.runtimeContext?.get('supportMode')) {
        return 'debug';
      }

      // 特定の顧客を異なるプロバイダーにルーティング
      const customerId = context.runtimeContext?.get('customerId');
      if (customerId && premiumCustomers.includes(customerId)) {
        return 'braintrust';
      }

      // 特定のリクエストをlangfuseにルーティング
      if (context.runtimeContext?.get('useExternalTracing')) {
        return 'langfuse';
      }

      return 'default';
    },
  },
});
```

### 環境別の設定 \{#environment-based-configuration\}

よくあるパターンとして、デプロイ環境に応じて設定を選択します。

```ts filename="src/mastra/index.ts" showLineNumbers copy
export const mastra = new Mastra({
  observability: {
    configs: {
      development: {
        serviceName: 'my-service-dev',
        sampling: { type: 'always' },
        exporters: [new DefaultExporter()],
      },
      staging: {
        serviceName: 'my-service-staging',
        sampling: { type: 'ratio', probability: 0.5 },
        exporters: [langfuseExporter],
      },
      production: {
        serviceName: 'my-service-prod',
        sampling: { type: 'ratio', probability: 0.01 },
        exporters: [cloudExporter, langfuseExporter],
      },
    },
    configSelector: (context, availableTracers) => {
      const env = process.env.NODE_ENV || 'development';
      return env;
    },
  },
});
```

### 代表的な設定パターンとトラブルシューティング \{#common-configuration-patterns-troubleshooting\}

#### 既定の設定が優先されます \{#default-config-takes-priority\}

既定の設定が有効で、カスタム設定も定義されている場合は、明示的に別の設定を選択しない限り、**常に既定の設定が使用されます**。

```ts filename="src/mastra/index.ts" showLineNumbers copy
export const mastra = new Mastra({
  observability: {
    default: { enabled: true }, // これが常に使用されます！
    configs: {
      langfuse: {
        serviceName: 'my-service',
        exporters: [langfuseExporter], // ここには到達しません
      },
    },
  },
});
```

**解決策:**

1. **デフォルトを無効に**して、カスタム設定のみを使用する：

```ts
observability: {
  // デフォルト設定を無効にする場合は、この行をコメントアウトまたは削除してください
  // default: { enabled: true },
  configs: {
    langfuse: {
      /* ... */
    }
  }
}
```

2. 設定を切り替えるには、**configSelector を使用**します:

```ts
observability: {
  default: { enabled: true },
  configs: {
    langfuse: { /* ... */ }
  },
  configSelector: (context, availableConfigs) => {
    // 'default' と 'langfuse' の選択ロジック
    return useExternalTracing ? 'langfuse' : 'default';
  }
}
```

#### Playground と Cloud へのアクセスを維持する \{#maintaining-playground-and-cloud-access\}

外部エクスポーターを使用してカスタム設定を作成する場合、Mastra Playground と Cloud へのアクセスを失う可能性があります。外部エクスポーターを追加しつつアクセスを維持するには、デフォルトのエクスポーターをカスタム設定に含めてください。

```ts filename="src/mastra/index.ts" showLineNumbers copy
import { DefaultExporter, CloudExporter } from '@mastra/core/ai-tracing';
import { LangfuseExporter } from '@mastra/langfuse';

export const mastra = new Mastra({
  observability: {
    default: { enabled: false }, // カスタムを使用するためデフォルトを無効化
    configs: {
      production: {
        serviceName: 'my-service',
        exporters: [
          new LangfuseExporter(), // 外部エクスポーター
          new DefaultExporter(), // Playgroundへのアクセスを維持
          new CloudExporter(), // Cloudへのアクセスを維持
        ],
      },
    },
  },
});
```

この構成では、トレースが同時に3つの宛先すべてへ送信されます：

* 外部向けオブザーバビリティの **Langfuse**
* ローカルの Playground にアクセスするための **DefaultExporter**
* Mastra Cloud のダッシュボード向けの **CloudExporter**

:::tip

1つのトレースは複数のエクスポーターに送信できます。異なるサンプリングレートやプロセッサを使いたい場合を除き、各エクスポーターごとに個別の設定は不要です。

:::

## カスタムメタデータの追加 \{#adding-custom-metadata\}

カスタムメタデータを利用すると、トレースに追加の文脈情報を付与でき、問題のデバッグや本番環境でのシステムの振る舞いの理解が容易になります。メタデータには、ビジネスロジックの詳細、パフォーマンス指標、ユーザーコンテキスト、または実行時に何が起きたかの把握に役立つあらゆる情報を含められます。

トレーシングコンテキストを使って、任意のスパンにメタデータを追加できます。

```ts showLineNumbers copy
execute: async ({ inputData, tracingContext }) => {
  const startTime = Date.now();
  const response = await fetch(inputData.endpoint);

  // 現在のスパンにカスタムメタデータを追加
  tracingContext.currentSpan?.update({
    metadata: {
      apiStatusCode: response.status,
      endpoint: inputData.endpoint,
      responseTimeMs: Date.now() - startTime,
      userTier: inputData.userTier,
      region: process.env.AWS_REGION,
    },
  });

  return await response.json();
};
```

ここで設定したメタデータは、設定済みのすべてのエクスポーターに表示されます。

## 子スパンの作成 \{#creating-child-spans\}

子スパンを使うと、ワークフローのステップやツール内でのきめ細かな処理を追跡できます。データベースクエリ、APIコール、ファイル操作、複雑な計算といった下位の処理を可視化できます。この階層構造により、パフォーマンスのボトルネックを特定し、処理の正確な順序を把握できます。

特定の処理を追跡するために、ツールの呼び出しやワークフローステップ内で子スパンを作成します:

```ts showLineNumbers copy
execute: async ({ input, tracingContext }) => {
  // メインのデータベース操作用の子スパンを作成
  const querySpan = tracingContext.currentSpan?.createChildSpan({
    type: 'generic',
    name: 'database-query',
    input: { query: input.query },
    metadata: { database: 'production' },
  });

  try {
    const results = await db.query(input.query);
    querySpan?.end({
      output: results.data,
      metadata: {
        rowsReturned: results.length,
        queryTimeMs: results.executionTime,
        cacheHit: results.fromCache,
      },
    });
    return results;
  } catch (error) {
    querySpan?.error({
      error,
      metadata: { retryable: isRetryableError(error) },
    });
    throw error;
  }
};
```

子スパンは親からトレースコンテキストを自動継承し、オブザーバビリティプラットフォーム上での関係階層を保ちます。

## スパンプロセッサ \{#span-processors\}

スパンプロセッサは、エクスポート前にトレースデータを変換・フィルタリング・付加情報の付与（エンリッチ）できる機能です。スパンの作成とエクスポートの間に置かれるパイプラインとして機能し、セキュリティ、コンプライアンス、デバッグの目的に合わせてスパンを調整できます。Mastra には標準のプロセッサが用意されており、カスタム実装にも対応しています。

### 組み込みプロセッサ \{#built-in-processors\}

* [Sensitive Data Filter](/docs/observability/ai-tracing/processors/sensitive-data-filter) は機密情報をマスキングします。デフォルトのオブザーバビリティ構成で有効になっています。

### カスタムプロセッサの作成 \{#creating-custom-processors\}

`AISpanProcessor` インターフェースを実装することで、カスタムのスパンプロセッサを作成できます。次は、スパン内のすべての入力テキストを小文字に変換するシンプルな例です：

```ts filename="src/processors/lowercase-input-processor.ts" showLineNumbers copy
import type { AISpanProcessor, AnyAISpan } from '@mastra/core/ai-tracing';

export class LowercaseInputProcessor implements AISpanProcessor {
  name = 'lowercase-processor';

  process(span: AnyAISpan): AnyAISpan {
    span.input = `${span.input}`.toLowerCase();
    return span;
  }

  async shutdown(): Promise<void> {
    // 必要に応じてクリーンアップ
  }
}

// カスタムプロセッサを使用
export const mastra = new Mastra({
  observability: {
    configs: {
      development: {
        processors: [new LowercaseInputProcessor(), new SensitiveDataFilter()],
        exporters: [new DefaultExporter()],
      },
    },
  },
});
```

Processor は定義された順序で実行されるため、複数の変換をチェーンできます。カスタム Processor の一般的なユースケースは次のとおりです:

* 環境固有のメタデータの追加
* 条件に基づく span のフィルタリング
* データ形式の正規化
* 高トラフィックなトレースのサンプリング
* ビジネスコンテキストによる span の拡充

## トレースIDの取得 \{#retrieving-trace-ids\}

トレースを有効にした状態でエージェントやワークフローを実行すると、レスポンスに `traceId` が含まれます。これを使って、オブザーバビリティプラットフォームで完全なトレースを参照できます。デバッグやカスタマーサポート、システム内の他のイベントとのトレースの相関付けに役立ちます。

### エージェントのトレース ID \{#agent-trace-ids\}

`generate` と `stream` の両メソッドは、レスポンスでトレース ID を返します。

```ts showLineNumbers copy
// generateを使用
const result = await agent.generate({
  messages: [{ role: 'user', content: 'こんにちは' }],
});

console.log('トレースID:', result.traceId);

// streamを使用
const streamResult = await agent.stream({
  messages: [{ role: 'user', content: '物語を聞かせて' }],
});

console.log('トレースID:', streamResult.traceId);
```

### ワークフローのトレース ID \{#workflow-trace-ids\}

ワークフローの実行もトレース ID を返します。

```ts showLineNumbers copy
// ワークフロー実行を作成
const run = await mastra.getWorkflow('myWorkflow').createRunAsync();

// ワークフローを開始
const result = await run.start({
  inputData: { data: 'process this' },
});

console.log('Trace ID:', result.traceId);

// またはワークフローをストリーム
const { stream, getWorkflowState } = run.stream({
  inputData: { data: 'process this' },
});

// トレースIDを含む最終状態を取得
const finalState = await getWorkflowState();
console.log('Trace ID:', finalState.traceId);
```

### Trace ID の使い方 \{#using-trace-ids\}

Trace ID を取得したら、次のことができます:

1. **Mastra Playground でトレースを検索**: トレースビューに移動し、IDで検索する
2. **外部プラットフォームでトレースを照会**: Langfuse、Braintrust、または利用中のオブザーバビリティプラットフォームでIDを使用する
3. **ログとの相関付け**: アプリケーションログに Trace ID を含め、相互参照できるようにする
4. **デバッグのために共有**: 調査のためにサポートチームや開発者に Trace ID を提供する

Trace ID はトレースが有効な場合にのみ利用できます。トレースが無効な場合、またはサンプリングによってリクエストが除外された場合、`traceId` は `undefined` になります。

## 何がトレース対象になるか \{#what-gets-traced\}

Mastra は次の項目に対して自動的にスパンを作成します：

### エージェントのオペレーション \{#agent-operations\}

* **エージェント実行** - 指示とツールを用いた一連の処理
* **LLM 呼び出し** - トークンやパラメータを伴うモデルとのやり取り
* **ツール実行** - 入力と出力を伴う関数の呼び出し
* **メモリ操作** - スレッドおよび意味的なリコール

### ワークフローのオペレーション \{#workflow-operations\}

* **ワークフロー実行** - 開始から終了までの一連の実行
* **個別ステップ** - 入出力を伴うステップ処理
* **制御フロー** - 条件分岐、ループ、並列実行
* **待機オペレーション** - 遅延やイベント待機

## トレースの表示 \{#viewing-traces\}

トレースは以下の場所で確認できます：

* **Mastra Playground** - ローカル開発環境
* **Mastra Cloud** - 本番監視ダッシュボード
* **Langfuse Dashboard** - Langfuse エクスポーター利用時
* **Braintrust Console** - Braintrust エクスポーター利用時

## 関連項目 \{#see-also\}

### 例 \{#examples\}

* [AIトレーシングの基本例](/docs/examples/observability/basic-ai-tracing) - 実装済みの動作例

### 参考資料 \{#reference-documentation\}

* [Configuration API](/docs/reference/observability/ai-tracing/configuration) - ObservabilityConfig の詳細
* [AITracing クラス](/docs/reference/observability/ai-tracing) - 主要なクラスとメソッド
* [Span インターフェイス](/docs/reference/observability/ai-tracing/span) - Span の種類とライフサイクル
* [型定義](/docs/reference/observability/ai-tracing/interfaces) - インターフェイスの完全なリファレンス

### エクスポーター \{#exporters\}

* [DefaultExporter](/docs/reference/observability/ai-tracing/exporters/default-exporter) - ストレージへの永続化
* [CloudExporter](/docs/reference/observability/ai-tracing/exporters/cloud-exporter) - Mastra Cloud 連携
* [ConsoleExporter](/docs/reference/observability/ai-tracing/exporters/console-exporter) - デバッグ出力
* [Langfuse](/docs/reference/observability/ai-tracing/exporters/langfuse) - Langfuse 連携
* [Braintrust](/docs/reference/observability/ai-tracing/exporters/braintrust) - Braintrust 連携
* [OpenTelemetry](/docs/reference/observability/ai-tracing/exporters/otel) - OTEL 互換プラットフォーム

### プロセッサー \{#processors\}

* [Sensitive Data Filter](/docs/observability/ai-tracing/processors/sensitive-data-filter) - データのマスキング