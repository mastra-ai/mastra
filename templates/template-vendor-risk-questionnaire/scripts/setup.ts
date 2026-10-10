import { execFileSync } from 'node:child_process';
import { constants, copyFileSync, existsSync } from 'node:fs';

const npmCli = process.env.npm_execpath;

if (!npmCli) {
  throw new Error('Run setup with npm run setup.');
}

execFileSync(process.execPath, [npmCli, 'install', '--workspaces=false'], {
  stdio: 'inherit',
});

if (!existsSync('.env')) {
  copyFileSync('.env.example', '.env', constants.COPYFILE_EXCL);
}
