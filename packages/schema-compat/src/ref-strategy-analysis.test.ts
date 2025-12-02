import { describe, test, expect } from 'vitest';
import { z } from 'zod';
import { zodToJsonSchema } from './zod-to-json';

type Extension = {
  url: string;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  valueDecimal?: number;
  valueDateTime?: string;
  valueCode?: string;
  valueCoding?: Coding;
  valueQuantity?: Quantity;
  valueReference?: Reference;
  extension?: Extension[]; // Deep recursion like FHIR
};

type Coding = {
  system?: string;
  version?: string;
  code?: string;
  display?: string;
  userSelected?: boolean;
  extension?: Extension[];
};

type Quantity = {
  value?: number;
  comparator?: string;
  unit?: string;
  system?: string;
  code?: string;
  extension?: Extension[];
};

type Reference = {
  reference?: string;
  type?: string;
  identifier?: Identifier;
  display?: string;
  extension?: Extension[];
};

type Identifier = {
  use?: string;
  type?: CodeableConcept;
  system?: string;
  value?: string;
  period?: Period;
  assigner?: Reference; // Circular reference!
  extension?: Extension[];
};

type CodeableConcept = {
  coding?: Coding[];
  text?: string;
  extension?: Extension[];
};

type Period = {
  start?: string;
  end?: string;
  extension?: Extension[];
};

type Meta = {
  versionId?: string;
  lastUpdated?: string;
  source?: string;
  profile?: string[];
  security?: Coding[];
  tag?: Coding[];
  extension?: Extension[];
};

type Resource = {
  resourceType: string;
  id?: string;
  meta?: Meta;
  implicitRules?: string;
  language?: string;
  text?: Narrative;
  contained?: Resource[]; // Self-reference!
  extension?: Extension[];
  modifierExtension?: Extension[];
};

type Narrative = {
  status: string;
  div: string;
  extension?: Extension[];
};

type BundleLink = {
  relation: string;
  url: string;
  extension?: Extension[];
};

type BundleEntry = {
  id?: string;
  extension?: Extension[];
  modifierExtension?: Extension[];
  link?: BundleLink[];
  fullUrl?: string;
  resource?: Resource;
  search?: BundleEntrySearch;
  request?: BundleEntryRequest;
  response?: BundleEntryResponse;
};

type BundleEntrySearch = {
  mode?: string;
  score?: number;
  extension?: Extension[];
};

type BundleEntryRequest = {
  method: string;
  url: string;
  ifNoneMatch?: string;
  ifModifiedSince?: string;
  ifMatch?: string;
  ifNoneExist?: string;
  extension?: Extension[];
};

type BundleEntryResponse = {
  status: string;
  location?: string;
  etag?: string;
  lastModified?: string;
  outcome?: Resource;
  extension?: Extension[];
};

type Bundle = {
  resourceType: 'Bundle';
  id?: string;
  meta?: Meta;
  implicitRules?: string;
  language?: string;
  identifier?: Identifier;
  type: string;
  timestamp?: string;
  total?: number;
  link?: BundleLink[];
  entry?: BundleEntry[];
  signature?: Signature;
  extension?: Extension[];
  modifierExtension?: Extension[];
};

type Signature = {
  type: Coding[];
  when: string;
  who: Reference;
  onBehalfOf?: Reference;
  targetFormat?: string;
  sigFormat?: string;
  data?: string;
  extension?: Extension[];
};

// Create the interconnected Zod schemas (like the user's 676 files)
const ExtensionSchema: z.ZodType<Extension> = z.lazy(() =>
  z.object({
    url: z.string(),
    valueString: z.string().optional(),
    valueBoolean: z.boolean().optional(),
    valueInteger: z.number().optional(),
    valueDecimal: z.number().optional(),
    valueDateTime: z.string().optional(),
    valueCode: z.string().optional(),
    valueCoding: CodingSchema.optional(),
    valueQuantity: QuantitySchema.optional(),
    valueReference: ReferenceSchema.optional(),
    extension: z.array(ExtensionSchema).optional(),
  }),
);

const CodingSchema: z.ZodType<Coding> = z.lazy(() =>
  z.object({
    system: z.string().optional(),
    version: z.string().optional(),
    code: z.string().optional(),
    display: z.string().optional(),
    userSelected: z.boolean().optional(),
    extension: z.array(ExtensionSchema).optional(),
  }),
);

