import { openai } from '@ai-sdk/openai-v5';
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { createOpenRouter } from '@openrouter/ai-sdk-provider-v5';
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { Agent } from '../../agent';
import 'dotenv/config';

/**
 * Comprehensive test suite for structured output feature
 *
 * Tests both processor-based (with model) and native (without model) approaches
 * across multiple providers and complex schema types.
 *
 * Follows the same pattern as tool-builder/builder.test.ts for consistency
 */

// Initialize providers
const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

// Test configuration
const TEST_TIMEOUT = 90000; // 90 seconds per test
const SUITE_TIMEOUT = 300000; // 5 minutes per suite

// Result type for tracking test outcomes
type Result = {
  modelName: string;
  modelProvider: string;
  testName: string;
  outputType: 'processor' | 'native';
  status: 'success' | 'failure' | 'error';
  error: string | null;
  receivedObject: any;
  testId: string;
};

// Define all test schemas
const allSchemas = {
  // Simple types
  simpleObject: z.object({
    answer: z.string().describe('A text answer'),
    confidence: z.number().min(0).max(1).describe('Confidence level between 0 and 1'),
  }),

  // String constraints
  stringValidation: z.object({
    email: z.string().email().describe('Valid email address'),
    username: z.string().min(3).max(20).describe('Username between 3-20 characters'),
    url: z.string().url().describe('Valid URL'),
  }),

  // Number constraints
  numberValidation: z.object({
    age: z.number().int().positive().min(18).max(120).describe('Age between 18 and 120'),
    score: z.number().min(0).max(100).describe('Score between 0 and 100'),
    price: z.number().positive().describe('Positive price'),
  }),

  // Date and time
  dateValidation: z.object({
    createdAt: z.string().datetime().describe('ISO datetime string'),
    dateOfBirth: z.string().date().describe('ISO date string'),
  }),

  // Enums and literals
  enumsAndLiterals: z.object({
    role: z.enum(['admin', 'user', 'guest']).describe('User role'),
    status: z.literal('active').or(z.literal('inactive')).describe('Account status'),
  }),

  // Arrays
  arrayTypes: z.object({
    tags: z.array(z.string()).min(1).describe('List of tags'),
    scores: z.array(z.number()).describe('List of scores'),
  }),

  // Nested objects
  nestedObject: z.object({
    user: z.object({
      name: z.string(),
      profile: z.object({
        bio: z.string(),
        age: z.number(),
      }),
    }),
  }),

  // Optional and nullable
  optionalFields: z.object({
    required: z.string().describe('Required field'),
    optional: z.string().nullable().describe('Optional field'),
    nullable: z.string().nullable().describe('Nullable field'),
  }),

  // Records
  recordType: z.object({
    metadata: z.record(z.string(), z.any()).describe('Key-value metadata'),
  }),

  // Unions
  unionType: z.object({
    contact: z.union([
      z.object({ type: z.literal('email'), address: z.string().email() }),
      z.object({ type: z.literal('phone'), number: z.string() }),
    ]),
  }),

  // Tuples
  tupleType: z.object({
    coordinates: z.tuple([z.number(), z.number()]).describe('Latitude and longitude'),
  }),

  // Top-level array
  topLevelArray: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      completed: z.boolean(),
    }),
  ),

  // Top-level enum
  topLevelEnum: z.enum(['success', 'error', 'warning', 'info']),

  // Discriminated union
  discriminatedUnion: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('success'),
      message: z.string(),
    }),
    z.object({
      type: z.literal('error'),
      code: z.string(),
      message: z.string(),
    }),
  ]),

  // Complex nested with arrays
  complexNested: z.object({
    tasks: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        priority: z.enum(['low', 'medium', 'high']),
        assignees: z.array(z.string()).min(1),
      }),
    ),
    summary: z.object({
      total: z.number(),
    }),
  }),

  // Large schema
  largeSchema: z.object({
    field1: z.string(),
    field2: z.string(),
    field3: z.number(),
    field4: z.boolean(),
    field5: z.array(z.string()),
    field6: z.object({
      nested1: z.string(),
      nested2: z.number(),
    }),
    field7: z.enum(['a', 'b', 'c']),
    field8: z.string().nullable(),
    field9: z.record(z.string()),
    field10: z.array(z.object({ id: z.string(), value: z.number() })),
  }),

  // ========== REAL-WORLD COMPLEX SCHEMAS ==========

  // E-commerce Order Processing
  ecommerceOrder: z.object({
    orderId: z.string().describe('Unique order identifier'),
    orderNumber: z.string().describe('Human-readable order number (e.g., ORD-2024-001)'),
    customer: z.object({
      id: z.string().uuid(),
      email: z.string().email(),
      name: z.string(),
      phone: z.string().nullable(),
      loyaltyTier: z.enum(['bronze', 'silver', 'gold', 'platinum']).nullable(),
    }),
    items: z
      .array(
        z.object({
          productId: z.string(),
          sku: z.string(),
          name: z.string(),
          quantity: z.number().int().positive(),
          unitPrice: z.number().positive(),
          discount: z
            .object({
              type: z.enum(['percentage', 'fixed', 'bogo']),
              value: z.number().positive(),
              code: z.string().nullable(),
            })
            .nullable(),
          taxRate: z.number().min(0).max(1),
          metadata: z
            .object({
              weight: z.number().nullable(),
              dimensions: z
                .object({
                  length: z.number(),
                  width: z.number(),
                  height: z.number(),
                  unit: z.enum(['cm', 'in']),
                })
                .nullable(),
              category: z.string(),
              brand: z.string().nullable(),
            })
            .nullable(),
        }),
      )
      .min(1),
    shipping: z.object({
      address: z.object({
        street1: z.string(),
        street2: z.string().nullable(),
        city: z.string(),
        state: z.string(),
        postalCode: z.string(),
        country: z.string().length(2),
      }),
      method: z.enum(['standard', 'express', 'overnight', 'pickup']),
      carrier: z.string().nullable(),
      trackingNumber: z.string().nullable(),
      estimatedDelivery: z.string().date().nullable(),
      cost: z.number().min(0),
    }),
    payment: z.object({
      method: z.enum(['credit_card', 'paypal', 'apple_pay', 'bank_transfer']),
      status: z.enum(['pending', 'authorized', 'captured', 'failed', 'refunded']),
      transactionId: z.string().nullable(),
      last4: z.string().length(4).nullable(),
      amount: z.number().positive(),
      currency: z.string().length(3),
    }),
    totals: z.object({
      subtotal: z.number().positive(),
      tax: z.number().min(0),
      shipping: z.number().min(0),
      discount: z.number().min(0),
      total: z.number().positive(),
    }),
    status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']),
    timestamps: z.object({
      createdAt: z.string().datetime(),
      updatedAt: z.string().datetime(),
      paidAt: z.string().datetime().nullable(),
      shippedAt: z.string().datetime().nullable(),
      deliveredAt: z.string().datetime().nullable(),
    }),
    notes: z.string().nullable(),
    tags: z.array(z.string()).nullable(),
  }),

  // User Profile Management System
  userProfileSystem: z.object({
    user: z.object({
      id: z.string().uuid(),
      username: z.string().min(3).max(30),
      email: z.string().email(),
      emailVerified: z.boolean(),
      phoneNumber: z.string().nullable(),
      phoneVerified: z.boolean().nullable(),
      profile: z.object({
        firstName: z.string(),
        lastName: z.string(),
        displayName: z.string().nullable(),
        avatar: z.string().url().nullable(),
        bio: z.string().max(500).nullable(),
        dateOfBirth: z.string().date().nullable(),
        gender: z.enum(['male', 'female', 'non-binary', 'prefer-not-to-say']).nullable(),
        location: z
          .object({
            city: z.string(),
            state: z.string().nullable(),
            country: z.string(),
            timezone: z.string().nullable(),
          })
          .nullable(),
        socialLinks: z
          .object({
            twitter: z.string().url().nullable(),
            linkedin: z.string().url().nullable(),
            github: z.string().url().nullable(),
            website: z.string().url().nullable(),
          })
          .nullable(),
      }),
      preferences: z.object({
        language: z.string().length(2),
        theme: z.enum(['light', 'dark', 'auto']),
        notifications: z.object({
          email: z.boolean(),
          push: z.boolean(),
          sms: z.boolean(),
          frequency: z.enum(['realtime', 'daily', 'weekly', 'never']),
        }),
        privacy: z.object({
          profileVisibility: z.enum(['public', 'friends', 'private']),
          showEmail: z.boolean(),
          showPhone: z.boolean(),
          allowMessages: z.boolean(),
        }),
      }),
      security: z.object({
        twoFactorEnabled: z.boolean(),
        lastPasswordChange: z.string().datetime().nullable(),
        activeSessions: z.number().int().min(0),
        loginHistory: z.array(
          z.object({
            timestamp: z.string().datetime(),
            ipAddress: z.string(),
            userAgent: z.string(),
            location: z.string().nullable(),
            success: z.boolean(),
          }),
        ),
      }),
      subscription: z
        .object({
          plan: z.enum(['free', 'basic', 'pro', 'enterprise']),
          status: z.enum(['active', 'cancelled', 'expired', 'trial']),
          startDate: z.string().datetime().nullable(),
          endDate: z.string().datetime().nullable(),
          autoRenew: z.boolean(),
          features: z.array(z.string()),
        })
        .nullable(),
      metadata: z.object({
        createdAt: z.string().datetime().nullable(),
        updatedAt: z.string().datetime().nullable(),
        lastLogin: z.string().datetime().nullable(),
        loginCount: z.number().int().min(0),
        isActive: z.boolean(),
        isBanned: z.boolean(),
        banReason: z.string().nullable(),
      }),
    }),
  }),

  // API Response with Error Handling
  apiResponse: z.discriminatedUnion('status', [
    z.object({
      status: z.literal('success'),
      data: z.object({
        results: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            description: z.string().nullable(),
            score: z.number().min(0).max(1),
            tags: z.array(z.string()),
            createdAt: z.string().datetime(),
          }),
        ),
        pagination: z.object({
          page: z.number().int().positive(),
          pageSize: z.number().int().positive(),
          totalPages: z.number().int().min(0),
          totalResults: z.number().int().min(0),
          hasNext: z.boolean(),
          hasPrevious: z.boolean(),
        }),
        metadata: z.object({
          query: z.string(),
          executionTime: z.number().positive(),
          timestamp: z.string().datetime(),
          version: z.string(),
        }),
      }),
      meta: z.object({
        requestId: z.string().uuid(),
        timestamp: z.string().datetime(),
        cached: z.boolean(),
        ttl: z.number().int().nullable(),
      }),
    }),
    z.object({
      status: z.literal('error'),
      error: z.object({
        code: z.string(),
        message: z.string(),
        details: z.array(
          z.object({
            field: z.string().nullable(),
            message: z.string(),
            code: z.string(),
          }),
        ),
        stackTrace: z.string().nullable(),
        timestamp: z.string().datetime(),
      }),
      meta: z.object({
        requestId: z.string().uuid(),
        timestamp: z.string().datetime(),
      }),
    }),
    z.object({
      status: z.literal('partial'),
      data: z.object({
        results: z.array(z.any()),
        warnings: z.array(
          z.object({
            code: z.string(),
            message: z.string(),
            affectedItems: z.array(z.string()).nullable(),
          }),
        ),
      }),
      meta: z.object({
        requestId: z.string().uuid(),
        timestamp: z.string().datetime(),
      }),
    }),
  ]),

  // Document Processing & Extraction
  documentExtraction: z.object({
    documentId: z.string().uuid(),
    documentType: z.enum(['invoice', 'receipt', 'contract', 'resume', 'report', 'form']),
    metadata: z.object({
      fileName: z.string(),
      fileSize: z.number().positive(),
      mimeType: z.string(),
      uploadedAt: z.string().datetime(),
      processedAt: z.string().datetime(),
      pageCount: z.number().int().positive(),
      language: z.string().length(2),
      confidence: z.number().min(0).max(1),
    }),
    extracted: z.object({
      text: z.object({
        raw: z.string(),
        cleaned: z.string(),
        wordCount: z.number().int().min(0),
      }),
      entities: z.array(
        z.object({
          type: z.enum(['person', 'organization', 'location', 'date', 'money', 'email', 'phone', 'url']),
          value: z.string(),
          confidence: z.number().min(0).max(1),
          position: z.object({
            start: z.number().int().min(0),
            end: z.number().int().min(0),
          }),
          metadata: z.record(z.any()).nullable(),
        }),
      ),
      fields: z.array(
        z.object({
          name: z.string(),
          value: z.union([z.string(), z.number(), z.boolean()]),
          confidence: z.number().min(0).max(1),
          boundingBox: z
            .object({
              x: z.number(),
              y: z.number(),
              width: z.number(),
              height: z.number(),
              page: z.number().int().positive(),
            })
            .nullable(),
        }),
      ),
      tables: z
        .array(
          z.object({
            rows: z.number().int().positive(),
            columns: z.number().int().positive(),
            data: z.array(z.array(z.string())),
            headers: z.array(z.string()).nullable(),
            page: z.number().int().positive(),
          }),
        )
        .nullable(),
      signatures: z
        .array(
          z.object({
            detected: z.boolean(),
            signedBy: z.string().nullable(),
            signedAt: z.string().datetime().nullable(),
            verified: z.boolean(),
            page: z.number().int().positive(),
          }),
        )
        .nullable(),
    }),
    analysis: z.object({
      sentiment: z
        .object({
          score: z.number().min(-1).max(1),
          label: z.enum(['positive', 'negative', 'neutral']),
          confidence: z.number().min(0).max(1),
        })
        .nullable(),
      topics: z
        .array(
          z.object({
            name: z.string(),
            relevance: z.number().min(0).max(1),
          }),
        )
        .nullable(),
      summary: z.string().nullable(),
      keyPhrases: z.array(z.string()).nullable(),
    }),
    validation: z.object({
      isValid: z.boolean(),
      errors: z.array(
        z.object({
          field: z.string(),
          message: z.string(),
          severity: z.enum(['error', 'warning', 'info']),
        }),
      ),
      completeness: z.number().min(0).max(1),
    }),
  }),

  // Analytics Event Tracking
  analyticsEvent: z.object({
    eventId: z.string().uuid(),
    eventName: z.string(),
    eventType: z.enum(['page_view', 'click', 'conversion', 'custom', 'error', 'performance']),
    timestamp: z.string().datetime(),
    session: z.object({
      id: z.string().uuid(),
      startTime: z.string().datetime(),
      duration: z.number().int().min(0).nullable(),
      pageViews: z.number().int().min(0),
      isNewSession: z.boolean(),
    }),
    user: z.object({
      id: z.string().uuid().nullable(),
      anonymousId: z.string().uuid(),
      traits: z.object({
        email: z.string().email().nullable(),
        name: z.string().nullable(),
        accountType: z.enum(['free', 'paid', 'trial', 'enterprise']).nullable(),
        signupDate: z.string().date().nullable(),
      }),
    }),
    page: z.object({
      url: z.string().url(),
      path: z.string(),
      title: z.string(),
      referrer: z.string().url().nullable(),
      search: z.string().nullable(),
      hash: z.string().nullable(),
    }),
    device: z.object({
      type: z.enum(['desktop', 'mobile', 'tablet', 'tv', 'wearable', 'unknown']),
      os: z.string(),
      osVersion: z.string().nullable(),
      browser: z.string(),
      browserVersion: z.string().nullable(),
      screenSize: z
        .object({
          width: z.number().int().positive(),
          height: z.number().int().positive(),
        })
        .nullable(),
      viewport: z
        .object({
          width: z.number().int().positive(),
          height: z.number().int().positive(),
        })
        .nullable(),
      language: z.string(),
      timezone: z.string(),
    }),
    location: z
      .object({
        country: z.string().length(2),
        region: z.string().nullable(),
        city: z.string().nullable(),
        latitude: z.number().nullable(),
        longitude: z.number().nullable(),
        ipAddress: z.string().nullable(),
      })
      .nullable(),
    properties: z.record(z.union([z.string(), z.number(), z.boolean()])),
    campaign: z
      .object({
        source: z.string(),
        medium: z.string(),
        name: z.string(),
        term: z.string().nullable(),
        content: z.string().nullable(),
      })
      .nullable(),
    performance: z
      .object({
        loadTime: z.number().min(0).nullable(),
        domReady: z.number().min(0).nullable(),
        firstPaint: z.number().min(0).nullable(),
        firstContentfulPaint: z.number().min(0).nullable(),
        largestContentfulPaint: z.number().min(0).nullable(),
      })
      .nullable(),
    metadata: z.object({
      version: z.string(),
      sdkVersion: z.string(),
      processed: z.boolean(),
    }),
  }),
} as const;

