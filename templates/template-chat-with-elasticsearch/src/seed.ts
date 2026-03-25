import 'dotenv/config';
import { esClient } from './mastra/lib/elasticsearch-client';

const INDEX_NAME = 'articles';

const articles = [
  {
    title: 'Getting Started with Elasticsearch',
    content: `Elasticsearch is a distributed, RESTful search and analytics engine capable of addressing a growing number of use cases. As the heart of the Elastic Stack, it centrally stores your data for lightning fast search, fine‑tuned relevancy, and powerful analytics that scale with ease.

This guide will walk you through the basics of setting up Elasticsearch, creating your first index, and running your first queries. We'll cover the fundamental concepts like documents, indices, and mappings.

Elasticsearch uses an inverted index structure that allows for very fast full-text searches. When you index a document, Elasticsearch breaks down the text fields into individual terms and creates a mapping of which documents contain each term.`,
    author: 'Sarah Chen',
    category: 'Technology',
    tags: ['elasticsearch', 'search', 'tutorial', 'beginner'],
    published_date: '2024-01-15',
    views: 15420,
  },
  {
    title: 'Understanding Vector Search and Embeddings',
    content: `Vector search represents a paradigm shift in how we approach information retrieval. Unlike traditional keyword-based search, vector search uses machine learning models to convert text into dense numerical representations called embeddings.

These embeddings capture semantic meaning, allowing searches to find conceptually similar content even when exact keywords don't match. For example, a search for "automobile" can find documents about "cars" and "vehicles" because their embeddings are close in vector space.

Elasticsearch supports dense vector fields and k-nearest neighbor (kNN) search, making it possible to build powerful semantic search applications. Combined with traditional BM25 scoring, you can create hybrid search systems that leverage both keyword matching and semantic understanding.`,
    author: 'Michael Rodriguez',
    category: 'Technology',
    tags: ['vectors', 'embeddings', 'machine-learning', 'semantic-search'],
    published_date: '2024-02-20',
    views: 8930,
  },
  {
    title: 'Building Production-Ready Search Applications',
    content: `Moving from a prototype to a production search system requires careful consideration of several factors: performance, relevance, reliability, and maintainability.

Performance optimization starts with proper index design. Consider your query patterns and design your mappings accordingly. Use appropriate field types - keyword fields for exact matching and filtering, text fields for full-text search. Implement pagination using search_after for deep pagination scenarios.

Relevance tuning is an ongoing process. Start with Elasticsearch's default BM25 scoring, then iterate based on user feedback. Consider using function_score queries to boost documents based on business logic like recency or popularity.

For reliability, implement proper error handling, circuit breakers, and fallback mechanisms. Monitor your cluster health and set up alerts for key metrics like search latency and indexing throughput.`,
    author: 'Emily Watson',
    category: 'Engineering',
    tags: ['production', 'best-practices', 'performance', 'elasticsearch'],
    published_date: '2024-03-10',
    views: 12150,
  },
  {
    title: 'Introduction to ES|QL: The New Query Language',
    content: `ES|QL (Elasticsearch Query Language) is a new piped query language designed to make data exploration and analysis more intuitive. Unlike the JSON-based Query DSL, ES|QL uses a familiar pipe syntax similar to SQL and SPL.

With ES|QL, you can filter, aggregate, and transform data using a series of commands connected by pipes. For example: FROM logs | WHERE status == "error" | STATS count = COUNT(*) BY service | SORT count DESC

Key features include native support for time-series data, built-in statistical functions, and the ability to chain multiple operations in a single query. ES|QL queries are also optimized by Elasticsearch's query planner for efficient execution.

The language continues to evolve with new features like FORK and FUSE for hybrid search, making it increasingly powerful for complex search and analytics use cases.`,
    author: 'David Kim',
    category: 'Technology',
    tags: ['esql', 'query-language', 'analytics', 'elasticsearch'],
    published_date: '2024-04-05',
    views: 6540,
  },
  {
    title: 'Securing Your Elasticsearch Cluster',
    content: `Security should be a top priority when deploying Elasticsearch in any environment. A properly secured cluster protects sensitive data and prevents unauthorized access.

Start with the basics: enable TLS for all communications, both between nodes (transport layer) and for client connections (HTTP layer). Use strong authentication - Elasticsearch supports native realm, LDAP, Active Directory, SAML, and OIDC.

Implement role-based access control (RBAC) to limit what users can see and do. Create roles with specific index privileges and field-level security to ensure users only access data they're authorized to see. Document-level security adds another layer by filtering documents based on user attributes.

Audit logging helps you track who accessed what and when. Enable audit logs to maintain compliance and investigate security incidents. Regular security reviews and penetration testing help identify vulnerabilities before attackers do.`,
    author: 'James Thompson',
    category: 'Security',
    tags: ['security', 'authentication', 'rbac', 'tls', 'elasticsearch'],
    published_date: '2024-04-22',
    views: 9870,
  },
  {
    title: 'Optimizing Elasticsearch for Log Analytics',
    content: `Log analytics is one of the most common use cases for Elasticsearch. With proper optimization, Elasticsearch can handle millions of log events per second while providing fast search and aggregation capabilities.

Index lifecycle management (ILM) is essential for log data. Configure policies to automatically roll over indices based on size or age, move older data to cheaper storage tiers, and delete data past its retention period. This keeps your cluster performant and cost-effective.

For high-volume ingestion, use bulk indexing and tune your refresh interval. A longer refresh interval (e.g., 30 seconds instead of 1 second) reduces indexing overhead at the cost of slightly delayed search visibility.

Design your mappings with log analysis in mind. Use keyword fields for log levels, service names, and other categorical data you'll filter on. Consider using runtime fields for infrequently accessed computed values to save storage space.`,
    author: 'Lisa Park',
    category: 'Operations',
    tags: ['logging', 'observability', 'ilm', 'performance', 'elasticsearch'],
    published_date: '2024-05-18',
    views: 11200,
  },
  {
    title: 'Machine Learning Anomaly Detection with Elasticsearch',
    content: `Elasticsearch's machine learning capabilities enable automatic detection of anomalies in your data without requiring extensive data science expertise. The unsupervised algorithms learn normal patterns and alert you when deviations occur.

Anomaly detection jobs analyze time-series data to find unusual patterns. You define the data to analyze, the time buckets, and what constitutes an anomaly. Elasticsearch handles the rest - building models, scoring data, and generating alerts.

Common use cases include detecting unusual traffic patterns in web logs, identifying fraudulent transactions in payment data, and spotting infrastructure issues before they cause outages. Multi-metric jobs can correlate anomalies across multiple measurements for more accurate detection.

Integration with alerting allows you to automatically notify teams when anomalies are detected. Combine with Kibana's ML features for visualization and investigation of detected anomalies.`,
    author: 'Robert Martinez',
    category: 'Data Science',
    tags: ['machine-learning', 'anomaly-detection', 'observability', 'elasticsearch'],
    published_date: '2024-06-03',
    views: 7650,
  },
  {
    title: 'Migrating from Solr to Elasticsearch',
    content: `Many organizations are migrating from Apache Solr to Elasticsearch to take advantage of its modern architecture, richer ecosystem, and better operational tooling. While both are built on Lucene, there are important differences to consider.

Schema design differs between the two. Solr's schema.xml becomes Elasticsearch mappings. Dynamic fields in Solr translate to dynamic templates in Elasticsearch. Take time to review and optimize your mappings during migration rather than doing a 1:1 translation.

Query syntax translation requires attention. Solr's query parsers (edismax, standard) map to Elasticsearch's query types, but the syntax is different. The bool query in Elasticsearch provides similar functionality to Solr's boolean operators.

Plan for a parallel running period where both systems serve traffic. This allows you to validate search relevance and performance before fully cutting over. Tools like Rally can help benchmark Elasticsearch performance against your expected workload.`,
    author: 'Amanda Foster',
    category: 'Engineering',
    tags: ['migration', 'solr', 'elasticsearch', 'search'],
    published_date: '2024-06-25',
    views: 5430,
  },
  {
    title: 'Real-time Analytics with Elasticsearch Aggregations',
    content: `Elasticsearch aggregations provide powerful real-time analytics capabilities. From simple metrics like averages and sums to complex multi-level aggregations, you can analyze your data in countless ways.

Bucket aggregations group documents into buckets based on field values, ranges, or other criteria. Terms aggregations show top values, histogram aggregations create distribution charts, and date_histogram is perfect for time-series analysis.

Metric aggregations compute statistics over sets of documents - min, max, avg, sum, percentiles, and more. Combine them with bucket aggregations to compute metrics per group.

Pipeline aggregations operate on the output of other aggregations. Calculate moving averages, derivatives, or cumulative sums to identify trends. The bucket_script aggregation lets you perform custom calculations across sibling buckets.

For large datasets, use sampling or composite aggregations to maintain performance. The composite aggregation is particularly useful for paginating through all buckets in an aggregation.`,
    author: 'Kevin O\'Brien',
    category: 'Analytics',
    tags: ['aggregations', 'analytics', 'real-time', 'elasticsearch'],
    published_date: '2024-07-12',
    views: 8920,
  },
  {
    title: 'Elasticsearch Index Design Patterns',
    content: `Good index design is fundamental to Elasticsearch performance and functionality. The decisions you make about how to structure your indices impact query speed, storage efficiency, and operational complexity.

The time-based index pattern works well for log and event data. Create indices per time period (daily, weekly, monthly) and use index aliases for querying. This makes data retention simple - just delete old indices.

For entity-centric data like products or users, consider your access patterns. If you always query by a specific field (like tenant_id), that field should probably be in your index name or used for routing to ensure related documents are co-located.

Mapping design matters. Use appropriate field types - keyword for exact matching and aggregations, text for full-text search. Don't index fields you won't search on. Use doc_values: false for text fields you only search (not sort or aggregate) to save disk space.

Consider denormalization. Unlike relational databases, Elasticsearch works best with denormalized data. Duplicating data across documents often performs better than using joins or nested objects.`,
    author: 'Jennifer Walsh',
    category: 'Engineering',
    tags: ['index-design', 'mappings', 'patterns', 'elasticsearch'],
    published_date: '2024-08-01',
    views: 10340,
  },
];

