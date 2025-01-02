import { Command } from 'commander';

import { attackCommand } from './commands/attack';
import { resumeCommand } from './commands/resume';
import { initDb } from './server/db';
import { startServer } from './server/server';

const program = new Command();

const main = async () => {
  // Initialize the local JSON database
  await initDb();

  // Start the local server
  await startServer(3000);

  // Setup CLI commands
  program.name('army').description('CLI to demonstrate workflow suspension and resume').version('1.0.0');

  program.addCommand(attackCommand);
  program.addCommand(resumeCommand);

  await program.parseAsync();
};

main().catch(error => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