const QuantitySchema: z.ZodType<Quantity> = z.lazy(() =>
  z.object({
    value: z.number().optional(),
    comparator: z.string().optional(),
    unit: z.string().optional(),
    system: z.string().optional(),
    code: z.string().optional(),
    extension: z.array(ExtensionSchema).optional(),
  }),
);

const ReferenceSchema: z.ZodType<Reference> = z.lazy(() =>
  z.object({
    reference: z.string().optional(),
    type: z.string().optional(),
    identifier: IdentifierSchema.optional(),
    display: z.string().optional(),
    extension: z.array(ExtensionSchema).optional(),
  }),
);

const CodeableConceptSchema: z.ZodType<CodeableConcept> = z.lazy(() =>
  z.object({
    coding: z.array(CodingSchema).optional(),
    text: z.string().optional(),
    extension: z.array(ExtensionSchema).optional(),
  }),
);

const PeriodSchema: z.ZodType<Period> = z.lazy(() =>
  z.object({
    start: z.string().optional(),
    end: z.string().optional(),
    extension: z.array(ExtensionSchema).optional(),
  }),
);

const IdentifierSchema: z.ZodType<Identifier> = z.lazy(() =>
  z.object({
    use: z.string().optional(),
    type: CodeableConceptSchema.optional(),
    system: z.string().optional(),
    value: z.string().optional(),
    period: PeriodSchema.optional(),
    assigner: ReferenceSchema.optional(), // Circular!
    extension: z.array(ExtensionSchema).optional(),
  }),
);

const MetaSchema: z.ZodType<Meta> = z.lazy(() =>
  z.object({
    versionId: z.string().optional(),
    lastUpdated: z.string().optional(),
    source: z.string().optional(),
    profile: z.array(z.string()).optional(),
    security: z.array(CodingSchema).optional(),
    tag: z.array(CodingSchema).optional(),
    extension: z.array(ExtensionSchema).optional(),
  }),
);

const NarrativeSchema: z.ZodType<Narrative> = z.lazy(() =>
  z.object({
    status: z.string(),
    div: z.string(),
    extension: z.array(ExtensionSchema).optional(),
  }),
);

const ResourceSchema: z.ZodType<Resource> = z.lazy(() =>
  z.object({
    resourceType: z.string(),
    id: z.string().optional(),
    meta: MetaSchema.optional(),
    implicitRules: z.string().optional(),
    language: z.string().optional(),
    text: NarrativeSchema.optional(),
    contained: z.array(ResourceSchema).optional(), // Self-reference!
    extension: z.array(ExtensionSchema).optional(),
    modifierExtension: z.array(ExtensionSchema).optional(),
  }),
);

const BundleLinkSchema: z.ZodType<BundleLink> = z.lazy(() =>
  z.object({
    relation: z.string(),
    url: z.string(),
    extension: z.array(ExtensionSchema).optional(),
  }),
);

const BundleEntrySearchSchema: z.ZodType<BundleEntrySearch> = z.lazy(() =>
  z.object({
    mode: z.string().optional(),
    score: z.number().optional(),
    extension: z.array(ExtensionSchema).optional(),
  }),
);

const BundleEntryRequestSchema: z.ZodType<BundleEntryRequest> = z.lazy(() =>
  z.object({
    method: z.string(),
    url: z.string(),
    ifNoneMatch: z.string().optional(),
    ifModifiedSince: z.string().optional(),
    ifMatch: z.string().optional(),
    ifNoneExist: z.string().optional(),
    extension: z.array(ExtensionSchema).optional(),
  }),
);

const BundleEntryResponseSchema: z.ZodType<BundleEntryResponse> = z.lazy(() =>
  z.object({
    status: z.string(),
    location: z.string().optional(),
    etag: z.string().optional(),
    lastModified: z.string().optional(),
    outcome: ResourceSchema.optional(),
    extension: z.array(ExtensionSchema).optional(),
  }),
);

const SignatureSchema: z.ZodType<Signature> = z.lazy(() =>
  z.object({
    type: z.array(CodingSchema),
    when: z.string(),
    who: ReferenceSchema,
    onBehalfOf: ReferenceSchema.optional(),
    targetFormat: z.string().optional(),
    sigFormat: z.string().optional(),
    data: z.string().optional(),
    extension: z.array(ExtensionSchema).optional(),
  }),
);

