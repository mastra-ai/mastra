---
title: "ChunkType"
description: "Mastra のストリーミング応答で使用される ChunkType 型のドキュメント。想定されるすべてのチャンクタイプとそのペイロードを定義します。"
---

# ChunkType \{#chunktype\}

`ChunkType` 型は、エージェントのストリーミング応答で出力されるチャンクの mastra 形式を定義します。

## 基本プロパティ \{#base-properties\}

すべてのチャンクには次の基本プロパティが含まれます：

<PropertiesTable
  content={[
{
name: "type",
type: "string",
description: "チャンクの種類を示す識別子"
},
{
name: "runId",
type: "string",
description: "この実行に固有の識別子"
},
{
name: "from",
type: "ChunkFrom",
description: "チャンクの発生元",
properties: [{
type: "enum",
parameters: [
{ name: "AGENT", type: "'AGENT'", description: "エージェントの実行によるチャンク" },
{ name: "USER", type: "'USER'", description: "ユーザー入力によるチャンク" },
{ name: "SYSTEM", type: "'SYSTEM'", description: "システム処理によるチャンク" },
{ name: "WORKFLOW", type: "'WORKFLOW'", description: "ワークフローの実行によるチャンク" }
]
}]
}
]}
/>

## テキストチャンク \{#text-chunks\}

### text-start \{#text-start\}

テキスト生成の開始を示します。

<PropertiesTable
  content={[
{
name: "type",
type: '"text-start"',
description: "チャンク種別識別子"
},
{
name: "payload",
type: "TextStartPayload",
description: "テキスト開始に関する情報",
properties: [{
type: "TextStartPayload",
parameters: [
{ name: "id", type: "string", description: "このテキスト生成の固有識別子" },
{ name: "providerMetadata", type: "SharedV2ProviderMetadata", isOptional: true, description: "プロバイダー固有のメタデータ" }
]
}]
}
]}
/>

### text-delta \{#text-delta\}

生成中に逐次出力されるテキスト。

<PropertiesTable
  content={[
{
name: "type",
type: '"text-delta"',
description: "チャンク種別の識別子"
},
{
name: "payload",
type: "TextDeltaPayload",
description: "逐次出力されるテキスト",
properties: [{
type: "TextDeltaPayload",
parameters: [
{ name: "id", type: "string", description: "このテキスト生成の一意の識別子" },
{ name: "text", type: "string", description: "逐次出力されるテキスト" },
{ name: "providerMetadata", type: "SharedV2ProviderMetadata", isOptional: true, description: "プロバイダー固有のメタデータ" }
]
}]
}
]}
/>

### text-end \{#text-end\}

テキスト生成の終了を示します。

<PropertiesTable
  content={[
{
name: "type",
type: '"text-end"',
description: "チャンク種別識別子"
},
{
name: "payload",
type: "TextEndPayload",
description: "テキスト終了に関する情報",
properties: [{
type: "TextEndPayload",
parameters: [
{ name: "id", type: "string", description: "このテキスト生成に固有の識別子" },
{ name: "providerMetadata", type: "SharedV2ProviderMetadata", isOptional: true, description: "プロバイダー固有のメタデータ" }
]
}]
}
]}
/>

## 推論チャンク \{#reasoning-chunks\}

### reasoning-start \{#reasoning-start\}

推論生成の開始を示します（推論対応モデル向け）。

<PropertiesTable
  content={[
{
name: "type",
type: '"reasoning-start"',
description: "チャンク型識別子"
},
{
name: "payload",
type: "ReasoningStartPayload",
description: "推論開始情報",
properties: [{
type: "ReasoningStartPayload",
parameters: [
{ name: "id", type: "string", description: "この推論生成の一意の識別子" },
{ name: "signature", type: "string", isOptional: true, description: "利用可能な場合の推論署名" },
{ name: "providerMetadata", type: "SharedV2ProviderMetadata", isOptional: true, description: "プロバイダー固有のメタデータ" }
]
}]
}
]}
/>

### reasoning-delta \{#reasoning-delta\}

生成中に段階的に出力される推論テキスト。

