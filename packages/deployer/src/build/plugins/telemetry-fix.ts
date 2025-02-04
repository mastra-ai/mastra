import { dirname, resolve } from 'path';
import { platform } from 'process';
import type { Plugin } from 'rollup';

function getTelemetryMachineFile() {
  switch (platform) {
    case 'darwin':
      return 'getMachineId-darwin';
    case 'linux':
      return 'getMachineId-linux';
    case 'freebsd':
      return 'getMachineId-bsd';
    case 'win32':
      return 'getMachineId-win';
    default:
      return 'getMachineId-unsupported';
  }
}

export function telemetryFix(): Plugin {
  return {
    name: 'telemetry-fix',
    transform(code, id) {
      if (id.includes('require-in-the-middle')) {
        return code
          .replace(
            `const path = require('path')`,
            `const path = require('path');
      const { createRequire } = require('module');
      const realRequire = createRequire(import.meta.url)`,
          )
          .replaceAll(`require.resolve`, `realRequire.resolve`);
      }
    },
    resolveId(id: string, importer?: string) {
      if (id === './machine-id/getMachineId' && importer) {
        // rewrite dynamic require to correct file
        return { id: resolve(dirname(importer), `./machine-id/${getTelemetryMachineFile()}.js`) };
      }

      if (id === 'formdata-node') {
        return { id: 'formdata-node', external: false };
      }
    },
    load(id: string) {
      if (id.startsWith('formdata-node')) {
        // Return an empty module
        return 'export default {};';
      }

      return null;
    },
  } satisfies Plugin;
}