const BundleEntrySchema: z.ZodType<BundleEntry> = z.lazy(() =>
  z.object({
    id: z.string().optional(),
    extension: z.array(ExtensionSchema).optional(),
    modifierExtension: z.array(ExtensionSchema).optional(),
    link: z.array(BundleLinkSchema).optional(),
    fullUrl: z.string().optional(),
    resource: ResourceSchema.optional(),
    search: BundleEntrySearchSchema.optional(),
    request: BundleEntryRequestSchema.optional(),
    response: BundleEntryResponseSchema.optional(),
  }),
);

// This is the main schema that should reproduce the user's issue
const RealisticBundleSchema: z.ZodType<Bundle> = z.lazy(() =>
  z.object({
    resourceType: z.literal('Bundle'),
    id: z.string().optional(),
    meta: MetaSchema.optional(),
    implicitRules: z.string().optional(),
    language: z.string().optional(),
    identifier: IdentifierSchema.optional(),
    type: z.string(),
    timestamp: z.string().optional(),
    total: z.number().optional(),
    link: z.array(BundleLinkSchema).optional(),
    entry: z.array(BundleEntrySchema).optional(),
    signature: SignatureSchema.optional(),
    extension: z.array(ExtensionSchema).optional(),
    modifierExtension: z.array(ExtensionSchema).optional(),
  }),
);

// ============================================================================
// TESTING UTILITIES
// ============================================================================

function getMemoryUsage() {
  const used = process.memoryUsage();
  return {
    rss: Math.round((used.rss / 1024 / 1024) * 100) / 100, // MB
    heapTotal: Math.round((used.heapTotal / 1024 / 1024) * 100) / 100, // MB
    heapUsed: Math.round((used.heapUsed / 1024 / 1024) * 100) / 100, // MB
    external: Math.round((used.external / 1024 / 1024) * 100) / 100, // MB
  };
}

function testSchemaConversionWithTimeout(
  schema: z.ZodSchema,
  strategy: 'none' | 'seen' | 'root' | 'relative',
  timeoutMs: number = 30000, // 30 second timeout
) {
  return new Promise<any>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Test timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    const startTime = Date.now();
    const startMemory = getMemoryUsage();

    let warnings: string[] = [];
    const originalConsoleWarn = console.warn;
    console.warn = (...args) => {
      const message = args.join(' ');
      if (message.includes('Recursive reference detected') || message.includes('circular')) {
        warnings.push(message);
        // Stop collecting after 1000 warnings to prevent memory issues in test
        if (warnings.length >= 1000) {
          console.warn = originalConsoleWarn;
          clearTimeout(timeout);
          resolve({
            success: false,
            time: Date.now() - startTime,
            memory: process.memoryUsage().heapUsed - startMemory.heapUsed,
            warnings: warnings.length,
            size: 0,
            hasRefs: false,
            error: 'Too many warnings (>1000), stopped test to prevent memory issues',
          });
          return;
        }
      }
      originalConsoleWarn(...args);
    };

    try {
      // Use our updated zodToJsonSchema function that now accepts strategy parameter
      const result = zodToJsonSchema(schema, 'jsonSchema7', strategy);

      const endTime = Date.now();
      const endMemory = getMemoryUsage();

      clearTimeout(timeout);
      console.warn = originalConsoleWarn;

      const hasRefs = JSON.stringify(result).includes('$ref');
      const schemaStr = JSON.stringify(result);

      resolve({
        success: true,
        time: endTime - startTime,
        memory: endMemory.heapUsed - startMemory.heapUsed,
        warnings: warnings.length,
        size: schemaStr.length,
        hasRefs,
        result,
      });
    } catch (error) {
      clearTimeout(timeout);
      console.warn = originalConsoleWarn;

      resolve({
        success: false,
        time: Date.now() - startTime,
        memory: process.memoryUsage().heapUsed - startMemory.heapUsed,
        warnings: warnings.length,
        size: 0,
        hasRefs: false,
        error: error,
      });
    }
  });
}

// ============================================================================
// TESTS
// ============================================================================

