---
title: "データベース固有の構成"
description: ベクトル検索のパフォーマンスを最適化し、各ベクトルストアの独自機能を活用するための、データベース固有の構成の使い方を学びます。
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# データベース固有の設定 \{#database-specific-configurations\}

この例では、ベクタークエリツールでデータベース固有の設定を活用してパフォーマンスを最適化し、各種ベクターストアの特有の機能を引き出す方法を示します。

## 複数環境のセットアップ \{#multi-environment-setup\}

環境ごとに異なる設定を使い分けます:

<Tabs>
  <TabItem value="typescript" label="TypeScript">
    ```typescript
    import { openai } from "@ai-sdk/openai";
    import { createVectorQueryTool } from "@mastra/rag";
    import { RuntimeContext } from "@mastra/core/runtime-context";

    // ベース設定
    const createSearchTool = (environment: 'dev' | 'staging' | 'prod') => {
      return createVectorQueryTool({
        vectorStoreName: "pinecone",
        indexName: "documents",
        model: openai.embedding("text-embedding-3-small"),
        databaseConfig: {
          pinecone: {
            namespace: environment
          }
        }
      });
    };

    // 環境別ツールを作成
    const devSearchTool = createSearchTool('dev');
    const prodSearchTool = createSearchTool('prod');

    // もしくは実行時オーバーライドを使用
    const dynamicSearchTool = createVectorQueryTool({
      vectorStoreName: "pinecone",
      indexName: "documents",
      model: openai.embedding("text-embedding-3-small")
    });

    // 実行時に環境を切り替える
    const switchEnvironment = async (environment: string, query: string) => {
      const runtimeContext = new RuntimeContext();
      runtimeContext.set('databaseConfig', {
        pinecone: {
          namespace: environment
        }
      });

      return await dynamicSearchTool.execute({
        context: { queryText: query },
        mastra,
        runtimeContext
      });
    };
    ```
  </TabItem>

  <TabItem value="javascript" label="JavaScript">
    ```javascript
    import { openai } from "@ai-sdk/openai";
    import { createVectorQueryTool } from "@mastra/rag";
    import { RuntimeContext } from "@mastra/core/runtime-context";

    // ベース設定
    const createSearchTool = (environment) => {
      return createVectorQueryTool({
        vectorStoreName: "pinecone",
        indexName: "documents",
        model: openai.embedding("text-embedding-3-small"),
        databaseConfig: {
          pinecone: {
            namespace: environment
          }
        }
      });
    };

    // 環境別ツールを作成
    const devSearchTool = createSearchTool('dev');
    const prodSearchTool = createSearchTool('prod');

    // もしくは実行時オーバーライドを使用
    const dynamicSearchTool = createVectorQueryTool({
      vectorStoreName: "pinecone",
      indexName: "documents",
      model: openai.embedding("text-embedding-3-small")
    });

    // 実行時に環境を切り替える
    const switchEnvironment = async (environment, query) => {
      const runtimeContext = new RuntimeContext();
      runtimeContext.set('databaseConfig', {
        pinecone: {
          namespace: environment
        }
      });

      return await dynamicSearchTool.execute({
        context: { queryText: query },
        mastra,
        runtimeContext
      });
    };
    ```
  </TabItem>
</Tabs>

## pgVector によるパフォーマンス最適化 \{#performance-optimization-with-pgvector\}

ユースケースに応じて検索パフォーマンスを最適化します。

