import { readFileSync } from 'fs';
import { join } from 'path';
import { getDeployer } from '@mastra/deployer';
import { FileService } from '../../services/service.file.js';
import { logger } from '../../utils/logger.js';
import { BuildBundler } from '../build/BuildBundler.js';

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface MastraPackage {
  name: string;
  version: string;
  isAlpha: boolean;
}

interface NextConfig {
  serverExternalPackages?: string[];
}

interface TsConfig {
  compilerOptions?: {
    module?: string;
    moduleResolution?: string;
    [key: string]: unknown;
  };
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

function readTsConfig(dir: string): TsConfig | null {
  const tsConfigPath = join(dir, 'tsconfig.json');
  try {
    const tsConfigContent = readFileSync(tsConfigPath, 'utf-8');
    return JSON.parse(tsConfigContent);
  } catch {
    return null;
  }
}

function checkTsConfig(dir: string): boolean {
  const tsConfig = readTsConfig(dir);
  if (!tsConfig) {
    logger.warn('No tsconfig.json found. This might cause issues with Mastra packages.');
    return true; // Not a critical error, just a warning
  }

  const { module, moduleResolution } = tsConfig.compilerOptions || {};

  // Check if either moduleResolution is 'bundler' or module is 'CommonJS'
  const isValidConfig = moduleResolution === 'bundler' || module === 'CommonJS';
  if (!isValidConfig) {
    logger.error('tsconfig.json has invalid configuration');
    logger.error('Please set either:');
    logger.error('  "compilerOptions": {');
    logger.error('    "moduleResolution": "bundler"');
    logger.error('  }');
    logger.error('or');
    logger.error('  "compilerOptions": {');
    logger.error('    "module": "CommonJS"');
    logger.error('  }');
    logger.error('For the recommended TypeScript configuration, see:');
    logger.error('https://mastra.ai/en/docs/getting-started/installation#initialize-typescript');
    return false;
  }

  logger.info('TypeScript config is properly configured for Mastra packages');
  return true;
}

function isNextJsProject(dir: string): boolean {
  const nextConfigPath = join(dir, 'next.config.js');
  try {
    readFileSync(nextConfigPath, 'utf-8');
    return true;
  } catch {
    return false;
  }
}

function readNextConfig(dir: string): NextConfig | null {
  const nextConfigPath = join(dir, 'next.config.js');
  try {
    const nextConfigContent = readFileSync(nextConfigPath, 'utf-8');
    // Extract the config object from the file content
    const configMatch = nextConfigContent.match(/const nextConfig = ({[\s\S]*?});/);
    if (!configMatch?.[1]) {
      return null;
    }
    // Evaluate the config object string to get the actual object
    // This is a simple implementation and might need to be more robust
    const configStr = configMatch[1].replace(/\n/g, '').replace(/\s+/g, ' ');
    return eval(`(${configStr})`);
  } catch {
    return null;
  }
}

function checkNextConfig(dir: string): boolean {
  const nextConfig = readNextConfig(dir);
  if (!nextConfig) {
    return false;
  }

  const serverExternals = nextConfig.serverExternalPackages || [];
  const hasMastraExternals = serverExternals.some(
    pkg => pkg === '@mastra/*' || pkg === '@mastra/core' || pkg.startsWith('@mastra/'),
  );

  if (!hasMastraExternals) {
    logger.error('next.config.js is missing Mastra packages in serverExternalPackages');
    logger.error('Please add the following to your next.config.js:');
    logger.error('  serverExternalPackages: ["@mastra/*"],');
    return false;
  }

  logger.info('Next.js config is properly configured for Mastra packages');
  return true;
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

function checkMastraCore(mastraPackages: MastraPackage[]): boolean {
  const hasCore = mastraPackages.some(pkg => pkg.name === '@mastra/core');
  if (!hasCore) {
    logger.error('@mastra/core is not installed. This package is required for Mastra to work properly.');
    return false;
  }
  return true;
}

function checkMastraDepsCompatibility(mastraPackages: MastraPackage[]): boolean {
  if (mastraPackages.length === 0) {
    logger.warn('No Mastra packages found in package.json');
    return true;
  }

  const hasAlpha = mastraPackages.some(pkg => pkg.isAlpha);
  const hasNonAlpha = mastraPackages.some(pkg => !pkg.isAlpha);

  if (hasAlpha && hasNonAlpha) {
    logger.error('Inconsistent Mastra package versions found:');
    mastraPackages.forEach(({ name, version }) => {
      logger.error(`  ${name}: ${version}`);
    });
    logger.error('All Mastra packages should be either alpha or non-alpha versions');
    return false;
  }

  logger.info('All Mastra package versions are consistent!');
  return true;
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

    if (isNextJsProject(rootDir)) {
      const nextConfigValid = checkNextConfig(rootDir);
      if (!nextConfigValid) {
        return false;
      }
    }

    const packageJson = readPackageJson(rootDir);
    const mastraPackages = getMastraPackages(packageJson);

    const hasMastraCore = checkMastraCore(mastraPackages);
    const isMastraDepsCompatible = checkMastraDepsCompatibility(mastraPackages);
    const isTsConfigValid = checkTsConfig(rootDir);

    const fs = new FileService();
    const mastraEntryFile = fs.getFirstExistingFile([join(mastraDir, 'index.ts'), join(mastraDir, 'index.js')]);

    const platformDeployer = await getDeployer(mastraEntryFile, outputDirectory);

    if (!platformDeployer) {
      const deployer = new BuildBundler();
      await deployer.lint(mastraEntryFile, outputDirectory, discoveredTools);
    } else {
      await platformDeployer.lint(mastraEntryFile, outputDirectory, discoveredTools);
    }

    return hasMastraCore && isMastraDepsCompatible && isTsConfigValid;
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Lint check failed: ${error.message}`);
    }
    return false;
  }
}
