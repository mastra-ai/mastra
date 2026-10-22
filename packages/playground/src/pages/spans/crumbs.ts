import { navCrumb } from '@/domains/navigation/crumbs';

// Spans has no sidebar entry of its own; it lives under Traces, and the Traces/Spans switch names it.
export const tracesCrumbs = [navCrumb('/traces')];

// Without the switch (span queries unsupported), nothing else on the page names Spans.
export const spansCrumbs = [...tracesCrumbs, { id: 'spans', label: 'Spans' }];
