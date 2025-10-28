---
title: "SensitiveDataFilter"
description: SensitiveDataFilter プロセッサのAPIリファレンス
---

# SensitiveDataFilter \{#sensitivedatafilter\}

スパンのフィールドから機密情報をマスキング（編集）する AISpanProcessor。

## コンストラクタ \{#constructor\}

```typescript
new SensitiveDataFilter(options?: SensitiveDataFilterOptions)
```

## SensitiveDataFilterOptions（機密データフィルターオプション） \{#sensitivedatafilteroptions\}

```typescript
interface SensitiveDataFilterOptions {
  /**
   * マスク対象となる機密フィールド名のリスト。
   * 照合は大文字小文字を区別せず、区切り文字を正規化します
   * （api-key、api_key、Api Key → apikey）。
   * 既定の例: password、token、secret、key、apikey、auth、
   * authorization、bearer、bearertoken、jwt、credential、
   * clientsecret、privatekey、refresh、ssn。
   */
  sensitiveFields?: string[];

  /**
   * 全面マスクに使用するトークン。
   * 既定値: "[REDACTED]"
   */
  redactionToken?: string;

  /**
   * 使用するマスク方式:
   * - "full": 常に redactionToken で置き換える
   * - "partial": 先頭と末尾の各3文字を表示し、中間をマスクする
   * 既定値: "full"
   */
  redactionStyle?: RedactionStyle;
}
```

<PropertiesTable
  props={[
{
name: "sensitiveFields",
type: "string[]",
description: "マスク対象のフィールド名（大文字小文字を区別せず、区切り文字に依存しない）",
required: false,
},
{
name: "redactionToken",
type: "string",
description: "完全マスク時の置換トークン",
required: false,
},
{
name: "redactionStyle",
type: "'full' | 'partial'",
description: "マスク方式",
required: false,
},
]}
/>

## RedactionStyle \{#redactionstyle\}

```typescript
type RedactionStyle = 'full' | 'partial';
```

## メソッド \{#methods\}

### 手順 \{#process\}

```typescript
process(span: AnyAISpan): AnyAISpan
```

属性、メタデータ、input、output、errorInfo などの主要フィールド全体で機密データをフィルタリングして、span を処理します。

<PropertiesTable
  props={[
{
name: "span",
type: "AnyAISpan",
description: "フィルタリング対象の入力 span",
required: true,
},
]}
/>

**戻り値:** 機密情報がマスクされた新しい span。

### シャットダウン \{#shutdown\}

```typescript
async shutdown(): Promise<void>
```

このプロセッサにはクリーンアップは不要です。

## プロパティ \{#properties\}

```typescript
readonly name = 'sensitive-data-filter';
```

## 既定の機微なフィールド \{#default-sensitive-fields\}

カスタムフィールドが指定されていない場合：

```typescript
[
  'password',
  'token',
  'secret',
  'key',
  'apikey',
  'auth',
  'authorization',
  'bearer',
  'bearertoken',
  'jwt',
  'credential',
  'clientsecret',
  'privatekey',
  'refresh',
  'ssn',
];
```

## 処理動作 \{#processing-behavior\}

### フィールドのマッチング \{#field-matching\}

* **大文字・小文字を区別しない**: `APIKey`、`apikey`、`ApiKey` はすべてマッチする
* **区切り文字に依存しない**: `api-key`、`api_key`、`apiKey` は同一として扱われる
* **完全一致**: 正規化後はフィールドが完全に一致している必要がある
  * `token` は `token`、`Token`、`TOKEN` にマッチする
  * `token` は `promptTokens` や `tokenCount` にはマッチしない

### 編集スタイル \{#redaction-styles\}

#### 全面的なマスキング（デフォルト） \{#full-redaction-default\}

一致した値はすべて redactionToken に置き換えられます。

#### 部分マスキング \{#partial-redaction\}

* 先頭3文字と末尾3文字を表示
* 6文字以下の値は完全にマスキング
* 文字列以外の値は、部分マスキングの前に文字列に変換

### エラー処理 \{#error-handling\}

フィールドのフィルタリングに失敗した場合、そのフィールドは次のように置き換えられます：

```typescript
{
  error: {
    processor: '機微情報フィルター';
  }
}
```

### 処理対象フィールド \{#processed-fields\}

このフィルターは再帰的に処理します：

* `span.attributes` - スパンのメタデータとプロパティ
* `span.metadata` - カスタムメタデータ
* `span.input` - 入力データ
* `span.output` - 出力データ
* `span.errorInfo` - エラー情報

ネストされたオブジェクト、配列、循環参照を安全に扱います。