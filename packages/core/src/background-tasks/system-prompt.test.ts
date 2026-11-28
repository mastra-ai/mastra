import { describe, expect, it } from 'vitest';
import { generateBackgroundTaskSystemPrompt } from './system-prompt';

describe('generateBackgroundTaskSystemPrompt', () => {
  it('describes eligible tools as background by default', () => {
    const prompt = generateBackgroundTaskSystemPrompt({
      research: { background: { enabled: true } },
      calculator: {},
    });

    expect(prompt).toContain('- research (default: background)');
    expect(prompt).not.toContain('- calculator');
  });

  it('describes foreground-default tools as per-call opt-in', () => {
    const prompt = generateBackgroundTaskSystemPrompt({
      research: { background: { enabled: true, defaultDisposition: 'foreground' } },
      scan: { background: { enabled: true } },
    });

    expect(prompt).toContain('- research (default: foreground — opt in with "_background")');
    expect(prompt).toContain('- scan (default: background)');
    expect(prompt).toContain('omitting "_background" never starts background work');
  });

  it('uses agent eligibility overrides, including agent-level defaultDisposition', () => {
    const prompt = generateBackgroundTaskSystemPrompt(
      {
        research: { background: { enabled: true } },
        lookup: {},
      },
      { tools: { research: false, lookup: { enabled: true, defaultDisposition: 'foreground' } } },
    );

    expect(prompt).not.toContain('- research');
    expect(prompt).toContain('- lookup (default: foreground — opt in with "_background")');
  });

  it('returns undefined when no tools are eligible', () => {
    expect(generateBackgroundTaskSystemPrompt({ calculator: {} })).toBeUndefined();
  });

  describe('modelOverrides: false (issue #28638)', () => {
    it('omits _background instructions when no tool accepts overrides', () => {
      const prompt = generateBackgroundTaskSystemPrompt({
        research: { background: { enabled: true, modelOverrides: false } },
        scan: { background: { enabled: true, modelOverrides: false } },
      });

      expect(prompt).toContain('- research (always runs in the background)');
      expect(prompt).toContain('- scan (always runs in the background)');
      expect(prompt).not.toContain('_background');
    });

    it('marks fixed tools when mixed with overridable tools', () => {
      const prompt = generateBackgroundTaskSystemPrompt(
        {
          research: { background: { enabled: true } },
          scan: { background: { enabled: true } },
        },
        { tools: { research: true, scan: { enabled: true, modelOverrides: false } } },
      );

      expect(prompt).toContain('- research (default: background)');
      expect(prompt).toContain('- scan (always runs in the background)');
      expect(prompt).toContain('Tools marked "always runs in the background" do not accept "_background".');
    });

    it('returns undefined when the only eligible tool is foreground-default without overrides', () => {
      expect(
        generateBackgroundTaskSystemPrompt({
          research: { background: { enabled: true, defaultDisposition: 'foreground', modelOverrides: false } },
        }),
      ).toBeUndefined();
    });
  });

  describe('agent-wide modelOverrides: false (#31614, #31612)', () => {
    it('applies the agent-wide false to tools: "all"', () => {
      const prompt = generateBackgroundTaskSystemPrompt(
        {
          research: { background: { enabled: true } },
          scan: { background: { enabled: true } },
        },
        { tools: 'all', modelOverrides: false },
      );

      expect(prompt).toContain('Every tool runs in the background');
      expect(prompt).not.toContain('_background');
      expect(prompt).not.toContain('research');
      expect(prompt).not.toContain('scan');
    });

    it('exposes the field only for tools the merged policy allows', () => {
      const prompt = generateBackgroundTaskSystemPrompt(
        {
          research: { background: { enabled: true } },
          scan: { background: { enabled: true } },
        },
        {
          tools: { research: true, scan: { enabled: true, modelOverrides: true } },
          modelOverrides: false,
        },
      );

      expect(prompt).toContain('- research (always runs in the background)');
      expect(prompt).toContain('- scan (default: background)');
      expect(prompt).toContain('Tools marked "always runs in the background" do not accept "_background".');
    });
  });

  describe('uniform tools: "all" guidance is name-independent (#31614)', () => {
    function toolsFor(count: number) {
      return Object.fromEntries(
        Array.from({ length: count }, (_, i) => [`tool-${i}`, { background: { enabled: true } }]),
      );
    }

    it('keeps the prompt unchanged when the tool set grows', () => {
      const small = generateBackgroundTaskSystemPrompt(toolsFor(2), { tools: 'all' });
      const large = generateBackgroundTaskSystemPrompt(toolsFor(40), { tools: 'all' });

      expect(small).toContain('Every tool supports background execution');
      expect(large).toBe(small);
      expect(small).not.toContain('- tool-0');
      expect(small).not.toContain('- tool-39');
    });

    it('is name-independent when every tool always runs in the background', () => {
      const small = generateBackgroundTaskSystemPrompt(toolsFor(2), { tools: 'all', modelOverrides: false });
      const large = generateBackgroundTaskSystemPrompt(toolsFor(40), { tools: 'all', modelOverrides: false });

      expect(small).toContain('Every tool runs in the background');
      expect(large).toBe(small);
      expect(small).not.toContain('- tool-0');
    });

    it('still lists names when a per-tool entry breaks the uniform policy', () => {
      const prompt = generateBackgroundTaskSystemPrompt(toolsFor(3), {
        tools: { 'tool-0': { enabled: true, modelOverrides: false } },
      });

      // A named opt-in is not `'all'`, so the model still needs each tool listed.
      expect(prompt).toContain('The following tools support background execution:');
      expect(prompt).toContain('- tool-0 (always runs in the background)');
      expect(prompt).toContain('- tool-1 (default: background)');
      expect(prompt).toContain('For the tools listed with "default: background",');
      expect(prompt).not.toContain('For any tool,');
    });
  });

  describe('mixed-policy override guidance', () => {
    it('scopes override instructions to the tools that accept them', () => {
      const prompt = generateBackgroundTaskSystemPrompt({
        backgroundTool: { background: { enabled: true } },
        foregroundTool: { background: { enabled: true, defaultDisposition: 'foreground' } },
        fixedTool: { background: { enabled: true, modelOverrides: false } },
      });

      expect(prompt).toContain('For the tools listed with "default: background" or "default: foreground",');
      expect(prompt).not.toContain('For any tool,');
      expect(prompt).toContain('Tools marked "always runs in the background" do not accept "_background".');
    });

    it('omits override guidance entirely when every listed tool rejects overrides', () => {
      const prompt = generateBackgroundTaskSystemPrompt({
        fixedA: { background: { enabled: true, modelOverrides: false } },
        fixedB: { background: { enabled: true, modelOverrides: false } },
        plain: {},
      });

      expect(prompt).toContain('- fixedA (always runs in the background)');
      expect(prompt).not.toContain('_background');
    });
  });

  describe('prompt stability against recorded fixtures', () => {
    it('keeps the long-standing wording while every listed tool accepts overrides', () => {
      // The durable-agent-background-tools recordings replay requests exactly, so
      // this text is pinned: a per-tool policy that already produced it keeps
      // producing it byte for byte, and only a listed non-overridable tool scopes
      // the guidance to the accepting policies.
      const prompt = generateBackgroundTaskSystemPrompt(
        { fetchRecord: { background: { enabled: true } } },
        { tools: { fetchRecord: true } },
      );

      expect(prompt).toContain('- fetchRecord (default: background)');
      expect(prompt).toContain('For any of these tools, you can include a "_background" field');
      expect(prompt).toContain(
        'Tools listed with "default: background" run in the background unless you set "disposition": "foreground".' +
          ' Tools listed with "default: foreground" run inline unless you explicitly request "deferred" or "awaited"' +
          ' — for those tools, omitting "_background" never starts background work.',
      );
      expect(prompt).not.toContain('For the tools listed with');
      expect(prompt).not.toContain('For any tool,');
    });
  });
});
