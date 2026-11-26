import { afterEach, expect, it } from 'vitest';
import { closeDiscoveryLabs, startDiscoveryLab } from './lab/harness.js';
import { modelWire } from './lab/investigation.js';
import { categoryMatrix, runMatrixVariant } from './lab/operations-matrix.js';
import { cleanSetupAndPublicLab } from './lab/clean-setup.js';
import { periodicAdvisoryLifecycle } from './lab/advisory-schedule.js';
import { sharedImageLifecycle, legacySharedImageLifecycle } from './lab/operations-resources.js';
import { activeScanCrash } from './lab/operations-crash.js';
import { activeLeaseCrash } from './lab/operations-leases.js';
import { compatiblePairRollback } from './lab/operations-storage.js';
import { outputAndTelemetryAudit } from './lab/output-audit.js';
import { planningWireAudit, reviewWireAudit } from './lab/model-wire-audit.js';
import { retentionExpiryAndDebt, keyLossRecovery, nonLabRetentionAdmission } from './lab/retention.js';

afterEach(closeDiscoveryLabs);

it('documented_setup_and_complete_p0_lab_matrix', async () => {
  console.log(`OPERATIONS_CLEAN_SETUP ${JSON.stringify(await cleanSetupAndPublicLab())}`);
  const wire = await modelWire({ category: 'idor', path: '/owned/resource/vulnerable', interpretation: 'CONFIRMED' });
  const lab = await startDiscoveryLab({ investigationModels: wire.models });
  expect(categoryMatrix).toHaveLength(8);
  let ordinal = 0;
  for (const scenario of categoryMatrix)
    for (const variant of ['vulnerable', 'patched', 'missing', 'absent'] as const) {
      const record = await runMatrixVariant(lab, wire, scenario, variant, ++ordinal);
      console.log(`OPERATIONS_MATRIX_RECORD ${JSON.stringify(record)}`);
    }
  expect(ordinal).toBe(32);
  await closeDiscoveryLabs();
  await periodicAdvisoryLifecycle();
}, 1500000);

it('crash_cleanup_shared_images_and_rollback_preserve_unrelated_resources', async () => {
  await legacySharedImageLifecycle();
  await sharedImageLifecycle();
  await closeDiscoveryLabs();
  await activeScanCrash();
  await closeDiscoveryLabs();
  await activeLeaseCrash();
  await closeDiscoveryLabs();
  await compatiblePairRollback();
}, 600000);

it('telemetry_and_all_output_surfaces_preserve_secret_and_evidence_contracts', async () => {
  const measurements = await outputAndTelemetryAudit();
  await planningWireAudit();
  await reviewWireAudit();
  console.log(`OPERATIONS_OUTPUT_AUDIT ${JSON.stringify(measurements)}`);
}, 600000);

it('explicit_retention_and_key_loss_protect_real_target_data', async () => {
  await nonLabRetentionAdmission();
  await closeDiscoveryLabs();
  await retentionExpiryAndDebt();
  await closeDiscoveryLabs();
  await keyLossRecovery();
}, 600000);
