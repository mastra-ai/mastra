import { createContext } from 'react';

import type { KnowledgePagePayload } from '../pageTypes';

/**
 * Pages the host fetched by the exact `[[ref]]` that names them, so those refs link even when the pages on
 * their path aren't loaded.
 */
export const KnowledgePagesByRef = createContext<ReadonlyMap<string, KnowledgePagePayload>>(new Map());
