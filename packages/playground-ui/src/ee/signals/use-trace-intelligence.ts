import { useContext } from 'react';

import { TraceIntelligenceContext } from './trace-intelligence-context';

export function useTraceIntelligence() {
  return useContext(TraceIntelligenceContext);
}
