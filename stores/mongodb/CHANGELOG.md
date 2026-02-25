# @mastra/mongodb

## 1.5.2-alpha.0

### Patch Changes

- Fixed observation activation to always preserve a minimum amount of context. Previously, swapping buffered observation chunks could unexpectedly drop the context window to near-zero tokens. ([#13476](https://github.com/mastra-ai/mastra/pull/13476))

- Add a clear runtime error when `queryVector` is omitted for vector stores that require a vector for queries. Previously, omitting `queryVector` would produce confusing SDK-level errors; now each store throws a structured `MastraError` with `ErrorCategory.USER` explaining that metadata-only queries are not supported by that backend. ([#13286](https://github.com/mastra-ai/mastra/pull/13286))

- Updated dependencies [[`df170fd`](https://github.com/mastra-ai/mastra/commit/df170fd139b55f845bfd2de8488b16435bd3d0da), [`ae55343`](https://github.com/mastra-ai/mastra/commit/ae5534397fc006fd6eef3e4f80c235bcdc9289ef), [`c290cec`](https://github.com/mastra-ai/mastra/commit/c290cec5bf9107225de42942b56b487107aa9dce), [`f03e794`](https://github.com/mastra-ai/mastra/commit/f03e794630f812b56e95aad54f7b1993dc003add), [`aa4a5ae`](https://github.com/mastra-ai/mastra/commit/aa4a5aedb80d8d6837bab8cbb2e301215d1ba3e9), [`de3f584`](https://github.com/mastra-ai/mastra/commit/de3f58408752a8d80a295275c7f23fc306cf7f4f), [`d3fb010`](https://github.com/mastra-ai/mastra/commit/d3fb010c98f575f1c0614452667396e2653815f6), [`702ee1c`](https://github.com/mastra-ai/mastra/commit/702ee1c41be67cc532b4dbe89bcb62143508f6f0), [`f495051`](https://github.com/mastra-ai/mastra/commit/f495051eb6496a720f637fc85b6d69941c12554c), [`e622f1d`](https://github.com/mastra-ai/mastra/commit/e622f1d3ab346a8e6aca6d1fe2eac99bd961e50b), [`861f111`](https://github.com/mastra-ai/mastra/commit/861f11189211b20ddb70d8df81a6b901fc78d11e), [`00f43e8`](https://github.com/mastra-ai/mastra/commit/00f43e8e97a80c82b27d5bd30494f10a715a1df9), [`1b6f651`](https://github.com/mastra-ai/mastra/commit/1b6f65127d4a0d6c38d0a1055cb84527db529d6b), [`96a1702`](https://github.com/mastra-ai/mastra/commit/96a1702ce362c50dda20c8b4a228b4ad1a36a17a), [`cb9f921`](https://github.com/mastra-ai/mastra/commit/cb9f921320913975657abb1404855d8c510f7ac5), [`114e7c1`](https://github.com/mastra-ai/mastra/commit/114e7c146ac682925f0fb37376c1be70e5d6e6e5), [`1b6f651`](https://github.com/mastra-ai/mastra/commit/1b6f65127d4a0d6c38d0a1055cb84527db529d6b), [`72df4a8`](https://github.com/mastra-ai/mastra/commit/72df4a8f9bf1a20cfd3d9006a4fdb597ad56d10a)]:
  - @mastra/core@1.8.0-alpha.0

## 1.5.1

### Patch Changes

- Prompt blocks can now define their own variables schema (`requestContextSchema`), allowing you to create reusable prompt blocks with typed variable placeholders. The server now correctly computes and returns draft/published status for prompt blocks. Existing databases are automatically migrated when upgrading. ([#13351](https://github.com/mastra-ai/mastra/pull/13351))

- Updated dependencies [[`24284ff`](https://github.com/mastra-ai/mastra/commit/24284ffae306ddf0ab83273e13f033520839ef40), [`f5097cc`](https://github.com/mastra-ai/mastra/commit/f5097cc8a813c82c3378882c31178320cadeb655), [`71e237f`](https://github.com/mastra-ai/mastra/commit/71e237fa852a3ad9a50a3ddb3b5f3b20b9a8181c), [`13a291e`](https://github.com/mastra-ai/mastra/commit/13a291ebb9f9bca80befa0d9166b916bb348e8e9), [`397af5a`](https://github.com/mastra-ai/mastra/commit/397af5a69f34d4157f51a7c8da3f1ded1e1d611c), [`d4701f7`](https://github.com/mastra-ai/mastra/commit/d4701f7e24822b081b70f9c806c39411b1a712e7), [`2b40831`](https://github.com/mastra-ai/mastra/commit/2b40831dcca2275c9570ddf09b7f25ba3e8dc7fc), [`6184727`](https://github.com/mastra-ai/mastra/commit/6184727e812bf7a65cee209bacec3a2f5a16e923), [`0c338b8`](https://github.com/mastra-ai/mastra/commit/0c338b87362dcd95ff8191ca00df645b6953f534), [`6f6385b`](https://github.com/mastra-ai/mastra/commit/6f6385be5b33687cd21e71fc27e972e6928bb34c), [`14aba61`](https://github.com/mastra-ai/mastra/commit/14aba61b9cff76d72bc7ef6f3a83ae2c5d059193), [`dd9dd1c`](https://github.com/mastra-ai/mastra/commit/dd9dd1c9ae32ae79093f8c4adde1732ac6357233)]:
  - @mastra/core@1.7.0

## 1.5.1-alpha.0

### Patch Changes

- Prompt blocks can now define their own variables schema (`requestContextSchema`), allowing you to create reusable prompt blocks with typed variable placeholders. The server now correctly computes and returns draft/published status for prompt blocks. Existing databases are automatically migrated when upgrading. ([#13351](https://github.com/mastra-ai/mastra/pull/13351))

- Updated dependencies [[`24284ff`](https://github.com/mastra-ai/mastra/commit/24284ffae306ddf0ab83273e13f033520839ef40), [`f5097cc`](https://github.com/mastra-ai/mastra/commit/f5097cc8a813c82c3378882c31178320cadeb655), [`71e237f`](https://github.com/mastra-ai/mastra/commit/71e237fa852a3ad9a50a3ddb3b5f3b20b9a8181c), [`13a291e`](https://github.com/mastra-ai/mastra/commit/13a291ebb9f9bca80befa0d9166b916bb348e8e9), [`397af5a`](https://github.com/mastra-ai/mastra/commit/397af5a69f34d4157f51a7c8da3f1ded1e1d611c), [`d4701f7`](https://github.com/mastra-ai/mastra/commit/d4701f7e24822b081b70f9c806c39411b1a712e7), [`2b40831`](https://github.com/mastra-ai/mastra/commit/2b40831dcca2275c9570ddf09b7f25ba3e8dc7fc), [`6184727`](https://github.com/mastra-ai/mastra/commit/6184727e812bf7a65cee209bacec3a2f5a16e923), [`6f6385b`](https://github.com/mastra-ai/mastra/commit/6f6385be5b33687cd21e71fc27e972e6928bb34c), [`14aba61`](https://github.com/mastra-ai/mastra/commit/14aba61b9cff76d72bc7ef6f3a83ae2c5d059193), [`dd9dd1c`](https://github.com/mastra-ai/mastra/commit/dd9dd1c9ae32ae79093f8c4adde1732ac6357233)]:
  - @mastra/core@1.7.0-alpha.0

## 1.5.0

### Minor Changes

- Added MCP server table and CRUD operations to storage adapters, enabling MCP server configurations to be persisted alongside agents and workflows. ([#13357](https://github.com/mastra-ai/mastra/pull/13357))

### Patch Changes

- Added storage schema support for processor graphs on stored agents. ([#13357](https://github.com/mastra-ai/mastra/pull/13357))

- Storage adapters now return `suggestedContinuation` and `currentTask` fields on Observational Memory activation, enabling agents to maintain conversational context across activation boundaries. ([#13357](https://github.com/mastra-ai/mastra/pull/13357))

- Updated dependencies [[`0d9efb4`](https://github.com/mastra-ai/mastra/commit/0d9efb47992c34aa90581c18b9f51f774f6252a5), [`5caa13d`](https://github.com/mastra-ai/mastra/commit/5caa13d1b2a496e2565ab124a11de9a51ad3e3b9), [`940163f`](https://github.com/mastra-ai/mastra/commit/940163fc492401d7562301e6f106ccef4fefe06f), [`47892c8`](https://github.com/mastra-ai/mastra/commit/47892c85708eac348209f99f10f9a5f5267e11c0), [`45bb78b`](https://github.com/mastra-ai/mastra/commit/45bb78b70bd9db29678fe49476cd9f4ed01bfd0b), [`70eef84`](https://github.com/mastra-ai/mastra/commit/70eef84b8f44493598fdafa2980a0e7283415eda), [`d84e52d`](https://github.com/mastra-ai/mastra/commit/d84e52d0f6511283ddd21ed5fe7f945449d0f799), [`24b80af`](https://github.com/mastra-ai/mastra/commit/24b80af87da93bb84d389340181e17b7477fa9ca), [`608e156`](https://github.com/mastra-ai/mastra/commit/608e156def954c9604c5e3f6d9dfce3bcc7aeab0), [`2b2e157`](https://github.com/mastra-ai/mastra/commit/2b2e157a092cd597d9d3f0000d62b8bb4a7348ed), [`59d30b5`](https://github.com/mastra-ai/mastra/commit/59d30b5d0cb44ea7a1c440e7460dfb57eac9a9b5), [`453693b`](https://github.com/mastra-ai/mastra/commit/453693bf9e265ddccecef901d50da6caaea0fbc6), [`78d1c80`](https://github.com/mastra-ai/mastra/commit/78d1c808ad90201897a300af551bcc1d34458a20), [`c204b63`](https://github.com/mastra-ai/mastra/commit/c204b632d19e66acb6d6e19b11c4540dd6ad5380), [`742a417`](https://github.com/mastra-ai/mastra/commit/742a417896088220a3b5560c354c45c5ca6d88b9)]:
  - @mastra/core@1.6.0

## 1.5.0-alpha.0

### Minor Changes

- Added MCP server table and CRUD operations to storage adapters, enabling MCP server configurations to be persisted alongside agents and workflows. ([#13357](https://github.com/mastra-ai/mastra/pull/13357))

### Patch Changes

- Added storage schema support for processor graphs on stored agents. ([#13357](https://github.com/mastra-ai/mastra/pull/13357))

- Storage adapters now return `suggestedContinuation` and `currentTask` fields on Observational Memory activation, enabling agents to maintain conversational context across activation boundaries. ([#13357](https://github.com/mastra-ai/mastra/pull/13357))

- Updated dependencies [[`0d9efb4`](https://github.com/mastra-ai/mastra/commit/0d9efb47992c34aa90581c18b9f51f774f6252a5), [`5caa13d`](https://github.com/mastra-ai/mastra/commit/5caa13d1b2a496e2565ab124a11de9a51ad3e3b9), [`940163f`](https://github.com/mastra-ai/mastra/commit/940163fc492401d7562301e6f106ccef4fefe06f), [`b260123`](https://github.com/mastra-ai/mastra/commit/b2601234bd093d358c92081a58f9b0befdae52b3), [`47892c8`](https://github.com/mastra-ai/mastra/commit/47892c85708eac348209f99f10f9a5f5267e11c0), [`45bb78b`](https://github.com/mastra-ai/mastra/commit/45bb78b70bd9db29678fe49476cd9f4ed01bfd0b), [`70eef84`](https://github.com/mastra-ai/mastra/commit/70eef84b8f44493598fdafa2980a0e7283415eda), [`d84e52d`](https://github.com/mastra-ai/mastra/commit/d84e52d0f6511283ddd21ed5fe7f945449d0f799), [`24b80af`](https://github.com/mastra-ai/mastra/commit/24b80af87da93bb84d389340181e17b7477fa9ca), [`608e156`](https://github.com/mastra-ai/mastra/commit/608e156def954c9604c5e3f6d9dfce3bcc7aeab0), [`2b2e157`](https://github.com/mastra-ai/mastra/commit/2b2e157a092cd597d9d3f0000d62b8bb4a7348ed), [`59d30b5`](https://github.com/mastra-ai/mastra/commit/59d30b5d0cb44ea7a1c440e7460dfb57eac9a9b5), [`453693b`](https://github.com/mastra-ai/mastra/commit/453693bf9e265ddccecef901d50da6caaea0fbc6), [`78d1c80`](https://github.com/mastra-ai/mastra/commit/78d1c808ad90201897a300af551bcc1d34458a20), [`c204b63`](https://github.com/mastra-ai/mastra/commit/c204b632d19e66acb6d6e19b11c4540dd6ad5380), [`742a417`](https://github.com/mastra-ai/mastra/commit/742a417896088220a3b5560c354c45c5ca6d88b9)]:
  - @mastra/core@1.6.0-alpha.0

## 1.4.0

### Minor Changes

- Added workspace and skill storage domains with full CRUD, versioning, and implementations across LibSQL, Postgres, and MongoDB. Added `editor.workspace` and `editor.skill` namespaces for managing workspace configurations and skill definitions through the editor. Agents stored in the editor can now reference workspaces (by ID or inline config) and skills, with full hydration to runtime `Workspace` instances during agent resolution. ([#13156](https://github.com/mastra-ai/mastra/pull/13156))

  **Filesystem-native skill versioning (draft → publish model):**

  Skills are versioned as filesystem trees with content-addressable blob storage. The editing surface (live filesystem) is separated from the serving surface (versioned blob store), enabling a `draft → publish` workflow:
  - `editor.skill.publish(skillId, source, skillPath)` — Snapshots a skill directory from the filesystem into blob storage, creates a new version with a tree manifest, and sets `activeVersionId`
  - Version switching via `editor.skill.update({ id, activeVersionId })` — Points the skill to a previous version without re-publishing
  - Publishing a skill automatically invalidates cached agents that reference it, so they re-hydrate with the updated version on next access

  **Agent skill resolution strategies:**

  Agents can reference skills with different resolution strategies:
  - `strategy: 'latest'` — Resolves the skill's active version (honors `activeVersionId` for rollback)
  - `pin: '<versionId>'` — Pins to a specific version, immune to publishes
  - `strategy: 'live'` — Reads directly from the live filesystem (no blob store)

  **Blob storage infrastructure:**
  - `BlobStore` abstract class for content-addressable storage keyed by SHA-256 hash
  - `InMemoryBlobStore` for testing
  - LibSQL, Postgres, and MongoDB implementations
  - `S3BlobStore` for storing blobs in S3 or S3-compatible storage (AWS, R2, MinIO, DO Spaces)
  - `BlobStoreProvider` interface and `MastraEditorConfig.blobStores` registry for pluggable blob storage
  - `VersionedSkillSource` and `CompositeVersionedSkillSource` for reading skill files from the blob store at runtime

  **New storage types:**
  - `StorageWorkspaceSnapshotType` and `StorageSkillSnapshotType` with corresponding input/output types
  - `StorageWorkspaceRef` for ID-based or inline workspace references on agents
  - `StorageSkillConfig` for per-agent skill overrides (`pin`, `strategy`, description, instructions)
  - `SkillVersionTree` and `SkillVersionTreeEntry` for tree manifests
  - `StorageBlobEntry` for content-addressable blob entries
  - `SKILL_BLOBS_SCHEMA` for the `mastra_skill_blobs` table

  **New editor namespaces:**
  - `editor.workspace` — CRUD for workspace configs, plus `hydrateSnapshotToWorkspace()` for resolving to runtime `Workspace` instances
  - `editor.skill` — CRUD for skill definitions, plus `publish()` for filesystem-to-blob snapshots

  **Provider registries:**
  - `MastraEditorConfig` accepts `filesystems`, `sandboxes`, and `blobStores` provider registries (keyed by provider ID)
  - Built-in `local` filesystem and sandbox providers are auto-registered
  - `editor.resolveBlobStore()` resolves from provider registry or falls back to the storage backend's blobs domain
  - Providers expose `id`, `name`, `description`, `configSchema` (JSON Schema for UI form rendering), and a factory method

  **Storage adapter support:**
  - LibSQL: Full `workspaces`, `skills`, and `blobs` domain implementations
  - Postgres: Full `workspaces`, `skills`, and `blobs` domain implementations
  - MongoDB: Full `workspaces`, `skills`, and `blobs` domain implementations
  - All three include `workspace`, `skills`, and `skillsFormat` fields on agent versions

  **Server endpoints:**
  - `GET/POST/PATCH/DELETE /stored/workspaces` — CRUD for stored workspaces
  - `GET/POST/PATCH/DELETE /stored/skills` — CRUD for stored skills
  - `POST /stored/skills/:id/publish` — Publish a skill from a filesystem source

  ```ts
  import { MastraEditor } from '@mastra/editor';
  import { s3FilesystemProvider, s3BlobStoreProvider } from '@mastra/s3';
  import { e2bSandboxProvider } from '@mastra/e2b';

  const editor = new MastraEditor({
    filesystems: { s3: s3FilesystemProvider },
    sandboxes: { e2b: e2bSandboxProvider },
    blobStores: { s3: s3BlobStoreProvider },
  });

  // Create a skill and publish it
  const skill = await editor.skill.create({
    name: 'Code Review',
    description: 'Reviews code for best practices',
    instructions: 'Analyze the code and provide feedback...',
  });
  await editor.skill.publish(skill.id, source, 'skills/code-review');

  // Agents resolve skills by strategy
  await editor.agent.create({
    name: 'Dev Assistant',
    model: { provider: 'openai', name: 'gpt-4' },
    workspace: { type: 'id', workspaceId: workspace.id },
    skills: { [skill.id]: { strategy: 'latest' } },
    skillsFormat: 'xml',
  });
  ```

- Added draft/publish version management for all editor primitives (agents, scorers, MCP clients, prompt blocks). ([#13061](https://github.com/mastra-ai/mastra/pull/13061))

  **Status filtering on list endpoints** — All list endpoints now accept a `?status=draft|published|archived` query parameter to filter by entity status. Defaults to `published` to preserve backward compatibility.

  **Draft vs published resolution on get-by-id endpoints** — All get-by-id endpoints now accept `?status=draft` to resolve the entity with its latest (unpublished) version, or `?status=published` (default) to resolve with the active published version.

  **Edits no longer auto-publish** — When updating any primitive, a new version is created but `activeVersionId` is no longer automatically updated. Edits stay as drafts until explicitly published via the activate endpoint.

  **Full version management for all primitives** — Scorers, MCP clients, and prompt blocks now have the same version management API that agents have: list versions, create version snapshots, get specific versions, activate/publish, restore from a previous version, delete versions, and compare versions.

  **New prompt block CRUD routes** — Prompt blocks now have full server routes (`GET /stored/prompt-blocks`, `GET /stored/prompt-blocks/:id`, `POST`, `PATCH`, `DELETE`).

  **New version endpoints** — Each primitive now exposes 7 version management endpoints under `/stored/{type}/:id/versions` (list, create, get, activate, restore, delete, compare).

  ```ts
  // Fetch the published version (default behavior, backward compatible)
  const published = await fetch('/api/stored/scorers/my-scorer');

  // Fetch the draft version for editing in the UI
  const draft = await fetch('/api/stored/scorers/my-scorer?status=draft');

  // Publish a specific version
  await fetch('/api/stored/scorers/my-scorer/versions/abc123/activate', { method: 'POST' });

  // Compare two versions
  const diff = await fetch('/api/stored/scorers/my-scorer/versions/compare?from=v1&to=v2');
  ```

### Patch Changes

- MongoDBStorage.saveMessages() overwrites the createdAt field every time a message is upserted, even for existing messages. This causes message ordering to break when messages are recalled via memory.recall(), which sorts by createdAt. ([#13072](https://github.com/mastra-ai/mastra/pull/13072))

- Added scorer version management and CMS draft/publish flow for scorers. ([#13194](https://github.com/mastra-ai/mastra/pull/13194))
  - Added scorer version methods to the client SDK: `listVersions`, `createVersion`, `getVersion`, `activateVersion`, `restoreVersion`, `deleteVersion`, `compareVersions`.
  - Added `ScorerVersionCombobox` for navigating scorer versions with Published/Draft labels.
  - Scorer edit page now supports Save (draft) and Publish workflows with an "Unpublished changes" indicator.
  - Storage list methods for agents and scorers no longer default to filtering only published entities, allowing drafts to appear in the playground.

- Updated dependencies [[`252580a`](https://github.com/mastra-ai/mastra/commit/252580a71feb0e46d0ccab04a70a79ff6a2ee0ab), [`f8e819f`](https://github.com/mastra-ai/mastra/commit/f8e819fabdfdc43d2da546a3ad81ba23685f603d), [`5c75261`](https://github.com/mastra-ai/mastra/commit/5c7526120d936757d4ffb7b82232e1641ebd45cb), [`e27d832`](https://github.com/mastra-ai/mastra/commit/e27d83281b5e166fd63a13969689e928d8605944), [`e37ef84`](https://github.com/mastra-ai/mastra/commit/e37ef8404043c94ca0c8e35ecdedb093b8087878), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`10cf521`](https://github.com/mastra-ai/mastra/commit/10cf52183344743a0d7babe24cd24fd78870c354), [`efdb682`](https://github.com/mastra-ai/mastra/commit/efdb682887f6522149769383908f9790c188ab88), [`0dee7a0`](https://github.com/mastra-ai/mastra/commit/0dee7a0ff4c2507e6eb6e6ee5f9738877ebd4ad1), [`04c2c8e`](https://github.com/mastra-ai/mastra/commit/04c2c8e888984364194131aecb490a3d6e920e61), [`02dc07a`](https://github.com/mastra-ai/mastra/commit/02dc07acc4ad42d93335825e3308f5b42266eba2), [`bb7262b`](https://github.com/mastra-ai/mastra/commit/bb7262b7c0ca76320d985b40510b6ffbbb936582), [`cf1c6e7`](https://github.com/mastra-ai/mastra/commit/cf1c6e789b131f55638fed52183a89d5078b4876), [`5ffadfe`](https://github.com/mastra-ai/mastra/commit/5ffadfefb1468ac2612b20bb84d24c39de6961c0), [`1e1339c`](https://github.com/mastra-ai/mastra/commit/1e1339cc276e571a48cfff5014487877086bfe68), [`d03df73`](https://github.com/mastra-ai/mastra/commit/d03df73f8fe9496064a33e1c3b74ba0479bf9ee6), [`79b8f45`](https://github.com/mastra-ai/mastra/commit/79b8f45a6767e1a5c3d56cd3c5b1214326b81661), [`9bbf08e`](https://github.com/mastra-ai/mastra/commit/9bbf08e3c20731c79dea13a765895b9fcf29cbf1), [`0a25952`](https://github.com/mastra-ai/mastra/commit/0a259526b5e1ac11e6efa53db1f140272962af2d), [`ffa5468`](https://github.com/mastra-ai/mastra/commit/ffa546857fc4821753979b3a34e13b4d76fbbcd4), [`3264a04`](https://github.com/mastra-ai/mastra/commit/3264a04e30340c3c5447433300a035ea0878df85), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`088d9ba`](https://github.com/mastra-ai/mastra/commit/088d9ba2577518703c52b0dccd617178d9ee6b0d), [`74fbebd`](https://github.com/mastra-ai/mastra/commit/74fbebd918a03832a2864965a8bea59bf617d3a2), [`aea6217`](https://github.com/mastra-ai/mastra/commit/aea621790bfb2291431b08da0cc5e6e150303ae7), [`b6a855e`](https://github.com/mastra-ai/mastra/commit/b6a855edc056e088279075506442ba1d6fa6def9), [`ae408ea`](https://github.com/mastra-ai/mastra/commit/ae408ea7128f0d2710b78d8623185198e7cb19c1), [`17e942e`](https://github.com/mastra-ai/mastra/commit/17e942eee2ba44985b1f807e6208cdde672f82f9), [`2015cf9`](https://github.com/mastra-ai/mastra/commit/2015cf921649f44c3f5bcd32a2c052335f8e49b4), [`7ef454e`](https://github.com/mastra-ai/mastra/commit/7ef454eaf9dcec6de60021c8f42192052dd490d6), [`2be1d99`](https://github.com/mastra-ai/mastra/commit/2be1d99564ce79acc4846071082bff353035a87a), [`2708fa1`](https://github.com/mastra-ai/mastra/commit/2708fa1055ac91c03e08b598869f6b8fb51fa37f), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9), [`ec53e89`](https://github.com/mastra-ai/mastra/commit/ec53e8939c76c638991e21af762e51378eff7543), [`9b5a8cb`](https://github.com/mastra-ai/mastra/commit/9b5a8cb13e120811b0bf14140ada314f1c067894), [`607e66b`](https://github.com/mastra-ai/mastra/commit/607e66b02dc7f531ee37799f3456aa2dc0ca7ac5), [`a215d06`](https://github.com/mastra-ai/mastra/commit/a215d06758dcf590eabfe0b7afd4ae39bdbf082c), [`6909c74`](https://github.com/mastra-ai/mastra/commit/6909c74a7781e0447d475e9dbc1dc871b700f426), [`192438f`](https://github.com/mastra-ai/mastra/commit/192438f8a90c4f375e955f8ff179bf8dc6821a83)]:
  - @mastra/core@1.5.0

## 1.4.0-alpha.0

### Minor Changes

- Added workspace and skill storage domains with full CRUD, versioning, and implementations across LibSQL, Postgres, and MongoDB. Added `editor.workspace` and `editor.skill` namespaces for managing workspace configurations and skill definitions through the editor. Agents stored in the editor can now reference workspaces (by ID or inline config) and skills, with full hydration to runtime `Workspace` instances during agent resolution. ([#13156](https://github.com/mastra-ai/mastra/pull/13156))

  **Filesystem-native skill versioning (draft → publish model):**

  Skills are versioned as filesystem trees with content-addressable blob storage. The editing surface (live filesystem) is separated from the serving surface (versioned blob store), enabling a `draft → publish` workflow:
  - `editor.skill.publish(skillId, source, skillPath)` — Snapshots a skill directory from the filesystem into blob storage, creates a new version with a tree manifest, and sets `activeVersionId`
  - Version switching via `editor.skill.update({ id, activeVersionId })` — Points the skill to a previous version without re-publishing
  - Publishing a skill automatically invalidates cached agents that reference it, so they re-hydrate with the updated version on next access

  **Agent skill resolution strategies:**

  Agents can reference skills with different resolution strategies:
  - `strategy: 'latest'` — Resolves the skill's active version (honors `activeVersionId` for rollback)
  - `pin: '<versionId>'` — Pins to a specific version, immune to publishes
  - `strategy: 'live'` — Reads directly from the live filesystem (no blob store)

  **Blob storage infrastructure:**
  - `BlobStore` abstract class for content-addressable storage keyed by SHA-256 hash
  - `InMemoryBlobStore` for testing
  - LibSQL, Postgres, and MongoDB implementations
  - `S3BlobStore` for storing blobs in S3 or S3-compatible storage (AWS, R2, MinIO, DO Spaces)
  - `BlobStoreProvider` interface and `MastraEditorConfig.blobStores` registry for pluggable blob storage
  - `VersionedSkillSource` and `CompositeVersionedSkillSource` for reading skill files from the blob store at runtime

  **New storage types:**
  - `StorageWorkspaceSnapshotType` and `StorageSkillSnapshotType` with corresponding input/output types
  - `StorageWorkspaceRef` for ID-based or inline workspace references on agents
  - `StorageSkillConfig` for per-agent skill overrides (`pin`, `strategy`, description, instructions)
  - `SkillVersionTree` and `SkillVersionTreeEntry` for tree manifests
  - `StorageBlobEntry` for content-addressable blob entries
  - `SKILL_BLOBS_SCHEMA` for the `mastra_skill_blobs` table

  **New editor namespaces:**
  - `editor.workspace` — CRUD for workspace configs, plus `hydrateSnapshotToWorkspace()` for resolving to runtime `Workspace` instances
  - `editor.skill` — CRUD for skill definitions, plus `publish()` for filesystem-to-blob snapshots

  **Provider registries:**
  - `MastraEditorConfig` accepts `filesystems`, `sandboxes`, and `blobStores` provider registries (keyed by provider ID)
  - Built-in `local` filesystem and sandbox providers are auto-registered
  - `editor.resolveBlobStore()` resolves from provider registry or falls back to the storage backend's blobs domain
  - Providers expose `id`, `name`, `description`, `configSchema` (JSON Schema for UI form rendering), and a factory method

  **Storage adapter support:**
  - LibSQL: Full `workspaces`, `skills`, and `blobs` domain implementations
  - Postgres: Full `workspaces`, `skills`, and `blobs` domain implementations
  - MongoDB: Full `workspaces`, `skills`, and `blobs` domain implementations
  - All three include `workspace`, `skills`, and `skillsFormat` fields on agent versions

  **Server endpoints:**
  - `GET/POST/PATCH/DELETE /stored/workspaces` — CRUD for stored workspaces
  - `GET/POST/PATCH/DELETE /stored/skills` — CRUD for stored skills
  - `POST /stored/skills/:id/publish` — Publish a skill from a filesystem source

  ```ts
  import { MastraEditor } from '@mastra/editor';
  import { s3FilesystemProvider, s3BlobStoreProvider } from '@mastra/s3';
  import { e2bSandboxProvider } from '@mastra/e2b';

  const editor = new MastraEditor({
    filesystems: { s3: s3FilesystemProvider },
    sandboxes: { e2b: e2bSandboxProvider },
    blobStores: { s3: s3BlobStoreProvider },
  });

  // Create a skill and publish it
  const skill = await editor.skill.create({
    name: 'Code Review',
    description: 'Reviews code for best practices',
    instructions: 'Analyze the code and provide feedback...',
  });
  await editor.skill.publish(skill.id, source, 'skills/code-review');

  // Agents resolve skills by strategy
  await editor.agent.create({
    name: 'Dev Assistant',
    model: { provider: 'openai', name: 'gpt-4' },
    workspace: { type: 'id', workspaceId: workspace.id },
    skills: { [skill.id]: { strategy: 'latest' } },
    skillsFormat: 'xml',
  });
  ```

- Added draft/publish version management for all editor primitives (agents, scorers, MCP clients, prompt blocks). ([#13061](https://github.com/mastra-ai/mastra/pull/13061))

  **Status filtering on list endpoints** — All list endpoints now accept a `?status=draft|published|archived` query parameter to filter by entity status. Defaults to `published` to preserve backward compatibility.

  **Draft vs published resolution on get-by-id endpoints** — All get-by-id endpoints now accept `?status=draft` to resolve the entity with its latest (unpublished) version, or `?status=published` (default) to resolve with the active published version.

  **Edits no longer auto-publish** — When updating any primitive, a new version is created but `activeVersionId` is no longer automatically updated. Edits stay as drafts until explicitly published via the activate endpoint.

  **Full version management for all primitives** — Scorers, MCP clients, and prompt blocks now have the same version management API that agents have: list versions, create version snapshots, get specific versions, activate/publish, restore from a previous version, delete versions, and compare versions.

  **New prompt block CRUD routes** — Prompt blocks now have full server routes (`GET /stored/prompt-blocks`, `GET /stored/prompt-blocks/:id`, `POST`, `PATCH`, `DELETE`).

  **New version endpoints** — Each primitive now exposes 7 version management endpoints under `/stored/{type}/:id/versions` (list, create, get, activate, restore, delete, compare).

  ```ts
  // Fetch the published version (default behavior, backward compatible)
  const published = await fetch('/api/stored/scorers/my-scorer');

  // Fetch the draft version for editing in the UI
  const draft = await fetch('/api/stored/scorers/my-scorer?status=draft');

  // Publish a specific version
  await fetch('/api/stored/scorers/my-scorer/versions/abc123/activate', { method: 'POST' });

  // Compare two versions
  const diff = await fetch('/api/stored/scorers/my-scorer/versions/compare?from=v1&to=v2');
  ```

### Patch Changes

- MongoDBStorage.saveMessages() overwrites the createdAt field every time a message is upserted, even for existing messages. This causes message ordering to break when messages are recalled via memory.recall(), which sorts by createdAt. ([#13072](https://github.com/mastra-ai/mastra/pull/13072))

- Added scorer version management and CMS draft/publish flow for scorers. ([#13194](https://github.com/mastra-ai/mastra/pull/13194))
  - Added scorer version methods to the client SDK: `listVersions`, `createVersion`, `getVersion`, `activateVersion`, `restoreVersion`, `deleteVersion`, `compareVersions`.
  - Added `ScorerVersionCombobox` for navigating scorer versions with Published/Draft labels.
  - Scorer edit page now supports Save (draft) and Publish workflows with an "Unpublished changes" indicator.
  - Storage list methods for agents and scorers no longer default to filtering only published entities, allowing drafts to appear in the playground.

- Updated dependencies [[`252580a`](https://github.com/mastra-ai/mastra/commit/252580a71feb0e46d0ccab04a70a79ff6a2ee0ab), [`f8e819f`](https://github.com/mastra-ai/mastra/commit/f8e819fabdfdc43d2da546a3ad81ba23685f603d), [`5c75261`](https://github.com/mastra-ai/mastra/commit/5c7526120d936757d4ffb7b82232e1641ebd45cb), [`e27d832`](https://github.com/mastra-ai/mastra/commit/e27d83281b5e166fd63a13969689e928d8605944), [`e37ef84`](https://github.com/mastra-ai/mastra/commit/e37ef8404043c94ca0c8e35ecdedb093b8087878), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`10cf521`](https://github.com/mastra-ai/mastra/commit/10cf52183344743a0d7babe24cd24fd78870c354), [`efdb682`](https://github.com/mastra-ai/mastra/commit/efdb682887f6522149769383908f9790c188ab88), [`0dee7a0`](https://github.com/mastra-ai/mastra/commit/0dee7a0ff4c2507e6eb6e6ee5f9738877ebd4ad1), [`04c2c8e`](https://github.com/mastra-ai/mastra/commit/04c2c8e888984364194131aecb490a3d6e920e61), [`02dc07a`](https://github.com/mastra-ai/mastra/commit/02dc07acc4ad42d93335825e3308f5b42266eba2), [`bb7262b`](https://github.com/mastra-ai/mastra/commit/bb7262b7c0ca76320d985b40510b6ffbbb936582), [`cf1c6e7`](https://github.com/mastra-ai/mastra/commit/cf1c6e789b131f55638fed52183a89d5078b4876), [`5ffadfe`](https://github.com/mastra-ai/mastra/commit/5ffadfefb1468ac2612b20bb84d24c39de6961c0), [`1e1339c`](https://github.com/mastra-ai/mastra/commit/1e1339cc276e571a48cfff5014487877086bfe68), [`d03df73`](https://github.com/mastra-ai/mastra/commit/d03df73f8fe9496064a33e1c3b74ba0479bf9ee6), [`79b8f45`](https://github.com/mastra-ai/mastra/commit/79b8f45a6767e1a5c3d56cd3c5b1214326b81661), [`9bbf08e`](https://github.com/mastra-ai/mastra/commit/9bbf08e3c20731c79dea13a765895b9fcf29cbf1), [`0a25952`](https://github.com/mastra-ai/mastra/commit/0a259526b5e1ac11e6efa53db1f140272962af2d), [`ffa5468`](https://github.com/mastra-ai/mastra/commit/ffa546857fc4821753979b3a34e13b4d76fbbcd4), [`3264a04`](https://github.com/mastra-ai/mastra/commit/3264a04e30340c3c5447433300a035ea0878df85), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`088d9ba`](https://github.com/mastra-ai/mastra/commit/088d9ba2577518703c52b0dccd617178d9ee6b0d), [`74fbebd`](https://github.com/mastra-ai/mastra/commit/74fbebd918a03832a2864965a8bea59bf617d3a2), [`aea6217`](https://github.com/mastra-ai/mastra/commit/aea621790bfb2291431b08da0cc5e6e150303ae7), [`b6a855e`](https://github.com/mastra-ai/mastra/commit/b6a855edc056e088279075506442ba1d6fa6def9), [`ae408ea`](https://github.com/mastra-ai/mastra/commit/ae408ea7128f0d2710b78d8623185198e7cb19c1), [`17e942e`](https://github.com/mastra-ai/mastra/commit/17e942eee2ba44985b1f807e6208cdde672f82f9), [`2015cf9`](https://github.com/mastra-ai/mastra/commit/2015cf921649f44c3f5bcd32a2c052335f8e49b4), [`7ef454e`](https://github.com/mastra-ai/mastra/commit/7ef454eaf9dcec6de60021c8f42192052dd490d6), [`2be1d99`](https://github.com/mastra-ai/mastra/commit/2be1d99564ce79acc4846071082bff353035a87a), [`2708fa1`](https://github.com/mastra-ai/mastra/commit/2708fa1055ac91c03e08b598869f6b8fb51fa37f), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9), [`ec53e89`](https://github.com/mastra-ai/mastra/commit/ec53e8939c76c638991e21af762e51378eff7543), [`9b5a8cb`](https://github.com/mastra-ai/mastra/commit/9b5a8cb13e120811b0bf14140ada314f1c067894), [`607e66b`](https://github.com/mastra-ai/mastra/commit/607e66b02dc7f531ee37799f3456aa2dc0ca7ac5), [`a215d06`](https://github.com/mastra-ai/mastra/commit/a215d06758dcf590eabfe0b7afd4ae39bdbf082c), [`6909c74`](https://github.com/mastra-ai/mastra/commit/6909c74a7781e0447d475e9dbc1dc871b700f426), [`192438f`](https://github.com/mastra-ai/mastra/commit/192438f8a90c4f375e955f8ff179bf8dc6821a83)]:
  - @mastra/core@1.5.0-alpha.0

## 1.3.1

### Patch Changes

- Fixed agent version storage to persist the requestContextSchema field. Previously, requestContextSchema was defined on the agent snapshot type but was not included in the database schema, INSERT statements, or row parsing logic, causing it to be silently dropped when saving and loading agent versions. ([#13003](https://github.com/mastra-ai/mastra/pull/13003))

- Added MCP client storage domain and ToolProvider interface for integrating external tool catalogs with stored agents. ([#12974](https://github.com/mastra-ai/mastra/pull/12974))

  **MCP Client Storage**

  New storage domain for persisting MCP client configurations with CRUD operations. Each MCP client can contain multiple servers with independent tool selection:

  ```ts
  // Store an MCP client with multiple servers
  await storage.mcpClients.create({
    id: 'my-mcp',
    name: 'My MCP Client',
    servers: {
      'github-server': { url: 'https://mcp.github.com/sse' },
      'slack-server': { url: 'https://mcp.slack.com/sse' },
    },
  });
  ```

  LibSQL, PostgreSQL, and MongoDB storage adapters all implement the new MCP client domain.

  **ToolProvider Interface**

  New `ToolProvider` interface at `@mastra/core/tool-provider` enables third-party tool catalog integration (e.g., Composio, Arcade AI):

  ```ts
  import type { ToolProvider } from '@mastra/core/tool-provider';

  # Providers implement: listToolkits(), listTools(), getToolSchema(), resolveTools()
  ```

  `resolveTools()` receives `requestContext` from the current request, enabling per-user API keys and credentials in multi-tenant setups:

  ```ts
  const tools = await provider.resolveTools(slugs, configs, {
    requestContext: { apiKey: 'user-specific-key', userId: 'tenant-123' },
  });
  ```

  **Tool Selection Semantics**

  Both `mcpClients` and `integrationTools` on stored agents follow consistent three-state selection:
  - `{ tools: undefined }` — provider registered, no tools selected
  - `{ tools: {} }` — all tools from provider included
  - `{ tools: { 'TOOL_SLUG': { description: '...' } } }` — specific tools with optional overrides

- Updated dependencies [[`7ef618f`](https://github.com/mastra-ai/mastra/commit/7ef618f3c49c27e2f6b27d7f564c557c0734325b), [`b373564`](https://github.com/mastra-ai/mastra/commit/b37356491d43b4d53067f10cb669abaf2502f218), [`927c2af`](https://github.com/mastra-ai/mastra/commit/927c2af9792286c122e04409efce0f3c804f777f), [`b896b41`](https://github.com/mastra-ai/mastra/commit/b896b41343de7fcc14442fb40fe82d189e65bbe2), [`6415277`](https://github.com/mastra-ai/mastra/commit/6415277a438faa00db2af850ead5dee25f40c428), [`0831bbb`](https://github.com/mastra-ai/mastra/commit/0831bbb5bc750c18e9b22b45f18687c964b70828), [`63f7eda`](https://github.com/mastra-ai/mastra/commit/63f7eda605eb3e0c8c35ee3912ffe7c999c69f69), [`a5b67a3`](https://github.com/mastra-ai/mastra/commit/a5b67a3589a74415feb663a55d1858324a2afde9), [`877b02c`](https://github.com/mastra-ai/mastra/commit/877b02cdbb15e199184c7f2b8f217be8d3ebada7), [`7567222`](https://github.com/mastra-ai/mastra/commit/7567222b1366f0d39980594792dd9d5060bfe2ab), [`af71458`](https://github.com/mastra-ai/mastra/commit/af71458e3b566f09c11d0e5a0a836dc818e7a24a), [`eb36bd8`](https://github.com/mastra-ai/mastra/commit/eb36bd8c52fcd6ec9674ac3b7a6412405b5983e1), [`3cbf121`](https://github.com/mastra-ai/mastra/commit/3cbf121f55418141924754a83102aade89835947)]:
  - @mastra/core@1.4.0

## 1.3.1-alpha.0

### Patch Changes

- Fixed agent version storage to persist the requestContextSchema field. Previously, requestContextSchema was defined on the agent snapshot type but was not included in the database schema, INSERT statements, or row parsing logic, causing it to be silently dropped when saving and loading agent versions. ([#13003](https://github.com/mastra-ai/mastra/pull/13003))

- Added MCP client storage domain and ToolProvider interface for integrating external tool catalogs with stored agents. ([#12974](https://github.com/mastra-ai/mastra/pull/12974))

  **MCP Client Storage**

  New storage domain for persisting MCP client configurations with CRUD operations. Each MCP client can contain multiple servers with independent tool selection:

  ```ts
  // Store an MCP client with multiple servers
  await storage.mcpClients.create({
    id: 'my-mcp',
    name: 'My MCP Client',
    servers: {
      'github-server': { url: 'https://mcp.github.com/sse' },
      'slack-server': { url: 'https://mcp.slack.com/sse' },
    },
  });
  ```

  LibSQL, PostgreSQL, and MongoDB storage adapters all implement the new MCP client domain.

  **ToolProvider Interface**

  New `ToolProvider` interface at `@mastra/core/tool-provider` enables third-party tool catalog integration (e.g., Composio, Arcade AI):

  ```ts
  import type { ToolProvider } from '@mastra/core/tool-provider';

  # Providers implement: listToolkits(), listTools(), getToolSchema(), resolveTools()
  ```

  `resolveTools()` receives `requestContext` from the current request, enabling per-user API keys and credentials in multi-tenant setups:

  ```ts
  const tools = await provider.resolveTools(slugs, configs, {
    requestContext: { apiKey: 'user-specific-key', userId: 'tenant-123' },
  });
  ```

  **Tool Selection Semantics**

  Both `mcpClients` and `integrationTools` on stored agents follow consistent three-state selection:
  - `{ tools: undefined }` — provider registered, no tools selected
  - `{ tools: {} }` — all tools from provider included
  - `{ tools: { 'TOOL_SLUG': { description: '...' } } }` — specific tools with optional overrides

- Updated dependencies [[`7ef618f`](https://github.com/mastra-ai/mastra/commit/7ef618f3c49c27e2f6b27d7f564c557c0734325b), [`b373564`](https://github.com/mastra-ai/mastra/commit/b37356491d43b4d53067f10cb669abaf2502f218), [`927c2af`](https://github.com/mastra-ai/mastra/commit/927c2af9792286c122e04409efce0f3c804f777f), [`b896b41`](https://github.com/mastra-ai/mastra/commit/b896b41343de7fcc14442fb40fe82d189e65bbe2), [`6415277`](https://github.com/mastra-ai/mastra/commit/6415277a438faa00db2af850ead5dee25f40c428), [`0831bbb`](https://github.com/mastra-ai/mastra/commit/0831bbb5bc750c18e9b22b45f18687c964b70828), [`63f7eda`](https://github.com/mastra-ai/mastra/commit/63f7eda605eb3e0c8c35ee3912ffe7c999c69f69), [`a5b67a3`](https://github.com/mastra-ai/mastra/commit/a5b67a3589a74415feb663a55d1858324a2afde9), [`877b02c`](https://github.com/mastra-ai/mastra/commit/877b02cdbb15e199184c7f2b8f217be8d3ebada7), [`7567222`](https://github.com/mastra-ai/mastra/commit/7567222b1366f0d39980594792dd9d5060bfe2ab), [`af71458`](https://github.com/mastra-ai/mastra/commit/af71458e3b566f09c11d0e5a0a836dc818e7a24a), [`eb36bd8`](https://github.com/mastra-ai/mastra/commit/eb36bd8c52fcd6ec9674ac3b7a6412405b5983e1), [`3cbf121`](https://github.com/mastra-ai/mastra/commit/3cbf121f55418141924754a83102aade89835947)]:
  - @mastra/core@1.4.0-alpha.0

## 1.3.0

### Minor Changes

- **Updated storage adapters for generic storage domain API** ([#12846](https://github.com/mastra-ai/mastra/pull/12846))

  All storage adapters now implement the unified `VersionedStorageDomain` method names. Entity-specific methods (`createAgent`, `getAgentById`, `deleteAgent`, etc.) have been replaced with generic equivalents (`create`, `getById`, `delete`, etc.) across agents, prompt blocks, and scorer definitions domains.

  Added `scorer-definitions` domain support to all adapters.

  **Before:**

  ```ts
  const store = storage.getStore('agents');
  await store.createAgent({ agent: input });
  await store.getAgentById({ id: 'abc' });
  await store.deleteAgent({ id: 'abc' });
  ```

  **After:**

  ```ts
  const store = storage.getStore('agents');
  await store.create({ agent: input });
  await store.getById('abc');
  await store.delete('abc');
  ```

### Patch Changes

- Fixed observational memory progress bars resetting to zero after agent responses finish. ([#12934](https://github.com/mastra-ai/mastra/pull/12934))

- Fixed issues with stored agents ([#12790](https://github.com/mastra-ai/mastra/pull/12790))

- Supporting changes for async buffering in observational memory, including new config options, streaming events, and UI markers. ([#12891](https://github.com/mastra-ai/mastra/pull/12891))

- Added prompt block storage implementations. Each store supports full CRUD for prompt blocks and their versions, including JSON serialization for rules and metadata. Also updated agent instructions serialization to support the new `AgentInstructionBlock` array format alongside plain strings. ([#12776](https://github.com/mastra-ai/mastra/pull/12776))

- Updated dependencies [[`717ffab`](https://github.com/mastra-ai/mastra/commit/717ffab42cfd58ff723b5c19ada4939997773004), [`b31c922`](https://github.com/mastra-ai/mastra/commit/b31c922215b513791d98feaea1b98784aa00803a), [`e4b6dab`](https://github.com/mastra-ai/mastra/commit/e4b6dab171c5960e340b3ea3ea6da8d64d2b8672), [`5719fa8`](https://github.com/mastra-ai/mastra/commit/5719fa8880e86e8affe698ec4b3807c7e0e0a06f), [`83cda45`](https://github.com/mastra-ai/mastra/commit/83cda4523e588558466892bff8f80f631a36945a), [`11804ad`](https://github.com/mastra-ai/mastra/commit/11804adf1d6be46ebe216be40a43b39bb8b397d7), [`aa95f95`](https://github.com/mastra-ai/mastra/commit/aa95f958b186ae5c9f4219c88e268f5565c277a2), [`90f7894`](https://github.com/mastra-ai/mastra/commit/90f7894568dc9481f40a4d29672234fae23090bb), [`f5501ae`](https://github.com/mastra-ai/mastra/commit/f5501aedb0a11106c7db7e480d6eaf3971b7bda8), [`44573af`](https://github.com/mastra-ai/mastra/commit/44573afad0a4bc86f627d6cbc0207961cdcb3bc3), [`00e3861`](https://github.com/mastra-ai/mastra/commit/00e3861863fbfee78faeb1ebbdc7c0223aae13ff), [`8109aee`](https://github.com/mastra-ai/mastra/commit/8109aeeab758e16cd4255a6c36f044b70eefc6a6), [`7bfbc52`](https://github.com/mastra-ai/mastra/commit/7bfbc52a8604feb0fff2c0a082c13c0c2a3df1a2), [`1445994`](https://github.com/mastra-ai/mastra/commit/1445994aee19c9334a6a101cf7bd80ca7ed4d186), [`61f44a2`](https://github.com/mastra-ai/mastra/commit/61f44a26861c89e364f367ff40825bdb7f19df55), [`37145d2`](https://github.com/mastra-ai/mastra/commit/37145d25f99dc31f1a9105576e5452609843ce32), [`fdad759`](https://github.com/mastra-ai/mastra/commit/fdad75939ff008b27625f5ec0ce9c6915d99d9ec), [`e4569c5`](https://github.com/mastra-ai/mastra/commit/e4569c589e00c4061a686c9eb85afe1b7050b0a8), [`7309a85`](https://github.com/mastra-ai/mastra/commit/7309a85427281a8be23f4fb80ca52e18eaffd596), [`99424f6`](https://github.com/mastra-ai/mastra/commit/99424f6862ffb679c4ec6765501486034754a4c2), [`44eb452`](https://github.com/mastra-ai/mastra/commit/44eb4529b10603c279688318bebf3048543a1d61), [`6c40593`](https://github.com/mastra-ai/mastra/commit/6c40593d6d2b1b68b0c45d1a3a4c6ac5ecac3937), [`8c1135d`](https://github.com/mastra-ai/mastra/commit/8c1135dfb91b057283eae7ee11f9ec28753cc64f), [`dd39e54`](https://github.com/mastra-ai/mastra/commit/dd39e54ea34532c995b33bee6e0e808bf41a7341), [`b6fad9a`](https://github.com/mastra-ai/mastra/commit/b6fad9a602182b1cc0df47cd8c55004fa829ad61), [`4129c07`](https://github.com/mastra-ai/mastra/commit/4129c073349b5a66643fd8136ebfe9d7097cf793), [`5b930ab`](https://github.com/mastra-ai/mastra/commit/5b930aba1834d9898e8460a49d15106f31ac7c8d), [`4be93d0`](https://github.com/mastra-ai/mastra/commit/4be93d09d68e20aaf0ea3f210749422719618b5f), [`047635c`](https://github.com/mastra-ai/mastra/commit/047635ccd7861d726c62d135560c0022a5490aec), [`8c90ff4`](https://github.com/mastra-ai/mastra/commit/8c90ff4d3414e7f2a2d216ea91274644f7b29133), [`ed232d1`](https://github.com/mastra-ai/mastra/commit/ed232d1583f403925dc5ae45f7bee948cf2a182b), [`3891795`](https://github.com/mastra-ai/mastra/commit/38917953518eb4154a984ee36e6ededdcfe80f72), [`4f955b2`](https://github.com/mastra-ai/mastra/commit/4f955b20c7f66ed282ee1fd8709696fa64c4f19d), [`55a4c90`](https://github.com/mastra-ai/mastra/commit/55a4c9044ac7454349b9f6aeba0bbab5ee65d10f)]:
  - @mastra/core@1.3.0

## 1.3.0-alpha.1

### Patch Changes

- Fixed observational memory progress bars resetting to zero after agent responses finish. The messages and observations sidebar bars now retain their values on stream completion, cancellation, and page reload. Also added a buffer-status endpoint so buffering badges resolve with accurate token counts instead of spinning forever when buffering outlives the stream. ([#12934](https://github.com/mastra-ai/mastra/pull/12934))

- Updated dependencies [[`b31c922`](https://github.com/mastra-ai/mastra/commit/b31c922215b513791d98feaea1b98784aa00803a)]:
  - @mastra/core@1.3.0-alpha.2

## 1.3.0-alpha.0

### Minor Changes

- **Updated storage adapters for generic storage domain API** ([#12846](https://github.com/mastra-ai/mastra/pull/12846))

  All storage adapters now implement the unified `VersionedStorageDomain` method names. Entity-specific methods (`createAgent`, `getAgentById`, `deleteAgent`, etc.) have been replaced with generic equivalents (`create`, `getById`, `delete`, etc.) across agents, prompt blocks, and scorer definitions domains.

  Added `scorer-definitions` domain support to all adapters.

  **Before:**

  ```ts
  const store = storage.getStore('agents');
  await store.createAgent({ agent: input });
  await store.getAgentById({ id: 'abc' });
  await store.deleteAgent({ id: 'abc' });
  ```

  **After:**

  ```ts
  const store = storage.getStore('agents');
  await store.create({ agent: input });
  await store.getById('abc');
  await store.delete('abc');
  ```

### Patch Changes

- Fixed issues with stored agents ([#12790](https://github.com/mastra-ai/mastra/pull/12790))

- **Async buffering for observational memory is now enabled by default.** Observations are pre-computed in the background as conversations grow — when the context window fills up, buffered observations activate instantly with no blocking LLM call. This keeps agents responsive during long conversations. ([#12891](https://github.com/mastra-ai/mastra/pull/12891))

  **Default settings:**
  - `observation.bufferTokens: 0.2` — buffer every 20% of `messageTokens` (~6k tokens with the default 30k threshold)
  - `observation.bufferActivation: 0.8` — on activation, retain 20% of the message window
  - `reflection.bufferActivation: 0.5` — start background reflection at 50% of the observation threshold

  **Disabling async buffering:**

  Set `observation.bufferTokens: false` to disable async buffering for both observations and reflections:

  ```ts
  const memory = new Memory({
    options: {
      observationalMemory: {
        model: 'google/gemini-2.5-flash',
        observation: {
          bufferTokens: false,
        },
      },
    },
  });
  ```

  **Model is now required** when passing an observational memory config object. Use `observationalMemory: true` for the default (google/gemini-2.5-flash), or set a model explicitly:

  ```ts
  // Uses default model (google/gemini-2.5-flash)
  observationalMemory: true

  // Explicit model
  observationalMemory: {
    model: "google/gemini-2.5-flash",
  }
  ```

  **`shareTokenBudget` requires `bufferTokens: false`** (temporary limitation). If you use `shareTokenBudget: true`, you must explicitly disable async buffering:

  ```ts
  observationalMemory: {
    model: "google/gemini-2.5-flash",
    shareTokenBudget: true,
    observation: { bufferTokens: false },
  }
  ```

  **New streaming event:** `data-om-status` replaces `data-om-progress` with a structured status object containing active window usage, buffered observation/reflection state, and projected activation impact.

  **Buffering markers:** New `data-om-buffering-start`, `data-om-buffering-end`, and `data-om-buffering-failed` streaming events for UI feedback during background operations.

- Added prompt block storage implementations. Each store supports full CRUD for prompt blocks and their versions, including JSON serialization for rules and metadata. Also updated agent instructions serialization to support the new `AgentInstructionBlock` array format alongside plain strings. ([#12776](https://github.com/mastra-ai/mastra/pull/12776))

- Updated dependencies [[`717ffab`](https://github.com/mastra-ai/mastra/commit/717ffab42cfd58ff723b5c19ada4939997773004), [`e4b6dab`](https://github.com/mastra-ai/mastra/commit/e4b6dab171c5960e340b3ea3ea6da8d64d2b8672), [`5719fa8`](https://github.com/mastra-ai/mastra/commit/5719fa8880e86e8affe698ec4b3807c7e0e0a06f), [`83cda45`](https://github.com/mastra-ai/mastra/commit/83cda4523e588558466892bff8f80f631a36945a), [`11804ad`](https://github.com/mastra-ai/mastra/commit/11804adf1d6be46ebe216be40a43b39bb8b397d7), [`aa95f95`](https://github.com/mastra-ai/mastra/commit/aa95f958b186ae5c9f4219c88e268f5565c277a2), [`f5501ae`](https://github.com/mastra-ai/mastra/commit/f5501aedb0a11106c7db7e480d6eaf3971b7bda8), [`44573af`](https://github.com/mastra-ai/mastra/commit/44573afad0a4bc86f627d6cbc0207961cdcb3bc3), [`00e3861`](https://github.com/mastra-ai/mastra/commit/00e3861863fbfee78faeb1ebbdc7c0223aae13ff), [`7bfbc52`](https://github.com/mastra-ai/mastra/commit/7bfbc52a8604feb0fff2c0a082c13c0c2a3df1a2), [`1445994`](https://github.com/mastra-ai/mastra/commit/1445994aee19c9334a6a101cf7bd80ca7ed4d186), [`61f44a2`](https://github.com/mastra-ai/mastra/commit/61f44a26861c89e364f367ff40825bdb7f19df55), [`37145d2`](https://github.com/mastra-ai/mastra/commit/37145d25f99dc31f1a9105576e5452609843ce32), [`fdad759`](https://github.com/mastra-ai/mastra/commit/fdad75939ff008b27625f5ec0ce9c6915d99d9ec), [`e4569c5`](https://github.com/mastra-ai/mastra/commit/e4569c589e00c4061a686c9eb85afe1b7050b0a8), [`7309a85`](https://github.com/mastra-ai/mastra/commit/7309a85427281a8be23f4fb80ca52e18eaffd596), [`99424f6`](https://github.com/mastra-ai/mastra/commit/99424f6862ffb679c4ec6765501486034754a4c2), [`44eb452`](https://github.com/mastra-ai/mastra/commit/44eb4529b10603c279688318bebf3048543a1d61), [`6c40593`](https://github.com/mastra-ai/mastra/commit/6c40593d6d2b1b68b0c45d1a3a4c6ac5ecac3937), [`8c1135d`](https://github.com/mastra-ai/mastra/commit/8c1135dfb91b057283eae7ee11f9ec28753cc64f), [`dd39e54`](https://github.com/mastra-ai/mastra/commit/dd39e54ea34532c995b33bee6e0e808bf41a7341), [`b6fad9a`](https://github.com/mastra-ai/mastra/commit/b6fad9a602182b1cc0df47cd8c55004fa829ad61), [`4129c07`](https://github.com/mastra-ai/mastra/commit/4129c073349b5a66643fd8136ebfe9d7097cf793), [`5b930ab`](https://github.com/mastra-ai/mastra/commit/5b930aba1834d9898e8460a49d15106f31ac7c8d), [`4be93d0`](https://github.com/mastra-ai/mastra/commit/4be93d09d68e20aaf0ea3f210749422719618b5f), [`047635c`](https://github.com/mastra-ai/mastra/commit/047635ccd7861d726c62d135560c0022a5490aec), [`8c90ff4`](https://github.com/mastra-ai/mastra/commit/8c90ff4d3414e7f2a2d216ea91274644f7b29133), [`ed232d1`](https://github.com/mastra-ai/mastra/commit/ed232d1583f403925dc5ae45f7bee948cf2a182b), [`3891795`](https://github.com/mastra-ai/mastra/commit/38917953518eb4154a984ee36e6ededdcfe80f72), [`4f955b2`](https://github.com/mastra-ai/mastra/commit/4f955b20c7f66ed282ee1fd8709696fa64c4f19d), [`55a4c90`](https://github.com/mastra-ai/mastra/commit/55a4c9044ac7454349b9f6aeba0bbab5ee65d10f)]:
  - @mastra/core@1.3.0-alpha.1

## 1.2.0

### Minor Changes

- Added Observational Memory — a new memory system that keeps your agent's context window small while preserving long-term memory across conversations. ([#12599](https://github.com/mastra-ai/mastra/pull/12599))

  **Why:** Long conversations cause context rot and waste tokens. Observational Memory compresses conversation history into observations (5–40x compression) and periodically condenses those into reflections. Your agent stays fast and focused, even after thousands of messages.

  **Usage:**

  ```ts
  import { Memory } from '@mastra/memory';
  import { PostgresStore } from '@mastra/pg';

  const memory = new Memory({
    storage: new PostgresStore({ connectionString: process.env.DATABASE_URL }),
    options: {
      observationalMemory: true,
    },
  });

  const agent = new Agent({
    name: 'my-agent',
    model: openai('gpt-4o'),
    memory,
  });
  ```

  **What's new:**
  - `observationalMemory: true` enables the three-tier memory system (recent messages → observations → reflections)
  - Thread-scoped (per-conversation) and resource-scoped (shared across all threads for a user) modes
  - Manual `observe()` API for triggering observation outside the normal agent loop
  - New OM storage methods for pg, libsql, and mongodb adapters (conditionally enabled)
  - `Agent.findProcessor()` method for looking up processors by ID
  - `processorStates` for persisting processor state across loop iterations
  - Abort signal propagation to processors
  - `ProcessorStreamWriter` for custom stream events from processors

### Patch Changes

- Created @mastra/editor package for managing and resolving stored agent configurations ([#12631](https://github.com/mastra-ai/mastra/pull/12631))

  This major addition introduces the editor package, which provides a complete solution for storing, versioning, and instantiating agent configurations from a database. The editor seamlessly integrates with Mastra's storage layer to enable dynamic agent management.

  **Key Features:**
  - **Agent Storage & Retrieval**: Store complete agent configurations including instructions, model settings, tools, workflows, nested agents, scorers, processors, and memory configuration
  - **Version Management**: Create and manage multiple versions of agents, with support for activating specific versions
  - **Dependency Resolution**: Automatically resolves and instantiates all agent dependencies (tools, workflows, sub-agents, etc.) from the Mastra registry
  - **Caching**: Built-in caching for improved performance when repeatedly accessing stored agents
  - **Type Safety**: Full TypeScript support with proper typing for stored configurations

  **Usage Example:**

  ```typescript
  import { MastraEditor } from '@mastra/editor';
  import { Mastra } from '@mastra/core';

  // Initialize editor with Mastra
  const mastra = new Mastra({
    /* config */
    editor: new MastraEditor(),
  });

  // Store an agent configuration
  const agentId = await mastra.storage.stores?.agents?.createAgent({
    name: 'customer-support',
    instructions: 'Help customers with inquiries',
    model: { provider: 'openai', name: 'gpt-4' },
    tools: ['search-kb', 'create-ticket'],
    workflows: ['escalation-flow'],
    memory: { vector: 'pinecone-db' },
  });

  // Retrieve and use the stored agent
  const agent = await mastra.getEditor()?.getStoredAgentById(agentId);
  const response = await agent?.generate('How do I reset my password?');

  // List all stored agents
  const agents = await mastra.getEditor()?.listStoredAgents({ pageSize: 10 });
  ```

  **Storage Improvements:**
  - Fixed JSONB handling in LibSQL, PostgreSQL, and MongoDB adapters
  - Improved agent resolution queries to properly merge version data
  - Enhanced type safety for serialized configurations

- Updated dependencies [[`e6fc281`](https://github.com/mastra-ai/mastra/commit/e6fc281896a3584e9e06465b356a44fe7faade65), [`97be6c8`](https://github.com/mastra-ai/mastra/commit/97be6c8963130fca8a664fcf99d7b3a38e463595), [`2770921`](https://github.com/mastra-ai/mastra/commit/2770921eec4d55a36b278d15c3a83f694e462ee5), [`b1695db`](https://github.com/mastra-ai/mastra/commit/b1695db2d7be0c329d499619c7881899649188d0), [`5fe1fe0`](https://github.com/mastra-ai/mastra/commit/5fe1fe0109faf2c87db34b725d8a4571a594f80e), [`4133d48`](https://github.com/mastra-ai/mastra/commit/4133d48eaa354cdb45920dc6265732ffbc96788d), [`5dd01cc`](https://github.com/mastra-ai/mastra/commit/5dd01cce68d61874aa3ecbd91ee17884cfd5aca2), [`13e0a2a`](https://github.com/mastra-ai/mastra/commit/13e0a2a2bcec01ff4d701274b3727d5e907a6a01), [`f6673b8`](https://github.com/mastra-ai/mastra/commit/f6673b893b65b7d273ad25ead42e990704cc1e17), [`cd6be8a`](https://github.com/mastra-ai/mastra/commit/cd6be8ad32741cd41cabf508355bb31b71e8a5bd), [`9eb4e8e`](https://github.com/mastra-ai/mastra/commit/9eb4e8e39efbdcfff7a40ff2ce07ce2714c65fa8), [`c987384`](https://github.com/mastra-ai/mastra/commit/c987384d6c8ca844a9701d7778f09f5a88da7f9f), [`cb8cc12`](https://github.com/mastra-ai/mastra/commit/cb8cc12bfadd526aa95a01125076f1da44e4afa7), [`aa37c84`](https://github.com/mastra-ai/mastra/commit/aa37c84d29b7db68c72517337932ef486c316275), [`62f5d50`](https://github.com/mastra-ai/mastra/commit/62f5d5043debbba497dacb7ab008fe86b38b8de3), [`47eba72`](https://github.com/mastra-ai/mastra/commit/47eba72f0397d0d14fbe324b97940c3d55e5a525)]:
  - @mastra/core@1.2.0

## 1.2.0-alpha.0

### Minor Changes

- Added Observational Memory — a new memory system that keeps your agent's context window small while preserving long-term memory across conversations. ([#12599](https://github.com/mastra-ai/mastra/pull/12599))

  **Why:** Long conversations cause context rot and waste tokens. Observational Memory compresses conversation history into observations (5–40x compression) and periodically condenses those into reflections. Your agent stays fast and focused, even after thousands of messages.

  **Usage:**

  ```ts
  import { Memory } from '@mastra/memory';
  import { PostgresStore } from '@mastra/pg';

  const memory = new Memory({
    storage: new PostgresStore({ connectionString: process.env.DATABASE_URL }),
    options: {
      observationalMemory: true,
    },
  });

  const agent = new Agent({
    name: 'my-agent',
    model: openai('gpt-4o'),
    memory,
  });
  ```

  **What's new:**
  - `observationalMemory: true` enables the three-tier memory system (recent messages → observations → reflections)
  - Thread-scoped (per-conversation) and resource-scoped (shared across all threads for a user) modes
  - Manual `observe()` API for triggering observation outside the normal agent loop
  - New OM storage methods for pg, libsql, and mongodb adapters (conditionally enabled)
  - `Agent.findProcessor()` method for looking up processors by ID
  - `processorStates` for persisting processor state across loop iterations
  - Abort signal propagation to processors
  - `ProcessorStreamWriter` for custom stream events from processors

### Patch Changes

- Created @mastra/editor package for managing and resolving stored agent configurations ([#12631](https://github.com/mastra-ai/mastra/pull/12631))

  This major addition introduces the editor package, which provides a complete solution for storing, versioning, and instantiating agent configurations from a database. The editor seamlessly integrates with Mastra's storage layer to enable dynamic agent management.

  **Key Features:**
  - **Agent Storage & Retrieval**: Store complete agent configurations including instructions, model settings, tools, workflows, nested agents, scorers, processors, and memory configuration
  - **Version Management**: Create and manage multiple versions of agents, with support for activating specific versions
  - **Dependency Resolution**: Automatically resolves and instantiates all agent dependencies (tools, workflows, sub-agents, etc.) from the Mastra registry
  - **Caching**: Built-in caching for improved performance when repeatedly accessing stored agents
  - **Type Safety**: Full TypeScript support with proper typing for stored configurations

  **Usage Example:**

  ```typescript
  import { MastraEditor } from '@mastra/editor';
  import { Mastra } from '@mastra/core';

  // Initialize editor with Mastra
  const mastra = new Mastra({
    /* config */
    editor: new MastraEditor(),
  });

  // Store an agent configuration
  const agentId = await mastra.storage.stores?.agents?.createAgent({
    name: 'customer-support',
    instructions: 'Help customers with inquiries',
    model: { provider: 'openai', name: 'gpt-4' },
    tools: ['search-kb', 'create-ticket'],
    workflows: ['escalation-flow'],
    memory: { vector: 'pinecone-db' },
  });

  // Retrieve and use the stored agent
  const agent = await mastra.getEditor()?.getStoredAgentById(agentId);
  const response = await agent?.generate('How do I reset my password?');

  // List all stored agents
  const agents = await mastra.getEditor()?.listStoredAgents({ pageSize: 10 });
  ```

  **Storage Improvements:**
  - Fixed JSONB handling in LibSQL, PostgreSQL, and MongoDB adapters
  - Improved agent resolution queries to properly merge version data
  - Enhanced type safety for serialized configurations

- Updated dependencies [[`2770921`](https://github.com/mastra-ai/mastra/commit/2770921eec4d55a36b278d15c3a83f694e462ee5), [`b1695db`](https://github.com/mastra-ai/mastra/commit/b1695db2d7be0c329d499619c7881899649188d0), [`4133d48`](https://github.com/mastra-ai/mastra/commit/4133d48eaa354cdb45920dc6265732ffbc96788d), [`5dd01cc`](https://github.com/mastra-ai/mastra/commit/5dd01cce68d61874aa3ecbd91ee17884cfd5aca2), [`13e0a2a`](https://github.com/mastra-ai/mastra/commit/13e0a2a2bcec01ff4d701274b3727d5e907a6a01), [`c987384`](https://github.com/mastra-ai/mastra/commit/c987384d6c8ca844a9701d7778f09f5a88da7f9f), [`cb8cc12`](https://github.com/mastra-ai/mastra/commit/cb8cc12bfadd526aa95a01125076f1da44e4afa7), [`62f5d50`](https://github.com/mastra-ai/mastra/commit/62f5d5043debbba497dacb7ab008fe86b38b8de3)]:
  - @mastra/core@1.2.0-alpha.1

## 1.1.0

### Minor Changes

- Restructured stored agents to use a thin metadata record with versioned configuration snapshots. ([#12488](https://github.com/mastra-ai/mastra/pull/12488))

  The agent record now only stores metadata fields (id, status, activeVersionId, authorId, metadata, timestamps). All configuration fields (name, instructions, model, tools, etc.) live exclusively in version snapshot rows, enabling full version history and rollback.

  **Key changes:**
  - Stored Agent records are now thin metadata-only (StorageAgentType)
  - All config lives in version snapshots (StorageAgentSnapshotType)
  - New resolved type (StorageResolvedAgentType) merges agent record + active version config
  - Renamed `ownerId` to `authorId` for multi-tenant filtering
  - Changed `memory` field type from `string` to `Record<string, unknown>`
  - Added `status` field ('draft' | 'published') to agent records
  - Flattened CreateAgent/UpdateAgent input types (config fields at top level, no nested snapshot)
  - Version config columns are top-level in the agent_versions table (no single snapshot jsonb column)
  - List endpoints return resolved agents (thin record + active version config)
  - Auto-versioning on update with retention limits and race condition handling

- Added dynamic agent management with CRUD operations and version tracking ([#12038](https://github.com/mastra-ai/mastra/pull/12038))

  **New Features:**
  - Create, edit, and delete agents directly from the Mastra Studio UI
  - Full version history for agents with compare and restore capabilities
  - Visual diff viewer to compare agent configurations across versions
  - Agent creation modal with comprehensive configuration options (model selection, instructions, tools, workflows, sub-agents, memory)
  - AI-powered instruction enhancement

  **Storage:**
  - New storage interfaces for stored agents and agent versions
  - PostgreSQL, LibSQL, and MongoDB implementations included
  - In-memory storage for development and testing

  **API:**
  - RESTful endpoints for agent CRUD operations
  - Version management endpoints (create, list, activate, restore, delete, compare)
  - Automatic versioning on agent updates when enabled

  **Client SDK:**
  - JavaScript client with full support for stored agents and versions
  - Type-safe methods for all CRUD and version operations

  **Usage Example:**

  ```typescript
  // Server-side: Configure storage
  import { Mastra } from '@mastra/core';
  import { PgAgentsStorage } from '@mastra/pg';

  const mastra = new Mastra({
    agents: { agentOne },
    storage: {
      agents: new PgAgentsStorage({
        connectionString: process.env.DATABASE_URL,
      }),
    },
  });

  // Client-side: Use the SDK
  import { MastraClient } from '@mastra/client-js';

  const client = new MastraClient({ baseUrl: 'http://localhost:3000' });

  // Create a stored agent
  const agent = await client.createStoredAgent({
    name: 'Customer Support Agent',
    description: 'Handles customer inquiries',
    model: { provider: 'ANTHROPIC', name: 'claude-sonnet-4-5' },
    instructions: 'You are a helpful customer support agent...',
    tools: ['search', 'email'],
  });

  // Create a version snapshot
  await client.storedAgent(agent.id).createVersion({
    name: 'v1.0 - Initial release',
    changeMessage: 'First production version',
  });

  // Compare versions
  const diff = await client.storedAgent(agent.id).compareVersions('version-1', 'version-2');
  ```

  **Why:**
  This feature enables teams to manage agents dynamically without code changes, making it easier to iterate on agent configurations and maintain a complete audit trail of changes.

- Added `status` field to `listTraces` response. The status field indicates the trace state: `success` (completed without error), `error` (has error), or `running` (still in progress). This makes it easier to filter and display traces by their current state without having to derive it from the `error` and `endedAt` fields. ([#12213](https://github.com/mastra-ai/mastra/pull/12213))

### Patch Changes

- Updated dependencies [[`90fc0e5`](https://github.com/mastra-ai/mastra/commit/90fc0e5717cb280c2d4acf4f0410b510bb4c0a72), [`1cf5d2e`](https://github.com/mastra-ai/mastra/commit/1cf5d2ea1b085be23e34fb506c80c80a4e6d9c2b), [`b99ceac`](https://github.com/mastra-ai/mastra/commit/b99ceace2c830dbdef47c8692d56a91954aefea2), [`deea43e`](https://github.com/mastra-ai/mastra/commit/deea43eb1366d03a864c5e597d16a48592b9893f), [`833ae96`](https://github.com/mastra-ai/mastra/commit/833ae96c3e34370e58a1e979571c41f39a720592), [`943772b`](https://github.com/mastra-ai/mastra/commit/943772b4378f625f0f4e19ea2b7c392bd8e71786), [`b5c711b`](https://github.com/mastra-ai/mastra/commit/b5c711b281dd1fb81a399a766bc9f86c55efc13e), [`3efbe5a`](https://github.com/mastra-ai/mastra/commit/3efbe5ae20864c4f3143457f4f3ee7dc2fa5ca76), [`1e49e7a`](https://github.com/mastra-ai/mastra/commit/1e49e7ab5f173582154cb26b29d424de67d09aef), [`751eaab`](https://github.com/mastra-ai/mastra/commit/751eaab4e0d3820a94e4c3d39a2ff2663ded3d91), [`69d8156`](https://github.com/mastra-ai/mastra/commit/69d81568bcf062557c24471ce26812446bec465d), [`60d9d89`](https://github.com/mastra-ai/mastra/commit/60d9d899e44b35bc43f1bcd967a74e0ce010b1af), [`5c544c8`](https://github.com/mastra-ai/mastra/commit/5c544c8d12b08ab40d64d8f37b3c4215bee95b87), [`771ad96`](https://github.com/mastra-ai/mastra/commit/771ad962441996b5c43549391a3e6a02c6ddedc2), [`2b0936b`](https://github.com/mastra-ai/mastra/commit/2b0936b0c9a43eeed9bef63e614d7e02ee803f7e), [`3b04f30`](https://github.com/mastra-ai/mastra/commit/3b04f3010604f3cdfc8a0674731700ad66471cee), [`97e26de`](https://github.com/mastra-ai/mastra/commit/97e26deaebd9836647a67b96423281d66421ca07), [`ac9ec66`](https://github.com/mastra-ai/mastra/commit/ac9ec6672779b2e6d4344e415481d1a6a7d4911a), [`10523f4`](https://github.com/mastra-ai/mastra/commit/10523f4882d9b874b40ce6e3715f66dbcd4947d2), [`cb72d20`](https://github.com/mastra-ai/mastra/commit/cb72d2069d7339bda8a0e76d4f35615debb07b84), [`42856b1`](https://github.com/mastra-ai/mastra/commit/42856b1c8aeea6371c9ee77ae2f5f5fe34400933), [`66f33ff`](https://github.com/mastra-ai/mastra/commit/66f33ff68620018513e499c394411d1d39b3aa5c), [`ab3c190`](https://github.com/mastra-ai/mastra/commit/ab3c1901980a99910ca9b96a7090c22e24060113), [`d4f06c8`](https://github.com/mastra-ai/mastra/commit/d4f06c85ffa5bb0da38fb82ebf3b040cc6b4ec4e), [`0350626`](https://github.com/mastra-ai/mastra/commit/03506267ec41b67add80d994c0c0fcce93bbc75f), [`bc9fa00`](https://github.com/mastra-ai/mastra/commit/bc9fa00859c5c4a796d53a0a5cae46ab4a3072e4), [`f46a478`](https://github.com/mastra-ai/mastra/commit/f46a4782f595949c696569e891f81c8d26338508), [`90fc0e5`](https://github.com/mastra-ai/mastra/commit/90fc0e5717cb280c2d4acf4f0410b510bb4c0a72), [`f05a3a5`](https://github.com/mastra-ai/mastra/commit/f05a3a5cf2b9a9c2d40c09cb8c762a4b6cd5d565), [`a291da9`](https://github.com/mastra-ai/mastra/commit/a291da9363efd92dafd8775dccb4f2d0511ece7a), [`c5d71da`](https://github.com/mastra-ai/mastra/commit/c5d71da1c680ce5640b1a7f8ca0e024a4ab1cfed), [`07042f9`](https://github.com/mastra-ai/mastra/commit/07042f9f89080f38b8f72713ba1c972d5b1905b8), [`0423442`](https://github.com/mastra-ai/mastra/commit/0423442b7be2dfacba95890bea8f4a810db4d603)]:
  - @mastra/core@1.1.0

## 1.1.0-alpha.1

### Minor Changes

- Restructured stored agents to use a thin metadata record with versioned configuration snapshots. ([#12488](https://github.com/mastra-ai/mastra/pull/12488))

  The agent record now only stores metadata fields (id, status, activeVersionId, authorId, metadata, timestamps). All configuration fields (name, instructions, model, tools, etc.) live exclusively in version snapshot rows, enabling full version history and rollback.

  **Key changes:**
  - Stored Agent records are now thin metadata-only (StorageAgentType)
  - All config lives in version snapshots (StorageAgentSnapshotType)
  - New resolved type (StorageResolvedAgentType) merges agent record + active version config
  - Renamed `ownerId` to `authorId` for multi-tenant filtering
  - Changed `memory` field type from `string` to `Record<string, unknown>`
  - Added `status` field ('draft' | 'published') to agent records
  - Flattened CreateAgent/UpdateAgent input types (config fields at top level, no nested snapshot)
  - Version config columns are top-level in the agent_versions table (no single snapshot jsonb column)
  - List endpoints return resolved agents (thin record + active version config)
  - Auto-versioning on update with retention limits and race condition handling

### Patch Changes

- Updated dependencies [[`b99ceac`](https://github.com/mastra-ai/mastra/commit/b99ceace2c830dbdef47c8692d56a91954aefea2), [`deea43e`](https://github.com/mastra-ai/mastra/commit/deea43eb1366d03a864c5e597d16a48592b9893f), [`ac9ec66`](https://github.com/mastra-ai/mastra/commit/ac9ec6672779b2e6d4344e415481d1a6a7d4911a)]:
  - @mastra/core@1.1.0-alpha.1

## 1.1.0-alpha.0

### Minor Changes

- Added dynamic agent management with CRUD operations and version tracking ([#12038](https://github.com/mastra-ai/mastra/pull/12038))

  **New Features:**
  - Create, edit, and delete agents directly from the Mastra Studio UI
  - Full version history for agents with compare and restore capabilities
  - Visual diff viewer to compare agent configurations across versions
  - Agent creation modal with comprehensive configuration options (model selection, instructions, tools, workflows, sub-agents, memory)
  - AI-powered instruction enhancement

  **Storage:**
  - New storage interfaces for stored agents and agent versions
  - PostgreSQL, LibSQL, and MongoDB implementations included
  - In-memory storage for development and testing

  **API:**
  - RESTful endpoints for agent CRUD operations
  - Version management endpoints (create, list, activate, restore, delete, compare)
  - Automatic versioning on agent updates when enabled

  **Client SDK:**
  - JavaScript client with full support for stored agents and versions
  - Type-safe methods for all CRUD and version operations

  **Usage Example:**

  ```typescript
  // Server-side: Configure storage
  import { Mastra } from '@mastra/core';
  import { PgAgentsStorage } from '@mastra/pg';

  const mastra = new Mastra({
    agents: { agentOne },
    storage: {
      agents: new PgAgentsStorage({
        connectionString: process.env.DATABASE_URL,
      }),
    },
  });

  // Client-side: Use the SDK
  import { MastraClient } from '@mastra/client-js';

  const client = new MastraClient({ baseUrl: 'http://localhost:3000' });

  // Create a stored agent
  const agent = await client.createStoredAgent({
    name: 'Customer Support Agent',
    description: 'Handles customer inquiries',
    model: { provider: 'ANTHROPIC', name: 'claude-sonnet-4-5' },
    instructions: 'You are a helpful customer support agent...',
    tools: ['search', 'email'],
  });

  // Create a version snapshot
  await client.storedAgent(agent.id).createVersion({
    name: 'v1.0 - Initial release',
    changeMessage: 'First production version',
  });

  // Compare versions
  const diff = await client.storedAgent(agent.id).compareVersions('version-1', 'version-2');
  ```

  **Why:**
  This feature enables teams to manage agents dynamically without code changes, making it easier to iterate on agent configurations and maintain a complete audit trail of changes.

- Added `status` field to `listTraces` response. The status field indicates the trace state: `success` (completed without error), `error` (has error), or `running` (still in progress). This makes it easier to filter and display traces by their current state without having to derive it from the `error` and `endedAt` fields. ([#12213](https://github.com/mastra-ai/mastra/pull/12213))

### Patch Changes

- Updated dependencies [[`90fc0e5`](https://github.com/mastra-ai/mastra/commit/90fc0e5717cb280c2d4acf4f0410b510bb4c0a72), [`1cf5d2e`](https://github.com/mastra-ai/mastra/commit/1cf5d2ea1b085be23e34fb506c80c80a4e6d9c2b), [`833ae96`](https://github.com/mastra-ai/mastra/commit/833ae96c3e34370e58a1e979571c41f39a720592), [`943772b`](https://github.com/mastra-ai/mastra/commit/943772b4378f625f0f4e19ea2b7c392bd8e71786), [`b5c711b`](https://github.com/mastra-ai/mastra/commit/b5c711b281dd1fb81a399a766bc9f86c55efc13e), [`3efbe5a`](https://github.com/mastra-ai/mastra/commit/3efbe5ae20864c4f3143457f4f3ee7dc2fa5ca76), [`1e49e7a`](https://github.com/mastra-ai/mastra/commit/1e49e7ab5f173582154cb26b29d424de67d09aef), [`751eaab`](https://github.com/mastra-ai/mastra/commit/751eaab4e0d3820a94e4c3d39a2ff2663ded3d91), [`69d8156`](https://github.com/mastra-ai/mastra/commit/69d81568bcf062557c24471ce26812446bec465d), [`60d9d89`](https://github.com/mastra-ai/mastra/commit/60d9d899e44b35bc43f1bcd967a74e0ce010b1af), [`5c544c8`](https://github.com/mastra-ai/mastra/commit/5c544c8d12b08ab40d64d8f37b3c4215bee95b87), [`771ad96`](https://github.com/mastra-ai/mastra/commit/771ad962441996b5c43549391a3e6a02c6ddedc2), [`2b0936b`](https://github.com/mastra-ai/mastra/commit/2b0936b0c9a43eeed9bef63e614d7e02ee803f7e), [`3b04f30`](https://github.com/mastra-ai/mastra/commit/3b04f3010604f3cdfc8a0674731700ad66471cee), [`97e26de`](https://github.com/mastra-ai/mastra/commit/97e26deaebd9836647a67b96423281d66421ca07), [`10523f4`](https://github.com/mastra-ai/mastra/commit/10523f4882d9b874b40ce6e3715f66dbcd4947d2), [`cb72d20`](https://github.com/mastra-ai/mastra/commit/cb72d2069d7339bda8a0e76d4f35615debb07b84), [`42856b1`](https://github.com/mastra-ai/mastra/commit/42856b1c8aeea6371c9ee77ae2f5f5fe34400933), [`66f33ff`](https://github.com/mastra-ai/mastra/commit/66f33ff68620018513e499c394411d1d39b3aa5c), [`ab3c190`](https://github.com/mastra-ai/mastra/commit/ab3c1901980a99910ca9b96a7090c22e24060113), [`d4f06c8`](https://github.com/mastra-ai/mastra/commit/d4f06c85ffa5bb0da38fb82ebf3b040cc6b4ec4e), [`0350626`](https://github.com/mastra-ai/mastra/commit/03506267ec41b67add80d994c0c0fcce93bbc75f), [`bc9fa00`](https://github.com/mastra-ai/mastra/commit/bc9fa00859c5c4a796d53a0a5cae46ab4a3072e4), [`f46a478`](https://github.com/mastra-ai/mastra/commit/f46a4782f595949c696569e891f81c8d26338508), [`90fc0e5`](https://github.com/mastra-ai/mastra/commit/90fc0e5717cb280c2d4acf4f0410b510bb4c0a72), [`f05a3a5`](https://github.com/mastra-ai/mastra/commit/f05a3a5cf2b9a9c2d40c09cb8c762a4b6cd5d565), [`a291da9`](https://github.com/mastra-ai/mastra/commit/a291da9363efd92dafd8775dccb4f2d0511ece7a), [`c5d71da`](https://github.com/mastra-ai/mastra/commit/c5d71da1c680ce5640b1a7f8ca0e024a4ab1cfed), [`07042f9`](https://github.com/mastra-ai/mastra/commit/07042f9f89080f38b8f72713ba1c972d5b1905b8), [`0423442`](https://github.com/mastra-ai/mastra/commit/0423442b7be2dfacba95890bea8f4a810db4d603)]:
  - @mastra/core@1.1.0-alpha.0

## 1.0.0

### Major Changes

- Moving scorers under the eval domain, api method consistency, prebuilt evals, scorers require ids. ([#9589](https://github.com/mastra-ai/mastra/pull/9589))

- Every Mastra primitive (agent, MCPServer, workflow, tool, processor, scorer, and vector) now has a get, list, and add method associated with it. Each primitive also now requires an id to be set. ([#9675](https://github.com/mastra-ai/mastra/pull/9675))

  Primitives that are added to other primitives are also automatically added to the Mastra instance

- Update handlers to use `listWorkflowRuns` instead of `getWorkflowRuns`. Fix type names from `StoragelistThreadsByResourceIdInput/Output` to `StorageListThreadsByResourceIdInput/Output`. ([#9507](https://github.com/mastra-ai/mastra/pull/9507))

- Remove `getMessagesPaginated()` and add `perPage: false` support ([#9670](https://github.com/mastra-ai/mastra/pull/9670))

  Removes deprecated `getMessagesPaginated()` method. The `listMessages()` API and score handlers now support `perPage: false` to fetch all records without pagination limits.

  **Storage changes:**
  - `StoragePagination.perPage` type changed from `number` to `number | false`
  - All storage implementations support `perPage: false`:
    - Memory: `listMessages()`
    - Scores: `listScoresBySpan()`, `listScoresByRunId()`, `listScoresByExecutionId()`
  - HTTP query parser accepts `"false"` string (e.g., `?perPage=false`)

  **Memory changes:**
  - `memory.query()` parameter type changed from `StorageGetMessagesArg` to `StorageListMessagesInput`
  - Uses flat parameters (`page`, `perPage`, `include`, `filter`, `vectorSearchString`) instead of `selectBy` object

  **Stricter validation:**
  - `listMessages()` requires non-empty, non-whitespace `threadId` (throws error instead of returning empty results)

  **Migration:**

  ```typescript
  // Storage/Memory: Replace getMessagesPaginated with listMessages
  - storage.getMessagesPaginated({ threadId, selectBy: { pagination: { page: 0, perPage: 20 } } })
  + storage.listMessages({ threadId, page: 0, perPage: 20 })
  + storage.listMessages({ threadId, page: 0, perPage: false })  // Fetch all

  // Memory: Replace selectBy with flat parameters
  - memory.query({ threadId, selectBy: { last: 20, include: [...] } })
  + memory.query({ threadId, perPage: 20, include: [...] })

  // Client SDK
  - thread.getMessagesPaginated({ selectBy: { pagination: { page: 0 } } })
  + thread.listMessages({ page: 0, perPage: 20 })
  ```

- **Removed `storage.getMessages()`** ([#9695](https://github.com/mastra-ai/mastra/pull/9695))

  The `getMessages()` method has been removed from all storage implementations. Use `listMessages()` instead, which provides pagination support.

  **Migration:**

  ```typescript
  // Before
  const messages = await storage.getMessages({ threadId: 'thread-1' });

  // After
  const result = await storage.listMessages({
    threadId: 'thread-1',
    page: 0,
    perPage: 50,
  });
  const messages = result.messages; // Access messages array
  console.log(result.total); // Total count
  console.log(result.hasMore); // Whether more pages exist
  ```

  **Message ordering default**

  `listMessages()` defaults to ASC (oldest first) ordering by `createdAt`, matching the previous `getMessages()` behavior.

  **To use DESC ordering (newest first):**

  ```typescript
  const result = await storage.listMessages({
    threadId: 'thread-1',
    orderBy: { field: 'createdAt', direction: 'DESC' },
  });
  ```

  **Renamed `client.getThreadMessages()` → `client.listThreadMessages()`**

  **Migration:**

  ```typescript
  // Before
  const response = await client.getThreadMessages(threadId, { agentId });

  // After
  const response = await client.listThreadMessages(threadId, { agentId });
  ```

  The response format remains the same.

  **Removed `StorageGetMessagesArg` type**

  Use `StorageListMessagesInput` instead:

  ```typescript
  // Before
  import type { StorageGetMessagesArg } from '@mastra/core';

  // After
  import type { StorageListMessagesInput } from '@mastra/core';
  ```

- Bump minimum required Node.js version to 22.13.0 ([#9706](https://github.com/mastra-ai/mastra/pull/9706))

- Add new list methods to storage API: `listMessages`, `listMessagesById`, `listThreadsByResourceId`, and `listWorkflowRuns`. Most methods are currently wrappers around existing methods. Full implementations will be added when migrating away from legacy methods. ([#9489](https://github.com/mastra-ai/mastra/pull/9489))

- Rename RuntimeContext to RequestContext ([#9511](https://github.com/mastra-ai/mastra/pull/9511))

- Implement listMessages API for replacing previous methods ([#9531](https://github.com/mastra-ai/mastra/pull/9531))

- Remove `getThreadsByResourceId` and `getThreadsByResourceIdPaginated` methods from storage interfaces in favor of `listThreadsByResourceId`. The new method uses `offset`/`limit` pagination and a nested `orderBy` object structure (`{ field, direction }`). ([#9536](https://github.com/mastra-ai/mastra/pull/9536))

- Remove `getMessagesById` method from storage interfaces in favor of `listMessagesById`. The new method only returns V2-format messages and removes the format parameter, simplifying the API surface. Users should migrate from `getMessagesById({ messageIds, format })` to `listMessagesById({ messageIds })`. ([#9534](https://github.com/mastra-ai/mastra/pull/9534))

- Renamed a bunch of observability/tracing-related things to drop the AI prefix. ([#9744](https://github.com/mastra-ai/mastra/pull/9744))

- Pagination APIs now use `page`/`perPage` instead of `offset`/`limit` ([#9592](https://github.com/mastra-ai/mastra/pull/9592))

  All storage and memory pagination APIs have been updated to use `page` (0-indexed) and `perPage` instead of `offset` and `limit`, aligning with standard REST API patterns.

  **Affected APIs:**
  - `Memory.listThreadsByResourceId()`
  - `Memory.listMessages()`
  - `Storage.listWorkflowRuns()`

  **Migration:**

  ```typescript
  // Before
  await memory.listThreadsByResourceId({
    resourceId: 'user-123',
    offset: 20,
    limit: 10,
  });

  // After
  await memory.listThreadsByResourceId({
    resourceId: 'user-123',
    page: 2, // page = Math.floor(offset / limit)
    perPage: 10,
  });

  // Before
  await memory.listMessages({
    threadId: 'thread-456',
    offset: 20,
    limit: 10,
  });

  // After
  await memory.listMessages({
    threadId: 'thread-456',
    page: 2,
    perPage: 10,
  });

  // Before
  await storage.listWorkflowRuns({
    workflowName: 'my-workflow',
    offset: 20,
    limit: 10,
  });

  // After
  await storage.listWorkflowRuns({
    workflowName: 'my-workflow',
    page: 2,
    perPage: 10,
  });
  ```

  **Additional improvements:**
  - Added validation for negative `page` values in all storage implementations
  - Improved `perPage` validation to handle edge cases (negative values, `0`, `false`)
  - Added reusable query parser utilities for consistent validation in handlers

- ```ts ([#9709](https://github.com/mastra-ai/mastra/pull/9709))
  import { Mastra } from '@mastra/core';
  import { Observability } from '@mastra/observability'; // Explicit import

  const mastra = new Mastra({
    ...other_config,
    observability: new Observability({
      default: { enabled: true },
    }), // Instance
  });
  ```

  Instead of:

  ```ts
  import { Mastra } from '@mastra/core';
  import '@mastra/observability/init'; // Explicit import

  const mastra = new Mastra({
    ...other_config,
    observability: {
      default: { enabled: true },
    },
  });
  ```

  Also renamed a bunch of:
  - `Tracing` things to `Observability` things.
  - `AI-` things to just things.

- Removed old tracing code based on OpenTelemetry ([#9237](https://github.com/mastra-ai/mastra/pull/9237))

- Mark as stable ([`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc))

- Renamed `MastraMessageV2` to `MastraDBMessage` ([#9255](https://github.com/mastra-ai/mastra/pull/9255))
  Made the return format of all methods that return db messages consistent. It's always `{ messages: MastraDBMessage[] }` now, and messages can be converted after that using `@mastra/ai-sdk/ui`'s `toAISdkV4/5Messages()` function

- moved ai-tracing code into @mastra/observability ([#9661](https://github.com/mastra-ai/mastra/pull/9661))

- Remove legacy evals from Mastra ([#9491](https://github.com/mastra-ai/mastra/pull/9491))

### Minor Changes

- Update peer dependencies to match core package version bump (1.0.0) ([#9237](https://github.com/mastra-ai/mastra/pull/9237))

- Introduce StorageDomain base class for composite storage support ([#11249](https://github.com/mastra-ai/mastra/pull/11249))

  Storage adapters now use a domain-based architecture where each domain (memory, workflows, scores, observability, agents) extends a `StorageDomain` base class with `init()` and `dangerouslyClearAll()` methods.

  **Key changes:**
  - Add `StorageDomain` abstract base class that all domain storage classes extend
  - Add `InMemoryDB` class for shared state across in-memory domain implementations
  - All storage domains now implement `dangerouslyClearAll()` for test cleanup
  - Remove `operations` from public `StorageDomains` type (now internal to each adapter)
  - Add flexible client/config patterns - domains accept either an existing database client or config to create one internally

  **Why this matters:**

  This enables composite storage where you can use different database adapters per domain:

  ```typescript
  import { Mastra } from '@mastra/core';
  import { PostgresStore } from '@mastra/pg';
  import { ClickhouseStore } from '@mastra/clickhouse';

  // Use Postgres for most domains but Clickhouse for observability
  const mastra = new Mastra({
    storage: new PostgresStore({
      connectionString: 'postgres://...',
    }),
    // Future: override specific domains
    // observability: new ClickhouseStore({ ... }).getStore('observability'),
  });
  ```

  **Standalone domain usage:**

  Domains can now be used independently with flexible configuration:

  ```typescript
  import { MemoryLibSQL } from '@mastra/libsql/memory';

  // Option 1: Pass config to create client internally
  const memory = new MemoryLibSQL({
    url: 'file:./local.db',
  });

  // Option 2: Pass existing client for shared connections
  import { createClient } from '@libsql/client';
  const client = createClient({ url: 'file:./local.db' });
  const memory = new MemoryLibSQL({ client });
  ```

  **Breaking changes:**
  - `StorageDomains` type no longer includes `operations` - access via `getStore()` instead
  - Domain base classes now require implementing `dangerouslyClearAll()` method

- Refactor storage architecture to use domain-specific stores via `getStore()` pattern ([#11361](https://github.com/mastra-ai/mastra/pull/11361))

  ### Summary

  This release introduces a new storage architecture that replaces passthrough methods on `MastraStorage` with domain-specific storage interfaces accessed via `getStore()`. This change reduces code duplication across storage adapters and provides a cleaner, more modular API.

  ### Migration Guide

  All direct method calls on storage instances should be updated to use `getStore()`:

  ```typescript
  // Before
  const thread = await storage.getThreadById({ threadId });
  await storage.persistWorkflowSnapshot({ workflowName, runId, snapshot });
  await storage.createSpan(span);

  // After
  const memory = await storage.getStore('memory');
  const thread = await memory?.getThreadById({ threadId });

  const workflows = await storage.getStore('workflows');
  await workflows?.persistWorkflowSnapshot({ workflowName, runId, snapshot });

  const observability = await storage.getStore('observability');
  await observability?.createSpan(span);
  ```

  ### Available Domains
  - **`memory`**: Thread and message operations (`getThreadById`, `saveThread`, `saveMessages`, etc.)
  - **`workflows`**: Workflow state persistence (`persistWorkflowSnapshot`, `loadWorkflowSnapshot`, `getWorkflowRunById`, etc.)
  - **`scores`**: Evaluation scores (`saveScore`, `listScoresByScorerId`, etc.)
  - **`observability`**: Tracing and spans (`createSpan`, `updateSpan`, `getTrace`, etc.)
  - **`agents`**: Stored agent configurations (`createAgent`, `getAgentById`, `listAgents`, etc.)

  ### Breaking Changes
  - Passthrough methods have been removed from `MastraStorage` base class
  - All storage adapters now require accessing domains via `getStore()`
  - The `stores` property on storage instances is now the canonical way to access domain storage

  ### Internal Changes
  - Each storage adapter now initializes domain-specific stores in its constructor
  - Domain stores share database connections and handle their own table initialization

- Unified observability schema with entity-based span identification ([#11132](https://github.com/mastra-ai/mastra/pull/11132))

  ## What changed

  Spans now use a unified identification model with `entityId`, `entityType`, and `entityName` instead of separate `agentId`, `toolId`, `workflowId` fields.

  **Before:**

  ```typescript
  // Old span structure
  span.agentId; // 'my-agent'
  span.toolId; // undefined
  span.workflowId; // undefined
  ```

  **After:**

  ```typescript
  // New span structure
  span.entityType; // EntityType.AGENT
  span.entityId; // 'my-agent'
  span.entityName; // 'My Agent'
  ```

  ## New `listTraces()` API

  Query traces with filtering, pagination, and sorting:

  ```typescript
  const { spans, pagination } = await storage.listTraces({
    filters: {
      entityType: EntityType.AGENT,
      entityId: 'my-agent',
      userId: 'user-123',
      environment: 'production',
      status: TraceStatus.SUCCESS,
      startedAt: { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
    },
    pagination: { page: 0, perPage: 50 },
    orderBy: { field: 'startedAt', direction: 'DESC' },
  });
  ```

  **Available filters:** date ranges (`startedAt`, `endedAt`), entity (`entityType`, `entityId`, `entityName`), identity (`userId`, `organizationId`), correlation IDs (`runId`, `sessionId`, `threadId`), deployment (`environment`, `source`, `serviceName`), `tags`, `metadata`, and `status`.

  ## New retrieval methods
  - `getSpan({ traceId, spanId })` - Get a single span
  - `getRootSpan({ traceId })` - Get the root span of a trace
  - `getTrace({ traceId })` - Get all spans for a trace

  ## Backward compatibility

  The legacy `getTraces()` method continues to work. When you pass `name: "agent run: my-agent"`, it automatically transforms to `entityId: "my-agent", entityType: AGENT`.

  ## Migration

  **Automatic:** SQL-based stores (PostgreSQL, LibSQL, MSSQL) automatically add new columns to existing `spans` tables on initialization. Existing data is preserved with new columns set to `NULL`.

  **No action required:** Your existing code continues to work. Adopt the new fields and `listTraces()` API at your convenience.

- Add configurable embeddingFieldPath option to MongoDBVector constructor. This allows users to specify custom paths for storing vector embeddings, including nested document paths using dot notation (e.g., text.contentEmbedding). Defaults to 'embedding' for backward compatibility. ([#11944](https://github.com/mastra-ai/mastra/pull/11944))

- Add `disableInit` option to all storage adapters ([#10851](https://github.com/mastra-ai/mastra/pull/10851))

  Adds a new `disableInit` config option to all storage providers that allows users to disable automatic table creation/migrations at runtime. This is useful for CI/CD pipelines where you want to run migrations during deployment with elevated credentials, then run the application with `disableInit: true` so it doesn't attempt schema changes at runtime.

  ```typescript
  // CI/CD script - run migrations
  const storage = new PostgresStore({
    connectionString: DATABASE_URL,
    id: 'pg-storage',
  });
  await storage.init();

  // Runtime - skip auto-init
  const storage = new PostgresStore({
    connectionString: DATABASE_URL,
    id: 'pg-storage',
    disableInit: true,
  });
  ```

### Patch Changes

- dependencies updates: ([#10114](https://github.com/mastra-ai/mastra/pull/10114))
  - Updated dependency [`uuid@^13.0.0` ↗︎](https://www.npmjs.com/package/uuid/v/13.0.0) (from `^11.1.0`, in `dependencies`)

- dependencies updates: ([#10196](https://github.com/mastra-ai/mastra/pull/10196))
  - Updated dependency [`mongodb@^7.0.0` ↗︎](https://www.npmjs.com/package/mongodb/v/7.0.0) (from `^6.17.0`, in `dependencies`)

- Add embedded documentation support for Mastra packages ([#11472](https://github.com/mastra-ai/mastra/pull/11472))

  Mastra packages now include embedded documentation in the published npm package under `dist/docs/`. This enables coding agents and AI assistants to understand and use the framework by reading documentation directly from `node_modules`.

  Each package includes:
  - **SKILL.md** - Entry point explaining the package's purpose and capabilities
  - **SOURCE_MAP.json** - Machine-readable index mapping exports to types and implementation files
  - **Topic folders** - Conceptual documentation organized by feature area

  Documentation is driven by the `packages` frontmatter field in MDX files, which maps docs to their corresponding packages. CI validation ensures all docs include this field.

- Fix MongoDB scores storage sort logic to use numeric sort values (-1) instead of string values ('desc') for consistency with other MongoDB domains (agents, memory, observability, workflows). ([#11729](https://github.com/mastra-ai/mastra/pull/11729))

- Standardize error IDs across all storage and vector stores using centralized helper functions (`createStorageErrorId` and `createVectorErrorId`). This ensures consistent error ID patterns (`MASTRA_STORAGE_{STORE}_{OPERATION}_{STATUS}` and `MASTRA_VECTOR_{STORE}_{OPERATION}_{STATUS}`) across the codebase for better error tracking and debugging. ([#10913](https://github.com/mastra-ai/mastra/pull/10913))

- Fix saveScore not persisting ID correctly, breaking getScoreById retrieval ([#10915](https://github.com/mastra-ai/mastra/pull/10915))

  **What Changed**
  - saveScore now correctly returns scores that can be retrieved with getScoreById
  - Validation errors now include contextual information (scorer, entity, trace details) for easier debugging

  **Impact**
  Previously, calling getScoreById after saveScore would return null because the generated ID wasn't persisted to the database. This is now fixed across all store implementations, ensuring consistent behavior and data integrity.

- Add new deleteVectors, updateVector by filter ([#10408](https://github.com/mastra-ai/mastra/pull/10408))

- - Fixed TypeScript errors where `threadId: string | string[]` was being passed to places expecting `Scalar` type ([#10663](https://github.com/mastra-ai/mastra/pull/10663))
  - Added proper multi-thread support for `listMessages` across all adapters when `threadId` is an array
  - Updated `_getIncludedMessages` to look up message threadId by ID (since message IDs are globally unique)
  - **upstash**: Added `msg-idx:{messageId}` index for O(1) message lookups (backwards compatible with fallback to scan for old messages, with automatic backfill)

- Preserve error details when thrown from workflow steps ([#10992](https://github.com/mastra-ai/mastra/pull/10992))

  Workflow errors now retain custom properties like `statusCode`, `responseHeaders`, and `cause` chains. This enables error-specific recovery logic in your applications.

  **Before:**

  ```typescript
  const result = await workflow.execute({ input });
  if (result.status === 'failed') {
    // Custom error properties were lost
    console.log(result.error); // "Step execution failed" (just a string)
  }
  ```

  **After:**

  ```typescript
  const result = await workflow.execute({ input });
  if (result.status === 'failed') {
    // Custom properties are preserved
    console.log(result.error.message); // "Step execution failed"
    console.log(result.error.statusCode); // 429
    console.log(result.error.cause?.name); // "RateLimitError"
  }
  ```

  **Type change:** `WorkflowState.error` and `WorkflowRunState.error` types changed from `string | Error` to `SerializedError`.

  Other changes:
  - Added `UpdateWorkflowStateOptions` type for workflow state updates

- Added `startExclusive` and `endExclusive` options to `dateRange` filter for message queries. ([#11479](https://github.com/mastra-ai/mastra/pull/11479))

  **What changed:** The `filter.dateRange` parameter in `listMessages()` and `Memory.recall()` now supports `startExclusive` and `endExclusive` boolean options. When set to `true`, messages with timestamps exactly matching the boundary are excluded from results.

  **Why this matters:** Enables cursor-based pagination for chat applications. When new messages arrive during a session, offset-based pagination can skip or duplicate messages. Using `endExclusive: true` with the oldest message's timestamp as a cursor ensures consistent pagination without gaps or duplicates.

  **Example:**

  ```typescript
  // Get first page
  const page1 = await memory.recall({
    threadId: 'thread-123',
    perPage: 10,
    orderBy: { field: 'createdAt', direction: 'DESC' },
  });

  // Get next page using cursor-based pagination
  const oldestMessage = page1.messages[page1.messages.length - 1];
  const page2 = await memory.recall({
    threadId: 'thread-123',
    perPage: 10,
    orderBy: { field: 'createdAt', direction: 'DESC' },
    filter: {
      dateRange: {
        end: oldestMessage.createdAt,
        endExclusive: true, // Excludes the cursor message
      },
    },
  });
  ```

- Ensure score responses match saved payloads for Mastra Stores. ([#10557](https://github.com/mastra-ai/mastra/pull/10557))

- Fixed duplicate spans migration issue across all storage backends. When upgrading from older versions, existing duplicate (traceId, spanId) combinations in the spans table could prevent the unique constraint from being created. The migration deduplicates spans before adding the constraint. ([#12073](https://github.com/mastra-ai/mastra/pull/12073))

  **Deduplication rules (in priority order):**
  1. Keep completed spans (those with `endedAt` set) over incomplete spans
  2. Among spans with the same completion status, keep the one with the newest `updatedAt`
  3. Use `createdAt` as the final tiebreaker

  **What changed:**
  - Added `migrateSpans()` method to observability stores for manual migration
  - Added `checkSpansMigrationStatus()` method to check if migration is needed
  - All stores use optimized single-query deduplication to avoid memory issues on large tables

  **Usage example:**

  ```typescript
  const observability = await storage.getStore('observability');
  const status = await observability.checkSpansMigrationStatus();
  if (status.needsMigration) {
    const result = await observability.migrateSpans();
    console.log(`Migration complete: ${result.duplicatesRemoved} duplicates removed`);
  }
  ```

  Fixes #11840

- Add storage composition to MastraStorage ([#11401](https://github.com/mastra-ai/mastra/pull/11401))

  `MastraStorage` can now compose storage domains from different adapters. Use it when you need different databases for different purposes - for example, PostgreSQL for memory and workflows, but a different database for observability.

  ```typescript
  import { MastraStorage } from '@mastra/core/storage';
  import { MemoryPG, WorkflowsPG, ScoresPG } from '@mastra/pg';
  import { MemoryLibSQL } from '@mastra/libsql';

  // Compose domains from different stores
  const storage = new MastraStorage({
    id: 'composite',
    domains: {
      memory: new MemoryLibSQL({ url: 'file:./local.db' }),
      workflows: new WorkflowsPG({ connectionString: process.env.DATABASE_URL }),
      scores: new ScoresPG({ connectionString: process.env.DATABASE_URL }),
    },
  });
  ```

  **Breaking changes:**
  - `storage.supports` property no longer exists
  - `StorageSupports` type is no longer exported from `@mastra/core/storage`

  All stores now support the same features. For domain availability, use `getStore()`:

  ```typescript
  const store = await storage.getStore('memory');
  if (store) {
    // domain is available
  }
  ```

- Add delete workflow run API ([#10991](https://github.com/mastra-ai/mastra/pull/10991))

  ```typescript
  await workflow.deleteWorkflowRunById(runId);
  ```

- Fix MongoDB connection string parameter naming inconsistency. MongoDBVector now uses uri parameter (correct MongoDB terminology). MongoDBStore now accepts both uri (recommended) and url (deprecated, for backward compatibility). Added clear error messages when connection string is missing. ([#11728](https://github.com/mastra-ai/mastra/pull/11728))

- Added a unified `transformScoreRow` function in `@mastra/core/storage` that provides schema-driven row transformation for score data. This eliminates code duplication across 10 storage adapters while maintaining store-specific behavior through configurable options: ([#10648](https://github.com/mastra-ai/mastra/pull/10648))
  - `preferredTimestampFields`: Preferred source fields for timestamps (PostgreSQL, Cloudflare D1)
  - `convertTimestamps`: Convert timestamp strings to Date objects (MSSQL, MongoDB, ClickHouse)
  - `nullValuePattern`: Skip values matching pattern (ClickHouse's `'_null_'`)
  - `fieldMappings`: Map source column names to schema fields (LibSQL's `additionalLLMContext`)

  Each store adapter now uses the unified function with appropriate options, reducing ~200 lines of duplicate transformation logic while ensuring consistent behavior across all storage backends.

- Added new `listThreads` method for flexible thread filtering across all storage adapters. ([#11832](https://github.com/mastra-ai/mastra/pull/11832))

  **New Features**
  - Filter threads by `resourceId`, `metadata`, or both (with AND logic for metadata key-value pairs)
  - All filter parameters are optional, allowing you to list all threads or filter as needed
  - Full pagination and sorting support

  **Example Usage**

  ```typescript
  // List all threads
  const allThreads = await memory.listThreads({});

  // Filter by resourceId only
  const userThreads = await memory.listThreads({
    filter: { resourceId: 'user-123' },
  });

  // Filter by metadata only
  const supportThreads = await memory.listThreads({
    filter: { metadata: { category: 'support' } },
  });

  // Filter by both with pagination
  const filteredThreads = await memory.listThreads({
    filter: {
      resourceId: 'user-123',
      metadata: { priority: 'high', status: 'open' },
    },
    orderBy: { field: 'updatedAt', direction: 'DESC' },
    page: 0,
    perPage: 20,
  });
  ```

  **Security Improvements**
  - Added validation to prevent SQL injection via malicious metadata keys
  - Added pagination parameter validation to prevent integer overflow attacks

- Aligned vector store configuration with underlying library APIs, giving you access to all library options directly. ([#11742](https://github.com/mastra-ai/mastra/pull/11742))

  **Why this change?**

  Previously, each vector store defined its own configuration types that only exposed a subset of the underlying library's options. This meant users couldn't access advanced features like authentication, SSL, compression, or custom headers without creating their own client instances. Now, the configuration types extend the library types directly, so all options are available.

  **@mastra/libsql** (Breaking)

  Renamed `connectionUrl` to `url` to match the `@libsql/client` API and align with LibSQLStorage.

  ```typescript
  // Before
  new LibSQLVector({ id: 'my-vector', connectionUrl: 'file:./db.sqlite' });

  // After
  new LibSQLVector({ id: 'my-vector', url: 'file:./db.sqlite' });
  ```

  **@mastra/opensearch** (Breaking)

  Renamed `url` to `node` and added support for all OpenSearch `ClientOptions` including authentication, SSL, and compression.

  ```typescript
  // Before
  new OpenSearchVector({ id: 'my-vector', url: 'http://localhost:9200' });

  // After
  new OpenSearchVector({ id: 'my-vector', node: 'http://localhost:9200' });

  // With authentication (now possible)
  new OpenSearchVector({
    id: 'my-vector',
    node: 'https://localhost:9200',
    auth: { username: 'admin', password: 'admin' },
    ssl: { rejectUnauthorized: false },
  });
  ```

  **@mastra/pinecone** (Breaking)

  Removed `environment` parameter. Use `controllerHostUrl` instead (the actual Pinecone SDK field name). Added support for all `PineconeConfiguration` options.

  ```typescript
  // Before
  new PineconeVector({ id: 'my-vector', apiKey: '...', environment: '...' });

  // After
  new PineconeVector({ id: 'my-vector', apiKey: '...' });

  // With custom controller host (if needed)
  new PineconeVector({ id: 'my-vector', apiKey: '...', controllerHostUrl: '...' });
  ```

  **@mastra/clickhouse**

  Added support for all `ClickHouseClientConfigOptions` like `request_timeout`, `compression`, `keep_alive`, and `database`. Existing configurations continue to work unchanged.

  **@mastra/cloudflare, @mastra/cloudflare-d1, @mastra/lance, @mastra/libsql, @mastra/mongodb, @mastra/pg, @mastra/upstash**

  Improved logging by replacing `console.warn` with structured logger in workflow storage domains.

  **@mastra/deployer-cloud**

  Updated internal LibSQLVector configuration for compatibility with the new API.

- Add restart method to workflow run that allows restarting an active workflow run ([#9750](https://github.com/mastra-ai/mastra/pull/9750))
  Add status filter to `listWorkflowRuns`
  Add automatic restart to restart active workflow runs when server starts

- Renamed MastraStorage to MastraCompositeStore for better clarity. The old MastraStorage name remains available as a deprecated alias for backward compatibility, but will be removed in a future version. ([#12093](https://github.com/mastra-ai/mastra/pull/12093))

  **Migration:**

  Update your imports and usage:

  ```typescript
  // Before
  import { MastraStorage } from '@mastra/core/storage';

  const storage = new MastraStorage({
    id: 'composite',
    domains: { ... }
  });

  // After
  import { MastraCompositeStore } from '@mastra/core/storage';

  const storage = new MastraCompositeStore({
    id: 'composite',
    domains: { ... }
  });
  ```

  The new name better reflects that this is a composite storage implementation that routes different domains (workflows, traces, messages) to different underlying stores, avoiding confusion with the general "Mastra Storage" concept.

- Adds MongoDB Observability support, and MongoDB Storage documentation, examples, and telemetry. ([#8426](https://github.com/mastra-ai/mastra/pull/8426))

- Added pre-configured client support for all storage adapters. ([#11302](https://github.com/mastra-ai/mastra/pull/11302))

  **What changed**

  All storage adapters now accept pre-configured database clients in addition to connection credentials. This allows you to customize client settings (connection pools, timeouts, interceptors) before passing them to Mastra.

  **Example**

  ```typescript
  import { createClient } from '@clickhouse/client';
  import { ClickhouseStore } from '@mastra/clickhouse';

  // Create and configure client with custom settings
  const client = createClient({
    url: 'http://localhost:8123',
    username: 'default',
    password: '',
    request_timeout: 60000,
  });

  // Pass pre-configured client to store
  const store = new ClickhouseStore({
    id: 'my-store',
    client,
  });
  ```

  **Additional improvements**
  - Added input validation for required connection parameters (URL, credentials) with clear error messages

- Add index configuration options to storage stores ([#11311](https://github.com/mastra-ai/mastra/pull/11311))

  Storage stores now support two new configuration options for index management:
  - `skipDefaultIndexes`: When `true`, default performance indexes are not created during `init()`. Useful for custom index strategies or reducing initialization time.
  - `indexes`: Array of custom index definitions to create during `init()`. Indexes are routed to the appropriate domain based on table/collection name.

  ```typescript
  // Skip default indexes and use custom ones
  const store = new PostgresStore({
    connectionString: '...',
    skipDefaultIndexes: true,
    indexes: [{ name: 'threads_type_idx', table: 'mastra_threads', columns: ["metadata->>'type'"] }],
  });

  // MongoDB equivalent
  const mongoStore = new MongoDBStore({
    url: 'mongodb://...',
    skipDefaultIndexes: true,
    indexes: [{ collection: 'mastra_threads', keys: { 'metadata.type': 1 }, options: { name: 'threads_type_idx' } }],
  });
  ```

  Domain classes (e.g., `MemoryPG`, `MemoryStorageMongoDB`) also accept these options for standalone usage.

- Updated dependencies [[`ac0d2f4`](https://github.com/mastra-ai/mastra/commit/ac0d2f4ff8831f72c1c66c2be809706d17f65789), [`2319326`](https://github.com/mastra-ai/mastra/commit/2319326f8c64e503a09bbcf14be2dd65405445e0), [`d2d3e22`](https://github.com/mastra-ai/mastra/commit/d2d3e22a419ee243f8812a84e3453dd44365ecb0), [`08766f1`](https://github.com/mastra-ai/mastra/commit/08766f15e13ac0692fde2a8bd366c2e16e4321df), [`72df8ae`](https://github.com/mastra-ai/mastra/commit/72df8ae595584cdd7747d5c39ffaca45e4507227), [`ebae12a`](https://github.com/mastra-ai/mastra/commit/ebae12a2dd0212e75478981053b148a2c246962d), [`c8417b4`](https://github.com/mastra-ai/mastra/commit/c8417b41d9f3486854dc7842d977fbe5e2166264), [`bc72b52`](https://github.com/mastra-ai/mastra/commit/bc72b529ee4478fe89ecd85a8be47ce0127b82a0), [`39c9743`](https://github.com/mastra-ai/mastra/commit/39c97432d084294f8ba85fbf3ef28098ff21459e), [`1dbd8c7`](https://github.com/mastra-ai/mastra/commit/1dbd8c729fb6536ec52f00064d76b80253d346e9), [`c61a0a5`](https://github.com/mastra-ai/mastra/commit/c61a0a5de4904c88fd8b3718bc26d1be1c2ec6e7), [`05b8bee`](https://github.com/mastra-ai/mastra/commit/05b8bee9e50e6c2a4a2bf210eca25ee212ca24fa), [`3076c67`](https://github.com/mastra-ai/mastra/commit/3076c6778b18988ae7d5c4c5c466366974b2d63f), [`3d93a15`](https://github.com/mastra-ai/mastra/commit/3d93a15796b158c617461c8b98bede476ebb43e2), [`9198899`](https://github.com/mastra-ai/mastra/commit/91988995c427b185c33714b7f3be955367911324), [`ed3e3dd`](https://github.com/mastra-ai/mastra/commit/ed3e3ddec69d564fe2b125e083437f76331f1283), [`c59e13c`](https://github.com/mastra-ai/mastra/commit/c59e13c7688284bd96b2baee3e314335003548de), [`c042bd0`](https://github.com/mastra-ai/mastra/commit/c042bd0b743e0e86199d0cb83344ca7690e34a9c), [`f743dbb`](https://github.com/mastra-ai/mastra/commit/f743dbb8b40d1627b5c10c0e6fc154f4ebb6e394), [`21a15de`](https://github.com/mastra-ai/mastra/commit/21a15de369fe82aac26bb642ed7be73505475e8b), [`e54953e`](https://github.com/mastra-ai/mastra/commit/e54953ed8ce1b28c0d62a19950163039af7834b4), [`ae8baf7`](https://github.com/mastra-ai/mastra/commit/ae8baf7d8adcb0ff9dac11880400452bc49b33ff), [`fec5129`](https://github.com/mastra-ai/mastra/commit/fec5129de7fc64423ea03661a56cef31dc747a0d), [`940a2b2`](https://github.com/mastra-ai/mastra/commit/940a2b27480626ed7e74f55806dcd2181c1dd0c2), [`1a0d3fc`](https://github.com/mastra-ai/mastra/commit/1a0d3fc811482c9c376cdf79ee615c23bae9b2d6), [`85d7ee1`](https://github.com/mastra-ai/mastra/commit/85d7ee18ff4e14d625a8a30ec6656bb49804989b), [`c6c1092`](https://github.com/mastra-ai/mastra/commit/c6c1092f8fbf76109303f69e000e96fd1960c4ce), [`0491e7c`](https://github.com/mastra-ai/mastra/commit/0491e7c9b714cb0ba22187ee062147ec2dd7c712), [`f6f4903`](https://github.com/mastra-ai/mastra/commit/f6f4903397314f73362061dc5a3e8e7c61ea34aa), [`d5ed981`](https://github.com/mastra-ai/mastra/commit/d5ed981c8701c1b8a27a5f35a9a2f7d9244e695f), [`85a628b`](https://github.com/mastra-ai/mastra/commit/85a628b1224a8f64cd82ea7f033774bf22df7a7e), [`0e8ed46`](https://github.com/mastra-ai/mastra/commit/0e8ed467c54d6901a6a365f270ec15d6faadb36c), [`33a4d2e`](https://github.com/mastra-ai/mastra/commit/33a4d2e4ed8af51f69256232f00c34d6b6b51d48), [`9650cce`](https://github.com/mastra-ai/mastra/commit/9650cce52a1d917ff9114653398e2a0f5c3ba808), [`6c049d9`](https://github.com/mastra-ai/mastra/commit/6c049d94063fdcbd5b81c4912a2bf82a92c9cc0b), [`910db9e`](https://github.com/mastra-ai/mastra/commit/910db9e0312888495eb5617b567f247d03303814), [`2f897df`](https://github.com/mastra-ai/mastra/commit/2f897df208508f46f51b7625e5dd20c37f93e0e3), [`d629361`](https://github.com/mastra-ai/mastra/commit/d629361a60f6565b5bfb11976fdaf7308af858e2), [`4f94ed8`](https://github.com/mastra-ai/mastra/commit/4f94ed8177abfde3ec536e3574883e075423350c), [`feb7ee4`](https://github.com/mastra-ai/mastra/commit/feb7ee4d09a75edb46c6669a3beaceec78811747), [`4aaa844`](https://github.com/mastra-ai/mastra/commit/4aaa844a4f19d054490f43638a990cc57bda8d2f), [`c237233`](https://github.com/mastra-ai/mastra/commit/c23723399ccedf7f5744b3f40997b79246bfbe64), [`38380b6`](https://github.com/mastra-ai/mastra/commit/38380b60fca905824bdf6b43df307a58efb1aa15), [`6833c69`](https://github.com/mastra-ai/mastra/commit/6833c69607418d257750bbcdd84638993d343539), [`932d63d`](https://github.com/mastra-ai/mastra/commit/932d63dd51be9c8bf1e00e3671fe65606c6fb9cd), [`4a1a6cb`](https://github.com/mastra-ai/mastra/commit/4a1a6cb3facad54b2bb6780b00ce91d6de1edc08), [`08c31c1`](https://github.com/mastra-ai/mastra/commit/08c31c188ebccd598acaf55e888b6397d01f7eae), [`919a22b`](https://github.com/mastra-ai/mastra/commit/919a22b25876f9ed5891efe5facbe682c30ff497), [`15f9e21`](https://github.com/mastra-ai/mastra/commit/15f9e216177201ea6e3f6d0bfb063fcc0953444f), [`3443770`](https://github.com/mastra-ai/mastra/commit/3443770662df8eb24c9df3589b2792d78cfcb811), [`69136e7`](https://github.com/mastra-ai/mastra/commit/69136e748e32f57297728a4e0f9a75988462f1a7), [`b0e2ea5`](https://github.com/mastra-ai/mastra/commit/b0e2ea5b52c40fae438b9e2f7baee6f0f89c5442), [`f0a07e0`](https://github.com/mastra-ai/mastra/commit/f0a07e0111b3307c5fabfa4094c5c2cfb734fbe6), [`ff94dea`](https://github.com/mastra-ai/mastra/commit/ff94dea935f4e34545c63bcb6c29804732698809), [`0d41fe2`](https://github.com/mastra-ai/mastra/commit/0d41fe245355dfc66d61a0d9c85d9400aac351ff), [`b760b73`](https://github.com/mastra-ai/mastra/commit/b760b731aca7c8a3f041f61d57a7f125ae9cb215), [`aaa40e7`](https://github.com/mastra-ai/mastra/commit/aaa40e788628b319baa8e889407d11ad626547fa), [`1521d71`](https://github.com/mastra-ai/mastra/commit/1521d716e5daedc74690c983fbd961123c56756b), [`449aed2`](https://github.com/mastra-ai/mastra/commit/449aed2ba9d507b75bf93d427646ea94f734dfd1), [`eb648a2`](https://github.com/mastra-ai/mastra/commit/eb648a2cc1728f7678768dd70cd77619b448dab9), [`695a621`](https://github.com/mastra-ai/mastra/commit/695a621528bdabeb87f83c2277cf2bb084c7f2b4), [`9e1911d`](https://github.com/mastra-ai/mastra/commit/9e1911db2b4db85e0e768c3f15e0d61e319869f6), [`ac3cc23`](https://github.com/mastra-ai/mastra/commit/ac3cc2397d1966bc0fc2736a223abc449d3c7719), [`c456e01`](https://github.com/mastra-ai/mastra/commit/c456e0149e3c176afcefdbd9bb1d2c5917723725), [`ebac155`](https://github.com/mastra-ai/mastra/commit/ebac15564a590117db7078233f927a7e28a85106), [`a86f4df`](https://github.com/mastra-ai/mastra/commit/a86f4df0407311e0d2ea49b9a541f0938810d6a9), [`dd1c38d`](https://github.com/mastra-ai/mastra/commit/dd1c38d1b75f1b695c27b40d8d9d6ed00d5e0f6f), [`5948e6a`](https://github.com/mastra-ai/mastra/commit/5948e6a5146c83666ba3f294b2be576c82a513fb), [`5b2ff46`](https://github.com/mastra-ai/mastra/commit/5b2ff4651df70c146523a7fca773f8eb0a2272f8), [`edb07e4`](https://github.com/mastra-ai/mastra/commit/edb07e49283e0c28bd094a60e03439bf6ecf0221), [`e0941c3`](https://github.com/mastra-ai/mastra/commit/e0941c3d7fc75695d5d258e7008fd5d6e650800c), [`db41688`](https://github.com/mastra-ai/mastra/commit/db4168806d007417e2e60b4f68656dca4e5f40c9), [`2b459f4`](https://github.com/mastra-ai/mastra/commit/2b459f466fd91688eeb2a44801dc23f7f8a887ab), [`798d0c7`](https://github.com/mastra-ai/mastra/commit/798d0c740232653b1d754870e6b43a55c364ffe2), [`0c0580a`](https://github.com/mastra-ai/mastra/commit/0c0580a42f697cd2a7d5973f25bfe7da9055038a), [`8940859`](https://github.com/mastra-ai/mastra/commit/89408593658199b4ad67f7b65e888f344e64a442), [`486352b`](https://github.com/mastra-ai/mastra/commit/486352b66c746602b68a95839f830de14c7fb8c0), [`ab035c2`](https://github.com/mastra-ai/mastra/commit/ab035c2ef6d8cc7bb25f06f1a38508bd9e6f126b), [`e629310`](https://github.com/mastra-ai/mastra/commit/e629310f1a73fa236d49ec7a1d1cceb6229dc7cc), [`0131105`](https://github.com/mastra-ai/mastra/commit/0131105532e83bdcbb73352fc7d0879eebf140dc), [`5ca599d`](https://github.com/mastra-ai/mastra/commit/5ca599d0bb59a1595f19f58473fcd67cc71cef58), [`09e4bae`](https://github.com/mastra-ai/mastra/commit/09e4bae18dd5357d2ae078a4a95a2af32168ab08), [`47b1c16`](https://github.com/mastra-ai/mastra/commit/47b1c16a01c7ffb6765fe1e499b49092f8b7eba3), [`4c6b492`](https://github.com/mastra-ai/mastra/commit/4c6b492c4dd591c6a592520c1f6855d6e936d71f), [`bff1145`](https://github.com/mastra-ai/mastra/commit/bff114556b3cbadad9b2768488708f8ad0e91475), [`dff01d8`](https://github.com/mastra-ai/mastra/commit/dff01d81ce1f4e4087cfac20fa868e6db138dd14), [`9d5059e`](https://github.com/mastra-ai/mastra/commit/9d5059eae810829935fb08e81a9bb7ecd5b144a7), [`ffe84d5`](https://github.com/mastra-ai/mastra/commit/ffe84d54f3b0f85167fe977efd027dba027eb998), [`5c8ca24`](https://github.com/mastra-ai/mastra/commit/5c8ca247094e0cc2cdbd7137822fb47241f86e77), [`9d819d5`](https://github.com/mastra-ai/mastra/commit/9d819d54b61481639f4008e4694791bddf187edd), [`24b76d8`](https://github.com/mastra-ai/mastra/commit/24b76d8e17656269c8ed09a0c038adb9cc2ae95a), [`31d13d5`](https://github.com/mastra-ai/mastra/commit/31d13d5fdc2e2380e2e3ee3ec9fb29d2a00f265d), [`ef756c6`](https://github.com/mastra-ai/mastra/commit/ef756c65f82d16531c43f49a27290a416611e526), [`e191844`](https://github.com/mastra-ai/mastra/commit/e1918444ca3f80e82feef1dad506cd4ec6e2875f), [`243a823`](https://github.com/mastra-ai/mastra/commit/243a8239c5906f5c94e4f78b54676793f7510ae3), [`b00ccd3`](https://github.com/mastra-ai/mastra/commit/b00ccd325ebd5d9e37e34dd0a105caae67eb568f), [`28f5f89`](https://github.com/mastra-ai/mastra/commit/28f5f89705f2409921e3c45178796c0e0d0bbb64), [`22553f1`](https://github.com/mastra-ai/mastra/commit/22553f11c63ee5e966a9c034a349822249584691), [`4c62166`](https://github.com/mastra-ai/mastra/commit/4c621669f4a29b1f443eca3ba70b814afa286266), [`e601b27`](https://github.com/mastra-ai/mastra/commit/e601b272c70f3a5ecca610373aa6223012704892), [`7d56d92`](https://github.com/mastra-ai/mastra/commit/7d56d9213886e8353956d7d40df10045fd12b299), [`81dc110`](https://github.com/mastra-ai/mastra/commit/81dc11008d147cf5bdc8996ead1aa61dbdebb6fc), [`7bcbf10`](https://github.com/mastra-ai/mastra/commit/7bcbf10133516e03df964b941f9a34e9e4ab4177), [`029540c`](https://github.com/mastra-ai/mastra/commit/029540ca1e582fc2dd8d288ecd4a9b0f31a954ef), [`7237163`](https://github.com/mastra-ai/mastra/commit/72371635dbf96a87df4b073cc48fc655afbdce3d), [`2500740`](https://github.com/mastra-ai/mastra/commit/2500740ea23da067d6e50ec71c625ab3ce275e64), [`4353600`](https://github.com/mastra-ai/mastra/commit/43536005a65988a8eede236f69122e7f5a284ba2), [`653e65a`](https://github.com/mastra-ai/mastra/commit/653e65ae1f9502c2958a32f47a5a2df11e612a92), [`873ecbb`](https://github.com/mastra-ai/mastra/commit/873ecbb517586aa17d2f1e99283755b3ebb2863f), [`6986fb0`](https://github.com/mastra-ai/mastra/commit/6986fb064f5db6ecc24aa655e1d26529087b43b3), [`3d3366f`](https://github.com/mastra-ai/mastra/commit/3d3366f31683e7137d126a3a57174a222c5801fb), [`5a4953f`](https://github.com/mastra-ai/mastra/commit/5a4953f7d25bb15ca31ed16038092a39cb3f98b3), [`4f9bbe5`](https://github.com/mastra-ai/mastra/commit/4f9bbe5968f42c86f4930b8193de3c3c17e5bd36), [`efe406a`](https://github.com/mastra-ai/mastra/commit/efe406a1353c24993280ebc2ed61dd9f65b84b26), [`eb9e522`](https://github.com/mastra-ai/mastra/commit/eb9e522ce3070a405e5b949b7bf5609ca51d7fe2), [`fd3d338`](https://github.com/mastra-ai/mastra/commit/fd3d338a2c362174ed5b383f1f011ad9fb0302aa), [`20e6f19`](https://github.com/mastra-ai/mastra/commit/20e6f1971d51d3ff6dd7accad8aaaae826d540ed), [`053e979`](https://github.com/mastra-ai/mastra/commit/053e9793b28e970086b0507f7f3b76ea32c1e838), [`02e51fe`](https://github.com/mastra-ai/mastra/commit/02e51feddb3d4155cfbcc42624fd0d0970d032c0), [`71c8d6c`](https://github.com/mastra-ai/mastra/commit/71c8d6c161253207b2b9588bdadb7eed604f7253), [`7aedb74`](https://github.com/mastra-ai/mastra/commit/7aedb74883adf66af38e270e4068fd42e7a37036), [`3bdfa75`](https://github.com/mastra-ai/mastra/commit/3bdfa7507a91db66f176ba8221aa28dd546e464a), [`119e5c6`](https://github.com/mastra-ai/mastra/commit/119e5c65008f3e5cfca954eefc2eb85e3bf40da4), [`c6fd6fe`](https://github.com/mastra-ai/mastra/commit/c6fd6fedd09e9cf8004b03a80925f5e94826ad7e), [`8f02d80`](https://github.com/mastra-ai/mastra/commit/8f02d800777397e4b45d7f1ad041988a8b0c6630), [`fdac646`](https://github.com/mastra-ai/mastra/commit/fdac646033a0930a1a4e00d13aa64c40bb7f1e02), [`6179a9b`](https://github.com/mastra-ai/mastra/commit/6179a9ba36ffac326de3cc3c43cdc8028d37c251), [`8f3fa3a`](https://github.com/mastra-ai/mastra/commit/8f3fa3a652bb77da092f913ec51ae46e3a7e27dc), [`d07b568`](https://github.com/mastra-ai/mastra/commit/d07b5687819ea8cb1dffa776d0c1765faf4aa1ae), [`e770de9`](https://github.com/mastra-ai/mastra/commit/e770de941a287a49b1964d44db5a5763d19890a6), [`e26dc9c`](https://github.com/mastra-ai/mastra/commit/e26dc9c3ccfec54ae3dc3e2b2589f741f9ae60a6), [`55edf73`](https://github.com/mastra-ai/mastra/commit/55edf7302149d6c964fbb7908b43babfc2b52145), [`c30400a`](https://github.com/mastra-ai/mastra/commit/c30400a49b994b1b97256fe785eb6c906fc2b232), [`486352b`](https://github.com/mastra-ai/mastra/commit/486352b66c746602b68a95839f830de14c7fb8c0), [`00f4921`](https://github.com/mastra-ai/mastra/commit/00f4921dd2c91a1e5446799599ef7116a8214a1a), [`1a46a56`](https://github.com/mastra-ai/mastra/commit/1a46a566f45a3fcbadc1cf36bf86d351f264bfa3), [`ca8041c`](https://github.com/mastra-ai/mastra/commit/ca8041cce0379fda22ed293a565bcb5b6ddca68a), [`b5dc973`](https://github.com/mastra-ai/mastra/commit/b5dc9733a5158850298dfb103acb3babdba8a318), [`7051bf3`](https://github.com/mastra-ai/mastra/commit/7051bf38b3b122a069008f861f7bfc004a6d9f6e), [`a8f1494`](https://github.com/mastra-ai/mastra/commit/a8f1494f4bbdc2770bcf327d4c7d869e332183f1), [`52e2716`](https://github.com/mastra-ai/mastra/commit/52e2716b42df6eff443de72360ae83e86ec23993), [`d7aad50`](https://github.com/mastra-ai/mastra/commit/d7aad501ce61646b76b4b511e558ac4eea9884d0), [`4f0b3c6`](https://github.com/mastra-ai/mastra/commit/4f0b3c66f196c06448487f680ccbb614d281e2f7), [`27b4040`](https://github.com/mastra-ai/mastra/commit/27b4040bfa1a95d92546f420a02a626b1419a1d6), [`c61fac3`](https://github.com/mastra-ai/mastra/commit/c61fac3add96f0dcce0208c07415279e2537eb62), [`6f14f70`](https://github.com/mastra-ai/mastra/commit/6f14f706ccaaf81b69544b6c1b75ab66a41e5317), [`69e0a87`](https://github.com/mastra-ai/mastra/commit/69e0a878896a2da9494945d86e056a5f8f05b851), [`cd29ad2`](https://github.com/mastra-ai/mastra/commit/cd29ad23a255534e8191f249593849ed29160886), [`bdf4d8c`](https://github.com/mastra-ai/mastra/commit/bdf4d8cdc656d8a2c21d81834bfa3bfa70f56c16), [`854e3da`](https://github.com/mastra-ai/mastra/commit/854e3dad5daac17a91a20986399d3a51f54bf68b), [`ce18d38`](https://github.com/mastra-ai/mastra/commit/ce18d38678c65870350d123955014a8432075fd9), [`3cf540b`](https://github.com/mastra-ai/mastra/commit/3cf540b9fbfea8f4fc8d3a2319a4e6c0b0cbfd52), [`352a5d6`](https://github.com/mastra-ai/mastra/commit/352a5d625cfe09849b21e8f52a24c9f0366759d5), [`1c6ce51`](https://github.com/mastra-ai/mastra/commit/1c6ce51f875915ab57fd36873623013699a2a65d), [`74c4f22`](https://github.com/mastra-ai/mastra/commit/74c4f22ed4c71e72598eacc346ba95cdbc00294f), [`3a76a80`](https://github.com/mastra-ai/mastra/commit/3a76a80284cb71a0faa975abb3d4b2a9631e60cd), [`898a972`](https://github.com/mastra-ai/mastra/commit/898a9727d286c2510d6b702dfd367e6aaf5c6b0f), [`0793497`](https://github.com/mastra-ai/mastra/commit/079349753620c40246ffd673e3f9d7d9820beff3), [`09e4bae`](https://github.com/mastra-ai/mastra/commit/09e4bae18dd5357d2ae078a4a95a2af32168ab08), [`026b848`](https://github.com/mastra-ai/mastra/commit/026b8483fbf5b6d977be8f7e6aac8d15c75558ac), [`2c212e7`](https://github.com/mastra-ai/mastra/commit/2c212e704c90e2db83d4109e62c03f0f6ebd2667), [`a97003a`](https://github.com/mastra-ai/mastra/commit/a97003aa1cf2f4022a41912324a1e77263b326b8), [`f9a2509`](https://github.com/mastra-ai/mastra/commit/f9a25093ea72d210a5e52cfcb3bcc8b5e02dc25c), [`66741d1`](https://github.com/mastra-ai/mastra/commit/66741d1a99c4f42cf23a16109939e8348ac6852e), [`ccc141e`](https://github.com/mastra-ai/mastra/commit/ccc141ed27da0abc3a3fc28e9e5128152e8e37f4), [`27c0009`](https://github.com/mastra-ai/mastra/commit/27c0009777a6073d7631b0eb7b481d94e165b5ca), [`01f8878`](https://github.com/mastra-ai/mastra/commit/01f88783de25e4de048c1c8aace43e26373c6ea5), [`dee388d`](https://github.com/mastra-ai/mastra/commit/dee388dde02f2e63c53385ae69252a47ab6825cc), [`610a70b`](https://github.com/mastra-ai/mastra/commit/610a70bdad282079f0c630e0d7bb284578f20151), [`5df9cce`](https://github.com/mastra-ai/mastra/commit/5df9cce1a753438413f64c11eeef8f845745c2a8), [`b7e17d3`](https://github.com/mastra-ai/mastra/commit/b7e17d3f5390bb5a71efc112204413656fcdc18d), [`4c77209`](https://github.com/mastra-ai/mastra/commit/4c77209e6c11678808b365d545845918c40045c8), [`a854ede`](https://github.com/mastra-ai/mastra/commit/a854ede62bf5ac0945a624ac48913dd69c73aabf), [`fe3b897`](https://github.com/mastra-ai/mastra/commit/fe3b897c2ccbcd2b10e81b099438c7337feddf89), [`c576fc0`](https://github.com/mastra-ai/mastra/commit/c576fc0b100b2085afded91a37c97a0ea0ec09c7), [`3defc80`](https://github.com/mastra-ai/mastra/commit/3defc80cf2b88a1b7fc1cc4ddcb91e982a614609), [`00123ba`](https://github.com/mastra-ai/mastra/commit/00123ba96dc9e5cd0b110420ebdba56d8f237b25), [`16153fe`](https://github.com/mastra-ai/mastra/commit/16153fe7eb13c99401f48e6ca32707c965ee28b9), [`9f4a683`](https://github.com/mastra-ai/mastra/commit/9f4a6833e88b52574665c028fd5508ad5c2f6004), [`bc94344`](https://github.com/mastra-ai/mastra/commit/bc943444a1342d8a662151b7bce1df7dae32f59c), [`4ca4306`](https://github.com/mastra-ai/mastra/commit/4ca430614daa5fa04730205a302a43bf4accfe9f), [`cccf9c8`](https://github.com/mastra-ai/mastra/commit/cccf9c8b2d2dfc1a5e63919395b83d78c89682a0), [`74e504a`](https://github.com/mastra-ai/mastra/commit/74e504a3b584eafd2f198001c6a113bbec589fd3), [`29c4309`](https://github.com/mastra-ai/mastra/commit/29c4309f818b24304c041bcb4a8f19b5f13f6b62), [`16785ce`](https://github.com/mastra-ai/mastra/commit/16785ced928f6f22638f4488cf8a125d99211799), [`57d157f`](https://github.com/mastra-ai/mastra/commit/57d157f0b163a95c3e6c9eae31bdb11d1bfc64f9), [`61a5705`](https://github.com/mastra-ai/mastra/commit/61a570551278b6743e64243b3ce7d73de915ca8a), [`903f67d`](https://github.com/mastra-ai/mastra/commit/903f67d184504a273893818c02b961f5423a79ad), [`3f3fc30`](https://github.com/mastra-ai/mastra/commit/3f3fc3096f24c4a26cffeecfe73085928f72aa63), [`d827d08`](https://github.com/mastra-ai/mastra/commit/d827d0808ffe1f3553a84e975806cc989b9735dd), [`e33fdbd`](https://github.com/mastra-ai/mastra/commit/e33fdbd07b33920d81e823122331b0c0bee0bb59), [`4524734`](https://github.com/mastra-ai/mastra/commit/45247343e384717a7c8404296275c56201d6470f), [`7a010c5`](https://github.com/mastra-ai/mastra/commit/7a010c56b846a313a49ae42fccd3d8de2b9f292d), [`2a90c55`](https://github.com/mastra-ai/mastra/commit/2a90c55a86a9210697d5adaab5ee94584b079adc), [`2a53598`](https://github.com/mastra-ai/mastra/commit/2a53598c6d8cfeb904a7fc74e57e526d751c8fa6), [`81b6a8f`](https://github.com/mastra-ai/mastra/commit/81b6a8ff79f49a7549d15d66624ac1a0b8f5f971), [`8538a0d`](https://github.com/mastra-ai/mastra/commit/8538a0d232619bf55dad7ddc2a8b0ca77c679a87), [`d90ea65`](https://github.com/mastra-ai/mastra/commit/d90ea6536f7aa51c6545a4e9215b55858e98e16d), [`db70a48`](https://github.com/mastra-ai/mastra/commit/db70a48aeeeeb8e5f92007e8ede52c364ce15287), [`261473a`](https://github.com/mastra-ai/mastra/commit/261473ac637e633064a22076671e2e02b002214d), [`eb09742`](https://github.com/mastra-ai/mastra/commit/eb09742197f66c4c38154c3beec78313e69760b2), [`de8239b`](https://github.com/mastra-ai/mastra/commit/de8239bdcb1d8c0cfa06da21f1569912a66bbc8a), [`e4d366a`](https://github.com/mastra-ai/mastra/commit/e4d366aeb500371dd4210d6aa8361a4c21d87034), [`23c10a1`](https://github.com/mastra-ai/mastra/commit/23c10a1efdd9a693c405511ab2dc8a1236603162), [`b5e6cd7`](https://github.com/mastra-ai/mastra/commit/b5e6cd77fc8c8e64e0494c1d06cee3d84e795d1e), [`d171e55`](https://github.com/mastra-ai/mastra/commit/d171e559ead9f52ec728d424844c8f7b164c4510), [`f0fdc14`](https://github.com/mastra-ai/mastra/commit/f0fdc14ee233d619266b3d2bbdeea7d25cfc6d13), [`a4f010b`](https://github.com/mastra-ai/mastra/commit/a4f010b22e4355a5fdee70a1fe0f6e4a692cc29e), [`c7cd3c7`](https://github.com/mastra-ai/mastra/commit/c7cd3c7a187d7aaf79e2ca139de328bf609a14b4), [`db18bc9`](https://github.com/mastra-ai/mastra/commit/db18bc9c3825e2c1a0ad9a183cc9935f6691bfa1), [`96d35f6`](https://github.com/mastra-ai/mastra/commit/96d35f61376bc2b1bf148648a2c1985bd51bef55), [`68ec97d`](https://github.com/mastra-ai/mastra/commit/68ec97d4c07c6393fcf95c2481fc5d73da99f8c8), [`8dc7f55`](https://github.com/mastra-ai/mastra/commit/8dc7f55900395771da851dc7d78d53ae84fe34ec), [`cfabdd4`](https://github.com/mastra-ai/mastra/commit/cfabdd4aae7a726b706942d6836eeca110fb6267), [`9b37b56`](https://github.com/mastra-ai/mastra/commit/9b37b565e1f2a76c24f728945cc740c2b09be9da), [`01b20fe`](https://github.com/mastra-ai/mastra/commit/01b20fefb7c67c2b7d79417598ef4e60256d1225), [`dd4f34c`](https://github.com/mastra-ai/mastra/commit/dd4f34c78cbae24063463475b0619575c415f9b8), [`8379099`](https://github.com/mastra-ai/mastra/commit/8379099fc467af6bef54dd7f80c9bd75bf8bbddf), [`0dbf199`](https://github.com/mastra-ai/mastra/commit/0dbf199110f22192ce5c95b1c8148d4872b4d119), [`5cbe88a`](https://github.com/mastra-ai/mastra/commit/5cbe88aefbd9f933bca669fd371ea36bf939ac6d), [`41a23c3`](https://github.com/mastra-ai/mastra/commit/41a23c32f9877d71810f37e24930515df2ff7a0f), [`a1bd7b8`](https://github.com/mastra-ai/mastra/commit/a1bd7b8571db16b94eb01588f451a74758c96d65), [`d78b38d`](https://github.com/mastra-ai/mastra/commit/d78b38d898fce285260d3bbb4befade54331617f), [`a0a5b4b`](https://github.com/mastra-ai/mastra/commit/a0a5b4bbebe6c701ebbadf744873aa0d5ca01371), [`ce0a73a`](https://github.com/mastra-ai/mastra/commit/ce0a73abeaa75b10ca38f9e40a255a645d50ebfb), [`5d171ad`](https://github.com/mastra-ai/mastra/commit/5d171ad9ef340387276b77c2bb3e83e83332d729), [`0633100`](https://github.com/mastra-ai/mastra/commit/0633100a911ad22f5256471bdf753da21c104742), [`3759cb0`](https://github.com/mastra-ai/mastra/commit/3759cb064935b5f74c65ac2f52a1145f7352899d), [`929f69c`](https://github.com/mastra-ai/mastra/commit/929f69c3436fa20dd0f0e2f7ebe8270bd82a1529), [`c710c16`](https://github.com/mastra-ai/mastra/commit/c710c1652dccfdc4111c8412bca7a6bb1d48b441), [`10c2735`](https://github.com/mastra-ai/mastra/commit/10c27355edfdad1ee2b826b897df74125eb81fb8), [`354ad0b`](https://github.com/mastra-ai/mastra/commit/354ad0b7b1b8183ac567f236a884fc7ede6d7138), [`cfae733`](https://github.com/mastra-ai/mastra/commit/cfae73394f4920635e6c919c8e95ff9a0788e2e5), [`8c0ec25`](https://github.com/mastra-ai/mastra/commit/8c0ec25646c8a7df253ed1e5ff4863a0d3f1316c), [`e3dfda7`](https://github.com/mastra-ai/mastra/commit/e3dfda7b11bf3b8c4bb55637028befb5f387fc74), [`69ea758`](https://github.com/mastra-ai/mastra/commit/69ea758358edd7117f191c2e69c8bb5fc79e7a1a), [`73b0bb3`](https://github.com/mastra-ai/mastra/commit/73b0bb394dba7c9482eb467a97ab283dbc0ef4db), [`651e772`](https://github.com/mastra-ai/mastra/commit/651e772eb1475fb13e126d3fcc01751297a88214), [`a02e542`](https://github.com/mastra-ai/mastra/commit/a02e542d23179bad250b044b17ff023caa61739f), [`f03ae60`](https://github.com/mastra-ai/mastra/commit/f03ae60500fe350c9d828621006cdafe1975fdd8), [`6b3ba91`](https://github.com/mastra-ai/mastra/commit/6b3ba91494cc10394df96782f349a4f7b1e152cc), [`a372c64`](https://github.com/mastra-ai/mastra/commit/a372c640ad1fd12e8f0613cebdc682fc156b4d95), [`993ad98`](https://github.com/mastra-ai/mastra/commit/993ad98d7ad3bebda9ecef5fec5c94349a0d04bc), [`676ccc7`](https://github.com/mastra-ai/mastra/commit/676ccc7fe92468d2d45d39c31a87825c89fd1ea0), [`3ff2c17`](https://github.com/mastra-ai/mastra/commit/3ff2c17a58e312fad5ea37377262c12d92ca0908), [`a0e437f`](https://github.com/mastra-ai/mastra/commit/a0e437fac561b28ee719e0302d72b2f9b4c138f0), [`d1e74a0`](https://github.com/mastra-ai/mastra/commit/d1e74a0a293866dece31022047f5dbab65a304d0), [`844ea5d`](https://github.com/mastra-ai/mastra/commit/844ea5dc0c248961e7bf73629ae7dcff503e853c), [`5627a8c`](https://github.com/mastra-ai/mastra/commit/5627a8c6dc11fe3711b3fa7a6ffd6eb34100a306), [`398fde3`](https://github.com/mastra-ai/mastra/commit/398fde3f39e707cda79372cdae8f9870e3b57c8d), [`c10398d`](https://github.com/mastra-ai/mastra/commit/c10398d5b88f1d4af556f4267ff06f1d11e89179), [`3ff45d1`](https://github.com/mastra-ai/mastra/commit/3ff45d10e0c80c5335a957ab563da72feb623520), [`f0f8f12`](https://github.com/mastra-ai/mastra/commit/f0f8f125c308f2d0fd36942ef652fd852df7522f), [`b61b93f`](https://github.com/mastra-ai/mastra/commit/b61b93f9e058b11dd2eec169853175d31dbdd567), [`bae33d9`](https://github.com/mastra-ai/mastra/commit/bae33d91a63fbb64d1e80519e1fc1acaed1e9013), [`39e7869`](https://github.com/mastra-ai/mastra/commit/39e7869bc7d0ee391077ce291474d8a84eedccff), [`0d7618b`](https://github.com/mastra-ai/mastra/commit/0d7618bc650bf2800934b243eca5648f4aeed9c2), [`7b763e5`](https://github.com/mastra-ai/mastra/commit/7b763e52fc3eaf699c2a99f2adf418dd46e4e9a5), [`251df45`](https://github.com/mastra-ai/mastra/commit/251df4531407dfa46d805feb40ff3fb49769f455), [`d36cfbb`](https://github.com/mastra-ai/mastra/commit/d36cfbbb6565ba5f827883cc9bb648eb14befdc1), [`f894d14`](https://github.com/mastra-ai/mastra/commit/f894d148946629af7b1f452d65a9cf864cec3765), [`8846867`](https://github.com/mastra-ai/mastra/commit/8846867ffa9a3746767618e314bebac08eb77d87), [`1924cf0`](https://github.com/mastra-ai/mastra/commit/1924cf06816e5e4d4d5333065ec0f4bb02a97799), [`c0b731f`](https://github.com/mastra-ai/mastra/commit/c0b731fb27d712dc8582e846df5c0332a6a0c5ba), [`5761926`](https://github.com/mastra-ai/mastra/commit/57619260c4a2cdd598763abbacd90de594c6bc76), [`c2b9547`](https://github.com/mastra-ai/mastra/commit/c2b9547bf435f56339f23625a743b2147ab1c7a6), [`3697853`](https://github.com/mastra-ai/mastra/commit/3697853deeb72017d90e0f38a93c1e29221aeca0), [`c900fdd`](https://github.com/mastra-ai/mastra/commit/c900fdd504c41348efdffb205cfe80d48c38fa33), [`9312dcd`](https://github.com/mastra-ai/mastra/commit/9312dcd1c6f5b321929e7d382e763d95fdc030f5), [`b2e45ec`](https://github.com/mastra-ai/mastra/commit/b2e45eca727a8db01a81ba93f1a5219c7183c839), [`5d7000f`](https://github.com/mastra-ai/mastra/commit/5d7000f757cd65ea9dc5b05e662fd83dfd44e932), [`43ca8f2`](https://github.com/mastra-ai/mastra/commit/43ca8f2c7334851cc7b4d3d2f037d8784bfbdd5f), [`d6d49f7`](https://github.com/mastra-ai/mastra/commit/d6d49f7b8714fa19a52ff9c7cf7fb7e73751901e), [`00c2387`](https://github.com/mastra-ai/mastra/commit/00c2387f5f04a365316f851e58666ac43f8c4edf), [`a534e95`](https://github.com/mastra-ai/mastra/commit/a534e9591f83b3cc1ebff99c67edf4cda7bf81d3), [`9d0e7fe`](https://github.com/mastra-ai/mastra/commit/9d0e7feca8ed98de959f53476ee1456073673348), [`53d927c`](https://github.com/mastra-ai/mastra/commit/53d927cc6f03bff33655b7e2b788da445a08731d), [`ad6250d`](https://github.com/mastra-ai/mastra/commit/ad6250dbdaad927e29f74a27b83f6c468b50a705), [`580b592`](https://github.com/mastra-ai/mastra/commit/580b5927afc82fe460dfdf9a38a902511b6b7e7f), [`604a79f`](https://github.com/mastra-ai/mastra/commit/604a79fecf276e26a54a3fe01bb94e65315d2e0e), [`42a42cf`](https://github.com/mastra-ai/mastra/commit/42a42cf3132b9786feecbb8c13c583dce5b0e198), [`3f2faf2`](https://github.com/mastra-ai/mastra/commit/3f2faf2e2d685d6c053cc5af1bf9fedf267b2ce5), [`22f64bc`](https://github.com/mastra-ai/mastra/commit/22f64bc1d37149480b58bf2fefe35b79a1e3e7d5), [`ff4d9a6`](https://github.com/mastra-ai/mastra/commit/ff4d9a6704fc87b31a380a76ed22736fdedbba5a), [`50fd320`](https://github.com/mastra-ai/mastra/commit/50fd320003d0d93831c230ef531bef41f5ba7b3a), [`847c212`](https://github.com/mastra-ai/mastra/commit/847c212caba7df0d6f2fc756b494ac3c75c3720d), [`69821ef`](https://github.com/mastra-ai/mastra/commit/69821ef806482e2c44e2197ac0b050c3fe3a5285), [`3a73998`](https://github.com/mastra-ai/mastra/commit/3a73998fa4ebeb7f3dc9301afe78095fc63e7999), [`ffa553a`](https://github.com/mastra-ai/mastra/commit/ffa553a3edc1bd17d73669fba66d6b6f4ac10897), [`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc), [`58e3931`](https://github.com/mastra-ai/mastra/commit/58e3931af9baa5921688566210f00fb0c10479fa), [`ae08bf0`](https://github.com/mastra-ai/mastra/commit/ae08bf0ebc6a4e4da992b711c4a389c32ba84cf4), [`0bed332`](https://github.com/mastra-ai/mastra/commit/0bed332843f627202c6520eaf671771313cd20f3), [`887f0b4`](https://github.com/mastra-ai/mastra/commit/887f0b4746cdbd7cb7d6b17ac9f82aeb58037ea5), [`2562143`](https://github.com/mastra-ai/mastra/commit/256214336b4faa78646c9c1776612393790d8784), [`b7959e6`](https://github.com/mastra-ai/mastra/commit/b7959e6e25a46b480f9ea2217c4c6c588c423791), [`a7ce182`](https://github.com/mastra-ai/mastra/commit/a7ce1822a8785ce45d62dd5c911af465e144f7d7), [`bda6370`](https://github.com/mastra-ai/mastra/commit/bda637009360649aaf579919e7873e33553c273e), [`d7acd8e`](https://github.com/mastra-ai/mastra/commit/d7acd8e987b5d7eff4fd98b0906c17c06a2e83d5), [`c7f1f7d`](https://github.com/mastra-ai/mastra/commit/c7f1f7d24f61f247f018cc2d1f33bf63212959a7), [`0bddc6d`](https://github.com/mastra-ai/mastra/commit/0bddc6d8dbd6f6008c0cba2e4960a2da75a55af1), [`bec5efd`](https://github.com/mastra-ai/mastra/commit/bec5efde96653ccae6604e68c696d1bc6c1a0bf5), [`5947fcd`](https://github.com/mastra-ai/mastra/commit/5947fcdd425531f29f9422026d466c2ee3113c93), [`4aa55b3`](https://github.com/mastra-ai/mastra/commit/4aa55b383cf06043943359ea316572fd969861a7), [`21735a7`](https://github.com/mastra-ai/mastra/commit/21735a7ef306963554a69a89b44f06c3bcd85141), [`735d8c1`](https://github.com/mastra-ai/mastra/commit/735d8c1c0d19fbc09e6f8b66cf41bc7655993838), [`7907fd1`](https://github.com/mastra-ai/mastra/commit/7907fd1c5059813b7b870b81ca71041dc807331b), [`1ed5716`](https://github.com/mastra-ai/mastra/commit/1ed5716830867b3774c4a1b43cc0d82935f32b96), [`acf322e`](https://github.com/mastra-ai/mastra/commit/acf322e0f1fd0189684cf529d91c694bea918a45), [`2ca67cc`](https://github.com/mastra-ai/mastra/commit/2ca67cc3bb1f6a617353fdcab197d9efebe60d6f), [`9eedf7d`](https://github.com/mastra-ai/mastra/commit/9eedf7de1d6e0022a2f4e5e9e6fe1ec468f9b43c), [`b339816`](https://github.com/mastra-ai/mastra/commit/b339816df0984d0243d944ac2655d6ba5f809cde), [`e16d553`](https://github.com/mastra-ai/mastra/commit/e16d55338403c7553531cc568125c63d53653dff), [`6f941c4`](https://github.com/mastra-ai/mastra/commit/6f941c438ca5f578619788acc7608fc2e23bd176), [`4186bdd`](https://github.com/mastra-ai/mastra/commit/4186bdd00731305726fa06adba0b076a1d50b49f), [`08bb631`](https://github.com/mastra-ai/mastra/commit/08bb631ae2b14684b2678e3549d0b399a6f0561e), [`c942802`](https://github.com/mastra-ai/mastra/commit/c942802a477a925b01859a7b8688d4355715caaa), [`4f0331a`](https://github.com/mastra-ai/mastra/commit/4f0331a79bf6eb5ee598a5086e55de4b5a0ada03), [`a0c8c1b`](https://github.com/mastra-ai/mastra/commit/a0c8c1b87d4fee252aebda73e8637fbe01d761c9), [`1d877b8`](https://github.com/mastra-ai/mastra/commit/1d877b8d7b536a251c1a7a18db7ddcf4f68d6f8b), [`cc34739`](https://github.com/mastra-ai/mastra/commit/cc34739c34b6266a91bea561119240a7acf47887), [`c218bd3`](https://github.com/mastra-ai/mastra/commit/c218bd3759e32423735b04843a09404572631014), [`9e67002`](https://github.com/mastra-ai/mastra/commit/9e67002b52c9be19936c420a489dbee9c5fd6a78), [`7aaf973`](https://github.com/mastra-ai/mastra/commit/7aaf973f83fbbe9521f1f9e7a4fd99b8de464617), [`2c4438b`](https://github.com/mastra-ai/mastra/commit/2c4438b87817ab7eed818c7990fef010475af1a3), [`35edc49`](https://github.com/mastra-ai/mastra/commit/35edc49ac0556db609189641d6341e76771b81fc), [`4d59f58`](https://github.com/mastra-ai/mastra/commit/4d59f58de2d90d6e2810a19d4518e38ddddb9038), [`ef11a61`](https://github.com/mastra-ai/mastra/commit/ef11a61920fa0ed08a5b7ceedd192875af119749), [`2b8893c`](https://github.com/mastra-ai/mastra/commit/2b8893cb108ef9acb72ee7835cd625610d2c1a4a), [`8e5c75b`](https://github.com/mastra-ai/mastra/commit/8e5c75bdb1d08a42d45309a4c72def4b6890230f), [`e1bb9c9`](https://github.com/mastra-ai/mastra/commit/e1bb9c94b4eb68b019ae275981be3feb769b5365), [`351a11f`](https://github.com/mastra-ai/mastra/commit/351a11fcaf2ed1008977fa9b9a489fc422e51cd4), [`8a73529`](https://github.com/mastra-ai/mastra/commit/8a73529ca01187f604b1f3019d0a725ac63ae55f), [`e59e0d3`](https://github.com/mastra-ai/mastra/commit/e59e0d32afb5fcf2c9f3c00c8f81f6c21d3a63fa), [`4fba91b`](https://github.com/mastra-ai/mastra/commit/4fba91bec7c95911dc28e369437596b152b04cd0), [`465ac05`](https://github.com/mastra-ai/mastra/commit/465ac0526a91d175542091c675181f1a96c98c46), [`fa8409b`](https://github.com/mastra-ai/mastra/commit/fa8409bc39cfd8ba6643b9db5269b90b22e2a2f7), [`8a000da`](https://github.com/mastra-ai/mastra/commit/8a000da0c09c679a2312f6b3aa05b2ca78ca7393), [`e7266a2`](https://github.com/mastra-ai/mastra/commit/e7266a278db02035c97a5e9cd9d1669a6b7a535d), [`173c535`](https://github.com/mastra-ai/mastra/commit/173c535c0645b0da404fe09f003778f0b0d4e019), [`12b0cc4`](https://github.com/mastra-ai/mastra/commit/12b0cc4077d886b1a552637dedb70a7ade93528c), [`3bf6c5f`](https://github.com/mastra-ai/mastra/commit/3bf6c5f104c25226cd84e0c77f9dec15f2cac2db)]:
  - @mastra/core@1.0.0

## 1.0.0-beta.14

### Patch Changes

- Fixed duplicate spans migration issue across all storage backends. When upgrading from older versions, existing duplicate (traceId, spanId) combinations in the spans table could prevent the unique constraint from being created. The migration deduplicates spans before adding the constraint. ([#12073](https://github.com/mastra-ai/mastra/pull/12073))

  **Deduplication rules (in priority order):**
  1. Keep completed spans (those with `endedAt` set) over incomplete spans
  2. Among spans with the same completion status, keep the one with the newest `updatedAt`
  3. Use `createdAt` as the final tiebreaker

  **What changed:**
  - Added `migrateSpans()` method to observability stores for manual migration
  - Added `checkSpansMigrationStatus()` method to check if migration is needed
  - All stores use optimized single-query deduplication to avoid memory issues on large tables

  **Usage example:**

  ```typescript
  const observability = await storage.getStore('observability');
  const status = await observability.checkSpansMigrationStatus();
  if (status.needsMigration) {
    const result = await observability.migrateSpans();
    console.log(`Migration complete: ${result.duplicatesRemoved} duplicates removed`);
  }
  ```

  Fixes #11840

- Renamed MastraStorage to MastraCompositeStore for better clarity. The old MastraStorage name remains available as a deprecated alias for backward compatibility, but will be removed in a future version. ([#12093](https://github.com/mastra-ai/mastra/pull/12093))

  **Migration:**

  Update your imports and usage:

  ```typescript
  // Before
  import { MastraStorage } from '@mastra/core/storage';

  const storage = new MastraStorage({
    id: 'composite',
    domains: { ... }
  });

  // After
  import { MastraCompositeStore } from '@mastra/core/storage';

  const storage = new MastraCompositeStore({
    id: 'composite',
    domains: { ... }
  });
  ```

  The new name better reflects that this is a composite storage implementation that routes different domains (workflows, traces, messages) to different underlying stores, avoiding confusion with the general "Mastra Storage" concept.

- Updated dependencies [[`026b848`](https://github.com/mastra-ai/mastra/commit/026b8483fbf5b6d977be8f7e6aac8d15c75558ac), [`ffa553a`](https://github.com/mastra-ai/mastra/commit/ffa553a3edc1bd17d73669fba66d6b6f4ac10897)]:
  - @mastra/core@1.0.0-beta.26

## 1.0.0-beta.13

### Patch Changes

- Added new `listThreads` method for flexible thread filtering across all storage adapters. ([#11832](https://github.com/mastra-ai/mastra/pull/11832))

  **New Features**
  - Filter threads by `resourceId`, `metadata`, or both (with AND logic for metadata key-value pairs)
  - All filter parameters are optional, allowing you to list all threads or filter as needed
  - Full pagination and sorting support

  **Example Usage**

  ```typescript
  // List all threads
  const allThreads = await memory.listThreads({});

  // Filter by resourceId only
  const userThreads = await memory.listThreads({
    filter: { resourceId: 'user-123' },
  });

  // Filter by metadata only
  const supportThreads = await memory.listThreads({
    filter: { metadata: { category: 'support' } },
  });

  // Filter by both with pagination
  const filteredThreads = await memory.listThreads({
    filter: {
      resourceId: 'user-123',
      metadata: { priority: 'high', status: 'open' },
    },
    orderBy: { field: 'updatedAt', direction: 'DESC' },
    page: 0,
    perPage: 20,
  });
  ```

  **Security Improvements**
  - Added validation to prevent SQL injection via malicious metadata keys
  - Added pagination parameter validation to prevent integer overflow attacks

- Updated dependencies [[`ed3e3dd`](https://github.com/mastra-ai/mastra/commit/ed3e3ddec69d564fe2b125e083437f76331f1283), [`6833c69`](https://github.com/mastra-ai/mastra/commit/6833c69607418d257750bbcdd84638993d343539), [`47b1c16`](https://github.com/mastra-ai/mastra/commit/47b1c16a01c7ffb6765fe1e499b49092f8b7eba3), [`3a76a80`](https://github.com/mastra-ai/mastra/commit/3a76a80284cb71a0faa975abb3d4b2a9631e60cd), [`8538a0d`](https://github.com/mastra-ai/mastra/commit/8538a0d232619bf55dad7ddc2a8b0ca77c679a87), [`9312dcd`](https://github.com/mastra-ai/mastra/commit/9312dcd1c6f5b321929e7d382e763d95fdc030f5)]:
  - @mastra/core@1.0.0-beta.25

## 1.0.0-beta.12

### Minor Changes

- Add configurable embeddingFieldPath option to MongoDBVector constructor. This allows users to specify custom paths for storing vector embeddings, including nested document paths using dot notation (e.g., text.contentEmbedding). Defaults to 'embedding' for backward compatibility. ([#11944](https://github.com/mastra-ai/mastra/pull/11944))

### Patch Changes

- Fix MongoDB scores storage sort logic to use numeric sort values (-1) instead of string values ('desc') for consistency with other MongoDB domains (agents, memory, observability, workflows). ([#11729](https://github.com/mastra-ai/mastra/pull/11729))

- Fix MongoDB connection string parameter naming inconsistency. MongoDBVector now uses uri parameter (correct MongoDB terminology). MongoDBStore now accepts both uri (recommended) and url (deprecated, for backward compatibility). Added clear error messages when connection string is missing. ([#11728](https://github.com/mastra-ai/mastra/pull/11728))

- Aligned vector store configuration with underlying library APIs, giving you access to all library options directly. ([#11742](https://github.com/mastra-ai/mastra/pull/11742))

  **Why this change?**

  Previously, each vector store defined its own configuration types that only exposed a subset of the underlying library's options. This meant users couldn't access advanced features like authentication, SSL, compression, or custom headers without creating their own client instances. Now, the configuration types extend the library types directly, so all options are available.

  **@mastra/libsql** (Breaking)

  Renamed `connectionUrl` to `url` to match the `@libsql/client` API and align with LibSQLStorage.

  ```typescript
  // Before
  new LibSQLVector({ id: 'my-vector', connectionUrl: 'file:./db.sqlite' });

  // After
  new LibSQLVector({ id: 'my-vector', url: 'file:./db.sqlite' });
  ```

  **@mastra/opensearch** (Breaking)

  Renamed `url` to `node` and added support for all OpenSearch `ClientOptions` including authentication, SSL, and compression.

  ```typescript
  // Before
  new OpenSearchVector({ id: 'my-vector', url: 'http://localhost:9200' });

  // After
  new OpenSearchVector({ id: 'my-vector', node: 'http://localhost:9200' });

  // With authentication (now possible)
  new OpenSearchVector({
    id: 'my-vector',
    node: 'https://localhost:9200',
    auth: { username: 'admin', password: 'admin' },
    ssl: { rejectUnauthorized: false },
  });
  ```

  **@mastra/pinecone** (Breaking)

  Removed `environment` parameter. Use `controllerHostUrl` instead (the actual Pinecone SDK field name). Added support for all `PineconeConfiguration` options.

  ```typescript
  // Before
  new PineconeVector({ id: 'my-vector', apiKey: '...', environment: '...' });

  // After
  new PineconeVector({ id: 'my-vector', apiKey: '...' });

  // With custom controller host (if needed)
  new PineconeVector({ id: 'my-vector', apiKey: '...', controllerHostUrl: '...' });
  ```

  **@mastra/clickhouse**

  Added support for all `ClickHouseClientConfigOptions` like `request_timeout`, `compression`, `keep_alive`, and `database`. Existing configurations continue to work unchanged.

  **@mastra/cloudflare, @mastra/cloudflare-d1, @mastra/lance, @mastra/libsql, @mastra/mongodb, @mastra/pg, @mastra/upstash**

  Improved logging by replacing `console.warn` with structured logger in workflow storage domains.

  **@mastra/deployer-cloud**

  Updated internal LibSQLVector configuration for compatibility with the new API.

- Updated dependencies [[`ebae12a`](https://github.com/mastra-ai/mastra/commit/ebae12a2dd0212e75478981053b148a2c246962d), [`c61a0a5`](https://github.com/mastra-ai/mastra/commit/c61a0a5de4904c88fd8b3718bc26d1be1c2ec6e7), [`69136e7`](https://github.com/mastra-ai/mastra/commit/69136e748e32f57297728a4e0f9a75988462f1a7), [`449aed2`](https://github.com/mastra-ai/mastra/commit/449aed2ba9d507b75bf93d427646ea94f734dfd1), [`eb648a2`](https://github.com/mastra-ai/mastra/commit/eb648a2cc1728f7678768dd70cd77619b448dab9), [`0131105`](https://github.com/mastra-ai/mastra/commit/0131105532e83bdcbb73352fc7d0879eebf140dc), [`9d5059e`](https://github.com/mastra-ai/mastra/commit/9d5059eae810829935fb08e81a9bb7ecd5b144a7), [`ef756c6`](https://github.com/mastra-ai/mastra/commit/ef756c65f82d16531c43f49a27290a416611e526), [`b00ccd3`](https://github.com/mastra-ai/mastra/commit/b00ccd325ebd5d9e37e34dd0a105caae67eb568f), [`3bdfa75`](https://github.com/mastra-ai/mastra/commit/3bdfa7507a91db66f176ba8221aa28dd546e464a), [`e770de9`](https://github.com/mastra-ai/mastra/commit/e770de941a287a49b1964d44db5a5763d19890a6), [`52e2716`](https://github.com/mastra-ai/mastra/commit/52e2716b42df6eff443de72360ae83e86ec23993), [`27b4040`](https://github.com/mastra-ai/mastra/commit/27b4040bfa1a95d92546f420a02a626b1419a1d6), [`610a70b`](https://github.com/mastra-ai/mastra/commit/610a70bdad282079f0c630e0d7bb284578f20151), [`8dc7f55`](https://github.com/mastra-ai/mastra/commit/8dc7f55900395771da851dc7d78d53ae84fe34ec), [`8379099`](https://github.com/mastra-ai/mastra/commit/8379099fc467af6bef54dd7f80c9bd75bf8bbddf), [`8c0ec25`](https://github.com/mastra-ai/mastra/commit/8c0ec25646c8a7df253ed1e5ff4863a0d3f1316c), [`ff4d9a6`](https://github.com/mastra-ai/mastra/commit/ff4d9a6704fc87b31a380a76ed22736fdedbba5a), [`69821ef`](https://github.com/mastra-ai/mastra/commit/69821ef806482e2c44e2197ac0b050c3fe3a5285), [`1ed5716`](https://github.com/mastra-ai/mastra/commit/1ed5716830867b3774c4a1b43cc0d82935f32b96), [`4186bdd`](https://github.com/mastra-ai/mastra/commit/4186bdd00731305726fa06adba0b076a1d50b49f), [`7aaf973`](https://github.com/mastra-ai/mastra/commit/7aaf973f83fbbe9521f1f9e7a4fd99b8de464617)]:
  - @mastra/core@1.0.0-beta.22

## 1.0.0-beta.11

### Patch Changes

- dependencies updates: ([#10114](https://github.com/mastra-ai/mastra/pull/10114))
  - Updated dependency [`uuid@^13.0.0` ↗︎](https://www.npmjs.com/package/uuid/v/13.0.0) (from `^11.1.0`, in `dependencies`)

- dependencies updates: ([#10196](https://github.com/mastra-ai/mastra/pull/10196))
  - Updated dependency [`mongodb@^7.0.0` ↗︎](https://www.npmjs.com/package/mongodb/v/7.0.0) (from `^6.17.0`, in `dependencies`)
- Updated dependencies [[`08766f1`](https://github.com/mastra-ai/mastra/commit/08766f15e13ac0692fde2a8bd366c2e16e4321df), [`ae8baf7`](https://github.com/mastra-ai/mastra/commit/ae8baf7d8adcb0ff9dac11880400452bc49b33ff), [`cfabdd4`](https://github.com/mastra-ai/mastra/commit/cfabdd4aae7a726b706942d6836eeca110fb6267), [`a0e437f`](https://github.com/mastra-ai/mastra/commit/a0e437fac561b28ee719e0302d72b2f9b4c138f0), [`bec5efd`](https://github.com/mastra-ai/mastra/commit/bec5efde96653ccae6604e68c696d1bc6c1a0bf5), [`9eedf7d`](https://github.com/mastra-ai/mastra/commit/9eedf7de1d6e0022a2f4e5e9e6fe1ec468f9b43c)]:
  - @mastra/core@1.0.0-beta.21

## 1.0.0-beta.10

### Patch Changes

- Add embedded documentation support for Mastra packages ([#11472](https://github.com/mastra-ai/mastra/pull/11472))

  Mastra packages now include embedded documentation in the published npm package under `dist/docs/`. This enables coding agents and AI assistants to understand and use the framework by reading documentation directly from `node_modules`.

  Each package includes:
  - **SKILL.md** - Entry point explaining the package's purpose and capabilities
  - **SOURCE_MAP.json** - Machine-readable index mapping exports to types and implementation files
  - **Topic folders** - Conceptual documentation organized by feature area

  Documentation is driven by the `packages` frontmatter field in MDX files, which maps docs to their corresponding packages. CI validation ensures all docs include this field.

- Added `startExclusive` and `endExclusive` options to `dateRange` filter for message queries. ([#11479](https://github.com/mastra-ai/mastra/pull/11479))

  **What changed:** The `filter.dateRange` parameter in `listMessages()` and `Memory.recall()` now supports `startExclusive` and `endExclusive` boolean options. When set to `true`, messages with timestamps exactly matching the boundary are excluded from results.

  **Why this matters:** Enables cursor-based pagination for chat applications. When new messages arrive during a session, offset-based pagination can skip or duplicate messages. Using `endExclusive: true` with the oldest message's timestamp as a cursor ensures consistent pagination without gaps or duplicates.

  **Example:**

  ```typescript
  // Get first page
  const page1 = await memory.recall({
    threadId: 'thread-123',
    perPage: 10,
    orderBy: { field: 'createdAt', direction: 'DESC' },
  });

  // Get next page using cursor-based pagination
  const oldestMessage = page1.messages[page1.messages.length - 1];
  const page2 = await memory.recall({
    threadId: 'thread-123',
    perPage: 10,
    orderBy: { field: 'createdAt', direction: 'DESC' },
    filter: {
      dateRange: {
        end: oldestMessage.createdAt,
        endExclusive: true, // Excludes the cursor message
      },
    },
  });
  ```

- Updated dependencies [[`d2d3e22`](https://github.com/mastra-ai/mastra/commit/d2d3e22a419ee243f8812a84e3453dd44365ecb0), [`bc72b52`](https://github.com/mastra-ai/mastra/commit/bc72b529ee4478fe89ecd85a8be47ce0127b82a0), [`05b8bee`](https://github.com/mastra-ai/mastra/commit/05b8bee9e50e6c2a4a2bf210eca25ee212ca24fa), [`c042bd0`](https://github.com/mastra-ai/mastra/commit/c042bd0b743e0e86199d0cb83344ca7690e34a9c), [`940a2b2`](https://github.com/mastra-ai/mastra/commit/940a2b27480626ed7e74f55806dcd2181c1dd0c2), [`e0941c3`](https://github.com/mastra-ai/mastra/commit/e0941c3d7fc75695d5d258e7008fd5d6e650800c), [`0c0580a`](https://github.com/mastra-ai/mastra/commit/0c0580a42f697cd2a7d5973f25bfe7da9055038a), [`28f5f89`](https://github.com/mastra-ai/mastra/commit/28f5f89705f2409921e3c45178796c0e0d0bbb64), [`e601b27`](https://github.com/mastra-ai/mastra/commit/e601b272c70f3a5ecca610373aa6223012704892), [`3d3366f`](https://github.com/mastra-ai/mastra/commit/3d3366f31683e7137d126a3a57174a222c5801fb), [`5a4953f`](https://github.com/mastra-ai/mastra/commit/5a4953f7d25bb15ca31ed16038092a39cb3f98b3), [`eb9e522`](https://github.com/mastra-ai/mastra/commit/eb9e522ce3070a405e5b949b7bf5609ca51d7fe2), [`20e6f19`](https://github.com/mastra-ai/mastra/commit/20e6f1971d51d3ff6dd7accad8aaaae826d540ed), [`4f0b3c6`](https://github.com/mastra-ai/mastra/commit/4f0b3c66f196c06448487f680ccbb614d281e2f7), [`74c4f22`](https://github.com/mastra-ai/mastra/commit/74c4f22ed4c71e72598eacc346ba95cdbc00294f), [`81b6a8f`](https://github.com/mastra-ai/mastra/commit/81b6a8ff79f49a7549d15d66624ac1a0b8f5f971), [`e4d366a`](https://github.com/mastra-ai/mastra/commit/e4d366aeb500371dd4210d6aa8361a4c21d87034), [`a4f010b`](https://github.com/mastra-ai/mastra/commit/a4f010b22e4355a5fdee70a1fe0f6e4a692cc29e), [`73b0bb3`](https://github.com/mastra-ai/mastra/commit/73b0bb394dba7c9482eb467a97ab283dbc0ef4db), [`5627a8c`](https://github.com/mastra-ai/mastra/commit/5627a8c6dc11fe3711b3fa7a6ffd6eb34100a306), [`3ff45d1`](https://github.com/mastra-ai/mastra/commit/3ff45d10e0c80c5335a957ab563da72feb623520), [`251df45`](https://github.com/mastra-ai/mastra/commit/251df4531407dfa46d805feb40ff3fb49769f455), [`f894d14`](https://github.com/mastra-ai/mastra/commit/f894d148946629af7b1f452d65a9cf864cec3765), [`c2b9547`](https://github.com/mastra-ai/mastra/commit/c2b9547bf435f56339f23625a743b2147ab1c7a6), [`580b592`](https://github.com/mastra-ai/mastra/commit/580b5927afc82fe460dfdf9a38a902511b6b7e7f), [`58e3931`](https://github.com/mastra-ai/mastra/commit/58e3931af9baa5921688566210f00fb0c10479fa), [`08bb631`](https://github.com/mastra-ai/mastra/commit/08bb631ae2b14684b2678e3549d0b399a6f0561e), [`4fba91b`](https://github.com/mastra-ai/mastra/commit/4fba91bec7c95911dc28e369437596b152b04cd0), [`12b0cc4`](https://github.com/mastra-ai/mastra/commit/12b0cc4077d886b1a552637dedb70a7ade93528c)]:
  - @mastra/core@1.0.0-beta.20

## 1.0.0-beta.9

### Patch Changes

- Add storage composition to MastraStorage ([#11401](https://github.com/mastra-ai/mastra/pull/11401))

  `MastraStorage` can now compose storage domains from different adapters. Use it when you need different databases for different purposes - for example, PostgreSQL for memory and workflows, but a different database for observability.

  ```typescript
  import { MastraStorage } from '@mastra/core/storage';
  import { MemoryPG, WorkflowsPG, ScoresPG } from '@mastra/pg';
  import { MemoryLibSQL } from '@mastra/libsql';

  // Compose domains from different stores
  const storage = new MastraStorage({
    id: 'composite',
    domains: {
      memory: new MemoryLibSQL({ url: 'file:./local.db' }),
      workflows: new WorkflowsPG({ connectionString: process.env.DATABASE_URL }),
      scores: new ScoresPG({ connectionString: process.env.DATABASE_URL }),
    },
  });
  ```

  **Breaking changes:**
  - `storage.supports` property no longer exists
  - `StorageSupports` type is no longer exported from `@mastra/core/storage`

  All stores now support the same features. For domain availability, use `getStore()`:

  ```typescript
  const store = await storage.getStore('memory');
  if (store) {
    // domain is available
  }
  ```

- Updated dependencies [[`3d93a15`](https://github.com/mastra-ai/mastra/commit/3d93a15796b158c617461c8b98bede476ebb43e2), [`efe406a`](https://github.com/mastra-ai/mastra/commit/efe406a1353c24993280ebc2ed61dd9f65b84b26), [`119e5c6`](https://github.com/mastra-ai/mastra/commit/119e5c65008f3e5cfca954eefc2eb85e3bf40da4), [`74e504a`](https://github.com/mastra-ai/mastra/commit/74e504a3b584eafd2f198001c6a113bbec589fd3), [`e33fdbd`](https://github.com/mastra-ai/mastra/commit/e33fdbd07b33920d81e823122331b0c0bee0bb59), [`929f69c`](https://github.com/mastra-ai/mastra/commit/929f69c3436fa20dd0f0e2f7ebe8270bd82a1529), [`8a73529`](https://github.com/mastra-ai/mastra/commit/8a73529ca01187f604b1f3019d0a725ac63ae55f)]:
  - @mastra/core@1.0.0-beta.16

## 1.0.0-beta.8

### Minor Changes

- Introduce StorageDomain base class for composite storage support ([#11249](https://github.com/mastra-ai/mastra/pull/11249))

  Storage adapters now use a domain-based architecture where each domain (memory, workflows, scores, observability, agents) extends a `StorageDomain` base class with `init()` and `dangerouslyClearAll()` methods.

  **Key changes:**
  - Add `StorageDomain` abstract base class that all domain storage classes extend
  - Add `InMemoryDB` class for shared state across in-memory domain implementations
  - All storage domains now implement `dangerouslyClearAll()` for test cleanup
  - Remove `operations` from public `StorageDomains` type (now internal to each adapter)
  - Add flexible client/config patterns - domains accept either an existing database client or config to create one internally

  **Why this matters:**

  This enables composite storage where you can use different database adapters per domain:

  ```typescript
  import { Mastra } from '@mastra/core';
  import { PostgresStore } from '@mastra/pg';
  import { ClickhouseStore } from '@mastra/clickhouse';

  // Use Postgres for most domains but Clickhouse for observability
  const mastra = new Mastra({
    storage: new PostgresStore({
      connectionString: 'postgres://...',
    }),
    // Future: override specific domains
    // observability: new ClickhouseStore({ ... }).getStore('observability'),
  });
  ```

  **Standalone domain usage:**

  Domains can now be used independently with flexible configuration:

  ```typescript
  import { MemoryLibSQL } from '@mastra/libsql/memory';

  // Option 1: Pass config to create client internally
  const memory = new MemoryLibSQL({
    url: 'file:./local.db',
  });

  // Option 2: Pass existing client for shared connections
  import { createClient } from '@libsql/client';
  const client = createClient({ url: 'file:./local.db' });
  const memory = new MemoryLibSQL({ client });
  ```

  **Breaking changes:**
  - `StorageDomains` type no longer includes `operations` - access via `getStore()` instead
  - Domain base classes now require implementing `dangerouslyClearAll()` method

- Refactor storage architecture to use domain-specific stores via `getStore()` pattern ([#11361](https://github.com/mastra-ai/mastra/pull/11361))

  ### Summary

  This release introduces a new storage architecture that replaces passthrough methods on `MastraStorage` with domain-specific storage interfaces accessed via `getStore()`. This change reduces code duplication across storage adapters and provides a cleaner, more modular API.

  ### Migration Guide

  All direct method calls on storage instances should be updated to use `getStore()`:

  ```typescript
  // Before
  const thread = await storage.getThreadById({ threadId });
  await storage.persistWorkflowSnapshot({ workflowName, runId, snapshot });
  await storage.createSpan(span);

  // After
  const memory = await storage.getStore('memory');
  const thread = await memory?.getThreadById({ threadId });

  const workflows = await storage.getStore('workflows');
  await workflows?.persistWorkflowSnapshot({ workflowName, runId, snapshot });

  const observability = await storage.getStore('observability');
  await observability?.createSpan(span);
  ```

  ### Available Domains
  - **`memory`**: Thread and message operations (`getThreadById`, `saveThread`, `saveMessages`, etc.)
  - **`workflows`**: Workflow state persistence (`persistWorkflowSnapshot`, `loadWorkflowSnapshot`, `getWorkflowRunById`, etc.)
  - **`scores`**: Evaluation scores (`saveScore`, `listScoresByScorerId`, etc.)
  - **`observability`**: Tracing and spans (`createSpan`, `updateSpan`, `getTrace`, etc.)
  - **`agents`**: Stored agent configurations (`createAgent`, `getAgentById`, `listAgents`, etc.)

  ### Breaking Changes
  - Passthrough methods have been removed from `MastraStorage` base class
  - All storage adapters now require accessing domains via `getStore()`
  - The `stores` property on storage instances is now the canonical way to access domain storage

  ### Internal Changes
  - Each storage adapter now initializes domain-specific stores in its constructor
  - Domain stores share database connections and handle their own table initialization

- Unified observability schema with entity-based span identification ([#11132](https://github.com/mastra-ai/mastra/pull/11132))

  ## What changed

  Spans now use a unified identification model with `entityId`, `entityType`, and `entityName` instead of separate `agentId`, `toolId`, `workflowId` fields.

  **Before:**

  ```typescript
  // Old span structure
  span.agentId; // 'my-agent'
  span.toolId; // undefined
  span.workflowId; // undefined
  ```

  **After:**

  ```typescript
  // New span structure
  span.entityType; // EntityType.AGENT
  span.entityId; // 'my-agent'
  span.entityName; // 'My Agent'
  ```

  ## New `listTraces()` API

  Query traces with filtering, pagination, and sorting:

  ```typescript
  const { spans, pagination } = await storage.listTraces({
    filters: {
      entityType: EntityType.AGENT,
      entityId: 'my-agent',
      userId: 'user-123',
      environment: 'production',
      status: TraceStatus.SUCCESS,
      startedAt: { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
    },
    pagination: { page: 0, perPage: 50 },
    orderBy: { field: 'startedAt', direction: 'DESC' },
  });
  ```

  **Available filters:** date ranges (`startedAt`, `endedAt`), entity (`entityType`, `entityId`, `entityName`), identity (`userId`, `organizationId`), correlation IDs (`runId`, `sessionId`, `threadId`), deployment (`environment`, `source`, `serviceName`), `tags`, `metadata`, and `status`.

  ## New retrieval methods
  - `getSpan({ traceId, spanId })` - Get a single span
  - `getRootSpan({ traceId })` - Get the root span of a trace
  - `getTrace({ traceId })` - Get all spans for a trace

  ## Backward compatibility

  The legacy `getTraces()` method continues to work. When you pass `name: "agent run: my-agent"`, it automatically transforms to `entityId: "my-agent", entityType: AGENT`.

  ## Migration

  **Automatic:** SQL-based stores (PostgreSQL, LibSQL, MSSQL) automatically add new columns to existing `spans` tables on initialization. Existing data is preserved with new columns set to `NULL`.

  **No action required:** Your existing code continues to work. Adopt the new fields and `listTraces()` API at your convenience.

### Patch Changes

- Added pre-configured client support for all storage adapters. ([#11302](https://github.com/mastra-ai/mastra/pull/11302))

  **What changed**

  All storage adapters now accept pre-configured database clients in addition to connection credentials. This allows you to customize client settings (connection pools, timeouts, interceptors) before passing them to Mastra.

  **Example**

  ```typescript
  import { createClient } from '@clickhouse/client';
  import { ClickhouseStore } from '@mastra/clickhouse';

  // Create and configure client with custom settings
  const client = createClient({
    url: 'http://localhost:8123',
    username: 'default',
    password: '',
    request_timeout: 60000,
  });

  // Pass pre-configured client to store
  const store = new ClickhouseStore({
    id: 'my-store',
    client,
  });
  ```

  **Additional improvements**
  - Added input validation for required connection parameters (URL, credentials) with clear error messages

- Add index configuration options to storage stores ([#11311](https://github.com/mastra-ai/mastra/pull/11311))

  Storage stores now support two new configuration options for index management:
  - `skipDefaultIndexes`: When `true`, default performance indexes are not created during `init()`. Useful for custom index strategies or reducing initialization time.
  - `indexes`: Array of custom index definitions to create during `init()`. Indexes are routed to the appropriate domain based on table/collection name.

  ```typescript
  // Skip default indexes and use custom ones
  const store = new PostgresStore({
    connectionString: '...',
    skipDefaultIndexes: true,
    indexes: [{ name: 'threads_type_idx', table: 'mastra_threads', columns: ["metadata->>'type'"] }],
  });

  // MongoDB equivalent
  const mongoStore = new MongoDBStore({
    url: 'mongodb://...',
    skipDefaultIndexes: true,
    indexes: [{ collection: 'mastra_threads', keys: { 'metadata.type': 1 }, options: { name: 'threads_type_idx' } }],
  });
  ```

  Domain classes (e.g., `MemoryPG`, `MemoryStorageMongoDB`) also accept these options for standalone usage.

- Updated dependencies [[`33a4d2e`](https://github.com/mastra-ai/mastra/commit/33a4d2e4ed8af51f69256232f00c34d6b6b51d48), [`4aaa844`](https://github.com/mastra-ai/mastra/commit/4aaa844a4f19d054490f43638a990cc57bda8d2f), [`4a1a6cb`](https://github.com/mastra-ai/mastra/commit/4a1a6cb3facad54b2bb6780b00ce91d6de1edc08), [`31d13d5`](https://github.com/mastra-ai/mastra/commit/31d13d5fdc2e2380e2e3ee3ec9fb29d2a00f265d), [`4c62166`](https://github.com/mastra-ai/mastra/commit/4c621669f4a29b1f443eca3ba70b814afa286266), [`7bcbf10`](https://github.com/mastra-ai/mastra/commit/7bcbf10133516e03df964b941f9a34e9e4ab4177), [`4353600`](https://github.com/mastra-ai/mastra/commit/43536005a65988a8eede236f69122e7f5a284ba2), [`6986fb0`](https://github.com/mastra-ai/mastra/commit/6986fb064f5db6ecc24aa655e1d26529087b43b3), [`053e979`](https://github.com/mastra-ai/mastra/commit/053e9793b28e970086b0507f7f3b76ea32c1e838), [`e26dc9c`](https://github.com/mastra-ai/mastra/commit/e26dc9c3ccfec54ae3dc3e2b2589f741f9ae60a6), [`55edf73`](https://github.com/mastra-ai/mastra/commit/55edf7302149d6c964fbb7908b43babfc2b52145), [`27c0009`](https://github.com/mastra-ai/mastra/commit/27c0009777a6073d7631b0eb7b481d94e165b5ca), [`dee388d`](https://github.com/mastra-ai/mastra/commit/dee388dde02f2e63c53385ae69252a47ab6825cc), [`3f3fc30`](https://github.com/mastra-ai/mastra/commit/3f3fc3096f24c4a26cffeecfe73085928f72aa63), [`d90ea65`](https://github.com/mastra-ai/mastra/commit/d90ea6536f7aa51c6545a4e9215b55858e98e16d), [`d171e55`](https://github.com/mastra-ai/mastra/commit/d171e559ead9f52ec728d424844c8f7b164c4510), [`10c2735`](https://github.com/mastra-ai/mastra/commit/10c27355edfdad1ee2b826b897df74125eb81fb8), [`1924cf0`](https://github.com/mastra-ai/mastra/commit/1924cf06816e5e4d4d5333065ec0f4bb02a97799), [`b339816`](https://github.com/mastra-ai/mastra/commit/b339816df0984d0243d944ac2655d6ba5f809cde)]:
  - @mastra/core@1.0.0-beta.15

## 1.0.0-beta.7

### Patch Changes

- Preserve error details when thrown from workflow steps ([#10992](https://github.com/mastra-ai/mastra/pull/10992))

  Workflow errors now retain custom properties like `statusCode`, `responseHeaders`, and `cause` chains. This enables error-specific recovery logic in your applications.

  **Before:**

  ```typescript
  const result = await workflow.execute({ input });
  if (result.status === 'failed') {
    // Custom error properties were lost
    console.log(result.error); // "Step execution failed" (just a string)
  }
  ```

  **After:**

  ```typescript
  const result = await workflow.execute({ input });
  if (result.status === 'failed') {
    // Custom properties are preserved
    console.log(result.error.message); // "Step execution failed"
    console.log(result.error.statusCode); // 429
    console.log(result.error.cause?.name); // "RateLimitError"
  }
  ```

  **Type change:** `WorkflowState.error` and `WorkflowRunState.error` types changed from `string | Error` to `SerializedError`.

  Other changes:
  - Added `UpdateWorkflowStateOptions` type for workflow state updates

- Updated dependencies [[`d5ed981`](https://github.com/mastra-ai/mastra/commit/d5ed981c8701c1b8a27a5f35a9a2f7d9244e695f), [`9650cce`](https://github.com/mastra-ai/mastra/commit/9650cce52a1d917ff9114653398e2a0f5c3ba808), [`932d63d`](https://github.com/mastra-ai/mastra/commit/932d63dd51be9c8bf1e00e3671fe65606c6fb9cd), [`b760b73`](https://github.com/mastra-ai/mastra/commit/b760b731aca7c8a3f041f61d57a7f125ae9cb215), [`695a621`](https://github.com/mastra-ai/mastra/commit/695a621528bdabeb87f83c2277cf2bb084c7f2b4), [`2b459f4`](https://github.com/mastra-ai/mastra/commit/2b459f466fd91688eeb2a44801dc23f7f8a887ab), [`486352b`](https://github.com/mastra-ai/mastra/commit/486352b66c746602b68a95839f830de14c7fb8c0), [`09e4bae`](https://github.com/mastra-ai/mastra/commit/09e4bae18dd5357d2ae078a4a95a2af32168ab08), [`24b76d8`](https://github.com/mastra-ai/mastra/commit/24b76d8e17656269c8ed09a0c038adb9cc2ae95a), [`243a823`](https://github.com/mastra-ai/mastra/commit/243a8239c5906f5c94e4f78b54676793f7510ae3), [`486352b`](https://github.com/mastra-ai/mastra/commit/486352b66c746602b68a95839f830de14c7fb8c0), [`c61fac3`](https://github.com/mastra-ai/mastra/commit/c61fac3add96f0dcce0208c07415279e2537eb62), [`6f14f70`](https://github.com/mastra-ai/mastra/commit/6f14f706ccaaf81b69544b6c1b75ab66a41e5317), [`09e4bae`](https://github.com/mastra-ai/mastra/commit/09e4bae18dd5357d2ae078a4a95a2af32168ab08), [`4524734`](https://github.com/mastra-ai/mastra/commit/45247343e384717a7c8404296275c56201d6470f), [`2a53598`](https://github.com/mastra-ai/mastra/commit/2a53598c6d8cfeb904a7fc74e57e526d751c8fa6), [`c7cd3c7`](https://github.com/mastra-ai/mastra/commit/c7cd3c7a187d7aaf79e2ca139de328bf609a14b4), [`847c212`](https://github.com/mastra-ai/mastra/commit/847c212caba7df0d6f2fc756b494ac3c75c3720d), [`6f941c4`](https://github.com/mastra-ai/mastra/commit/6f941c438ca5f578619788acc7608fc2e23bd176)]:
  - @mastra/core@1.0.0-beta.12

## 1.0.0-beta.6

### Patch Changes

- Add delete workflow run API ([#10991](https://github.com/mastra-ai/mastra/pull/10991))

  ```typescript
  await workflow.deleteWorkflowRunById(runId);
  ```

- Updated dependencies [[`edb07e4`](https://github.com/mastra-ai/mastra/commit/edb07e49283e0c28bd094a60e03439bf6ecf0221), [`b7e17d3`](https://github.com/mastra-ai/mastra/commit/b7e17d3f5390bb5a71efc112204413656fcdc18d), [`261473a`](https://github.com/mastra-ai/mastra/commit/261473ac637e633064a22076671e2e02b002214d), [`5d7000f`](https://github.com/mastra-ai/mastra/commit/5d7000f757cd65ea9dc5b05e662fd83dfd44e932), [`4f0331a`](https://github.com/mastra-ai/mastra/commit/4f0331a79bf6eb5ee598a5086e55de4b5a0ada03), [`8a000da`](https://github.com/mastra-ai/mastra/commit/8a000da0c09c679a2312f6b3aa05b2ca78ca7393)]:
  - @mastra/core@1.0.0-beta.10

## 1.0.0-beta.5

### Patch Changes

- Fix saveScore not persisting ID correctly, breaking getScoreById retrieval ([#10915](https://github.com/mastra-ai/mastra/pull/10915))

  **What Changed**
  - saveScore now correctly returns scores that can be retrieved with getScoreById
  - Validation errors now include contextual information (scorer, entity, trace details) for easier debugging

  **Impact**
  Previously, calling getScoreById after saveScore would return null because the generated ID wasn't persisted to the database. This is now fixed across all store implementations, ensuring consistent behavior and data integrity.

- Updated dependencies [[`0d41fe2`](https://github.com/mastra-ai/mastra/commit/0d41fe245355dfc66d61a0d9c85d9400aac351ff), [`6b3ba91`](https://github.com/mastra-ai/mastra/commit/6b3ba91494cc10394df96782f349a4f7b1e152cc), [`7907fd1`](https://github.com/mastra-ai/mastra/commit/7907fd1c5059813b7b870b81ca71041dc807331b)]:
  - @mastra/core@1.0.0-beta.8

## 1.0.0-beta.4

### Minor Changes

- Add `disableInit` option to all storage adapters ([#10851](https://github.com/mastra-ai/mastra/pull/10851))

  Adds a new `disableInit` config option to all storage providers that allows users to disable automatic table creation/migrations at runtime. This is useful for CI/CD pipelines where you want to run migrations during deployment with elevated credentials, then run the application with `disableInit: true` so it doesn't attempt schema changes at runtime.

  ```typescript
  // CI/CD script - run migrations
  const storage = new PostgresStore({
    connectionString: DATABASE_URL,
    id: 'pg-storage',
  });
  await storage.init();

  // Runtime - skip auto-init
  const storage = new PostgresStore({
    connectionString: DATABASE_URL,
    id: 'pg-storage',
    disableInit: true,
  });
  ```

### Patch Changes

- Standardize error IDs across all storage and vector stores using centralized helper functions (`createStorageErrorId` and `createVectorErrorId`). This ensures consistent error ID patterns (`MASTRA_STORAGE_{STORE}_{OPERATION}_{STATUS}` and `MASTRA_VECTOR_{STORE}_{OPERATION}_{STATUS}`) across the codebase for better error tracking and debugging. ([#10913](https://github.com/mastra-ai/mastra/pull/10913))

- Updated dependencies [[`3076c67`](https://github.com/mastra-ai/mastra/commit/3076c6778b18988ae7d5c4c5c466366974b2d63f), [`85d7ee1`](https://github.com/mastra-ai/mastra/commit/85d7ee18ff4e14d625a8a30ec6656bb49804989b), [`c6c1092`](https://github.com/mastra-ai/mastra/commit/c6c1092f8fbf76109303f69e000e96fd1960c4ce), [`81dc110`](https://github.com/mastra-ai/mastra/commit/81dc11008d147cf5bdc8996ead1aa61dbdebb6fc), [`7aedb74`](https://github.com/mastra-ai/mastra/commit/7aedb74883adf66af38e270e4068fd42e7a37036), [`8f02d80`](https://github.com/mastra-ai/mastra/commit/8f02d800777397e4b45d7f1ad041988a8b0c6630), [`d7aad50`](https://github.com/mastra-ai/mastra/commit/d7aad501ce61646b76b4b511e558ac4eea9884d0), [`ce0a73a`](https://github.com/mastra-ai/mastra/commit/ce0a73abeaa75b10ca38f9e40a255a645d50ebfb), [`a02e542`](https://github.com/mastra-ai/mastra/commit/a02e542d23179bad250b044b17ff023caa61739f), [`a372c64`](https://github.com/mastra-ai/mastra/commit/a372c640ad1fd12e8f0613cebdc682fc156b4d95), [`8846867`](https://github.com/mastra-ai/mastra/commit/8846867ffa9a3746767618e314bebac08eb77d87), [`42a42cf`](https://github.com/mastra-ai/mastra/commit/42a42cf3132b9786feecbb8c13c583dce5b0e198), [`ae08bf0`](https://github.com/mastra-ai/mastra/commit/ae08bf0ebc6a4e4da992b711c4a389c32ba84cf4), [`21735a7`](https://github.com/mastra-ai/mastra/commit/21735a7ef306963554a69a89b44f06c3bcd85141), [`1d877b8`](https://github.com/mastra-ai/mastra/commit/1d877b8d7b536a251c1a7a18db7ddcf4f68d6f8b)]:
  - @mastra/core@1.0.0-beta.7

## 1.0.0-beta.3

### Patch Changes

- feat(storage): support querying messages from multiple threads ([#10663](https://github.com/mastra-ai/mastra/pull/10663))
  - Fixed TypeScript errors where `threadId: string | string[]` was being passed to places expecting `Scalar` type
  - Added proper multi-thread support for `listMessages` across all adapters when `threadId` is an array
  - Updated `_getIncludedMessages` to look up message threadId by ID (since message IDs are globally unique)
  - **upstash**: Added `msg-idx:{messageId}` index for O(1) message lookups (backwards compatible with fallback to scan for old messages, with automatic backfill)

- fix: ensure score responses match saved payloads for Mastra Stores. ([#10557](https://github.com/mastra-ai/mastra/pull/10557))

- Unify transformScoreRow functions across storage adapters ([#10648](https://github.com/mastra-ai/mastra/pull/10648))

  Added a unified `transformScoreRow` function in `@mastra/core/storage` that provides schema-driven row transformation for score data. This eliminates code duplication across 10 storage adapters while maintaining store-specific behavior through configurable options:
  - `preferredTimestampFields`: Preferred source fields for timestamps (PostgreSQL, Cloudflare D1)
  - `convertTimestamps`: Convert timestamp strings to Date objects (MSSQL, MongoDB, ClickHouse)
  - `nullValuePattern`: Skip values matching pattern (ClickHouse's `'_null_'`)
  - `fieldMappings`: Map source column names to schema fields (LibSQL's `additionalLLMContext`)

  Each store adapter now uses the unified function with appropriate options, reducing ~200 lines of duplicate transformation logic while ensuring consistent behavior across all storage backends.

- Updated dependencies [[`ac0d2f4`](https://github.com/mastra-ai/mastra/commit/ac0d2f4ff8831f72c1c66c2be809706d17f65789), [`1a0d3fc`](https://github.com/mastra-ai/mastra/commit/1a0d3fc811482c9c376cdf79ee615c23bae9b2d6), [`85a628b`](https://github.com/mastra-ai/mastra/commit/85a628b1224a8f64cd82ea7f033774bf22df7a7e), [`c237233`](https://github.com/mastra-ai/mastra/commit/c23723399ccedf7f5744b3f40997b79246bfbe64), [`15f9e21`](https://github.com/mastra-ai/mastra/commit/15f9e216177201ea6e3f6d0bfb063fcc0953444f), [`ff94dea`](https://github.com/mastra-ai/mastra/commit/ff94dea935f4e34545c63bcb6c29804732698809), [`5b2ff46`](https://github.com/mastra-ai/mastra/commit/5b2ff4651df70c146523a7fca773f8eb0a2272f8), [`db41688`](https://github.com/mastra-ai/mastra/commit/db4168806d007417e2e60b4f68656dca4e5f40c9), [`5ca599d`](https://github.com/mastra-ai/mastra/commit/5ca599d0bb59a1595f19f58473fcd67cc71cef58), [`bff1145`](https://github.com/mastra-ai/mastra/commit/bff114556b3cbadad9b2768488708f8ad0e91475), [`5c8ca24`](https://github.com/mastra-ai/mastra/commit/5c8ca247094e0cc2cdbd7137822fb47241f86e77), [`e191844`](https://github.com/mastra-ai/mastra/commit/e1918444ca3f80e82feef1dad506cd4ec6e2875f), [`22553f1`](https://github.com/mastra-ai/mastra/commit/22553f11c63ee5e966a9c034a349822249584691), [`7237163`](https://github.com/mastra-ai/mastra/commit/72371635dbf96a87df4b073cc48fc655afbdce3d), [`2500740`](https://github.com/mastra-ai/mastra/commit/2500740ea23da067d6e50ec71c625ab3ce275e64), [`873ecbb`](https://github.com/mastra-ai/mastra/commit/873ecbb517586aa17d2f1e99283755b3ebb2863f), [`4f9bbe5`](https://github.com/mastra-ai/mastra/commit/4f9bbe5968f42c86f4930b8193de3c3c17e5bd36), [`02e51fe`](https://github.com/mastra-ai/mastra/commit/02e51feddb3d4155cfbcc42624fd0d0970d032c0), [`8f3fa3a`](https://github.com/mastra-ai/mastra/commit/8f3fa3a652bb77da092f913ec51ae46e3a7e27dc), [`cd29ad2`](https://github.com/mastra-ai/mastra/commit/cd29ad23a255534e8191f249593849ed29160886), [`bdf4d8c`](https://github.com/mastra-ai/mastra/commit/bdf4d8cdc656d8a2c21d81834bfa3bfa70f56c16), [`854e3da`](https://github.com/mastra-ai/mastra/commit/854e3dad5daac17a91a20986399d3a51f54bf68b), [`ce18d38`](https://github.com/mastra-ai/mastra/commit/ce18d38678c65870350d123955014a8432075fd9), [`cccf9c8`](https://github.com/mastra-ai/mastra/commit/cccf9c8b2d2dfc1a5e63919395b83d78c89682a0), [`61a5705`](https://github.com/mastra-ai/mastra/commit/61a570551278b6743e64243b3ce7d73de915ca8a), [`db70a48`](https://github.com/mastra-ai/mastra/commit/db70a48aeeeeb8e5f92007e8ede52c364ce15287), [`f0fdc14`](https://github.com/mastra-ai/mastra/commit/f0fdc14ee233d619266b3d2bbdeea7d25cfc6d13), [`db18bc9`](https://github.com/mastra-ai/mastra/commit/db18bc9c3825e2c1a0ad9a183cc9935f6691bfa1), [`9b37b56`](https://github.com/mastra-ai/mastra/commit/9b37b565e1f2a76c24f728945cc740c2b09be9da), [`41a23c3`](https://github.com/mastra-ai/mastra/commit/41a23c32f9877d71810f37e24930515df2ff7a0f), [`5d171ad`](https://github.com/mastra-ai/mastra/commit/5d171ad9ef340387276b77c2bb3e83e83332d729), [`f03ae60`](https://github.com/mastra-ai/mastra/commit/f03ae60500fe350c9d828621006cdafe1975fdd8), [`d1e74a0`](https://github.com/mastra-ai/mastra/commit/d1e74a0a293866dece31022047f5dbab65a304d0), [`39e7869`](https://github.com/mastra-ai/mastra/commit/39e7869bc7d0ee391077ce291474d8a84eedccff), [`5761926`](https://github.com/mastra-ai/mastra/commit/57619260c4a2cdd598763abbacd90de594c6bc76), [`c900fdd`](https://github.com/mastra-ai/mastra/commit/c900fdd504c41348efdffb205cfe80d48c38fa33), [`604a79f`](https://github.com/mastra-ai/mastra/commit/604a79fecf276e26a54a3fe01bb94e65315d2e0e), [`887f0b4`](https://github.com/mastra-ai/mastra/commit/887f0b4746cdbd7cb7d6b17ac9f82aeb58037ea5), [`2562143`](https://github.com/mastra-ai/mastra/commit/256214336b4faa78646c9c1776612393790d8784), [`ef11a61`](https://github.com/mastra-ai/mastra/commit/ef11a61920fa0ed08a5b7ceedd192875af119749)]:
  - @mastra/core@1.0.0-beta.6

## 1.0.0-beta.2

### Patch Changes

- Add new deleteVectors, updateVector by filter ([#10408](https://github.com/mastra-ai/mastra/pull/10408))

- Updated dependencies [[`21a15de`](https://github.com/mastra-ai/mastra/commit/21a15de369fe82aac26bb642ed7be73505475e8b), [`feb7ee4`](https://github.com/mastra-ai/mastra/commit/feb7ee4d09a75edb46c6669a3beaceec78811747), [`b0e2ea5`](https://github.com/mastra-ai/mastra/commit/b0e2ea5b52c40fae438b9e2f7baee6f0f89c5442), [`c456e01`](https://github.com/mastra-ai/mastra/commit/c456e0149e3c176afcefdbd9bb1d2c5917723725), [`ab035c2`](https://github.com/mastra-ai/mastra/commit/ab035c2ef6d8cc7bb25f06f1a38508bd9e6f126b), [`1a46a56`](https://github.com/mastra-ai/mastra/commit/1a46a566f45a3fcbadc1cf36bf86d351f264bfa3), [`3cf540b`](https://github.com/mastra-ai/mastra/commit/3cf540b9fbfea8f4fc8d3a2319a4e6c0b0cbfd52), [`1c6ce51`](https://github.com/mastra-ai/mastra/commit/1c6ce51f875915ab57fd36873623013699a2a65d), [`898a972`](https://github.com/mastra-ai/mastra/commit/898a9727d286c2510d6b702dfd367e6aaf5c6b0f), [`a97003a`](https://github.com/mastra-ai/mastra/commit/a97003aa1cf2f4022a41912324a1e77263b326b8), [`ccc141e`](https://github.com/mastra-ai/mastra/commit/ccc141ed27da0abc3a3fc28e9e5128152e8e37f4), [`fe3b897`](https://github.com/mastra-ai/mastra/commit/fe3b897c2ccbcd2b10e81b099438c7337feddf89), [`00123ba`](https://github.com/mastra-ai/mastra/commit/00123ba96dc9e5cd0b110420ebdba56d8f237b25), [`29c4309`](https://github.com/mastra-ai/mastra/commit/29c4309f818b24304c041bcb4a8f19b5f13f6b62), [`16785ce`](https://github.com/mastra-ai/mastra/commit/16785ced928f6f22638f4488cf8a125d99211799), [`de8239b`](https://github.com/mastra-ai/mastra/commit/de8239bdcb1d8c0cfa06da21f1569912a66bbc8a), [`b5e6cd7`](https://github.com/mastra-ai/mastra/commit/b5e6cd77fc8c8e64e0494c1d06cee3d84e795d1e), [`3759cb0`](https://github.com/mastra-ai/mastra/commit/3759cb064935b5f74c65ac2f52a1145f7352899d), [`651e772`](https://github.com/mastra-ai/mastra/commit/651e772eb1475fb13e126d3fcc01751297a88214), [`b61b93f`](https://github.com/mastra-ai/mastra/commit/b61b93f9e058b11dd2eec169853175d31dbdd567), [`bae33d9`](https://github.com/mastra-ai/mastra/commit/bae33d91a63fbb64d1e80519e1fc1acaed1e9013), [`c0b731f`](https://github.com/mastra-ai/mastra/commit/c0b731fb27d712dc8582e846df5c0332a6a0c5ba), [`43ca8f2`](https://github.com/mastra-ai/mastra/commit/43ca8f2c7334851cc7b4d3d2f037d8784bfbdd5f), [`2ca67cc`](https://github.com/mastra-ai/mastra/commit/2ca67cc3bb1f6a617353fdcab197d9efebe60d6f), [`9e67002`](https://github.com/mastra-ai/mastra/commit/9e67002b52c9be19936c420a489dbee9c5fd6a78), [`35edc49`](https://github.com/mastra-ai/mastra/commit/35edc49ac0556db609189641d6341e76771b81fc)]:
  - @mastra/core@1.0.0-beta.5

## 1.0.0-beta.1

### Patch Changes

- Add restart method to workflow run that allows restarting an active workflow run ([#9750](https://github.com/mastra-ai/mastra/pull/9750))
  Add status filter to `listWorkflowRuns`
  Add automatic restart to restart active workflow runs when server starts
- Updated dependencies [[`2319326`](https://github.com/mastra-ai/mastra/commit/2319326f8c64e503a09bbcf14be2dd65405445e0), [`d629361`](https://github.com/mastra-ai/mastra/commit/d629361a60f6565b5bfb11976fdaf7308af858e2), [`08c31c1`](https://github.com/mastra-ai/mastra/commit/08c31c188ebccd598acaf55e888b6397d01f7eae), [`fd3d338`](https://github.com/mastra-ai/mastra/commit/fd3d338a2c362174ed5b383f1f011ad9fb0302aa), [`c30400a`](https://github.com/mastra-ai/mastra/commit/c30400a49b994b1b97256fe785eb6c906fc2b232), [`69e0a87`](https://github.com/mastra-ai/mastra/commit/69e0a878896a2da9494945d86e056a5f8f05b851), [`01f8878`](https://github.com/mastra-ai/mastra/commit/01f88783de25e4de048c1c8aace43e26373c6ea5), [`4c77209`](https://github.com/mastra-ai/mastra/commit/4c77209e6c11678808b365d545845918c40045c8), [`d827d08`](https://github.com/mastra-ai/mastra/commit/d827d0808ffe1f3553a84e975806cc989b9735dd), [`23c10a1`](https://github.com/mastra-ai/mastra/commit/23c10a1efdd9a693c405511ab2dc8a1236603162), [`676ccc7`](https://github.com/mastra-ai/mastra/commit/676ccc7fe92468d2d45d39c31a87825c89fd1ea0), [`c10398d`](https://github.com/mastra-ai/mastra/commit/c10398d5b88f1d4af556f4267ff06f1d11e89179), [`00c2387`](https://github.com/mastra-ai/mastra/commit/00c2387f5f04a365316f851e58666ac43f8c4edf), [`ad6250d`](https://github.com/mastra-ai/mastra/commit/ad6250dbdaad927e29f74a27b83f6c468b50a705), [`3a73998`](https://github.com/mastra-ai/mastra/commit/3a73998fa4ebeb7f3dc9301afe78095fc63e7999), [`e16d553`](https://github.com/mastra-ai/mastra/commit/e16d55338403c7553531cc568125c63d53653dff), [`4d59f58`](https://github.com/mastra-ai/mastra/commit/4d59f58de2d90d6e2810a19d4518e38ddddb9038), [`e1bb9c9`](https://github.com/mastra-ai/mastra/commit/e1bb9c94b4eb68b019ae275981be3feb769b5365), [`351a11f`](https://github.com/mastra-ai/mastra/commit/351a11fcaf2ed1008977fa9b9a489fc422e51cd4)]:
  - @mastra/core@1.0.0-beta.3

## 1.0.0-beta.0

### Major Changes

- Moving scorers under the eval domain, api method consistency, prebuilt evals, scorers require ids. ([#9589](https://github.com/mastra-ai/mastra/pull/9589))

- Every Mastra primitive (agent, MCPServer, workflow, tool, processor, scorer, and vector) now has a get, list, and add method associated with it. Each primitive also now requires an id to be set. ([#9675](https://github.com/mastra-ai/mastra/pull/9675))

  Primitives that are added to other primitives are also automatically added to the Mastra instance

- Update handlers to use `listWorkflowRuns` instead of `getWorkflowRuns`. Fix type names from `StoragelistThreadsByResourceIdInput/Output` to `StorageListThreadsByResourceIdInput/Output`. ([#9507](https://github.com/mastra-ai/mastra/pull/9507))

- **BREAKING:** Remove `getMessagesPaginated()` and add `perPage: false` support ([#9670](https://github.com/mastra-ai/mastra/pull/9670))

  Removes deprecated `getMessagesPaginated()` method. The `listMessages()` API and score handlers now support `perPage: false` to fetch all records without pagination limits.

  **Storage changes:**
  - `StoragePagination.perPage` type changed from `number` to `number | false`
  - All storage implementations support `perPage: false`:
    - Memory: `listMessages()`
    - Scores: `listScoresBySpan()`, `listScoresByRunId()`, `listScoresByExecutionId()`
  - HTTP query parser accepts `"false"` string (e.g., `?perPage=false`)

  **Memory changes:**
  - `memory.query()` parameter type changed from `StorageGetMessagesArg` to `StorageListMessagesInput`
  - Uses flat parameters (`page`, `perPage`, `include`, `filter`, `vectorSearchString`) instead of `selectBy` object

  **Stricter validation:**
  - `listMessages()` requires non-empty, non-whitespace `threadId` (throws error instead of returning empty results)

  **Migration:**

  ```typescript
  // Storage/Memory: Replace getMessagesPaginated with listMessages
  - storage.getMessagesPaginated({ threadId, selectBy: { pagination: { page: 0, perPage: 20 } } })
  + storage.listMessages({ threadId, page: 0, perPage: 20 })
  + storage.listMessages({ threadId, page: 0, perPage: false })  // Fetch all

  // Memory: Replace selectBy with flat parameters
  - memory.query({ threadId, selectBy: { last: 20, include: [...] } })
  + memory.query({ threadId, perPage: 20, include: [...] })

  // Client SDK
  - thread.getMessagesPaginated({ selectBy: { pagination: { page: 0 } } })
  + thread.listMessages({ page: 0, perPage: 20 })
  ```

- # Major Changes ([#9695](https://github.com/mastra-ai/mastra/pull/9695))

  ## Storage Layer

  ### BREAKING: Removed `storage.getMessages()`

  The `getMessages()` method has been removed from all storage implementations. Use `listMessages()` instead, which provides pagination support.

  **Migration:**

  ```typescript
  // Before
  const messages = await storage.getMessages({ threadId: 'thread-1' });

  // After
  const result = await storage.listMessages({
    threadId: 'thread-1',
    page: 0,
    perPage: 50,
  });
  const messages = result.messages; // Access messages array
  console.log(result.total); // Total count
  console.log(result.hasMore); // Whether more pages exist
  ```

  ### Message ordering default

  `listMessages()` defaults to ASC (oldest first) ordering by `createdAt`, matching the previous `getMessages()` behavior.

  **To use DESC ordering (newest first):**

  ```typescript
  const result = await storage.listMessages({
    threadId: 'thread-1',
    orderBy: { field: 'createdAt', direction: 'DESC' },
  });
  ```

  ## Client SDK

  ### BREAKING: Renamed `client.getThreadMessages()` → `client.listThreadMessages()`

  **Migration:**

  ```typescript
  // Before
  const response = await client.getThreadMessages(threadId, { agentId });

  // After
  const response = await client.listThreadMessages(threadId, { agentId });
  ```

  The response format remains the same.

  ## Type Changes

  ### BREAKING: Removed `StorageGetMessagesArg` type

  Use `StorageListMessagesInput` instead:

  ```typescript
  // Before
  import type { StorageGetMessagesArg } from '@mastra/core';

  // After
  import type { StorageListMessagesInput } from '@mastra/core';
  ```

- Bump minimum required Node.js version to 22.13.0 ([#9706](https://github.com/mastra-ai/mastra/pull/9706))

- Add new list methods to storage API: `listMessages`, `listMessagesById`, `listThreadsByResourceId`, and `listWorkflowRuns`. Most methods are currently wrappers around existing methods. Full implementations will be added when migrating away from legacy methods. ([#9489](https://github.com/mastra-ai/mastra/pull/9489))

- Rename RuntimeContext to RequestContext ([#9511](https://github.com/mastra-ai/mastra/pull/9511))

- Implement listMessages API for replacing previous methods ([#9531](https://github.com/mastra-ai/mastra/pull/9531))

- Remove `getThreadsByResourceId` and `getThreadsByResourceIdPaginated` methods from storage interfaces in favor of `listThreadsByResourceId`. The new method uses `offset`/`limit` pagination and a nested `orderBy` object structure (`{ field, direction }`). ([#9536](https://github.com/mastra-ai/mastra/pull/9536))

- Remove `getMessagesById` method from storage interfaces in favor of `listMessagesById`. The new method only returns V2-format messages and removes the format parameter, simplifying the API surface. Users should migrate from `getMessagesById({ messageIds, format })` to `listMessagesById({ messageIds })`. ([#9534](https://github.com/mastra-ai/mastra/pull/9534))

- Renamed a bunch of observability/tracing-related things to drop the AI prefix. ([#9744](https://github.com/mastra-ai/mastra/pull/9744))

- **BREAKING CHANGE**: Pagination APIs now use `page`/`perPage` instead of `offset`/`limit` ([#9592](https://github.com/mastra-ai/mastra/pull/9592))

  All storage and memory pagination APIs have been updated to use `page` (0-indexed) and `perPage` instead of `offset` and `limit`, aligning with standard REST API patterns.

  **Affected APIs:**
  - `Memory.listThreadsByResourceId()`
  - `Memory.listMessages()`
  - `Storage.listWorkflowRuns()`

  **Migration:**

  ```typescript
  // Before
  await memory.listThreadsByResourceId({
    resourceId: 'user-123',
    offset: 20,
    limit: 10,
  });

  // After
  await memory.listThreadsByResourceId({
    resourceId: 'user-123',
    page: 2, // page = Math.floor(offset / limit)
    perPage: 10,
  });

  // Before
  await memory.listMessages({
    threadId: 'thread-456',
    offset: 20,
    limit: 10,
  });

  // After
  await memory.listMessages({
    threadId: 'thread-456',
    page: 2,
    perPage: 10,
  });

  // Before
  await storage.listWorkflowRuns({
    workflowName: 'my-workflow',
    offset: 20,
    limit: 10,
  });

  // After
  await storage.listWorkflowRuns({
    workflowName: 'my-workflow',
    page: 2,
    perPage: 10,
  });
  ```

  **Additional improvements:**
  - Added validation for negative `page` values in all storage implementations
  - Improved `perPage` validation to handle edge cases (negative values, `0`, `false`)
  - Added reusable query parser utilities for consistent validation in handlers

- ```([#9709](https://github.com/mastra-ai/mastra/pull/9709))
  import { Mastra } from '@mastra/core';
  import { Observability } from '@mastra/observability';  // Explicit import

  const mastra = new Mastra({
    ...other_config,
    observability: new Observability({
      default: { enabled: true }
    })  // Instance
  });
  ```

  Instead of:

  ```
  import { Mastra } from '@mastra/core';
  import '@mastra/observability/init';  // Explicit import

  const mastra = new Mastra({
    ...other_config,
    observability: {
      default: { enabled: true }
    }
  });
  ```

  Also renamed a bunch of:
  - `Tracing` things to `Observability` things.
  - `AI-` things to just things.

- Removed old tracing code based on OpenTelemetry ([#9237](https://github.com/mastra-ai/mastra/pull/9237))

- Mark as stable ([`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc))

- Renamed `MastraMessageV2` to `MastraDBMessage` ([#9255](https://github.com/mastra-ai/mastra/pull/9255))
  Made the return format of all methods that return db messages consistent. It's always `{ messages: MastraDBMessage[] }` now, and messages can be converted after that using `@mastra/ai-sdk/ui`'s `toAISdkV4/5Messages()` function

- moved ai-tracing code into @mastra/observability ([#9661](https://github.com/mastra-ai/mastra/pull/9661))

- Remove legacy evals from Mastra ([#9491](https://github.com/mastra-ai/mastra/pull/9491))

### Minor Changes

- Update peer dependencies to match core package version bump (1.0.0) ([#9237](https://github.com/mastra-ai/mastra/pull/9237))

### Patch Changes

- Adds MongoDB Observability support, and MongoDB Storage documentation, examples, and telemetry. ([#8426](https://github.com/mastra-ai/mastra/pull/8426))

- Updated dependencies [[`39c9743`](https://github.com/mastra-ai/mastra/commit/39c97432d084294f8ba85fbf3ef28098ff21459e), [`f743dbb`](https://github.com/mastra-ai/mastra/commit/f743dbb8b40d1627b5c10c0e6fc154f4ebb6e394), [`fec5129`](https://github.com/mastra-ai/mastra/commit/fec5129de7fc64423ea03661a56cef31dc747a0d), [`0491e7c`](https://github.com/mastra-ai/mastra/commit/0491e7c9b714cb0ba22187ee062147ec2dd7c712), [`f6f4903`](https://github.com/mastra-ai/mastra/commit/f6f4903397314f73362061dc5a3e8e7c61ea34aa), [`0e8ed46`](https://github.com/mastra-ai/mastra/commit/0e8ed467c54d6901a6a365f270ec15d6faadb36c), [`6c049d9`](https://github.com/mastra-ai/mastra/commit/6c049d94063fdcbd5b81c4912a2bf82a92c9cc0b), [`2f897df`](https://github.com/mastra-ai/mastra/commit/2f897df208508f46f51b7625e5dd20c37f93e0e3), [`3443770`](https://github.com/mastra-ai/mastra/commit/3443770662df8eb24c9df3589b2792d78cfcb811), [`f0a07e0`](https://github.com/mastra-ai/mastra/commit/f0a07e0111b3307c5fabfa4094c5c2cfb734fbe6), [`aaa40e7`](https://github.com/mastra-ai/mastra/commit/aaa40e788628b319baa8e889407d11ad626547fa), [`1521d71`](https://github.com/mastra-ai/mastra/commit/1521d716e5daedc74690c983fbd961123c56756b), [`9e1911d`](https://github.com/mastra-ai/mastra/commit/9e1911db2b4db85e0e768c3f15e0d61e319869f6), [`ebac155`](https://github.com/mastra-ai/mastra/commit/ebac15564a590117db7078233f927a7e28a85106), [`dd1c38d`](https://github.com/mastra-ai/mastra/commit/dd1c38d1b75f1b695c27b40d8d9d6ed00d5e0f6f), [`5948e6a`](https://github.com/mastra-ai/mastra/commit/5948e6a5146c83666ba3f294b2be576c82a513fb), [`8940859`](https://github.com/mastra-ai/mastra/commit/89408593658199b4ad67f7b65e888f344e64a442), [`e629310`](https://github.com/mastra-ai/mastra/commit/e629310f1a73fa236d49ec7a1d1cceb6229dc7cc), [`4c6b492`](https://github.com/mastra-ai/mastra/commit/4c6b492c4dd591c6a592520c1f6855d6e936d71f), [`dff01d8`](https://github.com/mastra-ai/mastra/commit/dff01d81ce1f4e4087cfac20fa868e6db138dd14), [`9d819d5`](https://github.com/mastra-ai/mastra/commit/9d819d54b61481639f4008e4694791bddf187edd), [`71c8d6c`](https://github.com/mastra-ai/mastra/commit/71c8d6c161253207b2b9588bdadb7eed604f7253), [`6179a9b`](https://github.com/mastra-ai/mastra/commit/6179a9ba36ffac326de3cc3c43cdc8028d37c251), [`00f4921`](https://github.com/mastra-ai/mastra/commit/00f4921dd2c91a1e5446799599ef7116a8214a1a), [`ca8041c`](https://github.com/mastra-ai/mastra/commit/ca8041cce0379fda22ed293a565bcb5b6ddca68a), [`7051bf3`](https://github.com/mastra-ai/mastra/commit/7051bf38b3b122a069008f861f7bfc004a6d9f6e), [`a8f1494`](https://github.com/mastra-ai/mastra/commit/a8f1494f4bbdc2770bcf327d4c7d869e332183f1), [`0793497`](https://github.com/mastra-ai/mastra/commit/079349753620c40246ffd673e3f9d7d9820beff3), [`5df9cce`](https://github.com/mastra-ai/mastra/commit/5df9cce1a753438413f64c11eeef8f845745c2a8), [`a854ede`](https://github.com/mastra-ai/mastra/commit/a854ede62bf5ac0945a624ac48913dd69c73aabf), [`c576fc0`](https://github.com/mastra-ai/mastra/commit/c576fc0b100b2085afded91a37c97a0ea0ec09c7), [`3defc80`](https://github.com/mastra-ai/mastra/commit/3defc80cf2b88a1b7fc1cc4ddcb91e982a614609), [`16153fe`](https://github.com/mastra-ai/mastra/commit/16153fe7eb13c99401f48e6ca32707c965ee28b9), [`9f4a683`](https://github.com/mastra-ai/mastra/commit/9f4a6833e88b52574665c028fd5508ad5c2f6004), [`bc94344`](https://github.com/mastra-ai/mastra/commit/bc943444a1342d8a662151b7bce1df7dae32f59c), [`57d157f`](https://github.com/mastra-ai/mastra/commit/57d157f0b163a95c3e6c9eae31bdb11d1bfc64f9), [`903f67d`](https://github.com/mastra-ai/mastra/commit/903f67d184504a273893818c02b961f5423a79ad), [`2a90c55`](https://github.com/mastra-ai/mastra/commit/2a90c55a86a9210697d5adaab5ee94584b079adc), [`eb09742`](https://github.com/mastra-ai/mastra/commit/eb09742197f66c4c38154c3beec78313e69760b2), [`96d35f6`](https://github.com/mastra-ai/mastra/commit/96d35f61376bc2b1bf148648a2c1985bd51bef55), [`5cbe88a`](https://github.com/mastra-ai/mastra/commit/5cbe88aefbd9f933bca669fd371ea36bf939ac6d), [`a1bd7b8`](https://github.com/mastra-ai/mastra/commit/a1bd7b8571db16b94eb01588f451a74758c96d65), [`d78b38d`](https://github.com/mastra-ai/mastra/commit/d78b38d898fce285260d3bbb4befade54331617f), [`0633100`](https://github.com/mastra-ai/mastra/commit/0633100a911ad22f5256471bdf753da21c104742), [`c710c16`](https://github.com/mastra-ai/mastra/commit/c710c1652dccfdc4111c8412bca7a6bb1d48b441), [`354ad0b`](https://github.com/mastra-ai/mastra/commit/354ad0b7b1b8183ac567f236a884fc7ede6d7138), [`cfae733`](https://github.com/mastra-ai/mastra/commit/cfae73394f4920635e6c919c8e95ff9a0788e2e5), [`e3dfda7`](https://github.com/mastra-ai/mastra/commit/e3dfda7b11bf3b8c4bb55637028befb5f387fc74), [`844ea5d`](https://github.com/mastra-ai/mastra/commit/844ea5dc0c248961e7bf73629ae7dcff503e853c), [`398fde3`](https://github.com/mastra-ai/mastra/commit/398fde3f39e707cda79372cdae8f9870e3b57c8d), [`f0f8f12`](https://github.com/mastra-ai/mastra/commit/f0f8f125c308f2d0fd36942ef652fd852df7522f), [`0d7618b`](https://github.com/mastra-ai/mastra/commit/0d7618bc650bf2800934b243eca5648f4aeed9c2), [`7b763e5`](https://github.com/mastra-ai/mastra/commit/7b763e52fc3eaf699c2a99f2adf418dd46e4e9a5), [`d36cfbb`](https://github.com/mastra-ai/mastra/commit/d36cfbbb6565ba5f827883cc9bb648eb14befdc1), [`3697853`](https://github.com/mastra-ai/mastra/commit/3697853deeb72017d90e0f38a93c1e29221aeca0), [`b2e45ec`](https://github.com/mastra-ai/mastra/commit/b2e45eca727a8db01a81ba93f1a5219c7183c839), [`d6d49f7`](https://github.com/mastra-ai/mastra/commit/d6d49f7b8714fa19a52ff9c7cf7fb7e73751901e), [`a534e95`](https://github.com/mastra-ai/mastra/commit/a534e9591f83b3cc1ebff99c67edf4cda7bf81d3), [`9d0e7fe`](https://github.com/mastra-ai/mastra/commit/9d0e7feca8ed98de959f53476ee1456073673348), [`53d927c`](https://github.com/mastra-ai/mastra/commit/53d927cc6f03bff33655b7e2b788da445a08731d), [`3f2faf2`](https://github.com/mastra-ai/mastra/commit/3f2faf2e2d685d6c053cc5af1bf9fedf267b2ce5), [`22f64bc`](https://github.com/mastra-ai/mastra/commit/22f64bc1d37149480b58bf2fefe35b79a1e3e7d5), [`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc), [`b7959e6`](https://github.com/mastra-ai/mastra/commit/b7959e6e25a46b480f9ea2217c4c6c588c423791), [`bda6370`](https://github.com/mastra-ai/mastra/commit/bda637009360649aaf579919e7873e33553c273e), [`d7acd8e`](https://github.com/mastra-ai/mastra/commit/d7acd8e987b5d7eff4fd98b0906c17c06a2e83d5), [`c7f1f7d`](https://github.com/mastra-ai/mastra/commit/c7f1f7d24f61f247f018cc2d1f33bf63212959a7), [`0bddc6d`](https://github.com/mastra-ai/mastra/commit/0bddc6d8dbd6f6008c0cba2e4960a2da75a55af1), [`735d8c1`](https://github.com/mastra-ai/mastra/commit/735d8c1c0d19fbc09e6f8b66cf41bc7655993838), [`acf322e`](https://github.com/mastra-ai/mastra/commit/acf322e0f1fd0189684cf529d91c694bea918a45), [`c942802`](https://github.com/mastra-ai/mastra/commit/c942802a477a925b01859a7b8688d4355715caaa), [`a0c8c1b`](https://github.com/mastra-ai/mastra/commit/a0c8c1b87d4fee252aebda73e8637fbe01d761c9), [`cc34739`](https://github.com/mastra-ai/mastra/commit/cc34739c34b6266a91bea561119240a7acf47887), [`c218bd3`](https://github.com/mastra-ai/mastra/commit/c218bd3759e32423735b04843a09404572631014), [`2c4438b`](https://github.com/mastra-ai/mastra/commit/2c4438b87817ab7eed818c7990fef010475af1a3), [`2b8893c`](https://github.com/mastra-ai/mastra/commit/2b8893cb108ef9acb72ee7835cd625610d2c1a4a), [`8e5c75b`](https://github.com/mastra-ai/mastra/commit/8e5c75bdb1d08a42d45309a4c72def4b6890230f), [`e59e0d3`](https://github.com/mastra-ai/mastra/commit/e59e0d32afb5fcf2c9f3c00c8f81f6c21d3a63fa), [`fa8409b`](https://github.com/mastra-ai/mastra/commit/fa8409bc39cfd8ba6643b9db5269b90b22e2a2f7), [`173c535`](https://github.com/mastra-ai/mastra/commit/173c535c0645b0da404fe09f003778f0b0d4e019)]:
  - @mastra/core@1.0.0-beta.0

## 0.14.6

### Patch Changes

- Update peerdeps to 0.23.0-0 ([#9043](https://github.com/mastra-ai/mastra/pull/9043))

- Updated dependencies [[`c67ca32`](https://github.com/mastra-ai/mastra/commit/c67ca32e3c2cf69bfc146580770c720220ca44ac), [`efb5ed9`](https://github.com/mastra-ai/mastra/commit/efb5ed946ae7f410bc68c9430beb4b010afd25ec), [`dbc9e12`](https://github.com/mastra-ai/mastra/commit/dbc9e1216ba575ba59ead4afb727a01215f7de4f), [`99e41b9`](https://github.com/mastra-ai/mastra/commit/99e41b94957cdd25137d3ac12e94e8b21aa01b68), [`c28833c`](https://github.com/mastra-ai/mastra/commit/c28833c5b6d8e10eeffd7f7d39129d53b8bca240), [`8ea07b4`](https://github.com/mastra-ai/mastra/commit/8ea07b4bdc73e4218437dbb6dcb0f4b23e745a44), [`ba201b8`](https://github.com/mastra-ai/mastra/commit/ba201b8f8feac4c72350f2dbd52c13c7297ba7b0), [`f053e89`](https://github.com/mastra-ai/mastra/commit/f053e89160dbd0bd3333fc3492f68231b5c7c349), [`4fc4136`](https://github.com/mastra-ai/mastra/commit/4fc413652866a8d2240694fddb2562e9edbb70df), [`b78e04d`](https://github.com/mastra-ai/mastra/commit/b78e04d935a16ecb1e59c5c96e564903527edddd), [`d10baf5`](https://github.com/mastra-ai/mastra/commit/d10baf5a3c924f2a6654e23a3e318ed03f189b76), [`038c55a`](https://github.com/mastra-ai/mastra/commit/038c55a7090fc1b1513a966386d3072617f836ac), [`182f045`](https://github.com/mastra-ai/mastra/commit/182f0458f25bd70aa774e64fd923c8a483eddbf1), [`9a1a485`](https://github.com/mastra-ai/mastra/commit/9a1a4859b855e37239f652bf14b1ecd1029b8c4e), [`9257233`](https://github.com/mastra-ai/mastra/commit/9257233c4ffce09b2bedc2a9adbd70d7a83fa8e2), [`7620d2b`](https://github.com/mastra-ai/mastra/commit/7620d2bddeb4fae4c3c0a0b4e672969795fca11a), [`b2365f0`](https://github.com/mastra-ai/mastra/commit/b2365f038dd4c5f06400428b224af963f399ad50), [`0f1a4c9`](https://github.com/mastra-ai/mastra/commit/0f1a4c984fb4b104b2f0b63ba18c9fa77f567700), [`9029ba3`](https://github.com/mastra-ai/mastra/commit/9029ba34459c8859fed4c6b73efd8e2d0021e7ba), [`426cc56`](https://github.com/mastra-ai/mastra/commit/426cc561c85ae76a112ded2385532a91f9f9f074), [`00931fb`](https://github.com/mastra-ai/mastra/commit/00931fb1a21aa42c4fbc20c2c40dd62466b8fc8f), [`e473bfe`](https://github.com/mastra-ai/mastra/commit/e473bfe416c0b8e876973c2b6a6f13c394b7a93f), [`b78e04d`](https://github.com/mastra-ai/mastra/commit/b78e04d935a16ecb1e59c5c96e564903527edddd), [`2db6160`](https://github.com/mastra-ai/mastra/commit/2db6160e2022ff8827c15d30157e684683b934b5), [`8aeea37`](https://github.com/mastra-ai/mastra/commit/8aeea37efdde347c635a67fed56794943b7f74ec), [`02fe153`](https://github.com/mastra-ai/mastra/commit/02fe15351d6021d214da48ec982a0e9e4150bcee), [`648e2ca`](https://github.com/mastra-ai/mastra/commit/648e2ca42da54838c6ccbdaadc6fadd808fa6b86), [`74567b3`](https://github.com/mastra-ai/mastra/commit/74567b3d237ae3915cd0bca3cf55fa0a64e4e4a4), [`b65c5e0`](https://github.com/mastra-ai/mastra/commit/b65c5e0fe6f3c390a9a8bbcf69304d972c3a4afb), [`15a1733`](https://github.com/mastra-ai/mastra/commit/15a1733074cee8bd37370e1af34cd818e89fa7ac), [`fc2a774`](https://github.com/mastra-ai/mastra/commit/fc2a77468981aaddc3e77f83f0c4ad4a4af140da), [`4e08933`](https://github.com/mastra-ai/mastra/commit/4e08933625464dfde178347af5b6278fcf34188e)]:
  - @mastra/core@0.22.0

## 0.14.6-alpha.0

### Patch Changes

- Update peerdeps to 0.23.0-0 ([#9043](https://github.com/mastra-ai/mastra/pull/9043))

- Updated dependencies [[`efb5ed9`](https://github.com/mastra-ai/mastra/commit/efb5ed946ae7f410bc68c9430beb4b010afd25ec), [`8ea07b4`](https://github.com/mastra-ai/mastra/commit/8ea07b4bdc73e4218437dbb6dcb0f4b23e745a44), [`ba201b8`](https://github.com/mastra-ai/mastra/commit/ba201b8f8feac4c72350f2dbd52c13c7297ba7b0), [`4fc4136`](https://github.com/mastra-ai/mastra/commit/4fc413652866a8d2240694fddb2562e9edbb70df), [`b78e04d`](https://github.com/mastra-ai/mastra/commit/b78e04d935a16ecb1e59c5c96e564903527edddd), [`d10baf5`](https://github.com/mastra-ai/mastra/commit/d10baf5a3c924f2a6654e23a3e318ed03f189b76), [`038c55a`](https://github.com/mastra-ai/mastra/commit/038c55a7090fc1b1513a966386d3072617f836ac), [`182f045`](https://github.com/mastra-ai/mastra/commit/182f0458f25bd70aa774e64fd923c8a483eddbf1), [`7620d2b`](https://github.com/mastra-ai/mastra/commit/7620d2bddeb4fae4c3c0a0b4e672969795fca11a), [`b2365f0`](https://github.com/mastra-ai/mastra/commit/b2365f038dd4c5f06400428b224af963f399ad50), [`9029ba3`](https://github.com/mastra-ai/mastra/commit/9029ba34459c8859fed4c6b73efd8e2d0021e7ba), [`426cc56`](https://github.com/mastra-ai/mastra/commit/426cc561c85ae76a112ded2385532a91f9f9f074), [`00931fb`](https://github.com/mastra-ai/mastra/commit/00931fb1a21aa42c4fbc20c2c40dd62466b8fc8f), [`e473bfe`](https://github.com/mastra-ai/mastra/commit/e473bfe416c0b8e876973c2b6a6f13c394b7a93f), [`b78e04d`](https://github.com/mastra-ai/mastra/commit/b78e04d935a16ecb1e59c5c96e564903527edddd), [`648e2ca`](https://github.com/mastra-ai/mastra/commit/648e2ca42da54838c6ccbdaadc6fadd808fa6b86), [`b65c5e0`](https://github.com/mastra-ai/mastra/commit/b65c5e0fe6f3c390a9a8bbcf69304d972c3a4afb)]:
  - @mastra/core@0.22.0-alpha.1

## 0.14.5

### Patch Changes

- Update peer dependencies to match core package version bump (0.21.0) ([#8619](https://github.com/mastra-ai/mastra/pull/8619))

- Update peer dependencies to match core package version bump (0.21.0) ([#8557](https://github.com/mastra-ai/mastra/pull/8557))

- Update peer dependencies to match core package version bump (0.21.0) ([#8626](https://github.com/mastra-ai/mastra/pull/8626))

- Update peer dependencies to match core package version bump (0.21.0) ([#8686](https://github.com/mastra-ai/mastra/pull/8686))

- Updated dependencies [[`1ed9670`](https://github.com/mastra-ai/mastra/commit/1ed9670d3ca50cb60dc2e517738c5eef3968ed27), [`b5a66b7`](https://github.com/mastra-ai/mastra/commit/b5a66b748a14fc8b3f63b04642ddb9621fbcc9e0), [`f59fc1e`](https://github.com/mastra-ai/mastra/commit/f59fc1e406b8912e692f6bff6cfd4754cc8d165c), [`158381d`](https://github.com/mastra-ai/mastra/commit/158381d39335be934b81ef8a1947bccace492c25), [`a1799bc`](https://github.com/mastra-ai/mastra/commit/a1799bcc1b5a1cdc188f2ac0165f17a1c4ac6f7b), [`6ff6094`](https://github.com/mastra-ai/mastra/commit/6ff60946f4ecfebdeef6e21d2b230c2204f2c9b8), [`fb703b9`](https://github.com/mastra-ai/mastra/commit/fb703b9634eeaff1a6eb2b5531ce0f9e8fb04727), [`37a2314`](https://github.com/mastra-ai/mastra/commit/37a23148e0e5a3b40d4f9f098b194671a8a49faf), [`7b1ef57`](https://github.com/mastra-ai/mastra/commit/7b1ef57fc071c2aa2a2e32905b18cd88719c5a39), [`05a9dee`](https://github.com/mastra-ai/mastra/commit/05a9dee3d355694d28847bfffb6289657fcf7dfa), [`e3c1077`](https://github.com/mastra-ai/mastra/commit/e3c107763aedd1643d3def5df450c235da9ff76c), [`1908ca0`](https://github.com/mastra-ai/mastra/commit/1908ca0521f90e43779cc29ab590173ca560443c), [`1bccdb3`](https://github.com/mastra-ai/mastra/commit/1bccdb33eb90cbeba2dc5ece1c2561fb774b26b6), [`5ef944a`](https://github.com/mastra-ai/mastra/commit/5ef944a3721d93105675cac2b2311432ff8cc393), [`d6b186f`](https://github.com/mastra-ai/mastra/commit/d6b186fb08f1caf1b86f73d3a5ee88fb999ca3be), [`ee68e82`](https://github.com/mastra-ai/mastra/commit/ee68e8289ea4408d29849e899bc6e78b3bd4e843), [`228228b`](https://github.com/mastra-ai/mastra/commit/228228b0b1de9291cb8887587f5cea1a8757ebad), [`ea33930`](https://github.com/mastra-ai/mastra/commit/ea339301e82d6318257720d811b043014ee44064), [`65493b3`](https://github.com/mastra-ai/mastra/commit/65493b31c36f6fdb78f9679f7e1ecf0c250aa5ee), [`a998b8f`](https://github.com/mastra-ai/mastra/commit/a998b8f858091c2ec47683e60766cf12d03001e4), [`b5a66b7`](https://github.com/mastra-ai/mastra/commit/b5a66b748a14fc8b3f63b04642ddb9621fbcc9e0), [`8a37bdd`](https://github.com/mastra-ai/mastra/commit/8a37bddb6d8614a32c5b70303d583d80c620ea61), [`135d6f2`](https://github.com/mastra-ai/mastra/commit/135d6f22a326ed1dffff858700669dff09d2c9eb)]:
  - @mastra/core@0.21.0

## 0.14.5-alpha.0

### Patch Changes

- Update peer dependencies to match core package version bump (0.21.0) ([#8619](https://github.com/mastra-ai/mastra/pull/8619))

- Update peer dependencies to match core package version bump (0.21.0) ([#8557](https://github.com/mastra-ai/mastra/pull/8557))

- Update peer dependencies to match core package version bump (0.21.0) ([#8626](https://github.com/mastra-ai/mastra/pull/8626))

- Update peer dependencies to match core package version bump (0.21.0) ([#8686](https://github.com/mastra-ai/mastra/pull/8686))

- Updated dependencies [[`b5a66b7`](https://github.com/mastra-ai/mastra/commit/b5a66b748a14fc8b3f63b04642ddb9621fbcc9e0), [`7b1ef57`](https://github.com/mastra-ai/mastra/commit/7b1ef57fc071c2aa2a2e32905b18cd88719c5a39), [`ee68e82`](https://github.com/mastra-ai/mastra/commit/ee68e8289ea4408d29849e899bc6e78b3bd4e843), [`228228b`](https://github.com/mastra-ai/mastra/commit/228228b0b1de9291cb8887587f5cea1a8757ebad), [`ea33930`](https://github.com/mastra-ai/mastra/commit/ea339301e82d6318257720d811b043014ee44064), [`b5a66b7`](https://github.com/mastra-ai/mastra/commit/b5a66b748a14fc8b3f63b04642ddb9621fbcc9e0), [`135d6f2`](https://github.com/mastra-ai/mastra/commit/135d6f22a326ed1dffff858700669dff09d2c9eb), [`59d036d`](https://github.com/mastra-ai/mastra/commit/59d036d4c2706b430b0e3f1f1e0ee853ce16ca04)]:
  - @mastra/core@0.21.0-alpha.0

## 0.14.4

### Patch Changes

- Breaking change to move the agent.streamVNext/generateVNext implementation to the default stream/generate. The old stream/generate have now been moved to streamLegacy and generateLegacy ([#8097](https://github.com/mastra-ai/mastra/pull/8097))

- Updated dependencies [[`00cb6bd`](https://github.com/mastra-ai/mastra/commit/00cb6bdf78737c0fac14a5a0c7b532a11e38558a), [`869ba22`](https://github.com/mastra-ai/mastra/commit/869ba222e1d6b58fc1b65e7c9fd55ca4e01b8c2f), [`1b73665`](https://github.com/mastra-ai/mastra/commit/1b73665e8e23f5c09d49fcf3e7d709c75259259e), [`f7d7475`](https://github.com/mastra-ai/mastra/commit/f7d747507341aef60ed39e4b49318db1f86034a6), [`084b77b`](https://github.com/mastra-ai/mastra/commit/084b77b2955960e0190af8db3f77138aa83ed65c), [`a93ff84`](https://github.com/mastra-ai/mastra/commit/a93ff84b5e1af07ee236ac8873dac9b49aa5d501), [`bc5aacb`](https://github.com/mastra-ai/mastra/commit/bc5aacb646d468d325327e36117129f28cd13bf6), [`6b5af12`](https://github.com/mastra-ai/mastra/commit/6b5af12ce9e09066e0c32e821c203a6954498bea), [`bf60e4a`](https://github.com/mastra-ai/mastra/commit/bf60e4a89c515afd9570b7b79f33b95e7d07c397), [`d41aee5`](https://github.com/mastra-ai/mastra/commit/d41aee526d124e35f42720a08e64043229193679), [`e8fe13c`](https://github.com/mastra-ai/mastra/commit/e8fe13c4b4c255a42520127797ec394310f7c919), [`3ca833d`](https://github.com/mastra-ai/mastra/commit/3ca833dc994c38e3c9b4f9b4478a61cd8e07b32a), [`1edb8d1`](https://github.com/mastra-ai/mastra/commit/1edb8d1cfb963e72a12412990fb9170936c9904c), [`fbf6e32`](https://github.com/mastra-ai/mastra/commit/fbf6e324946332d0f5ed8930bf9d4d4479cefd7a), [`4753027`](https://github.com/mastra-ai/mastra/commit/4753027ee889288775c6958bdfeda03ff909af67)]:
  - @mastra/core@0.20.0

## 0.14.4-alpha.0

### Patch Changes

- Breaking change to move the agent.streamVNext/generateVNext implementation to the default stream/generate. The old stream/generate have now been moved to streamLegacy and generateLegacy ([#8097](https://github.com/mastra-ai/mastra/pull/8097))

- Updated dependencies [[`00cb6bd`](https://github.com/mastra-ai/mastra/commit/00cb6bdf78737c0fac14a5a0c7b532a11e38558a), [`869ba22`](https://github.com/mastra-ai/mastra/commit/869ba222e1d6b58fc1b65e7c9fd55ca4e01b8c2f), [`1b73665`](https://github.com/mastra-ai/mastra/commit/1b73665e8e23f5c09d49fcf3e7d709c75259259e), [`f7d7475`](https://github.com/mastra-ai/mastra/commit/f7d747507341aef60ed39e4b49318db1f86034a6), [`084b77b`](https://github.com/mastra-ai/mastra/commit/084b77b2955960e0190af8db3f77138aa83ed65c), [`a93ff84`](https://github.com/mastra-ai/mastra/commit/a93ff84b5e1af07ee236ac8873dac9b49aa5d501), [`bc5aacb`](https://github.com/mastra-ai/mastra/commit/bc5aacb646d468d325327e36117129f28cd13bf6), [`6b5af12`](https://github.com/mastra-ai/mastra/commit/6b5af12ce9e09066e0c32e821c203a6954498bea), [`bf60e4a`](https://github.com/mastra-ai/mastra/commit/bf60e4a89c515afd9570b7b79f33b95e7d07c397), [`d41aee5`](https://github.com/mastra-ai/mastra/commit/d41aee526d124e35f42720a08e64043229193679), [`e8fe13c`](https://github.com/mastra-ai/mastra/commit/e8fe13c4b4c255a42520127797ec394310f7c919), [`3ca833d`](https://github.com/mastra-ai/mastra/commit/3ca833dc994c38e3c9b4f9b4478a61cd8e07b32a), [`1edb8d1`](https://github.com/mastra-ai/mastra/commit/1edb8d1cfb963e72a12412990fb9170936c9904c), [`fbf6e32`](https://github.com/mastra-ai/mastra/commit/fbf6e324946332d0f5ed8930bf9d4d4479cefd7a), [`4753027`](https://github.com/mastra-ai/mastra/commit/4753027ee889288775c6958bdfeda03ff909af67)]:
  - @mastra/core@0.20.0-alpha.0

## 0.14.3

### Patch Changes

- Mongodb support to fetch scores by trace and spanId ([#8154](https://github.com/mastra-ai/mastra/pull/8154))

- Update peer deps ([#8154](https://github.com/mastra-ai/mastra/pull/8154))

- Updated dependencies [[`dc099b4`](https://github.com/mastra-ai/mastra/commit/dc099b40fb31147ba3f362f98d991892033c4c67), [`504438b`](https://github.com/mastra-ai/mastra/commit/504438b961bde211071186bba63a842c4e3db879), [`b342a68`](https://github.com/mastra-ai/mastra/commit/b342a68e1399cf1ece9ba11bda112db89d21118c), [`a7243e2`](https://github.com/mastra-ai/mastra/commit/a7243e2e58762667a6e3921e755e89d6bb0a3282), [`7fceb0a`](https://github.com/mastra-ai/mastra/commit/7fceb0a327d678e812f90f5387c5bc4f38bd039e), [`303a9c0`](https://github.com/mastra-ai/mastra/commit/303a9c0d7dd58795915979f06a0512359e4532fb), [`df64f9e`](https://github.com/mastra-ai/mastra/commit/df64f9ef814916fff9baedd861c988084e7c41de), [`370f8a6`](https://github.com/mastra-ai/mastra/commit/370f8a6480faec70fef18d72e5f7538f27004301), [`809eea0`](https://github.com/mastra-ai/mastra/commit/809eea092fa80c3f69b9eaf078d843b57fd2a88e), [`683e5a1`](https://github.com/mastra-ai/mastra/commit/683e5a1466e48b686825b2c11f84680f296138e4), [`3679378`](https://github.com/mastra-ai/mastra/commit/3679378673350aa314741dc826f837b1984149bc), [`7775bc2`](https://github.com/mastra-ai/mastra/commit/7775bc20bb1ad1ab24797fb420e4f96c65b0d8ec), [`623ffaf`](https://github.com/mastra-ai/mastra/commit/623ffaf2d969e11e99a0224633cf7b5a0815c857), [`9fc1613`](https://github.com/mastra-ai/mastra/commit/9fc16136400186648880fd990119ac15f7c02ee4), [`61f62aa`](https://github.com/mastra-ai/mastra/commit/61f62aa31bc88fe4ddf8da6240dbcfbeb07358bd), [`db1891a`](https://github.com/mastra-ai/mastra/commit/db1891a4707443720b7cd8a260dc7e1d49b3609c), [`e8f379d`](https://github.com/mastra-ai/mastra/commit/e8f379d390efa264c4e0874f9ac0cf8839b07777), [`652066b`](https://github.com/mastra-ai/mastra/commit/652066bd1efc6bb6813ba950ed1d7573e8b7d9d4), [`3e292ba`](https://github.com/mastra-ai/mastra/commit/3e292ba00837886d5d68a34cbc0d9b703c991883), [`418c136`](https://github.com/mastra-ai/mastra/commit/418c1366843d88e491bca3f87763899ce855ca29), [`ea8d386`](https://github.com/mastra-ai/mastra/commit/ea8d386cd8c5593664515fd5770c06bf2aa980ef), [`67b0f00`](https://github.com/mastra-ai/mastra/commit/67b0f005b520335c71fb85cbaa25df4ce8484a81), [`c2a4919`](https://github.com/mastra-ai/mastra/commit/c2a4919ba6797d8bdb1509e02287496eef69303e), [`c84b7d0`](https://github.com/mastra-ai/mastra/commit/c84b7d093c4657772140cbfd2b15ef72f3315ed5), [`0130986`](https://github.com/mastra-ai/mastra/commit/0130986fc62d0edcc626dd593282661dbb9af141)]:
  - @mastra/core@0.19.0

## 0.14.3-alpha.0

### Patch Changes

- Mongodb support to fetch scores by trace and spanId ([#8154](https://github.com/mastra-ai/mastra/pull/8154))

- Update peer deps ([#8154](https://github.com/mastra-ai/mastra/pull/8154))

- Updated dependencies [[`504438b`](https://github.com/mastra-ai/mastra/commit/504438b961bde211071186bba63a842c4e3db879), [`a7243e2`](https://github.com/mastra-ai/mastra/commit/a7243e2e58762667a6e3921e755e89d6bb0a3282), [`7fceb0a`](https://github.com/mastra-ai/mastra/commit/7fceb0a327d678e812f90f5387c5bc4f38bd039e), [`df64f9e`](https://github.com/mastra-ai/mastra/commit/df64f9ef814916fff9baedd861c988084e7c41de), [`809eea0`](https://github.com/mastra-ai/mastra/commit/809eea092fa80c3f69b9eaf078d843b57fd2a88e), [`683e5a1`](https://github.com/mastra-ai/mastra/commit/683e5a1466e48b686825b2c11f84680f296138e4), [`3679378`](https://github.com/mastra-ai/mastra/commit/3679378673350aa314741dc826f837b1984149bc), [`7775bc2`](https://github.com/mastra-ai/mastra/commit/7775bc20bb1ad1ab24797fb420e4f96c65b0d8ec), [`db1891a`](https://github.com/mastra-ai/mastra/commit/db1891a4707443720b7cd8a260dc7e1d49b3609c), [`e8f379d`](https://github.com/mastra-ai/mastra/commit/e8f379d390efa264c4e0874f9ac0cf8839b07777), [`652066b`](https://github.com/mastra-ai/mastra/commit/652066bd1efc6bb6813ba950ed1d7573e8b7d9d4), [`ea8d386`](https://github.com/mastra-ai/mastra/commit/ea8d386cd8c5593664515fd5770c06bf2aa980ef), [`c2a4919`](https://github.com/mastra-ai/mastra/commit/c2a4919ba6797d8bdb1509e02287496eef69303e), [`0130986`](https://github.com/mastra-ai/mastra/commit/0130986fc62d0edcc626dd593282661dbb9af141)]:
  - @mastra/core@0.19.0-alpha.1

## 0.14.2

### Patch Changes

- Update Peerdeps for packages based on core minor bump ([#8025](https://github.com/mastra-ai/mastra/pull/8025))

- Updated dependencies [[`cf34503`](https://github.com/mastra-ai/mastra/commit/cf345031de4e157f29087946449e60b965e9c8a9), [`6b4b1e4`](https://github.com/mastra-ai/mastra/commit/6b4b1e4235428d39e51cbda9832704c0ba70ab32), [`3469fca`](https://github.com/mastra-ai/mastra/commit/3469fca7bb7e5e19369ff9f7044716a5e4b02585), [`a61f23f`](https://github.com/mastra-ai/mastra/commit/a61f23fbbca4b88b763d94f1d784c47895ed72d7), [`4b339b8`](https://github.com/mastra-ai/mastra/commit/4b339b8141c20d6a6d80583c7e8c5c05d8c19492), [`d1dc606`](https://github.com/mastra-ai/mastra/commit/d1dc6067b0557a71190b68d56ee15b48c26d2411), [`c45298a`](https://github.com/mastra-ai/mastra/commit/c45298a0a0791db35cf79f1199d77004da0704cb), [`c4a8204`](https://github.com/mastra-ai/mastra/commit/c4a82046bfd241d6044e234bc5917d5a01fe6b55), [`d3bd4d4`](https://github.com/mastra-ai/mastra/commit/d3bd4d482a685bbb67bfa89be91c90dca3fa71ad), [`c591dfc`](https://github.com/mastra-ai/mastra/commit/c591dfc1e600fae1dedffe239357d250e146378f), [`1920c5c`](https://github.com/mastra-ai/mastra/commit/1920c5c6d666f687785c73021196aa551e579e0d), [`b6a3b65`](https://github.com/mastra-ai/mastra/commit/b6a3b65d830fa0ca7754ad6481661d1f2c878f21), [`af3abb6`](https://github.com/mastra-ai/mastra/commit/af3abb6f7c7585d856e22d27f4e7d2ece2186b9a)]:
  - @mastra/core@0.18.0

## 0.14.2-alpha.0

### Patch Changes

- Update Peerdeps for packages based on core minor bump ([#8025](https://github.com/mastra-ai/mastra/pull/8025))

- Updated dependencies [[`cf34503`](https://github.com/mastra-ai/mastra/commit/cf345031de4e157f29087946449e60b965e9c8a9), [`6b4b1e4`](https://github.com/mastra-ai/mastra/commit/6b4b1e4235428d39e51cbda9832704c0ba70ab32), [`3469fca`](https://github.com/mastra-ai/mastra/commit/3469fca7bb7e5e19369ff9f7044716a5e4b02585), [`c4a8204`](https://github.com/mastra-ai/mastra/commit/c4a82046bfd241d6044e234bc5917d5a01fe6b55)]:
  - @mastra/core@0.18.0-alpha.2

## 0.14.1

### Patch Changes

- Update peerdep of @mastra/core ([#7619](https://github.com/mastra-ai/mastra/pull/7619))

- Add resource id to workflow run snapshots ([#7740](https://github.com/mastra-ai/mastra/pull/7740))

- Updated dependencies [[`197cbb2`](https://github.com/mastra-ai/mastra/commit/197cbb248fc8cb4bbf61bf70b770f1388b445df2), [`a1bb887`](https://github.com/mastra-ai/mastra/commit/a1bb887e8bfae44230f487648da72e96ef824561), [`6590763`](https://github.com/mastra-ai/mastra/commit/65907630ef4bf4127067cecd1cb21b56f55d5f1b), [`fb84c21`](https://github.com/mastra-ai/mastra/commit/fb84c21859d09bdc8f158bd5412bdc4b5835a61c), [`5802bf5`](https://github.com/mastra-ai/mastra/commit/5802bf57f6182e4b67c28d7d91abed349a8d14f3), [`5bda53a`](https://github.com/mastra-ai/mastra/commit/5bda53a9747bfa7d876d754fc92c83a06e503f62), [`c2eade3`](https://github.com/mastra-ai/mastra/commit/c2eade3508ef309662f065e5f340d7840295dd53), [`f26a8fd`](https://github.com/mastra-ai/mastra/commit/f26a8fd99fcb0497a5d86c28324430d7f6a5fb83), [`222965a`](https://github.com/mastra-ai/mastra/commit/222965a98ce8197b86673ec594244650b5960257), [`6047778`](https://github.com/mastra-ai/mastra/commit/6047778e501df460648f31decddf8e443f36e373), [`a0f5f1c`](https://github.com/mastra-ai/mastra/commit/a0f5f1ca39c3c5c6d26202e9fcab986b4fe14568), [`9d4fc09`](https://github.com/mastra-ai/mastra/commit/9d4fc09b2ad55caa7738c7ceb3a905e454f74cdd), [`05c7abf`](https://github.com/mastra-ai/mastra/commit/05c7abfe105a015b7760c9bf33ff4419727502a0), [`0324ceb`](https://github.com/mastra-ai/mastra/commit/0324ceb8af9d16c12a531f90e575f6aab797ac81), [`d75ccf0`](https://github.com/mastra-ai/mastra/commit/d75ccf06dfd2582b916aa12624e3cd61b279edf1), [`0f9d227`](https://github.com/mastra-ai/mastra/commit/0f9d227890a98db33865abbea39daf407cd55ef7), [`b356f5f`](https://github.com/mastra-ai/mastra/commit/b356f5f7566cb3edb755d91f00b72fc1420b2a37), [`de056a0`](https://github.com/mastra-ai/mastra/commit/de056a02cbb43f6aa0380ab2150ea404af9ec0dd), [`f5ce05f`](https://github.com/mastra-ai/mastra/commit/f5ce05f831d42c69559bf4c0fdb46ccb920fc3a3), [`60c9cec`](https://github.com/mastra-ai/mastra/commit/60c9cec7048a79a87440f7840c383875bd710d93), [`c93532a`](https://github.com/mastra-ai/mastra/commit/c93532a340b80e4dd946d4c138d9381de5f70399), [`6cb1fcb`](https://github.com/mastra-ai/mastra/commit/6cb1fcbc8d0378ffed0d17784c96e68f30cb0272), [`aee4f00`](https://github.com/mastra-ai/mastra/commit/aee4f00e61e1a42e81a6d74ff149dbe69e32695a), [`9f6f30f`](https://github.com/mastra-ai/mastra/commit/9f6f30f04ec6648bbca798ea8aad59317c40d8db), [`547c621`](https://github.com/mastra-ai/mastra/commit/547c62104af3f7a551b3754e9cbdf0a3fbba15e4), [`897995e`](https://github.com/mastra-ai/mastra/commit/897995e630d572fe2891e7ede817938cabb43251), [`0fed8f2`](https://github.com/mastra-ai/mastra/commit/0fed8f2aa84b167b3415ea6f8f70755775132c8d), [`4f9ea8c`](https://github.com/mastra-ai/mastra/commit/4f9ea8c95ea74ba9abbf3b2ab6106c7d7bc45689), [`1a1fbe6`](https://github.com/mastra-ai/mastra/commit/1a1fbe66efb7d94abc373ed0dd9676adb8122454), [`d706fad`](https://github.com/mastra-ai/mastra/commit/d706fad6e6e4b72357b18d229ba38e6c913c0e70), [`87fd07f`](https://github.com/mastra-ai/mastra/commit/87fd07ff35387a38728967163460231b5d33ae3b), [`5c3768f`](https://github.com/mastra-ai/mastra/commit/5c3768fa959454232ad76715c381f4aac00c6881), [`2685a78`](https://github.com/mastra-ai/mastra/commit/2685a78f224b8b04e20d4fab5ac1adb638190071), [`36f39c0`](https://github.com/mastra-ai/mastra/commit/36f39c00dc794952dc3c11aab91c2fa8bca74b11), [`239b5a4`](https://github.com/mastra-ai/mastra/commit/239b5a497aeae2e8b4d764f46217cfff2284788e), [`8a3f5e4`](https://github.com/mastra-ai/mastra/commit/8a3f5e4212ec36b302957deb4bd47005ab598382)]:
  - @mastra/core@0.17.0

## 0.14.1-alpha.1

### Patch Changes

- Update peerdep of @mastra/core ([#7619](https://github.com/mastra-ai/mastra/pull/7619))

- Updated dependencies [[`a1bb887`](https://github.com/mastra-ai/mastra/commit/a1bb887e8bfae44230f487648da72e96ef824561), [`a0f5f1c`](https://github.com/mastra-ai/mastra/commit/a0f5f1ca39c3c5c6d26202e9fcab986b4fe14568), [`b356f5f`](https://github.com/mastra-ai/mastra/commit/b356f5f7566cb3edb755d91f00b72fc1420b2a37), [`f5ce05f`](https://github.com/mastra-ai/mastra/commit/f5ce05f831d42c69559bf4c0fdb46ccb920fc3a3), [`9f6f30f`](https://github.com/mastra-ai/mastra/commit/9f6f30f04ec6648bbca798ea8aad59317c40d8db), [`d706fad`](https://github.com/mastra-ai/mastra/commit/d706fad6e6e4b72357b18d229ba38e6c913c0e70), [`5c3768f`](https://github.com/mastra-ai/mastra/commit/5c3768fa959454232ad76715c381f4aac00c6881), [`8a3f5e4`](https://github.com/mastra-ai/mastra/commit/8a3f5e4212ec36b302957deb4bd47005ab598382)]:
  - @mastra/core@0.17.0-alpha.3

## 0.14.1-alpha.0

### Patch Changes

- Add resource id to workflow run snapshots ([#7740](https://github.com/mastra-ai/mastra/pull/7740))

- Updated dependencies [[`547c621`](https://github.com/mastra-ai/mastra/commit/547c62104af3f7a551b3754e9cbdf0a3fbba15e4)]:
  - @mastra/core@0.16.4-alpha.1

## 0.14.0

### Minor Changes

- 376913a: Update peerdeps of @mastra/core

### Patch Changes

- 6f5eb7a: Throw if an empty or whitespace-only threadId is passed when getting messages
- Updated dependencies [8fbf79e]
- Updated dependencies [fd83526]
- Updated dependencies [d0b90ab]
- Updated dependencies [6f5eb7a]
- Updated dependencies [a01cf14]
- Updated dependencies [a9e50ee]
- Updated dependencies [5397eb4]
- Updated dependencies [c9f4e4a]
- Updated dependencies [0acbc80]
  - @mastra/core@0.16.0

## 0.14.0-alpha.1

### Minor Changes

- 376913a: Update peerdeps of @mastra/core

### Patch Changes

- Updated dependencies [8fbf79e]
  - @mastra/core@0.16.0-alpha.1

## 0.13.7-alpha.0

### Patch Changes

- 6f5eb7a: Throw if an empty or whitespace-only threadId is passed when getting messages
- Updated dependencies [fd83526]
- Updated dependencies [d0b90ab]
- Updated dependencies [6f5eb7a]
- Updated dependencies [a01cf14]
- Updated dependencies [a9e50ee]
- Updated dependencies [5397eb4]
- Updated dependencies [c9f4e4a]
- Updated dependencies [0acbc80]
  - @mastra/core@0.16.0-alpha.0

## 0.13.6

### Patch Changes

- de3cbc6: Update the `package.json` file to include additional fields like `repository`, `homepage` or `files`.
- f0dfcac: updated core peerdep
- Updated dependencies [ab48c97]
- Updated dependencies [85ef90b]
- Updated dependencies [aedbbfa]
- Updated dependencies [ff89505]
- Updated dependencies [637f323]
- Updated dependencies [de3cbc6]
- Updated dependencies [c19bcf7]
- Updated dependencies [4474d04]
- Updated dependencies [183dc95]
- Updated dependencies [a1111e2]
- Updated dependencies [b42a961]
- Updated dependencies [61debef]
- Updated dependencies [9beaeff]
- Updated dependencies [29de0e1]
- Updated dependencies [f643c65]
- Updated dependencies [00c74e7]
- Updated dependencies [fef7375]
- Updated dependencies [e3d8fea]
- Updated dependencies [45e4d39]
- Updated dependencies [9eee594]
- Updated dependencies [7149d8d]
- Updated dependencies [822c2e8]
- Updated dependencies [979912c]
- Updated dependencies [7dcf4c0]
- Updated dependencies [4106a58]
- Updated dependencies [ad78bfc]
- Updated dependencies [0302f50]
- Updated dependencies [6ac697e]
- Updated dependencies [74db265]
- Updated dependencies [0ce418a]
- Updated dependencies [af90672]
- Updated dependencies [8387952]
- Updated dependencies [7f3b8da]
- Updated dependencies [905352b]
- Updated dependencies [599d04c]
- Updated dependencies [56041d0]
- Updated dependencies [3412597]
- Updated dependencies [5eca5d2]
- Updated dependencies [f2cda47]
- Updated dependencies [5de1555]
- Updated dependencies [cfd377a]
- Updated dependencies [1ed5a3e]
  - @mastra/core@0.15.3

## 0.13.6-alpha.1

### Patch Changes

- [#7394](https://github.com/mastra-ai/mastra/pull/7394) [`f0dfcac`](https://github.com/mastra-ai/mastra/commit/f0dfcac4458bdf789b975e2d63e984f5d1e7c4d3) Thanks [@NikAiyer](https://github.com/NikAiyer)! - updated core peerdep

- Updated dependencies [[`7149d8d`](https://github.com/mastra-ai/mastra/commit/7149d8d4bdc1edf0008e0ca9b7925eb0b8b60dbe)]:
  - @mastra/core@0.15.3-alpha.7

## 0.13.6-alpha.0

### Patch Changes

- [#7343](https://github.com/mastra-ai/mastra/pull/7343) [`de3cbc6`](https://github.com/mastra-ai/mastra/commit/de3cbc61079211431bd30487982ea3653517278e) Thanks [@LekoArts](https://github.com/LekoArts)! - Update the `package.json` file to include additional fields like `repository`, `homepage` or `files`.

- Updated dependencies [[`85ef90b`](https://github.com/mastra-ai/mastra/commit/85ef90bb2cd4ae4df855c7ac175f7d392c55c1bf), [`de3cbc6`](https://github.com/mastra-ai/mastra/commit/de3cbc61079211431bd30487982ea3653517278e)]:
  - @mastra/core@0.15.3-alpha.5

## 0.13.5

### Patch Changes

- [`c6113ed`](https://github.com/mastra-ai/mastra/commit/c6113ed7f9df297e130d94436ceee310273d6430) Thanks [@wardpeet](https://github.com/wardpeet)! - Fix peerdpes for @mastra/core

- Updated dependencies []:
  - @mastra/core@0.15.2

## 0.13.4

### Patch Changes

- [`95b2aa9`](https://github.com/mastra-ai/mastra/commit/95b2aa908230919e67efcac0d69005a2d5745298) Thanks [@wardpeet](https://github.com/wardpeet)! - Fix peerdeps @mastra/core

- Updated dependencies []:
  - @mastra/core@0.15.1

## 0.13.3

### Patch Changes

- [#6700](https://github.com/mastra-ai/mastra/pull/6700) [`a5a23d9`](https://github.com/mastra-ai/mastra/commit/a5a23d981920d458dc6078919992a5338931ef02) Thanks [@gpanakkal](https://github.com/gpanakkal)! - Add `getMessagesById` method to `MastraStorage` adapters

- Updated dependencies [[`6e7e120`](https://github.com/mastra-ai/mastra/commit/6e7e1207d6e8d8b838f9024f90bd10df1181ba27), [`0f00e17`](https://github.com/mastra-ai/mastra/commit/0f00e172953ccdccadb35ed3d70f5e4d89115869), [`217cd7a`](https://github.com/mastra-ai/mastra/commit/217cd7a4ce171e9a575c41bb8c83300f4db03236), [`a5a23d9`](https://github.com/mastra-ai/mastra/commit/a5a23d981920d458dc6078919992a5338931ef02)]:
  - @mastra/core@0.14.1

## 0.13.3-alpha.0

### Patch Changes

- [#6700](https://github.com/mastra-ai/mastra/pull/6700) [`a5a23d9`](https://github.com/mastra-ai/mastra/commit/a5a23d981920d458dc6078919992a5338931ef02) Thanks [@gpanakkal](https://github.com/gpanakkal)! - Add `getMessagesById` method to `MastraStorage` adapters

- Updated dependencies [[`6e7e120`](https://github.com/mastra-ai/mastra/commit/6e7e1207d6e8d8b838f9024f90bd10df1181ba27), [`a5a23d9`](https://github.com/mastra-ai/mastra/commit/a5a23d981920d458dc6078919992a5338931ef02)]:
  - @mastra/core@0.14.1-alpha.0

## 0.13.2

### Patch Changes

- 03997ae: Update peerdeps
- Updated dependencies [227c7e6]
- Updated dependencies [12cae67]
- Updated dependencies [fd3a3eb]
- Updated dependencies [6faaee5]
- Updated dependencies [4232b14]
- Updated dependencies [a89de7e]
- Updated dependencies [5a37d0c]
- Updated dependencies [4bde0cb]
- Updated dependencies [cf4f357]
- Updated dependencies [ad888a2]
- Updated dependencies [481751d]
- Updated dependencies [2454423]
- Updated dependencies [194e395]
- Updated dependencies [a722c0b]
- Updated dependencies [c30bca8]
- Updated dependencies [3b5fec7]
- Updated dependencies [a8f129d]
  - @mastra/core@0.14.0

## 0.13.2-alpha.0

### Patch Changes

- 03997ae: Update peerdeps
  - @mastra/core@0.14.0-alpha.7

## 0.13.1

### Patch Changes

- b32c50d: Filter scores by source
- Updated dependencies [d5330bf]
- Updated dependencies [2e74797]
- Updated dependencies [8388649]
- Updated dependencies [a239d41]
- Updated dependencies [dd94a26]
- Updated dependencies [3ba6772]
- Updated dependencies [b5cf2a3]
- Updated dependencies [2fff911]
- Updated dependencies [b32c50d]
- Updated dependencies [63449d0]
- Updated dependencies [121a3f8]
- Updated dependencies [ec510e7]
  - @mastra/core@0.13.2

## 0.13.1-alpha.0

### Patch Changes

- b32c50d: Filter scores by source
- Updated dependencies [d5330bf]
- Updated dependencies [a239d41]
- Updated dependencies [b32c50d]
- Updated dependencies [121a3f8]
- Updated dependencies [ec510e7]
  - @mastra/core@0.13.2-alpha.2

## 0.13.0

### Minor Changes

- ea0c5f2: Add store support to new score api

### Patch Changes

- 494ceac: fix: trace mongo safeparse
- 2871020: update safelyParseJSON to check for value of param when handling parse
- 4a406ec: fixes TypeScript declaration file imports to ensure proper ESM compatibility
- 94baf89: fixed an issue where mongodb vector adapter would not properly use metadata filters
- Updated dependencies [cb36de0]
- Updated dependencies [d0496e6]
- Updated dependencies [a82b851]
- Updated dependencies [ea0c5f2]
- Updated dependencies [41a0a0e]
- Updated dependencies [2871020]
- Updated dependencies [94f4812]
- Updated dependencies [e202b82]
- Updated dependencies [e00f6a0]
- Updated dependencies [4a406ec]
- Updated dependencies [b0e43c1]
- Updated dependencies [5d377e5]
- Updated dependencies [1fb812e]
- Updated dependencies [35c5798]
  - @mastra/core@0.13.0

## 0.13.0-alpha.3

### Patch Changes

- 94baf89: fixed an issue where mongodb vector adapter would not properly use metadata filters

## 0.13.0-alpha.2

### Patch Changes

- 2871020: update safelyParseJSON to check for value of param when handling parse
- 4a406ec: fixes TypeScript declaration file imports to ensure proper ESM compatibility
- Updated dependencies [cb36de0]
- Updated dependencies [a82b851]
- Updated dependencies [41a0a0e]
- Updated dependencies [2871020]
- Updated dependencies [4a406ec]
- Updated dependencies [5d377e5]
  - @mastra/core@0.13.0-alpha.2

## 0.13.0-alpha.1

### Patch Changes

- 494ceac: fix: trace mongo safeparse

## 0.13.0-alpha.0

### Minor Changes

- ea0c5f2: Add store support to new score api

### Patch Changes

- Updated dependencies [ea0c5f2]
- Updated dependencies [b0e43c1]
- Updated dependencies [1fb812e]
- Updated dependencies [35c5798]
  - @mastra/core@0.13.0-alpha.1

## 0.12.4

### Patch Changes

- 2c5eab4: Fix mongodb edge case when fromConnectionHandler is used
- Updated dependencies [33dcb07]
- Updated dependencies [d0d9500]
- Updated dependencies [d30b1a0]
- Updated dependencies [bff87f7]
- Updated dependencies [b4a8df0]
  - @mastra/core@0.12.1

## 0.12.4-alpha.0

### Patch Changes

- 2c5eab4: Fix mongodb edge case when fromConnectionHandler is used
- Updated dependencies [33dcb07]
- Updated dependencies [d30b1a0]
- Updated dependencies [bff87f7]
- Updated dependencies [b4a8df0]
  - @mastra/core@0.12.1-alpha.0

## 0.12.3

### Patch Changes

- 9881232: dependencies updates:
  - Updated dependency [`cloudflare@^4.5.0` ↗︎](https://www.npmjs.com/package/cloudflare/v/4.5.0) (from `^4.4.1`, in `dependencies`)
- eba48c8: Sort getThreads by updatedAt.
- 25f2987: fix: filter.\_id.\$in cannot be empty
- 14456f3: fix: [MongoDB] batchInsert with process json
- b0f1e2f: fix: mongodb save scores as an object
- f42c4c2: update peer deps for packages to latest core range
- Updated dependencies [510e2c8]
- Updated dependencies [2f72fb2]
- Updated dependencies [27cc97a]
- Updated dependencies [3f89307]
- Updated dependencies [9eda7d4]
- Updated dependencies [9d49408]
- Updated dependencies [41daa63]
- Updated dependencies [ad0a58b]
- Updated dependencies [254a36b]
- Updated dependencies [2ecf658]
- Updated dependencies [7a7754f]
- Updated dependencies [fc92d80]
- Updated dependencies [e0f73c6]
- Updated dependencies [0b89602]
- Updated dependencies [4d37822]
- Updated dependencies [23a6a7c]
- Updated dependencies [cda801d]
- Updated dependencies [a77c823]
- Updated dependencies [ff9c125]
- Updated dependencies [09bca64]
- Updated dependencies [b8efbb9]
- Updated dependencies [71466e7]
- Updated dependencies [0c99fbe]
  - @mastra/core@0.12.0

## 0.12.3-alpha.2

### Patch Changes

- f42c4c2: update peer deps for packages to latest core range
  - @mastra/core@0.12.0-alpha.5

## 0.12.3-alpha.1

### Patch Changes

- 9881232: dependencies updates:
  - Updated dependency [`cloudflare@^4.5.0` ↗︎](https://www.npmjs.com/package/cloudflare/v/4.5.0) (from `^4.4.1`, in `dependencies`)
- eba48c8: Sort getThreads by updatedAt.
- 14456f3: fix: [MongoDB] batchInsert with process json
- Updated dependencies [27cc97a]
- Updated dependencies [41daa63]
- Updated dependencies [254a36b]
- Updated dependencies [0b89602]
- Updated dependencies [4d37822]
- Updated dependencies [ff9c125]
- Updated dependencies [b8efbb9]
- Updated dependencies [71466e7]
- Updated dependencies [0c99fbe]
  - @mastra/core@0.12.0-alpha.2

## 0.12.3-alpha.0

### Patch Changes

- 25f2987: fix: filter.\_id.\$in cannot be empty
- b0f1e2f: fix: mongodb save scores as an object
- Updated dependencies [510e2c8]
- Updated dependencies [2f72fb2]
- Updated dependencies [3f89307]
- Updated dependencies [9eda7d4]
- Updated dependencies [9d49408]
- Updated dependencies [2ecf658]
- Updated dependencies [7a7754f]
- Updated dependencies [fc92d80]
- Updated dependencies [23a6a7c]
- Updated dependencies [09bca64]
  - @mastra/core@0.12.0-alpha.0

## 0.12.2

### Patch Changes

- ce088f5: Update all peerdeps to latest core
  - @mastra/core@0.11.1

## 0.12.1

### Patch Changes

- 728b203: feat(mongodb): implement ConnectorHandler interface and MongoDBConnector
- 7ba91fa: Throw mastra errors methods not implemented yet
- 65ab763: Pre-filter on properties when running `MongoDBVector` queries
- Updated dependencies [f248d53]
- Updated dependencies [2affc57]
- Updated dependencies [66e13e3]
- Updated dependencies [edd9482]
- Updated dependencies [18344d7]
- Updated dependencies [9d372c2]
- Updated dependencies [40c2525]
- Updated dependencies [e473f27]
- Updated dependencies [032cb66]
- Updated dependencies [703ac71]
- Updated dependencies [a723d69]
- Updated dependencies [7827943]
- Updated dependencies [5889a31]
- Updated dependencies [bf1e7e7]
- Updated dependencies [65e3395]
- Updated dependencies [4933192]
- Updated dependencies [d1c77a4]
- Updated dependencies [bea9dd1]
- Updated dependencies [dcd4802]
- Updated dependencies [cbddd18]
- Updated dependencies [7ba91fa]
  - @mastra/core@0.11.0

## 0.12.1-alpha.0

### Patch Changes

- 728b203: feat(mongodb): implement ConnectorHandler interface and MongoDBConnector
- 7ba91fa: Throw mastra errors methods not implemented yet
- 65ab763: Pre-filter on properties when running `MongoDBVector` queries
- Updated dependencies [f248d53]
- Updated dependencies [2affc57]
- Updated dependencies [66e13e3]
- Updated dependencies [edd9482]
- Updated dependencies [18344d7]
- Updated dependencies [9d372c2]
- Updated dependencies [40c2525]
- Updated dependencies [e473f27]
- Updated dependencies [032cb66]
- Updated dependencies [703ac71]
- Updated dependencies [a723d69]
- Updated dependencies [5889a31]
- Updated dependencies [65e3395]
- Updated dependencies [4933192]
- Updated dependencies [d1c77a4]
- Updated dependencies [bea9dd1]
- Updated dependencies [dcd4802]
- Updated dependencies [7ba91fa]
  - @mastra/core@0.11.0-alpha.2

## 0.12.0

### Minor Changes

- 8a3bfd2: Update peerdeps to latest core

### Patch Changes

- 8e6b8e5: dependencies updates:
  - Updated dependency [`cloudflare@^4.4.1` ↗︎](https://www.npmjs.com/package/cloudflare/v/4.4.1) (from `^4.3.0`, in `dependencies`)
- a2eceb2: fix: mongo storage trace query
- d8f2d19: Add updateMessages API to storage classes (only support for PG and LibSQL for now) and to memory class. Additionally allow for metadata to be saved in the content field of a message.
- 0fb9d64: [MASTRA-4018] Update saveMessages in storage adapters to upsert messages
- 2097952: [MASTRA-4021] Fix PG getMessages and update messageLimit for all storage adapters
- 870f156: Parse eval result
- 144eb0b: [MASTRA-3669] Metadata Filter Types
- 0e17048: Throw mastra errors in storage packages
- Updated dependencies [15e9d26]
- Updated dependencies [d1baedb]
- Updated dependencies [d8f2d19]
- Updated dependencies [4d21bf2]
- Updated dependencies [07d6d88]
- Updated dependencies [9d52b17]
- Updated dependencies [2097952]
- Updated dependencies [792c4c0]
- Updated dependencies [5d74aab]
- Updated dependencies [a8b194f]
- Updated dependencies [4fb0cc2]
- Updated dependencies [d2a7a31]
- Updated dependencies [502fe05]
- Updated dependencies [144eb0b]
- Updated dependencies [8ba1b51]
- Updated dependencies [4efcfa0]
- Updated dependencies [0e17048]
  - @mastra/core@0.10.7

## 0.12.0-alpha.4

### Patch Changes

- 8e6b8e5: dependencies updates:
  - Updated dependency [`cloudflare@^4.4.1` ↗︎](https://www.npmjs.com/package/cloudflare/v/4.4.1) (from `^4.3.0`, in `dependencies`)

## 0.12.0-alpha.3

### Minor Changes

- 8a3bfd2: Update peerdeps to latest core

### Patch Changes

- Updated dependencies [792c4c0]
- Updated dependencies [502fe05]
- Updated dependencies [4efcfa0]
  - @mastra/core@0.10.7-alpha.3

## 0.11.1-alpha.2

### Patch Changes

- a2eceb2: fix: mongo storage trace query
- 0fb9d64: [MASTRA-4018] Update saveMessages in storage adapters to upsert messages
- 870f156: Parse eval result
- 144eb0b: [MASTRA-3669] Metadata Filter Types
- Updated dependencies [15e9d26]
- Updated dependencies [07d6d88]
- Updated dependencies [5d74aab]
- Updated dependencies [144eb0b]
  - @mastra/core@0.10.7-alpha.2

## 0.11.1-alpha.1

### Patch Changes

- 2097952: [MASTRA-4021] Fix PG getMessages and update messageLimit for all storage adapters
- 0e17048: Throw mastra errors in storage packages
- Updated dependencies [d1baedb]
- Updated dependencies [4d21bf2]
- Updated dependencies [2097952]
- Updated dependencies [4fb0cc2]
- Updated dependencies [d2a7a31]
- Updated dependencies [0e17048]
  - @mastra/core@0.10.7-alpha.1

## 0.11.1-alpha.0

### Patch Changes

- d8f2d19: Add updateMessages API to storage classes (only support for PG and LibSQL for now) and to memory class. Additionally allow for metadata to be saved in the content field of a message.
- Updated dependencies [d8f2d19]
- Updated dependencies [9d52b17]
- Updated dependencies [8ba1b51]
  - @mastra/core@0.10.7-alpha.0

## 0.11.0

### Minor Changes

- 704d1ca: Thread Timestamp Auto-Update Enhancement
  Added automatic thread updatedAt timestamp updates when messages are saved across all storage providers
  Enhanced user experience: Threads now accurately reflect their latest activity with automatic timestamp updates when new messages are added
  Universal implementation: Consistent behavior across all 7 storage backends (ClickHouse, Cloudflare D1, DynamoDB, MongoDB, PostgreSQL, Upstash, LibSQL)
  Performance optimized: Updates execute in parallel with message saving operations for minimal performance impact
  Backwards compatible: No breaking changes - existing code continues to work unchanged
  Improved conversation ordering: Chat interfaces can now properly sort threads by actual last activity
  This enhancement resolves the issue where active conversations appeared stale due to outdated thread timestamps, providing better conversation management and user experience in chat applications.

### Patch Changes

- 63f6b7d: dependencies updates:
  - Updated dependency [`cloudflare@^4.3.0` ↗︎](https://www.npmjs.com/package/cloudflare/v/4.3.0) (from `^4.1.0`, in `dependencies`)
  - Updated dependency [`mongodb@^6.17.0` ↗︎](https://www.npmjs.com/package/mongodb/v/6.17.0) (from `^6.15.0`, in `dependencies`)
- Updated dependencies [63f6b7d]
- Updated dependencies [12a95fc]
- Updated dependencies [4b0f8a6]
- Updated dependencies [51264a5]
- Updated dependencies [8e6f677]
- Updated dependencies [d70c420]
- Updated dependencies [ee9af57]
- Updated dependencies [36f1c36]
- Updated dependencies [2a16996]
- Updated dependencies [10d352e]
- Updated dependencies [9589624]
- Updated dependencies [53d3c37]
- Updated dependencies [751c894]
- Updated dependencies [577ce3a]
- Updated dependencies [9260b3a]
  - @mastra/core@0.10.6

## 0.11.0-alpha.1

### Minor Changes

- 704d1ca: Thread Timestamp Auto-Update Enhancement
  Added automatic thread updatedAt timestamp updates when messages are saved across all storage providers
  Enhanced user experience: Threads now accurately reflect their latest activity with automatic timestamp updates when new messages are added
  Universal implementation: Consistent behavior across all 7 storage backends (ClickHouse, Cloudflare D1, DynamoDB, MongoDB, PostgreSQL, Upstash, LibSQL)
  Performance optimized: Updates execute in parallel with message saving operations for minimal performance impact
  Backwards compatible: No breaking changes - existing code continues to work unchanged
  Improved conversation ordering: Chat interfaces can now properly sort threads by actual last activity
  This enhancement resolves the issue where active conversations appeared stale due to outdated thread timestamps, providing better conversation management and user experience in chat applications.

## 0.10.4-alpha.0

### Patch Changes

- 63f6b7d: dependencies updates:
  - Updated dependency [`cloudflare@^4.3.0` ↗︎](https://www.npmjs.com/package/cloudflare/v/4.3.0) (from `^4.1.0`, in `dependencies`)
  - Updated dependency [`mongodb@^6.17.0` ↗︎](https://www.npmjs.com/package/mongodb/v/6.17.0) (from `^6.15.0`, in `dependencies`)
- Updated dependencies [63f6b7d]
- Updated dependencies [36f1c36]
- Updated dependencies [10d352e]
- Updated dependencies [53d3c37]
  - @mastra/core@0.10.6-alpha.0

## 0.10.3

### Patch Changes

- dffb67b: updated stores to add alter table and change tests
- 925ab94: added paginated functions to base class and added boilerplate and updated imports
- e030ea3: Added missing format compatibility to MongoDB getMessages() method
- 66f4424: Update peerdeps
- Updated dependencies [d1ed912]
- Updated dependencies [f6fd25f]
- Updated dependencies [dffb67b]
- Updated dependencies [f1f1f1b]
- Updated dependencies [925ab94]
- Updated dependencies [f9816ae]
- Updated dependencies [82090c1]
- Updated dependencies [1b443fd]
- Updated dependencies [ce97900]
- Updated dependencies [f1309d3]
- Updated dependencies [14a2566]
- Updated dependencies [f7f8293]
- Updated dependencies [48eddb9]
  - @mastra/core@0.10.4

## 0.10.3-alpha.2

### Patch Changes

- 66f4424: Update peerdeps

## 0.10.3-alpha.1

### Patch Changes

- 925ab94: added paginated functions to base class and added boilerplate and updated imports
- Updated dependencies [925ab94]
  - @mastra/core@0.10.4-alpha.3

## 0.10.3-alpha.0

### Patch Changes

- dffb67b: updated stores to add alter table and change tests
- e030ea3: Added missing format compatibility to MongoDB getMessages() method
- Updated dependencies [f6fd25f]
- Updated dependencies [dffb67b]
- Updated dependencies [f1309d3]
- Updated dependencies [f7f8293]
  - @mastra/core@0.10.4-alpha.1

## 0.10.2

### Patch Changes

- c5bf1ce: Add backwards compat code for new MessageList in storage
- f0d559f: Fix peerdeps for alpha channel
- Updated dependencies [ee77e78]
- Updated dependencies [592a2db]
- Updated dependencies [e5dc18d]
- Updated dependencies [ab5adbe]
- Updated dependencies [1e8bb40]
- Updated dependencies [1b5fc55]
- Updated dependencies [195c428]
- Updated dependencies [f73e11b]
- Updated dependencies [37643b8]
- Updated dependencies [99fd6cf]
- Updated dependencies [c5bf1ce]
- Updated dependencies [add596e]
- Updated dependencies [8dc94d8]
- Updated dependencies [ecebbeb]
- Updated dependencies [79d5145]
- Updated dependencies [12b7002]
- Updated dependencies [2901125]
  - @mastra/core@0.10.2

## 0.10.2-alpha.1

### Patch Changes

- c5bf1ce: Add backwards compat code for new MessageList in storage
- Updated dependencies [c5bf1ce]
- Updated dependencies [12b7002]
  - @mastra/core@0.10.2-alpha.4

## 0.10.2-alpha.0

### Patch Changes

- f0d559f: Fix peerdeps for alpha channel
- Updated dependencies [1e8bb40]
  - @mastra/core@0.10.2-alpha.2

## 0.10.1

### Patch Changes

- 4a8cd1c: MongoDBStore option support
- fcc915f: Support MongoDB database as store
- Updated dependencies [d70b807]
- Updated dependencies [6d16390]
- Updated dependencies [1e4a421]
- Updated dependencies [200d0da]
- Updated dependencies [bf5f17b]
- Updated dependencies [5343f93]
- Updated dependencies [38aee50]
- Updated dependencies [5c41100]
- Updated dependencies [d6a759b]
- Updated dependencies [6015bdf]
  - @mastra/core@0.10.1

## 0.10.1-alpha.1

### Patch Changes

- 4a8cd1c: MongoDBStore option support
- Updated dependencies [200d0da]
- Updated dependencies [bf5f17b]
- Updated dependencies [5343f93]
- Updated dependencies [38aee50]
- Updated dependencies [5c41100]
- Updated dependencies [d6a759b]
  - @mastra/core@0.10.1-alpha.1

## 0.10.1-alpha.0

### Patch Changes

- fcc915f: Support MongoDB database as store
- Updated dependencies [6d16390]
- Updated dependencies [1e4a421]
  - @mastra/core@0.10.1-alpha.0

## 0.10.0

### Minor Changes

- 83da932: Move @mastra/core to peerdeps

### Patch Changes

- d0ee3c6: Change all public functions and constructors in vector stores to use named args and prepare to phase out positional args
- a7292b0: BREAKING(@mastra/core, all vector stores): Vector store breaking changes (remove deprecated functions and positional arguments)
- Updated dependencies [b3a3d63]
- Updated dependencies [344f453]
- Updated dependencies [0a3ae6d]
- Updated dependencies [95911be]
- Updated dependencies [f53a6ac]
- Updated dependencies [5eb5a99]
- Updated dependencies [7e632c5]
- Updated dependencies [1e9fbfa]
- Updated dependencies [eabdcd9]
- Updated dependencies [90be034]
- Updated dependencies [99f050a]
- Updated dependencies [d0ee3c6]
- Updated dependencies [b2ae5aa]
- Updated dependencies [23f258c]
- Updated dependencies [a7292b0]
- Updated dependencies [0dcb9f0]
- Updated dependencies [2672a05]
  - @mastra/core@0.10.0

## 0.1.0-alpha.1

### Minor Changes

- 83da932: Move @mastra/core to peerdeps

### Patch Changes

- a7292b0: BREAKING(@mastra/core, all vector stores): Vector store breaking changes (remove deprecated functions and positional arguments)
- Updated dependencies [b3a3d63]
- Updated dependencies [344f453]
- Updated dependencies [0a3ae6d]
- Updated dependencies [95911be]
- Updated dependencies [5eb5a99]
- Updated dependencies [7e632c5]
- Updated dependencies [1e9fbfa]
- Updated dependencies [b2ae5aa]
- Updated dependencies [a7292b0]
- Updated dependencies [0dcb9f0]
  - @mastra/core@0.10.0-alpha.1

## 0.0.6-alpha.0

### Patch Changes

- d0ee3c6: Change all public functions and constructors in vector stores to use named args and prepare to phase out positional args
- Updated dependencies [f53a6ac]
- Updated dependencies [eabdcd9]
- Updated dependencies [90be034]
- Updated dependencies [99f050a]
- Updated dependencies [d0ee3c6]
- Updated dependencies [23f258c]
- Updated dependencies [2672a05]
  - @mastra/core@0.9.5-alpha.0

## 0.0.5

### Patch Changes

- c3bd795: [MASTRA-3358] Deprecate updateIndexById and deleteIndexById
- Updated dependencies [396be50]
- Updated dependencies [ab80e7e]
- Updated dependencies [c3bd795]
- Updated dependencies [da082f8]
- Updated dependencies [a5810ce]
- Updated dependencies [3e9c131]
- Updated dependencies [3171b5b]
- Updated dependencies [973e5ac]
- Updated dependencies [daf942f]
- Updated dependencies [0b8b868]
- Updated dependencies [9e1eff5]
- Updated dependencies [6fa1ad1]
- Updated dependencies [c28d7a0]
- Updated dependencies [edf1e88]
  - @mastra/core@0.9.4

## 0.0.5-alpha.4

### Patch Changes

- Updated dependencies [3e9c131]
  - @mastra/core@0.9.4-alpha.4

## 0.0.5-alpha.3

### Patch Changes

- c3bd795: [MASTRA-3358] Deprecate updateIndexById and deleteIndexById
- Updated dependencies [396be50]
- Updated dependencies [c3bd795]
- Updated dependencies [da082f8]
- Updated dependencies [a5810ce]
  - @mastra/core@0.9.4-alpha.3

## 0.0.5-alpha.2

### Patch Changes

- Updated dependencies [3171b5b]
- Updated dependencies [973e5ac]
- Updated dependencies [9e1eff5]
  - @mastra/core@0.9.4-alpha.2

## 0.0.5-alpha.1

### Patch Changes

- Updated dependencies [ab80e7e]
- Updated dependencies [6fa1ad1]
- Updated dependencies [c28d7a0]
- Updated dependencies [edf1e88]
  - @mastra/core@0.9.4-alpha.1

## 0.0.5-alpha.0

### Patch Changes

- Updated dependencies [daf942f]
- Updated dependencies [0b8b868]
  - @mastra/core@0.9.4-alpha.0

## 0.0.4

### Patch Changes

- Updated dependencies [e450778]
- Updated dependencies [8902157]
- Updated dependencies [ca0dc88]
- Updated dependencies [526c570]
- Updated dependencies [d7a6a33]
- Updated dependencies [9cd1a46]
- Updated dependencies [b5d2de0]
- Updated dependencies [644f8ad]
- Updated dependencies [70dbf51]
  - @mastra/core@0.9.3

## 0.0.4-alpha.1

### Patch Changes

- Updated dependencies [e450778]
- Updated dependencies [8902157]
- Updated dependencies [ca0dc88]
- Updated dependencies [9cd1a46]
- Updated dependencies [70dbf51]
  - @mastra/core@0.9.3-alpha.1

## 0.0.4-alpha.0

### Patch Changes

- Updated dependencies [526c570]
- Updated dependencies [b5d2de0]
- Updated dependencies [644f8ad]
  - @mastra/core@0.9.3-alpha.0

## 0.0.3

### Patch Changes

- Updated dependencies [6052aa6]
- Updated dependencies [967b41c]
- Updated dependencies [3d2fb5c]
- Updated dependencies [26738f4]
- Updated dependencies [4155f47]
- Updated dependencies [7eeb2bc]
- Updated dependencies [b804723]
- Updated dependencies [8607972]
- Updated dependencies [ccef9f9]
- Updated dependencies [0097d50]
- Updated dependencies [7eeb2bc]
- Updated dependencies [17826a9]
- Updated dependencies [7d8b7c7]
- Updated dependencies [fba031f]
- Updated dependencies [3a5f1e1]
- Updated dependencies [51e6923]
- Updated dependencies [8398d89]
  - @mastra/core@0.9.2

## 0.0.3-alpha.6

### Patch Changes

- Updated dependencies [6052aa6]
- Updated dependencies [7d8b7c7]
- Updated dependencies [3a5f1e1]
- Updated dependencies [8398d89]
  - @mastra/core@0.9.2-alpha.6

## 0.0.3-alpha.5

### Patch Changes

- Updated dependencies [3d2fb5c]
- Updated dependencies [7eeb2bc]
- Updated dependencies [8607972]
- Updated dependencies [7eeb2bc]
- Updated dependencies [fba031f]
  - @mastra/core@0.9.2-alpha.5

## 0.0.3-alpha.4

### Patch Changes

- Updated dependencies [ccef9f9]
- Updated dependencies [51e6923]
  - @mastra/core@0.9.2-alpha.4

## 0.0.3-alpha.3

### Patch Changes

- Updated dependencies [967b41c]
- Updated dependencies [4155f47]
- Updated dependencies [17826a9]
  - @mastra/core@0.9.2-alpha.3

## 0.0.3-alpha.2

### Patch Changes

- Updated dependencies [26738f4]
  - @mastra/core@0.9.2-alpha.2

## 0.0.3-alpha.1

### Patch Changes

- Updated dependencies [b804723]
  - @mastra/core@0.9.2-alpha.1

## 0.0.3-alpha.0

### Patch Changes

- Updated dependencies [0097d50]
  - @mastra/core@0.9.2-alpha.0

## 0.0.2

### Patch Changes

- 5f826d9: Moved vector store specific prompts from @mastra/rag to be exported from the store that the prompt belongs to, ie @mastra/pg
- c4c6f04: added and updated docs for mongodb
- c18f562: MongoDBVector for Vector Database support
- Updated dependencies [405b63d]
- Updated dependencies [81fb7f6]
- Updated dependencies [20275d4]
- Updated dependencies [7d1892c]
- Updated dependencies [a90a082]
- Updated dependencies [2d17c73]
- Updated dependencies [61e92f5]
- Updated dependencies [35955b0]
- Updated dependencies [6262bd5]
- Updated dependencies [c1409ef]
- Updated dependencies [3e7b69d]
- Updated dependencies [e4943b8]
- Updated dependencies [11d4485]
- Updated dependencies [479f490]
- Updated dependencies [c23a81c]
- Updated dependencies [2d4001d]
- Updated dependencies [c71013a]
- Updated dependencies [1d3b1cd]
  - @mastra/core@0.9.1

## 0.0.2-alpha.7

### Patch Changes

- Updated dependencies [2d17c73]
  - @mastra/core@0.9.1-alpha.8

## 0.0.2-alpha.6

### Patch Changes

- Updated dependencies [1d3b1cd]
  - @mastra/core@0.9.1-alpha.7

## 0.0.2-alpha.5

### Patch Changes

- Updated dependencies [c23a81c]
  - @mastra/core@0.9.1-alpha.6

## 0.0.2-alpha.4

### Patch Changes

- 5f826d9: Moved vector store specific prompts from @mastra/rag to be exported from the store that the prompt belongs to, ie @mastra/pg
- Updated dependencies [3e7b69d]
  - @mastra/core@0.9.1-alpha.5

## 0.0.2-alpha.3

### Patch Changes

- Updated dependencies [e4943b8]
- Updated dependencies [479f490]
  - @mastra/core@0.9.1-alpha.4

## 0.0.2-alpha.2

### Patch Changes

- c4c6f04: added and updated docs for mongodb
- Updated dependencies [6262bd5]
  - @mastra/core@0.9.1-alpha.3

## 0.0.2-alpha.1

### Patch Changes

- Updated dependencies [405b63d]
- Updated dependencies [61e92f5]
- Updated dependencies [c71013a]
  - @mastra/core@0.9.1-alpha.2

## 0.0.2-alpha.0

### Patch Changes

- c18f562: MongoDBVector for Vector Database support
- Updated dependencies [20275d4]
- Updated dependencies [7d1892c]
- Updated dependencies [a90a082]
- Updated dependencies [35955b0]
- Updated dependencies [c1409ef]
- Updated dependencies [11d4485]
- Updated dependencies [2d4001d]
  - @mastra/core@0.9.1-alpha.1
