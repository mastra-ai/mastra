import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'os';

describe('CLI Integration Test', () => {
  const workspacePath = path.join(__dirname, '..', '..', '..');
  const testDir = path.join(os.tmpdir(), `mastra-test-${Date.now()}`);
  const projectName = 'my-mastra-app';
  const projectPath = path.join(testDir, projectName);
  const cliPath = path.join(__dirname, '..', 'dist', 'index.js');
  let _initProcess: ReturnType<typeof spawn>;
  let running = true;
  beforeAll(done => {
    console.log('Starting integration test setup...');

    // Ensure we start in a known, existing directory
    process.chdir(os.tmpdir());

    console.log('Building CLI...');
    execSync('pnpm run build', { stdio: 'inherit', cwd: path.join(__dirname, '..') });

    console.log('Creating test directory...');
    fs.mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);

    console.log('Creating Next.js project...');
    execSync(
      'npx create-next-app@latest my-mastra-app --typescript --eslint --tailwind --app --src-dir --import-alias "@/*" --use-pnpm',
      { stdio: 'inherit' },
    );

    console.log('Moving to project directory...');
    process.chdir(projectPath);

    console.log('Installing @mastra/core and @mastra/admin from local filesystem...');
    execSync(
      `pnpm add ${path.join(workspacePath, 'packages', 'core')} ${path.join(workspacePath, 'packages', 'admin')}`,
      { stdio: 'inherit' },
    );

    execSync(`cat package.json`, { stdio: 'inherit' });

    console.log('Running CLI init command...');
    const initProcess = spawn('node', [cliPath, 'init'], { stdio: 'pipe' });

    _initProcess = initProcess;

    initProcess.stdout.on('data', data => {
      const output = data.toString();
      running && console.log(output);
      if (
        output.includes('Enter your PostgreSQL connection string') ||
        output.includes('Enter your Inngest server URL')
      ) {
        initProcess.stdin.write('\n');
      }
      if (output.includes('PUT /api/mastra/inngest')) {
        running && console.log('Init process reached desired state. Detaching...');
        initProcess.unref();
        done();
      }
    });

    initProcess.stderr.on('data', data => {
      console.error(data.toString());
    });
  }, 600000); // 10 minute timeout

  afterAll(() => {
    // Ensure we're in a valid directory before cleanup
    running = false;
    process.chdir(os.tmpdir());

    // Terminate the init process if it's still running
    if (_initProcess && !_initProcess.killed) {
      _initProcess.kill();
    }

    // Clean up: stop Docker containers and remove the test directory
    if (fs.existsSync(projectPath)) {
      execSync('docker-compose -f mastra.docker-compose.yaml down -v', { stdio: 'inherit', cwd: projectPath });
      fs.rmSync(testDir, { recursive: true, force: true });
    }

    // Remove global links
    execSync('pnpm unlink --global @mastra/core @mastra/admin', { stdio: 'inherit' });
  });

  it('should create mastra config file', () => {
    expect(fs.existsSync(path.join(projectPath, 'mastra.config.ts'))).toBe(true);
  });

  it('should create mastra.docker-compose.yaml file', () => {
    expect(fs.existsSync(path.join(projectPath, 'mastra.docker-compose.yaml'))).toBe(true);
  });

  it('should have Docker containers running', () => {
    const dockerPs = execSync('docker ps').toString();
    expect(dockerPs).toContain('my-mastra-app-db');
    expect(dockerPs).toContain('my-mastra-app-inngest');
  });

  it('should be able to connect to the database', () => {
    const checkDbConnection = () => {
      try {
        execSync('docker exec my-mastra-app-db pg_isready');
        return true;
      } catch (error) {
        return false;
      }
    };

    // Retry for up to 30 seconds
    const startTime = Date.now();
    while (Date.now() - startTime < 30000) {
      if (checkDbConnection()) {
        return;
      }
      // Wait for 1 second before trying again
      execSync('sleep 1');
    }
    throw new Error('Failed to connect to the database within 30 seconds');
  });
});
