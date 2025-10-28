---
title: "Span"
description: Span のインターフェース、メソッド、ライフサイクルイベント
---

# スパン \{#span\}

## BaseSpan \{#basespan\}

すべてのスパン型に共通する基本インターフェース。

```typescript
interface BaseSpan<TType extends AISpanType> {
  /** 一意のスパン識別子 */
  id: string;

  /** OpenTelemetry互換のトレースID(16進数32文字) */
  traceId: string;

  /** スパン名 */
  name: string;

  /** スパンの種類 */
  type: TType;

  /** スパンの開始時刻 */
  startTime: Date;

  /** スパンの終了時刻 */
  endTime?: Date;

  /** 種類固有の属性 */
  attributes?: AISpanTypeMap[TType];

  /** ユーザー定義メタデータ */
  metadata?: Record<string, any>;

  /** スパン開始時に渡された入力 */
  input?: any;

  /** スパン終了時に生成された出力 */
  output?: any;

  /** スパンが失敗した場合のエラー情報 */
  errorInfo?: {
    message: string;
    id?: string;
    domain?: string;
    category?: string;
    details?: Record<string, any>;
  };

  /** イベントスパンかどうか(startTimeで発生し、endTimeを持たない) */
  isEvent: boolean;
}
```

## AISpan \{#aispan\}

内部のトレース用途で使用される AI Span インターフェース。BaseSpan を拡張し、ライフサイクル関連のメソッドとプロパティを備えます。

```typescript
interface AISpan<TType extends AISpanType> extends BaseSpan<TType> {
  /** 内部スパンかどうか(mastraの内部動作用スパン) */
  isInternal: boolean;

  /** 親スパンへの参照(ルートスパンの場合はundefined) */
  parent?: AnyAISpan;

  /** AITracingインスタンスへのポインタ */
  aiTracing: AITracing;
}
```

### プロパティ \{#properties\}

```typescript
/** スパンがトレースのルートスパンである場合、TRUEを返します */
get isRootSpan(): boolean

/** スパンが有効なスパン（NO-OPスパンではない）である場合、TRUEを返します */
get isValid(): boolean

/** 内部スパンではない最も近い親spanIdを取得します */
getParentSpanId(includeInternalSpans?: boolean): string | undefined

/** エクスポート用の軽量スパンを返します */
exportSpan(includeInternalSpans?: boolean): ExportedAISpan<TType> | undefined
```

### 方法 \{#methods\}

#### 終了 \{#end\}

```typescript
end(options?: EndSpanOptions<TType>): void
```

スパンを終了し、設定済みのエクスポーターへのエクスポートをトリガーします。`endTime` を設定し、必要に応じて `output`、`metadata`、`attributes` を更新します。

<PropertiesTable
  props={[
{
name: "output",
type: "any",
description: "この操作の最終出力データ",
required: false,
},
{
name: "metadata",
type: "Record<string, any>",
description: "マージする追加メタデータ",
required: false,
},
{
name: "attributes",
type: "Partial<AISpanTypeMap[TType]>",
description: "更新対象のタイプ固有属性",
required: false,
},
]}
/>

#### エラー \{#error\}

```typescript
error(options: ErrorSpanOptions<TType>): void
```

スパンにエラーを記録します。`errorInfo` フィールドを設定し、必要に応じてスパンを終了します。

<PropertiesTable
  props={[
{
name: "error",
type: "Error",
description: "発生したエラー",
required: true,
},
{
name: "endSpan",
type: "boolean",
description: "エラーを記録した後にスパンを終了するかどうか",
required: false,
},
{
name: "metadata",
type: "Record<string, any>",
description: "エラーに関する追加のコンテキストメタデータ",
required: false,
},
{
name: "attributes",
type: "Partial<AISpanTypeMap[TType]>",
description: "型固有の属性を更新する値",
required: false,
},
]}
/>

#### アップデート \{#update\}

```typescript
update(options: UpdateSpanOptions<TType>): void
```

スパンがアクティブなうちに更新します。`input`、`output`、`metadata`、`attributes` を変更できます。

<PropertiesTable
  props={[
{
name: "input",
type: "any",
description: "入力データを更新または設定",
required: false,
},
{
name: "output",
type: "any",
description: "出力データを更新または設定",
required: false,
},
{
name: "metadata",
type: "Record<string, any>",
description: "既存のメタデータにマージするメタデータ",
required: false,
},
{
name: "attributes",
type: "Partial<AISpanTypeMap[TType]>",
description: "型固有の属性を更新",
required: false,
},
]}
/>

#### createChildSpan \{#createchildspan\}

