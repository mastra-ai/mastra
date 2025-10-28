---
title: "Cedar-OS とともに"
description: "Cedar-OS を使って Mastra エージェント向けの AIネイティブなフロントエンドを構築する"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Mastra と Cedar-OS を統合する \{#integrate-cedar-os-with-mastra\}

Cedar-OS は、最先端の AI ネイティブアプリケーションを構築するために特化して設計された、オープンソースのエージェント指向 UI フレームワークです。Cedar は Mastra を念頭に置いて開発されました。

## Cedar は使うべき？ \{#should-you-use-cedar\}

Cedar が重視する主な柱については、[こちら](https://docs.cedarcopilot.com/introduction/philosophy)で詳しくご覧いただけます。

#### 1. 開発者エクスペリエンス \{#1-developer-experience\}

* **すべてのコンポーネントを shadcn 方式で個別取得** – すべてのコードはあなたの手元にあり、自由にスタイルできます
* **設定不要ですぐ動作** – チャットコンポーネントを置くだけで、そのまま動きます
* **完全に拡張可能** - 完全にカスタマイズ可能な [Zustand ストアアーキテクチャ](https://docs.cedarcopilot.com/introduction/architecture) 上に構築。内部のあらゆる関数を1行でオーバーライドできます。

#### 2. 真に AI ネイティブなアプリケーションの実現 \{#2-enabling-truly-ai-native-applications\}

史上初めて、プロダクトに生命を吹き込める時代になりました。Cedar は、生命感のあるプロダクトづくりを支援します。

* **[Spells](https://docs.cedarcopilot.com/spells/spells#what-are-spells)** - ユーザーはキーボードショートカット、マウスイベント、テキスト選択などから AI を起動できます
* **[State Diff Management](https://docs.cedarcopilot.com/state-diff/using-state-diff)** - エージェントの出力を受け入れる／却下する権限をユーザーに付与
* **[Voice Integration](https://docs.cedarcopilot.com/voice/voice-integration)** - ユーザーが音声でアプリを操作できるようにする

## クイックスタート \{#quick-start\}

### プロジェクトを設定する \{#set-up-your-project\}

Cedar の CLI コマンドを実行します：

```bash
npx cedar-os-cli plant-seed
```

ゼロから始める場合は、モノレポでフロントエンドとバックエンドの両方を完全にセットアップできる **Mastra starter** テンプレートを選択してください

すでに Mastra のバックエンドがある場合は、代わりに **blank frontend cedar repo** オプションを使用してください。

* これにより、Cedar のコンポーネントや依存関係一式をダウンロードするオプションが提供されます。まずは、チャット用コンポーネントのいずれかを少なくとも1つダウンロードすることをおすすめします。

### アプリを CedarCopilot でラップする \{#wrap-your-app-with-cedarcopilot\}

Mastra のバックエンドに接続するには、アプリケーションを CedarCopilot プロバイダーでラップします。

```tsx
import { CedarCopilot } from 'cedar-os';

function App() {
  return (
    <CedarCopilot
      llmProvider={{
        provider: 'mastra',
        baseURL: 'http://localhost:4111', // Mastraのデフォルト開発ポート
        apiKey: process.env.NEXT_PUBLIC_MASTRA_API_KEY, // オプション — バックエンド認証用
      }}
    >
      <YourApp />
    </CedarCopilot>
  );
}
```

### Mastra エンドポイントの設定 \{#configure-mastra-endpoints\}

[Mastra Configuration Options](https://docs.cedarcopilot.com/agent-backend-connection/agent-backend-connection#mastra-configuration-options) に従って、Cedar と連携できるように Mastra のバックエンドを設定します。

Mastra サーバー（モノレポの場合は Next.js のサーバーレスルート）で [API ルートを登録](https://mastra.ai/en/examples/deployment/custom-api-route) します：

```ts mastra/src/index.ts
import { registerApiRoute } from '@mastra/core/server';

// POST /chat
// チャットの非ストリーミングデフォルトエンドポイント
registerApiRoute('/chat', {
  method: 'POST',
  // …zodで入力を検証
  handler: async c => {
    /* agent.generate()のロジック */
  },
});

// POST /chat/stream (SSE)
// チャットのストリーミングデフォルトエンドポイント
registerApiRoute('/chat/stream', {
  method: 'POST',
  handler: async c => {
    /* SSE形式でエージェント出力をストリーミング */
  },
});
```

### Cedar コンポーネントを追加する \{#add-cedar-components\}

Cedar コンポーネントをフロントエンドに追加しましょう。詳しくは [Chat Overview](https://docs.cedarcopilot.com/chat/chat-overview) をご覧ください。

これでバックエンドとフロントエンドが接続されました。Mastra エージェントを使って、AI ネイティブな体験の構築を始める準備が整いました。

## さらに詳しく \{#more-information\}

* 追加の設定オプションについては[Mastra の詳細な統合ガイド](https://docs.cedarcopilot.com/agent-backend-connection/mastra#extending-mastra)をご確認ください（問題が発生した場合の手動インストール手順も含まれます）
* Cedar が用意した Mastra 向けの最適化や機能をチェック
  * **シームレスなイベントストリーミング** - [Mastra のストリーミングイベント](https://docs.cedarcopilot.com/chat/custom-message-rendering#mastra-event-renderer)の自動レンダリング
  * **音声エンドポイント対応** - 組み込みの[音声バックエンド統合](https://docs.cedarcopilot.com/voice/agentic-backend#endpoint-configuration)
  * **エンドツーエンドの型安全性** - アプリと Mastra バックエンド間の通信のための[型定義](https://docs.cedarcopilot.com/type-safety/typing-agent-requests)
* [Discord に参加しよう！](https://discord.gg/4AWawRjNdZ) Cedar チームは皆さんをお迎えできるのを楽しみにしています :)