import { renderStartupError } from './startup-error';

try {
  const { startStudio } = await import('./main');
  startStudio();
} catch (error) {
  console.error('Mastra Studio failed to start', error);
  renderStartupError(error);
}
