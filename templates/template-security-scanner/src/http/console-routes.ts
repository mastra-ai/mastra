import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Hono } from 'hono';
import { z } from 'zod';
import type { Settings } from '../config/settings.js';
import { idSchema, pageSchema, parse } from '../core/contracts.js';
import type { ControlPlane } from '../core/control-plane.js';
import type { InvestigationService } from '../investigation/service.js';
import type { Finding, StoredProof } from '../investigation/store.js';
import type { BolaAssessmentService } from '../investigation/bola-service.js';
import { OPERATOR_ID } from './security.js';

const assetName = z.string().regex(/^(?:console-[a-f0-9]{64}\.js|style-[a-f0-9]{64}\.css)$/);
const manifestSchema = z.object({ script: assetName, style: assetName }).strict();
type Asset = { name: string; bytes: Buffer; type: string };

/** Load bounded console assets or return null when the built console is unavailable. */
async function consoleAssets(root: string): Promise<Asset[] | null> {
  try {
    const folder = join(root, 'web', 'dist');
    const manifest = manifestSchema.parse(JSON.parse(await readFile(join(folder, 'manifest.json'), 'utf8')));
    const entries = [
      { name: manifest.script, type: 'text/javascript; charset=utf-8' },
      { name: manifest.style, type: 'text/css; charset=utf-8' },
    ];
    const assets = await Promise.all(
      entries.map(async entry => ({ ...entry, bytes: await readFile(join(folder, entry.name)) })),
    );
    if (
      assets.some(
        asset => createHash('sha256').update(asset.bytes).digest('hex') !== asset.name.split('-')[1]?.split('.')[0],
      )
    )
      return null;
    return assets;
  } catch {
    return null;
  }
}

/** Project a persisted finding into the bounded fields exposed by the console API. */
function findingView(item: Finding) {
  return {
    id: item.id,
    investigationId: item.investigationId,
    hypothesisId: item.hypothesisId,
    jobId: item.jobId,
    proofId: item.proofId,
    evidenceIds: item.evidenceIds,
    createdAt: item.createdAt,
    availability: item.availability ?? { state: 'unknown', at: null },
  };
}

/** Project proof status and evidence availability into the console's public response shape. */
function proofView(item: StoredProof) {
  return {
    id: item.id,
    investigationId: item.investigationId,
    hypothesisId: item.hypothesisId,
    jobId: item.jobId,
    createdAt: item.createdAt,
    source: item.proof.source,
    category: item.proof.category,
    completed: item.proof.completed,
    surfacePresent: item.proof.surfacePresent,
    prerequisitesReady: item.proof.prerequisitesReady,
    identityValid: item.proof.identityValid,
    scopeApproved: item.proof.scopeApproved,
    requestCount: item.proof.requestCount,
    evidence: item.proof.evidence,
    withheld: item.proof.withheld,
    availability: item.availability ?? { state: 'unknown', at: null },
    expiresAt: item.expiresAt ?? null,
  };
}

