import { createRoot } from 'react-dom/client';
import { ObservabilityWidget } from './observability-widget';
import './styles.css';

createRoot(document.getElementById('root')!).render(<ObservabilityWidget />);
