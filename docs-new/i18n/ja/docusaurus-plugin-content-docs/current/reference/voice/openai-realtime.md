---
title: "リファレンス: OpenAI Realtime Voice"
description: "OpenAIRealtimeVoice クラスのドキュメント。WebSocket 経由でリアルタイムの音声合成（テキスト読み上げ）と音声認識（音声からテキスト変換）を提供します。"
---

# OpenAI Realtime Voice \{#openai-realtime-voice\}

OpenAIRealtimeVoice クラスは、OpenAI の WebSocket ベースの API を用いて、リアルタイムの音声対話機能を提供します。音声から音声へのリアルタイム変換、音声アクティビティ検出、およびイベント駆動の音声ストリーミングをサポートします。

## 使い方の例 \{#usage-example\}

```typescript
import { OpenAIRealtimeVoice } from '@mastra/voice-openai-realtime';
import { playAudio, getMicrophoneStream } from '@mastra/node-audio';

// 環境変数を使用して既定の設定で初期化します
const voice = new OpenAIRealtimeVoice();

// または、個別の設定で初期化します
const voiceWithConfig = new OpenAIRealtimeVoice({
  apiKey: 'your-openai-api-key',
  model: 'gpt-4o-mini-realtime-preview-2024-12-17',
  speaker: 'alloy', // 既定の音声
});

voiceWithConfig.updateSession({
  turn_detection: {
    type: 'server_vad',
    threshold: 0.6,
    silence_duration_ms: 1200,
  },
});

// 接続を確立する
await voice.connect();

// イベントリスナーを設定する
voice.on('speaker', ({ audio }) => {
  // 音声データ（Int16Array）は既定で PCM 形式として処理
  playAudio(audio);
});

voice.on('writing', ({ text, role }) => {
  // 書き起こしテキストを処理
  console.log(`${role}: ${text}`);
});

// テキストを音声に変換
await voice.speak('こんにちは。本日はどのようにお手伝いできますか？', {
  speaker: 'echo', // 既定の音声を上書き
});

// 音声入力を処理
const microphoneStream = getMicrophoneStream();
await voice.send(microphoneStream);

// 完了したら切断
voice.connect();
```

## 構成 \{#configuration\}

### コンストラクターのオプション \{#constructor-options\}

<PropertiesTable
  content={[
{
name: "model",
type: "string",
description: "リアルタイム音声対話に使用するモデルID。",
isOptional: true,
defaultValue: "'gpt-4o-mini-realtime-preview-2024-12-17'",
},
{
name: "apiKey",
type: "string",
description:
"OpenAI APIキー。未指定の場合は環境変数 OPENAI_API_KEY が使用されます。",
isOptional: true,
},
{
name: "speaker",
type: "string",
description: "音声合成のデフォルトのボイスID。",
isOptional: true,
defaultValue: "'alloy'",
},
]}
/>

### Voice Activity Detection (VAD) の設定 \{#voice-activity-detection-vad-configuration\}

<PropertiesTable
  content={[
{
name: "type",
type: "string",
description:
"使用するVADの種類。サーバー側のVADのほうが精度に優れます。",
isOptional: true,
defaultValue: "'server_vad'",
},
{
name: "threshold",
type: "number",
description: "音声検出の感度（0.0〜1.0）。",
isOptional: true,
defaultValue: "0.5",
},
{
name: "prefix_padding_ms",
type: "number",
description:
"音声が検出される直前まで遡って含める音声の長さ（ミリ秒）。",
isOptional: true,
defaultValue: "1000",
},
{
name: "silence_duration_ms",
type: "number",
description: "発話終了とみなすまでに必要な無音の長さ（ミリ秒）。",
isOptional: true,
defaultValue: "1000",
},
]}
/>

## 手法 \{#methods\}

### connect() \{#connect\}

OpenAI のリアルタイムサービスに接続します。speak、listen、send 関数を使用する前に呼び出す必要があります。

<PropertiesTable
  content={[
{
name: "returns",
type: "Promise<void>",
description: "接続が確立されると解決される Promise。",
},
]}
/>

### speak() \{#speak\}

設定された音声モデルを使用して発話イベントを送出します。入力は文字列または読み取り可能なストリームを受け付けます。

<PropertiesTable
  content={[
{
name: "input",
type: "string | NodeJS.ReadableStream",
description: "音声に変換するテキストまたはテキストのストリーム。",
isOptional: false,
},
{
name: "options.speaker",
type: "string",
description: "この音声リクエストで使用するボイスID。",
isOptional: true,
defaultValue: "コンストラクタで設定された speaker の値",
},
]}
/>

Returns: `Promise<void>`

### listen() \{#listen\}

音声認識のために音声入力を処理します。音声データの読み取り可能なストリームを受け取り、文字起こし結果のテキストとともに「listening」イベントを発行します。

<PropertiesTable
  content={[
{
name: "audioData",
type: "NodeJS.ReadableStream",
description: "文字起こし対象の音声ストリーム。",
isOptional: false,
},
]}
/>

