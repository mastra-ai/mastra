import { execa, ExecaError } from 'execa';
import path from 'path';
import process from 'process';

export async function startNextDevServer() {
  console.log('Starting Next.js dev server...');

  try {
    // TODO: fix cwd so it works from project directory, not just from the cli directory
    const __filename = new URL(import.meta.url).pathname;
    const __dirname = path.dirname(__filename);
    const adminPath = path.resolve(__dirname, '..', '..', 'node_modules', '@arkw', 'admin');
    const nextServer = execa(`npm run dev -- -p 3456`, {
      cwd: adminPath,
      all: true,
      buffer: false,
      env: {
        ...process.env,
        PROJECT_DIRECTORY: process.cwd(),
      },
      shell: true,
      stdio: 'inherit', // This will pipe directly to parent process stdout/stderr
    });

    process.on('SIGINT', async () => {
      console.log('Stopping Next.js dev server...');
      nextServer.kill();
      process.exit();
    });

    await nextServer;
  } catch (error: any) {
    if (error instanceof ExecaError) {
      console.error(error);
    }
    console.error(`Error: ${error.message}`);
  }
}

export function dev() {
  startNextDevServer().catch(console.error);
  return;
}
