import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools, runReadBatch, probeTool } from '../scenario.js';

/**
 * Deep incident.io scenario: follow-up + action CRUD on an existing real
 * incident, plus the broad read-only catalog/incident/schedule/alert surface.
 *
 * Creating or transitioning real incidents / sending incident updates / sending
 * alerts drives paging and side effects, so those mutators are only probed with
 * synthetic IDs. Routing is still exercised: a 404/400 from the real API after
 * reaching the right endpoint proves the tool wiring works.
 */
export const incidentIoScenario: Scenario = {
  integrationId: 'incident-io',
  summary: 'follow-up + action CRUD + full catalog/incident/schedule/alert surface',
  async run({ tools, runId, call, log }) {
    const steps: ScenarioStep[] = [];
    const missing = requireTools(tools, [
      'incident_io_list_incidents',
      'incident_io_create_follow_up',
      'incident_io_delete_follow_up',
    ]);
    if (missing) {
      steps.push({ name: 'preflight', status: 'skip', detail: missing });
      return steps;
    }

    // ---- pick an existing incident so we can hang follow-ups/actions on it ----
    const incidents = await call<{ items?: Array<{ id?: string }> }>('incident_io_list_incidents', { page_size: 1 });
    const incidentId = incidents.items?.[0]?.id;
    if (!incidentId) {
      steps.push(makeStep('pick incident', 'incident_io_list_incidents', 'skip', 'No incidents visible to the token.'));
      return steps;
    }
    steps.push(makeStep('pick incident', 'incident_io_list_incidents', 'pass', incidentId));

    // ---- broad read-only surface ----
    steps.push(
      ...(await runReadBatch(
        call,
        [
          ['incident_io_list_users', { page_size: 5 }],
          ['incident_io_list_teams', { page_size: 5 }],
          ['incident_io_list_severities', {}],
          ['incident_io_list_incident_types', {}],
          ['incident_io_list_incident_statuses', {}],
          ['incident_io_list_incident_roles', {}],
          ['incident_io_list_schedules', { page_size: 5 }],
          ['incident_io_list_catalog_types', {}],
          ['incident_io_list_catalog_resources', {}],
          ['incident_io_list_follow_ups', { page_size: 5 }],
          ['incident_io_list_actions', { page_size: 5 }],
          ['incident_io_list_alerts', { page_size: 5 }],
          ['incident_io_list_alert_tags', { page_size: 5 }],
          ['incident_io_list_incident_alerts', { incident_id: incidentId, page_size: 5 }],
          ['incident_io_list_incident_participants', { incident_id: incidentId }],
          ['incident_io_list_incident_participant_workloads', { incident_id: incidentId }],
          ['incident_io_list_incident_timeline_items', { incident_id: incidentId, page_size: 5 }],
          ['incident_io_list_incident_timestamps', {}],
          ['incident_io_list_incident_updates', { incident_id: incidentId, page_size: 5 }],
          ['incident_io_list_postmortem_documents', { page_size: 5 }],
        ],
        tools,
      )),
    );

    // ---- single-entity reads: derive an ID from the broad lists where possible ----
    type Listed = { items?: Array<{ id?: string }> };
    const safeList = async (id: string, input: unknown): Promise<Listed> => {
      try {
        return await call<Listed>(id, input);
      } catch {
        return {};
      }
    };
    const [
      users,
      teams,
      severities,
      incidentStatuses,
      incidentTypes,
      incidentRoles,
      timestamps,
      catalogTypes,
      schedules,
      alerts,
    ] = await Promise.all([
      safeList('incident_io_list_users', { page_size: 1 }),
      safeList('incident_io_list_teams', { page_size: 1 }),
      safeList('incident_io_list_severities', {}),
      safeList('incident_io_list_incident_statuses', {}),
      safeList('incident_io_list_incident_types', {}),
      safeList('incident_io_list_incident_roles', {}),
      safeList('incident_io_list_incident_timestamps', {}),
      safeList('incident_io_list_catalog_types', {}),
      safeList('incident_io_list_schedules', { page_size: 1 }),
      safeList('incident_io_list_alerts', { page_size: 1 }),
    ]);

    const userId = users.items?.[0]?.id;
    const teamId = teams.items?.[0]?.id;
    const severityId = severities.items?.[0]?.id;
    const incidentStatusId = incidentStatuses.items?.[0]?.id;
    const incidentTypeId = incidentTypes.items?.[0]?.id;
    const incidentRoleId = incidentRoles.items?.[0]?.id;
    const timestampId = timestamps.items?.[0]?.id;
    const catalogTypeId = catalogTypes.items?.[0]?.id;
    const scheduleId = schedules.items?.[0]?.id;
    const alertId = alerts.items?.[0]?.id;

    const probeId = (id: string | undefined, fallback: string) => id ?? fallback;

    // Reads that require a parent id; probe with a synthetic one when the
    // workspace has no such resource (404 still proves endpoint routing).
    steps.push(
      await probeTool(call, tools, 'list catalog entries', 'incident_io_list_catalog_entries', {
        catalog_type_id: probeId(catalogTypeId, `catalog-type-smoke-${runId}`),
      }),
    );
    const scheduleProbeId = probeId(scheduleId, `schedule-smoke-${runId}`);
    steps.push(
      await probeTool(call, tools, 'list schedule entries', 'incident_io_list_schedule_entries', {
        schedule_id: scheduleProbeId,
      }),
    );
    steps.push(
      await probeTool(call, tools, 'list schedule overrides', 'incident_io_list_schedule_overrides', {
        schedule_id: scheduleProbeId,
      }),
    );
    steps.push(
      await probeTool(call, tools, 'list schedule replicas', 'incident_io_list_schedule_replicas', {
        schedule_id: scheduleProbeId,
      }),
    );
    steps.push(
      await probeTool(call, tools, 'list schedule sync rules', 'incident_io_list_schedule_sync_rules', {
        schedule_id: scheduleProbeId,
      }),
    );
    const userProbeId = probeId(userId, `01000000-0000-0000-0000-${runId.padEnd(12, '0').slice(-12)}`);
    steps.push(
      await probeTool(call, tools, 'list user notification methods', 'incident_io_list_user_notification_methods', {
        user_id: userProbeId,
      }),
    );
    steps.push(
      await probeTool(call, tools, 'list user notification rules', 'incident_io_list_user_notification_rules', {
        user_id: userProbeId,
      }),
    );

    if (tools['incident_io_get_incident']) {
      try {
        await call('incident_io_get_incident', { id: incidentId });
        steps.push(makeStep('read incident', 'incident_io_get_incident', 'pass'));
      } catch (error) {
        steps.push(makeStep('read incident', 'incident_io_get_incident', 'fail', errorMessage(error)));
      }
    }
    if (tools['incident_io_get_user']) {
      steps.push(
        await probeTool(call, tools, 'read user', 'incident_io_get_user', {
          id: probeId(userId, `01000000-0000-0000-0000-${runId.padEnd(12, '0').slice(-12)}`),
        }),
      );
    }
    if (tools['incident_io_get_user_paging_provider']) {
      steps.push(
        await probeTool(call, tools, 'read user paging provider', 'incident_io_get_user_paging_provider', {
          user_id: probeId(userId, `01000000-0000-0000-0000-${runId.padEnd(12, '0').slice(-12)}`),
        }),
      );
    }
    if (tools['incident_io_get_team']) {
      steps.push(
        await probeTool(call, tools, 'read team', 'incident_io_get_team', {
          id: probeId(teamId, `team-smoke-${runId}`),
        }),
      );
    }
    if (tools['incident_io_get_severity']) {
      steps.push(
        await probeTool(call, tools, 'read severity', 'incident_io_get_severity', {
          id: probeId(severityId, `severity-smoke-${runId}`),
        }),
      );
    }
    if (tools['incident_io_get_incident_status']) {
      steps.push(
        await probeTool(call, tools, 'read incident status', 'incident_io_get_incident_status', {
          id: probeId(incidentStatusId, `status-smoke-${runId}`),
        }),
      );
    }
    if (tools['incident_io_get_incident_type']) {
      steps.push(
        await probeTool(call, tools, 'read incident type', 'incident_io_get_incident_type', {
          id: probeId(incidentTypeId, `type-smoke-${runId}`),
        }),
      );
    }
    if (tools['incident_io_get_incident_role']) {
      steps.push(
        await probeTool(call, tools, 'read incident role', 'incident_io_get_incident_role', {
          id: probeId(incidentRoleId, `role-smoke-${runId}`),
        }),
      );
    }
    if (tools['incident_io_get_incident_timestamp']) {
      steps.push(
        await probeTool(call, tools, 'read incident timestamp', 'incident_io_get_incident_timestamp', {
          id: probeId(timestampId, `timestamp-smoke-${runId}`),
        }),
      );
    }
    if (tools['incident_io_get_catalog_type']) {
      steps.push(
        await probeTool(call, tools, 'read catalog type', 'incident_io_get_catalog_type', {
          id: probeId(catalogTypeId, `catalog-smoke-${runId}`),
        }),
      );
    }
    if (tools['incident_io_get_catalog_entry']) {
      steps.push(
        await probeTool(call, tools, 'read catalog entry', 'incident_io_get_catalog_entry', {
          id: `entry-smoke-${runId}`,
          expand: false,
        }),
      );
    }
    if (tools['incident_io_get_schedule']) {
      steps.push(
        await probeTool(call, tools, 'read schedule', 'incident_io_get_schedule', {
          id: probeId(scheduleId, `schedule-smoke-${runId}`),
        }),
      );
    }
    if (tools['incident_io_get_schedule_override']) {
      steps.push(
        await probeTool(call, tools, 'read schedule override', 'incident_io_get_schedule_override', {
          id: `override-smoke-${runId}`,
        }),
      );
    }
    if (tools['incident_io_get_schedule_replica']) {
      steps.push(
        await probeTool(call, tools, 'read schedule replica', 'incident_io_get_schedule_replica', {
          schedule_id: probeId(scheduleId, `schedule-smoke-${runId}`),
          id: `replica-smoke-${runId}`,
        }),
      );
    }
    if (tools['incident_io_get_schedule_sync_rule']) {
      steps.push(
        await probeTool(call, tools, 'read schedule sync rule', 'incident_io_get_schedule_sync_rule', {
          schedule_id: probeId(scheduleId, `schedule-smoke-${runId}`),
          id: `rule-smoke-${runId}`,
        }),
      );
    }
    if (tools['incident_io_get_postmortem_document']) {
      steps.push(
        await probeTool(call, tools, 'read postmortem', 'incident_io_get_postmortem_document', {
          id: `pm-smoke-${runId}`,
        }),
      );
    }
    if (tools['incident_io_get_postmortem_document_content']) {
      steps.push(
        await probeTool(call, tools, 'read postmortem content', 'incident_io_get_postmortem_document_content', {
          id: `pm-smoke-${runId}`,
        }),
      );
    }
    if (tools['incident_io_get_alert']) {
      steps.push(
        await probeTool(call, tools, 'read alert', 'incident_io_get_alert', {
          id: probeId(alertId, `alert-smoke-${runId}`),
        }),
      );
    }

    // ---- action lifecycle tied to real incident ----
    let actionId: string | undefined;
    if (tools['incident_io_create_action']) {
      try {
        const action = await call<{ action?: { id?: string }; id?: string }>('incident_io_create_action', {
          body: {
            incident_id: incidentId,
            description: `${runId} smoke action — safe to delete`,
          },
        });
        actionId = action.action?.id ?? action.id;
        steps.push(makeStep('create action', 'incident_io_create_action', 'pass', actionId));
      } catch (error) {
        steps.push(makeStep('create action', 'incident_io_create_action', 'fail', errorMessage(error)));
      }
    }
    if (actionId && tools['incident_io_get_action']) {
      try {
        await call('incident_io_get_action', { id: actionId });
        steps.push(makeStep('read action', 'incident_io_get_action', 'pass'));
      } catch (error) {
        steps.push(makeStep('read action', 'incident_io_get_action', 'fail', errorMessage(error)));
      }
    } else if (tools['incident_io_get_action']) {
      steps.push(
        await probeTool(call, tools, 'read action', 'incident_io_get_action', { id: `action-smoke-${runId}` }),
      );
    }
    if (actionId && tools['incident_io_update_action']) {
      try {
        await call('incident_io_update_action', {
          id: actionId,
          body: {
            description: `${runId} smoke action (updated)`,
            status: 'not_doing',
          },
        });
        steps.push(makeStep('update action', 'incident_io_update_action', 'pass'));
      } catch (error) {
        steps.push(makeStep('update action', 'incident_io_update_action', 'fail', errorMessage(error)));
      }
    } else if (tools['incident_io_update_action']) {
      steps.push(
        await probeTool(call, tools, 'update action', 'incident_io_update_action', {
          id: `action-smoke-${runId}`,
          body: { description: 'smoke', status: 'not_doing' },
        }),
      );
    }
    if (actionId && tools['incident_io_delete_action']) {
      try {
        await call('incident_io_delete_action', { id: actionId });
        steps.push(makeStep('delete action', 'incident_io_delete_action', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke action ${actionId}`, errorMessage(error));
        steps.push(makeStep('delete action', 'incident_io_delete_action', 'fail', errorMessage(error)));
      }
    } else if (tools['incident_io_delete_action']) {
      steps.push(
        await probeTool(call, tools, 'delete action', 'incident_io_delete_action', { id: `action-smoke-${runId}` }),
      );
    }

    // ---- destructive mutators probed with synthetic IDs only ----
    // Never pass real incident or alert ids here: these endpoints rename
    // incidents, post updates that page responders, and resolve live alerts.
    // Synthetic ids make the API reject the request after routing.
    const syntheticIncidentId = `incident-smoke-${runId}`;
    const syntheticAlertId = `alert-smoke-${runId}`;
    if (tools['incident_io_create_incident']) {
      steps.push(
        await probeTool(call, tools, 'create incident', 'incident_io_create_incident', {
          body: {
            idempotency_key: `smoke-${runId}`,
            visibility: 'public',
            name: `${runId} smoke incident`,
            // Invalid severity id guarantees a 4xx before any incident is declared.
            severity_id: `severity-smoke-${runId}`,
          },
        }),
      );
    }
    if (tools['incident_io_update_incident']) {
      steps.push(
        await probeTool(call, tools, 'update incident', 'incident_io_update_incident', {
          id: syntheticIncidentId,
          body: {
            incident: { name: `${runId} smoke update (probe)` },
            notify_incident_channel: false,
          },
        }),
      );
    }
    if (tools['incident_io_create_incident_update']) {
      steps.push(
        await probeTool(call, tools, 'create incident update', 'incident_io_create_incident_update', {
          body: {
            idempotency_key: `smoke-update-${runId}`,
            incident_id: syntheticIncidentId,
            message: `${runId} smoke update (probe)`,
          },
        }),
      );
    }
    if (tools['incident_io_create_incident_timeline_item']) {
      steps.push(
        await probeTool(call, tools, 'create timeline item', 'incident_io_create_incident_timeline_item', {
          body: {
            idempotency_key: `smoke-timeline-${runId}`,
            incident_id: syntheticIncidentId,
            timestamp: new Date().toISOString(),
            title: `${runId} smoke timeline item`,
            description: 'Probe only — safe to delete.',
          },
        }),
      );
    }
    if (tools['incident_io_update_incident_timeline_item']) {
      steps.push(
        await probeTool(call, tools, 'update timeline item', 'incident_io_update_incident_timeline_item', {
          id: `timeline-smoke-${runId}`,
          body: { title: `${runId} smoke timeline update` },
        }),
      );
    }
    if (tools['incident_io_create_incident_alert']) {
      steps.push(
        await probeTool(call, tools, 'create incident alert', 'incident_io_create_incident_alert', {
          body: {
            alert_id: syntheticAlertId,
            incident_id: syntheticIncidentId,
          },
        }),
      );
    }
    if (tools['incident_io_transition_incident_alert']) {
      steps.push(
        await probeTool(call, tools, 'transition incident alert', 'incident_io_transition_incident_alert', {
          id: `incident-alert-smoke-${runId}`,
          body: { state: 'unrelated' },
        }),
      );
    }
    if (tools['incident_io_add_alert_tags']) {
      steps.push(
        await probeTool(call, tools, 'add alert tags', 'incident_io_add_alert_tags', {
          id: syntheticAlertId,
          body: { tags: [`smoke-${runId}`] },
        }),
      );
    }
    if (tools['incident_io_set_alert_tags']) {
      steps.push(
        await probeTool(call, tools, 'set alert tags', 'incident_io_set_alert_tags', {
          id: syntheticAlertId,
          body: { tags: [`smoke-set-${runId}`] },
        }),
      );
    }
    if (tools['incident_io_remove_alert_tags']) {
      steps.push(
        await probeTool(call, tools, 'remove alert tags', 'incident_io_remove_alert_tags', {
          id: syntheticAlertId,
          body: { tags: [`smoke-${runId}`] },
        }),
      );
    }
    if (tools['incident_io_resolve_alert']) {
      steps.push(
        await probeTool(call, tools, 'resolve alert', 'incident_io_resolve_alert', {
          id: syntheticAlertId,
        }),
      );
    }

    // ---- follow-up lifecycle (unchanged) ----
    let followUpId: string | undefined;
    try {
      const followUp = await call<{ id: string }>('incident_io_create_follow_up', {
        body: {
          incident_id: incidentId,
          title: `${runId} smoke follow-up`,
          description: 'Automated @mastra/connect smoke test. Safe to delete.',
        },
      });
      followUpId = followUp.id;
      steps.push(makeStep('create follow-up', 'incident_io_create_follow_up', 'pass', followUpId));
    } catch (error) {
      steps.push(makeStep('create follow-up', 'incident_io_create_follow_up', 'fail', errorMessage(error)));
    }

    if (followUpId && tools['incident_io_update_follow_up']) {
      try {
        await call('incident_io_update_follow_up', {
          id: followUpId,
          body: {
            title: `${runId} smoke follow-up (edited)`,
            status: 'outstanding',
          },
        });
        steps.push(makeStep('update follow-up', 'incident_io_update_follow_up', 'pass'));
      } catch (error) {
        steps.push(makeStep('update follow-up', 'incident_io_update_follow_up', 'fail', errorMessage(error)));
      }
    }

    if (followUpId && tools['incident_io_get_follow_up']) {
      try {
        await call('incident_io_get_follow_up', { id: followUpId });
        steps.push(makeStep('read follow-up', 'incident_io_get_follow_up', 'pass'));
      } catch (error) {
        steps.push(makeStep('read follow-up', 'incident_io_get_follow_up', 'fail', errorMessage(error)));
      }
    }

    if (tools['incident_io_connect_follow_up_external_issue']) {
      steps.push(
        await probeTool(
          call,
          tools,
          'connect follow-up external issue',
          'incident_io_connect_follow_up_external_issue',
          {
            id: followUpId ?? `follow-up-smoke-${runId}`,
            body: {
              provider: 'github',
              issue_permalink: 'https://github.com/mastra-smoke/incident-io/issues/1',
            },
          },
        ),
      );
    }

    if (followUpId) {
      try {
        await call('incident_io_delete_follow_up', { id: followUpId });
        steps.push(makeStep('delete follow-up', 'incident_io_delete_follow_up', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke follow-up ${followUpId}`, errorMessage(error));
        steps.push(makeStep('delete follow-up', 'incident_io_delete_follow_up', 'fail', errorMessage(error)));
      }
    }

    return steps;
  },
};