Returns: `Promise<void>`

### send() \{#send\}

ライブのマイク入力など、連続的な音声ストリーミングのユースケースにおいて、音声データをリアルタイムに OpenAI サービスへストリーミングします。

<PropertiesTable
  content={[
{
name: "audioData",
type: "NodeJS.ReadableStream",
description: "サービスに送信する音声ストリーム。",
isOptional: false,
},
]}
/>

Returns: `Promise<void>`

### updateConfig() \{#updateconfig\}

音声インスタンスのセッション構成を更新します。これにより、音声設定、ターン検出、その他のパラメーターを変更できます。

<PropertiesTable
  content={[
{
name: "sessionConfig",
type: "Realtime.SessionConfig",
description: "適用する新しいセッション構成。",
isOptional: false,
},
]}
/>

Returns: `void`

### addTools() \{#addtools\}

音声インスタンスにツール群を追加します。ツールにより、モデルは会話中に追加の操作を実行できます。OpenAIRealtimeVoice を Agent に追加すると、Agent に設定されたツールは自動的に音声インターフェースで利用可能になります。

<PropertiesTable
  content={[
{
name: "tools",
type: "ToolsInput",
description: "適用するツール設定。",
isOptional: true,
},
]}
/>

戻り値: `void`

### close() \{#close\}

OpenAI のリアルタイムセッションから切断し、リソースを解放します。音声インスタンスの使用が完了したら呼び出してください。

Returns: `void`

### getSpeakers() \{#getspeakers\}

利用可能な音声のスピーカー一覧を返します。

Returns: `Promise<Array<{ voiceId: string; [key: string]: any }>>`

### on() \{#on\}

音声イベントのリスナーを登録します。

<PropertiesTable
  content={[
{
name: "event",
type: "string",
description: "リッスンするイベント名。",
isOptional: false,
},
{
name: "callback",
type: "Function",
description: "イベント発生時に呼び出す関数。",
isOptional: false,
},
]}
/>

戻り値: `void`

### off() \{#off\}

登録済みのイベントリスナーを解除します。

<PropertiesTable
  content={[
{
name: "event",
type: "string",
description: "リッスンを停止するイベント名。",
isOptional: false,
},
{
name: "callback",
type: "Function",
description: "解除する特定のコールバック関数。",
isOptional: false,
},
]}
/>

戻り値: `void`

## イベント \{#events\}

OpenAIRealtimeVoice クラスは次のイベントを発生させます:

<PropertiesTable
  content={[
{
name: "speaking",
type: "event",
description:
"モデルから音声データを受信したときに発火します。コールバックは { audio: Int16Array } を受け取ります。",
},
{
name: "writing",
type: "event",
description:
"音声認識でテキストが取得できたときに発火します。コールバックは { text: string, role: string } を受け取ります。",
},
{
name: "error",
type: "event",
description:
"エラー発生時に発火します。コールバックはエラーオブジェクトを受け取ります。",
},
]}
/>

### OpenAI Realtime のイベント \{#openai-realtime-events\}

&#39;openAIRealtime:&#39; を接頭辞として付けることで、[OpenAI Realtime のユーティリティイベント](https://github.com/openai/openai-realtime-api-beta#reference-client-utility-events)も購読できます:

<PropertiesTable
  content={[
{
name: "openAIRealtime:conversation.created",
type: "event",
description: "新しい会話が作成されたときに発行されます。",
},
{
name: "openAIRealtime:conversation.interrupted",
type: "event",
description: "会話が中断されたときに発行されます。",
},
{
name: "openAIRealtime:conversation.updated",
type: "event",
description: "会話が更新されたときに発行されます。",
},
{
name: "openAIRealtime:conversation.item.appended",
type: "event",
description: "会話に項目が追加されたときに発行されます。",
},
{
name: "openAIRealtime:conversation.item.completed",
type: "event",
description: "会話内の項目が完了したときに発行されます。",
},
]}
/>

## 利用可能な音声 \{#available-voices\}

次の音声オプションを利用できます：

* `alloy`: 中立的でバランスが取れている
* `ash`: クリアで精確
* `ballad`: メロディアスで滑らか
* `coral`: 温かく親しみやすい
* `echo`: 余韻があり深みがある
* `sage`: 落ち着いて思慮深い
* `shimmer`: 明るくエネルギッシュ
* `verse`: 多才で表現力豊か

## 注記 \{#notes\}

* API キーはコンストラクターのオプション、または `OPENAI_API_KEY` 環境変数で指定できます
* OpenAI Realtime Voice API はリアルタイム通信に WebSocket を使用します
* サーバー側の Voice Activity Detection（VAD）は音声検出の精度を高めます
* すべての音声データは Int16Array 形式で処理されます
* 他のメソッドを使用する前に、voice インスタンスは `connect()` で接続しておく必要があります
* 終了時は必ず `close()` を呼び出して、リソースを正しく解放してください
* メモリ管理は OpenAI Realtime API が行います