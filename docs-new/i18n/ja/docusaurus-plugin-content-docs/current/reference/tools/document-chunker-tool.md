---
title: "createDocumentChunkerTool() "
description: Mastra の Document Chunker Tool に関するドキュメント。効率的な処理と検索のために、ドキュメントを小さなチャンクに分割します。
---

# createDocumentChunkerTool() \{#createdocumentchunkertool\}

`createDocumentChunkerTool()` 関数は、文書をより小さなチャンクに分割し、効率的な処理や検索を可能にするツールを作成します。さまざまなチャンク手法と設定可能なパラメータに対応しています。

## 基本的な使い方 \{#basic-usage\}

```typescript
import { createDocumentChunkerTool, MDocument } from '@mastra/rag';

const document = new MDocument({
  text: 'ドキュメントの内容をここに入力…',
  metadata: { source: 'ユーザーマニュアル' },
});

const chunker = createDocumentChunkerTool({
  doc: document,
  params: {
    strategy: 'recursive',
    size: 512,
    overlap: 50,
    separator: '\n',
  },
});

const { chunks } = await chunker.execute();
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "doc",
type: "MDocument",
description: "分割するドキュメント",
isOptional: false,
},
{
name: "params",
type: "ChunkParams",
description: "チャンク分割の設定パラメータ",
isOptional: true,
defaultValue: "チャンク分割のデフォルト設定",
},
]}
/>

### ChunkParams \{#chunkparams\}

<PropertiesTable
  content={[
{
name: "strategy",
type: "'recursive'",
description: "使用するチャンク化戦略",
isOptional: true,
defaultValue: "'recursive'",
},
{
name: "size",
type: "number",
description: "各チャンクの目標サイズ（トークン数/文字数）",
isOptional: true,
defaultValue: "512",
},
{
name: "overlap",
type: "number",
description: "チャンク間で重複させるトークン数/文字数",
isOptional: true,
defaultValue: "50",
},
{
name: "separator",
type: "string",
description: "チャンクの区切りとして使用する文字列",
isOptional: true,
defaultValue: "'\\n'",
},
]}
/>

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "chunks",
type: "DocumentChunk[]",
description: "内容とメタデータを含むドキュメントチャンクの配列",
},
]}
/>

## カスタムパラメータの例 \{#example-with-custom-parameters\}

```typescript
const technicalDoc = new MDocument({
  text: longDocumentContent,
  metadata: {
    type: 'technical',
    version: '1.0',
  },
});

const chunker = createDocumentChunkerTool({
  doc: technicalDoc,
  params: {
    strategy: 'recursive',
    size: 1024, // より大きいチャンク
    overlap: 100, // オーバーラップを増やす
    separator: '\n\n', // 空行（2つの改行）で分割
  },
});

const { chunks } = await chunker.execute();

// チャンクの処理
chunks.forEach((chunk, index) => {
  console.log(`チャンク${index + 1}の長さ: ${chunk.content.length}`);
});
```

## ツールの詳細 \{#tool-details\}

chunker は、以下のプロパティを持つ Mastra のツールとして作成されます:

* **ツール ID**: `Document Chunker {strategy} {size}`
* **説明**: `{strategy} 戦略を用い、サイズ {size}、オーバーラップ {overlap} でドキュメントを分割します`
* **入力スキーマ**: 空のオブジェクト（追加の入力は不要）
* **出力スキーマ**: chunks 配列を含むオブジェクト

## 関連項目 \{#related\}

* [MDocument](../rag/document)
* [createVectorQueryTool](./vector-query-tool)