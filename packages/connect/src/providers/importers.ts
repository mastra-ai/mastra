/**
 * Barrel that registers each shipped knowledge importer provider with the
 * `IMPORTERS` list. Imported for side effects by `importers.ts`.
 */
import { registerImporterProvider } from '../importer-registry.js';

import { confluenceImporterRegistration } from './confluence/importer.js';
import { notionImporterRegistration } from './notion/importer.js';

registerImporterProvider(confluenceImporterRegistration);
registerImporterProvider(notionImporterRegistration);
