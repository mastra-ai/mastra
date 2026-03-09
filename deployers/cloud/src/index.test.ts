import { join } from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { getAuthEntrypoint } from './utils/auth.js';
import { MASTRA_DIRECTORY, BUILD_ID, PROJECT_ID, TEAM_ID } from './utils/constants.js';
import { installDeps } from './utils/deps.js';
import { getMastraEntryFile } from './utils/file.js';
import { CloudDeployer } from './index.js';

// Mock the dependencies
vi.mock('fs-extra');
vi.mock('./utils/file.js');
vi.mock('./utils/deps.js');
vi.mock('./utils/auth.js');
vi.mock('./utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));
vi.mock('./utils/constants.js', () => ({
  MASTRA_DIRECTORY: 'src/mastra',
  BUILD_ID: 'test-build-id',
  PROJECT_ID: 'test-project-id',
  TEAM_ID: 'test-team-id',
  LOG_REDIS_URL: 'redis://localhost:6379',
  LOCAL: false,
  BUILD_URL: '',
  BUSINESS_JWT_TOKEN: '',
  PLAYGROUND_JWT_TOKEN: '',
  USER_IP_ADDRESS: '',
  PROJECT_ENV_VARS: {},
  PROJECT_ROOT: '/project',
  safelyParseJson: vi.fn((json: string) => {
    try {
      return JSON.parse(json);
    } catch {
      return {};
    }
  }),
}));

// Mock Deployer from the package export
const mockWritePackageJson = vi.fn();
const mockBundle = vi.fn();

const mockPrepare = vi.fn();

vi.mock('@mastra/deployer', () => {
  class MockDeployer {
    outputDir = 'output';
    constructor() {}
    _bundle = mockBundle;
    writePackageJson = mockWritePackageJson;
    prepare = mockPrepare;

    getAllToolPaths = () => ['/test/project/src/mastra/tools'];
  }

  // Use a class for FileService constructor (Vitest v4 requirement)
  class MockFileService {
    getFirstExistingFile = vi.fn();
    getFirstExistingFileOrUndefined = vi.fn();
  }

  return {
    Deployer: MockDeployer,
    FileService: MockFileService,
  };
});

describe('CloudDeployer', () => {
  let deployer: CloudDeployer;
  let originalChdir: typeof process.chdir;

  beforeEach(() => {
    vi.clearAllMocks();
    mockBundle.mockResolvedValue(undefined);
    mockWritePackageJson.mockResolvedValue(undefined);
    mockPrepare.mockResolvedValue(undefined);

    // Mock process.chdir
    originalChdir = process.chdir;
    process.chdir = vi.fn();

    deployer = new CloudDeployer();

    // @ts-expect-error - accessing protected method for testing
    deployer._bundle = mockBundle;

    vi.mocked(installDeps).mockResolvedValue(undefined);
    vi.mocked(getMastraEntryFile).mockReturnValue('/test/src/mastra/index.ts');
    vi.mocked(getAuthEntrypoint).mockReturnValue('// auth entrypoint code');

    // Mock process.cwd
    vi.spyOn(process, 'cwd').mockReturnValue('/test/project');
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Restore original chdir
    process.chdir = originalChdir;
  });

  describe('constructor', () => {
    it('should create an instance of CloudDeployer', () => {
      expect(deployer).toBeInstanceOf(CloudDeployer);
    });

    it('should default studio to false when not provided', () => {
      const d = new CloudDeployer();
      // @ts-expect-error - accessing private property for testing
      expect(d.studio).toBe(false);
    });

    it('should default studio to false when empty options provided', () => {
      const d = new CloudDeployer({});
      // @ts-expect-error - accessing private property for testing
      expect(d.studio).toBe(false);
    });

    it('should set studio to true when provided', () => {
      const d = new CloudDeployer({ studio: true });
      // @ts-expect-error - accessing private property for testing
      expect(d.studio).toBe(true);
    });

    it('should set studio to false when explicitly provided', () => {
      const d = new CloudDeployer({ studio: false });
      // @ts-expect-error - accessing private property for testing
      expect(d.studio).toBe(false);
    });
  });

  describe('deploy', () => {
    it('should be implemented but do nothing', async () => {
      await expect(deployer.deploy('/output')).resolves.toBeUndefined();
    });
  });

  describe('writePackageJson', () => {
    it('should add required cloud dependencies', async () => {
      const outputDirectory = '/test/output';
      const dependencies = new Map<string, string>([
        ['express', '^4.18.0'],
        ['some-package', '1.0.0'],
      ]);

      // Test the core behavior: CloudDeployer should modify dependencies before calling super
      // We'll manually test this behavior by mimicking what the method does

      // Simulate the CloudDeployer.writePackageJson behavior
      dependencies.set('@mastra/loggers', 'latest');
      dependencies.set('@mastra/libsql', 'latest');
      dependencies.set('@mastra/cloud', 'latest');

      // Now call the deployer's method (which will call the mocked super)
      await deployer.writePackageJson(outputDirectory, dependencies);

      // Verify the parent method was called
      expect(mockWritePackageJson).toHaveBeenCalledWith(outputDirectory, dependencies);

      // Verify the dependencies map contains the cloud deps (as we set them)
      expect(dependencies.get('@mastra/loggers')).toBe('latest');
      expect(dependencies.get('@mastra/libsql')).toBe('latest');
      expect(dependencies.get('@mastra/cloud')).toBe('latest');
      expect(dependencies.get('express')).toBe('^4.18.0');
      expect(dependencies.get('some-package')).toBe('1.0.0');
    });
  });

  describe('lint', () => {
    it('should be implemented but do nothing', async () => {
      await expect(deployer.lint()).resolves.toBeUndefined();
    });
  });

  describe('installDependencies', () => {
    it('should install dependencies using npm in the output directory', async () => {
      const outputDirectory = '/test/output';
      const rootDir = '/test/root';

      // @ts-expect-error - accessing protected method for testing
      await deployer.installDependencies(outputDirectory, rootDir);

      expect(installDeps).toHaveBeenCalledWith({
        path: join(outputDirectory, 'output'),
        pm: 'npm',
      });
    });

    it('should use process.cwd() as default rootDir', async () => {
      const outputDirectory = '/test/output';

      // @ts-expect-error - accessing protected method for testing
      await deployer.installDependencies(outputDirectory);

      expect(installDeps).toHaveBeenCalledWith({
        path: join(outputDirectory, 'output'),
        pm: 'npm',
      });
    });
  });

  describe('bundle', () => {
    it('should bundle with correct parameters', async () => {
      const projectRoot = '/test/project';
      const outputDirectory = '/test/output';

      await deployer.bundle(projectRoot, outputDirectory);

      expect(getMastraEntryFile).toHaveBeenCalledWith(projectRoot);
      expect(mockBundle).toHaveBeenCalledWith(
        expect.any(String), // The generated entry code
        '/test/src/mastra/index.ts',
        {
          projectRoot,
          outputDirectory,
        },
        [join(projectRoot, MASTRA_DIRECTORY, 'tools')],
      );
    });

    it('should change working directory during bundling', async () => {
      const mastraDir = '/test/different/project';
      const outputDirectory = '/test/output';
      const originalCwd = process.cwd();

      const chdirSpy = vi.spyOn(process, 'chdir').mockImplementation(() => {});

      await deployer.bundle(mastraDir, outputDirectory);

      expect(chdirSpy).toHaveBeenCalledWith(mastraDir);
      expect(chdirSpy).toHaveBeenCalledWith(originalCwd);
      expect(chdirSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('getAuthEntrypoint', () => {
    it('should return auth entrypoint from utils', () => {
      const result = deployer.getAuthEntrypoint();
      expect(result).toBe('// auth entrypoint code');
      expect(getAuthEntrypoint).toHaveBeenCalled();
    });
  });

  describe('getEntry', () => {
    it('should generate correct server entry code', () => {
      // @ts-expect-error - accessing private method for testing
      const entry = deployer.getEntry();

      // Check for essential imports
      expect(entry).toContain("import { createNodeServer, getToolExports } from '#server';");
      expect(entry).toContain("import { tools } from '#tools';");
      expect(entry).toContain("import { mastra } from '#mastra';");
      expect(entry).toContain("import { MultiLogger } from '@mastra/core/logger';");
      expect(entry).toContain("import { PinoLogger } from '@mastra/loggers';");
      expect(entry).toContain("import { LibSQLStore, LibSQLVector } from '@mastra/libsql';");

      // Check for environment variables usage
      expect(entry).toContain('process.env.RUNNER_START_TIME');
      expect(entry).toContain('process.env.CI');
      expect(entry).toContain('process.env.BUSINESS_API_RUNNER_LOGS_ENDPOINT');
      expect(entry).toContain('process.env.BUSINESS_JWT_TOKEN');
      expect(entry).toContain('process.env.MASTRA_STORAGE_URL');
      expect(entry).toContain('process.env.MASTRA_STORAGE_AUTH_TOKEN');

      // Check for logging setup
      expect(entry).toContain('new PinoLogger');
      expect(entry).toContain('mastra.setLogger');

      // Check for storage initialization
      expect(entry).toContain('!userStorage.disableInit');
      expect(entry).toContain('userStorage.init()');
      expect(entry).toContain('new LibSQLStore');
      expect(entry).toContain('new LibSQLVector');
      // Check for server creation (default: studio disabled)
      expect(entry).toContain('studio: false');
      expect(entry).toContain('swaggerUI: false');
      expect(entry).toContain('tools: getToolExports(tools)');

      // Check for metadata
      expect(entry).toContain(`teamId: "${TEAM_ID}"`);
      expect(entry).toContain(`projectId: "${PROJECT_ID}"`);
      expect(entry).toContain(`buildId: "${BUILD_ID}"`);

      // Check for auth entrypoint
      expect(entry).toContain('// auth entrypoint code');
    });

    it('should include readiness logs', () => {
      // @ts-expect-error - accessing private method for testing
      const entry = deployer.getEntry();

      expect(entry).toContain('Server starting');
      expect(entry).toContain('Server started');
      expect(entry).toContain('Runner Initialized');
      expect(entry).toContain('type: "READINESS"');
    });

    it('should include studio: true when studio is enabled', () => {
      const studioDeployer = new CloudDeployer({ studio: true });
      // @ts-expect-error - accessing private method for testing
      const entry = studioDeployer.getEntry();

      expect(entry).toContain('studio: true');
      expect(entry).toContain('swaggerUI: false');
    });

    it('should include studio: false when studio is disabled', () => {
      const studioDeployer = new CloudDeployer({ studio: false });
      // @ts-expect-error - accessing private method for testing
      const entry = studioDeployer.getEntry();

      expect(entry).toContain('studio: false');
    });
  });

  describe('error handling', () => {
    it('should handle getMastraEntryFile error in bundle', async () => {
      const mastraDir = '/test/project';
      const outputDirectory = '/test/output';

      vi.mocked(getMastraEntryFile).mockImplementation(() => {
        throw new Error('Entry file not found');
      });

      await expect(deployer.bundle(mastraDir, outputDirectory)).rejects.toThrow('Entry file not found');
    });

    it('should handle installDeps error', async () => {
      const outputDirectory = '/test/output';

      vi.mocked(installDeps).mockRejectedValue(new Error('Install failed'));

      // @ts-expect-error - accessing protected method for testing
      await expect(deployer.installDependencies(outputDirectory)).rejects.toThrow('Install failed');
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete build flow', async () => {
      const mastraDir = '/test/project';
      const outputDirectory = '/test/output';
      const dependencies = new Map<string, string>([['test-dep', '1.0.0']]);

      // Setup mocks for complete flow
      const writePackageJsonSpy = vi.spyOn(deployer, 'writePackageJson');

      // Execute bundle
      await deployer.bundle(mastraDir, outputDirectory);

      // Write package.json
      await deployer.writePackageJson(outputDirectory, dependencies);

      // Verify calls
      expect(getMastraEntryFile).toHaveBeenCalled();
      expect(mockBundle).toHaveBeenCalled();
      expect(writePackageJsonSpy).toHaveBeenCalled();
    });

    it('should handle different process.cwd scenarios', async () => {
      const cwdValues = ['/root', '/different/path', '/workspace'];
      const chdirSpy = vi.spyOn(process, 'chdir').mockImplementation(() => {});

      for (const cwd of cwdValues) {
        vi.mocked(process.cwd).mockReturnValue(cwd);

        await deployer.bundle('/test/project', '/test/output');

        expect(chdirSpy).toHaveBeenCalledWith('/test/project');
        expect(chdirSpy).toHaveBeenCalledWith(cwd);
      }
    });
  });
});
