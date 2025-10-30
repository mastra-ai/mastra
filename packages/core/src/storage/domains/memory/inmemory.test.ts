import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { InMemoryMemory } from './inmemory';

describe('InMemoryMemory.updateResource', () => {
  let memory: InMemoryMemory;
  let initialDate: Date;
  let laterDate: Date;

  beforeEach(() => {
    // Set up two fixed dates for testing
    initialDate = new Date('2024-01-01T00:00:00Z');
    laterDate = new Date('2024-01-01T01:00:00Z');

    // Use Vitest fake timers to control Date
    vi.useFakeTimers();
    vi.setSystemTime(initialDate);

    // Initialize fresh InMemoryMemory instance for each test with required constructor args
    memory = new InMemoryMemory({
      collection: {
        threads: new Map(),
        resources: new Map(),
        messages: new Map(),
      } as any,
      operations: {} as any,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("should create new resource with default metadata as empty object when resourceId doesn't exist and metadata is not provided", async () => {
    // Arrange
    const resourceId = 'new-resource-123';
    const workingMemory = 'test working memory';

    // Act
    const result = await memory.updateResource({
      resourceId,
      workingMemory,
    });

    // Assert
    expect(result).toEqual({
      id: resourceId,
      workingMemory,
      metadata: {},
      createdAt: initialDate,
      updatedAt: initialDate,
    });
  });

  it("should create new resource with undefined workingMemory when workingMemory parameter is not provided and resource doesn't exist", async () => {
    // Arrange
    const resourceId = 'new-resource-123';

    // Act
    const result = await memory.updateResource({
      resourceId,
    });

    // Assert
    expect(result).toEqual({
      id: resourceId,
      workingMemory: undefined,
      metadata: {},
      createdAt: initialDate,
      updatedAt: initialDate,
    });
  });

  it('should preserve existing workingMemory when updating a resource and workingMemory parameter is undefined', async () => {
    // Arrange
    const resourceId = 'existing-resource-123';
    const originalWorkingMemory = 'original working memory';
    const initialMetadata = { key1: 'value1' };

    // Create initial resource
    await memory.updateResource({
      resourceId,
      workingMemory: originalWorkingMemory,
      metadata: initialMetadata,
    });

    // Advance mock date
    vi.setSystemTime(laterDate);

    // Act
    const result = await memory.updateResource({
      resourceId,
      metadata: { key2: 'value2' },
    });

    // Assert
    expect(result).toEqual({
      id: resourceId,
      workingMemory: originalWorkingMemory,
      metadata: {
        key1: 'value1',
        key2: 'value2',
      },
      createdAt: initialDate,
      updatedAt: laterDate,
    });
  });

  it("should update existing resource's workingMemory when a new workingMemory value is provided", async () => {
    // Arrange
    const resourceId = 'existing-resource-123';
    const initialWorkingMemory = 'initial memory';
    const newWorkingMemory = 'updated memory';

    // Create initial resource
    await memory.updateResource({
      resourceId,
      workingMemory: initialWorkingMemory,
      metadata: { initial: true },
    });

    // Advance time
    vi.setSystemTime(laterDate);

    // Act
    const result = await memory.updateResource({
      resourceId,
      workingMemory: newWorkingMemory,
    });

    // Assert
    expect(result).toEqual({
      id: resourceId,
      workingMemory: newWorkingMemory,
      metadata: { initial: true },
      createdAt: initialDate,
      updatedAt: laterDate,
    });
  });

  it('should create new resource with provided workingMemory and metadata', async () => {
    // Arrange: Set up test data with resourceId, workingMemory string, and metadata object
    const resourceId = 'test-resource-123';
    const workingMemory = 'test working memory';
    const metadata = { key1: 'value1', key2: 'value2' };

    // Act: Call updateResource with all parameters to create a new resource
    const result = await memory.updateResource({
      resourceId,
      workingMemory,
      metadata,
    });

    // Assert: Verify new resource created with all provided values and correct timestamps
    expect(result).toEqual({
      id: resourceId,
      workingMemory,
      metadata,
      createdAt: initialDate,
      updatedAt: initialDate,
    });
  });

  it('should create new resource with only metadata (undefined workingMemory)', async () => {
    // Arrange: Prepare resourceId and metadata object without workingMemory
    const resourceId = 'test-resource-456';
    const metadata = { testKey: 'testValue' };

    // Act: Call updateResource with only resourceId and metadata parameters
    const result = await memory.updateResource({
      resourceId,
      metadata,
    });

    // Assert: Verify resource created with undefined workingMemory and provided metadata
    expect(result).toEqual({
      id: resourceId,
      workingMemory: undefined,
      metadata,
      createdAt: initialDate,
      updatedAt: initialDate,
    });
  });

  it('should merge metadata and update updatedAt while preserving createdAt for an existing resource', async () => {
    // Arrange: Create initial resource with metadata and advance time
    const resourceId = 'test-resource-789';
    const initialMetadata = { initial: true, shared: 'initial' };

    await memory.updateResource({
      resourceId,
      metadata: initialMetadata,
    });

    vi.setSystemTime(laterDate);
    const updateMetadata = { new: true, shared: 'updated' };

    // Act: Update existing resource with new metadata
    const result = await memory.updateResource({
      resourceId,
      metadata: updateMetadata,
    });

    // Assert: Verify metadata merged correctly and timestamps updated appropriately
    expect(result).toEqual({
      id: resourceId,
      workingMemory: undefined,
      metadata: {
        initial: true,
        shared: 'updated',
        new: true,
      },
      createdAt: initialDate,
      updatedAt: laterDate,
    });
  });
});
