import { describe, it, expect } from 'vitest';
import { convertToViteEnvVar } from './utils';

describe('utils', () => {
  describe('convertToViteEnvVar', () => {
    it('should convert env vars to vite env vars', () => {
      const envVars = new Map<string, string>();
      envVars.set('MASTRA_TOOLS_PATH', 'tools');
      envVars.set('HELLO_WORLD', 'hello world');
      envVars.set('NO_MASTRA_TELEMETRY', '1');

      const viteEnvVars = convertToViteEnvVar(envVars, ['MASTRA_TOOLS_PATH', 'NO_MASTRA_TELEMETRY']);

      expect(viteEnvVars.size).toEqual(3);
      expect(viteEnvVars.get('VITE_MASTRA_TOOLS_PATH')).toEqual('tools');
      expect(viteEnvVars.get('HELLO_WORLD')).toEqual('hello world');
      expect(viteEnvVars.get('VITE_NO_MASTRA_TELEMETRY')).toEqual('1');
    });
  });
});
