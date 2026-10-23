import { navCrumb } from '@/domains/navigation/crumbs';

// Threads has no sidebar entry of its own; it lives under Traces, and the observability switch names it.
export const tracesCrumbs = [navCrumb('/traces')];

// Without the switch (thread rows unsupported), nothing else on the page names Threads.
export const threadsCrumbs = [...tracesCrumbs, { id: 'threads', label: 'Threads' }];
