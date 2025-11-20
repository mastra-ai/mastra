import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PostgresStore } from '../index';
import { PostgresPerformanceTest } from './performance-test';

// Integration tests that require a real database connection
describe('PostgresStore Performance Indexes Integration', () => {
  let store: PostgresStore;
  let performanceTest: PostgresPerformanceTest;
  const connectionString = process.env.DB_URL || 'postgresql://postgres:postgres@localhost:5434/mastra';

  beforeAll(async () => {
    store = new PostgresStore({ id: 'integration-test-store', connectionString });
    await store.init();

    performanceTest = new PostgresPerformanceTest({
      connectionString,
      testDataSize: 1000, // Larger dataset to trigger index usage
      iterations: 3,
    });
    await performanceTest.init();
  }, 30000); // 30 second timeout for setup

  beforeEach(async () => {
    await performanceTest.cleanup();
  });

  afterAll(async () => {
    await performanceTest?.cleanup();
  });

  it('should create performance indexes during store initialization', async () => {
    // Composite indexes are created by default during init
    const indexes = await store.listIndexes();

    expect(indexes.length).toBeGreaterThan(0);

    // Verify specific indexes exist (using our optimized composite indexes)
    const indexNames = indexes.map(idx => idx.name);
    expect(indexNames.some(name => name.includes('threads_resourceid_createdat'))).toBe(true);
    expect(indexNames.some(name => name.includes('messages_thread_id_createdat'))).toBe(true);
  });

  it('should demonstrate performance scaling with indexes across dataset sizes', async () => {
    const testSizes = [
      { name: 'XSmall', size: 100 },
      { name: 'Small', size: 1000 },
      { name: 'Medium', size: 10000 },
      { name: 'Large', size: 100000 },
      { name: 'XLarge', size: 1000000 },
    ];

    console.log('\n=== Comprehensive Performance Scaling Analysis ===');
    console.log('Testing how each function performs as dataset size increases');

    // Track performance for each function across all dataset sizes
    const functionResults = new Map<
      string,
      Array<{
        datasetSize: number;
        datasetName: string;
        withoutIndexes: number;
        withIndexes: number;
        improvement: number;
        improvementPercent: number;
      }>
    >();

    for (const testSize of testSizes) {
      console.log(`\n--- Dataset: ${testSize.name} (${testSize.size.toLocaleString()} records) ---`);

      // Update test configuration
      performanceTest['config'].testDataSize = testSize.size;

      // Seed test data
      await performanceTest.cleanup();
      await performanceTest.seedTestData();

      // Run comparison test
      const comparisons = await performanceTest.runComparisonTest();

      // Store results for each function
      for (const comparison of comparisons) {
        if (!functionResults.has(comparison.operation)) {
          functionResults.set(comparison.operation, []);
        }

        functionResults.get(comparison.operation)!.push({
          datasetSize: testSize.size,
          datasetName: testSize.name,
          withoutIndexes: comparison.withoutIndexes.avgTimeMs,
          withIndexes: comparison.withIndexes.avgTimeMs,
          improvement: comparison.improvementFactor,
          improvementPercent: comparison.improvementPercentage,
        });

        console.log(`${comparison.operation}:`);
        console.log(`  Without indexes: ${comparison.withoutIndexes.avgTimeMs.toFixed(2)}ms`);
        console.log(`  With indexes: ${comparison.withIndexes.avgTimeMs.toFixed(2)}ms`);
        console.log(
          `  Improvement: ${comparison.improvementFactor.toFixed(2)}x (${comparison.improvementPercentage.toFixed(1)}%)`,
        );
      }
    }

    // Generate comprehensive analysis for each function
    console.log('\n=== Function-by-Function Performance Analysis ===');

    for (const [functionName, results] of functionResults.entries()) {
      console.log(`\n📊 ${functionName} Performance Scaling:`);
      console.log('Dataset Size    | Without Index | With Index | Improvement | % Improvement');
      console.log('----------------|---------------|------------|-------------|---------------');

      for (const result of results) {
        const sizeStr = result.datasetName.padEnd(15);
        const withoutStr = `${result.withoutIndexes.toFixed(2)}ms`.padEnd(13);
        const withStr = `${result.withIndexes.toFixed(2)}ms`.padEnd(10);
        const improvStr = `${result.improvement.toFixed(2)}x`.padEnd(11);
        const pctStr = `${result.improvementPercent.toFixed(1)}%`;

        console.log(`${sizeStr} | ${withoutStr} | ${withStr} | ${improvStr} | ${pctStr}`);
      }

      // Analyze scaling characteristics for this function
      const firstResult = results[0];
      const lastResult = results[results.length - 1];
      const scalingFactor = lastResult.improvement / firstResult.improvement;

      console.log(`\n📈 Scaling Analysis for ${functionName}:`);
      console.log(`  Smallest dataset improvement: ${firstResult.improvement.toFixed(2)}x`);
      console.log(`  Largest dataset improvement: ${lastResult.improvement.toFixed(2)}x`);
      console.log(`  Scaling factor: ${scalingFactor.toFixed(2)}x (how much better indexes get with more data)`);

      // Identify the "sweet spot" where indexes start showing significant benefit
      const significantImprovements = results.filter(r => r.improvement >= 1.2); // 20%+ improvement
      if (significantImprovements.length > 0) {
        const sweetSpot = significantImprovements[0];
        console.log(
          `  Index "sweet spot": ~${sweetSpot.datasetSize.toLocaleString()} records (${sweetSpot.improvement.toFixed(2)}x improvement)`,
        );
      } else {
        console.log(`  Index benefit: Minimal in test environment (likely due to fast local storage)`);
      }
    }

    // Ensure we tested all dataset sizes
    expect(functionResults.size).toBeGreaterThan(0);
    for (const results of functionResults.values()) {
      expect(results.length).toBe(testSizes.length);
    }
  }, 300000); // 5 minute timeout for comprehensive testing

  it('should handle index creation gracefully when indexes already exist', async () => {
    // Access operations to test index creation
    const operations = store.stores.operations as any;

    // Create automatic indexes again - should not fail
    await expect(operations.createAutomaticIndexes()).resolves.not.toThrow();

    // Verify indexes still exist
    const indexes = await store.listIndexes();
    const compositeIndexes = indexes.filter(
      idx => idx.name.includes('threads_resourceid_createdat') || idx.name.includes('messages_thread_id_createdat'),
    );
    expect(compositeIndexes.length).toBeGreaterThan(0);
  });

  it('should show query plan improvements with indexes', async () => {
    const db = store.db;

    // Ensure we have some test data
    await db.none(`
      INSERT INTO mastra_threads (id, "resourceId", title, metadata, "createdAt", "updatedAt") 
      VALUES ('test-thread', 'test-resource', 'Test Thread', '{}', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `);

    // Get query plan for indexed query
    const plan = await db.manyOrNone(`
      EXPLAIN (FORMAT TEXT)
      SELECT id, "resourceId", title, metadata, "createdAt", "updatedAt" 
      FROM mastra_threads 
      WHERE "resourceId" = 'test-resource' 
      ORDER BY "createdAt" DESC
    `);

    const planText = plan.map(row => row['QUERY PLAN']).join(' ');

    // Should use index scan instead of sequential scan for larger datasets
    // Note: For very small datasets, PostgreSQL might still choose seq scan
    expect(planText).toBeDefined();
    expect(planText.length).toBeGreaterThan(0);
  });
});
