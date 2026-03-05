#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { Tiktoken } from 'js-tiktoken/lite';
import o200k_base from 'js-tiktoken/ranks/o200k_base';

const encoder = new Tiktoken(o200k_base);
const DEFAULT_CACHE_SOURCE = 'v1:o200k_base';
const TOKEN_ESTIMATE_CACHE_VERSION = 1;
const JSON_FILES = new Set(['input.json', 'pre-state.json', 'output.json', 'post-state.json']);
const FIXTURES_ROOT = resolve('src/processors/observational-memory/__fixtures__/repro-captures');
const canonicalEstimateRegistry = new Map();

function usage() {
  console.error('Usage: node ./scripts/sanitize-om-repro.mjs [fixture-dir] [--write]');
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);
  let target = FIXTURES_ROOT;
  let write = false;

  for (const arg of args) {
    if (arg === '--write') {
      write = true;
      continue;
    }

    if (arg.startsWith('-')) {
      usage();
    }

    target = resolve(arg);
  }

  return { target, write };
}

function isDir(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function listJsonFiles(root) {
  if (isFile(root)) return [root];
  if (!isDir(root)) return [];

  const entries = readdirSync(root, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...listJsonFiles(fullPath));
      continue;
    }

    if (entry.isFile() && JSON_FILES.has(entry.name)) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function buildEstimateKey(kind, payload) {
  return `${kind}:${createHash('sha1').update(payload).digest('hex')}`;
}

function setPartEstimate(part, kind, payload, tokens, source = DEFAULT_CACHE_SOURCE) {
  part.providerMetadata ??= {};
  part.providerMetadata.mastra ??= {};
  part.providerMetadata.mastra.tokenEstimate = {
    v: TOKEN_ESTIMATE_CACHE_VERSION,
    source,
    key: buildEstimateKey(kind, payload),
    tokens,
  };
}

function setMessageEstimate(message, kind, payload, tokens, source = DEFAULT_CACHE_SOURCE) {
  if (message.content && typeof message.content === 'object') {
    message.content.metadata ??= {};
    message.content.metadata.mastra ??= {};
    message.content.metadata.mastra.tokenEstimate = {
      v: TOKEN_ESTIMATE_CACHE_VERSION,
      source,
      key: buildEstimateKey(kind, payload),
      tokens,
    };
    return;
  }

  message.metadata ??= {};
  message.metadata.mastra ??= {};
  message.metadata.mastra.tokenEstimate = {
    v: TOKEN_ESTIMATE_CACHE_VERSION,
    source,
    key: buildEstimateKey(kind, payload),
    tokens,
  };
}

function redactPathLikeSegments(value) {
  if (typeof value !== 'string' || value.length === 0) return value;

  return value
    .replace(/\/Users\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._@\-]+)+/g, '<redacted-path>')
    .replace(/\/home\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._@\-]+)+/g, '<redacted-path>')
    .replace(/~\/(?:[A-Za-z0-9._@\-]+\/)+[A-Za-z0-9._@\-]+/g, '<redacted-path>')
    .replace(/[A-Za-z]:\\(?:Users|home)\\[A-Za-z0-9._-]+(?:\\[A-Za-z0-9._@\-]+)+/g, '<redacted-path>')
    .replace(/\\\\[^\\/]+\\[^\\/]+(?:\\[^\\/]+)+/g, '<redacted-path>')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '<redacted-email>');
}

function sanitizeScalarString(value, label) {
  if (typeof value !== 'string') return value;
  const pathRedacted = redactPathLikeSegments(value);
  if (pathRedacted !== value) return pathRedacted;
  return `[sanitized:${label}]`;
}

function getExistingTokenEstimate(holder) {
  const entry = holder?.providerMetadata?.mastra?.tokenEstimate ?? holder?.metadata?.mastra?.tokenEstimate;
  if (!entry || typeof entry !== 'object') return null;
  if (typeof entry.tokens !== 'number') return null;
  return entry;
}

function countStringTokens(value) {
  if (!value) return 0;
  return encoder.encode(value, 'all').length;
}

function countJsonTokens(value) {
  return countStringTokens(JSON.stringify(value));
}

function resolveCanonicalEstimate(registryKey, tokens, source = DEFAULT_CACHE_SOURCE) {
  const existing = canonicalEstimateRegistry.get(registryKey);
  if (existing) {
    return existing;
  }

  const estimate = { tokens, source };
  canonicalEstimateRegistry.set(registryKey, estimate);
  return estimate;
}