<Tabs>
  <TabItem value="high-accuracy" label="高精度">
    ```typescript
    // 高精度構成 - 低速だがより正確
    const highAccuracyTool = createVectorQueryTool({
      vectorStoreName: "postgres",
      indexName: "embeddings",
      model: openai.embedding("text-embedding-3-small"),
      databaseConfig: {
        pgvector: {
          ef: 400,          // HNSW向けの高精度
          probes: 20,       // IVFFlat向けの高リコール
          minScore: 0.85    // 高品質なしきい値
        }
      }
    });

    // 精度最優先のクリティカルな検索に使用
    const criticalSearch = async (query: string) => {
      return await highAccuracyTool.execute({
        context: {
          queryText: query,
          topK: 5  // 件数は少なく、より高品質な結果
        },
        mastra
      });
    };
    ```
  </TabItem>

  <TabItem value="high-speed" label="高速">
    ```typescript
    // 高速構成 - 速いが精度はやや低い
    const highSpeedTool = createVectorQueryTool({
      vectorStoreName: "postgres", 
      indexName: "embeddings",
      model: openai.embedding("text-embedding-3-small"),
      databaseConfig: {
        pgvector: {
          ef: 50,           // スピード重視で精度は低め
          probes: 3,        // スピード重視でリコールは低め
          minScore: 0.6     // 品質のしきい値は低め
        }
      }
    });

    // リアルタイム用途で使用
    const realtimeSearch = async (query: string) => {
      return await highSpeedTool.execute({
        context: {
          queryText: query,
          topK: 10  // 精度低下を補うために件数を増やす
        },
        mastra
      });
    };
    ```
  </TabItem>

  <TabItem value="balanced" label="バランス">
    ```typescript
    // バランス構成 - ほどよい妥協点
    const balancedTool = createVectorQueryTool({
      vectorStoreName: "postgres",
      indexName: "embeddings", 
      model: openai.embedding("text-embedding-3-small"),
      databaseConfig: {
        pgvector: {
          ef: 150,          // 中程度の精度
          probes: 8,        // 中程度のリコール
          minScore: 0.7     // 中程度の品質しきい値
        }
      }
    });

    // 負荷に応じてパラメータを調整
    const adaptiveSearch = async (query: string, isHighLoad: boolean) => {
      const runtimeContext = new RuntimeContext();

      if (isHighLoad) {
        // 高負荷時は速度優先で品質を下げる
        runtimeContext.set('databaseConfig', {
          pgvector: {
            ef: 75,
            probes: 5,
            minScore: 0.65
          }
        });
      }

      return await balancedTool.execute({
        context: { queryText: query },
        mastra,
        runtimeContext
      });
    };
    ```
  </TabItem>
</Tabs>

## Pinecone を使ったマルチテナントアプリケーション \{#multi-tenant-application-with-pinecone\}

Pinecone のネームスペースを用いてテナント分離を実装します:

```typescript
interface Tenant {
  id: string;
  name: string;
  namespace: string;
}

class MultiTenantSearchService {
  private searchTool: RagTool;

  constructor() {
    this.searchTool = createVectorQueryTool({
      vectorStoreName: 'pinecone',
      indexName: 'shared-documents',
      model: openai.embedding('text-embedding-3-small'),
    });
  }

  async searchForTenant(tenant: Tenant, query: string) {
    const runtimeContext = new RuntimeContext();

    // 検索対象をテナントのネームスペースに限定
    runtimeContext.set('databaseConfig', {
      pinecone: {
        namespace: tenant.namespace,
      },
    });

    const results = await this.searchTool.execute({
      context: {
        queryText: query,
        topK: 10,
      },
      mastra,
      runtimeContext,
    });

    // 結果にテナントのコンテキストを付加
    return {
      tenant: tenant.name,
      query,
      results: results.relevantContext,
      sources: results.sources,
    };
  }

  async bulkSearchForTenants(tenants: Tenant[], query: string) {
    const promises = tenants.map(tenant => this.searchForTenant(tenant, query));

    return await Promise.all(promises);
  }
}

// 使用例
const searchService = new MultiTenantSearchService();

const tenants = [
  { id: '1', name: 'Company A', namespace: 'company-a' },
  { id: '2', name: 'Company B', namespace: 'company-b' },
];

const results = await searchService.searchForTenant(tenants[0], '製品ドキュメント');
```

## Pinecone で実現するハイブリッド検索 \{#hybrid-search-with-pinecone\}

セマンティック検索とキーワード検索を組み合わせましょう:

```typescript
const hybridSearchTool = createVectorQueryTool({
  vectorStoreName: 'pinecone',
  indexName: 'documents',
  model: openai.embedding('text-embedding-3-small'),
  databaseConfig: {
    pinecone: {
      namespace: 'production',
      sparseVector: {
        // キーワード "API" のスパースベクトルの例
        indices: [1, 5, 10, 15],
        values: [0.8, 0.6, 0.4, 0.2],
      },
    },
  },
});

// キーワードのスパースベクトルを生成するヘルパー関数
const generateSparseVector = (keywords: string[]) => {
  // これは簡略化された例です。実際には
  // BM25などの適切なスパース符号化手法を使用してください
  const indices: number[] = [];
  const values: number[] = [];

  keywords.forEach((keyword, i) => {
    const hash = keyword.split('').reduce((a, b) => {
      a = (a << 5) - a + b.charCodeAt(0);
      return a & a;
    }, 0);

    indices.push(Math.abs(hash) % 1000);
    values.push(1.0 / (i + 1)); // 後続のキーワードの重みを減少
  });

  return { indices, values };
};

const hybridSearch = async (query: string, keywords: string[]) => {
  const runtimeContext = new RuntimeContext();

  if (keywords.length > 0) {
    const sparseVector = generateSparseVector(keywords);
    runtimeContext.set('databaseConfig', {
      pinecone: {
        namespace: 'production',
        sparseVector,
      },
    });
  }

  return await hybridSearchTool.execute({
    context: { queryText: query },
    mastra,
    runtimeContext,
  });
};

// 使用例
const results = await hybridSearch('REST APIの使い方', ['API', 'REST', 'ドキュメント']);
```

## 品質ゲート付き検索 \{#quality-gated-search\}

検索品質を段階的に向上させる：

```typescript
const createQualityGatedSearch = () => {
  const baseConfig = {
    vectorStoreName: 'postgres',
    indexName: 'embeddings',
    model: openai.embedding('text-embedding-3-small'),
  };

  return {
    // まずは高品質な検索を試す
    highQuality: createVectorQueryTool({
      ...baseConfig,
      databaseConfig: {
        pgvector: {
          minScore: 0.85,
          ef: 200,
          probes: 15,
        },
      },
    }),

    // 中品質へのフォールバック
    mediumQuality: createVectorQueryTool({
      ...baseConfig,
      databaseConfig: {
        pgvector: {
          minScore: 0.7,
          ef: 150,
          probes: 10,
        },
      },
    }),

    // 最終手段: 低品質
    lowQuality: createVectorQueryTool({
      ...baseConfig,
      databaseConfig: {
        pgvector: {
          minScore: 0.5,
          ef: 100,
          probes: 5,
        },
      },
    }),
  };
};

const progressiveSearch = async (query: string, minResults: number = 3) => {
  const tools = createQualityGatedSearch();

  // まずは高品質を試す
  let results = await tools.highQuality.execute({
    context: { queryText: query },
    mastra,
  });

  if (results.sources.length >= minResults) {
    return { quality: 'high', ...results };
  }

  // 中品質にフォールバック
  results = await tools.mediumQuality.execute({
    context: { queryText: query },
    mastra,
  });

  if (results.sources.length >= minResults) {
    return { quality: 'medium', ...results };
  }

  // 最終手段: 低品質
  results = await tools.lowQuality.execute({
    context: { queryText: query },
    mastra,
  });

  return { quality: 'low', ...results };
};

// 使い方
const results = await progressiveSearch('複雑な技術的なクエリ', 5);
console.log(`結果は ${results.sources.length} 件、品質は ${results.quality} です`)
```

## 重要なポイント \{#key-takeaways\}

1. **環境の分離**: 環境やテナントごとにデータを分けるために namespace を使用する
2. **パフォーマンス調整**: 精度と速度の要件に応じて ef/probes のパラメータを調整する
3. **品質管理**: 低品質なマッチを除外するために minScore を使用する
4. **実行時の柔軟性**: 文脈に応じて設定を動的にオーバーライドする
5. **段階的な品質**: 品質レベルに応じたフォールバック戦略を実装する

このアプローチにより、柔軟性とパフォーマンスを保ちながら、用途に合わせてベクトル検索を最適化できます。