<PropertiesTable
  content={[
{
name: "type",
type: '"reasoning-delta"',
description: "チャンク種別の識別子"
},
{
name: "payload",
type: "ReasoningDeltaPayload",
description: "逐次的な推論コンテンツ",
properties: [{
type: "ReasoningDeltaPayload",
parameters: [
{ name: "id", type: "string", description: "この推論生成の一意の識別子" },
{ name: "text", type: "string", description: "逐次出力される推論テキスト" },
{ name: "providerMetadata", type: "SharedV2ProviderMetadata", isOptional: true, description: "プロバイダー固有のメタデータ" }
]
}]
}
]}
/>

### reasoning-end \{#reasoning-end\}

推論生成の終了を示します。

<PropertiesTable
  content={[
{
name: "type",
type: '"reasoning-end"',
description: "チャンク種別の識別子"
},
{
name: "payload",
type: "ReasoningEndPayload",
description: "推論終了に関する情報",
properties: [{
type: "ReasoningEndPayload",
parameters: [
{ name: "id", type: "string", description: "この推論生成の一意の識別子" },
{ name: "signature", type: "string", isOptional: true, description: "利用可能な場合の最終推論シグネチャ" },
{ name: "providerMetadata", type: "SharedV2ProviderMetadata", isOptional: true, description: "プロバイダー固有のメタデータ" }
]
}]
}
]}
/>

### reasoning-signature \{#reasoning-signature\}

高度な推論をサポートするモデル（OpenAI の o1 シリーズなど）の reasoning signature を含みます。これは、モデルの内部推論プロセスに関するメタデータ（労力の度合いや推論アプローチなど）を表すものであり、実際の推論内容そのものは含みません。

<PropertiesTable
  content={[
{
name: "type",
type: '"reasoning-signature"',
description: "チャンク種別の識別子"
},
{
name: "payload",
type: "ReasoningSignaturePayload",
description: "モデルの推論プロセス特性に関するメタデータ",
properties: [{
type: "ReasoningSignaturePayload",
parameters: [
{ name: "id", type: "string", description: "推論セッションの一意の識別子" },
{ name: "signature", type: "string", description: "推論アプローチや労力の度合いを示すシグネチャ（例：推論労力設定）" },
{ name: "providerMetadata", type: "SharedV2ProviderMetadata", isOptional: true, description: "プロバイダー固有のメタデータ" }
]
}]
}
]}
/>

## ツールのチャンク \{#tool-chunks\}

### tool-call \{#tool-call\}

ツールを呼び出しています。

<PropertiesTable
  content={[
{
name: "type",
type: '"tool-call"',
description: "チャンクの種類を示す識別子"
},
{
name: "payload",
type: "ToolCallPayload",
description: "ツール呼び出しに関する情報",
properties: [{
type: "ToolCallPayload",
parameters: [
{ name: "toolCallId", type: "string", description: "このツール呼び出しの一意の識別子" },
{ name: "toolName", type: "string", description: "呼び出されるツール名" },
{ name: "args", type: "Record<string, any>", isOptional: true, description: "ツールに渡される引数" },
{ name: "providerExecuted", type: "boolean", isOptional: true, description: "プロバイダーがツールを実行したかどうか" },
{ name: "output", type: "any", isOptional: true, description: "利用可能な場合のツールの出力" },
{ name: "providerMetadata", type: "SharedV2ProviderMetadata", isOptional: true, description: "プロバイダー固有のメタデータ" }
]
}]
}
]}
/>

### tool-result \{#tool-result\}

ツール実行の結果。

<PropertiesTable
  content={[
{
name: "type",
type: '"tool-result"',
description: "チャンク種別識別子"
},
{
name: "payload",
type: "ToolResultPayload",
description: "ツール実行の結果",
properties: [{
type: "ToolResultPayload",
parameters: [
{ name: "toolCallId", type: "string", description: "ツール呼び出しのユニークな識別子" },
{ name: "toolName", type: "string", description: "実行されたツール名" },
{ name: "result", type: "any", description: "ツール実行の結果" },
{ name: "isError", type: "boolean", isOptional: true, description: "結果がエラーかどうか" },
{ name: "providerExecuted", type: "boolean", isOptional: true, description: "プロバイダーがツールを実行したかどうか" },
{ name: "args", type: "Record<string, any>", isOptional: true, description: "ツールに渡された引数" },
{ name: "providerMetadata", type: "SharedV2ProviderMetadata", isOptional: true, description: "プロバイダー固有のメタデータ" }
]
}]
}
]}
/>