```typescript
createChildSpan<TChildType extends AISpanType>(
  options: ChildSpanOptions<TChildType>
): AISpan<TChildType>
```

このスパンの下に子スパンを作成します。子スパンはサブ処理を追跡し、トレースコンテキストを継承します。

<PropertiesTable
  props={[
{
name: "type",
type: "TChildType",
description: "子スパンのタイプ",
required: true,
},
{
name: "name",
type: "string",
description: "子スパン名",
required: true,
},
{
name: "attributes",
type: "AISpanTypeMap[TChildType]",
description: "タイプ固有の属性",
required: false,
},
{
name: "metadata",
type: "Record<string, any>",
description: "初期メタデータ",
required: false,
},
{
name: "input",
type: "any",
description: "初期入力データ",
required: false,
},
]}
/>

#### createEventSpan \{#createeventspan\}

```typescript
createEventSpan<TChildType extends AISpanType>(
  options: ChildEventOptions<TChildType>
): AISpan<TChildType>
```

このスパンの子としてイベントスパンを作成します。イベントスパンは、継続時間を持たない単一時点の発生事象を表します。

<PropertiesTable
  props={[
{
name: "type",
type: "TChildType",
description: "イベントスパンの種類",
required: true,
},
{
name: "name",
type: "string",
description: "イベント名",
required: true,
},
{
name: "attributes",
type: "AISpanTypeMap[TChildType]",
description: "種類固有の属性",
required: false,
},
{
name: "metadata",
type: "Record<string, any>",
description: "イベントのメタデータ",
required: false,
},
{
name: "input",
type: "any",
description: "イベントの入力データ",
required: false,
},
{
name: "output",
type: "any",
description: "イベントの出力データ",
required: false,
},
]}
/>

## ExportedAISpan \{#exportedaispan\}

エクスポーターのトレーシングに使用される Exported AI Span インターフェイス。メソッドや循環参照を含まない AISpan の軽量版です。

```typescript
interface ExportedAISpan<TType extends AISpanType> extends BaseSpan<TType> {
  /** 親スパンIDの参照(ルートスパンの場合はundefined) */
  parentSpanId?: string;

  /** スパンがトレースのルートスパンである場合true */
  isRootSpan: boolean;
}
```

## スパンのライフサイクルイベント \{#span-lifecycle-events\}

スパンのライフサイクル中に発生するイベント。

### AITracingEventType \{#aitracingeventtype\}

```typescript
enum AITracingEventType {
  /** スパンが作成されて開始されたときに発行されます */
  SPAN_STARTED = 'span_started',

  /** update() によってスパンが更新されたときに発行されます */
  SPAN_UPDATED = 'span_updated',

  /** end() または error() によってスパンが終了したときに発行されます */
  SPAN_ENDED = 'span_ended',
}
```

### AITracingEvent \{#aitracingevent\}

```typescript
type AITracingEvent =
  | { type: 'span_started'; exportedSpan: AnyExportedAISpan }
  | { type: 'span_updated'; exportedSpan: AnyExportedAISpan }
  | { type: 'span_ended'; exportedSpan: AnyExportedAISpan };
```

エクスポーターはこれらのイベントを受け取り、処理したうえで、トレースデータをオブザーバビリティプラットフォームに送信します。

## ユニオン型 \{#union-types\}

### AnyAISpan \{#anyaispan\}

```typescript
type AnyAISpan = AISpan<keyof AISpanTypeMap>;
```

あらゆるスパン型を扱う必要がある場合に用いるユニオン型。

### AnyExportedAISpan \{#anyexportedaispan\}

```typescript
type AnyExportedAISpan = ExportedAISpan<keyof AISpanTypeMap>;
```

エクスポートされた任意の span 型を扱う必要があるケース向けのユニオン型。

## 関連情報 \{#see-also\}

### ドキュメント \{#documentation\}

* [AI トレーシングの概要](/docs/observability/ai-tracing/overview) - 概念と使い方
* [子スパンの作成](/docs/observability/ai-tracing/overview#creating-child-spans) - 実用例
* [トレース ID の取得](/docs/observability/ai-tracing/overview#retrieving-trace-ids) - トレース ID の活用

### 参考 \{#reference\}

* [AITracing Classes](/docs/reference/observability/ai-tracing) - トレーシングのコアクラス
* [Interfaces](/docs/reference/observability/ai-tracing/interfaces) - 型の完全なリファレンス
* [Configuration](/docs/reference/observability/ai-tracing/configuration) - 設定項目

### 例 \{#examples\}

* [Basic AI Tracing](/docs/examples/observability/basic-ai-tracing) - スパンの扱い方