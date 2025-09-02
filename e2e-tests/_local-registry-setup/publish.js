import { execSync } from 'node:child_process';

const maxRetries = 5;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function publishPackages(args, tag, monorepoDir, registry) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      execSync(`pnpm ${args.join(' ')} publish --registry=${registry} --no-git-checks --tag=${tag}`, {
        cwd: monorepoDir,
        stdio: ['inherit', 'inherit', 'inherit'],
      });
      return; // Success, exit the function
    } catch (error) {
      console.error(`Publish attempt ${i + 1} failed:`, error.message);

      if (i < maxRetries - 1) {
        // Wait a bit before retrying (exponential backoff)
        const waitTime = Math.min(1000 * Math.pow(2, i), 5000);
        console.log(`Retrying in ${waitTime}ms...`);
        await sleep(waitTime);
      } else {
        throw error;
      }
    }
  }
}
