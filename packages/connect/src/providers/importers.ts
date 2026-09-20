/**
 * Barrel that registers each shipped knowledge importer provider with the
 * `IMPORTERS` list. Imported for side effects by `importers.ts`.
 */
import { registerImporterProvider } from '../importer-registry.js';

import { confluenceImporterRegistration } from './confluence/importer.js';
import { firefliesImporterRegistration } from './fireflies/importer.js';
import { jiraImporterRegistration } from './jira/importer.js';
import { linearImporterRegistration } from './linear/importer.js';
import { notionImporterRegistration } from './notion/importer.js';
import { zendeskImporterRegistration } from './zendesk/importer.js';

registerImporterProvider(confluenceImporterRegistration);
registerImporterProvider(firefliesImporterRegistration);
registerImporterProvider(jiraImporterRegistration);
registerImporterProvider(linearImporterRegistration);
registerImporterProvider(notionImporterRegistration);
registerImporterProvider(zendeskImporterRegistration);
