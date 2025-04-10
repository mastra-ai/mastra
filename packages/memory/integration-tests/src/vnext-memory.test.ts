import type { MemoryConfig } from '@mastra/core/memory';
import { Memory as OriginalMemory } from '@mastra/memory';
import { Memory as VNextMemory } from '@mastra/memory/vnext';
import { describe, expect, it } from 'vitest';

describe('vNext Memory', () => {
  it('should have different defaults from the original Memory', () => {
    const originalMemory = new OriginalMemory();
    const vNextMemory = new VNextMemory();

    // Access the configuration via getMergedThreadConfig()
    const originalConfig = originalMemory.getMergedThreadConfig();
    const vNextConfig = vNextMemory.getMergedThreadConfig();

    // Check that vNext defaults are different from original defaults
    expect(originalConfig).not.toStrictEqual(vNextConfig);

    // Check specific default values for vNext
    expect(vNextConfig.workingMemory!.enabled).toBe(false);
    expect(vNextConfig.semanticRecall).toBe(false);
    expect(vNextConfig.threads!.generateTitle).toBe(false);
    expect(vNextConfig.lastMessages).toBe(10);
    expect(vNextConfig.workingMemory!.use).toBe('tool-call');
  });

  it('should allow overriding the default settings', () => {
    // Create vNext memory with custom settings that override defaults
    const customConfig: Partial<MemoryConfig> = {
      workingMemory: {
        enabled: true,
      },
      semanticRecall: true,
      threads: {
        generateTitle: true,
      },
      lastMessages: 20,
    };

    const customVNextMemory = new VNextMemory({
      options: customConfig,
    });

    // Access the configuration via getMergedThreadConfig()
    const mergedConfig = customVNextMemory.getMergedThreadConfig();

    // Verify the custom settings were applied
    expect(mergedConfig.workingMemory!.enabled).toBe(true);
    expect(mergedConfig.semanticRecall).toBe(true);
    expect(mergedConfig.threads!.generateTitle).toBe(true);
    expect(mergedConfig.lastMessages).toBe(20);

    // Check that non-overridden settings keep their default values
    expect(mergedConfig.workingMemory!.use).toBe('tool-call');
  });

  it('should correctly merge deep nested settings', () => {
    // Test partial overrides of nested objects
    const partialOverrideMemory = new VNextMemory({
      options: {
        workingMemory: {
          // Only override 'enabled', keep other workingMemory defaults
          enabled: true,
        },
      },
    });

    // Access the configuration via getMergedThreadConfig()
    const mergedConfig = partialOverrideMemory.getMergedThreadConfig();

    // Verify the partial override worked
    expect(mergedConfig.workingMemory!.enabled).toBe(true);
    expect(mergedConfig.workingMemory!.use).toBe('tool-call');
    expect(mergedConfig.workingMemory!.template).toBeDefined();
  });
});