### tool-call-input-streaming-start \{#tool-call-input-streaming-start\}

ツール呼び出し引数のストリーミング開始を示します。

<PropertiesTable
  content={[
{
name: "type",
type: '"tool-call-input-streaming-start"',
description: "チャンク種別の識別子"
},
{
name: "payload",
type: "ToolCallInputStreamingStartPayload",
description: "ツール呼び出し入力ストリーミング開始の情報",
properties: [{
type: "ToolCallInputStreamingStartPayload",
parameters: [
{ name: "toolCallId", type: "string", description: "このツール呼び出しの一意の識別子" },
{ name: "toolName", type: "string", description: "呼び出されるツール名" },
{ name: "providerExecuted", type: "boolean", isOptional: true, description: "プロバイダーがツールを実行したかどうか" },
{ name: "dynamic", type: "boolean", isOptional: true, description: "ツール呼び出しが動的かどうか" },
{ name: "providerMetadata", type: "SharedV2ProviderMetadata", isOptional: true, description: "プロバイダー固有のメタデータ" }
]
}]
}
]}
/>

### tool-call-delta \{#tool-call-delta\}

ストリーミング中のツール呼び出し引数の増分更新。

<PropertiesTable
  content={[
{
name: "type",
type: '"tool-call-delta"',
description: "チャンク種別の識別子"
},
{
name: "payload",
type: "ToolCallDeltaPayload",
description: "ツール呼び出し引数の増分更新",
properties: [{
type: "ToolCallDeltaPayload",
parameters: [
{ name: "argsTextDelta", type: "string", description: "ツール引数に対する増分テキストデルタ" },
{ name: "toolCallId", type: "string", description: "このツール呼び出しの一意の識別子" },
{ name: "toolName", type: "string", isOptional: true, description: "呼び出されるツール名" },
{ name: "providerMetadata", type: "SharedV2ProviderMetadata", isOptional: true, description: "プロバイダ固有のメタデータ" }
]
}]
}
]}
/>

### tool-call-input-streaming-end \{#tool-call-input-streaming-end\}

ツール呼び出し引数のストリーミングの終了を示します。

<PropertiesTable
  content={[
{
name: "type",
type: '"tool-call-input-streaming-end"',
description: "チャンクタイプの識別子"
},
{
name: "payload",
type: "ToolCallInputStreamingEndPayload",
description: "ツール呼び出し入力ストリーミング終了に関する情報",
properties: [{
type: "ToolCallInputStreamingEndPayload",
parameters: [
{ name: "toolCallId", type: "string", description: "このツール呼び出しの一意の識別子" },
{ name: "providerMetadata", type: "SharedV2ProviderMetadata", isOptional: true, description: "プロバイダ固有のメタデータ" }
]
}]
}
]}
/>

### tool-error \{#tool-error\}

ツールの実行中にエラーが発生しました。

<PropertiesTable
  content={[
{
name: "type",
type: '"tool-error"',
description: "チャンク種別を識別するID"
},
{
name: "payload",
type: "ToolErrorPayload",
description: "ツールエラーに関する情報",
properties: [{
type: "ToolErrorPayload",
parameters: [
{ name: "id", type: "string", isOptional: true, description: "任意のID" },
{ name: "toolCallId", type: "string", description: "ツール呼び出しの一意のID" },
{ name: "toolName", type: "string", description: "失敗したツール名" },
{ name: "args", type: "Record<string, any>", isOptional: true, description: "ツールに渡された引数" },
{ name: "error", type: "unknown", description: "発生したエラー" },
{ name: "providerExecuted", type: "boolean", isOptional: true, description: "プロバイダーがツールを実行したかどうか" },
{ name: "providerMetadata", type: "SharedV2ProviderMetadata", isOptional: true, description: "プロバイダー固有のメタデータ" }
]
}]
}
]}
/>

