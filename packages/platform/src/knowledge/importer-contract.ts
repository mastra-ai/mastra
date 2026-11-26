import type { KnowledgeImporterClass } from '@mastra/core/knowledge';
import type { PlatformKnowledgeImporterClass } from './index';

// Type-only contract, checked by this package's typecheck: every core importer class fits the shape
// PlatformKnowledge declares for itself, so that copy can't drift from core's type unnoticed. Delete
// this file when `importers` takes core's `KnowledgeImporterClass` directly.
declare const coreClass: KnowledgeImporterClass;
export const coreClassFits: PlatformKnowledgeImporterClass = coreClass;

declare const plainObject: { id: string; toManifest(): { id: string; label: string } };
// @ts-expect-error an object that can't be constructed is not an importer class
export const plainObjectFits: PlatformKnowledgeImporterClass = plainObject;
