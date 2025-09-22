import { existsSync } from 'fs';
import { mkdtemp, copyFile, readFile, mkdir, readdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join, dirname, resolve, extname, basename } from 'path';
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { AgentBuilder } from '../..';
import { AgentBuilderDefaults } from '../../defaults';
import type { TemplateUnit, UnitKind } from '../../types';
import {
  ApplyResultSchema,
  AgentBuilderInputSchema,
  CloneTemplateResultSchema,
  PackageAnalysisSchema,
  DiscoveryResultSchema,
  OrderedUnitsSchema,
  PackageMergeInputSchema,
  PackageMergeResultSchema,
  InstallInputSchema,
  InstallResultSchema,
  FileCopyInputSchema,
  FileCopyResultSchema,
  IntelligentMergeInputSchema,
  IntelligentMergeResultSchema,
  ValidationFixInputSchema,
  ValidationFixResultSchema,
  PrepareBranchInputSchema,
  PrepareBranchResultSchema,
} from '../../types';
import {
  getMastraTemplate,
  kindWeight,
  spawnSWPM,
  logGitState,
  backupAndReplaceFile,
  renameAndCopyFile,
  gitCheckoutBranch,
  gitClone,
  gitCheckoutRef,
  gitRevParse,
  gitAddAndCommit,
  resolveTargetPath,
  mergeGitignoreFiles,
  mergeEnvFiles,
  resolveModel,
} from '../../utils';

// Step 1: Clone template to temp directory
const cloneTemplateStep = createStep({
  id: 'clone-template',
  description: 'Clone the template repository to a temporary directory at the specified ref',
  inputSchema: AgentBuilderInputSchema,
  outputSchema: CloneTemplateResultSchema,
  execute: async ({ inputData }) => {
    const { repo, ref = 'main', slug, targetPath } = inputData;

    if (!repo) {
      throw new Error('Repository URL or path is required');
    }

    // Extract slug from repo URL if not provided
    const inferredSlug =
      slug ||
      repo
        .split('/')
        .pop()
        ?.replace(/\.git$/, '') ||
      'template';

    // Create temporary directory
    const tempDir = await mkdtemp(join(tmpdir(), 'mastra-template-'));

    try {
      // Clone repository
      await gitClone(repo, tempDir);

      // Checkout specific ref if provided
      if (ref !== 'main' && ref !== 'master') {
        await gitCheckoutRef(tempDir, ref);
      }

      // Get commit SHA
      const commitSha = await gitRevParse(tempDir, 'HEAD');

      return {
        templateDir: tempDir,
        commitSha: commitSha.trim(),
        slug: inferredSlug,
        success: true,
        targetPath,
      };
    } catch (error) {
      // Cleanup on error
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch {}

      return {
        templateDir: '',
        commitSha: '',
        slug: slug || 'unknown',
        success: false,
        error: `Failed to clone template: ${error instanceof Error ? error.message : String(error)}`,
        targetPath,
      };
    }
  },
});

// Step 2: Analyze template package.json for dependencies
const analyzePackageStep = createStep({
  id: 'analyze-package',
  description: 'Analyze the template package.json to extract dependency information',
  inputSchema: CloneTemplateResultSchema,
  outputSchema: PackageAnalysisSchema,
  execute: async ({ inputData }) => {
    console.info('Analyzing template package.json...');
    const { templateDir } = inputData;
    const packageJsonPath = join(templateDir, 'package.json');

    try {
      const packageJsonContent = await readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);

      console.info('Template package.json:', JSON.stringify(packageJson, null, 2));

      return {
        dependencies: packageJson.dependencies || {},
        devDependencies: packageJson.devDependencies || {},
        peerDependencies: packageJson.peerDependencies || {},
        scripts: packageJson.scripts || {},
        name: packageJson.name || '',
        version: packageJson.version || '',
        description: packageJson.description || '',
        success: true,
      };
    } catch (error) {
      console.warn(`Failed to read template package.json: ${error instanceof Error ? error.message : String(error)}`);
      return {
        dependencies: {},
        devDependencies: {},
        peerDependencies: {},
        scripts: {},
        name: '',
        version: '',
        description: '',
        success: true, // This is a graceful fallback, not a failure
      };
    }
  },
});

