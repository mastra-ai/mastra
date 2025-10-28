---
title: "メタデータ抽出"
description: Mastra で文書からメタデータを抽出・活用し、文書処理と検索精度を高める例。
---

# メタデータ抽出 \{#metadata-extraction\}

この例では、Mastra のドキュメント処理機能を用いてドキュメントからメタデータを抽出し、活用する方法を示します。
抽出したメタデータは、ドキュメントの整理やフィルタリング、RAG システムにおける高度な検索・取得に活用できます。

## 概要 \{#overview\}

このシステムは、次の2つの方法でメタデータ抽出を行います：

1. ドキュメントからの直接のメタデータ抽出
2. チャンク分割とメタデータ抽出の併用

## セットアップ \{#setup\}

### 依存関係 \{#dependencies\}

必要な依存関係をインポートします：

```typescript copy showLineNumbers filename="src/index.ts"
import { MDocument } from '@mastra/rag';
```

## ドキュメントの作成 \{#document-creation\}

テキスト内容からドキュメントを作成するには:

```typescript copy showLineNumbers{3} filename="src/index.ts"
const doc = MDocument.fromText(`タイトル: 定期的な運動のメリット

定期的な運動には数多くの健康効果があります。心血管系の健康を改善し、
筋肉を強化し、メンタルヘルスを向上させます。

主なメリット:
• ストレスや不安を軽減
• 睡眠の質を改善
• 健康的な体重の維持をサポート
• エネルギーレベルを向上

最適な結果を得るために、専門家は週に少なくとも150分の適度な運動を
推奨しています。`);
```

## 1. メタデータの直接抽出 \{#1-direct-metadata-extraction\}

ドキュメントからメタデータを直接抽出します：

```typescript copy showLineNumbers{17} filename="src/index.ts"
// メタデータ抽出オプションを設定
await doc.extractMetadata({
  keywords: true, // 重要なキーワードを抽出
  summary: true, // 簡潔な要約を生成
});

// 抽出されたメタデータを取得
const meta = doc.getMetadata();
console.log('抽出されたメタデータ:', meta);

// 出力例:
// 抽出されたメタデータ: {
//   keywords: [
//     'exercise',
//     'health benefits',
//     'cardiovascular health',
//     'mental wellbeing',
//     'stress reduction',
//     'sleep quality'
//   ],
//   summary: '定期的な運動は、心血管の健康、筋力、精神的健康の改善など、複数の健康上のメリットをもたらします。主なメリットには、ストレス軽減、睡眠の質の向上、体重管理、エネルギー増加が含まれます。推奨される運動時間は週150分です。'
// }
```

## 2. メタデータを用いたチャンク分割 \{#2-chunking-with-metadata\}

ドキュメントのチャンク分割をメタデータ抽出と組み合わせます。

```typescript copy showLineNumbers{40} filename="src/index.ts"
// メタデータ抽出を使用したチャンキングの設定
await doc.chunk({
  strategy: 'recursive', // 再帰的チャンキング戦略を使用
  size: 200, // 最大チャンクサイズ
  extract: {
    keywords: true, // チャンクごとにキーワードを抽出
    summary: true, // チャンクごとに要約を生成
  },
});

// チャンクからメタデータを取得
const metaTwo = doc.getMetadata();
console.log('チャンクメタデータ:', metaTwo);

// 出力例:
// チャンクメタデータ: {
//   keywords: [
//     '運動',
//     '健康効果',
//     '心血管の健康',
//     '精神的健康',
//     'ストレス軽減',
//     '睡眠の質'
//   ],
//   summary: '定期的な運動は、心血管の健康、筋力、精神的健康の向上を含む複数の健康効果をもたらします。主な効果には、ストレス軽減、より良い睡眠、体重管理、エネルギーの増加が含まれます。推奨される運動時間は週150分です。'
// }
```

<br />

<br />

<hr className="dark:border-[#404040] border-gray-300" />

<br />

<br />

<GithubLink
  link={
"https://github.com/mastra-ai/mastra/blob/main/examples/basics/rag/metadata-extraction"
}
/>
