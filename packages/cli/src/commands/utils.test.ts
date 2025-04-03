import { describe, it, expect } from 'vitest';
import { convertToViteEnvVar } from './utils';

describe('utils', () => {
  describe('convertToViteEnvVar', () => {
    it('should convert env vars to vite env vars', () => {
      const envVars = new Map<string, string>();
      envVars.set('MASTRA_TOOLS_PATH', 'tools');
      envVars.set('HELLO_WORLD', 'hello world');
      envVars.set('MASTRA_TELEMETRY_DISABLED', '1');

      const viteEnvVars = convertToViteEnvVar(envVars, ['MASTRA_TOOLS_PATH', 'MASTRA_TELEMETRY_DISABLED']);

      expect(viteEnvVars.size).toEqual(3);
      expect(viteEnvVars.get('VITE_MASTRA_TOOLS_PATH')).toEqual('tools');
      expect(viteEnvVars.get('HELLO_WORLD')).toEqual('hello world');
      expect(viteEnvVars.get('VITE_MASTRA_TELEMETRY_DISABLED')).toEqual('1');
    });
  });
});
