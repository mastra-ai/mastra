---
title: "Mastra.getTelemetry() "
description: "Mastra の `Mastra.getTelemetry()` メソッドのドキュメント。設定されたテレメトリーインスタンスを取得します。"
---

# Mastra.getTelemetry() \{#mastragettelemetry\}

`.getTelemetry()` メソッドは、Mastra インスタンスで構成されたテレメトリ インスタンスを取得するために使用します。

## 使い方の例 \{#usage-example\}

```typescript copy
mastra.getTelemetry();
```

## パラメータ \{#parameters\}

このメソッドはパラメータを受け取りません。

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "telemetry",
type: "Telemetry | undefined",
description: "すべてのコンポーネントにわたるトレーシングと可観測性に使用される設定済みの Telemetry インスタンス。Telemetry が設定されていない場合は undefined。",
},
]}
/>

## 関連情報 \{#related\}

* [AI トレーシング](/docs/observability/ai-tracing/overview)
* [テレメトリ リファレンス](/docs/reference/observability/otel-tracing/otel-config)