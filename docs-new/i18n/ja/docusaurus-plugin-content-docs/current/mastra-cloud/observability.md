---
title: オブザーバビリティ
description: Mastra Cloud のデプロイ向け監視・デバッグツール
---

# トレーシングとログを理解する \{#understanding-tracing-and-logs\}

Mastra Cloud は、本番環境でのアプリケーションの動作を監視するために、実行データを収集します。

:::tip Mastra Cloud

自動デプロイ、監視、管理のために、Mastra アプリケーションを [Mastra Cloud](https://mastra.ai/cloud) にデプロイしましょう。

:::

## Logs \{#logs\}

アプリケーションの挙動をデバッグおよび監視するための詳細なログは、Dashboard の [Logs](/docs/mastra-cloud/dashboard#logs) ページで確認できます。

![Dashboard logs](/img/mastra-cloud/mastra-cloud-dashboard-logs.jpg)

主な機能:

各ログエントリには、重要度レベルと、エージェント、ワークフロー、またはストレージのアクティビティを示す詳細なメッセージが含まれます。

## トレース \{#traces\}

より詳細なトレースは、[logger](/docs/observability/logging) を使用するか、[対応プロバイダー](/docs/reference/observability/otel-tracing/providers) のいずれかで [テレメトリー](/docs/observability/ai-tracing/overview) を有効にすることで、エージェントとワークフローの両方で利用できます。

### エージェント \{#agents\}

[logger](/docs/observability/logging) を有効にすると、Agents Playground の **Traces** セクションでエージェントの詳細な出力を確認できます。

![observability agents](/img/mastra-cloud/mastra-cloud-observability-agents.jpg)

主な特長:

生成時にエージェントへ渡されるツールは、`convertTools` によって標準化されます。これには、クライアント側のツール、メモリツール、ワークフローから公開されるツールの取得が含まれます。

### ワークフロー \{#workflows\}

[logger](/docs/observability/logging) を有効にすると、Workflows Playground の **Traces** セクションでワークフローの詳細な出力を確認できます。

![observability workflows](/img/mastra-cloud/mastra-cloud-observability-workflows.jpg)

主な機能:

ワークフローは `createWorkflow` で作成し、ステップ、メタデータ、ツールを設定します。入力とオプションを渡して `runWorkflow` で実行できます。

## 次のステップ \{#next-steps\}

* [ログ記録](/docs/observability/logging)
* [AI トレーシング](/docs/observability/ai-tracing/overview)