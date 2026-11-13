import { createRoot } from 'react-dom/client';
import { submitFormsInFrame } from '../../shared/frame-forms';
import { rootObserversAtFrame } from '../../shared/frame-viewport';
import { ObservabilityExplorer } from './observability-explorer';
import './styles.css';

rootObserversAtFrame();
submitFormsInFrame();
createRoot(document.getElementById('root')!).render(<ObservabilityExplorer />);
