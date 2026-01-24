import * as net from 'node:net';

export interface PortManagerConfig {
  start: number;
  end: number;
}

/**
 * Manages port allocation for local routing.
 */
export class PortManager {
  private allocatedPorts: Set<number> = new Set();
  private readonly range: PortManagerConfig;

  constructor(config: PortManagerConfig) {
    this.range = config;
  }

  /**
   * Allocate an available port.
   */
  async allocate(): Promise<number> {
    for (let port = this.range.start; port <= this.range.end; port++) {
      if (this.allocatedPorts.has(port)) continue;

      if (await this.isPortAvailable(port)) {
        this.allocatedPorts.add(port);
        return port;
      }
    }
    throw new Error(`No available ports in range ${this.range.start}-${this.range.end}`);
  }

  /**
   * Reserve a specific port.
   */
  async reserve(port: number): Promise<boolean> {
    if (this.allocatedPorts.has(port)) return false;
    if (!(await this.isPortAvailable(port))) return false;

    this.allocatedPorts.add(port);
    return true;
  }

  /**
   * Release an allocated port.
   */
  release(port: number): void {
    this.allocatedPorts.delete(port);
  }

  /**
   * Check if a port is available.
   */
  async isPortAvailable(port: number): Promise<boolean> {
    return new Promise(resolve => {
      const server = net.createServer();

      server.once('error', () => {
        resolve(false);
      });

      server.once('listening', () => {
        server.close();
        resolve(true);
      });

      server.listen(port, '127.0.0.1');
    });
  }

  /**
   * Get all allocated ports.
   */
  getAllocated(): number[] {
    return Array.from(this.allocatedPorts);
  }
}
