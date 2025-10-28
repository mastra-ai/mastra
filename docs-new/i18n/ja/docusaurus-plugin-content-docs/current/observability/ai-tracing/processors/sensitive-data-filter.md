---
title: "機密データフィルター"
description: "自動的なデータ編集により、AIトレース内の機密情報を保護"
---

# 機密データフィルタ \{#sensitive-data-filter\}

機密データフィルタは、エクスポート前に AI のトレースから機密情報を自動的にマスキング（編集）する span プロセッサです。これにより、パスワード、API キー、トークン、その他の機密データがアプリケーションの外へ出たり、オブザーバビリティプラットフォームに保存されたりすることがなくなります。

## デフォルト設定 \{#default-configuration\}

標準の Mastra 構成を使用すると、Sensitive Data Filter はデフォルトで自動的に有効になります。

```ts filename="src/mastra/index.ts" showLineNumbers copy
export const mastra = new Mastra({
  observability: {
    default: { enabled: true }, // SensitiveDataFilterが自動的に含まれます
  },
  storage: new LibSQLStore({
    url: 'file:./mastra.db',
  }),
});
```

デフォルト設定では、フィルターは次の一般的な機微なフィールド名を自動的にマスクします:

* `password`
* `token`
* `secret`
* `key`
* `apikey`
* `auth`
* `authorization`
* `bearer`
* `bearertoken`
* `jwt`
* `credential`
* `clientsecret`
* `privatekey`
* `refresh`
* `ssn`

:::note

フィールドの照合は大文字小文字を区別せず、区切り文字を正規化します。たとえば、`api-key`、`api_key`、`Api Key` はすべて `apikey` として扱われます。

:::

## 仕組み \{#how-it-works\}

Sensitive Data Filter は、エクスポーターに送信される前にスパンを処理し、次をスキャンします：

* **Attributes** - スパンのメタデータおよびプロパティ
* **Metadata** - スパンに付与されたカスタムメタデータ
* **Input** - エージェント、ツール、LLM に送信されるデータ
* **Output** - 応答および結果
* **Error Information** - スタックトレースおよびエラー詳細

機微情報のフィールドが検出されると、その値はデフォルトで `[REDACTED]` に置き換えられます。フィルターはネストされたオブジェクト、配列、循環参照も安全に処理します。

## カスタム設定 \{#custom-configuration\}

どのフィールドをマスキングするか、またマスキングの表示方法をカスタマイズできます。

```ts filename="src/mastra/index.ts" showLineNumbers copy
import { SensitiveDataFilter, DefaultExporter } from '@mastra/core/ai-tracing';

export const mastra = new Mastra({
  observability: {
    configs: {
      production: {
        serviceName: 'my-service',
        exporters: [new DefaultExporter()],
        processors: [
          new SensitiveDataFilter({
            // カスタムの機密フィールドを追加
            sensitiveFields: [
              // デフォルトフィールド
              'password',
              'token',
              'secret',
              'key',
              'apikey',
              // アプリケーション固有のカスタムフィールド
              'creditCard',
              'bankAccount',
              'routingNumber',
              'email',
              'phoneNumber',
              'dateOfBirth',
            ],
            // カスタム秘匿化トークン
            redactionToken: '***SENSITIVE***',
            // 秘匿化スタイル
            redactionStyle: 'full', // または 'partial'
          }),
        ],
      },
    },
  },
});
```

## マスキングのスタイル \{#redaction-styles\}

このフィルターは、2種類のマスキングスタイルをサポートします。

### 完全マスキング（デフォルト） \{#full-redaction-default\}

値全体を固定トークンに置き換えます：

```json
// 変更前
{
  "apiKey": "sk-abc123xyz789def456",
  "userId": "user_12345"
}

// 変更後
{
  "apiKey": "[REDACTED]",
  "userId": "user_12345"
}
```

### 部分マスキング \{#partial-redaction\}

先頭と末尾の3文字だけを表示します。値の全体を公開せずにデバッグするのに便利です。

```ts
new SensitiveDataFilter({
  redactionStyle: 'partial',
});
```