type SchemaKey = keyof typeof allSchemas;

// Prompts for each schema type
const schemaPrompts: Record<SchemaKey, string> = {
  simpleObject: 'What is 2+2? Provide an answer and your confidence.',
  stringValidation: 'Create sample user contact information.',
  numberValidation: 'Create sample user metrics (age, score, price).',
  dateValidation: 'Create timestamp data for a new document.',
  enumsAndLiterals: 'Create user access information for an admin user.',
  arrayTypes: 'Create a list of 3 programming language tags and their popularity scores.',
  nestedObject: 'Create a user profile for John Doe, age 30.',
  optionalFields: 'Create a partial user profile with a name.',
  recordType: 'Create metadata for a blog post.',
  unionType: 'Create email contact information for john@example.com.',
  tupleType: 'Provide coordinates for San Francisco.',
  topLevelArray: 'Create 3 todo items.',
  topLevelEnum: 'Classify the severity of "Database connection failed".',
  discriminatedUnion: 'Create a successful API response.',
  complexNested: 'Create 2 software development tasks with assignees.',
  largeSchema: 'Create comprehensive data with all fields.',

  // Real-world scenarios
  ecommerceOrder:
    'Generate a complete e-commerce order for customer Jane Smith (jane@example.com) who purchased a laptop and wireless mouse, shipping to 123 Main St, San Francisco, CA 94102, paid via credit card ending in 4242.',
  userProfileSystem:
    'Create a comprehensive user profile for developer Alex Chen (alex.chen@example.com, @alexchen), age 28, living in Seattle, with a Pro subscription and 2FA enabled.',
  apiResponse:
    'Generate a successful API response with 3 search results for "machine learning tutorials", showing page 1 of 5 with 10 results per page.',
  documentExtraction:
    'Generate document extraction results for a processed invoice PDF that contains vendor information, line items, and payment details. The document should have 2 pages and include detected entities like dates, amounts, and company names.',
  analyticsEvent:
    'Create an analytics event for a page view of the pricing page from a mobile device (iPhone) by a logged-in user coming from a Google Ads campaign. Include performance metrics.',
};