describe('Recursive Schema Performance Analysis', () => {
  const TIME_LIMIT_MS = 30000; // 30 seconds

  test(
    'should reproduce user issue with current approach (refStrategy: none)',
    async () => {
      console.log('🧪 Testing current Mastra approach (refStrategy: none)...');

      const result = (await testSchemaConversionWithTimeout(RealisticBundleSchema, 'none', TIME_LIMIT_MS)) as any;

      console.log(`📊 Result: ${result.success ? '✅' : '❌'}`);
      console.log(`⏱️  Time: ${result.time}ms`);
      console.log(`📈 Memory: ${Math.round((result.memory / 1024 / 1024) * 100) / 100}MB`);
      console.log(`⚠️  Warnings: ${result.warnings}`);
      console.log(`📏 Size: ${result.size} chars`);

      if (result.error) {
        console.log(`❌ Error: ${result.error}`);
      }

      // This should reproduce the user's issue
      expect(result.warnings).toBeGreaterThan(0);
      expect(result.time).toBeLessThan(TIME_LIMIT_MS);
    },
    TIME_LIMIT_MS + 5000,
  );

  test(
    'should test refStrategy: seen',
    async () => {
      console.log('🧪 Testing refStrategy: seen...');

      const result = (await testSchemaConversionWithTimeout(RealisticBundleSchema, 'seen', TIME_LIMIT_MS)) as any;

      console.log(`📊 Result: ${result.success ? '✅' : '❌'}`);
      console.log(`⏱️  Time: ${result.time}ms`);
      console.log(`📈 Memory: ${Math.round((result.memory / 1024 / 1024) * 100) / 100}MB`);
      console.log(`⚠️  Warnings: ${result.warnings}`);
      console.log(`📏 Size: ${result.size} chars`);
      console.log(`🔗 Uses $ref: ${result.hasRefs}`);

      expect(result.success).toBe(true);
      expect(result.time).toBeLessThan(TIME_LIMIT_MS);
    },
    TIME_LIMIT_MS + 5000,
  );

  test(
    'should test refStrategy: root',
    async () => {
      console.log('🧪 Testing refStrategy: root...');

      const result = (await testSchemaConversionWithTimeout(RealisticBundleSchema, 'root', TIME_LIMIT_MS)) as any;

      console.log(`📊 Result: ${result.success ? '✅' : '❌'}`);
      console.log(`⏱️  Time: ${result.time}ms`);
      console.log(`📈 Memory: ${Math.round((result.memory / 1024 / 1024) * 100) / 100}MB`);
      console.log(`⚠️  Warnings: ${result.warnings}`);
      console.log(`📏 Size: ${result.size} chars`);
      console.log(`🔗 Uses $ref: ${result.hasRefs}`);

      expect(result.success).toBe(true);
      expect(result.time).toBeLessThan(TIME_LIMIT_MS);
      // This should eliminate warnings
      expect(result.warnings).toBe(0);
    },
    TIME_LIMIT_MS + 5000,
  );

  test(
    'should test refStrategy: relative',
    async () => {
      console.log('🧪 Testing refStrategy: relative...');

      const result = (await testSchemaConversionWithTimeout(RealisticBundleSchema, 'relative', TIME_LIMIT_MS)) as any;

      console.log(`📊 Result: ${result.success ? '✅' : '❌'}`);
      console.log(`⏱️  Time: ${result.time}ms`);
      console.log(`📈 Memory: ${Math.round((result.memory / 1024 / 1024) * 100) / 100}MB`);
      console.log(`⚠️  Warnings: ${result.warnings}`);
      console.log(`📏 Size: ${result.size} chars`);
      console.log(`🔗 Uses $ref: ${result.hasRefs}`);

      expect(result.success).toBe(true);
      expect(result.time).toBeLessThan(TIME_LIMIT_MS);
      // This should eliminate warnings
      expect(result.warnings).toBe(0);
    },
    TIME_LIMIT_MS + 5000,
  );

  test('should compare all strategies', async () => {
    console.log('🏆 FINAL COMPARISON:');

    const strategies: Array<'none' | 'seen' | 'root' | 'relative'> = ['none', 'seen', 'root', 'relative'];
    const results: Array<{
      strategy: 'none' | 'seen' | 'root' | 'relative';
      success: boolean;
      time: number;
      warnings: number;
      hasRefs: boolean;
      size: number;
    }> = [];

    for (const strategy of strategies) {
      const result = (await testSchemaConversionWithTimeout(
        RealisticBundleSchema,
        strategy,
        10000, // Shorter timeout for comparison
      )) as any;

      results.push({
        strategy,
        success: result.success,
        time: result.time,
        warnings: result.warnings,
        hasRefs: result.hasRefs,
        size: result.size,
      });
    }

    console.log('\n📊 SUMMARY:');
    results.forEach(r => {
      const status = r.success ? '✅' : '❌';
      const warnings = r.warnings > 0 ? `⚠️ ${r.warnings}` : '✅ 0';
      const refs = r.hasRefs ? '🔗' : '📄';
      console.log(`   ${status} ${r.strategy}: ${r.time}ms, ${warnings} warnings, ${refs} refs, ${r.size} chars`);
    });

    // Find strategies that eliminate warnings
    const noWarningStrategies = results.filter(r => r.success && r.warnings === 0);

    console.log('\n📊 STRATEGIES THAT ELIMINATE WARNINGS:');
    if (noWarningStrategies.length > 0) {
      noWarningStrategies.forEach(s => console.log(`   • ${s.strategy}`));
    } else {
      console.log('   • None');
    }

    // At least one strategy should eliminate warnings
    expect(noWarningStrategies.length).toBeGreaterThan(0);
  }, 60000); // 1 minute timeout for full comparison

  test('should examine schema structures and potential side effects', async () => {
    console.log('🔬 DETAILED SCHEMA STRUCTURE ANALYSIS');

    // Use a simpler schema for clearer comparison
    const SimpleTestSchema = z.object({
      id: z.string(),
      extension: z.array(ExtensionSchema).optional(),
    });

    const strategies: Array<{ name: string; strategy: 'root' | 'relative' }> = [
      { name: 'root', strategy: 'root' },
      { name: 'relative', strategy: 'relative' },
    ];

    for (const { name, strategy } of strategies) {
      console.log(`\n📋 ${name.toUpperCase()} Strategy Schema Structure:`);

      const result = zodToJsonSchema(SimpleTestSchema, 'jsonSchema7', strategy);
      const resultStr = JSON.stringify(result, null, 2);

      // Log key characteristics
      console.log(`   📏 Size: ${resultStr.length} characters`);
      console.log(`   🔗 Contains $ref: ${resultStr.includes('$ref')}`);
      console.log(`   📚 Contains $defs: ${resultStr.includes('$defs') || resultStr.includes('definitions')}`);

      // Show a snippet of the structure (first 300 chars)
      const snippet = resultStr.substring(0, 300);
      console.log(`   📝 Structure preview:\n${snippet}${resultStr.length > 300 ? '...' : ''}`);

      // Check for potential issues
      const issues: string[] = [];

      // Check for relative path complexity
      if (strategy === 'relative' && resultStr.includes('../')) {
        issues.push('Uses relative paths (../) which may be harder to debug');
      }

      // Check for deep nesting in $defs
      if (strategy === 'root' && (resultStr.includes('$defs') || resultStr.includes('definitions'))) {
        issues.push('Centralizes definitions which may be easier to understand');
      }

      // Check schema validation compatibility
      if (resultStr.includes('$ref')) {
        issues.push('Uses JSON Schema $ref which is widely supported');
      }

      if (issues.length > 0) {
        console.log(`   ⚠️  Considerations:`);
        issues.forEach(issue => console.log(`      • ${issue}`));
      } else {
        console.log(`   ✅ No obvious issues detected`);
      }
    }
  });

  test('should use default strategy and have no warnings', async () => {
    console.log('🔒 REGRESSION TEST: Default strategy should eliminate warnings');

    const warnings: string[] = [];
    const originalConsoleWarn = console.warn;
    console.warn = (message: string) => {
      warnings.push(message);
    };

    const startTime = Date.now();

    try {
      // Test the default behavior (no strategy parameter)
      const result = zodToJsonSchema(RealisticBundleSchema);
      const endTime = Date.now();
      const time = endTime - startTime;
      const hasRefs = JSON.stringify(result).includes('$ref');

      console.warn = originalConsoleWarn;

      console.log(`   Default strategy warnings: ${warnings.length}`);
      console.log(`   Default strategy time: ${time}ms`);
      console.log(`   Default strategy uses $ref: ${hasRefs}`);

      // These assertions will FAIL if someone changes the default back to 'none'
      expect(warnings.length).toBe(0); // Must eliminate all warnings
      expect(time).toBeLessThan(TIME_LIMIT_MS); // Must be performant
      expect(hasRefs).toBe(true); // Must use $ref (not inline everything)

      console.log('   ✅ Default behavior correctly eliminates recursive warnings');
    } catch (error) {
      console.warn = originalConsoleWarn;
      throw error;
    }
  });
});
