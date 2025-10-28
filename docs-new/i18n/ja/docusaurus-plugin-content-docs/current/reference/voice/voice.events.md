---
title: "リファレンス: 音声イベント"
description: "特にリアルタイムの音声インタラクションにおける、音声プロバイダーが発行するイベントのドキュメント。"
---

# 音声イベント \{#voice-events\}

音声プロバイダーは、リアルタイムの音声対話中にさまざまなイベントを発生させます。これらのイベントは [voice.on()](./voice.on) メソッドで監視でき、インタラクティブな音声アプリケーションを構築するうえで特に重要です。

## 共通イベント \{#common-events\}

これらのイベントは、リアルタイム音声プロバイダーで一般的に実装されています:

<PropertiesTable
  content={[
{
name: "error",
type: "Error",
description:
"音声処理中にエラーが発生した場合、または音声データ形式がサポートされていない場合に発行されます",
},
{
name: "session.created",
type: "object",
description:
"OpenAI サービスで新しいセッションが作成されたときに発行されます",
},
{
name: "session.updated",
type: "object",
description: "セッションの設定が更新されたときに発行されます",
},
{
name: "response.created",
type: "object",
description: "AI アシスタントが新しいレスポンスを生成したときに発行されます",
},
{
name: "response.done",
type: "object",
description: "AI アシスタントがレスポンスを完了したときに発行されます",
},
{
name: "speaker",
type: "StreamWithId",
description:
"音声出力に接続できる新しいオーディオストリームとともに発行されます",
},
{
name: "writing",
type: "object",
description:
"テキストが書き起こし中（ユーザー）または生成中（アシスタント）のときに発行されます",
},
{
name: "speaking",
type: "object",
description:
"音声プロバイダーから音声データが利用可能になったときに発行されます",
},
{
name: "speaking.done",
type: "object",
description: "音声プロバイダーの発話が完了したときに発行されます",
},
{
name: "tool-call-start",
type: "object",
description: "AI アシスタントがツールの実行を開始したときに発行されます",
},
{
name: "tool-call-result",
type: "object",
description: "ツールの実行が結果とともに完了したときに発行されます",
},
]}
/>

## 注意事項 \{#notes\}

* すべてのイベントが、すべての音声プロバイダーでサポートされているわけではありません
* ペイロードの正確な構造はプロバイダーによって異なる場合があります
* リアルタイムでないプロバイダーでは、これらのイベントの大半は発行されません
* イベントは、会話の状態に応じて反応するインタラクティブなUIの構築に役立ちます
* 不要になったら、[voice.off()](./voice.off) メソッドを使用してイベントリスナーを削除することを検討してください