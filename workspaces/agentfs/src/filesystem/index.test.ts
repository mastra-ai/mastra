/**
 * AgentFS Filesystem Unit Tests
 *
 * Tests constructor, getInfo, getInstructions, and lifecycle.
 * No mocks — these tests hit the real agentfs-sdk.
 */

import { describe, it, expect } from 'vitest';

import { AgentFSFilesystem } from './index';

describe('AgentFSFilesystem', () => {
  describe('Constructor & Options', () => {
    it('throws if no agentId, path, or agent provided', () => {
      expect(() => new AgentFSFilesystem({} as any)).toThrow(/requires at least one of/);
    });

    it('generates unique id if not provided', () => {
      const fs1 = new AgentFSFilesystem({ agentId: 'test' });
      const fs2 = new AgentFSFilesystem({ agentId: 'test' });

      expect(fs1.id).toMatch(/^agentfs-/);
      expect(fs2.id).toMatch(/^agentfs-/);
      expect(fs1.id).not.toBe(fs2.id);
    });

    it('uses provided id', () => {
      const fs = new AgentFSFilesystem({ id: 'my-id', agentId: 'test' });
      expect(fs.id).toBe('my-id');
    });

    it('has correct provider and name', () => {
      const fs = new AgentFSFilesystem({ agentId: 'test' });
      expect(fs.provider).toBe('agentfs');
      expect(fs.name).toBe('AgentFSFilesystem');
    });

    it('defaults icon to database and displayName to AgentFS', () => {
      const fs = new AgentFSFilesystem({ agentId: 'test' });
      expect(fs.icon).toBe('database');
      expect(fs.displayName).toBe('AgentFS');
    });

    it('sets readOnly from options', () => {
      const fsRO = new AgentFSFilesystem({ agentId: 'test', readOnly: true });
      const fsDef = new AgentFSFilesystem({ agentId: 'test' });
      expect(fsRO.readOnly).toBe(true);
      expect(fsDef.readOnly).toBeUndefined();
    });
  });

  describe('getInfo()', () => {
    it('includes agentId in metadata', () => {
      const fs = new AgentFSFilesystem({ id: 'test-id', agentId: 'my-agent' });
      const info = fs.getInfo();

      expect(info.id).toBe('test-id');
      expect(info.provider).toBe('agentfs');
      expect(info.icon).toBe('database');
      expect(info.metadata?.agentId).toBe('my-agent');
    });

    it('includes dbPath in metadata when set', () => {
      const fs = new AgentFSFilesystem({ path: '/tmp/test.db' });
      expect(fs.getInfo().metadata?.dbPath).toBe('/tmp/test.db');
    });

    it('excludes unset metadata fields', () => {
      const fs = new AgentFSFilesystem({ agentId: 'test' });
      expect(fs.getInfo().metadata?.dbPath).toBeUndefined();
    });
  });

  describe('getInstructions()', () => {
    it('includes agent label and access mode', () => {
      const fs = new AgentFSFilesystem({ agentId: 'my-agent' });
      expect(fs.getInstructions()).toContain('my-agent');
      expect(fs.getInstructions()).toContain('Persistent');
    });

    it('indicates read-only when set', () => {
      const fs = new AgentFSFilesystem({ agentId: 'test', readOnly: true });
      expect(fs.getInstructions()).toContain('Read-only');
    });
  });

  describe('appendFile binary', () => {
    it('preserves binary data when appending', async () => {
      const fs = new AgentFSFilesystem({ agentId: `binary-append-${Date.now()}` });
      await fs._init();

      try {
        const first = Buffer.from([0x00, 0x01, 0x02, 0xff]);
        const second = Buffer.from([0xde, 0xad, 0xbe, 0xef]);

        await fs.writeFile('/binary.bin', first);
        await fs.appendFile('/binary.bin', second);

        const result = await fs.readFile('/binary.bin');
        const buf = Buffer.isBuffer(result) ? result : Buffer.from(result);
        expect(buf).toEqual(Buffer.concat([first, second]));
      } finally {
        await fs._destroy();
      }
    });
  });

  describe('Lifecycle', () => {
    it('init sets status to ready, destroy sets destroyed', async () => {
      const fs = new AgentFSFilesystem({ agentId: `lifecycle-${Date.now()}` });
      expect(fs.status).toBe('pending');

      await fs._init();
      expect(fs.status).toBe('ready');

      await fs._destroy();
      expect(fs.status).toBe('destroyed');
    });

    it('skips open for pre-opened agent and does not close on destroy', async () => {
      // Open a real agent, then pass it in
      const owner = new AgentFSFilesystem({ agentId: `pre-opened-${Date.now()}` });
      await owner._init();

      const borrower = new AgentFSFilesystem({ agent: (owner as any)._agent });
      await borrower._init();
      expect(borrower.status).toBe('ready');

      // Borrower destroy should not close the underlying agent
      await borrower._destroy();
      expect(borrower.status).toBe('destroyed');

      // Owner should still work
      await owner.writeFile('/still-alive.txt', 'yes');
      const content = await owner.readFile('/still-alive.txt', { encoding: 'utf-8' });
      expect(content).toBe('yes');

      await owner._destroy();
    });
  });
});
