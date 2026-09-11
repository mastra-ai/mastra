# Platform connection tools

`@mastra/connect` exposes tools backed by connections attached to a Mastra Platform project. Provider credentials stay in the platform connection; tools send authenticated requests through its proxy.

## Neon, Resend, and incident.io

Attach an API-key connection to your project using integration ID `neon`, `resend`, or `incident-io`. Configure the platform project ID and platform access token, then pass the resolver to your agent's `tools` option:

```ts
import { connect } from '@mastra/connect';

const tools = connect({
  projectId: process.env.MASTRA_PROJECT_ID,
  client: { accessToken: process.env.MASTRA_PLATFORM_ACCESS_TOKEN },
  integrations: {
    neon: { allowTools: ['neon_list_projects', 'neon_list_branches'] },
    resend: { allowTools: ['resend_send_email', 'resend_get_email'] },
    'incident-io': { allowTools: ['incident_io_list_incidents', 'incident_io_list_follow_ups'] },
  },
});
```

The resolver discovers active project connections. Where multiple connections match, select one with `MASTRA_NEON_CONNECTION_ID`, `MASTRA_RESEND_CONNECTION_ID`, or `MASTRA_INCIDENT_IO_CONNECTION_ID`, or the integration's `connectionId` option. The `integrations` entries configure individual providers; they do not disable other attached providers. Set `disabled: true` on providers you want to exclude.

| Provider    | Tools | Scope                                                                                                                 |
| ----------- | ----- | --------------------------------------------------------------------------------------------------------------------- |
| Neon        | 50    | Projects, branches, operations, schemas, compute, databases, discovery, recovery, diagnostics, PostgreSQL roles       |
| Resend      | 8     | Send/get/list/cancel emails; create/get/list/verify domains                                                           |
| incident.io | 11    | List/get/create incidents; list/get/create/update follow-ups; list/get actions; list severities and incident statuses |

Tool inputs use provider field names. Mutations place their JSON request payload under `body`. For example, `resend_send_email` accepts:

```json
{
  "idempotency_key": "welcome-user-123",
  "body": {
    "from": "Team <team@example.com>",
    "to": ["reader@example.com"],
    "subject": "Welcome",
    "text": "Thanks for joining."
  }
}
```

Resend requires a verified sending domain and a key authorized for the operation. A sending-only key cannot list domains or access other account resources. Reuse the idempotency key when retrying the same send. Mastra's proxy runtime does not automatically retry POST requests, even when an upstream template permits retries.

List tools return one provider page and preserve its response envelope. When `next_cursor` is present, pass it as `cursor` for Neon or `after` for Resend and incident.io. Preserve filters and sort options between pages. Neon branch listing uses a different underlying cursor field from project listing; the tools expose both as `next_cursor`.

Neon SQL execution, password reveal/reset, connection-URI retrieval, and composed create-and-connect workflows are outside this catalog. incident.io uses v2 incidents, v3 follow-ups/actions, and v1 status/severity lookups; advanced object-valued incident filters are outside the initial tool inputs.

## Neon workflows

The 50 Neon tools cover 50 operations from the pinned Management API specification. Use `allowTools` to select the actions an agent needs.

| Group                            | Tools added                                                                                                                                                                                                                               |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Operation completion             | `neon_get_operation`, `neon_list_operations`                                                                                                                                                                                              |
| Schema inspection                | `neon_get_branch_schema`, `neon_compare_branch_schema`                                                                                                                                                                                    |
| Project and branch configuration | `neon_update_project`, `neon_update_branch`, `neon_set_default_branch`                                                                                                                                                                    |
| Compute lifecycle                | `neon_create_endpoint`, `neon_update_endpoint`, `neon_delete_endpoint`, `neon_start_endpoint`, `neon_suspend_endpoint`, `neon_restart_endpoint`, `neon_list_branch_endpoints`                                                             |
| Database lifecycle               | `neon_get_database`, `neon_create_database`, `neon_update_database`, `neon_delete_database`                                                                                                                                               |
| Discovery and access context     | `neon_list_regions`, `neon_get_auth_details`, `neon_list_organizations`, `neon_list_shared_projects`                                                                                                                                      |
| Recovery                         | `neon_create_snapshot`, `neon_list_snapshots`, `neon_update_snapshot`, `neon_delete_snapshot`, `neon_restore_snapshot`, `neon_get_snapshot_schedule`, `neon_set_snapshot_schedule`, `neon_restore_branch`, `neon_finalize_restore_branch` |
| Diagnostics                      | `neon_query_branch_logs`, `neon_list_branch_log_fields`, `neon_list_branch_log_field_values`, `neon_get_project_consumption`, `neon_get_branch_consumption`                                                                               |
| PostgreSQL roles                 | `neon_list_roles`, `neon_get_role`, `neon_create_role`, `neon_delete_role`                                                                                                                                                                |

Mutations return operation IDs without waiting for completion. Query operation status before depending on the resulting resource. Schema inspection requires `db_name`; LSN and timestamp selectors are mutually exclusive on each side of a comparison.

Consumption tools require `org_id`, `from`, `to`, `granularity`, and a nonempty `metrics` array. Branch consumption also requires `project_ids`. Arrays are serialized as comma-separated query values. Project consumption supports extra-branch and snapshot-storage metrics that branch consumption does not. Neon enforces plan eligibility and available history.

Log queries accept structured filters or `body.logql`. Resume with `body.cursor`, preserving time bounds and filters. Relative `since` cannot be combined with absolute `start_time`. Log field discovery retains the provider's truncation indicator.

Snapshot restore creates a preview branch by default. `body.finalize_restore: true` or a later `neon_finalize_restore_branch` moves computes to the restored branch and restarts them. Restoring a branch from itself requires a historical point and `preserve_under_name`; Neon checks any additional requirements imposed by existing children.

Database, compute, and role deletion preserve the normal HTTP 200 envelope. An already absent resource returns `{ deleted: true, already_absent: true }` for HTTP 204. The proxy adapter preserves response status and headers so generated tools can distinguish these cases.

Role creation supports `no_login` and validates the 63-byte UTF-8 role-name limit. Role responses preserve passwords when Neon returns them; project and branch creation can also return credentials. Dedicated password reveal/reset tools are not included.

## Template provenance

These tools are generated from three upstream contributions: [Neon](https://github.com/NangoHQ/integration-templates/pull/666), [Resend](https://github.com/NangoHQ/integration-templates/pull/667), and [incident.io](https://github.com/NangoHQ/integration-templates/pull/668). Until they land upstream, the maintainer generator pins the combined contribution commit in `rhysbalevicius/integration-templates`. Each new provider manifest records the repository, exact commit, and generated file checksums. Existing providers retain their original provenance.

See [maintainer generation commands](./scripts/README.md) and [third-party notices](./NOTICE.md). Tests use OpenAPI examples and synthetic fixtures; live provider calls require credentials and have not been validated by these fixture tests.
