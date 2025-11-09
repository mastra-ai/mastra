/**
 * Complete end-to-end example demonstrating Azure AI Search vector store capabilities
 * 
 * This example shows how to:
 * 1. Set up the Azure AI Search vector store
 * 2. Create and manage indexes
 * 3. Insert and update vectors with metadata
 * 4. Perform similarity searches with filters
 * 5. Handle errors and cleanup
 * 
 * To run this example:
 * 1. Set environment variables:
 *    - AZURE_SEARCH_ENDPOINT=https://your-service.search.windows.net
 *    - AZURE_SEARCH_API_KEY=your-api-key
 * 2. Install dependencies: pnpm install
 * 3. Run: node -r esbuild-register examples/complete-demo.ts
 */

import { AzureAISearchVector } from '../src/vector/index';
import type { AzureAISearchVectorFilter } from '../src/vector/filter';

// Check for required environment variables
if (!process.env.AZURE_SEARCH_ENDPOINT || !process.env.AZURE_SEARCH_API_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   AZURE_SEARCH_ENDPOINT=https://your-service.search.windows.net');
  console.error('   AZURE_SEARCH_API_KEY=your-api-key');
  process.exit(1);
}

// Initialize the Azure AI Search vector store
const azureVector = new AzureAISearchVector({
  id: 'demo-azure-search',
  endpoint: process.env.AZURE_SEARCH_ENDPOINT,
  credential: process.env.AZURE_SEARCH_API_KEY,
});

// Demo configuration
const DEMO_INDEX = 'mastra-demo-products';
const VECTOR_DIMENSION = 384; // Suitable for sentence transformers

// Sample product data with embeddings (using dummy vectors for demo)
interface Product {
  id?: string;
  name: string;
  category: string;
  brand: string;
  price: number;
  description: string;
  tags: string[];
  rating: number;
  inStock: boolean;
}

const sampleProducts: Product[] = [
  {
    name: 'iPhone 15 Pro Max',
    category: 'electronics',
    brand: 'Apple',
    price: 1199,
    description: 'Latest iPhone with advanced camera system and titanium design',
    tags: ['smartphone', 'premium', 'camera', '5G'],
    rating: 4.8,
    inStock: true,
  },
  {
    name: 'Galaxy S24 Ultra',
    category: 'electronics',
    brand: 'Samsung',
    price: 1299,
    description: 'Flagship Android phone with S Pen and AI features',
    tags: ['smartphone', 'android', 'stylus', 'AI'],
    rating: 4.7,
    inStock: true,
  },
  {
    name: 'MacBook Pro 16"',
    category: 'computers',
    brand: 'Apple',
    price: 2499,
    description: 'Professional laptop with M3 chip and stunning display',
    tags: ['laptop', 'professional', 'M3', 'development'],
    rating: 4.9,
    inStock: false,
  },
  {
    name: 'Dell XPS 13',
    category: 'computers',
    brand: 'Dell',
    price: 999,
    description: 'Ultrabook with premium build and excellent performance',
    tags: ['laptop', 'ultrabook', 'portable', 'business'],
    rating: 4.5,
    inStock: true,
  },
  {
    name: 'Sony WH-1000XM5',
    category: 'audio',
    brand: 'Sony',
    price: 399,
    description: 'Noise-canceling wireless headphones with exceptional sound',
    tags: ['headphones', 'wireless', 'noise-canceling', 'premium'],
    rating: 4.6,
    inStock: true,
  },
  {
    name: 'AirPods Pro',
    category: 'audio',
    brand: 'Apple',
    price: 249,
    description: 'Wireless earbuds with active noise cancellation',
    tags: ['earbuds', 'wireless', 'noise-canceling', 'compact'],
    rating: 4.4,
    inStock: true,
  },
];

// Generate dummy vectors (in real usage, you'd use a proper embedding model)
function generateDummyEmbedding(product: Product): number[] {
  // Simple hash-based embedding generation for demo purposes
  const text = `${product.name} ${product.description} ${product.tags.join(' ')}`;
  const embedding: number[] = [];
  
  for (let i = 0; i < VECTOR_DIMENSION; i++) {
    // Generate pseudo-random values based on text content and position
    let hash = 0;
    const input = text + i.toString();
    for (let j = 0; j < input.length; j++) {
      hash = ((hash << 5) - hash + input.charCodeAt(j)) & 0xffffffff;
    }
    // Normalize to [-1, 1] range
    embedding[i] = (hash % 10000) / 5000 - 1;
  }
  
  // Normalize vector
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / magnitude);
}

