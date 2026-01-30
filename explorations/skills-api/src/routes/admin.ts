/**
 * Admin API Routes
 * Provides endpoints for managing the skills registry
 */

import { Hono } from 'hono';

import {
  refreshSkillsData,
  startRefreshScheduler,
  stopRefreshScheduler,
  isSchedulerRunning,
  isRefreshInProgress,
  getLastRefreshResult,
  getCurrentDataTimestamp,
} from '../scheduler/index.js';
import { getStorageInfo } from '../storage/index.js';

const adminRouter = new Hono();

/**
 * GET /api/admin/status
 * Get scheduler and data status
 */
adminRouter.get('/status', c => {
  return c.json({
    scheduler: {
      running: isSchedulerRunning(),
      refreshing: isRefreshInProgress(),
    },
    storage: getStorageInfo(),
    data: {
      lastUpdated: getCurrentDataTimestamp(),
      lastRefresh: getLastRefreshResult(),
    },
  });
});

/**
 * POST /api/admin/refresh
 * Trigger a manual refresh of the skills data
 */
adminRouter.post('/refresh', async c => {
  if (isRefreshInProgress()) {
    return c.json({ error: 'Refresh already in progress' }, 409);
  }

  const result = await refreshSkillsData();

  if (result.success) {
    return c.json({
      message: 'Refresh completed successfully',
      ...result,
    });
  } else {
    return c.json(
      {
        message: 'Refresh failed',
        ...result,
      },
      500,
    );
  }
});

/**
 * POST /api/admin/scheduler/start
 * Start the automatic refresh scheduler
 */
adminRouter.post('/scheduler/start', c => {
  const intervalMinutes = parseInt(c.req.query('interval') || '30', 10);
  const intervalMs = Math.max(5, intervalMinutes) * 60 * 1000; // Minimum 5 minutes

  if (isSchedulerRunning()) {
    return c.json({ message: 'Scheduler already running' }, 200);
  }

  startRefreshScheduler({
    intervalMs,
    refreshOnStart: false,
  });

  return c.json({
    message: 'Scheduler started',
    intervalMinutes: intervalMs / 60 / 1000,
  });
});

/**
 * POST /api/admin/scheduler/stop
 * Stop the automatic refresh scheduler
 */
adminRouter.post('/scheduler/stop', c => {
  if (!isSchedulerRunning()) {
    return c.json({ message: 'Scheduler not running' }, 200);
  }

  stopRefreshScheduler();

  return c.json({ message: 'Scheduler stopped' });
});

export { adminRouter };
