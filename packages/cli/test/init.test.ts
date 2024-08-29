import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('CLI Integration Test', () => {
  const workspacePath = path.join(__dirname, '..', '..', '..');
  const testDir = path.join(os.tmpdir(), `arkw-test-${Date.now()}`);
  const projectName = 'my-arkw-app';
  const projectPath = path.join(testDir, projectName);
  const cliPath = path.join(__dirname, '..', 'dist', 'index.js');
  let _initProcess: ReturnType<typeof spawn>;

  beforeAll((done) => {
    console.log('Starting integration test setup...');

    // Ensure we start in a known, existing directory
    process.chdir(os.tmpdir());

    console.log('Building CLI...');
    execSync('pnpm run build', { stdio: 'inherit', cwd: path.join(__dirname, '..') });

    console.log('Creating test directory...');
    fs.mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);

    console.log('Creating Next.js project...');
    execSync('npx create-next-app@latest my-arkw-app --typescript --eslint --tailwind --app --src-dir --import-alias "@/*" --use-pnpm', { stdio: 'inherit' });

    console.log('Moving to project directory...');
    process.chdir(projectPath);

    console.log('Installing @arkw/core and @arkw/admin from local filesystem...');
    execSync(`pnpm add ${path.join(workspacePath, 'packages', 'core')} ${path.join(workspacePath, 'packages', 'admin')}`, { stdio: 'inherit' });

    execSync(`cat package.json`, { stdio: 'inherit' });

    console.log('Running CLI init command...');
    const initProcess = spawn('node', [cliPath, 'init'], { stdio: 'pipe' });

    _initProcess = initProcess;

    initProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(output);
      if (output.includes('Enter your PostgreSQL connection string') || output.includes('Enter your Inngest server URL')) {
        initProcess.stdin.write('\n');
      }
      if (output.includes('PUT /api/integrations/inngest')) {
        console.log('Init process reached desired state. Detaching...');
        initProcess.unref();
        done();
      }
    });

    initProcess.stderr.on('data', (data) => {
      console.error(data.toString());
    });
  }, 600000); // 10 minute timeout

  afterAll(() => {
    // Ensure we're in a valid directory before cleanup
    process.chdir(os.tmpdir());

    // Terminate the init process if it's still running
    if (_initProcess && !_initProcess.killed) {
      _initProcess.kill();
    }

    // Clean up: stop Docker containers and remove the test directory
    if (fs.existsSync(projectPath)) {
      execSync('docker-compose -f arkw.docker-compose.yaml down -v', { stdio: 'inherit', cwd: projectPath });
      fs.rmSync(testDir, { recursive: true, force: true });
    }

    // Remove global links
    execSync('pnpm unlink --global @arkw/core @arkw/admin', { stdio: 'inherit' });
  });

  it('should create arkw config file', () => {
    expect(fs.existsSync(path.join(projectPath, 'arkw.config.ts'))).toBe(true);
  });

  it('should create arkw.docker-compose.yaml file', () => {
    expect(fs.existsSync(path.join(projectPath, 'arkw.docker-compose.yaml'))).toBe(true);
  });

  it('should have Docker containers running', () => {
    const dockerPs = execSync('docker ps').toString();
    expect(dockerPs).toContain('my-arkw-app-db');
    expect(dockerPs).toContain('my-arkw-app-inngest');
  });

  it('should be able to connect to the database', () => {
    const checkDbConnection = () => {
      try {
        execSync('docker exec my-arkw-app-db pg_isready');
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