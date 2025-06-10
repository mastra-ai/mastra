import { readFileSync } from 'fs';
import { join } from 'path';
import { getDeployer } from '@mastra/deployer';
import { FileService } from '../../services/service.file.js';
import { logger } from '../../utils/logger.js';
import { BuildBundler } from '../build/BuildBundler.js';
import { rules } from './rules/index.js';
import type { LintContext } from './rules/types.js';

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface MastraPackage {
  name: string;
  version: string;
  isAlpha: boolean;
}

function readPackageJson(dir: string): PackageJson {
  const packageJsonPath = join(dir, 'package.json');
  try {
    const packageJsonContent = readFileSync(packageJsonPath, 'utf-8');
    return JSON.parse(packageJsonContent);
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Failed to read package.json: ${error.message}`);
    }
    throw error;
  }
}

function getMastraPackages(packageJson: PackageJson): MastraPackage[] {
  const allDependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  const mastraPackages = Object.entries(allDependencies).filter(
    ([name]) => name.startsWith('@mastra/') || name === 'mastra',
  );

  return mastraPackages.map(([name, version]) => ({
    name,
    version,
    isAlpha: version.includes('alpha'),
  }));
}

export async function lint({ dir, root, tools }: { dir?: string; root?: string; tools?: string[] }): Promise<boolean> {
  try {
    const rootDir = root || process.cwd();
    const mastraDir = dir
      ? dir.startsWith('/')
        ? dir
        : join(process.cwd(), dir)
      : join(process.cwd(), 'src', 'mastra');
    const outputDirectory = join(rootDir, '.mastra');

    const defaultToolsPath = join(mastraDir, 'tools');
    const discoveredTools = [defaultToolsPath, ...(tools ?? [])];

    const packageJson = readPackageJson(rootDir);
    const mastraPackages = getMastraPackages(packageJson);

    const context: LintContext = {
      rootDir,
      mastraDir,
      outputDirectory,
      discoveredTools,
      packageJson,
      mastraPackages,
    };

    // Run all rules
    const results = await Promise.all(rules.map(rule => rule.run(context)));
    const allRulesPassed = results.every(result => result);

    // Run deployer lint if all rules passed
    if (allRulesPassed) {
      const fileService = new FileService();
      const mastraEntryFile = fileService.getFirstExistingFile([
        join(mastraDir, 'index.ts'),
        join(mastraDir, 'index.js'),
      ]);
      const platformDeployer = await getDeployer(mastraEntryFile, outputDirectory);
      if (!platformDeployer) {
        const deployer = new BuildBundler();
        await deployer.lint(mastraEntryFile, outputDirectory, discoveredTools);
      } else {
        await platformDeployer.lint(mastraEntryFile, outputDirectory, discoveredTools);
      }
    }

    return allRulesPassed;
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Lint check failed: ${error.message}`);
    }
    return false;
  }
}