function sanitizeUnknown(value, label) {
  if (typeof value === 'string') return sanitizeScalarString(value, label);
  if (Array.isArray(value)) return value.map((item, index) => sanitizeUnknown(item, `${label}:${index}`));
  if (!value || typeof value !== 'object') return value;

  const clone = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === 'reasoningEncryptedContent') {
      clone[key] = '[sanitized:reasoning-encrypted-content]';
      continue;
    }
    if (key === 'allowedPaths' && Array.isArray(child)) {
      clone[key] = child.map(() => '<redacted-path>');
      continue;
    }
    if (key === 'basePath' && typeof child === 'string') {
      clone[key] = '<redacted-path>';
      continue;
    }
    if (key === 'observations' && typeof child === 'string') {
      clone[key] = `[sanitized:${label}:observations]`;
      continue;
    }
    if (key === 'activeObservations' && typeof child === 'string') {
      clone[key] = `[sanitized:${label}:active-observations]`;
      continue;
    }
    if (key === 'bufferedReflection' && typeof child === 'string') {
      clone[key] = `[sanitized:${label}:buffered-reflection]`;
      continue;
    }
    if (key === 'observedTimezone' && typeof child === 'string') {
      clone[key] = 'UTC';
      continue;
    }
    if ((key === 'output' || key === 'stdout' || key === 'stderr') && typeof child === 'string') {
      clone[key] = sanitizeScalarString(child, `${label}:${key}`);
      continue;
    }

    clone[key] = sanitizeNode(child, `${label}:${key}`);
  }

  return clone;
}

function sanitizeToolPayload(value, label) {
  if (typeof value === 'string') return sanitizeScalarString(value, label);
  if (Array.isArray(value)) {
    return {
      redacted: label,
      type: 'array',
      itemCount: value.length,
    };
  }
  if (!value || typeof value !== 'object') return value;
  return {
    redacted: label,
    type: 'object',
    keys: Object.keys(value).sort(),
  };
}

function isToolRecordLike(value) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof value.toolName === 'string' &&
      (Object.prototype.hasOwnProperty.call(value, 'args') || Object.prototype.hasOwnProperty.call(value, 'result')),
  );
}

function sanitizeToolRecord(value, label) {
  const clone = { ...value };
  if (Object.prototype.hasOwnProperty.call(clone, 'args')) {
    clone.args = sanitizeToolPayload(clone.args, `${label}:args`);
  }
  if (Object.prototype.hasOwnProperty.call(clone, 'result')) {
    clone.result = sanitizeToolPayload(clone.result, `${label}:result`);
  }
  return clone;
}

