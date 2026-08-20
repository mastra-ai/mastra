import type { AccountingProvider } from './types.ts';

export class NotImplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotImplementedError';
  }
}
export interface ConnectorProviderConfig {
  id?: string;
  connectorType: 'mcp' | 'standard';
  endpoint?: string;
  toolMap?: Record<string, string>;
}
/** Future seam for MCP/standard connectors: discover accounting entities, map them to canonical ports, and return an AccountingProvider without changing pipeline steps. */
export function makeConnectorProvider(_config: ConnectorProviderConfig): AccountingProvider {
  throw new NotImplementedError('connector provider not yet implemented');
}
