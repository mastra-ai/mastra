---
title: "Upstash Storage"
description: Mastra における Upstash ストレージ実装のドキュメント
---

# Upstash Storage \{#upstash-storage\}

Upstash のストレージ実装は、Upstash の Redis 互換キー値ストアを用いた、サーバーレスに適したストレージソリューションを提供します。

:::warning

**重要:** Mastra と Upstash を併用する場合、エージェントとの会話中に大量の Redis コマンドが発生するため、従量課金モデルでは想定外の高額なコストにつながる可能性があります。コストを予測しやすくするため、**固定料金プラン**のご利用を強く推奨します。詳細は [Upstash pricing](https://upstash.com/pricing/redis)、背景は [GitHub issue #5850](https://github.com/mastra-ai/mastra/issues/5850) を参照してください。

:::

## インストール \{#installation\}

```bash copy
npm install @mastra/upstash@latest
```

## 使い方 \{#usage\}

```typescript copy showLineNumbers
import { UpstashStore } from '@mastra/upstash';

const storage = new UpstashStore({
  url: process.env.UPSTASH_URL,
  token: process.env.UPSTASH_TOKEN,
});
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "url",
type: "string",
description: "Upstash Redis の URL",
isOptional: false,
},
{
name: "token",
type: "string",
description: "Upstash Redis の認証トークン",
isOptional: false,
},
{
name: "prefix",
type: "string",
description: "保存される全アイテムのキー接頭辞",
isOptional: true,
defaultValue: "mastra:",
},
]}
/>

## 追記事項 \{#additional-notes\}

### キー構造 \{#key-structure\}

Upstash のストレージ実装はキー・バリュー型の構造を採用しています:

* スレッド用キー: `{prefix}thread:{threadId}`
* メッセージ用キー: `{prefix}message:{messageId}`
* メタデータ用キー: `{prefix}metadata:{entityId}`

### サーバーレスの利点 \{#serverless-benefits\}

Upstash Storage は、特にサーバーレス環境でのデプロイに適しています:

* 接続管理が不要
* リクエスト単位の従量課金
* グローバルなレプリケーションオプション
* エッジ環境に対応

### データの永続化 \{#data-persistence\}

Upstash は次の機能を提供します:

* データの自動永続化
* 時点復元（Point-in-time Recovery）
* リージョン間レプリケーションのオプション

### パフォーマンスに関する考慮事項 \{#performance-considerations\}

最適なパフォーマンスのために:

* データを整理するために適切なキーのプレフィックスを使用する
* Redisのメモリ使用量を監視する
* 必要に応じてデータの有効期限ポリシーを検討する