// Helper function to run a single test
async function runStructuredOutputTest(
  model: LanguageModelV2,
  schemaName: SchemaKey,
  outputType: 'processor' | 'native',
  testId: string,
): Promise<Result> {
  try {
    const schema = allSchemas[schemaName];
    const prompt = schemaPrompts[schemaName];

    const agent = new Agent({
      name: `test-agent-${model.modelId}-${outputType}`,
      instructions: 'You are a helpful assistant that provides accurate, structured responses.',
      model: model,
    });

    const generateOptions =
      outputType === 'processor'
        ? {
            structuredOutput: {
              schema,
              model: model, // Use same model for structuring
            },
          }
        : {
            structuredOutput: {
              schema,
              // No model provided - uses native structured output
            },
          };

    const response = await agent.generate(prompt, generateOptions);

    if (!response.object) {
      throw new Error(`No object generated for schema: ${schemaName}`);
    }

    // Validate against schema
    const parseResult = schema.safeParse(response.object);
    if (!parseResult.success) {
      // Log detailed validation errors
      console.error(`\n❌ Validation failed for ${schemaName} (${outputType}):`);
      console.error('Received object:', JSON.stringify(response.object, null, 2));
      console.error('Validation errors:', JSON.stringify(parseResult.error.format(), null, 2));
      throw new Error(
        `Schema validation failed: ${JSON.stringify(parseResult.error.format()._errors || parseResult.error.errors)}`,
      );
    }

    return {
      modelName: model.modelId,
      modelProvider: model.provider,
      testName: schemaName,
      outputType,
      status: 'success',
      error: null,
      receivedObject: response.object,
      testId,
    };
  } catch (e: any) {
    let status: Result['status'] = 'error';
    if (e.name === 'AI_NoObjectGeneratedError' || e.message.toLowerCase().includes('validation failed')) {
      status = 'failure';
    }
    return {
      modelName: model.modelId,
      modelProvider: model.provider,
      testName: schemaName,
      outputType,
      status,
      error: e.message,
      receivedObject: null,
      testId,
    };
  }
}

