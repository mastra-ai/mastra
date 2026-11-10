import { createRoot } from 'react-dom/client';
import { rootObserversAtFrame } from '../../shared/frame-viewport';
import { TraceList } from './trace-list';
import './styles.css';

rootObserversAtFrame();
createRoot(document.getElementById('root')!).render(<TraceList />);
