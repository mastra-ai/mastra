/**
 * Global setup for Vitest
 * Returns a teardown function that ALWAYS runs after tests complete
 */
import { execSync } from 'child_process';

export default function setup() {
  console.log('[GLOBAL SETUP] Vitest global setup initialized');

  // Return teardown function that will ALWAYS run
  return async function teardown() {
    console.log('[GLOBAL TEARDOWN] Killing any leftover service processes...');

    try {
      // Kill any node processes on the test ports
      const ports = [3000, 3001, 3002];
      for (const port of ports) {
        try {
          const pid = execSync(`lsof -ti :${port}`, { encoding: 'utf-8' }).trim();
          if (pid) {
            execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
            console.log(`[GLOBAL TEARDOWN] Killed process ${pid} on port ${port}`);
          }
        } catch (e) {
          // Port not in use, that's fine
        }
      }
    } catch (error) {
      console.error('[GLOBAL TEARDOWN] Error during cleanup:', error);
    }

    console.log('[GLOBAL TEARDOWN] Cleanup complete');
  };
}
