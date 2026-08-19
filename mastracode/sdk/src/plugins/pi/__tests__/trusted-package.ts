import path from 'node:path';

import type { InstalledPluginRecord, PluginScope } from '../../types.js';
import { hashMaterializedPackageDirectory, hashPackageDirectory } from '../package-resolver.js';

export function createTrustedPiPackageRecord(
  packageRoot: string,
  scopeRoot: string,
  scope: PluginScope,
  entry = 'index.ts',
): InstalledPluginRecord {
  const integrity = hashPackageDirectory(packageRoot);
  const materializedIntegrity = hashMaterializedPackageDirectory(packageRoot);
  const relativeRoot = path.relative(scopeRoot, packageRoot);
  return {
    enabled: true,
    source: 'pi-package',
    compatibility: 'pi',
    specifier: packageRoot,
    path: relativeRoot,
    entry,
    entries: [entry],
    piPackage: {
      resolution: {
        sourceType: 'local',
        resolvedSpecifier: `local:${packageRoot}#${integrity}`,
        sourceRoot: relativeRoot,
        packageRoot: relativeRoot,
        integrity,
        contentIntegrity: integrity,
        materializedIntegrity,
      },
      resources: { extensions: [entry], skills: [], prompts: [], themes: [] },
      targetApiVersion: '0.84.2',
      compatibilityReport: {
        targetApiVersion: '0.84.2',
        status: 'pi-incompatible',
        capabilities: [],
        diagnostics: [],
      },
      trust: {
        codeExecution: 'trusted',
        project: scope === 'project' ? 'trusted' : 'not-required',
        installScripts: 'deny',
      },
    },
  };
}
