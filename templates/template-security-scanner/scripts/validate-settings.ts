import { diagnostic, loadSettings } from '../src/config/settings.js';

// npm stops before the console build when operator configuration is invalid.
try {
  loadSettings();
} catch (error) {
  console.error(JSON.stringify(diagnostic(error)));
  process.exitCode = 1;
}
