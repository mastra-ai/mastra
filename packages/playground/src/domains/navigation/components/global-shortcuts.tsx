import { useKeydown } from '@mastra/playground-ui/keyboard/use-keydown';
import { useNavigate } from 'react-router';

/**
 * App-wide "go to" sequences. Pages can shadow any of them by declaring the
 * same binding inside a `KeyboardScope`.
 */
export const GlobalShortcuts = () => {
  const navigate = useNavigate();

  useKeydown({
    'g$+i': () => navigate('/inbox'),
    'g$+a': () => navigate('/agents'),
    'g$+p': () => navigate('/prompts'),
    'g$+w': () => navigate('/workflows'),
    'g$+c': () => navigate('/processors'),
    'g$+m': () => navigate('/mcps'),
    'g$+o': () => navigate('/tools'),
    'g$+k': () => navigate('/workspaces'),
    'g$+e': () => navigate('/evaluation'),
    'g$+s': () => navigate('/scorers'),
    'g$+d': () => navigate('/datasets'),
    'g$+x': () => navigate('/experiments'),
    'g$+q': () => navigate('/experiments/review-queue'),
    'g$+n': () => navigate('/metrics'),
    'g$+t': () => navigate('/traces'),
    'g$+l': () => navigate('/logs'),
    'g$+,': () => navigate('/settings'),
    'g$+h': () => navigate('/resources'),
  });

  return null;
};