function sanitizePart(part, label) {
  if (!part || typeof part !== 'object') return part;

  if (part.providerMetadata?.openai?.reasoningEncryptedContent) {
    part.providerMetadata.openai.reasoningEncryptedContent = '[sanitized:reasoning-encrypted-content]';
  }

  if (part.type === 'text') {
    const entry = getExistingTokenEstimate(part);
    const estimate = resolveCanonicalEstimate(
      `text:${label}`,
      entry?.tokens ?? countStringTokens(part.text ?? ''),
      entry?.source ?? DEFAULT_CACHE_SOURCE,
    );
    const sanitizedText = `[sanitized:text:${label}]`;
    part.text = sanitizedText;
    setPartEstimate(part, 'text', sanitizedText, estimate.tokens, estimate.source);
    if (part.metadata && typeof part.metadata === 'object') {
      part.metadata = sanitizeUnknown(part.metadata, `${label}:metadata`);
    }
    return part;
  }

  if (part.type === 'tool-invocation' && part.toolInvocation) {
    const invocation = part.toolInvocation;
    if (invocation.args !== undefined) {
      invocation.args = sanitizeToolPayload(invocation.args, `tool-args:${label}`);
    }

    if (invocation.state === 'call' || invocation.state === 'partial-call') {
      const entry = getExistingTokenEstimate(part);
      if (typeof invocation.args === 'string') {
        const estimate = resolveCanonicalEstimate(
          `tool-${invocation.state}-args:${label}`,
          entry?.tokens ?? countStringTokens(invocation.args),
          entry?.source ?? DEFAULT_CACHE_SOURCE,
        );
        setPartEstimate(part, `tool-${invocation.state}-args`, invocation.args, estimate.tokens, estimate.source);
      } else if (invocation.args !== undefined) {
        const argsJson = JSON.stringify(invocation.args);
        const estimate = resolveCanonicalEstimate(
          `tool-${invocation.state}-args-json:${label}`,
          entry?.tokens ?? countStringTokens(argsJson),
          entry?.source ?? DEFAULT_CACHE_SOURCE,
        );
        setPartEstimate(part, `tool-${invocation.state}-args-json`, argsJson, estimate.tokens, estimate.source);
      }
      return part;
    }

    if (invocation.state === 'result') {
      const entry = getExistingTokenEstimate(part);
      const hasStoredModelOutput = Object.prototype.hasOwnProperty.call(part.providerMetadata?.mastra ?? {}, 'modelOutput');
      const sanitizedResult = sanitizeToolPayload(invocation.result, `tool-result:${label}`);
      invocation.result = sanitizedResult;

      if (hasStoredModelOutput) {
        part.providerMetadata.mastra.modelOutput = sanitizeToolPayload(
          part.providerMetadata.mastra.modelOutput,
          `tool-model-output:${label}`,
        );
        const payload = part.providerMetadata.mastra.modelOutput;
        const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
        const estimate = resolveCanonicalEstimate(
          `${typeof payload === 'string' ? 'tool-result-model-output' : 'tool-result-model-output-json'}:${label}`,
          entry?.tokens ?? countStringTokens(serialized),
          entry?.source ?? DEFAULT_CACHE_SOURCE,
        );
        setPartEstimate(
          part,
          typeof payload === 'string' ? 'tool-result-model-output' : 'tool-result-model-output-json',
          serialized,
          estimate.tokens,
          estimate.source,
        );
      } else {
        const payload = invocation.result;
        const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
        const estimate = resolveCanonicalEstimate(
          `${typeof payload === 'string' ? 'tool-result' : 'tool-result-json'}:${label}`,
          entry?.tokens ?? countStringTokens(serialized),
          entry?.source ?? DEFAULT_CACHE_SOURCE,
        );
        setPartEstimate(
          part,
          typeof payload === 'string' ? 'tool-result' : 'tool-result-json',
          serialized,
          estimate.tokens,
          estimate.source,
        );
      }
    }

    return part;
  }

  if (part.type === 'reasoning') {
    if ('text' in part) {
      part.text = `[sanitized:reasoning:${label}]`;
    }
    if ('reasoning' in part) {
      part.reasoning = `[sanitized:reasoning:${label}]`;
    }
    if (part.providerMetadata?.openai?.reasoningEncryptedContent) {
      part.providerMetadata.openai.reasoningEncryptedContent = '[sanitized:reasoning-encrypted-content]';
    }
    return part;
  }

  if (typeof part.type === 'string' && part.type.startsWith('data-')) {
    for (const key of Object.keys(part)) {
      if (key === 'type') continue;
      part[key] = sanitizeUnknown(part[key], `${label}:${key}`);
    }
    return part;
  }

  const entry = getExistingTokenEstimate(part);
  const source = entry?.source ?? DEFAULT_CACHE_SOURCE;
  const originalTokens = entry?.tokens ?? countJsonTokens(part);
  const preservedType = part.type;
  const sanitizedPart = {
    type: preservedType,
    value: `[sanitized:part:${label}]`,
  };
  const sanitizedSerialized = JSON.stringify(sanitizedPart);
  const nextPart = {
    ...sanitizedPart,
    providerMetadata: part.providerMetadata,
  };
  setPartEstimate(nextPart, `part-${preservedType}`, sanitizedSerialized, originalTokens, source);
  return nextPart;
}

