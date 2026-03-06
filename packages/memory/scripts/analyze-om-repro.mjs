#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function isDir(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function listStepDirs(captureDir) {
  return readdirSync(captureDir)
    .map(name => join(captureDir, name))
    .filter(isDir)
    .sort();
}

function summarizeStep(stepDir) {
  const pre = readJson(join(stepDir, 'pre-state.json'));
  const post = readJson(join(stepDir, 'post-state.json'));
  const out = readJson(join(stepDir, 'output.json'));

  const details = out?.details ?? {};
  const cleanup = details?.thresholdCleanup ?? null;
  const messageDiff = out?.messageDiff ?? null;

  const preTokens = pre?.contextTokenCount ?? null;
  const postTokens = post?.contextTokenCount ?? null;
  const drop = typeof preTokens === 'number' && typeof postTokens === 'number' ? preTokens - postTokens : null;

  return {
    step: basename(stepDir),
    preTokens,
    postTokens,
    drop,
    thresholdReached: Boolean(details?.thresholdReached),
    observedIdsCount: cleanup?.observedIdsCount ?? 0,
    minRemaining: cleanup?.minRemaining ?? null,
    backpressure: details?.backpressure ?? null,
    messageDiff,
  };
}

function parseArgs() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: node packages/memory/scripts/analyze-om-repro.mjs <capture-dir>');
    process.exit(1);
  }
  return resolve(arg);
}

function main() {
  const captureDir = parseArgs();
  if (!isDir(captureDir)) {
    console.error(`Capture directory not found: ${captureDir}`);
    process.exit(1);
  }

  const stepDirs = listStepDirs(captureDir);
  const steps = [];

  for (const stepDir of stepDirs) {
    try {
      steps.push(summarizeStep(stepDir));
    } catch (err) {
      console.warn(`Skipping invalid step dir: ${stepDir} (${String(err)})`);
    }
  }

  const activationSteps = steps.filter(s => s.thresholdReached);
  const byDrop = [...steps]
    .filter(s => typeof s.drop === 'number')
    .sort((a, b) => b.drop - a.drop)
    .slice(0, 10);

  console.log(`Capture: ${captureDir}`);
  console.log(`Steps: ${steps.length}`);
  console.log(`Threshold activations: ${activationSteps.length}`);
  console.log('');

  console.log('Top token drops:');
  for (const s of byDrop) {
    console.log(
      `- ${s.step}: drop=${s.drop}, pre=${s.preTokens}, post=${s.postTokens}, threshold=${s.thresholdReached}, observed=${s.observedIdsCount}, minRemaining=${s.minRemaining}`,
    );
  }

  if (activationSteps.length > 0) {
    console.log('');
    console.log('Activation details:');
    for (const s of activationSteps) {
      const waitMs = s.backpressure?.waitMsApplied ?? 0;
      const ratio = s.backpressure?.ratio ?? null;
      const removed = s.messageDiff?.removedMessageIds?.length ?? 0;
      const added = s.messageDiff?.addedMessageIds?.length ?? 0;
      const remap = s.messageDiff?.idRemap?.length ?? 0;
      console.log(
        `- ${s.step}: pre=${s.preTokens}, post=${s.postTokens}, drop=${s.drop}, observed=${s.observedIdsCount}, removed=${removed}, added=${added}, idRemap=${remap}, waitMs=${waitMs}, ratio=${ratio ?? 'n/a'}`,
      );
    }
  }
}

main();
