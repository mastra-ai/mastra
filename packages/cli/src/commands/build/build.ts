import { join } from 'node:path';
import { getDeployer } from '@mastra/deployer';
import { prepareFsAgentsEntry, writeFsAgentsEntry, mirrorFsAgentWorkspaces } from '@mastra/deployer/build';
import { checkMastraPeerDeps, logPeerDepWarnings } from '../../utils/check-peer-deps';
import { findMastraEntryFile } from '../../utils/find-mastra-entry';
import { createLogger } from '../../utils/logger';
import { getMastraPackages } from '../../utils/mastra-packages';
import { computeSourceHash, writeBuildManifest } from '../../utils/source-hash';
import { BuildBundler } from './BuildBundler';

export async function build({
  dir,
  tools,
  root,
  studio,
  debug,
}: {
  dir?: string;
  tools?: string[];
  root?: string;
  studio?: boolean;
  debug: boolean;
}) {
  const rootDir = root || process.cwd();
  const mastraDir = dir ? (dir.startsWith('/') ? dir : join(rootDir, dir)) : join(rootDir, 'src', 'mastra');
  const outputDirectory = join(rootDir, '.mastra');
  const logger = createLogger(debug);

  // Check for peer dependency version mismatches
  const mastraPackages = await getMastraPackages(rootDir);
  const peerDepMismatches = await checkMastraPeerDeps(mastraPackages);
  logPeerDepWarnings(peerDepMismatches);

  try {
    // Look for the user's mastra entry file. When it doesn't exist (fully
    // file-based project), prepareFsAgentsEntry auto-constructs a Mastra
    // instance from discovered primitives.
    const mastraEntryFile = findMastraEntryFile(mastraDir);

    // Discover fs-routed agents under agents/* and, if any exist, wrap the entry
    // so they are registered onto the user's mastra instance during the build.
    const fsAgents = await prepareFsAgentsEntry(mastraDir, mastraEntryFile, outputDirectory);
    const bundleEntryFile = fsAgents.entryFile;

    if (fsAgents.standalone) {
      logger.info('No index.ts found — auto-constructing Mastra instance from file-based primitives.');
    }

    const platformDeployer = mastraEntryFile ? await getDeployer(mastraEntryFile, outputDirectory) : undefined;

    if (!platformDeployer) {
      const deployer = new BuildBundler({ studio });
      deployer.__setLogger(logger);

      // Use the bundler's getAllToolPaths method to prepare tools paths, plus
      // any tools defined under agents/*/tools for fs-routed agents.
      const discoveredTools = deployer.getAllToolPaths(mastraDir, [...(tools ?? []), ...fsAgents.toolPaths]);

      await deployer.prepare(outputDirectory);
      // Write the fs-routed agents wrapper after prepare() empties the output
      // directory, so it survives for the bundler. No-op when none are found.
      await writeFsAgentsEntry(fsAgents);
      await deployer.bundle(bundleEntryFile, outputDirectory, {
        toolsPaths: discoveredTools,
        projectRoot: rootDir,
      });

      // Mirror authored `agents/<name>/workspace/**` seeds into the bundle so
      // fs-routed agents start with those files on disk.
      await mirrorFsAgentWorkspaces(mastraDir, join(outputDirectory, 'output'));

      // Write build manifest with source hash for staleness detection
      const sourceHash = await computeSourceHash(rootDir, mastraDir);
      await writeBuildManifest(outputDirectory, sourceHash);

      logger.info('Build successful, you can now deploy the .mastra/output directory to your target platform.');
      if (studio) {
        logger.info(
          'To start the server with studio, run: MASTRA_STUDIO_PATH=.mastra/output/studio node .mastra/output/index.mjs',
        );
      } else {
        logger.info('To start the server, run: node .mastra/output/index.mjs');
      }
      return;
    }

    logger.info('Deployer found, preparing deployer build...');

    platformDeployer.__setLogger(logger);

    const discoveredTools = platformDeployer.getAllToolPaths(mastraDir, [...(tools ?? []), ...fsAgents.toolPaths]);

    await platformDeployer.prepare(outputDirectory);
    // Write the fs-routed agents wrapper after prepare() empties the output
    // directory, so it survives for the bundler. No-op when none are found.
    await writeFsAgentsEntry(fsAgents);
    await platformDeployer.bundle(bundleEntryFile, outputDirectory, {
      toolsPaths: discoveredTools,
      projectRoot: rootDir,
    });

    // Mirror authored `agents/<name>/workspace/**` seeds into the bundle so
    // fs-routed agents start with those files on disk.
    await mirrorFsAgentWorkspaces(mastraDir, join(outputDirectory, 'output'));

    // Write build manifest with source hash for staleness detection
    const sourceHash = await computeSourceHash(rootDir, mastraDir);
    await writeBuildManifest(outputDirectory, sourceHash);

    // Push-style deployers (e.g. sandbox deploys) opt in to deploying as part
    // of the build. Platform deployers deploy via their own tooling instead.
    if (platformDeployer.deployOnBuild) {
      await platformDeployer.deploy(outputDirectory);
      return;
    }

    logger.info('You can now deploy the .mastra/output directory to your target platform.');
  } catch (error) {
    try {
      const { MastraError } = await import('@mastra/core/error');
      if (error instanceof MastraError) {
        const { message, ...details } = error.toJSONDetails();
        logger.error(message, details);
      } else if (error instanceof Error) {
        logger.error(`Mastra Build failed: ${error.message}`, { stack: error.stack });
      }
    } catch {
      if (error instanceof Error) {
        logger.error(`Mastra Build failed: ${error.message}`, { stack: error.stack });
      }
    }
    process.exit(1);
  }
}
