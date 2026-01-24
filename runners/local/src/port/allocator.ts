import getPort from 'get-port';

/**
 * Manages port allocation for running servers.
 * Tracks used ports and ensures no collisions.
 */
export class PortAllocator {
  private readonly portRange: { start: number; end: number };
  private readonly allocatedPorts: Set<number> = new Set();

  constructor(portRange: { start: number; end: number } = { start: 4111, end: 4200 }) {
    this.portRange = portRange;
  }

  /**
   * Allocate an available port.
   *
   * @param preferred - Preferred port (if available)
   * @returns Allocated port number
   * @throws Error if no ports available
   */
  async allocate(preferred?: number): Promise<number> {
    // Try preferred port first
    if (preferred && this.isInRange(preferred) && !this.allocatedPorts.has(preferred)) {
      const available = await this.isPortAvailable(preferred);
      if (available) {
        this.allocatedPorts.add(preferred);
        return preferred;
      }
    }

    // Generate port list within range
    const portList: number[] = [];
    for (let port = this.portRange.start; port <= this.portRange.end; port++) {
      if (!this.allocatedPorts.has(port)) {
        portList.push(port);
      }
    }

    if (portList.length === 0) {
      throw new Error(`No available ports in range ${this.portRange.start}-${this.portRange.end}`);
    }

    // Use get-port to find an available port
    const port = await getPort({ port: portList });

    if (!this.isInRange(port)) {
      throw new Error(`Allocated port ${port} is outside configured range`);
    }

    this.allocatedPorts.add(port);
    return port;
  }

  /**
   * Release a previously allocated port.
   */
  release(port: number): void {
    this.allocatedPorts.delete(port);
  }

  /**
   * Check if a port is currently allocated by this allocator.
   */
  isAllocated(port: number): boolean {
    return this.allocatedPorts.has(port);
  }

  /**
   * Get all currently allocated ports.
   */
  getAllocatedPorts(): number[] {
    return Array.from(this.allocatedPorts);
  }

  /**
   * Get number of available ports.
   */
  getAvailableCount(): number {
    const total = this.portRange.end - this.portRange.start + 1;
    return total - this.allocatedPorts.size;
  }

  private isInRange(port: number): boolean {
    return port >= this.portRange.start && port <= this.portRange.end;
  }

  private async isPortAvailable(port: number): Promise<boolean> {
    const allocated = await getPort({ port: [port] });
    return allocated === port;
  }
}
