---
title: "Mastra.setTelemetry() "
description: "Mastra の `Mastra.setTelemetry()` メソッドに関するドキュメント。すべてのコンポーネントのテレメトリー設定を構成します。"
---

# Mastra.setTelemetry() \{#mastrasettelemetry\}

`.setTelemetry()` メソッドは、Mastra インスタンス内のすべてのコンポーネントに対するテレメトリー設定を構成するために使用します。このメソッドは、テレメトリー設定オブジェクトを 1 つ受け取ります。

## 使い方の例 \{#usage-example\}

```typescript copy
mastra.setTelemetry({ export: { type: 'console' } });
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "telemetry",
type: "OtelConfig",
description: "すべてのコンポーネントに適用するテレメトリー設定オブジェクト。",
},
]}
/>

## 戻り値 \{#returns\}

このメソッドは値を返さない。

## 関連情報 \{#related\}

* [ロギング](/docs/observability/logging)
* [PinoLogger](/docs/reference/observability/logging/pino-logger)