import { describe, it, expect } from 'vitest';
import { Mastra } from './index';

class TestAgent {
  __registerMastra(_: any) {}
  __registerPrimitives(_: any) {}
}

class TestWorkflow {
  id = 'wf-id';
  name = 'wf-name';
  __registerMastra(_: any) {}
  __registerPrimitives(_: any) {}
}

class TestTTS {
  __setLogger(_: any) {}
  __setTelemetry?(_: any) {}
}

class TestVector {
  __setTelemetry?(_: any) {}
}

class TestMCPServer {
  id?: string;
  version?: string;
  releaseDate?: string;
  setId(id: string) {
    this.id = id;
  }
  __setTelemetry?(_: any) {}
  __registerMastra(_: any) {}
  __setLogger(_: any) {}
}

describe('Mastra registration and de-registration', () => {
  it('registers and unregisters agents', () => {
    const mastra = new Mastra();
    const agent = new TestAgent();

    mastra.registerAgent('a1', agent as any);
    expect(Object.keys(mastra.getAgents())).toContain('a1');

    mastra.unregisterAgent('a1');
    expect(Object.keys(mastra.getAgents())).not.toContain('a1');
  });

  it('registers and unregisters workflows', () => {
    const mastra = new Mastra();
    const wf = new TestWorkflow();

    mastra.registerWorkflow('w1', wf as any);
    expect(Object.keys(mastra.getWorkflows())).toContain('w1');

    mastra.unregisterWorkflow('w1');
    expect(Object.keys(mastra.getWorkflows())).not.toContain('w1');
  });

  it('registers and unregisters vectors', () => {
    const mastra = new Mastra();
    const vector = new TestVector();

    mastra.registerVector('v1', vector as any);
    expect(Object.keys(mastra.getVectors())).toContain('v1');

    mastra.unregisterVector('v1');
    expect(Object.keys(mastra.getVectors())).not.toContain('v1');
  });

  it('registers and unregisters TTS', () => {
    const mastra = new Mastra();
    const tts = new TestTTS();

    mastra.registerTTS('t1', tts as any);
    expect(Object.keys(mastra.getTTS())).toContain('t1');

    mastra.unregisterTTS('t1');
    expect(Object.keys(mastra.getTTS())).not.toContain('t1');
  });

  it('registers and unregisters scorers', () => {
    const mastra = new Mastra();
    const scorer = { name: 's-name' };

    mastra.registerScorer('s1', scorer as any);
    expect(Object.keys(mastra.getScorers())).toContain('s1');

    mastra.unregisterScorer('s1');
    expect(Object.keys(mastra.getScorers())).not.toContain('s1');
  });

  it('registers and unregisters MCP servers', () => {
    const mastra = new Mastra();
    const server = new TestMCPServer();

    mastra.registerMCPServer('m1', server as any);
    expect(Object.keys(mastra.getMCPServers() || {})).toContain('m1');

    mastra.unregisterMCPServer('m1');
    expect(Object.keys(mastra.getMCPServers() || {})).not.toContain('m1');
  });
});

describe('Mastra de-registration clears references (GC hints)', { timeout: 200000 }, () => {
  it('clears last strong ref for agent enabling GC via FinalizationRegistry/WeakRef', async () => {
    if (typeof WeakRef === 'undefined') {
      // Environment does not support required GC APIs; skip assertions
      return;
    }

    const mastra = new Mastra();
    let agent: any = new TestAgent();
    const weak = new WeakRef(agent);

    mastra.registerAgent('a1', agent);
    mastra.unregisterAgent('a1');

    expect(weak.deref()).toBeDefined();

    // Drop the last strong reference
    agent = null;

    // Ask V8 to collect if available and give event loop a few turns
    if (typeof globalThis.gc === 'function') {
      for (let i = 0; i < 5; i++) {
        try {
          globalThis.gc();
        } catch {}
        await new Promise(r => setTimeout(r, 0));
      }

      expect(weak.deref()).toBeUndefined();
    } else {
      // Without exposed GC, we can only assert no strong refs from Mastra
      expect(() => mastra.getAgent('a1')).toThrow();
    }
  });
});