## ソースとファイルの分割 \{#source-and-file-chunks\}

### source \{#source\}

コンテンツのソース情報が含まれます。

<PropertiesTable
  content={[
{
name: "type",
type: '"source"',
description: "チャンクタイプの識別子"
},
{
name: "payload",
type: "SourcePayload",
description: "ソース情報",
properties: [{
type: "SourcePayload",
parameters: [
{ name: "id", type: "string", description: "一意の識別子" },
{ name: "sourceType", type: "'url' | 'document'", description: "ソースの種別" },
{ name: "title", type: "string", description: "ソースのタイトル" },
{ name: "mimeType", type: "string", isOptional: true, description: "ソースのMIMEタイプ" },
{ name: "filename", type: "string", isOptional: true, description: "該当する場合のファイル名" },
{ name: "url", type: "string", isOptional: true, description: "該当する場合のURL" },
{ name: "providerMetadata", type: "SharedV2ProviderMetadata", isOptional: true, description: "プロバイダ固有のメタデータ" }
]
}]
}
]}
/>

### file \{#file\}

ファイルデータを含みます。

<PropertiesTable
  content={[
{
name: "type",
type: '"file"',
description: "チャンクの種類を識別する値"
},
{
name: "payload",
type: "FilePayload",
description: "ファイルデータ",
properties: [{
type: "FilePayload",
parameters: [
{ name: "data", type: "string | Uint8Array", description: "ファイルのデータ" },
{ name: "base64", type: "string", isOptional: true, description: "該当する場合のBase64エンコード済みデータ" },
{ name: "mimeType", type: "string", description: "ファイルのMIMEタイプ" },
{ name: "providerMetadata", type: "SharedV2ProviderMetadata", isOptional: true, description: "プロバイダー固有のメタデータ" }
]
}]
}
]}
/>

## 制御チャンク（Control Chunks） \{#control-chunks\}

### start \{#start\}

ストリーミングの開始を示します。

<PropertiesTable
  content={[
{
name: "type",
type: '"start"',
description: "チャンクタイプ識別子"
},
{
name: "payload",
type: "StartPayload",
description: "開始情報",
properties: [{
type: "StartPayload",
parameters: [
{ name: "[key: string]", type: "any", description: "追加の開始データ" }
]
}]
}
]}
/>

### step-start \{#step-start\}

処理ステップの開始を示します。

<PropertiesTable
  content={[
{
name: "type",
type: '"step-start"',
description: "チャンク種別識別子"
},
{
name: "payload",
type: "StepStartPayload",
description: "ステップ開始に関する情報",
properties: [{
type: "StepStartPayload",
parameters: [
{ name: "messageId", type: "string", isOptional: true, description: "メッセージ識別子（任意）" },
{ name: "request", type: "object", description: "本文などを含むリクエスト情報" },
{ name: "warnings", type: "LanguageModelV2CallWarning[]", isOptional: true, description: "言語モデル呼び出しによる警告（任意）" }
]
}]
}
]}
/>

### step-finish \{#step-finish\}

処理ステップの完了を示します。

<PropertiesTable
  content={[
{
name: "type",
type: '"step-finish"',
description: "チャンク種別の識別子"
},
{
name: "payload",
type: "StepFinishPayload",
description: "ステップ完了情報",
properties: [{
type: "StepFinishPayload",
parameters: [
{ name: "id", type: "string", isOptional: true, description: "任意の識別子" },
{ name: "messageId", type: "string", isOptional: true, description: "任意のメッセージ識別子" },
{ name: "stepResult", type: "object", description: "理由・警告・継続情報を含むステップ実行結果" },
{ name: "output", type: "object", description: "使用量統計を含む出力情報" },
{ name: "metadata", type: "object", description: "リクエストおよびプロバイダ情報を含む実行メタデータ" },
{ name: "totalUsage", type: "LanguageModelV2Usage", isOptional: true, description: "総使用量統計" },
{ name: "response", type: "LanguageModelV2ResponseMetadata", isOptional: true, description: "レスポンスのメタデータ" },
{ name: "providerMetadata", type: "SharedV2ProviderMetadata", isOptional: true, description: "プロバイダ固有のメタデータ" }
]
}]
}
]}
/>