export async function registerConsoleRoutes(
  app: Hono,
  settings: Settings,
  investigations: InvestigationService,
  control: ControlPlane,
  assessments: BolaAssessmentService,
) {
  const assets = await consoleAssets(settings.root);
  app.get('/', context => {
    if (!assets) return context.json({ code: 'CONSOLE_ASSETS_UNAVAILABLE' }, 503);
    const script = assets.find(asset => asset.name.endsWith('.js'))!;
    const style = assets.find(asset => asset.name.endsWith('.css'))!;
    context.header('Content-Type', 'text/html; charset=utf-8');
    return context.body(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>Security Scanner</title><link rel="stylesheet" href="/assets/${style.name}"><script type="module" src="/assets/${script.name}"></script></head><body><div id="root"></div></body></html>`,
    );
  });
  app.get('/assets/:name', context => {
    const asset = assets?.find(item => item.name === context.req.param('name'));
    if (!asset) return context.json({ code: 'NOT_FOUND' }, 404);
    context.header('Content-Type', asset.type);
    context.header('Cache-Control', 'public, max-age=31536000, immutable');
    return context.body(new Uint8Array(asset.bytes));
  });

  app.get('/api/settings', context =>
    context.json({
      discovery: { driver: settings.DISCOVERY_DRIVER, requested: settings.SCANNER_DISCOVERY_ENABLED },
      investigation: {
        requested: settings.SCANNER_INVESTIGATION_ENABLED,
        modelConfigured: investigations.modelConfigured(),
        approvalCallback: investigations.approvalCallback(),
      },
      bolaAssessment: { available: assessments.enabled },
      sandbox: {
        driver: settings.SANDBOX_DRIVER,
        platform: settings.DOCKER_PLATFORM,
        memoryMiB: settings.SANDBOX_MEMORY_MIB,
        pids: settings.SANDBOX_PIDS,
      },
      storage: { driver: settings.STORAGE_DRIVER },
      queue: { driver: settings.QUEUE_DRIVER },
      limits: { commandTimeoutMs: settings.COMMAND_TIMEOUT_MS, outputBytes: settings.OUTPUT_LIMIT_BYTES },
      session: { ttlSeconds: settings.CONTROL_SESSION_TTL_SECONDS },
    }),
  );
  app.get('/api/agents', async context => {
    const { limit, offset } = parse(pageSchema, context.req.query());
    const runs = await investigations.store.recentModelEvents(OPERATOR_ID, limit, offset);
    return context.json({
      items: [
        { id: 'nemo', name: 'Nemo', task: 'Mapping', modelId: settings.EXPLORER_MODEL },
        { id: 'sherlock', name: 'Sherlock', task: 'Hypotheses', modelId: settings.EXPLORER_MODEL },
        { id: 'dupin', name: 'Dupin', task: 'Verification interpretation', modelId: settings.EXPLORER_MODEL },
        { id: 'watson', name: 'Watson', task: 'Evidence review', modelId: settings.JUDGE_MODEL },
      ].map(agent => ({ ...agent, configured: investigations.modelConfigured() })),
      runs,
      limit,
      offset,
    });
  });
  app.get('/api/findings', async context => {
    const { limit, offset } = parse(pageSchema, context.req.query());
    const items = await investigations.store.list<Finding>('scanner_findings', OPERATOR_ID, limit, offset);
    return context.json({ items: items.map(findingView), limit, offset });
  });
  app.get('/api/findings/:id', async context =>
    context.json(
      findingView(await investigations.store.getFinding(parse(idSchema, context.req.param('id')), OPERATOR_ID)),
    ),
  );
  app.get('/api/evaluations', async context => {
    const { limit, offset } = parse(pageSchema, context.req.query());
    const items = await investigations.store.list<StoredProof>(
      'scanner_verification_proofs',
      OPERATOR_ID,
      limit,
      offset,
    );
    return context.json({ items: items.map(proofView), limit, offset });
  });
  app.get('/api/evaluations/:id', async context =>
    context.json(proofView(await investigations.store.getProof(parse(idSchema, context.req.param('id')), OPERATOR_ID))),
  );
  app.get('/api/hypotheses/:id', async context => {
    const hypothesis = await investigations.store.getHypothesis(parse(idSchema, context.req.param('id')), OPERATOR_ID);
    const {
      id,
      investigationId,
      lineage,
      origin,
      category,
      toolId,
      scanId,
      evidenceIds,
      referenceIds,
      advisoryId,
      advisoryRevision,
      risk,
      expectedBehavior,
      maxRequests,
      maxDurationSeconds,
      maxTokens,
      state,
      reason,
      createdAt,
      ruleBinding,
    } = hypothesis;
    return context.json({
      id,
      investigationId,
      lineage,
      origin,
      category,
      toolId,
      scanId,
      evidenceIds,
      referenceIds,
      advisoryId,
      advisoryRevision,
      risk,
      expectedBehavior,
      maxRequests,
      maxDurationSeconds,
      maxTokens,
      state,
      reason,
      createdAt,
      ruleBinding,
    });
  });
  app.get('/api/jobs/:id', async context => {
    const job = await investigations.store.getJob(parse(idSchema, context.req.param('id')), OPERATOR_ID);
    const {
      id,
      investigationId,
      hypothesisId,
      targetId,
      state,
      attempts,
      reservedRequests,
      result,
      createdAt,
      updatedAt,
    } = job;
    return context.json({
      id,
      investigationId,
      hypothesisId,
      targetId,
      state,
      attempts,
      reservedRequests,
      result,
      createdAt,
      updatedAt,
    });
  });
  app.get('/api/targets/:id/recurrence', async context => {
    const targetId = parse(idSchema, context.req.param('id'));
    await control.store.get('target', targetId, OPERATOR_ID);
    return context.json({ schedule: await investigations.store.getRecurrence(targetId, OPERATOR_ID) });
  });
}
