import { externalAdapter } from './base.js';
import { stringValue } from './metadata-keys.js';

/** incident.io incidents (`INC-7`) and their follow-ups. */
export const incidentioWorkItemAdapter = externalAdapter('incidentio', {
  providerMetadataKeys: [
    'incident',
    'incidentioIncidentId',
    'incidentioItemType',
    'incidentioState',
    'incidentioStateType',
    'incidentioPriority',
    'incidentioAssignee',
    'incidentioDescription',
    // incident.io's own name for the item type ("Incident", "Follow-up").
    'source',
  ],
  kind: (source, metadata) =>
    metadata.incidentioItemType === 'incident' || source.externalId.startsWith('incidentio:incident:')
      ? 'incident'
      : 'follow_up',
  key: (_source, metadata) => stringValue(metadata.identifier),
  state: (_source, metadata) => stringValue(metadata.incidentioState) ?? stringValue(metadata.state),
  author: metadata => stringValue(metadata.author) ?? stringValue(metadata.creator),
});
