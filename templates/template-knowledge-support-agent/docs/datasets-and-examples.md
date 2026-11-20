# Datasets and examples

The default retail support example uses Square Terminal reference summaries and an example team policy. Run `npm run knowledge:seed` to load the initial dataset for the selected example. Load the retail history separately when you want fictional cases in customer history.

| Dataset                | Contents                                                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `retail-pos-docs`      | Network, payment and printer guides, plus the standing safety policy. This is the retail default.                      |
| `retail-pos-history`   | Fictional case history and follow-up notes for two customers and a second tenant.                                      |
| `software-integration` | An HTTP authentication guide, an integration policy and one fictional case. This is the software integration default.  |
| `it-helpdesk`          | Portuguese Windows configuration guide, its own standing policy, and approved fictional history for two access groups. |
| `retail-pos`           | Earlier retail example with the `north-*` and `south-store` profiles.                                                  |

## Add a support case

1. Add a Markdown file next to the [retail history manifest](../knowledge-datasets/retail-pos/history-manifest.json). Describe the reported symptom, what the technician observed, and what remains open or how the fix was verified.
2. Add a page to the manifest. Give it a stable `key` and a unique `path` under `cases/`. Select the registered customer profile in `scope.profile`. Use `record` to make the case eligible for the agent's customer-history lookup.
3. Run `npm run knowledge:seed -- --dataset retail-pos-history --dry-run` to preview the destinations. Apply the same command without `--dry-run`, then ask about the case topic in a fresh **Support** chat for that customer.

For example, save the case narrative in `terminal-network-check.md` and add this entry to the `pages` array.

```json
{
  "key": "terminal-network-check",
  "path": "cases/terminal-network-check",
  "title": "Terminal connection drops during opening checks",
  "file": "terminal-network-check.md",
  "scope": {
    "kind": "customer",
    "profile": "retailops-store-42"
  },
  "kind": "case",
  "source": {
    "kind": "Fictional technician report"
  },
  "record": {
    "topicTags": ["connectivity"],
    "observedOn": "2026-11-18",
    "state": "open",
    "summary": "The terminal lost connectivity twice during opening checks.",
    "applicability": "The selected Wi-Fi network and connection indicator still need verification."
  }
}
```

Use `open` for unconfirmed observations and `approved` for verified outcomes. Add dated follow-ups under `notes` with stable keys and text. See the existing [Wi-Fi case entry](../knowledge-datasets/retail-pos/history-manifest.json) for an attributed note. Topic tags connect case records to the domain vocabulary in the runtime example.

## Adapt the template to your application

1. **Define who can access the information.** Add tenant, customer, technician, and reviewer identities in the [runtime example configuration](../src/examples/runtime.ts). Use distinct actor IDs for technicians and reviewers. A customer scope is derived from both the tenant and customer IDs.
2. **Organize your content.** Put a schema-version-1 manifest and its Markdown files under `knowledge-datasets/`. Give the manifest a stable dataset ID and set its version. Use `docs` for shared references, `tenant` for tenant guidance and policy, and `customer` for private case history. Use a registered profile as the scope anchor. Add source attribution to imported references and use page aliases in `links` for relationships within the same manifest.
3. **Register the dataset and policy.** Map the dataset directory, manifest, allowed profiles, and mandatory policy page aliases in the use case's typed `datasets` field in [runtime.ts](../src/examples/runtime.ts). [datasets.ts](../src/examples/datasets.ts) derives the seed registry, preserving the existing dataset aliases. Put the required policy at that use case's configured Knowledge path. Keep it concise so Studio can deliver it in full.
4. **Set the initial context.** Give the runtime example an `initialDataset`, shared model ID, response `locale`, domain instructions, topic terms, policy path, guide listing, private case roots, and shared finding root. [support.ts](../src/examples/support.ts) exposes this selected configuration to the unchanged core. Topic matching accepts Unicode letters, including accented Portuguese. Use `selectProfile(example, id)` for stable profile selection instead of array positions. Preview and apply the dataset, then try a support question using each relevant profile.

## Try the software integration example

Stop the running retail Studio server. From a separate shell in the project directory, select the software integration example and its own local database.