// Step 3: Discover template units by scanning the templates directory
const discoverUnitsStep = createStep({
  id: 'discover-units',
  description: 'Discover template units by analyzing the templates directory structure',
  inputSchema: CloneTemplateResultSchema,
  outputSchema: DiscoveryResultSchema,
  execute: async ({ inputData, runtimeContext }) => {
    const { templateDir } = inputData;
    const targetPath = resolveTargetPath(inputData, runtimeContext);

    const tools = await AgentBuilderDefaults.DEFAULT_TOOLS(templateDir);

    console.info('targetPath', targetPath);

    const model = await resolveModel({ runtimeContext, projectPath: targetPath, defaultModel: openai('gpt-4.1') });

    try {
      const agent = new Agent({
        model,
        instructions: `You are an expert at analyzing Mastra projects.

Your task is to scan the provided directory and identify all available units (agents, workflows, tools, MCP servers, networks).

Mastra Project Structure Analysis:
- Each Mastra project has a structure like: ${AgentBuilderDefaults.DEFAULT_FOLDER_STRUCTURE.agent}, ${AgentBuilderDefaults.DEFAULT_FOLDER_STRUCTURE.workflow}, ${AgentBuilderDefaults.DEFAULT_FOLDER_STRUCTURE.tool}, ${AgentBuilderDefaults.DEFAULT_FOLDER_STRUCTURE['mcp-server']}, ${AgentBuilderDefaults.DEFAULT_FOLDER_STRUCTURE.network}
- Analyze TypeScript files in each category directory to identify exported units

CRITICAL: YOU MUST USE YOUR TOOLS (readFile, listDirectory) TO DISCOVER THE UNITS IN THE TEMPLATE DIRECTORY.

IMPORTANT - Agent Discovery Rules:
1. **Multiple Agent Files**: Some templates have separate files for each agent (e.g., evaluationAgent.ts, researchAgent.ts)
2. **Single File Multiple Agents**: Some files may export multiple agents (look for multiple 'export const' or 'export default' statements)
3. **Agent Identification**: Look for exported variables that are instances of 'new Agent()' or similar patterns
4. **Naming Convention**: Agent names should be extracted from the export name (e.g., 'weatherAgent', 'evaluationAgent')

For each Mastra project directory you analyze:
1. Scan all TypeScript files in ${AgentBuilderDefaults.DEFAULT_FOLDER_STRUCTURE.agent} and identify ALL exported agents
2. Scan all TypeScript files in ${AgentBuilderDefaults.DEFAULT_FOLDER_STRUCTURE.workflow} and identify ALL exported workflows
3. Scan all TypeScript files in ${AgentBuilderDefaults.DEFAULT_FOLDER_STRUCTURE.tool} and identify ALL exported tools
4. Scan all TypeScript files in ${AgentBuilderDefaults.DEFAULT_FOLDER_STRUCTURE['mcp-server']} and identify ALL exported MCP servers
5. Scan all TypeScript files in ${AgentBuilderDefaults.DEFAULT_FOLDER_STRUCTURE.network} and identify ALL exported networks
6. Scan for any OTHER files in src/mastra that are NOT in the above default folders (e.g., lib/, utils/, types/, etc.) and identify them as 'other' files

IMPORTANT - Naming Consistency Rules:
- For ALL unit types (including 'other'), the 'name' field should be the filename WITHOUT extension
- For structured units (agents, workflows, tools, etc.), prefer the actual export name if clearly identifiable
- use the base filename without extension for the id (e.g., 'util.ts' → name: 'util')
- use the relative path from the template root for the file (e.g., 'src/mastra/lib/util.ts' → file: 'src/mastra/lib/util.ts')

Return the actual exported names of the units, as well as the file names.`,
        name: 'Mastra Project Discoverer',
        tools: {
          readFile: tools.readFile,
          listDirectory: tools.listDirectory,
        },
      });

      const isV2 = model.specificationVersion === 'v2';

      const prompt = `Analyze the Mastra project directory structure at "${templateDir}".

            List directory contents using listDirectory tool, and then analyze each file with readFile tool.
      IMPORTANT:
      - Look inside the actual file content to find export statements like 'export const agentName = new Agent(...)'
      - A single file may contain multiple exports
      - Return the actual exported variable names, as well as the file names
      - If a directory doesn't exist or has no files, return an empty array

      Return the analysis in the exact format specified in the output schema.`;

      const output = z.object({
        agents: z.array(z.object({ name: z.string(), file: z.string() })).optional(),
        workflows: z.array(z.object({ name: z.string(), file: z.string() })).optional(),
        tools: z.array(z.object({ name: z.string(), file: z.string() })).optional(),
        mcp: z.array(z.object({ name: z.string(), file: z.string() })).optional(),
        networks: z.array(z.object({ name: z.string(), file: z.string() })).optional(),
        other: z.array(z.object({ name: z.string(), file: z.string() })).optional(),
      });

      const result = isV2
        ? await agent.generateVNext(prompt, {
            output,
            maxSteps: 100,
          })
        : await agent.generate(prompt, {
            experimental_output: output,
            maxSteps: 100,
          });

      const template = result.object ?? {};

      const units: TemplateUnit[] = [];

      // Add agents
      template.agents?.forEach((agentId: { name: string; file: string }) => {
        units.push({ kind: 'agent', id: agentId.name, file: agentId.file });
      });

      // Add workflows
      template.workflows?.forEach((workflowId: { name: string; file: string }) => {
        units.push({ kind: 'workflow', id: workflowId.name, file: workflowId.file });
      });

      // Add tools
      template.tools?.forEach((toolId: { name: string; file: string }) => {
        units.push({ kind: 'tool', id: toolId.name, file: toolId.file });
      });

      // Add MCP servers
      template.mcp?.forEach((mcpId: { name: string; file: string }) => {
        units.push({ kind: 'mcp-server', id: mcpId.name, file: mcpId.file });
      });

      // Add networks
      template.networks?.forEach((networkId: { name: string; file: string }) => {
        units.push({ kind: 'network', id: networkId.name, file: networkId.file });
      });

      // Add other files
      template.other?.forEach((otherId: { name: string; file: string }) => {
        units.push({ kind: 'other', id: otherId.name, file: otherId.file });
      });

      console.info('Discovered units:', JSON.stringify(units, null, 2));

      if (units.length === 0) {
        throw new Error(`No Mastra units (agents, workflows, tools) found in template.
          Possible causes:
          - Template may not follow standard Mastra structure
          - AI agent couldn't analyze template files (model/token limits)
          - Template is empty or in wrong branch

          Debug steps:
          - Check template has files in src/mastra/ directories
          - Try a different branch
          - Check template repository structure manually`);
      }

      return {
        units,
        success: true,
      };
    } catch (error) {
      console.error('Failed to discover units:', error);
      return {
        units: [],
        success: false,
        error: `Failed to discover units: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});

// Step 4: Topological ordering (simplified)
const orderUnitsStep = createStep({
  id: 'order-units',
  description: 'Sort units in topological order based on kind weights',
  inputSchema: DiscoveryResultSchema,
  outputSchema: OrderedUnitsSchema,
  execute: async ({ inputData }) => {
    const { units } = inputData;

    // Simple sort by kind weight (mcp-servers first, then tools, agents, workflows, integration last)
    const orderedUnits = [...units].sort((a, b) => {
      const aWeight = kindWeight(a.kind);
      const bWeight = kindWeight(b.kind);
      return aWeight - bWeight;
    });

    return {
      orderedUnits,
      success: true,
    };
  },
});

// Step 5: Prepare branch
const prepareBranchStep = createStep({
  id: 'prepare-branch',
  description: 'Create or switch to integration branch before modifications',
  inputSchema: PrepareBranchInputSchema,
  outputSchema: PrepareBranchResultSchema,
  execute: async ({ inputData, runtimeContext }) => {
    const targetPath = resolveTargetPath(inputData, runtimeContext);

    try {
      const branchName = `feat/install-template-${inputData.slug}`;
      await gitCheckoutBranch(branchName, targetPath);

      return {
        branchName,
        success: true,
      };
    } catch (error) {
      console.error('Failed to prepare branch:', error);
      return {
        branchName: `feat/install-template-${inputData.slug}`, // Return the intended name anyway
        success: false,
        error: `Failed to prepare branch: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});

// Step 6: Package merge
const packageMergeStep = createStep({
  id: 'package-merge',
  description: 'Merge template package.json dependencies into target project',
  inputSchema: PackageMergeInputSchema,
  outputSchema: PackageMergeResultSchema,
  execute: async ({ inputData, runtimeContext }) => {
    console.info('Package merge step starting...');
    const { slug, packageInfo } = inputData;
    const targetPath = resolveTargetPath(inputData, runtimeContext);

    try {
      const targetPkgPath = join(targetPath, 'package.json');

      let targetPkgRaw = '{}';
      try {
        targetPkgRaw = await readFile(targetPkgPath, 'utf-8');
      } catch {
        console.warn(`No existing package.json at ${targetPkgPath}, creating a new one`);
      }

      let targetPkg: any;
      try {
        targetPkg = JSON.parse(targetPkgRaw || '{}');
      } catch (e) {
        throw new Error(
          `Failed to parse existing package.json at ${targetPkgPath}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }

      const ensureObj = (o: any) => (o && typeof o === 'object' ? o : {});

      targetPkg.dependencies = ensureObj(targetPkg.dependencies);
      targetPkg.devDependencies = ensureObj(targetPkg.devDependencies);
      targetPkg.peerDependencies = ensureObj(targetPkg.peerDependencies);
      targetPkg.scripts = ensureObj(targetPkg.scripts);

      const tplDeps = ensureObj(packageInfo.dependencies);
      const tplDevDeps = ensureObj(packageInfo.devDependencies);
      const tplPeerDeps = ensureObj(packageInfo.peerDependencies);
      const tplScripts = ensureObj(packageInfo.scripts);

      const existsAnywhere = (name: string) =>
        name in targetPkg.dependencies || name in targetPkg.devDependencies || name in targetPkg.peerDependencies;

      // Merge dependencies: add only if missing everywhere
      for (const [name, ver] of Object.entries(tplDeps)) {
        if (!existsAnywhere(name)) {
          (targetPkg.dependencies as Record<string, string>)[name] = String(ver);
        }
      }

      // Merge devDependencies
      for (const [name, ver] of Object.entries(tplDevDeps)) {
        if (!existsAnywhere(name)) {
          (targetPkg.devDependencies as Record<string, string>)[name] = String(ver);
        }
      }

      // Merge peerDependencies
      for (const [name, ver] of Object.entries(tplPeerDeps)) {
        if (!(name in targetPkg.peerDependencies)) {
          (targetPkg.peerDependencies as Record<string, string>)[name] = String(ver);
        }
      }

      // Merge scripts with prefixed keys to avoid collisions
      const prefix = `template:${slug}:`;
      for (const [name, cmd] of Object.entries(tplScripts)) {
        const newKey = `${prefix}${name}`;
        if (!(newKey in targetPkg.scripts)) {
          (targetPkg.scripts as Record<string, string>)[newKey] = String(cmd);
        }
      }

      await writeFile(targetPkgPath, JSON.stringify(targetPkg, null, 2), 'utf-8');

      await gitAddAndCommit(targetPath, `feat(template): merge deps for ${slug}`, [targetPkgPath], {
        skipIfNoStaged: true,
      });

      return {
        success: true,
        applied: true,
        message: `Successfully merged template dependencies for ${slug}`,
      };
    } catch (error) {
      console.error('Package merge failed:', error);
      return {
        success: false,
        applied: false,
        message: `Package merge failed: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

// Step 7: Install
const installStep = createStep({
  id: 'install',
  description: 'Install packages based on merged package.json',
  inputSchema: InstallInputSchema,
  outputSchema: InstallResultSchema,
  execute: async ({ inputData, runtimeContext }) => {
    console.info('Running install step...');
    const targetPath = resolveTargetPath(inputData, runtimeContext);

    try {
      // Run install using swpm (no specific packages)
      await spawnSWPM(targetPath, 'install', []);

      const lock = ['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock']
        .map(f => join(targetPath, f))
        .find(f => existsSync(f));

      if (lock) {
        await gitAddAndCommit(targetPath, `chore(template): commit lockfile after install`, [lock], {
          skipIfNoStaged: true,
        });
      }

      return {
        success: true,
      };
    } catch (error) {
      console.error('Install failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

// Step 7: Programmatic File Copy Step - copies template files to target project
const programmaticFileCopyStep = createStep({
  id: 'programmatic-file-copy',
  description: 'Programmatically copy template files to target project based on ordered units',
  inputSchema: FileCopyInputSchema,
  outputSchema: FileCopyResultSchema,
  execute: async ({ inputData, runtimeContext }) => {
    console.info('Programmatic file copy step starting...');
    const { orderedUnits, templateDir, commitSha, slug } = inputData;
    const targetPath = resolveTargetPath(inputData, runtimeContext);

    try {
      const copiedFiles: Array<{
        source: string;
        destination: string;
        unit: { kind: UnitKind; id: string };
      }> = [];

      const conflicts: Array<{
        unit: { kind: UnitKind; id: string };
        issue: string;
        sourceFile: string;
        targetFile: string;
      }> = [];

      // Analyze target project naming convention first
      const analyzeNamingConvention = async (
        directory: string,
      ): Promise<'camelCase' | 'snake_case' | 'kebab-case' | 'PascalCase' | 'unknown'> => {
        try {
          const files = await readdir(resolve(targetPath, directory), { withFileTypes: true });
          const tsFiles = files.filter(f => f.isFile() && f.name.endsWith('.ts')).map(f => f.name);

          if (tsFiles.length === 0) return 'unknown';

          // Check for patterns
          const camelCaseCount = tsFiles.filter(f => /^[a-z][a-zA-Z0-9]*\.ts$/.test(f)).length;
          const snakeCaseCount = tsFiles.filter(f => /^[a-z][a-z0-9_]*\.ts$/.test(f) && f.includes('_')).length;
          const kebabCaseCount = tsFiles.filter(f => /^[a-z][a-z0-9-]*\.ts$/.test(f) && f.includes('-')).length;
          const pascalCaseCount = tsFiles.filter(f => /^[A-Z][a-zA-Z0-9]*\.ts$/.test(f)).length;

          const max = Math.max(camelCaseCount, snakeCaseCount, kebabCaseCount, pascalCaseCount);
          if (max === 0) return 'unknown';

          if (camelCaseCount === max) return 'camelCase';
          if (snakeCaseCount === max) return 'snake_case';
          if (kebabCaseCount === max) return 'kebab-case';
          if (pascalCaseCount === max) return 'PascalCase';

          return 'unknown';
        } catch {
          return 'unknown';
        }
      };

      // Convert naming based on convention
      const convertNaming = (name: string, convention: string): string => {
        const baseName = basename(name, extname(name));
        const ext = extname(name);

        switch (convention) {
          case 'camelCase':
            return (
              baseName
                .replace(/[-_]/g, '')
                .replace(/([A-Z])/g, (match, p1, offset) => (offset === 0 ? p1.toLowerCase() : p1)) + ext
            );
          case 'snake_case':
            return (
              baseName
                .replace(/[-]/g, '_')
                .replace(/([A-Z])/g, (match, p1, offset) => (offset === 0 ? '' : '_') + p1.toLowerCase()) + ext
            );
          case 'kebab-case':
            return (
              baseName
                .replace(/[_]/g, '-')
                .replace(/([A-Z])/g, (match, p1, offset) => (offset === 0 ? '' : '-') + p1.toLowerCase()) + ext
            );
          case 'PascalCase':
            return baseName.replace(/[-_]/g, '').replace(/^[a-z]/, match => match.toUpperCase()) + ext;
          default:
            return name;
        }
      };

      // Process each unit
      for (const unit of orderedUnits) {
        console.info(`Processing ${unit.kind} unit "${unit.id}" from file "${unit.file}"`);

        // Resolve source file path with fallback logic
        let sourceFile: string;
        let resolvedUnitFile: string;

        // Check if unit.file already contains directory structure
        if (unit.file.includes('/')) {
          // unit.file has path structure (e.g., "src/mastra/agents/weatherAgent.ts")
          sourceFile = resolve(templateDir, unit.file);
          resolvedUnitFile = unit.file;
        } else {
          // unit.file is just filename (e.g., "weatherAgent.ts") - use fallback
          const folderPath =
            AgentBuilderDefaults.DEFAULT_FOLDER_STRUCTURE[
              unit.kind as keyof typeof AgentBuilderDefaults.DEFAULT_FOLDER_STRUCTURE
            ];
          if (!folderPath) {
            conflicts.push({
              unit: { kind: unit.kind, id: unit.id },
              issue: `Unknown unit kind: ${unit.kind}`,
              sourceFile: unit.file,
              targetFile: 'N/A',
            });
            continue;
          }
          resolvedUnitFile = `${folderPath}/${unit.file}`;
          sourceFile = resolve(templateDir, resolvedUnitFile);
        }

        // Check if source file exists
        if (!existsSync(sourceFile)) {
          conflicts.push({
            unit: { kind: unit.kind, id: unit.id },
            issue: `Source file not found: ${sourceFile}`,
            sourceFile: resolvedUnitFile,
            targetFile: 'N/A',
          });
          continue;
        }

        // Extract target directory from resolved unit file path
        const targetDir = dirname(resolvedUnitFile);

        // Analyze target naming convention
        const namingConvention = await analyzeNamingConvention(targetDir);
        console.info(`Detected naming convention in ${targetDir}: ${namingConvention}`);

        // Convert unit.id to target filename with proper extension
        // Note: Check if unit.id already includes extension to avoid double extensions
        const hasExtension = extname(unit.id) !== '';
        const baseId = hasExtension ? basename(unit.id, extname(unit.id)) : unit.id;
        const fileExtension = extname(unit.file);
        const convertedFileName =
          namingConvention !== 'unknown'
            ? convertNaming(baseId + fileExtension, namingConvention)
            : baseId + fileExtension;

        const targetFile = resolve(targetPath, targetDir, convertedFileName);

        // Handle file conflicts with strategy-based resolution
        if (existsSync(targetFile)) {
          const strategy = determineConflictStrategy(unit, targetFile);
          console.info(`File exists: ${convertedFileName}, using strategy: ${strategy}`);

          switch (strategy) {
            case 'skip':
              conflicts.push({
                unit: { kind: unit.kind, id: unit.id },
                issue: `File exists - skipped: ${convertedFileName}`,
                sourceFile: unit.file,
                targetFile: `${targetDir}/${convertedFileName}`,
              });
              console.info(`⏭️ Skipped ${unit.kind} "${unit.id}": file already exists`);
              continue;

            case 'backup-and-replace':
              try {
                await backupAndReplaceFile(sourceFile, targetFile);
                copiedFiles.push({
                  source: sourceFile,
                  destination: targetFile,
                  unit: { kind: unit.kind, id: unit.id },
                });
                console.info(
                  `🔄 Replaced ${unit.kind} "${unit.id}": ${unit.file} → ${convertedFileName} (backup created)`,
                );
                continue;
              } catch (backupError) {
                conflicts.push({
                  unit: { kind: unit.kind, id: unit.id },
                  issue: `Failed to backup and replace: ${backupError instanceof Error ? backupError.message : String(backupError)}`,
                  sourceFile: unit.file,
                  targetFile: `${targetDir}/${convertedFileName}`,
                });
                continue;
              }

            case 'rename':
              try {
                const uniqueTargetFile = await renameAndCopyFile(sourceFile, targetFile);
                copiedFiles.push({
                  source: sourceFile,
                  destination: uniqueTargetFile,
                  unit: { kind: unit.kind, id: unit.id },
                });
                console.info(`📝 Renamed ${unit.kind} "${unit.id}": ${unit.file} → ${basename(uniqueTargetFile)}`);
                continue;
              } catch (renameError) {
                conflicts.push({
                  unit: { kind: unit.kind, id: unit.id },
                  issue: `Failed to rename and copy: ${renameError instanceof Error ? renameError.message : String(renameError)}`,
                  sourceFile: unit.file,
                  targetFile: `${targetDir}/${convertedFileName}`,
                });
                continue;
              }

            default:
              conflicts.push({
                unit: { kind: unit.kind, id: unit.id },
                issue: `Unknown conflict strategy: ${strategy}`,
                sourceFile: unit.file,
                targetFile: `${targetDir}/${convertedFileName}`,
              });
              continue;
          }
        }

        // Ensure target directory exists
        await mkdir(dirname(targetFile), { recursive: true });

        // Copy the file
        try {
          await copyFile(sourceFile, targetFile);
          copiedFiles.push({
            source: sourceFile,
            destination: targetFile,
            unit: { kind: unit.kind, id: unit.id },
          });
          console.info(`✓ Copied ${unit.kind} "${unit.id}": ${unit.file} → ${convertedFileName}`);
        } catch (copyError) {
          conflicts.push({
            unit: { kind: unit.kind, id: unit.id },
            issue: `Failed to copy file: ${copyError instanceof Error ? copyError.message : String(copyError)}`,
            sourceFile: unit.file,
            targetFile: `${targetDir}/${convertedFileName}`,
          });
        }
      }

      // Ensure tsconfig.json exists in target by copying from template if available, else generate a minimal one
      try {
        const targetTsconfig = resolve(targetPath, 'tsconfig.json');
        if (!existsSync(targetTsconfig)) {
          const templateTsconfig = resolve(templateDir, 'tsconfig.json');
          if (existsSync(templateTsconfig)) {
            await copyFile(templateTsconfig, targetTsconfig);
            copiedFiles.push({
              source: templateTsconfig,
              destination: targetTsconfig,
              unit: { kind: 'other', id: 'tsconfig.json' },
            });
            console.info('✓ Copied tsconfig.json from template to target');
          } else {
            // Generate a minimal tsconfig.json as a fallback
            const minimalTsconfig = {
              compilerOptions: {
                target: 'ES2020',
                module: 'NodeNext',
                moduleResolution: 'NodeNext',
                strict: false,
                esModuleInterop: true,
                skipLibCheck: true,
                resolveJsonModule: true,
                outDir: 'dist',
              },
              include: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
              exclude: ['node_modules', 'dist', 'build', '.next', '.output', '.turbo'],
            } as const;

            await writeFile(targetTsconfig, JSON.stringify(minimalTsconfig, null, 2), 'utf-8');
            copiedFiles.push({
              source: '[generated tsconfig.json]',
              destination: targetTsconfig,
              unit: { kind: 'other', id: 'tsconfig.json' },
            });
            console.info('✓ Generated minimal tsconfig.json in target');
          }
        }
      } catch (e) {
        conflicts.push({
          unit: { kind: 'other', id: 'tsconfig.json' },
          issue: `Failed to ensure tsconfig.json: ${e instanceof Error ? e.message : String(e)}`,
          sourceFile: 'tsconfig.json',
          targetFile: 'tsconfig.json',
        });
      }

      // If the target project has no Mastra index file, copy from template
      try {
        const targetMastraIndex = resolve(targetPath, 'src/mastra/index.ts');
        if (!existsSync(targetMastraIndex)) {
          const templateMastraIndex = resolve(templateDir, 'src/mastra/index.ts');
          if (existsSync(templateMastraIndex)) {
            if (!existsSync(dirname(targetMastraIndex))) {
              await mkdir(dirname(targetMastraIndex), { recursive: true });
            }
            await copyFile(templateMastraIndex, targetMastraIndex);
            copiedFiles.push({
              source: templateMastraIndex,
              destination: targetMastraIndex,
              unit: { kind: 'other', id: 'mastra-index' },
            });
            console.info('✓ Copied Mastra index file from template');
          }
        }
      } catch (e) {
        conflicts.push({
          unit: { kind: 'other', id: 'mastra-index' },
          issue: `Failed to ensure Mastra index file: ${e instanceof Error ? e.message : String(e)}`,
          sourceFile: 'src/mastra/index.ts',
          targetFile: 'src/mastra/index.ts',
        });
      }

      // Handle .gitignore file merging
      try {
        const targetGitignore = resolve(targetPath, '.gitignore');
        const templateGitignore = resolve(templateDir, '.gitignore');

        const targetExists = existsSync(targetGitignore);
        const templateExists = existsSync(templateGitignore);

        if (templateExists) {
          if (!targetExists) {
            // Target has no .gitignore - copy template's completely
            await copyFile(templateGitignore, targetGitignore);
            copiedFiles.push({
              source: templateGitignore,
              destination: targetGitignore,
              unit: { kind: 'other', id: 'gitignore' },
            });
            console.info('✓ Copied .gitignore from template to target');
          } else {
            // Both exist - merge them intelligently
            const targetContent = await readFile(targetGitignore, 'utf-8');
            const templateContent = await readFile(templateGitignore, 'utf-8');

            const mergedContent = mergeGitignoreFiles(targetContent, templateContent, slug);

            if (mergedContent !== targetContent) {
              const addedLines = mergedContent.split('\n').length - targetContent.split('\n').length;
              await writeFile(targetGitignore, mergedContent, 'utf-8');
              copiedFiles.push({
                source: templateGitignore,
                destination: targetGitignore,
                unit: { kind: 'other', id: 'gitignore-merge' },
              });
              console.info(`✓ Merged template .gitignore entries into existing .gitignore (${addedLines} new entries)`);
            } else {
              console.info('ℹ No new .gitignore entries to add from template');
            }
          }
        }
      } catch (e) {
        conflicts.push({
          unit: { kind: 'other', id: 'gitignore' },
          issue: `Failed to handle .gitignore file: ${e instanceof Error ? e.message : String(e)}`,
          sourceFile: '.gitignore',
          targetFile: '.gitignore',
        });
      }

      // Handle .env file merging with template variables
      try {
        const { variables } = inputData;
        if (variables && Object.keys(variables).length > 0) {
          const targetEnv = resolve(targetPath, '.env');
          const targetExists = existsSync(targetEnv);

          if (!targetExists) {
            // Target has no .env - create new one with template variables
            const envContent = [
              `# Environment variables for ${slug}`,
              ...Object.entries(variables).map(([key, value]) => `${key}=${value}`),
            ].join('\n');

            await writeFile(targetEnv, envContent, 'utf-8');
            copiedFiles.push({
              source: '[template variables]',
              destination: targetEnv,
              unit: { kind: 'other', id: 'env' },
            });
            console.info(`✓ Created .env file with ${Object.keys(variables).length} template variables`);
          } else {
            // Both exist - merge them intelligently
            const targetContent = await readFile(targetEnv, 'utf-8');
            const mergedContent = mergeEnvFiles(targetContent, variables, slug);

            if (mergedContent !== targetContent) {
              const addedLines = mergedContent.split('\n').length - targetContent.split('\n').length;
              await writeFile(targetEnv, mergedContent, 'utf-8');
              copiedFiles.push({
                source: '[template variables]',
                destination: targetEnv,
                unit: { kind: 'other', id: 'env-merge' },
              });
              console.info(`✓ Merged new environment variables into existing .env file (${addedLines} new entries)`);
            } else {
              console.info('ℹ No new environment variables to add (all already exist in .env)');
            }
          }
        }
      } catch (e) {
        conflicts.push({
          unit: { kind: 'other', id: 'env' },
          issue: `Failed to handle .env file: ${e instanceof Error ? e.message : String(e)}`,
          sourceFile: '.env',
          targetFile: '.env',
        });
      }

      // Commit the copied files
      if (copiedFiles.length > 0) {
        try {
          const fileList = copiedFiles.map(f => f.destination);
          await gitAddAndCommit(
            targetPath,
            `feat(template): copy ${copiedFiles.length} files from ${slug}@${commitSha.substring(0, 7)}`,
            fileList,
            { skipIfNoStaged: true },
          );
          console.info(`✓ Committed ${copiedFiles.length} copied files`);
        } catch (commitError) {
          console.warn('Failed to commit copied files:', commitError);
        }
      }

      const message = `Programmatic file copy completed. Copied ${copiedFiles.length} files, ${conflicts.length} conflicts detected.`;
      console.info(message);

      return {
        success: true,
        copiedFiles,
        conflicts,
        message,
      };
    } catch (error) {
      console.error('Programmatic file copy failed:', error);

      return {
        success: false,
        copiedFiles: [],
        conflicts: [],
        message: `Programmatic file copy failed: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

// Step 9: Intelligent merging with AgentBuilder
const intelligentMergeStep = createStep({
  id: 'intelligent-merge',
  description: 'Use AgentBuilder to intelligently merge template files',
  inputSchema: IntelligentMergeInputSchema,
  outputSchema: IntelligentMergeResultSchema,
  execute: async ({ inputData, runtimeContext }) => {
    console.info('Intelligent merge step starting...');
    const { conflicts, copiedFiles, commitSha, slug, templateDir, branchName } = inputData;
    const targetPath = resolveTargetPath(inputData, runtimeContext);
    try {
      const model = await resolveModel({ runtimeContext, projectPath: targetPath, defaultModel: openai('gpt-4.1') });

      // Create copyFile tool for edge cases
      const copyFileTool = createTool({
        id: 'copy-file',
        description:
          'Copy a file from template to target project (use only for edge cases - most files are already copied programmatically).',
        inputSchema: z.object({
          sourcePath: z.string().describe('Path to the source file relative to template directory'),
          destinationPath: z.string().describe('Path to the destination file relative to target project'),
        }),
        outputSchema: z.object({
          success: z.boolean(),
          message: z.string(),
          error: z.string().optional(),
        }),
        execute: async ({ context }) => {
          try {
            const { sourcePath, destinationPath } = context;

            // Use templateDir directly from input
            const resolvedSourcePath = resolve(templateDir, sourcePath);
            const resolvedDestinationPath = resolve(targetPath, destinationPath);

            if (existsSync(resolvedSourcePath) && !existsSync(dirname(resolvedDestinationPath))) {
              await mkdir(dirname(resolvedDestinationPath), { recursive: true });
            }

            await copyFile(resolvedSourcePath, resolvedDestinationPath);
            return {
              success: true,
              message: `Successfully copied file from ${sourcePath} to ${destinationPath}`,
            };
          } catch (error) {
            return {
              success: false,
              message: `Failed to copy file: ${error instanceof Error ? error.message : String(error)}`,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        },
      });

      // Initialize AgentBuilder for merge and registration
      const agentBuilder = new AgentBuilder({
        projectPath: targetPath,
        mode: 'template',
        model,
        instructions: `
You are an expert at integrating Mastra template components into existing projects.

CRITICAL CONTEXT:
- Files have been programmatically copied from template to target project
- Your job is to handle integration issues, registration, and validation

FILES SUCCESSFULLY COPIED:
${JSON.stringify(copiedFiles, null, 2)}

CONFLICTS TO RESOLVE:
${JSON.stringify(conflicts, null, 2)}

CRITICAL INSTRUCTIONS:
1. **Package management**: NO need to install packages (already handled by package merge step)
2. **File copying**: Most files are already copied programmatically. Only use copyFile tool for edge cases where additional files are needed for conflict resolution

KEY RESPONSIBILITIES:
1. Resolve any conflicts from the programmatic copy step
2. Register components in existing Mastra index file (agents, workflows, networks, mcp-servers)
3. DO NOT register tools in existing Mastra index file - tools should remain standalone
4. Copy additional files ONLY if needed for conflict resolution

MASTRA INDEX FILE HANDLING (src/mastra/index.ts):
1. **Verify the file exists**
   - Call readFile
   - If it fails with ENOENT (or listDirectory shows it missing) -> copyFile the template version to src/mastra/index.ts, then confirm it now exists
   - Always verify after copying that the file exists and is accessible

2. **Edit the file**
   - Always work with the full file content
   - Generate the complete, correct source (imports, anchors, registrations, formatting)
   - Keep existing registrations intact and maintain file structure
   - Ensure proper spacing and organization of new additions

3. **Handle anchors and structure**
   - When generating new content, ensure you do not duplicate existing imports or object entries
   - If required anchors (e.g., agents: {}) are missing, add them while generating the new content
   - Add missing anchors just before the closing brace of the Mastra config
   - Do not restructure or reorder existing anchors and registrations

CRITICAL: ALWAYS use writeFile to update the mastra/index.ts file when needed to register new components.

MASTRA-SPECIFIC REGISTRATION:
- Agents: Register in existing Mastra index file
- Workflows: Register in existing Mastra index file
- Networks: Register in existing Mastra index file
- MCP servers: Register in existing Mastra index file
- Tools: Copy to ${AgentBuilderDefaults.DEFAULT_FOLDER_STRUCTURE.tool} but DO NOT register in existing Mastra index file
- If an anchor (e.g., "agents: {") is not found, avoid complex restructuring; instead, insert the missing anchor on a new line (e.g., add "agents: {" just before the closing brace of the Mastra config) and then proceed with the other registrations.

CONFLICT RESOLUTION AND FILE COPYING:
- Only copy files if needed to resolve specific conflicts
- When copying files from template:
  - Ensure you get the right file name and path
  - Verify the destination directory exists
  - Maintain the same relative path structure
  - Only copy files that are actually needed
- Preserve existing functionality when resolving conflicts
- Focus on registration and conflict resolution, validation will happen in a later step

Template information:
- Slug: ${slug}
- Commit: ${commitSha.substring(0, 7)}
- Branch: ${branchName}
`,
        tools: {
          copyFile: copyFileTool,
        },
      });

      // Create task list for systematic processing
      const tasks = [];

      // Add conflict resolution tasks
      conflicts.forEach(conflict => {
        tasks.push({
          id: `conflict-${conflict.unit.kind}-${conflict.unit.id}`,
          content: `Resolve conflict: ${conflict.issue}`,
          status: 'pending' as const,
          priority: 'high' as const,
          notes: `Unit: ${conflict.unit.kind}:${conflict.unit.id}, Issue: ${conflict.issue}, Source: ${conflict.sourceFile}, Target: ${conflict.targetFile}`,
        });
      });

      // Add registration tasks for successfully copied files
      const registrableKinds = new Set(['agent', 'workflow', 'network', 'mcp-server']);
      const registrableFiles = copiedFiles.filter(f => registrableKinds.has(f.unit.kind as any));
      const targetMastraIndex = resolve(targetPath, 'src/mastra/index.ts');
      const mastraIndexExists = existsSync(targetMastraIndex);
      console.info(`Mastra index exists: ${mastraIndexExists} at ${targetMastraIndex}`);
      console.info(
        'Registrable components:',
        registrableFiles.map(f => `${f.unit.kind}:${f.unit.id}`),
      );
      if (registrableFiles.length > 0) {
        tasks.push({
          id: 'register-components',
          content: `Register ${registrableFiles.length} components in existing Mastra index file (src/mastra/index.ts)`,
          status: 'pending' as const,
          priority: 'medium' as const,
          dependencies: conflicts.length > 0 ? conflicts.map(c => `conflict-${c.unit.kind}-${c.unit.id}`) : undefined,
          notes: `Components to register: ${registrableFiles.map(f => `${f.unit.kind}:${f.unit.id}`).join(', ')}`,
        });
      }

      // Note: Validation is handled by the dedicated validation step, not here

      console.info(`Creating task list with ${tasks.length} tasks...`);
      await AgentBuilderDefaults.manageTaskList({ action: 'create', tasks });

      // Log git state before merge operations
      await logGitState(targetPath, 'before intelligent merge');

      const prompt = `
You need to work through a task list to complete the template integration.

CRITICAL INSTRUCTIONS:

**STEP 1: GET YOUR TASK LIST**
1. Use manageTaskList tool with action "list" to see all pending tasks
2. Work through tasks in dependency order (complete dependencies first)

**STEP 2: PROCESS EACH TASK SYSTEMATICALLY**
For each task:
1. Use manageTaskList to mark the current task as 'in_progress'
2. Complete the task according to its requirements
3. Use manageTaskList to mark the task as 'completed' when done
4. Continue until all tasks are completed

**TASK TYPES AND REQUIREMENTS:**

**Conflict Resolution Tasks:**
- Analyze the specific conflict and determine best resolution strategy
- For file name conflicts: merge content or rename appropriately
- For missing files: investigate and copy if needed
- For other issues: apply appropriate fixes

**Component Registration Task:**
- Update main Mastra instance file to register new components
- Only register: agents, workflows, networks, mcp-servers
- DO NOT register tools in main config
- Ensure proper import paths and naming conventions

**COMMIT STRATEGY:**
- After resolving conflicts: "feat(template): resolve conflicts for ${slug}@${commitSha.substring(0, 7)}"
- After registration: "feat(template): register components from ${slug}@${commitSha.substring(0, 7)}"

**CRITICAL NOTES:**
- Template source: ${templateDir}
- Target project: ${targetPath}
- Focus ONLY on conflict resolution and component registration
- Use executeCommand for git commits after each task
- DO NOT perform validation - that's handled by the dedicated validation step

Start by listing your tasks and work through them systematically!
`;

      // Process tasks systematically
      const isV2 = model.specificationVersion === 'v2';
      const result = isV2 ? await agentBuilder.streamVNext(prompt) : await agentBuilder.stream(prompt);

      // Extract actual conflict resolution details from agent execution
      const actualResolutions: Array<{
        taskId: string;
        action: string;
        status: string;
        content: string;
        notes?: string;
      }> = [];

      for await (const chunk of result.fullStream) {
        if (chunk.type === 'step-finish' || chunk.type === 'step-start') {
          const chunkData = 'payload' in chunk ? chunk.payload : chunk;
          console.info({
            type: chunk.type,
            msgId: chunkData.messageId,
          });
        } else {
          console.info(JSON.stringify(chunk, null, 2));

          // Extract task management tool results
          if (chunk.type === 'tool-result') {
            const chunkData = 'payload' in chunk ? chunk.payload : chunk;
            if (chunkData.toolName === 'manageTaskList') {
              try {
                const toolResult = chunkData.result;
                if (toolResult.action === 'update' && toolResult.status === 'completed') {
                  actualResolutions.push({
                    taskId: toolResult.taskId || '',
                    action: toolResult.action,
                    status: toolResult.status,
                    content: toolResult.content || '',
                    notes: toolResult.notes,
                  });
                  console.info(`📋 Task completed: ${toolResult.taskId} - ${toolResult.content}`);
                }
              } catch (parseError) {
                console.warn('Failed to parse task management result:', parseError);
              }
            }
          }
        }
      }

      // Log git state after merge operations
      await logGitState(targetPath, 'after intelligent merge');

      // Map actual resolutions back to conflicts
      const conflictResolutions = conflicts.map(conflict => {
        const taskId = `conflict-${conflict.unit.kind}-${conflict.unit.id}`;
        const actualResolution = actualResolutions.find(r => r.taskId === taskId);

        if (actualResolution) {
          return {
            unit: conflict.unit,
            issue: conflict.issue,
            resolution:
              actualResolution.notes ||
              actualResolution.content ||
              `Completed: ${conflict.unit.kind} ${conflict.unit.id}`,
            actualWork: true,
          };
        } else {
          return {
            unit: conflict.unit,
            issue: conflict.issue,
            resolution: `No specific resolution found for ${conflict.unit.kind} ${conflict.unit.id}`,
            actualWork: false,
          };
        }
      });

      await gitAddAndCommit(targetPath, `feat(template): apply intelligent merge for ${slug}`, undefined, {
        skipIfNoStaged: true,
      });

      return {
        success: true,
        applied: true,
        message: `Successfully resolved ${conflicts.length} conflicts from template ${slug}`,
        conflictsResolved: conflictResolutions,
      };
    } catch (error) {
      return {
        success: false,
        applied: false,
        message: `Failed to resolve conflicts: ${error instanceof Error ? error.message : String(error)}`,
        conflictsResolved: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

// Step 10: Validation and Fix Step - validates merged code and fixes any issues
const validationAndFixStep = createStep({
  id: 'validation-and-fix',
  description: 'Validate the merged template code and fix any issues using a specialized agent',
  inputSchema: ValidationFixInputSchema,
  outputSchema: ValidationFixResultSchema,
  execute: async ({ inputData, runtimeContext }) => {
    console.info('Validation and fix step starting...');
    const { commitSha, slug, orderedUnits, templateDir, copiedFiles, conflictsResolved, maxIterations = 5 } = inputData;
    const targetPath = resolveTargetPath(inputData, runtimeContext);

    // Skip validation if no changes were made
    const hasChanges = copiedFiles.length > 0 || (conflictsResolved && conflictsResolved.length > 0);
    if (!hasChanges) {
      console.info('⏭️ Skipping validation - no files copied or conflicts resolved');
      return {
        success: true,
        applied: false,
        message: 'No changes to validate - template already integrated or no conflicts resolved',
        validationResults: {
          valid: true,
          errorsFixed: 0,
          remainingErrors: 0,
        },
      };
    }

    console.info(
      `📋 Changes detected: ${copiedFiles.length} files copied, ${conflictsResolved?.length || 0} conflicts resolved`,
    );

    let currentIteration = 1; // Declare at function scope for error handling

    try {
      const model = await resolveModel({ runtimeContext, projectPath: targetPath, defaultModel: openai('gpt-4.1') });

      const allTools = await AgentBuilderDefaults.getToolsForMode(targetPath, 'template');

      const validationAgent = new Agent({
        name: 'code-validator-fixer',
        description: 'Specialized agent for validating and fixing template integration issues',
        instructions: `You are a code validation and fixing specialist. Your job is to:

1. **Run comprehensive validation** using the validateCode tool to check for:
   - TypeScript compilation errors
   - ESLint issues
   - Import/export problems
   - Missing dependencies
   - Index file structure and exports
   - Component registration correctness
   - Naming convention compliance

2. **Fix validation errors systematically**:
   - Use readFile to examine files with errors
   - Use multiEdit for simple search-replace fixes (single line changes)
   - Use replaceLines for complex multiline fixes (imports, function signatures, etc.)
   - Use listDirectory to understand project structure when fixing import paths
   - Update file contents to resolve TypeScript and linting issues

3. **Choose the right tool for the job**:
   - multiEdit: Simple replacements, single line changes, small fixes
   - replaceLines: Multiline imports, function signatures, complex code blocks
   - writeFile: ONLY for creating new files (never overwrite existing)

4. **Create missing files ONLY when necessary**:
   - Use writeFile ONLY for creating NEW files that don't exist
   - NEVER overwrite existing files - use multiEdit or replaceLines instead
   - Common cases: missing barrel files (index.ts), missing config files, missing type definitions
   - Always check with readFile first to ensure file doesn't exist

5. **Fix ALL template integration issues**:
   - Fix import path issues in copied files
   - Ensure TypeScript imports and exports are correct
   - Validate integration works properly
   - Fix files copied with new names based on unit IDs
   - Update original template imports that reference old filenames
   - Fix missing imports in index files
   - Fix incorrect file paths in imports
   - Fix type mismatches after integration
   - Fix missing exports in barrel files
   - Use the COPIED FILES mapping below to fix import paths
   - Fix any missing dependencies or module resolution issues

6. **Validate index file structure**:
   - Correct imports for all components
   - Proper anchor structure (agents: {}, etc.)
   - No duplicate registrations
   - Correct export names and paths
   - Proper formatting and organization

7. **Follow naming conventions**:
   Import paths:
   - camelCase: import { myAgent } from './myAgent'
   - snake_case: import { myAgent } from './my_agent'
   - kebab-case: import { myAgent } from './my-agent'
   - PascalCase: import { MyAgent } from './MyAgent'

   File names:
   - camelCase: weatherAgent.ts, chatAgent.ts
   - snake_case: weather_agent.ts, chat_agent.ts
   - kebab-case: weather-agent.ts, chat-agent.ts
   - PascalCase: WeatherAgent.ts, ChatAgent.ts

   Key Rule: Keep variable/export names unchanged, only adapt file names and import paths

8. **Re-validate after fixes** to ensure all issues are resolved

CRITICAL: Always validate the entire project first to get a complete picture of issues, then fix them systematically, and re-validate to confirm fixes worked.

CRITICAL TOOL SELECTION GUIDE:
- **multiEdit**: Use for simple string replacements, single-line changes
  Example: changing './oldPath' to './newPath'
  
- **replaceLines**: Use for multiline fixes, complex code structures
  Example: fixing multiline imports, function signatures, or code blocks
  Usage: replaceLines({ filePath: 'file.ts', startLine: 5, endLine: 8, newContent: 'new multiline content' })
  
- **writeFile**: ONLY for creating new files that don't exist
  Example: creating missing index.ts barrel files

CRITICAL WRITEFILЕ SAFETY RULES:
- ONLY use writeFile for creating NEW files that don't exist
- ALWAYS check with readFile first to verify file doesn't exist
- NEVER use writeFile to overwrite existing files - use multiEdit or replaceLines instead
- Common valid uses: missing index.ts barrel files, missing type definitions, missing config files

CRITICAL IMPORT PATH RESOLUTION:
The following files were copied from template with new names:
${JSON.stringify(copiedFiles, null, 2)}

When fixing import errors:
1. Check if the missing module corresponds to a copied file
2. Use listDirectory to verify actual filenames in target directories
3. Update import paths to match the actual copied filenames
4. Ensure exported variable names match what's being imported

EXAMPLE: If error shows "Cannot find module './tools/download-csv-tool'" but a file was copied as "csv-fetcher-tool.ts", update the import to "./tools/csv-fetcher-tool"

${conflictsResolved ? `CONFLICTS RESOLVED BY INTELLIGENT MERGE:\n${JSON.stringify(conflictsResolved, null, 2)}\n` : ''}

INTEGRATED UNITS:
${JSON.stringify(orderedUnits, null, 2)}

Be thorough and methodical. Always use listDirectory to verify actual file existence before fixing imports.`,
        model,
        tools: {
          validateCode: allTools.validateCode,
          readFile: allTools.readFile,
          writeFile: allTools.writeFile,
          multiEdit: allTools.multiEdit,
          replaceLines: allTools.replaceLines,
          listDirectory: allTools.listDirectory,
          executeCommand: allTools.executeCommand,
        },
      });

      console.info('Starting validation and fix agent with internal loop...');

      let validationResults = {
        valid: false,
        errorsFixed: 0,
        remainingErrors: 1, // Start with 1 to enter the loop
        iteration: currentIteration,
        lastValidationErrors: [] as any[], // Store the actual error details
      };

      // Loop up to maxIterations times or until all errors are fixed
      while (validationResults.remainingErrors > 0 && currentIteration <= maxIterations) {
        console.info(`\n=== Validation Iteration ${currentIteration} ===`);

        const iterationPrompt =
          currentIteration === 1
            ? `Please validate the template integration and fix any errors found in the project at ${targetPath}. The template "${slug}" (${commitSha.substring(0, 7)}) was just integrated and may have validation issues that need fixing.

Start by running validateCode with all validation types to get a complete picture of any issues, then systematically fix them.`
            : `Continue validation and fixing for the template integration at ${targetPath}. This is iteration ${currentIteration} of validation.

Previous iterations may have fixed some issues, so start by re-running validateCode to see the current state, then fix any remaining issues.`;

        const isV2 = model.specificationVersion === 'v2';
        const output = z.object({ success: z.boolean() });
        const result = isV2
          ? await validationAgent.streamVNext(iterationPrompt, {
              output,
            })
          : await validationAgent.stream(iterationPrompt, {
              experimental_output: output,
            });

        let iterationErrors = 0;
        let previousErrors = validationResults.remainingErrors;
        let lastValidationResult: any = null;

        for await (const chunk of result.fullStream) {
          if (chunk.type === 'step-finish' || chunk.type === 'step-start') {
            const chunkData = 'payload' in chunk ? chunk.payload : chunk;
            console.info({
              type: chunk.type,
              msgId: chunkData.messageId,
              iteration: currentIteration,
            });
          } else {
            console.info(JSON.stringify(chunk, null, 2));
          }
          if (chunk.type === 'tool-result') {
            // Track validation results
            const chunkData = 'payload' in chunk ? chunk.payload : chunk;
            if (chunkData.toolName === 'validateCode') {
              const toolResult = chunkData.result;
              lastValidationResult = toolResult; // Store the full result
              if (toolResult?.summary) {
                iterationErrors = toolResult.summary.totalErrors || 0;
                console.info(`Iteration ${currentIteration}: Found ${iterationErrors} errors`);
              }
            }
          }
        }

        // Update results for this iteration
        validationResults.remainingErrors = iterationErrors;
        validationResults.errorsFixed += Math.max(0, previousErrors - iterationErrors);
        validationResults.valid = iterationErrors === 0;
        validationResults.iteration = currentIteration;

        // Store the last validation errors if any remain
        if (iterationErrors > 0 && lastValidationResult?.errors) {
          validationResults.lastValidationErrors = lastValidationResult.errors;
        }

        console.info(`Iteration ${currentIteration} complete: ${iterationErrors} errors remaining`);

        // Break if no errors or max iterations reached
        if (iterationErrors === 0) {
          console.info(`✅ All validation issues resolved in ${currentIteration} iterations!`);
          break;
        } else if (currentIteration >= maxIterations) {
          console.info(`⚠️  Max iterations (${maxIterations}) reached. ${iterationErrors} errors still remaining.`);
          break;
        }

        currentIteration++;
      }

      // Commit the validation fixes
      try {
        await gitAddAndCommit(
          targetPath,
          `fix(template): resolve validation errors for ${slug}@${commitSha.substring(0, 7)}`,
          undefined,
          {
            skipIfNoStaged: true,
          },
        );
      } catch (commitError) {
        console.warn('Failed to commit validation fixes:', commitError);
      }

      const success = validationResults.valid;

      return {
        success,
        applied: true,
        message: `Validation completed in ${currentIteration} iteration${currentIteration > 1 ? 's' : ''}. ${validationResults.valid ? 'All issues resolved!' : `${validationResults.remainingErrors} issue${validationResults.remainingErrors > 1 ? 's' : ''} remaining`}`,
        validationResults: {
          valid: validationResults.valid,
          errorsFixed: validationResults.errorsFixed,
          remainingErrors: validationResults.remainingErrors,
          errors: validationResults.lastValidationErrors,
        },
      };
    } catch (error) {
      console.error('Validation and fix failed:', error);
      return {
        success: false,
        applied: false,
        message: `Validation and fix failed: ${error instanceof Error ? error.message : String(error)}`,
        validationResults: {
          valid: false,
          errorsFixed: 0,
          remainingErrors: -1,
        },
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      // Cleanup template directory
      try {
        await rm(templateDir, { recursive: true, force: true });
        console.info(`✓ Cleaned up template directory: ${templateDir}`);
      } catch (cleanupError) {
        console.warn('Failed to cleanup template directory:', cleanupError);
      }
    }
  },
});

// Create the complete workflow
export const agentBuilderTemplateWorkflow = createWorkflow({
  id: 'agent-builder-template',
  description:
    'Merges a Mastra template repository into the current project using intelligent AgentBuilder-powered merging',
  inputSchema: AgentBuilderInputSchema,
  outputSchema: ApplyResultSchema,
  steps: [
    cloneTemplateStep,
    analyzePackageStep,
    discoverUnitsStep,
    orderUnitsStep,
    packageMergeStep,
    installStep,
    programmaticFileCopyStep,
    intelligentMergeStep,
    validationAndFixStep,
  ],
})
  .then(cloneTemplateStep)
  .map(async ({ getStepResult }) => {
    const cloneResult = getStepResult(cloneTemplateStep);

    // Check for failure in clone step
    if (shouldAbortWorkflow(cloneResult)) {
      throw new Error(`Critical failure in clone step: ${cloneResult.error}`);
    }

    return cloneResult;
  })
  .parallel([analyzePackageStep, discoverUnitsStep])
  .map(async ({ getStepResult }) => {
    const analyzeResult = getStepResult(analyzePackageStep);
    const discoverResult = getStepResult(discoverUnitsStep);

    // Check for failures in parallel steps
    if (shouldAbortWorkflow(analyzeResult)) {
      throw new Error(`Failure in analyze package step: ${analyzeResult.error || 'Package analysis failed'}`);
    }

    if (shouldAbortWorkflow(discoverResult)) {
      throw new Error(`Failure in discover units step: ${discoverResult.error || 'Unit discovery failed'}`);
    }

    return discoverResult;
  })
  .then(orderUnitsStep)
  .map(async ({ getStepResult, getInitData }) => {
    const cloneResult = getStepResult(cloneTemplateStep);
    const initData = getInitData();
    return {
      commitSha: cloneResult.commitSha,
      slug: cloneResult.slug,
      targetPath: initData.targetPath,
    };
  })
  .then(prepareBranchStep)
  .map(async ({ getStepResult, getInitData }) => {
    const cloneResult = getStepResult(cloneTemplateStep);
    const packageResult = getStepResult(analyzePackageStep);
    const initData = getInitData();
    return {
      commitSha: cloneResult.commitSha,
      slug: cloneResult.slug,
      targetPath: initData.targetPath,
      packageInfo: packageResult,
    };
  })
  .then(packageMergeStep)
  .map(async ({ getInitData }) => {
    const initData = getInitData();
    return {
      targetPath: initData.targetPath,
    };
  })
  .then(installStep)
  .map(async ({ getStepResult, getInitData }) => {
    const cloneResult = getStepResult(cloneTemplateStep);
    const orderResult = getStepResult(orderUnitsStep);
    const installResult = getStepResult(installStep);
    const initData = getInitData();

    if (shouldAbortWorkflow(installResult)) {
      throw new Error(`Failure in install step: ${installResult.error || 'Install failed'}`);
    }
    return {
      orderedUnits: orderResult.orderedUnits,
      templateDir: cloneResult.templateDir,
      commitSha: cloneResult.commitSha,
      slug: cloneResult.slug,
      targetPath: initData.targetPath,
      variables: initData.variables,
    };
  })
  .then(programmaticFileCopyStep)
  .map(async ({ getStepResult, getInitData }) => {
    const copyResult = getStepResult(programmaticFileCopyStep);
    const cloneResult = getStepResult(cloneTemplateStep);
    const initData = getInitData();

    return {
      conflicts: copyResult.conflicts,
      copiedFiles: copyResult.copiedFiles,
      commitSha: cloneResult.commitSha,
      slug: cloneResult.slug,
      targetPath: initData.targetPath,
      templateDir: cloneResult.templateDir,
    };
  })
  .then(intelligentMergeStep)
  .map(async ({ getStepResult, getInitData }) => {
    const cloneResult = getStepResult(cloneTemplateStep);
    const orderResult = getStepResult(orderUnitsStep);
    const copyResult = getStepResult(programmaticFileCopyStep);
    const mergeResult = getStepResult(intelligentMergeStep);
    const initData = getInitData();

    return {
      commitSha: cloneResult.commitSha,
      slug: cloneResult.slug,
      targetPath: initData.targetPath,
      templateDir: cloneResult.templateDir,
      orderedUnits: orderResult.orderedUnits,
      copiedFiles: copyResult.copiedFiles,
      conflictsResolved: mergeResult.conflictsResolved,
    };
  })
  .then(validationAndFixStep)
  .map(async ({ getStepResult }) => {
    const cloneResult = getStepResult(cloneTemplateStep);
    const analyzeResult = getStepResult(analyzePackageStep);
    const discoverResult = getStepResult(discoverUnitsStep);
    const orderResult = getStepResult(orderUnitsStep);
    const prepareBranchResult = getStepResult(prepareBranchStep);
    const packageMergeResult = getStepResult(packageMergeStep);
    const installResult = getStepResult(installStep);
    const copyResult = getStepResult(programmaticFileCopyStep);
    const intelligentMergeResult = getStepResult(intelligentMergeStep);
    const validationResult = getStepResult(validationAndFixStep);

    const branchName = prepareBranchResult.branchName;

    // Aggregate errors from all steps
    const allErrors = [
      cloneResult.error,
      analyzeResult.error,
      discoverResult.error,
      orderResult.error,
      prepareBranchResult.error,
      packageMergeResult.error,
      installResult.error,
      copyResult.error,
      intelligentMergeResult.error,
      validationResult.error,
    ].filter(Boolean);

    // Determine overall success based on all step results
    const overallSuccess =
      cloneResult.success !== false &&
      analyzeResult.success !== false &&
      discoverResult.success !== false &&
      orderResult.success !== false &&
      prepareBranchResult.success !== false &&
      packageMergeResult.success !== false &&
      installResult.success !== false &&
      copyResult.success !== false &&
      intelligentMergeResult.success !== false &&
      validationResult.success !== false;

    // Create comprehensive message
    const messages = [];
    if (copyResult.copiedFiles?.length > 0) {
      messages.push(`${copyResult.copiedFiles.length} files copied`);
    }
    if (copyResult.conflicts?.length > 0) {
      messages.push(`${copyResult.conflicts.length} conflicts skipped`);
    }
    if (intelligentMergeResult.conflictsResolved?.length > 0) {
      messages.push(`${intelligentMergeResult.conflictsResolved.length} conflicts resolved`);
    }
    if (validationResult.validationResults?.errorsFixed > 0) {
      messages.push(`${validationResult.validationResults.errorsFixed} validation errors fixed`);
    }

    if (validationResult.validationResults?.remainingErrors > 0) {
      messages.push(`${validationResult.validationResults.remainingErrors} validation issues remain`);
    }

    const comprehensiveMessage =
      messages.length > 0
        ? `Template merge completed: ${messages.join(', ')}`
        : validationResult.message || 'Template merge completed';

    return {
      success: overallSuccess,
      applied: validationResult.applied || copyResult.copiedFiles?.length > 0 || false,
      message: comprehensiveMessage,
      validationResults: validationResult.validationResults,
      error: allErrors.length > 0 ? allErrors.join('; ') : undefined,
      errors: allErrors.length > 0 ? allErrors : undefined,
      branchName,
      // Additional debugging info
      stepResults: {
        cloneSuccess: cloneResult.success,
        analyzeSuccess: analyzeResult.success,
        discoverSuccess: discoverResult.success,
        orderSuccess: orderResult.success,
        prepareBranchSuccess: prepareBranchResult.success,
        packageMergeSuccess: packageMergeResult.success,
        installSuccess: installResult.success,
        copySuccess: copyResult.success,
        mergeSuccess: intelligentMergeResult.success,
        validationSuccess: validationResult.success,
        filesCopied: copyResult.copiedFiles?.length || 0,
        conflictsSkipped: copyResult.conflicts?.length || 0,
        conflictsResolved: intelligentMergeResult.conflictsResolved?.length || 0,
      },
    };
  })
  .commit();

// Helper to merge a template by slug
export async function mergeTemplateBySlug(slug: string, targetPath?: string) {
  const template = await getMastraTemplate(slug);
  const run = await agentBuilderTemplateWorkflow.createRunAsync();
  return await run.start({
    inputData: {
      repo: template.githubUrl,
      slug: template.slug,
      targetPath,
    },
  });
}

// Helper function to determine conflict resolution strategy
const determineConflictStrategy = (
  _unit: { kind: string; id: string },
  _targetFile: string,
): 'skip' | 'backup-and-replace' | 'rename' => {
  // For now, always skip conflicts to avoid disrupting existing files
  // TODO: Enable advanced strategies based on user feedback
  return 'skip';

  // Future logic (currently disabled):
  // if (['agent', 'workflow', 'network'].includes(unit.kind)) {
  //   return 'backup-and-replace';
  // }
  // if (unit.kind === 'tool') {
  //   return 'rename';
  // }
  // return 'backup-and-replace';
};

// Helper function to check if a step result indicates a failure
const shouldAbortWorkflow = (stepResult: any): boolean => {
  return stepResult?.success === false || stepResult?.error;
};