function sanitizeMessage(message, label) {
  if (!message || typeof message !== 'object') return message;

  if (typeof message.content === 'string') {
    const entry = getExistingTokenEstimate(message);
    const estimate = resolveCanonicalEstimate(
      `message-content:${message.id ?? label}`,
      entry?.tokens ?? countStringTokens(message.content),
      entry?.source ?? DEFAULT_CACHE_SOURCE,
    );
    const sanitizedContent = `[sanitized:message-content:${label}]`;
    message.content = sanitizedContent;
    setMessageEstimate(message, 'message-content', sanitizedContent, estimate.tokens, estimate.source);
    return sanitizeUnknown(message, label);
  }

  if (message.content && typeof message.content === 'object') {
    if (Array.isArray(message.content.parts)) {
      message.content.parts = message.content.parts.map((part, index) => sanitizePart(part, `${message.id ?? label}:${index}`));
      if (typeof message.content.content === 'string') {
        message.content.content = `[sanitized:content:${label}]`;
      }
    } else if (typeof message.content.content === 'string') {
      const entry = getExistingTokenEstimate(message);
      const estimate = resolveCanonicalEstimate(
        `content-content:${message.id ?? label}`,
        entry?.tokens ?? countStringTokens(message.content.content),
        entry?.source ?? DEFAULT_CACHE_SOURCE,
      );
      const sanitizedContent = `[sanitized:content:${label}]`;
      message.content.content = sanitizedContent;
      setMessageEstimate(message, 'content-content', sanitizedContent, estimate.tokens, estimate.source);
    }

    if (message.content.metadata && typeof message.content.metadata === 'object') {
      const preservedSealed = message.content.metadata?.mastra?.sealed;
      const preservedTokenEstimate = message.content.metadata?.mastra?.tokenEstimate;
      message.content.metadata = sanitizeUnknown(message.content.metadata, `${label}:content-metadata`);
      if (preservedSealed !== undefined || preservedTokenEstimate) {
        message.content.metadata.mastra ??= {};
        if (preservedSealed !== undefined) message.content.metadata.mastra.sealed = preservedSealed;
        if (preservedTokenEstimate) message.content.metadata.mastra.tokenEstimate = preservedTokenEstimate;
      }
    }
  }

  if (message.metadata && typeof message.metadata === 'object') {
    message.metadata = sanitizeUnknown(message.metadata, `${label}:metadata`);
  }

  return sanitizeUnknown(message, label);
}

function isMessageLike(value) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof value.role === 'string' &&
      Object.prototype.hasOwnProperty.call(value, 'content'),
  );
}

function sanitizeNode(node, label = 'value') {
  if (Array.isArray(node)) {
    return node.map((item, index) => sanitizeNode(item, `${label}:${index}`));
  }

  if (!node || typeof node !== 'object') {
    if (typeof node === 'string') return redactPathLikeSegments(node);
    return node;
  }

  if (isMessageLike(node)) {
    return sanitizeMessage(node, label);
  }

  if (isToolRecordLike(node)) {
    return sanitizeToolRecord(node, label);
  }

  const clone = Array.isArray(node) ? [] : {};
  for (const [key, value] of Object.entries(node)) {
    if (key === 'activeObservations' && typeof value === 'string') {
      clone[key] = `[sanitized:${label}:active-observations]`;
      continue;
    }
    if (key === 'bufferedReflection' && typeof value === 'string') {
      clone[key] = `[sanitized:${label}:buffered-reflection]`;
      continue;
    }
    if (key === 'observations' && typeof value === 'string') {
      clone[key] = `[sanitized:${label}:observations]`;
      continue;
    }
    if (key === 'reasoningEncryptedContent') {
      clone[key] = '[sanitized:reasoning-encrypted-content]';
      continue;
    }
    if (key === 'allowedPaths' && Array.isArray(value)) {
      clone[key] = value.map(() => '<redacted-path>');
      continue;
    }
    if (key === 'basePath' && typeof value === 'string') {
      clone[key] = '<redacted-path>';
      continue;
    }
    if (key === 'observedTimezone' && typeof value === 'string') {
      clone[key] = 'UTC';
      continue;
    }
    if ((key === 'output' || key === 'stdout' || key === 'stderr') && typeof value === 'string') {
      clone[key] = sanitizeScalarString(value, `${label}:${key}`);
      continue;
    }
    clone[key] = sanitizeNode(value, `${label}:${key}`);
  }

  return clone;
}

function main() {
  const { target, write } = parseArgs();
  const files = listJsonFiles(target);

  if (files.length === 0) {
    console.error(`No OM repro JSON files found under ${target}`);
    process.exit(1);
  }

  for (const file of files) {
    const original = JSON.parse(readFileSync(file, 'utf8'));
    const sanitized = sanitizeNode(original, relative(target, file) || 'fixture');
    const nextJson = `${JSON.stringify(sanitized, null, 2)}\n`;

    if (write) {
      writeFileSync(file, nextJson, 'utf8');
    }

    console.log(`${write ? 'sanitized' : 'preview'} ${relative(process.cwd(), file)}`);
  }
}

main();
