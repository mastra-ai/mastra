import * as net from 'node:net';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { PortManager } from './port-manager';

describe('PortManager', () => {
  let portManager: PortManager;
  let occupiedServers: net.Server[] = [];

  beforeEach(() => {
    portManager = new PortManager({ start: 39100, end: 39110 });
    occupiedServers = [];
  });

  afterEach(async () => {
    // Clean up any servers we created
    await Promise.all(
      occupiedServers.map(
        server =>
          new Promise<void>(resolve => {
            server.close(() => resolve());
          }),
      ),
    );
  });

  /**
   * Helper to occupy a port for testing
   */
  async function occupyPort(port: number): Promise<net.Server> {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.once('error', reject);
      server.once('listening', () => {
        occupiedServers.push(server);
        resolve(server);
      });
      server.listen(port, '127.0.0.1');
    });
  }

  describe('allocate', () => {
    it('should allocate first available port in range', async () => {
      const port = await portManager.allocate();

      expect(port).toBe(39100);
      expect(portManager.getAllocated()).toContain(port);
    });

    it('should allocate next port when first is already allocated', async () => {
      const port1 = await portManager.allocate();
      const port2 = await portManager.allocate();

      expect(port1).toBe(39100);
      expect(port2).toBe(39101);
    });

    it('should skip ports that are in use by other processes', async () => {
      // Occupy the first port
      await occupyPort(39100);

      const port = await portManager.allocate();

      expect(port).toBe(39101);
    });

    it('should skip already allocated ports', async () => {
      await portManager.allocate(); // 39100
      await portManager.allocate(); // 39101

      const port = await portManager.allocate();

      expect(port).toBe(39102);
    });

    it('should throw error when no ports available in range', async () => {
      // Allocate all ports in the range
      const narrowManager = new PortManager({ start: 39200, end: 39202 });
      await narrowManager.allocate();
      await narrowManager.allocate();
      await narrowManager.allocate();

      await expect(narrowManager.allocate()).rejects.toThrow('No available ports in range 39200-39202');
    });

    it('should allocate multiple ports sequentially', async () => {
      const ports = await Promise.all([portManager.allocate(), portManager.allocate(), portManager.allocate()]);

      expect(ports).toEqual([39100, 39101, 39102]);
      expect(portManager.getAllocated()).toEqual([39100, 39101, 39102]);
    });
  });

  describe('reserve', () => {
    it('should reserve a specific port', async () => {
      const result = await portManager.reserve(39105);

      expect(result).toBe(true);
      expect(portManager.getAllocated()).toContain(39105);
    });

    it('should return false for already allocated port', async () => {
      await portManager.reserve(39105);

      const result = await portManager.reserve(39105);

      expect(result).toBe(false);
    });

    it('should return false for port in use by another process', async () => {
      await occupyPort(39105);

      const result = await portManager.reserve(39105);

      expect(result).toBe(false);
    });

    it('should allow reserving after allocate skips it', async () => {
      await occupyPort(39100);
      await portManager.allocate(); // Gets 39101 since 39100 is occupied

      // Release 39100 externally
      await new Promise<void>(resolve => {
        occupiedServers[0].close(() => resolve());
      });
      occupiedServers = [];

      // Now 39100 should be reservable
      const result = await portManager.reserve(39100);

      expect(result).toBe(true);
    });
  });

  describe('release', () => {
    it('should release an allocated port', async () => {
      const port = await portManager.allocate();

      portManager.release(port);

      expect(portManager.getAllocated()).not.toContain(port);
    });

    it('should allow re-allocation of released port', async () => {
      const port1 = await portManager.allocate();
      portManager.release(port1);

      const port2 = await portManager.allocate();

      expect(port2).toBe(port1);
    });

    it('should handle releasing non-allocated port', () => {
      // Should not throw
      expect(() => portManager.release(99999)).not.toThrow();
    });
  });

  describe('isPortAvailable', () => {
    it('should return true for available port', async () => {
      const available = await portManager.isPortAvailable(39150);

      expect(available).toBe(true);
    });

    it('should return false for occupied port', async () => {
      await occupyPort(39151);

      const available = await portManager.isPortAvailable(39151);

      expect(available).toBe(false);
    });

    it('should check actual availability, not just allocation status', async () => {
      // Port is not in our allocated set, but is occupied
      await occupyPort(39152);

      const available = await portManager.isPortAvailable(39152);

      expect(available).toBe(false);
    });
  });

  describe('getAllocated', () => {
    it('should return empty array initially', () => {
      const allocated = portManager.getAllocated();

      expect(allocated).toEqual([]);
    });

    it('should return all allocated ports', async () => {
      await portManager.allocate();
      await portManager.allocate();
      await portManager.reserve(39105);

      const allocated = portManager.getAllocated();

      expect(allocated).toContain(39100);
      expect(allocated).toContain(39101);
      expect(allocated).toContain(39105);
      expect(allocated).toHaveLength(3);
    });

    it('should not include released ports', async () => {
      const port = await portManager.allocate();
      portManager.release(port);

      const allocated = portManager.getAllocated();

      expect(allocated).not.toContain(port);
    });
  });

  describe('edge cases', () => {
    it('should handle single-port range', async () => {
      const singlePortManager = new PortManager({ start: 39300, end: 39300 });

      const port = await singlePortManager.allocate();

      expect(port).toBe(39300);
      await expect(singlePortManager.allocate()).rejects.toThrow('No available ports');
    });

    it('should handle port range where all ports are occupied', async () => {
      const tinyManager = new PortManager({ start: 39400, end: 39401 });
      await occupyPort(39400);
      await occupyPort(39401);

      await expect(tinyManager.allocate()).rejects.toThrow('No available ports');
    });

    it('should correctly track state across multiple operations', async () => {
      // Allocate
      const p1 = await portManager.allocate();
      const p2 = await portManager.allocate();

      // Release first
      portManager.release(p1);

      // Reserve a specific port
      await portManager.reserve(39105);

      // Allocate again (should get released port)
      const p3 = await portManager.allocate();

      expect(p1).toBe(39100);
      expect(p2).toBe(39101);
      expect(p3).toBe(39100); // Re-allocated the released port
      expect(portManager.getAllocated()).toEqual(expect.arrayContaining([39100, 39101, 39105]));
    });
  });
});
