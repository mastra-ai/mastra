import { createRoot } from 'react-dom/client';
import { TraceViewer } from './trace-viewer';
import './styles.css';

createRoot(document.getElementById('root')!).render(<TraceViewer />);
