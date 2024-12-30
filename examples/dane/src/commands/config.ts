import { Command } from 'commander';

import { ConfigManager } from '../config/index.js';

export const configCommand = new Command('config')
  .description('Manage Dane configuration')
  .option('--set <key=value>', 'Set a configuration value')
  .option('--get <key>', 'Get a configuration value')
  .option('--list', 'List all configuration values')
  .option('--del <key>', 'Delete a configuration value')
  .action(options => {
    const configManager = new ConfigManager();

    if (options.set) {
      const [key, value] = options.set.split('=');
      if (!key || !value) {
        console.error('Invalid format. Use --set KEY=VALUE');
        process.exit(1);
      }
      configManager.set(key, value);
      console.log(`Set ${key} successfully`);
    } else if (options.get) {
      const value = configManager.get(options.get);
      if (value === undefined) {
        console.log(`No value set for ${options.get}`);
      } else {
        console.log(value);
      }
    } else if (options.del) {
      configManager.delete(options.del);
      console.log(`Deleted ${options.del} successfully`);
    } else if (options.list) {
      const config = configManager.list();
      console.log(JSON.stringify(config, null, 2));
    } else {
      console.log('No action specified. Use --help to see available options.');
    }
  });
