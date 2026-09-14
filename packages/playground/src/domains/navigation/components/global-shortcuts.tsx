import { useKeydown } from '@mastra/playground-ui/keyboard/use-keydown';
import { useNavigate } from 'react-router';

/**
 * App-wide "go to" sequences. Pages can shadow any of them by declaring the
 * same binding inside a `KeyboardScope`.
 */
export const GlobalShortcuts = () => {
  const navigate = useNavigate();

  useKeydown({
    'g$+a': () => navigate('/agents'),
    'g$+w': () => navigate('/workflows'),
    'g$+t': () => navigate('/traces'),
  });

  return null;
};
