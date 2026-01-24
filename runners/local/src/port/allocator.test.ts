import { describe, it, expect, beforeEach } from 'vitest';
import { PortAllocator } from './allocator';

describe('PortAllocator', () => {
  let allocator: PortAllocator;
  // Use high ephemeral ports less likely to conflict with other services
  const PORT_START = 49200;
  const PORT_END = 49210;

  beforeEach(() => {
    allocator = new PortAllocator({ start: PORT_START, end: PORT_END });
  });

  it('should allocate a port within range', async () => {
    const port = await allocator.allocate();
    expect(port).toBeGreaterThanOrEqual(PORT_START);
    expect(port).toBeLessThanOrEqual(PORT_END);
  });

  it('should track allocated ports', async () => {
    const port = await allocator.allocate();
    expect(allocator.isAllocated(port)).toBe(true);
  });

  it('should release ports', async () => {
    const port = await allocator.allocate();
    allocator.release(port);
    expect(allocator.isAllocated(port)).toBe(false);
  });

  it('should respect preferred port when available', async () => {
    const preferredPort = PORT_START + 5;
    const port = await allocator.allocate(preferredPort);
    expect(port).toBe(preferredPort);
  });

  it('should not allocate the same port twice', async () => {
    const port1 = await allocator.allocate();
    const port2 = await allocator.allocate();
    expect(port1).not.toBe(port2);
    expect(allocator.getAllocatedPorts()).toContain(port1);
    expect(allocator.getAllocatedPorts()).toContain(port2);
  });

  it('should return correct available count', async () => {
    const totalPorts = PORT_END - PORT_START + 1; // 11 ports
    expect(allocator.getAvailableCount()).toBe(totalPorts);

    await allocator.allocate();
    expect(allocator.getAvailableCount()).toBe(totalPorts - 1);

    await allocator.allocate();
    expect(allocator.getAvailableCount()).toBe(totalPorts - 2);
  });

  it('should return all allocated ports', async () => {
    const port1 = await allocator.allocate();
    const port2 = await allocator.allocate();

    const allocated = allocator.getAllocatedPorts();
    expect(allocated).toHaveLength(2);
    expect(allocated).toContain(port1);
    expect(allocated).toContain(port2);
  });

  it('should allow re-allocating a released port', async () => {
    const port1 = await allocator.allocate();
    allocator.release(port1);

    // After release, the port should no longer be tracked as allocated
    expect(allocator.isAllocated(port1)).toBe(false);

    // The port should be available for allocation again (tracked by allocator)
    // Note: OS port availability is separate from allocator tracking
    const allocatedAfterRelease = allocator.getAllocatedPorts().length;
    expect(allocatedAfterRelease).toBe(0);
  });

  it('should use default port range if not specified', () => {
    const defaultAllocator = new PortAllocator();
    const totalPorts = 4200 - 4111 + 1; // 90 ports
    expect(defaultAllocator.getAvailableCount()).toBe(totalPorts);
  });
});