### raw \{#raw\}

プロバイダー提供の未加工データを含みます。

<PropertiesTable
  content={[
{
name: "type",
type: '"raw"',
description: "チャンクタイプ識別子"
},
{
name: "payload",
type: "RawPayload",
description: "プロバイダーの未加工データ",
properties: [{
type: "RawPayload",
parameters: [
{ name: "[key: string]", type: "any", description: "プロバイダーから提供される未加工データ" }
]
}]
}
]}
/>

### finish \{#finish\}

ストリームは正常に終了しました。

<PropertiesTable
  content={[
{
name: "type",
type: '"finish"',
description: "チャンク種別識別子"
},
{
name: "payload",
type: "FinishPayload",
description: "完了に関する情報",
properties: [{
type: "FinishPayload",
parameters: [
{ name: "stepResult", type: "object", description: "ステップの実行結果" },
{ name: "output", type: "object", description: "使用量を含む出力情報" },
{ name: "metadata", type: "object", description: "実行時メタデータ" },
{ name: "messages", type: "object", description: "メッセージ履歴" }
]
}]
}
]}
/>

### error \{#error\}

ストリーミング中にエラーが発生しました。

<PropertiesTable
  content={[
{
name: "type",
type: '"error"',
description: "チャンク種別の識別子"
},
{
name: "payload",
type: "ErrorPayload",
description: "エラー情報",
properties: [{
type: "ErrorPayload",
parameters: [
{ name: "error", type: "unknown", description: "発生したエラー" }
]
}]
}
]}
/>

### abort \{#abort\}

ストリームが中断されました。

<PropertiesTable
  content={[
{
name: "type",
type: '"abort"',
description: "チャンク種別の識別子"
},
{
name: "payload",
type: "AbortPayload",
description: "中断情報",
properties: [{
type: "AbortPayload",
parameters: [
{ name: "[key: string]", type: "any", description: "追加の中断データ" }
]
}]
}
]}
/>

## オブジェクトと出力のチャンク \{#object-and-output-chunks\}

### object \{#object\}

定義済みスキーマを用いた出力生成時に発生します。指定された Zod または JSON スキーマに準拠する、部分的または完全な構造化データを含みます。このチャンクは、実行コンテキストによってはスキップされ、構造化オブジェクト生成のストリーミングに使用されます。

<PropertiesTable
  content={[
{
name: "type",
type: '"object"',
description: "チャンクの種類を示す識別子"
},
{
name: "object",
type: "PartialSchemaOutput<OUTPUT>",
description: "定義されたスキーマに適合する部分的または完全な構造化データ。型は OUTPUT スキーマのパラメータによって決定されます。"
}
]}
/>

### tool-output \{#tool-output\}

エージェントやワークフローの実行結果を含み、特に使用状況統計や完了イベントの追跡に用いられます。入れ子の実行コンテキストを提供するため、他のチャンクタイプ（finish チャンクなど）をラップすることがよくあります。

<PropertiesTable
  content={[
{
name: "type",
type: '"tool-output"',
description: "チャンクタイプの識別子"
},
{
name: "payload",
type: "ToolOutputPayload",
description: "メタデータ付きでラップされた実行出力",
properties: [{
type: "ToolOutputPayload",
parameters: [
{ name: "output", type: "ChunkType", description: "入れ子になったチャンクデータ。使用状況統計を含む finish イベントを持つことがよくあります" }
]
}]
}
]}
/>

### step-output \{#step-output\}

ワークフローの各ステップ実行からの出力を含み、主に利用状況の追跡やステップ完了イベントに使用されます。tool-output に似ていますが、個々のワークフローステップ専用です。

<PropertiesTable
  content={[
{
name: "type",
type: '"step-output"',
description: "チャンクタイプの識別子"
},
{
name: "payload",
type: "StepOutputPayload",
description: "メタデータ付きのワークフローステップ実行出力",
properties: [{
type: "StepOutputPayload",
parameters: [
{ name: "output", type: "ChunkType", description: "ステップ実行に由来する入れ子のチャンクデータ。通常は終了イベントやその他のステップ結果を含みます" }
]
}]
}
]}
/>

