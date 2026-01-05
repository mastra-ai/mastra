/**
 * Quick Start: Mastra with Convex
 *
 * Minimal example showing Mastra + Convex integration.
 */

import { Mastra } from '@mastra/core';
import { ConvexStore } from '@mastra/convex';

// Create Convex storage
const storage = new ConvexStore({
  id: 'convex',
  deploymentUrl: process.env.CONVEX_URL!,
  authToken: process.env.CONVEX_AUTH_TOKEN!,
});

// Initialize Mastra with Convex
const mastra = new Mastra({
  storage,
});

// That's it! Mastra now uses Convex for:
// - Thread storage
// - Message persistence
// - Workflow snapshots
// - Working memory