async function runCompleteDemo() {
  console.log('🚀 Azure AI Search Vector Store Demo');
  console.log('=====================================\n');

  try {
    // Step 1: Create Index
    console.log('📁 Step 1: Creating vector index...');
    await azureVector.createIndex({
      indexName: DEMO_INDEX,
      dimension: VECTOR_DIMENSION,
      metric: 'cosine',
    });
    console.log('✅ Index created successfully\n');

    // Step 2: List and describe indexes
    console.log('📋 Step 2: Checking index information...');
    const indexes = await azureVector.listIndexes();
    console.log(`Found ${indexes.length} indexes:`, indexes.slice(0, 5)); // Show first 5
    
    const indexStats = await azureVector.describeIndex({ indexName: DEMO_INDEX });
    console.log('Index stats:', indexStats);
    console.log('');

    // Step 3: Generate embeddings and upsert products
    console.log('📦 Step 3: Adding products with embeddings...');
    const vectors: number[][] = [];
    const metadata: any[] = [];
    
    for (const product of sampleProducts) {
      const embedding = generateDummyEmbedding(product);
      vectors.push(embedding);
      metadata.push({
        name: product.name,
        category: product.category,
        brand: product.brand,
        price: product.price,
        description: product.description,
        tags: product.tags.join(','), // Store as comma-separated string
        rating: product.rating,
        inStock: product.inStock,
        content: `${product.name} - ${product.description}`,
      });
    }
    
    const productIds = await azureVector.upsert({
      indexName: DEMO_INDEX,
      vectors,
      metadata,
    });
    
    console.log(`✅ Added ${productIds.length} products`);
    console.log('Product IDs:', productIds.slice(0, 3), '...');
    console.log('');

    // Wait for Azure AI Search to index the documents
    console.log('⏳ Waiting for indexing to complete...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 4: Similarity search
    console.log('🔍 Step 4: Performing similarity search...');
    
    // Search for products similar to iPhone (using iPhone's embedding)
    const iphoneEmbedding = generateDummyEmbedding(sampleProducts[0]);
    const similarProducts = await azureVector.query({
      indexName: DEMO_INDEX,
      queryVector: iphoneEmbedding,
      topK: 3,
      includeVector: false,
    });
    
    console.log('Products similar to iPhone:');
    similarProducts.forEach((result, index) => {
      console.log(`${index + 1}. ${result.metadata?.name} (${result.metadata?.brand})`);
      console.log(`   Score: ${result.score?.toFixed(4)}, Price: $${result.metadata?.price}`);
    });
    console.log('');

    // Step 5: Filtered search
    console.log('🎯 Step 5: Performing filtered searches...');
    
    // Search for electronics under $1000
    const affordableElectronicsFilter: AzureAISearchVectorFilter = {
      and: [
        { eq: { category: 'electronics' } },
        { lt: { price: 1000 } }
      ]
    };
    
    const affordableElectronics = await azureVector.query({
      indexName: DEMO_INDEX,
      queryVector: iphoneEmbedding,
      topK: 5,
      filter: affordableElectronicsFilter,
    });
    
    console.log('Affordable electronics (< $1000):');
    affordableElectronics.forEach((result, index) => {
      console.log(`${index + 1}. ${result.metadata?.name} - $${result.metadata?.price}`);
    });
    console.log('');

    // Search for Apple products with high rating
    const premiumAppleFilter: AzureAISearchVectorFilter = {
      and: [
        { eq: { brand: 'Apple' } },
        { ge: { rating: 4.5 } },
        { eq: { inStock: true } }
      ]
    };
    
    const premiumApple = await azureVector.query({
      indexName: DEMO_INDEX,
      queryVector: iphoneEmbedding,
      topK: 5,
      filter: premiumAppleFilter,
    });
    
    console.log('Premium Apple products in stock (rating ≥ 4.5):');
    premiumApple.forEach((result, index) => {
      console.log(`${index + 1}. ${result.metadata?.name} - Rating: ${result.metadata?.rating}`);
    });
    console.log('');

    // Step 6: String search with filters
    console.log('📝 Step 6: Text-based filtering...');
    
    const wirelessFilter: AzureAISearchVectorFilter = {
      contains: { tags: 'wireless' }
    };
    
    const wirelessProducts = await azureVector.query({
      indexName: DEMO_INDEX,
      queryVector: iphoneEmbedding,
      topK: 10,
      filter: wirelessFilter,
    });
    
    console.log('Wireless products:');
    wirelessProducts.forEach((result, index) => {
      console.log(`${index + 1}. ${result.metadata?.name} (${result.metadata?.category})`);
    });
    console.log('');

    // Step 7: Update a product
    console.log('✏️ Step 7: Updating product information...');
    
    // Update the first product (iPhone) with new price and metadata
    const iphoneId = productIds[0];
    const updatedIphoneEmbedding = generateDummyEmbedding({
      ...sampleProducts[0],
      price: 999, // Sale price
      description: 'iPhone 15 Pro Max - NOW ON SALE with titanium design',
    });
    
    await azureVector.updateVector({
      indexName: DEMO_INDEX,
      id: iphoneId,
      update: {
        vector: updatedIphoneEmbedding,
        metadata: {
          ...metadata[0],
          price: 999,
          description: 'iPhone 15 Pro Max - NOW ON SALE with titanium design',
          content: 'iPhone 15 Pro Max - iPhone 15 Pro Max - NOW ON SALE with titanium design',
          onSale: true,
        },
      },
    });
    
    console.log('✅ Updated iPhone with sale price');
    
    // Wait for update to propagate
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verify update
    const updatedProducts = await azureVector.query({
      indexName: DEMO_INDEX,
      queryVector: updatedIphoneEmbedding,
      topK: 1,
    });
    
    console.log('Updated product:');
    console.log(`${updatedProducts[0].metadata?.name} - $${updatedProducts[0].metadata?.price}`);
    console.log(`On sale: ${updatedProducts[0].metadata?.onSale}`);
    console.log('');

    // Step 8: Complex query scenarios
    console.log('🎭 Step 8: Complex query scenarios...');
    
    // Multi-criteria search: Electronics OR Audio, in stock, under $500
    const complexFilter: AzureAISearchVectorFilter = {
      and: [
        {
          or: [
            { eq: { category: 'electronics' } },
            { eq: { category: 'audio' } }
          ]
        },
        { eq: { inStock: true } },
        { lt: { price: 500 } }
      ]
    };
    
    const complexResults = await azureVector.query({
      indexName: DEMO_INDEX,
      queryVector: iphoneEmbedding,
      topK: 10,
      filter: complexFilter,
    });
    
    console.log('Electronics or Audio, in stock, under $500:');
    complexResults.forEach((result, index) => {
      console.log(`${index + 1}. ${result.metadata?.name} - $${result.metadata?.price} (${result.metadata?.category})`);
    });
    console.log('');

    // Step 9: Performance demonstration
    console.log('⚡ Step 9: Performance demonstration...');
    
    const startTime = Date.now();
    
    // Perform multiple concurrent queries
    const concurrentQueries = Array.from({ length: 10 }, (_, i) =>
      azureVector.query({
        indexName: DEMO_INDEX,
        queryVector: generateDummyEmbedding({
          name: `Query ${i}`,
          category: 'test',
          brand: 'test',
          price: 100,
          description: `Test query ${i}`,
          tags: ['test'],
          rating: 4.0,
          inStock: true,
        }),
        topK: 5,
      })
    );
    
    const results = await Promise.all(concurrentQueries);
    const endTime = Date.now();
    
    console.log(`✅ Executed 10 concurrent queries in ${endTime - startTime}ms`);
    console.log(`Average results per query: ${results.reduce((sum, r) => sum + r.length, 0) / results.length}`);
    console.log('');

    // Step 10: Cleanup demonstration
    console.log('🗑️ Step 10: Cleanup operations...');
    
    // Delete one product
    const productToDelete = productIds[productIds.length - 1];
    await azureVector.deleteVector({
      indexName: DEMO_INDEX,
      id: productToDelete,
    });
    
    console.log(`✅ Deleted product: ${productToDelete}`);
    
    // Wait for deletion to propagate
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verify deletion - check total count
    const finalStats = await azureVector.describeIndex({ indexName: DEMO_INDEX });
    console.log(`Final product count: ${finalStats.count}`);
    console.log('');

    console.log('🎉 Demo completed successfully!');
    console.log('');
    console.log('📋 Summary of demonstrated features:');
    console.log('   ✅ Index creation and management');
    console.log('   ✅ Vector upsert with metadata');
    console.log('   ✅ Similarity search');
    console.log('   ✅ Filtered queries (equality, comparison, text)');
    console.log('   ✅ Complex logical filters (AND, OR)');
    console.log('   ✅ Vector and metadata updates');
    console.log('   ✅ Vector deletion');
    console.log('   ✅ Concurrent query performance');
    console.log('   ✅ Error handling and cleanup');

  } catch (error) {
    console.error('❌ Demo failed with error:', error);
    throw error;
  } finally {
    // Cleanup: Delete the demo index
    try {
      console.log('🧹 Cleaning up demo index...');
      await azureVector.deleteIndex({ indexName: DEMO_INDEX });
      console.log('✅ Demo index deleted');
    } catch (cleanupError) {
      console.warn('⚠️ Cleanup warning:', cleanupError);
    }
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  runCompleteDemo()
    .then(() => {
      console.log('\n✨ Demo completed successfully! ✨');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Demo failed:', error);
      process.exit(1);
    });
}

// Export for use in other files
export { runCompleteDemo, azureVector, DEMO_INDEX, VECTOR_DIMENSION };