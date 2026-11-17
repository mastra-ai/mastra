#!/usr/bin/env node
// Decides whether a PR changes code, from the GitHub PR files list instead of a full-history
// git checkout. Prints GITHUB_OUTPUT lines: has_code=true|false when the API answers, or
// need_git=true when only git can decide (stacked PRs need a merge-base with main, a list at
// the API's 3,000-file limit may be cut short, and any API error falls back to git).
//
// The files endpoint always lists the PR as it is now, not the revision this run tests. So the
// PR's head commit, base branch and base commit are read before and after listing: unless both
// times they match the run's event, the list may be for another revision and git decides. The
// base commit matters too: once main takes in commits the head also has (another PR landing
// them), the PR's current diff no longer shows them, though this run's base...head diff does.

import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// The pulls/{n}/files endpoint returns at most this many files.
export const API_FILE_LIMIT = 3000;

const NOT_CODE = /^(docs|examples|\.changeset|explorations)\//;

export function hasCodeChanges(files) {
  return files.some(file => file !== '' && !NOT_CODE.test(file));
}

function gh(args) {
  // Colored JSON (CLICOLOR_FORCE) would not parse.
  const env = { ...process.env, CLICOLOR_FORCE: '0', NO_COLOR: '1' };
  return execFileSync('gh', args, { encoding: 'utf8', env, maxBuffer: 64 * 1024 * 1024 });
}

export function prFilesFromApi({ repo, number, baseRef, baseSha, headSha, run = gh }) {
  // A stacked PR is diffed against main (merge-base), which the API can't do.
  if (baseRef !== 'main' && baseRef !== '0.x') return null;
  if (!headSha || !baseSha) return null;
  try {
    const atRunRevision = () => {
      const pr = JSON.parse(run(['api', `repos/${repo}/pulls/${number}`]));
      return pr?.head?.sha === headSha && pr?.base?.ref === baseRef && pr?.base?.sha === baseSha;
    };
    if (!atRunRevision()) {
      console.log(`The PR is no longer at ${headSha} on ${baseRef} at ${baseSha}.`);
      return null;
    }
    const pages = JSON.parse(run(['api', '--paginate', '--slurp', `repos/${repo}/pulls/${number}/files?per_page=100`]));
    if (!Array.isArray(pages) || !pages.every(Array.isArray)) return null;
    const files = pages.flat().map(file => file.filename);
    if (files.length >= API_FILE_LIMIT || files.some(file => typeof file !== 'string')) return null;
    if (!atRunRevision()) {
      console.log(`The PR moved off ${headSha} on ${baseRef} at ${baseSha} while its files were listed.`);
      return null;
    }
    return files;
  } catch (error) {
    console.log(`Could not list the PR files from the API (${error.message.split('\n')[0]}).`);
    return null;
  }
}

export function decide({ eventName, fullSuite, repo, number, baseRef, baseSha, headSha, run }) {
  if (fullSuite === 'true') return { has_code: 'true' };
  if (eventName !== 'pull_request') return { need_git: 'true' };
  const files = prFilesFromApi({ repo, number, baseRef, baseSha, headSha, run });
  if (!files) return { need_git: 'true' };
  return { has_code: String(hasCodeChanges(files)) };
}

export function writeOutputs(outputs, file = process.env.GITHUB_OUTPUT) {
  const lines = Object.entries(outputs).map(([key, value]) => `${key}=${value}\n`);
  if (file) appendFileSync(file, lines.join(''));
  else process.stdout.write(lines.join(''));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const outputs = decide({
    eventName: process.env.GITHUB_EVENT_NAME,
    fullSuite: process.env.FULL_SUITE,
    repo: process.env.GITHUB_REPOSITORY,
    number: process.env.PR_NUMBER,
    baseRef: process.env.BASE_REF,
    baseSha: process.env.PR_BASE_SHA,
    headSha: process.env.HEAD_SHA,
  });
  if (outputs.need_git) console.log('The PR files list cannot decide; diffing with git.');
  else if (outputs.has_code === 'true') console.log('Code changes found (or full suite requested).');
  else console.log('Only docs, examples, changesets or explorations changed.');
  writeOutputs(outputs);
}