const _realWorldScenarios: SchemaKey[] = [
  'ecommerceOrder',
  'userProfileSystem',
  'apiResponse',
  'documentExtraction',
  'analyticsEvent',
];

describe('Structured Output Comprehensive Tests', () => {
  const modelsToTest = [
    openai('gpt-4o-mini'),
    openai('gpt-4o'),
    openai('gpt-5'),
    openrouter('anthropic/claude-3.5-haiku'),
    openrouter('anthropic/claude-3-5-sonnet-20241022'),
    openrouter('google/gemini-2.5-flash'),
  ];

  // Specify which schemas to test - empty array means test all
  const schemasToTest: SchemaKey[] = [];
  const testSchemas = schemasToTest.length > 0 ? schemasToTest : (Object.keys(allSchemas) as SchemaKey[]);

  // Group models by provider
  const modelsByProvider = modelsToTest.reduce(
    (acc, model) => {
      const provider = model.provider;
      if (!acc[provider]) {
        acc[provider] = [];
      }
      acc[provider].push(model);
      return acc;
    },
    {} as Record<string, (typeof modelsToTest)[number][]>,
  );

  // Create tests organized by provider -> output type -> model -> schema
  Object.entries(modelsByProvider).forEach(([provider, models]) => {
    describe.concurrent.skip(`Provider: ${provider}`, { timeout: SUITE_TIMEOUT }, () => {
      ['processor', 'native'].forEach(outputType => {
        describe.concurrent(`Output Type: ${outputType}`, { timeout: SUITE_TIMEOUT }, () => {
          models.forEach(model => {
            describe.concurrent(`Model: ${model.modelId}`, { timeout: SUITE_TIMEOUT }, () => {
              testSchemas.forEach(schemaName => {
                it(
                  `should handle ${schemaName} schema`,
                  async () => {
                    let result = await runStructuredOutputTest(
                      model,
                      schemaName,
                      outputType as 'processor' | 'native',
                      crypto.randomUUID(),
                    );

                    if (result.status !== 'success') {
                      console.error(`Error for ${model.modelId} (${outputType}) - ${schemaName}:`, result.error);
                    }

                    expect(result.status).toBe('success');
                  },
                  TEST_TIMEOUT,
                );
              });
            });
          });
        });
      });
    });
  });

  // Summary test to show overall compatibility
  describe('Compatibility Summary', () => {
    it('should provide test configuration info', () => {
      console.log('\n=== Structured Output Test Configuration ===');
      console.log(`Total providers: ${Object.keys(modelsByProvider).length}`);
      console.log(`Total models: ${modelsToTest.length}`);
      console.log(`Total schemas: ${testSchemas.length}`);
      console.log(`Output types: processor, native`);
      console.log(`Total possible tests: ${modelsToTest.length * testSchemas.length * 2}`);
      console.log('============================================\n');
      expect(true).toBe(true);
    });
  });
});
