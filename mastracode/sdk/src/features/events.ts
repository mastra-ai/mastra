import { EventEmitter } from 'node:events';

import type { FeatureId } from './catalog.js';

/** Why a feature's packages are not available. */
export type FeatureUnavailableReason =
  /** Installing is turned off (`MASTRACODE_FEATURE_INSTALL=never` or `featureInstall: 'never'`). */
  | 'disabled'
  /** The registry could not be reached (offline, DNS, proxy). */
  | 'network'
  /** The registry refused the request (401/403). */
  | 'auth'
  /** The registry does not have the pinned version (common with lagging private mirrors). */
  | 'not-found'
  /** No npm executable was found to run the install. */
  | 'no-package-manager'
  /** Anything else; details are in the install log. */
  | 'failed';

export class FeatureNotInstalledError extends Error {
  readonly code = 'MASTRACODE_FEATURE_NOT_INSTALLED';
  readonly feature: FeatureId;
  readonly reason: FeatureUnavailableReason;
  /** One actionable sentence telling the user how to get the feature. */
  readonly remedy: string;
  /** Full package manager output, when an install was attempted. */
  readonly logPath?: string;

  constructor(
    feature: FeatureId,
    reason: FeatureUnavailableReason,
    message: string,
    options: { remedy: string; logPath?: string; cause?: unknown },
  ) {
    super(message, { cause: options.cause });
    this.name = 'FeatureNotInstalledError';
    this.feature = feature;
    this.reason = reason;
    this.remedy = options.remedy;
    this.logPath = options.logPath;
  }
}

export function isFeatureNotInstalledError(error: unknown): error is FeatureNotInstalledError {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'MASTRACODE_FEATURE_NOT_INSTALLED'
  );
}

/** Progress of a first-use install, for the TUI status line and headless output. */
export type FeatureInstallEvent =
  | { type: 'feature_install'; status: 'started'; feature: FeatureId; label: string; approxSizeMb: number }
  | { type: 'feature_install'; status: 'completed'; feature: FeatureId; label: string; durationMs: number }
  | {
      type: 'feature_install';
      status: 'failed' | 'disabled';
      feature: FeatureId;
      label: string;
      reason: FeatureUnavailableReason;
      message: string;
      remedy: string;
    };

const events = new EventEmitter();

/** Subscribe to first-use install progress. Returns an unsubscribe function. */
export function onFeatureInstall(listener: (event: FeatureInstallEvent) => void): () => void {
  events.on('event', listener);
  return () => events.off('event', listener);
}

export function emitFeatureInstall(event: FeatureInstallEvent): void {
  events.emit('event', event);
}

/** One line for a person: "Installing local embeddings for memory recall (about 325 MB, one time)…". */
export function formatFeatureInstallNotice(event: FeatureInstallEvent): string {
  switch (event.status) {
    case 'started':
      return `Installing ${event.label} (about ${event.approxSizeMb} MB, one time)…`;
    case 'completed':
      return `Installed ${event.label} in ${(event.durationMs / 1000).toFixed(1)} s.`;
    default:
      return `${event.label[0]!.toUpperCase()}${event.label.slice(1)} unavailable: ${event.message} ${event.remedy}`;
  }
}