```sh
export SUPPORT_EXAMPLE=software-integration
export SUPPORT_DATABASE_URL="file:$PWD/.local/integration.db"
npm run knowledge:seed
npm run dev
```

Use the `integration-team` token. In **Support**, ask “Our HTTP integration returned 401. What evidence should I check?” Look for a citation to the RFC 9110 guide, a question about the authentication challenge, and the applicability of the fictional case. To exercise review, submit a structured fictional confirmation as `integration-team` and use the `integration-reviewer` token for **Review** with its returned reference. Follow the [confirmation and review steps](studio-walkthrough.md#2-confirm-and-review-a-private-finding).

## Try the Portuguese IT helpdesk example

Stop the running server, then select the use case and an isolated local database in the same shell used for both commands.

```sh
export SUPPORT_EXAMPLE=it-helpdesk
export SUPPORT_DATABASE_URL="file:$PWD/.local/helpdesk.db"
npm run knowledge:seed -- --dry-run
npm run knowledge:seed
npm run dev
```

Use `helpdesk-office` in **Support** and ask “Preciso investigar uma conexão e sua configuração.” Expect Portuguese guidance grounded in the Microsoft Learn summary, the `tenant:helpdesk#policies/helpdesk-safety` policy, and the approved fictional office history. `ipconfig /all` displays TCP/IP configuration; a configuration observation alone does not prove a cause or resolution.

| Profile                    | Actor   | Customer scope             | Access                                                          |
| -------------------------- | ------- | -------------------------- | --------------------------------------------------------------- |
| `helpdesk-office`          | `ana`   | `customer:helpdesk:office` | Technician                                                      |
| `helpdesk-colleague`       | `clara` | `customer:helpdesk:office` | Technician, shared customer history with a private conversation |
| `helpdesk-reviewer`        | `davi`  | `customer:helpdesk:office` | Independent reviewer                                            |
| `helpdesk-branch`          | `bruno` | `customer:helpdesk:branch` | Technician                                                      |
| `helpdesk-branch-reviewer` | `elisa` | `customer:helpdesk:branch` | Independent reviewer                                            |

Both groups read the same helpdesk guide and policy; neither reads the other's private cases or conversations. In **Knowledge**, inspect `customer:helpdesk:office#cases/network-check` with the office token and check that the branch token cannot open it. The branch has its own fictional case at the same path under its own scope.

Follow the [structured confirmation steps](studio-walkthrough.md#2-confirm-and-review-a-private-finding), using the `helpdesk-office` token and its Studio thread. For example:

```json
{
  "threadId": "<office technician thread from Studio URL>",
  "observation": "O operador identificou o adaptador ativo na consulta local sem copiar identificadores privados.",
  "outcome": "Com autorização, a seleção incorreta foi corrigida e três verificações tiveram sucesso. Referência pública docs:helpdesk#guides/network-configuration, versão 1."
}
```

Paste the returned `confirmationReference` and `audience: "private"` into **Review** as `helpdesk-reviewer`. Inspect and approve the proposal using its exact revision, or reject it and verify that nothing was published. A branch reviewer cannot review this source. To try tenant publication, create a separate review with `audience: "tenant"` and inspect the public source and sanitization before deciding.

Adding this use case changed configuration and dataset files; the Knowledge, preflight, confirmation, and review implementations are shared. All three supplied use cases use `OPENAI_API_KEY` and the model in their configuration. `SUPPORT_MODEL_BASE_URL` preserves the OpenAI-compatible wire override used by deterministic tests.

## Manage local seed data

- Studio and the seed command default to `.local/support.db`. Export the same `SUPPORT_DATABASE_URL` for both commands to use a different persistent local file. The seed command reads the shell environment.
- Reapplying a dataset preserves IDs and versions for unchanged content. Keep dataset, page, and note keys stable so the seed can identify its records. Removed manifest entries are retained and reported by stored ID.
- Privileged writes share a lock in the database's `.writer.sqlite` sidecar. If seeding exits with code `75`, retry after the active writer exits. The operating system releases the lock even if the writer crashes. Keep the sidecar in place while the database is in use.
- Tenant-wide publication requires an HTTPS source declared in the documentation page's seed manifest. Rerun the seed after upgrading to record source provenance for existing documentation.