/**
 * Seeds the Elasticsearch cluster with sample articles about Elasticsearch topics.
 * Creates the 'articles' index and indexes 10 sample documents.
 */
async function seed() {
  console.log('Connecting to Elasticsearch...');

  const indexExists = await esClient.indices.exists({ index: INDEX_NAME });

  if (indexExists) {
    console.log(`Index "${INDEX_NAME}" already exists. Deleting...`);
    await esClient.indices.delete({ index: INDEX_NAME });
  }

  console.log(`Creating index "${INDEX_NAME}"...`);
  await esClient.indices.create({
    index: INDEX_NAME,
    mappings: {
      properties: {
        title: {
          type: 'text',
          analyzer: 'english',
          fields: {
            keyword: { type: 'keyword' },
          },
        },
        content: {
          type: 'text',
          analyzer: 'english',
        },
        author: {
          type: 'keyword',
        },
        category: {
          type: 'keyword',
        },
        tags: {
          type: 'keyword',
        },
        published_date: {
          type: 'date',
        },
        views: {
          type: 'integer',
        },
      },
    },
  });

  console.log('Indexing articles...');
  const operations = articles.flatMap((doc) => [{ index: { _index: INDEX_NAME } }, doc]);

  const bulkResponse = await esClient.bulk({ refresh: true, operations });

  if (bulkResponse.errors) {
    const erroredDocuments: Array<{ status: number; error: unknown; document: unknown }> = [];
    bulkResponse.items.forEach((action, i) => {
      const operation = Object.values(action)[0];
      if (operation?.error) {
        erroredDocuments.push({
          status: operation.status,
          error: operation.error,
          document: articles[i],
        });
      }
    });
    console.error('Failed to index some documents:', erroredDocuments);
  }

  const count = await esClient.count({ index: INDEX_NAME });
  console.log(`\nSeeding complete!`);
  console.log(`Index: ${INDEX_NAME}`);
  console.log(`Documents indexed: ${count.count}`);
  console.log(`\nSample queries to try:`);
  console.log(`- "What articles discuss Elasticsearch security?"`);
  console.log(`- "Find tutorials for beginners"`);
  console.log(`- "Articles about machine learning and anomaly detection"`);
  console.log(`- "What did Sarah Chen write about?"`);
}

seed().catch((err) => {
  console.error('Failed to seed Elasticsearch:', err);
  process.exit(1);
});