```json
// Before
{
  "apiKey": "sk-abc123xyz789def456",
  "creditCard": "4111111111111111"
}

// After
{
  "apiKey": "sk-…456",
  "creditCard": "411…111"
}
```

情報漏えいを防ぐため、7文字未満の値はすべて完全にマスクされます。

## フィールド照合ルール \{#field-matching-rules\}

このフィルターは賢いフィールド照合を行います:

1. **大文字・小文字を区別しない**: `APIKey`、`apikey`、`ApiKey` はすべて一致します
2. **区切り記号に依存しない**: `api-key`、`api_key`、`apiKey` は同一として扱われます
3. **厳密一致**: 正規化後、フィールドは厳密に一致する必要があります
   * `token` は `token`、`Token`、`TOKEN` と一致します
   * `token` は `promptTokens` や `tokenCount` とは一致しません

## ネストオブジェクトの処理 \{#nested-object-handling\}

フィルターは入れ子構造を再帰的に処理します。

```json
// 変更前
{
  "user": {
    "id": "12345",
    "credentials": {
      "password": "SuperSecret123!",
      "apiKey": "sk-production-key"
    }
  },
  "config": {
    "auth": {
      "jwt": "eyJhbGciOiJIUzI1NiIs..."
    }
  }
}

// 変更後
{
  "user": {
    "id": "12345",
    "credentials": {
      "password": "[REDACTED]",
      "apiKey": "[REDACTED]"
    }
  },
  "config": {
    "auth": {
      "jwt": "[REDACTED]"
    }
  }
}
```

## パフォーマンスに関する考慮事項 \{#performance-considerations\}

Sensitive Data Filter は軽量かつ効率的に設計されています:

* **同期処理**: 非同期処理を行わず、レイテンシへの影響を最小限に抑えます
* **循環参照への対応**: 複雑なオブジェクトグラフを安全に扱います
* **エラー復旧**: フィルタリングに失敗した場合はクラッシュせず、当該フィールドをエラーマーカーに置き換えます

## フィルターの無効化 \{#disabling-the-filter\}

機密データのフィルタリングを無効にする必要がある場合（本番環境では非推奨）:

```ts filename="src/mastra/index.ts" showLineNumbers copy
export const mastra = new Mastra({
  observability: {
    configs: {
      debug: {
        serviceName: 'debug-service',
        processors: [], // プロセッサなし（SensitiveDataFilterも含まない）
        exporters: [new DefaultExporter()],
      },
    },
  },
});
```

:::warning

機密データのフィルタリングを無効にするのは、管理された環境でのみ行ってください。トレースを外部サービスや共有ストレージに送信する場合は、決して無効にしないでください。

:::

## 代表的なユースケース \{#common-use-cases\}

### ヘルスケアアプリケーション \{#healthcare-applications\}

```ts
new SensitiveDataFilter({
  sensitiveFields: [
    // HIPAA関連のフィールド
    'ssn',
    'socialSecurityNumber',
    'medicalRecordNumber',
    'mrn',
    'healthInsuranceNumber',
    'diagnosisCode',
    'icd10',
    'prescription',
    'medication',
  ],
});
```

### 金融サービス \{#financial-services\}

```ts
new SensitiveDataFilter({
  sensitiveFields: [
    // PCI準拠項目
    'creditCard',
    'ccNumber',
    'cardNumber',
    'cvv',
    'cvc',
    'securityCode',
    'expirationDate',
    'expiry',
    'bankAccount',
    'accountNumber',
    'routingNumber',
    'iban',
    'swift',
  ],
});
```

## エラーハンドリング \{#error-handling\}

フィルターがフィールドの処理中にエラーを検出した場合、そのフィールドを安全なエラーマーカーに置き換えます。

```json
{
  "problematicField": {
    "error": {
      "processor": "sensitive-data-filter"
    }
  }
}
```

これにより、処理エラーがトレースのエクスポートを妨げたり、アプリケーションのクラッシュを引き起こしたりするのを防ぎます。

## 関連情報 \{#related\}

* [SensitiveDataFilter API](/docs/reference/observability/ai-tracing/processors/sensitive-data-filter)
* [AI トレーシングの基本例](/docs/examples/observability/basic-ai-tracing)