## メタデータと特殊チャンク \{#metadata-and-special-chunks\}

### response-metadata \{#response-metadata\}

LLM プロバイダーのレスポンスに関するメタデータを含みます。モデル ID、タイムスタンプ、レスポンスヘッダーなどの追加コンテキストを提供するために、一部のプロバイダーがテキスト生成後に出力します。このチャンクは内部の状態管理に使用され、メッセージの組み立てには影響しません。

<PropertiesTable
  content={[
{
name: "type",
type: '"response-metadata"',
description: "チャンク種別の識別子"
},
{
name: "payload",
type: "ResponseMetadataPayload",
description: "トラッキングやデバッグのためのプロバイダーのレスポンスメタデータ",
properties: [{
type: "ResponseMetadataPayload",
parameters: [
{ name: "signature", type: "string", isOptional: true, description: "利用可能な場合のレスポンス署名" },
{ name: "[key: string]", type: "any", description: "プロバイダー固有の追加メタデータフィールド（例：id、modelId、timestamp、headers）" }
]
}]
}
]}
/>

### watch \{#watch\}

エージェントの実行に関する監視・可観測性データを含みます。`stream()` の利用コンテキストに応じて、ワークフローの状態、実行の進行状況、その他のランタイム情報を含む場合があります。

<PropertiesTable
  content={[
{
name: "type",
type: '"watch"',
description: "チャンクタイプ識別子"
},
{
name: "payload",
type: "WatchPayload",
description: "エージェント実行の可観測性とデバッグのための監視データ",
properties: [{
type: "WatchPayload",
parameters: [
{ name: "workflowState", type: "object", isOptional: true, description: "現在のワークフロー実行状態（ワークフローで使用される場合）" },
{ name: "eventTimestamp", type: "number", isOptional: true, description: "イベント発生時のタイムスタンプ" },
{ name: "[key: string]", type: "any", description: "追加の監視・実行データ" }
]
}]
}
]}
/>

### tripwire \{#tripwire\}

出力プロセッサによってコンテンツがブロックされたため、ストリームが強制的に終了された際に発行されます。これは、有害または不適切なコンテンツの配信を防ぐための安全機構として機能します。

<PropertiesTable
  content={[
{
name: "type",
type: '"tripwire"',
description: "チャンクの種類を示す識別子"
},
{
name: "payload",
type: "TripwirePayload",
description: "安全機構によりストリームが終了された理由に関する情報",
properties: [{
type: "TripwirePayload",
parameters: [
{ name: "tripwireReason", type: "string", description: "コンテンツがブロックされた理由の説明（例: 'Output processor blocked content'）" }
]
}]
}
]}
/>

## 使い方の例 \{#usage-example\}

```typescript
const stream = await agent.stream('Hello');

for await (const chunk of stream.fullStream) {
  switch (chunk.type) {
    case 'text-delta':
      console.log('テキスト:', chunk.payload.text);
      break;

    case 'tool-call':
      console.log('ツール呼び出し:', chunk.payload.toolName);
      break;

    case 'tool-result':
      console.log('ツール結果:', chunk.payload.result);
      break;

    case 'reasoning-delta':
      console.log('推論:', chunk.payload.text);
      break;

    case 'finish':
      console.log('完了:', chunk.payload.stepResult.reason);
      console.log('使用状況:', chunk.payload.output.usage);
      break;

    case 'error':
      console.error('エラー:', chunk.payload.error);
      break;
  }
}
```

## 関連する型 \{#related-types\}

* [.stream()](/docs/reference/streaming/agents/stream) - これらのチャンクを生成して配信するストリームを返すメソッド
* [MastraModelOutput](./agents/MastraModelOutput) - これらのチャンクを生成して配信するストリームオブジェクト
* [workflow.streamVNext()](./workflows/streamVNext) - ワークフロー向けにこれらのチャンクを生成して配信するストリームを返すメソッド