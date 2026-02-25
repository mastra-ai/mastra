# @mastra/playground-ui

## 15.0.0-alpha.0

### Minor Changes

- Update peer dependencies to match core package version bump (1.5.0) ([#13323](https://github.com/mastra-ai/mastra/pull/13323))

### Patch Changes

- Target type and target ID fields in the experiment dialog are now searchable dropdowns. Scorers can be selected via a multi-select dropdown. All three dropdowns share a consistent searchable style and visual behavior. ([#13463](https://github.com/mastra-ai/mastra/pull/13463))

- Show completion result UI for supervisor pattern delegations. Previously, completion check results were only displayed when `metadata.mode === 'network'`. Now they display for any response that includes `completionResult` metadata, supporting the new supervisor pattern. ([#13323](https://github.com/mastra-ai/mastra/pull/13323))

- Updated dependencies [[`df170fd`](https://github.com/mastra-ai/mastra/commit/df170fd139b55f845bfd2de8488b16435bd3d0da), [`ae55343`](https://github.com/mastra-ai/mastra/commit/ae5534397fc006fd6eef3e4f80c235bcdc9289ef), [`c290cec`](https://github.com/mastra-ai/mastra/commit/c290cec5bf9107225de42942b56b487107aa9dce), [`f03e794`](https://github.com/mastra-ai/mastra/commit/f03e794630f812b56e95aad54f7b1993dc003add), [`aa4a5ae`](https://github.com/mastra-ai/mastra/commit/aa4a5aedb80d8d6837bab8cbb2e301215d1ba3e9), [`de3f584`](https://github.com/mastra-ai/mastra/commit/de3f58408752a8d80a295275c7f23fc306cf7f4f), [`d3fb010`](https://github.com/mastra-ai/mastra/commit/d3fb010c98f575f1c0614452667396e2653815f6), [`702ee1c`](https://github.com/mastra-ai/mastra/commit/702ee1c41be67cc532b4dbe89bcb62143508f6f0), [`f495051`](https://github.com/mastra-ai/mastra/commit/f495051eb6496a720f637fc85b6d69941c12554c), [`b8f636a`](https://github.com/mastra-ai/mastra/commit/b8f636a83c5260a9817eec97c202b7ca7d613524), [`e622f1d`](https://github.com/mastra-ai/mastra/commit/e622f1d3ab346a8e6aca6d1fe2eac99bd961e50b), [`8d14a59`](https://github.com/mastra-ai/mastra/commit/8d14a591d46fbbbe81baa33c9c267d596f790329), [`114e7c1`](https://github.com/mastra-ai/mastra/commit/114e7c146ac682925f0fb37376c1be70e5d6e6e5), [`861f111`](https://github.com/mastra-ai/mastra/commit/861f11189211b20ddb70d8df81a6b901fc78d11e), [`00f43e8`](https://github.com/mastra-ai/mastra/commit/00f43e8e97a80c82b27d5bd30494f10a715a1df9), [`1b6f651`](https://github.com/mastra-ai/mastra/commit/1b6f65127d4a0d6c38d0a1055cb84527db529d6b), [`96a1702`](https://github.com/mastra-ai/mastra/commit/96a1702ce362c50dda20c8b4a228b4ad1a36a17a), [`cb9f921`](https://github.com/mastra-ai/mastra/commit/cb9f921320913975657abb1404855d8c510f7ac5), [`114e7c1`](https://github.com/mastra-ai/mastra/commit/114e7c146ac682925f0fb37376c1be70e5d6e6e5), [`114e7c1`](https://github.com/mastra-ai/mastra/commit/114e7c146ac682925f0fb37376c1be70e5d6e6e5), [`114e7c1`](https://github.com/mastra-ai/mastra/commit/114e7c146ac682925f0fb37376c1be70e5d6e6e5), [`1b6f651`](https://github.com/mastra-ai/mastra/commit/1b6f65127d4a0d6c38d0a1055cb84527db529d6b), [`72df4a8`](https://github.com/mastra-ai/mastra/commit/72df4a8f9bf1a20cfd3d9006a4fdb597ad56d10a)]:
  - @mastra/core@1.8.0-alpha.0
  - @mastra/ai-sdk@1.1.0-alpha.0
  - @mastra/schema-compat@1.1.3-alpha.0
  - @mastra/react@0.2.7-alpha.0
  - @mastra/client-js@1.7.1-alpha.0

## 14.0.0

### Minor Changes

- Added prompt block management to the Playground. You can now create, edit, version, and publish reusable prompt blocks from a dedicated "Prompts" tab in the sidebar. ([#13351](https://github.com/mastra-ai/mastra/pull/13351))

  **Prompt block editor features:**
  - Draft/published versioning with version history dropdown
  - Variables editor (JSON schema) for defining template variables
  - Display conditions for conditional block rendering
  - Variable highlighting in the content editor

  **Agent instruction block improvements:**
  - Added support for referencing saved prompt blocks in agent instructions via a new "Reference saved prompt block" option in the add block dropdown
  - Fixed save/publish button behavior — "Save" is now disabled when no changes have been made, and "Publish" is only enabled when there are unpublished drafts

- Added nested folder creation support in the skill tree editor for references and scripts folders ([#13453](https://github.com/mastra-ai/mastra/pull/13453))

- Added new Chip component and expanded ItemList with Cell, LinkCell, IdCell, DateCell, and VersionCell sub-components. Improved dataset version comparison page with inline navigation links, version status indicators, and a refreshed row layout. ([#13399](https://github.com/mastra-ai/mastra/pull/13399))

### Patch Changes

- Improved comparison selection behavior: selecting a third item now replaces the most recent selection instead of being blocked. Applies to dataset version, item version, and dataset item comparison flows. ([#13406](https://github.com/mastra-ai/mastra/pull/13406))

- Improved the score dialog to show "N/A" with an explanation instead of "null" for empty scorer fields. Code-based scorers show "N/A — code-based scorer does not use prompts" and LLM scorers with unconfigured steps show "N/A — step not configured". Detection uses the `hasJudge` metadata flag with a heuristic fallback for older data. ([#13386](https://github.com/mastra-ai/mastra/pull/13386))

- Added workspace tools for background process management and improved sandbox execution UI. ([#13309](https://github.com/mastra-ai/mastra/pull/13309))
  - `execute_command` now supports `background: true` to spawn long-running processes and return a PID
  - New `get_process_output` tool to check output/status of background processes (supports `wait` to block until exit)
  - New `kill_process` tool to terminate background processes
  - Output truncation helpers with configurable tail lines
  - Sandbox execution badge UI: terminal-style output display with streaming, exit codes, killed status, and workspace metadata

- Fixed publish button in agent CMS to be disabled when no draft exists, preventing unnecessary error toasts. Also fixed stale agent data after saving a draft or publishing by invalidating the agent query cache. Fixed tool count in the CMS sidebar and tools page to correctly include integration tools. ([#13325](https://github.com/mastra-ai/mastra/pull/13325))

- Updated dependencies [[`24284ff`](https://github.com/mastra-ai/mastra/commit/24284ffae306ddf0ab83273e13f033520839ef40), [`f5097cc`](https://github.com/mastra-ai/mastra/commit/f5097cc8a813c82c3378882c31178320cadeb655), [`71e237f`](https://github.com/mastra-ai/mastra/commit/71e237fa852a3ad9a50a3ddb3b5f3b20b9a8181c), [`13a291e`](https://github.com/mastra-ai/mastra/commit/13a291ebb9f9bca80befa0d9166b916bb348e8e9), [`397af5a`](https://github.com/mastra-ai/mastra/commit/397af5a69f34d4157f51a7c8da3f1ded1e1d611c), [`d4701f7`](https://github.com/mastra-ai/mastra/commit/d4701f7e24822b081b70f9c806c39411b1a712e7), [`2b40831`](https://github.com/mastra-ai/mastra/commit/2b40831dcca2275c9570ddf09b7f25ba3e8dc7fc), [`2b40831`](https://github.com/mastra-ai/mastra/commit/2b40831dcca2275c9570ddf09b7f25ba3e8dc7fc), [`6184727`](https://github.com/mastra-ai/mastra/commit/6184727e812bf7a65cee209bacec3a2f5a16e923), [`0c338b8`](https://github.com/mastra-ai/mastra/commit/0c338b87362dcd95ff8191ca00df645b6953f534), [`6f6385b`](https://github.com/mastra-ai/mastra/commit/6f6385be5b33687cd21e71fc27e972e6928bb34c), [`14aba61`](https://github.com/mastra-ai/mastra/commit/14aba61b9cff76d72bc7ef6f3a83ae2c5d059193), [`dd9dd1c`](https://github.com/mastra-ai/mastra/commit/dd9dd1c9ae32ae79093f8c4adde1732ac6357233)]:
  - @mastra/core@1.7.0
  - @mastra/client-js@1.7.0
  - @mastra/ai-sdk@1.0.5
  - @mastra/react@0.2.6

## 14.0.0-alpha.0

### Minor Changes

- Added prompt block management to the Playground. You can now create, edit, version, and publish reusable prompt blocks from a dedicated "Prompts" tab in the sidebar. ([#13351](https://github.com/mastra-ai/mastra/pull/13351))

  **Prompt block editor features:**
  - Draft/published versioning with version history dropdown
  - Variables editor (JSON schema) for defining template variables
  - Display conditions for conditional block rendering
  - Variable highlighting in the content editor

  **Agent instruction block improvements:**
  - Added support for referencing saved prompt blocks in agent instructions via a new "Reference saved prompt block" option in the add block dropdown
  - Fixed save/publish button behavior — "Save" is now disabled when no changes have been made, and "Publish" is only enabled when there are unpublished drafts

- Added nested folder creation support in the skill tree editor for references and scripts folders ([#13453](https://github.com/mastra-ai/mastra/pull/13453))

- Added new Chip component and expanded ItemList with Cell, LinkCell, IdCell, DateCell, and VersionCell sub-components. Improved dataset version comparison page with inline navigation links, version status indicators, and a refreshed row layout. ([#13399](https://github.com/mastra-ai/mastra/pull/13399))

### Patch Changes

- Improved comparison selection behavior: selecting a third item now replaces the most recent selection instead of being blocked. Applies to dataset version, item version, and dataset item comparison flows. ([#13406](https://github.com/mastra-ai/mastra/pull/13406))

- Improved the score dialog to show "N/A" with an explanation instead of "null" for empty scorer fields. Code-based scorers show "N/A — code-based scorer does not use prompts" and LLM scorers with unconfigured steps show "N/A — step not configured". Detection uses the `hasJudge` metadata flag with a heuristic fallback for older data. ([#13386](https://github.com/mastra-ai/mastra/pull/13386))

- Added workspace tools for background process management and improved sandbox execution UI. ([#13309](https://github.com/mastra-ai/mastra/pull/13309))
  - `execute_command` now supports `background: true` to spawn long-running processes and return a PID
  - New `get_process_output` tool to check output/status of background processes (supports `wait` to block until exit)
  - New `kill_process` tool to terminate background processes
  - Output truncation helpers with configurable tail lines
  - Sandbox execution badge UI: terminal-style output display with streaming, exit codes, killed status, and workspace metadata

- Fixed publish button in agent CMS to be disabled when no draft exists, preventing unnecessary error toasts. Also fixed stale agent data after saving a draft or publishing by invalidating the agent query cache. Fixed tool count in the CMS sidebar and tools page to correctly include integration tools. ([#13325](https://github.com/mastra-ai/mastra/pull/13325))

- Updated dependencies [[`24284ff`](https://github.com/mastra-ai/mastra/commit/24284ffae306ddf0ab83273e13f033520839ef40), [`f5097cc`](https://github.com/mastra-ai/mastra/commit/f5097cc8a813c82c3378882c31178320cadeb655), [`71e237f`](https://github.com/mastra-ai/mastra/commit/71e237fa852a3ad9a50a3ddb3b5f3b20b9a8181c), [`13a291e`](https://github.com/mastra-ai/mastra/commit/13a291ebb9f9bca80befa0d9166b916bb348e8e9), [`397af5a`](https://github.com/mastra-ai/mastra/commit/397af5a69f34d4157f51a7c8da3f1ded1e1d611c), [`d4701f7`](https://github.com/mastra-ai/mastra/commit/d4701f7e24822b081b70f9c806c39411b1a712e7), [`2b40831`](https://github.com/mastra-ai/mastra/commit/2b40831dcca2275c9570ddf09b7f25ba3e8dc7fc), [`2b40831`](https://github.com/mastra-ai/mastra/commit/2b40831dcca2275c9570ddf09b7f25ba3e8dc7fc), [`6184727`](https://github.com/mastra-ai/mastra/commit/6184727e812bf7a65cee209bacec3a2f5a16e923), [`6f6385b`](https://github.com/mastra-ai/mastra/commit/6f6385be5b33687cd21e71fc27e972e6928bb34c), [`14aba61`](https://github.com/mastra-ai/mastra/commit/14aba61b9cff76d72bc7ef6f3a83ae2c5d059193), [`dd9dd1c`](https://github.com/mastra-ai/mastra/commit/dd9dd1c9ae32ae79093f8c4adde1732ac6357233)]:
  - @mastra/core@1.7.0-alpha.0
  - @mastra/client-js@1.7.0-alpha.0
  - @mastra/ai-sdk@1.0.5
  - @mastra/react@0.2.6-alpha.0

## 13.0.0

### Minor Changes

- Added `Tree.Input` component for inline file and folder creation within the Tree. Supports auto-focus, Enter to confirm, Escape to cancel, and blur handling with correct depth indentation. ([#13264](https://github.com/mastra-ai/mastra/pull/13264))

  ```tsx
  import { Tree } from '@mastra/playground-ui';

  <Tree.Folder name="src" defaultOpen>
    <Tree.Input
      type="file"
      placeholder="new-file.ts"
      onSubmit={name => createFile(name)}
      onCancel={() => setCreating(false)}
    />
    <Tree.File name="index.ts" />
  </Tree.Folder>;
  ```

### Patch Changes

- dependencies updates: ([#13284](https://github.com/mastra-ai/mastra/pull/13284))
  - Updated dependency [`sonner@^2.0.7` ↗︎](https://www.npmjs.com/package/sonner/v/2.0.7) (from `^2.0.5`, in `dependencies`)

- dependencies updates: ([#13300](https://github.com/mastra-ai/mastra/pull/13300))
  - Updated dependency [`superjson@^2.2.6` ↗︎](https://www.npmjs.com/package/superjson/v/2.2.6) (from `^2.2.2`, in `dependencies`)

- Added per-tool selection for MCP clients in the agent editor. When connecting to an HTTP MCP server, each tool now has a toggle switch so you can choose exactly which tools the agent should use. Selected tools persist across saves and reloads. ([#13262](https://github.com/mastra-ai/mastra/pull/13262))

- Fixed agent publish flow to no longer auto-save a draft. Publish now only activates the latest saved version. Save and Publish buttons are disabled when there are no changes or no unpublished draft, respectively. ([#13292](https://github.com/mastra-ai/mastra/pull/13292))

  Memory page improvements:
  - Renamed "Last Messages" to "Message History" and added a toggle switch for consistency with other memory options.
  - Moved Observational Memory to the top of the memory list.
  - Observational Memory and Message History are now mutually exclusive — enabling one disables the other.

- Added a side-by-side diff view to the Dataset comparison pages (Compare Items and Compare Item Versions), making it easier to spot differences between dataset entries at a glance. ([#13267](https://github.com/mastra-ai/mastra/pull/13267))

- Fixed the Experiment Result panel crashing with a type error when results contained nested objects instead of plain strings. ([#13275](https://github.com/mastra-ai/mastra/pull/13275))

- Added a searchable combobox header to the Dataset page, allowing you to quickly filter and switch between datasets without scrolling through a long list. ([#13273](https://github.com/mastra-ai/mastra/pull/13273))

- Added skill editing and workspace support in the agent CMS. Agents can now toggle skills on/off and associate a workspace. Fixed auto-versioning to compare against the latest draft version instead of the published one, preventing stale draft configs from being returned after saves. ([#13314](https://github.com/mastra-ai/mastra/pull/13314))

- Added a composable Tree component for displaying file-system-like views with collapsible folders, file type icons, selection support, and action slots ([#13259](https://github.com/mastra-ai/mastra/pull/13259))

- Added a version history panel to the right side of the agent CMS edit page. The version selector moved from a combobox dropdown in the header to a dedicated side panel, making it easier to browse and switch between agent versions. ([#13279](https://github.com/mastra-ai/mastra/pull/13279))

- Updated dependencies [[`e4034e5`](https://github.com/mastra-ai/mastra/commit/e4034e5442b27f1bcae80456bfd21be388962eb8), [`0d9efb4`](https://github.com/mastra-ai/mastra/commit/0d9efb47992c34aa90581c18b9f51f774f6252a5), [`7184d87`](https://github.com/mastra-ai/mastra/commit/7184d87c9237d26862f500ccfd0c9f9eadd38ddf), [`5caa13d`](https://github.com/mastra-ai/mastra/commit/5caa13d1b2a496e2565ab124a11de9a51ad3e3b9), [`940163f`](https://github.com/mastra-ai/mastra/commit/940163fc492401d7562301e6f106ccef4fefe06f), [`47892c8`](https://github.com/mastra-ai/mastra/commit/47892c85708eac348209f99f10f9a5f5267e11c0), [`3f8f1b3`](https://github.com/mastra-ai/mastra/commit/3f8f1b31146d2a8316157171962ad825628aa251), [`45bb78b`](https://github.com/mastra-ai/mastra/commit/45bb78b70bd9db29678fe49476cd9f4ed01bfd0b), [`70eef84`](https://github.com/mastra-ai/mastra/commit/70eef84b8f44493598fdafa2980a0e7283415eda), [`d84e52d`](https://github.com/mastra-ai/mastra/commit/d84e52d0f6511283ddd21ed5fe7f945449d0f799), [`24b80af`](https://github.com/mastra-ai/mastra/commit/24b80af87da93bb84d389340181e17b7477fa9ca), [`608e156`](https://github.com/mastra-ai/mastra/commit/608e156def954c9604c5e3f6d9dfce3bcc7aeab0), [`2b2e157`](https://github.com/mastra-ai/mastra/commit/2b2e157a092cd597d9d3f0000d62b8bb4a7348ed), [`59d30b5`](https://github.com/mastra-ai/mastra/commit/59d30b5d0cb44ea7a1c440e7460dfb57eac9a9b5), [`453693b`](https://github.com/mastra-ai/mastra/commit/453693bf9e265ddccecef901d50da6caaea0fbc6), [`78d1c80`](https://github.com/mastra-ai/mastra/commit/78d1c808ad90201897a300af551bcc1d34458a20), [`c204b63`](https://github.com/mastra-ai/mastra/commit/c204b632d19e66acb6d6e19b11c4540dd6ad5380), [`742a417`](https://github.com/mastra-ai/mastra/commit/742a417896088220a3b5560c354c45c5ca6d88b9)]:
  - @mastra/react@0.2.5
  - @mastra/core@1.6.0
  - @mastra/client-js@1.6.0
  - @mastra/schema-compat@1.1.2
  - @mastra/ai-sdk@1.0.5

## 13.0.0-alpha.0

### Minor Changes

- Added `Tree.Input` component for inline file and folder creation within the Tree. Supports auto-focus, Enter to confirm, Escape to cancel, and blur handling with correct depth indentation. ([#13264](https://github.com/mastra-ai/mastra/pull/13264))

  ```tsx
  import { Tree } from '@mastra/playground-ui';

  <Tree.Folder name="src" defaultOpen>
    <Tree.Input
      type="file"
      placeholder="new-file.ts"
      onSubmit={name => createFile(name)}
      onCancel={() => setCreating(false)}
    />
    <Tree.File name="index.ts" />
  </Tree.Folder>;
  ```

### Patch Changes

- dependencies updates: ([#13284](https://github.com/mastra-ai/mastra/pull/13284))
  - Updated dependency [`sonner@^2.0.7` ↗︎](https://www.npmjs.com/package/sonner/v/2.0.7) (from `^2.0.5`, in `dependencies`)

- dependencies updates: ([#13300](https://github.com/mastra-ai/mastra/pull/13300))
  - Updated dependency [`superjson@^2.2.6` ↗︎](https://www.npmjs.com/package/superjson/v/2.2.6) (from `^2.2.2`, in `dependencies`)

- Added per-tool selection for MCP clients in the agent editor. When connecting to an HTTP MCP server, each tool now has a toggle switch so you can choose exactly which tools the agent should use. Selected tools persist across saves and reloads. ([#13262](https://github.com/mastra-ai/mastra/pull/13262))

- Fixed agent publish flow to no longer auto-save a draft. Publish now only activates the latest saved version. Save and Publish buttons are disabled when there are no changes or no unpublished draft, respectively. ([#13292](https://github.com/mastra-ai/mastra/pull/13292))

  Memory page improvements:
  - Renamed "Last Messages" to "Message History" and added a toggle switch for consistency with other memory options.
  - Moved Observational Memory to the top of the memory list.
  - Observational Memory and Message History are now mutually exclusive — enabling one disables the other.

- Added a side-by-side diff view to the Dataset comparison pages (Compare Items and Compare Item Versions), making it easier to spot differences between dataset entries at a glance. ([#13267](https://github.com/mastra-ai/mastra/pull/13267))

- Fixed the Experiment Result panel crashing with a type error when results contained nested objects instead of plain strings. ([#13275](https://github.com/mastra-ai/mastra/pull/13275))

- Added a searchable combobox header to the Dataset page, allowing you to quickly filter and switch between datasets without scrolling through a long list. ([#13273](https://github.com/mastra-ai/mastra/pull/13273))

- Added skill editing and workspace support in the agent CMS. Agents can now toggle skills on/off and associate a workspace. Fixed auto-versioning to compare against the latest draft version instead of the published one, preventing stale draft configs from being returned after saves. ([#13314](https://github.com/mastra-ai/mastra/pull/13314))

- Added a composable Tree component for displaying file-system-like views with collapsible folders, file type icons, selection support, and action slots ([#13259](https://github.com/mastra-ai/mastra/pull/13259))

- Added a version history panel to the right side of the agent CMS edit page. The version selector moved from a combobox dropdown in the header to a dedicated side panel, making it easier to browse and switch between agent versions. ([#13279](https://github.com/mastra-ai/mastra/pull/13279))

- Updated dependencies [[`e4034e5`](https://github.com/mastra-ai/mastra/commit/e4034e5442b27f1bcae80456bfd21be388962eb8), [`0d9efb4`](https://github.com/mastra-ai/mastra/commit/0d9efb47992c34aa90581c18b9f51f774f6252a5), [`7184d87`](https://github.com/mastra-ai/mastra/commit/7184d87c9237d26862f500ccfd0c9f9eadd38ddf), [`5caa13d`](https://github.com/mastra-ai/mastra/commit/5caa13d1b2a496e2565ab124a11de9a51ad3e3b9), [`940163f`](https://github.com/mastra-ai/mastra/commit/940163fc492401d7562301e6f106ccef4fefe06f), [`b260123`](https://github.com/mastra-ai/mastra/commit/b2601234bd093d358c92081a58f9b0befdae52b3), [`47892c8`](https://github.com/mastra-ai/mastra/commit/47892c85708eac348209f99f10f9a5f5267e11c0), [`3f8f1b3`](https://github.com/mastra-ai/mastra/commit/3f8f1b31146d2a8316157171962ad825628aa251), [`45bb78b`](https://github.com/mastra-ai/mastra/commit/45bb78b70bd9db29678fe49476cd9f4ed01bfd0b), [`70eef84`](https://github.com/mastra-ai/mastra/commit/70eef84b8f44493598fdafa2980a0e7283415eda), [`d84e52d`](https://github.com/mastra-ai/mastra/commit/d84e52d0f6511283ddd21ed5fe7f945449d0f799), [`24b80af`](https://github.com/mastra-ai/mastra/commit/24b80af87da93bb84d389340181e17b7477fa9ca), [`608e156`](https://github.com/mastra-ai/mastra/commit/608e156def954c9604c5e3f6d9dfce3bcc7aeab0), [`2b2e157`](https://github.com/mastra-ai/mastra/commit/2b2e157a092cd597d9d3f0000d62b8bb4a7348ed), [`59d30b5`](https://github.com/mastra-ai/mastra/commit/59d30b5d0cb44ea7a1c440e7460dfb57eac9a9b5), [`453693b`](https://github.com/mastra-ai/mastra/commit/453693bf9e265ddccecef901d50da6caaea0fbc6), [`78d1c80`](https://github.com/mastra-ai/mastra/commit/78d1c808ad90201897a300af551bcc1d34458a20), [`c204b63`](https://github.com/mastra-ai/mastra/commit/c204b632d19e66acb6d6e19b11c4540dd6ad5380), [`742a417`](https://github.com/mastra-ai/mastra/commit/742a417896088220a3b5560c354c45c5ca6d88b9)]:
  - @mastra/react@0.2.5-alpha.0
  - @mastra/core@1.6.0-alpha.0
  - @mastra/client-js@1.6.0-alpha.0
  - @mastra/schema-compat@1.1.2-alpha.0
  - @mastra/ai-sdk@1.0.5

## 12.0.0

### Minor Changes

- Merged Tools and Integration Tools into a single unified page in the agent CMS. Both tool types now appear in one combobox with visual differentiation: regular tools show a diamond icon while integration tools show a plug icon with a provider badge. ([#13040](https://github.com/mastra-ai/mastra/pull/13040))

### Patch Changes

- dependencies updates: ([#12921](https://github.com/mastra-ai/mastra/pull/12921))
  - Updated dependency [`@assistant-ui/react@^0.12.10` ↗︎](https://www.npmjs.com/package/@assistant-ui/react/v/0.12.10) (from `^0.12.3`, in `dependencies`)
  - Updated dependency [`@assistant-ui/react-markdown@^0.12.3` ↗︎](https://www.npmjs.com/package/@assistant-ui/react-markdown/v/0.12.3) (from `^0.12.1`, in `dependencies`)
  - Updated dependency [`@assistant-ui/react-syntax-highlighter@^0.12.3` ↗︎](https://www.npmjs.com/package/@assistant-ui/react-syntax-highlighter/v/0.12.3) (from `^0.12.1`, in `dependencies`)

- dependencies updates: ([#13100](https://github.com/mastra-ai/mastra/pull/13100))
  - Updated dependency [`@codemirror/view@^6.39.14` ↗︎](https://www.npmjs.com/package/@codemirror/view/v/6.39.14) (from `^6.39.13`, in `dependencies`)

- Fixed React error #310 crash when using observational memory in Mastra Studio. The chat view would crash when observation markers appeared alongside regular tool calls during streaming. ([#13216](https://github.com/mastra-ai/mastra/pull/13216))

- Fixed dragged column appearing offset from cursor when mapping CSV columns in dataset import dialog ([#13176](https://github.com/mastra-ai/mastra/pull/13176))

- Fixed schema form to apply changes only on Save click instead of every keystroke. Removed AgentPromptExperimentProvider in favor of inline prompt rendering. Switched hooks to use merged request context for proper request-scoped data fetching. ([#13034](https://github.com/mastra-ai/mastra/pull/13034))

- Added a "Try to connect" button in the MCP client sidebar to preview available tools before creating. Fixed SSE response parsing for MCP servers returning event streams. ([#13093](https://github.com/mastra-ai/mastra/pull/13093))

- Fix dataset import creating a new version per item. CSV and JSON import dialogs now use the batch insert endpoint so all imported items land on a single version. ([#13214](https://github.com/mastra-ai/mastra/pull/13214))

- Fix experiment result detail panel showing output data under "Input" label, add missing Output section, and add Input column to experiment results list table. ([#13165](https://github.com/mastra-ai/mastra/pull/13165))

- Fixed conditional rules not being persisted for workflows, agents, and scorers when creating or updating agents in the CMS. Rules configured on these entities are now correctly saved to storage. ([#13044](https://github.com/mastra-ai/mastra/pull/13044))

- Updated style of Button and Select experimental variants ([#13186](https://github.com/mastra-ai/mastra/pull/13186))

- Added a dedicated Integration Tools section to the agent CMS tools page. Providers are shown as cards — clicking one opens a side dialog with toolkit navigation on the left and a searchable, multi-select tool list on the right. Selected tools persist to the agent form. Regular tools now appear in a separate "Available Tools" section. ([#13048](https://github.com/mastra-ai/mastra/pull/13048))

- Added requestContext support to listScorers for request-scoped scorer resolution ([#13034](https://github.com/mastra-ai/mastra/pull/13034))

- Added mount picker for skill installation when multiple filesystem mounts are available. Skills table and detail page now show skill paths and mount labels. ([#13031](https://github.com/mastra-ai/mastra/pull/13031))

- Removed unused Dataset Item Edit Dialog ([#13199](https://github.com/mastra-ai/mastra/pull/13199))

- Hide Dataset Item History panel when item is edited ([#13195](https://github.com/mastra-ai/mastra/pull/13195))

- Dataset schemas now appear in the Edit Dataset dialog. Previously the `inputSchema` and `groundTruthSchema` fields were not passed to the dialog, so editing a dataset always showed empty schemas. ([#13175](https://github.com/mastra-ai/mastra/pull/13175))

  Schema edits in the JSON editor no longer cause the cursor to jump to the top of the field. Typing `{"type": "object"}` in the schema editor now behaves like a normal text input instead of resetting on every keystroke.

  Validation errors are now surfaced when updating a dataset schema that conflicts with existing items. For example, adding a `required: ["name"]` constraint when existing items lack a `name` field now shows "2 existing item(s) fail validation" in the dialog instead of silently dropping the error.

  Disabling a dataset schema from the Studio UI now correctly clears it. Previously the server converted `null` (disable) to `undefined` (no change), so the old schema persisted and validation continued.

  Workflow schemas fetched via `client.getWorkflow().getSchema()` are now correctly parsed. The server serializes schemas with `superjson`, but the client was using plain `JSON.parse`, yielding a `{json: {...}}` wrapper instead of the actual JSON Schema object.

- Fixed "Tried to unmount a fiber that is already unmounted" error in the playground agent chat. Switching threads rapidly or creating new threads no longer causes this console error. ([#13182](https://github.com/mastra-ai/mastra/pull/13182))

- Updated visuals of Dataset Items List empty state ([#13203](https://github.com/mastra-ai/mastra/pull/13203))

- CMS draft support with status badges for agents. ([#13194](https://github.com/mastra-ai/mastra/pull/13194))
  - Agent list now resolves the latest (draft) version for each stored agent, showing current edits rather than the last published state.
  - Added `hasDraft` and `activeVersionId` fields to the agent list API response.
  - Agent list badges: "Published" (green) when a published version exists, "Draft" (colored when unpublished changes exist, grayed out otherwise).
  - Added `resolvedVersionId` to all `StorageResolved*Type` types so the server can detect whether the latest version differs from the active version.
  - Added `status` option to `GetByIdOptions` to allow resolving draft vs published versions through the editor layer.
  - Fixed editor cache not being cleared on version activate, restore, and delete — all four versioned domains (agents, scorers, prompt-blocks, mcp-clients) now clear the cache after version mutations.
  - Added `ALTER TABLE` migration for `mastra_agent_versions` in libsql and pg to add newer columns (`mcpClients`, `requestContextSchema`, `workspace`, `skills`, `skillsFormat`).

- Added scorer version management and CMS draft/publish flow for scorers. ([#13194](https://github.com/mastra-ai/mastra/pull/13194))
  - Added scorer version methods to the client SDK: `listVersions`, `createVersion`, `getVersion`, `activateVersion`, `restoreVersion`, `deleteVersion`, `compareVersions`.
  - Added `ScorerVersionCombobox` for navigating scorer versions with Published/Draft labels.
  - Scorer edit page now supports Save (draft) and Publish workflows with an "Unpublished changes" indicator.
  - Storage list methods for agents and scorers no longer default to filtering only published entities, allowing drafts to appear in the playground.

- Updated workspace tool badges for execute command and list files tools. Execute command badge now shows running state for silent commands and correctly scopes output to individual tool calls during parallel execution. ([#13166](https://github.com/mastra-ai/mastra/pull/13166))

- Updated dependencies [[`252580a`](https://github.com/mastra-ai/mastra/commit/252580a71feb0e46d0ccab04a70a79ff6a2ee0ab), [`f8e819f`](https://github.com/mastra-ai/mastra/commit/f8e819fabdfdc43d2da546a3ad81ba23685f603d), [`5c75261`](https://github.com/mastra-ai/mastra/commit/5c7526120d936757d4ffb7b82232e1641ebd45cb), [`e27d832`](https://github.com/mastra-ai/mastra/commit/e27d83281b5e166fd63a13969689e928d8605944), [`e37ef84`](https://github.com/mastra-ai/mastra/commit/e37ef8404043c94ca0c8e35ecdedb093b8087878), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`10cf521`](https://github.com/mastra-ai/mastra/commit/10cf52183344743a0d7babe24cd24fd78870c354), [`efdb682`](https://github.com/mastra-ai/mastra/commit/efdb682887f6522149769383908f9790c188ab88), [`0dee7a0`](https://github.com/mastra-ai/mastra/commit/0dee7a0ff4c2507e6eb6e6ee5f9738877ebd4ad1), [`04c2c8e`](https://github.com/mastra-ai/mastra/commit/04c2c8e888984364194131aecb490a3d6e920e61), [`55a0ab1`](https://github.com/mastra-ai/mastra/commit/55a0ab13187b3c656247a1d9bfa715077af6e422), [`02dc07a`](https://github.com/mastra-ai/mastra/commit/02dc07acc4ad42d93335825e3308f5b42266eba2), [`bb7262b`](https://github.com/mastra-ai/mastra/commit/bb7262b7c0ca76320d985b40510b6ffbbb936582), [`1415bcd`](https://github.com/mastra-ai/mastra/commit/1415bcd894baba03e07640b3b1986037db49559d), [`cf1c6e7`](https://github.com/mastra-ai/mastra/commit/cf1c6e789b131f55638fed52183a89d5078b4876), [`cf1c6e7`](https://github.com/mastra-ai/mastra/commit/cf1c6e789b131f55638fed52183a89d5078b4876), [`5ffadfe`](https://github.com/mastra-ai/mastra/commit/5ffadfefb1468ac2612b20bb84d24c39de6961c0), [`1e1339c`](https://github.com/mastra-ai/mastra/commit/1e1339cc276e571a48cfff5014487877086bfe68), [`d03df73`](https://github.com/mastra-ai/mastra/commit/d03df73f8fe9496064a33e1c3b74ba0479bf9ee6), [`79b8f45`](https://github.com/mastra-ai/mastra/commit/79b8f45a6767e1a5c3d56cd3c5b1214326b81661), [`9bbf08e`](https://github.com/mastra-ai/mastra/commit/9bbf08e3c20731c79dea13a765895b9fcf29cbf1), [`0a25952`](https://github.com/mastra-ai/mastra/commit/0a259526b5e1ac11e6efa53db1f140272962af2d), [`ffa5468`](https://github.com/mastra-ai/mastra/commit/ffa546857fc4821753979b3a34e13b4d76fbbcd4), [`55a0ab1`](https://github.com/mastra-ai/mastra/commit/55a0ab13187b3c656247a1d9bfa715077af6e422), [`3264a04`](https://github.com/mastra-ai/mastra/commit/3264a04e30340c3c5447433300a035ea0878df85), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`088d9ba`](https://github.com/mastra-ai/mastra/commit/088d9ba2577518703c52b0dccd617178d9ee6b0d), [`74fbebd`](https://github.com/mastra-ai/mastra/commit/74fbebd918a03832a2864965a8bea59bf617d3a2), [`ec36c0c`](https://github.com/mastra-ai/mastra/commit/ec36c0cb117bc8c092d14605bcae092411fe3906), [`aea6217`](https://github.com/mastra-ai/mastra/commit/aea621790bfb2291431b08da0cc5e6e150303ae7), [`b6a855e`](https://github.com/mastra-ai/mastra/commit/b6a855edc056e088279075506442ba1d6fa6def9), [`ae408ea`](https://github.com/mastra-ai/mastra/commit/ae408ea7128f0d2710b78d8623185198e7cb19c1), [`17e942e`](https://github.com/mastra-ai/mastra/commit/17e942eee2ba44985b1f807e6208cdde672f82f9), [`2015cf9`](https://github.com/mastra-ai/mastra/commit/2015cf921649f44c3f5bcd32a2c052335f8e49b4), [`7ef454e`](https://github.com/mastra-ai/mastra/commit/7ef454eaf9dcec6de60021c8f42192052dd490d6), [`2be1d99`](https://github.com/mastra-ai/mastra/commit/2be1d99564ce79acc4846071082bff353035a87a), [`2708fa1`](https://github.com/mastra-ai/mastra/commit/2708fa1055ac91c03e08b598869f6b8fb51fa37f), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9), [`ec53e89`](https://github.com/mastra-ai/mastra/commit/ec53e8939c76c638991e21af762e51378eff7543), [`9b5a8cb`](https://github.com/mastra-ai/mastra/commit/9b5a8cb13e120811b0bf14140ada314f1c067894), [`607e66b`](https://github.com/mastra-ai/mastra/commit/607e66b02dc7f531ee37799f3456aa2dc0ca7ac5), [`a215d06`](https://github.com/mastra-ai/mastra/commit/a215d06758dcf590eabfe0b7afd4ae39bdbf082c), [`6909c74`](https://github.com/mastra-ai/mastra/commit/6909c74a7781e0447d475e9dbc1dc871b700f426), [`192438f`](https://github.com/mastra-ai/mastra/commit/192438f8a90c4f375e955f8ff179bf8dc6821a83)]:
  - @mastra/core@1.5.0
  - @mastra/react@0.2.4
  - @mastra/client-js@1.5.0
  - @mastra/schema-compat@1.1.1
  - @mastra/ai-sdk@1.0.5

## 12.0.0-alpha.1

### Patch Changes

- Updated dependencies [[`1415bcd`](https://github.com/mastra-ai/mastra/commit/1415bcd894baba03e07640b3b1986037db49559d)]:
  - @mastra/schema-compat@1.1.1-alpha.0
  - @mastra/client-js@1.5.0-alpha.1
  - @mastra/core@1.5.0-alpha.1
  - @mastra/react@0.2.4-alpha.1

## 12.0.0-alpha.0

### Minor Changes

- Merged Tools and Integration Tools into a single unified page in the agent CMS. Both tool types now appear in one combobox with visual differentiation: regular tools show a diamond icon while integration tools show a plug icon with a provider badge. ([#13040](https://github.com/mastra-ai/mastra/pull/13040))

### Patch Changes

- dependencies updates: ([#12921](https://github.com/mastra-ai/mastra/pull/12921))
  - Updated dependency [`@assistant-ui/react@^0.12.10` ↗︎](https://www.npmjs.com/package/@assistant-ui/react/v/0.12.10) (from `^0.12.3`, in `dependencies`)
  - Updated dependency [`@assistant-ui/react-markdown@^0.12.3` ↗︎](https://www.npmjs.com/package/@assistant-ui/react-markdown/v/0.12.3) (from `^0.12.1`, in `dependencies`)
  - Updated dependency [`@assistant-ui/react-syntax-highlighter@^0.12.3` ↗︎](https://www.npmjs.com/package/@assistant-ui/react-syntax-highlighter/v/0.12.3) (from `^0.12.1`, in `dependencies`)

- dependencies updates: ([#13100](https://github.com/mastra-ai/mastra/pull/13100))
  - Updated dependency [`@codemirror/view@^6.39.14` ↗︎](https://www.npmjs.com/package/@codemirror/view/v/6.39.14) (from `^6.39.13`, in `dependencies`)

- Fixed React error #310 crash when using observational memory in Mastra Studio. The chat view would crash when observation markers appeared alongside regular tool calls during streaming. ([#13216](https://github.com/mastra-ai/mastra/pull/13216))

- Fixed dragged column appearing offset from cursor when mapping CSV columns in dataset import dialog ([#13176](https://github.com/mastra-ai/mastra/pull/13176))

- Fixed schema form to apply changes only on Save click instead of every keystroke. Removed AgentPromptExperimentProvider in favor of inline prompt rendering. Switched hooks to use merged request context for proper request-scoped data fetching. ([#13034](https://github.com/mastra-ai/mastra/pull/13034))

- Added a "Try to connect" button in the MCP client sidebar to preview available tools before creating. Fixed SSE response parsing for MCP servers returning event streams. ([#13093](https://github.com/mastra-ai/mastra/pull/13093))

- Fix dataset import creating a new version per item. CSV and JSON import dialogs now use the batch insert endpoint so all imported items land on a single version. ([#13214](https://github.com/mastra-ai/mastra/pull/13214))

- Fix experiment result detail panel showing output data under "Input" label, add missing Output section, and add Input column to experiment results list table. ([#13165](https://github.com/mastra-ai/mastra/pull/13165))

- Fixed conditional rules not being persisted for workflows, agents, and scorers when creating or updating agents in the CMS. Rules configured on these entities are now correctly saved to storage. ([#13044](https://github.com/mastra-ai/mastra/pull/13044))

- Updated style of Button and Select experimental variants ([#13186](https://github.com/mastra-ai/mastra/pull/13186))

- Added a dedicated Integration Tools section to the agent CMS tools page. Providers are shown as cards — clicking one opens a side dialog with toolkit navigation on the left and a searchable, multi-select tool list on the right. Selected tools persist to the agent form. Regular tools now appear in a separate "Available Tools" section. ([#13048](https://github.com/mastra-ai/mastra/pull/13048))

- Added requestContext support to listScorers for request-scoped scorer resolution ([#13034](https://github.com/mastra-ai/mastra/pull/13034))

- Added mount picker for skill installation when multiple filesystem mounts are available. Skills table and detail page now show skill paths and mount labels. ([#13031](https://github.com/mastra-ai/mastra/pull/13031))

- Removed unused Dataset Item Edit Dialog ([#13199](https://github.com/mastra-ai/mastra/pull/13199))

- Hide Dataset Item History panel when item is edited ([#13195](https://github.com/mastra-ai/mastra/pull/13195))

- Dataset schemas now appear in the Edit Dataset dialog. Previously the `inputSchema` and `groundTruthSchema` fields were not passed to the dialog, so editing a dataset always showed empty schemas. ([#13175](https://github.com/mastra-ai/mastra/pull/13175))

  Schema edits in the JSON editor no longer cause the cursor to jump to the top of the field. Typing `{"type": "object"}` in the schema editor now behaves like a normal text input instead of resetting on every keystroke.

  Validation errors are now surfaced when updating a dataset schema that conflicts with existing items. For example, adding a `required: ["name"]` constraint when existing items lack a `name` field now shows "2 existing item(s) fail validation" in the dialog instead of silently dropping the error.

  Disabling a dataset schema from the Studio UI now correctly clears it. Previously the server converted `null` (disable) to `undefined` (no change), so the old schema persisted and validation continued.

  Workflow schemas fetched via `client.getWorkflow().getSchema()` are now correctly parsed. The server serializes schemas with `superjson`, but the client was using plain `JSON.parse`, yielding a `{json: {...}}` wrapper instead of the actual JSON Schema object.

- Fixed "Tried to unmount a fiber that is already unmounted" error in the playground agent chat. Switching threads rapidly or creating new threads no longer causes this console error. ([#13182](https://github.com/mastra-ai/mastra/pull/13182))

- Updated visuals of Dataset Items List empty state ([#13203](https://github.com/mastra-ai/mastra/pull/13203))

- CMS draft support with status badges for agents. ([#13194](https://github.com/mastra-ai/mastra/pull/13194))
  - Agent list now resolves the latest (draft) version for each stored agent, showing current edits rather than the last published state.
  - Added `hasDraft` and `activeVersionId` fields to the agent list API response.
  - Agent list badges: "Published" (green) when a published version exists, "Draft" (colored when unpublished changes exist, grayed out otherwise).
  - Added `resolvedVersionId` to all `StorageResolved*Type` types so the server can detect whether the latest version differs from the active version.
  - Added `status` option to `GetByIdOptions` to allow resolving draft vs published versions through the editor layer.
  - Fixed editor cache not being cleared on version activate, restore, and delete — all four versioned domains (agents, scorers, prompt-blocks, mcp-clients) now clear the cache after version mutations.
  - Added `ALTER TABLE` migration for `mastra_agent_versions` in libsql and pg to add newer columns (`mcpClients`, `requestContextSchema`, `workspace`, `skills`, `skillsFormat`).

- Added scorer version management and CMS draft/publish flow for scorers. ([#13194](https://github.com/mastra-ai/mastra/pull/13194))
  - Added scorer version methods to the client SDK: `listVersions`, `createVersion`, `getVersion`, `activateVersion`, `restoreVersion`, `deleteVersion`, `compareVersions`.
  - Added `ScorerVersionCombobox` for navigating scorer versions with Published/Draft labels.
  - Scorer edit page now supports Save (draft) and Publish workflows with an "Unpublished changes" indicator.
  - Storage list methods for agents and scorers no longer default to filtering only published entities, allowing drafts to appear in the playground.

- Updated workspace tool badges for execute command and list files tools. Execute command badge now shows running state for silent commands and correctly scopes output to individual tool calls during parallel execution. ([#13166](https://github.com/mastra-ai/mastra/pull/13166))

- Updated dependencies [[`252580a`](https://github.com/mastra-ai/mastra/commit/252580a71feb0e46d0ccab04a70a79ff6a2ee0ab), [`f8e819f`](https://github.com/mastra-ai/mastra/commit/f8e819fabdfdc43d2da546a3ad81ba23685f603d), [`5c75261`](https://github.com/mastra-ai/mastra/commit/5c7526120d936757d4ffb7b82232e1641ebd45cb), [`e27d832`](https://github.com/mastra-ai/mastra/commit/e27d83281b5e166fd63a13969689e928d8605944), [`e37ef84`](https://github.com/mastra-ai/mastra/commit/e37ef8404043c94ca0c8e35ecdedb093b8087878), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`10cf521`](https://github.com/mastra-ai/mastra/commit/10cf52183344743a0d7babe24cd24fd78870c354), [`efdb682`](https://github.com/mastra-ai/mastra/commit/efdb682887f6522149769383908f9790c188ab88), [`0dee7a0`](https://github.com/mastra-ai/mastra/commit/0dee7a0ff4c2507e6eb6e6ee5f9738877ebd4ad1), [`04c2c8e`](https://github.com/mastra-ai/mastra/commit/04c2c8e888984364194131aecb490a3d6e920e61), [`55a0ab1`](https://github.com/mastra-ai/mastra/commit/55a0ab13187b3c656247a1d9bfa715077af6e422), [`02dc07a`](https://github.com/mastra-ai/mastra/commit/02dc07acc4ad42d93335825e3308f5b42266eba2), [`bb7262b`](https://github.com/mastra-ai/mastra/commit/bb7262b7c0ca76320d985b40510b6ffbbb936582), [`cf1c6e7`](https://github.com/mastra-ai/mastra/commit/cf1c6e789b131f55638fed52183a89d5078b4876), [`cf1c6e7`](https://github.com/mastra-ai/mastra/commit/cf1c6e789b131f55638fed52183a89d5078b4876), [`5ffadfe`](https://github.com/mastra-ai/mastra/commit/5ffadfefb1468ac2612b20bb84d24c39de6961c0), [`1e1339c`](https://github.com/mastra-ai/mastra/commit/1e1339cc276e571a48cfff5014487877086bfe68), [`d03df73`](https://github.com/mastra-ai/mastra/commit/d03df73f8fe9496064a33e1c3b74ba0479bf9ee6), [`79b8f45`](https://github.com/mastra-ai/mastra/commit/79b8f45a6767e1a5c3d56cd3c5b1214326b81661), [`9bbf08e`](https://github.com/mastra-ai/mastra/commit/9bbf08e3c20731c79dea13a765895b9fcf29cbf1), [`0a25952`](https://github.com/mastra-ai/mastra/commit/0a259526b5e1ac11e6efa53db1f140272962af2d), [`ffa5468`](https://github.com/mastra-ai/mastra/commit/ffa546857fc4821753979b3a34e13b4d76fbbcd4), [`55a0ab1`](https://github.com/mastra-ai/mastra/commit/55a0ab13187b3c656247a1d9bfa715077af6e422), [`3264a04`](https://github.com/mastra-ai/mastra/commit/3264a04e30340c3c5447433300a035ea0878df85), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`088d9ba`](https://github.com/mastra-ai/mastra/commit/088d9ba2577518703c52b0dccd617178d9ee6b0d), [`74fbebd`](https://github.com/mastra-ai/mastra/commit/74fbebd918a03832a2864965a8bea59bf617d3a2), [`ec36c0c`](https://github.com/mastra-ai/mastra/commit/ec36c0cb117bc8c092d14605bcae092411fe3906), [`aea6217`](https://github.com/mastra-ai/mastra/commit/aea621790bfb2291431b08da0cc5e6e150303ae7), [`b6a855e`](https://github.com/mastra-ai/mastra/commit/b6a855edc056e088279075506442ba1d6fa6def9), [`ae408ea`](https://github.com/mastra-ai/mastra/commit/ae408ea7128f0d2710b78d8623185198e7cb19c1), [`17e942e`](https://github.com/mastra-ai/mastra/commit/17e942eee2ba44985b1f807e6208cdde672f82f9), [`2015cf9`](https://github.com/mastra-ai/mastra/commit/2015cf921649f44c3f5bcd32a2c052335f8e49b4), [`7ef454e`](https://github.com/mastra-ai/mastra/commit/7ef454eaf9dcec6de60021c8f42192052dd490d6), [`2be1d99`](https://github.com/mastra-ai/mastra/commit/2be1d99564ce79acc4846071082bff353035a87a), [`2708fa1`](https://github.com/mastra-ai/mastra/commit/2708fa1055ac91c03e08b598869f6b8fb51fa37f), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9), [`ec53e89`](https://github.com/mastra-ai/mastra/commit/ec53e8939c76c638991e21af762e51378eff7543), [`9b5a8cb`](https://github.com/mastra-ai/mastra/commit/9b5a8cb13e120811b0bf14140ada314f1c067894), [`607e66b`](https://github.com/mastra-ai/mastra/commit/607e66b02dc7f531ee37799f3456aa2dc0ca7ac5), [`a215d06`](https://github.com/mastra-ai/mastra/commit/a215d06758dcf590eabfe0b7afd4ae39bdbf082c), [`6909c74`](https://github.com/mastra-ai/mastra/commit/6909c74a7781e0447d475e9dbc1dc871b700f426), [`192438f`](https://github.com/mastra-ai/mastra/commit/192438f8a90c4f375e955f8ff179bf8dc6821a83)]:
  - @mastra/core@1.5.0-alpha.0
  - @mastra/react@0.2.4-alpha.0
  - @mastra/client-js@1.5.0-alpha.0
  - @mastra/ai-sdk@1.0.5-alpha.0

## 11.0.0

### Minor Changes

- Added Datasets and Experiments UI. Includes dataset management (create, edit, delete, duplicate), item CRUD with CSV/JSON import and export, SCD-2 version browsing and comparison, experiment triggering with scorer selection, experiment results with trace visualization, and cross-experiment comparison with score deltas. Uses `coreFeatures` runtime flag for feature gating instead of build-time env var. ([#12747](https://github.com/mastra-ai/mastra/pull/12747))

- Add `workflow-step-progress` stream event for foreach workflow steps. Each iteration emits a progress event with `completedCount`, `totalCount`, `currentIndex`, `iterationStatus` (`success` | `failed` | `suspended`), and optional `iterationOutput`. Both the default and evented execution engines emit these events. ([#12838](https://github.com/mastra-ai/mastra/pull/12838))

  The Mastra Studio UI now renders a progress bar with an N/total counter on foreach nodes, updating in real time as iterations complete:

  ```ts
  // Consuming progress events from the workflow stream
  const run = workflow.createRun();
  const result = await run.start({ inputData });
  const stream = result.stream;

  for await (const chunk of stream) {
    if (chunk.type === 'workflow-step-progress') {
      console.log(`${chunk.payload.completedCount}/${chunk.payload.totalCount} - ${chunk.payload.iterationStatus}`);
    }
  }
  ```

  `@mastra/react`: The `mapWorkflowStreamChunkToWatchResult` reducer now accumulates `foreachProgress` from `workflow-step-progress` events into step state, making progress data available to React consumers via the existing workflow watch hooks.

- Added observational memory configuration support for stored agents. When creating or editing a stored agent in the playground, you can now enable observational memory and configure its settings including model provider/name, scope (thread or resource), share token budget, and detailed observer/reflector parameters like token limits, buffer settings, and blocking thresholds. The configuration is serialized as part of the agent's memory config and round-trips through storage. ([#12962](https://github.com/mastra-ai/mastra/pull/12962))

  **Example usage in the playground:**

  Enable the Observational Memory toggle in the Memory section, then configure:
  - Top-level model (provider + model) used by both observer and reflector
  - Scope: `thread` (per-conversation) or `resource` (shared across threads)
  - Expand **Observer** or **Reflector** sections to override models and tune token budgets

  **Programmatic usage via client SDK:**

  ```ts
  await client.createStoredAgent({
    name: 'My Agent',
    // ...other config
    memory: {
      observationalMemory: true, // enable with defaults
      options: { lastMessages: 40 },
    },
  });

  // Or with custom configuration:
  await client.createStoredAgent({
    name: 'My Agent',
    memory: {
      observationalMemory: {
        model: 'google/gemini-2.5-flash',
        scope: 'resource',
        shareTokenBudget: true,
        observation: { messageTokens: 50000 },
        reflection: { observationTokens: 60000 },
      },
      options: { lastMessages: 40 },
    },
  });
  ```

  **Programmatic usage via editor:**

  ```ts
  await editor.agent.create({
    name: 'My Agent',
    // ...other config
    memory: {
      observationalMemory: true, // enable with defaults
      options: { lastMessages: 40 },
    },
  });

  // Or with custom configuration:
  await editor.agent.create({
    name: 'My Agent',
    memory: {
      observationalMemory: {
        model: 'google/gemini-2.5-flash',
        scope: 'resource',
        shareTokenBudget: true,
        observation: { messageTokens: 50000 },
        reflection: { observationTokens: 60000 },
      },
      options: { lastMessages: 40 },
    },
  });
  ```

- Revamped agent CMS experience with dedicated route pages for each section (Identity, Instruction Blocks, Tools, Agents, Scorers, Workflows, Memory, Variables) and sidebar navigation ([#13016](https://github.com/mastra-ai/mastra/pull/13016))

- Added ability to create sub-agents on-the-fly via a SideDialog in the Sub-Agents section of the agent editor ([#12952](https://github.com/mastra-ai/mastra/pull/12952))

### Patch Changes

- dependencies updates: ([#12949](https://github.com/mastra-ai/mastra/pull/12949))
  - Updated dependency [`@codemirror/view@^6.39.13` ↗︎](https://www.npmjs.com/package/@codemirror/view/v/6.39.13) (from `^6.39.12`, in `dependencies`)

- Removed experiment mode from the agent prompt sidebar. The system prompt is now displayed as readonly. ([#12994](https://github.com/mastra-ai/mastra/pull/12994))

- Aligned frontend rule engine types with backend, added support for greater_than_or_equal, less_than_or_equal, exists, and not_exists operators, and switched instruction blocks to use RuleGroup ([#12864](https://github.com/mastra-ai/mastra/pull/12864))

- Skip `awaitBufferStatus` calls when observational memory is disabled. Previously the Studio sidebar would unconditionally hit `/memory/observational-memory/buffer-status` after every agent message, which returns a 400 when OM is not configured and halts agent execution. ([#13025](https://github.com/mastra-ai/mastra/pull/13025))

- Fix prompt experiment localStorage persisting stale prompts: only save to localStorage when the user edits the prompt away from the code-defined value, and clear it when they match. Previously, the code-defined prompt was eagerly saved on first load, causing code changes to agent instructions to be ignored. ([#12929](https://github.com/mastra-ai/mastra/pull/12929))

- Fixed chat briefly showing an empty conversation after sending the first message on a new thread. ([#13018](https://github.com/mastra-ai/mastra/pull/13018))

- Fixed missing validation for the instructions field in the scorer creation form and replaced manual submission state tracking with the mutation hook's built-in pending state ([#12993](https://github.com/mastra-ai/mastra/pull/12993))

- Default Studio file browser to basePath when filesystem containment is disabled, preventing the browser from showing the host root directory. ([#12971](https://github.com/mastra-ai/mastra/pull/12971))

- Updated dependencies [[`7ef618f`](https://github.com/mastra-ai/mastra/commit/7ef618f3c49c27e2f6b27d7f564c557c0734325b), [`b373564`](https://github.com/mastra-ai/mastra/commit/b37356491d43b4d53067f10cb669abaf2502f218), [`927c2af`](https://github.com/mastra-ai/mastra/commit/927c2af9792286c122e04409efce0f3c804f777f), [`927c2af`](https://github.com/mastra-ai/mastra/commit/927c2af9792286c122e04409efce0f3c804f777f), [`3da8a73`](https://github.com/mastra-ai/mastra/commit/3da8a73c9b9f042d528975ca330babc99563bd12), [`927c2af`](https://github.com/mastra-ai/mastra/commit/927c2af9792286c122e04409efce0f3c804f777f), [`b896b41`](https://github.com/mastra-ai/mastra/commit/b896b41343de7fcc14442fb40fe82d189e65bbe2), [`6415277`](https://github.com/mastra-ai/mastra/commit/6415277a438faa00db2af850ead5dee25f40c428), [`4ba40dc`](https://github.com/mastra-ai/mastra/commit/4ba40dcb6c9ef31eedbb01b6d5b8b0b3c71e5b61), [`0831bbb`](https://github.com/mastra-ai/mastra/commit/0831bbb5bc750c18e9b22b45f18687c964b70828), [`63f7eda`](https://github.com/mastra-ai/mastra/commit/63f7eda605eb3e0c8c35ee3912ffe7c999c69f69), [`a5b67a3`](https://github.com/mastra-ai/mastra/commit/a5b67a3589a74415feb663a55d1858324a2afde9), [`877b02c`](https://github.com/mastra-ai/mastra/commit/877b02cdbb15e199184c7f2b8f217be8d3ebada7), [`877b02c`](https://github.com/mastra-ai/mastra/commit/877b02cdbb15e199184c7f2b8f217be8d3ebada7), [`7567222`](https://github.com/mastra-ai/mastra/commit/7567222b1366f0d39980594792dd9d5060bfe2ab), [`40f224e`](https://github.com/mastra-ai/mastra/commit/40f224ec14e9b01a36802d8c5445a547a33992a5), [`af71458`](https://github.com/mastra-ai/mastra/commit/af71458e3b566f09c11d0e5a0a836dc818e7a24a), [`eb36bd8`](https://github.com/mastra-ai/mastra/commit/eb36bd8c52fcd6ec9674ac3b7a6412405b5983e1), [`3cbf121`](https://github.com/mastra-ai/mastra/commit/3cbf121f55418141924754a83102aade89835947)]:
  - @mastra/core@1.4.0
  - @mastra/client-js@1.4.0
  - @mastra/react@0.2.3
  - @mastra/ai-sdk@1.0.4

## 11.0.0-alpha.0

### Minor Changes

- Added Datasets and Experiments UI. Includes dataset management (create, edit, delete, duplicate), item CRUD with CSV/JSON import and export, SCD-2 version browsing and comparison, experiment triggering with scorer selection, experiment results with trace visualization, and cross-experiment comparison with score deltas. Uses `coreFeatures` runtime flag for feature gating instead of build-time env var. ([#12747](https://github.com/mastra-ai/mastra/pull/12747))

- Add `workflow-step-progress` stream event for foreach workflow steps. Each iteration emits a progress event with `completedCount`, `totalCount`, `currentIndex`, `iterationStatus` (`success` | `failed` | `suspended`), and optional `iterationOutput`. Both the default and evented execution engines emit these events. ([#12838](https://github.com/mastra-ai/mastra/pull/12838))

  The Mastra Studio UI now renders a progress bar with an N/total counter on foreach nodes, updating in real time as iterations complete:

  ```ts
  // Consuming progress events from the workflow stream
  const run = workflow.createRun();
  const result = await run.start({ inputData });
  const stream = result.stream;

  for await (const chunk of stream) {
    if (chunk.type === 'workflow-step-progress') {
      console.log(`${chunk.payload.completedCount}/${chunk.payload.totalCount} - ${chunk.payload.iterationStatus}`);
    }
  }
  ```

  `@mastra/react`: The `mapWorkflowStreamChunkToWatchResult` reducer now accumulates `foreachProgress` from `workflow-step-progress` events into step state, making progress data available to React consumers via the existing workflow watch hooks.

- Added observational memory configuration support for stored agents. When creating or editing a stored agent in the playground, you can now enable observational memory and configure its settings including model provider/name, scope (thread or resource), share token budget, and detailed observer/reflector parameters like token limits, buffer settings, and blocking thresholds. The configuration is serialized as part of the agent's memory config and round-trips through storage. ([#12962](https://github.com/mastra-ai/mastra/pull/12962))

  **Example usage in the playground:**

  Enable the Observational Memory toggle in the Memory section, then configure:
  - Top-level model (provider + model) used by both observer and reflector
  - Scope: `thread` (per-conversation) or `resource` (shared across threads)
  - Expand **Observer** or **Reflector** sections to override models and tune token budgets

  **Programmatic usage via client SDK:**

  ```ts
  await client.createStoredAgent({
    name: 'My Agent',
    // ...other config
    memory: {
      observationalMemory: true, // enable with defaults
      options: { lastMessages: 40 },
    },
  });

  // Or with custom configuration:
  await client.createStoredAgent({
    name: 'My Agent',
    memory: {
      observationalMemory: {
        model: 'google/gemini-2.5-flash',
        scope: 'resource',
        shareTokenBudget: true,
        observation: { messageTokens: 50000 },
        reflection: { observationTokens: 60000 },
      },
      options: { lastMessages: 40 },
    },
  });
  ```

  **Programmatic usage via editor:**

  ```ts
  await editor.agent.create({
    name: 'My Agent',
    // ...other config
    memory: {
      observationalMemory: true, // enable with defaults
      options: { lastMessages: 40 },
    },
  });

  // Or with custom configuration:
  await editor.agent.create({
    name: 'My Agent',
    memory: {
      observationalMemory: {
        model: 'google/gemini-2.5-flash',
        scope: 'resource',
        shareTokenBudget: true,
        observation: { messageTokens: 50000 },
        reflection: { observationTokens: 60000 },
      },
      options: { lastMessages: 40 },
    },
  });
  ```

- Revamped agent CMS experience with dedicated route pages for each section (Identity, Instruction Blocks, Tools, Agents, Scorers, Workflows, Memory, Variables) and sidebar navigation ([#13016](https://github.com/mastra-ai/mastra/pull/13016))

- Added ability to create sub-agents on-the-fly via a SideDialog in the Sub-Agents section of the agent editor ([#12952](https://github.com/mastra-ai/mastra/pull/12952))

### Patch Changes

- dependencies updates: ([#12949](https://github.com/mastra-ai/mastra/pull/12949))
  - Updated dependency [`@codemirror/view@^6.39.13` ↗︎](https://www.npmjs.com/package/@codemirror/view/v/6.39.13) (from `^6.39.12`, in `dependencies`)

- Removed experiment mode from the agent prompt sidebar. The system prompt is now displayed as readonly. ([#12994](https://github.com/mastra-ai/mastra/pull/12994))

- Aligned frontend rule engine types with backend, added support for greater_than_or_equal, less_than_or_equal, exists, and not_exists operators, and switched instruction blocks to use RuleGroup ([#12864](https://github.com/mastra-ai/mastra/pull/12864))

- Skip `awaitBufferStatus` calls when observational memory is disabled. Previously the Studio sidebar would unconditionally hit `/memory/observational-memory/buffer-status` after every agent message, which returns a 400 when OM is not configured and halts agent execution. ([#13025](https://github.com/mastra-ai/mastra/pull/13025))

- Fix prompt experiment localStorage persisting stale prompts: only save to localStorage when the user edits the prompt away from the code-defined value, and clear it when they match. Previously, the code-defined prompt was eagerly saved on first load, causing code changes to agent instructions to be ignored. ([#12929](https://github.com/mastra-ai/mastra/pull/12929))

- Fixed chat briefly showing an empty conversation after sending the first message on a new thread. ([#13018](https://github.com/mastra-ai/mastra/pull/13018))

- Fixed missing validation for the instructions field in the scorer creation form and replaced manual submission state tracking with the mutation hook's built-in pending state ([#12993](https://github.com/mastra-ai/mastra/pull/12993))

- Default Studio file browser to basePath when filesystem containment is disabled, preventing the browser from showing the host root directory. ([#12971](https://github.com/mastra-ai/mastra/pull/12971))

- Updated dependencies [[`7ef618f`](https://github.com/mastra-ai/mastra/commit/7ef618f3c49c27e2f6b27d7f564c557c0734325b), [`b373564`](https://github.com/mastra-ai/mastra/commit/b37356491d43b4d53067f10cb669abaf2502f218), [`927c2af`](https://github.com/mastra-ai/mastra/commit/927c2af9792286c122e04409efce0f3c804f777f), [`927c2af`](https://github.com/mastra-ai/mastra/commit/927c2af9792286c122e04409efce0f3c804f777f), [`3da8a73`](https://github.com/mastra-ai/mastra/commit/3da8a73c9b9f042d528975ca330babc99563bd12), [`927c2af`](https://github.com/mastra-ai/mastra/commit/927c2af9792286c122e04409efce0f3c804f777f), [`b896b41`](https://github.com/mastra-ai/mastra/commit/b896b41343de7fcc14442fb40fe82d189e65bbe2), [`6415277`](https://github.com/mastra-ai/mastra/commit/6415277a438faa00db2af850ead5dee25f40c428), [`4ba40dc`](https://github.com/mastra-ai/mastra/commit/4ba40dcb6c9ef31eedbb01b6d5b8b0b3c71e5b61), [`0831bbb`](https://github.com/mastra-ai/mastra/commit/0831bbb5bc750c18e9b22b45f18687c964b70828), [`63f7eda`](https://github.com/mastra-ai/mastra/commit/63f7eda605eb3e0c8c35ee3912ffe7c999c69f69), [`a5b67a3`](https://github.com/mastra-ai/mastra/commit/a5b67a3589a74415feb663a55d1858324a2afde9), [`877b02c`](https://github.com/mastra-ai/mastra/commit/877b02cdbb15e199184c7f2b8f217be8d3ebada7), [`877b02c`](https://github.com/mastra-ai/mastra/commit/877b02cdbb15e199184c7f2b8f217be8d3ebada7), [`7567222`](https://github.com/mastra-ai/mastra/commit/7567222b1366f0d39980594792dd9d5060bfe2ab), [`40f224e`](https://github.com/mastra-ai/mastra/commit/40f224ec14e9b01a36802d8c5445a547a33992a5), [`af71458`](https://github.com/mastra-ai/mastra/commit/af71458e3b566f09c11d0e5a0a836dc818e7a24a), [`eb36bd8`](https://github.com/mastra-ai/mastra/commit/eb36bd8c52fcd6ec9674ac3b7a6412405b5983e1), [`3cbf121`](https://github.com/mastra-ai/mastra/commit/3cbf121f55418141924754a83102aade89835947)]:
  - @mastra/core@1.4.0-alpha.0
  - @mastra/client-js@1.4.0-alpha.0
  - @mastra/react@0.2.3-alpha.0
  - @mastra/ai-sdk@1.0.4

## 10.0.0

### Minor Changes

- Supporting work to allow for cloning agents via the client SDK ([#12796](https://github.com/mastra-ai/mastra/pull/12796))

- Added new agent creation page with CMS-style layout featuring Identity, Capabilities, and Revisions tabs. The page includes a prompt editor with Handlebars template support, partials management, and instruction diff viewing for revisions. ([#12569](https://github.com/mastra-ai/mastra/pull/12569))

- Added support for request context presets in Mastra Studio. You can now define a JSON file with named requestContext presets and pass it via the `--request-context-presets` CLI flag to both `mastra dev` and `mastra studio` commands. A dropdown selector appears in the Studio Playground, allowing you to quickly switch between preset configurations. ([#12501](https://github.com/mastra-ai/mastra/pull/12501))

  **Usage:**

  ```bash
  mastra dev --request-context-presets ./presets.json
  mastra studio --request-context-presets ./presets.json
  ```

  **Presets file format:**

  ```json
  {
    "development": { "userId": "dev-user", "env": "development" },
    "production": { "userId": "prod-user", "env": "production" }
  }
  ```

  When presets are loaded, a dropdown appears above the JSON editor on the Request Context page. Selecting a preset populates the editor, and manually editing the JSON automatically switches back to "Custom".

- Added multi-block instruction editing for agents. Instructions can now be split into separate blocks that are reorderable via drag-and-drop, each with optional conditional display rules based on agent variables. Includes a preview dialog to test how blocks compile with different variable values. ([#12759](https://github.com/mastra-ai/mastra/pull/12759))

- Update peer dependencies to match core package version bump (1.1.0) ([#12508](https://github.com/mastra-ai/mastra/pull/12508))

### Patch Changes

- dependencies updates: ([#11750](https://github.com/mastra-ai/mastra/pull/11750))
  - Updated dependency [`@assistant-ui/react@^0.12.3` ↗︎](https://www.npmjs.com/package/@assistant-ui/react/v/0.12.3) (from `^0.11.47`, in `dependencies`)
  - Updated dependency [`@assistant-ui/react-markdown@^0.12.1` ↗︎](https://www.npmjs.com/package/@assistant-ui/react-markdown/v/0.12.1) (from `^0.11.6`, in `dependencies`)
  - Updated dependency [`@assistant-ui/react-syntax-highlighter@^0.12.1` ↗︎](https://www.npmjs.com/package/@assistant-ui/react-syntax-highlighter/v/0.12.1) (from `^0.11.6`, in `dependencies`)

- dependencies updates: ([#11829](https://github.com/mastra-ai/mastra/pull/11829))
  - Updated dependency [`@codemirror/autocomplete@^6.20.0` ↗︎](https://www.npmjs.com/package/@codemirror/autocomplete/v/6.20.0) (from `^6.18.0`, in `dependencies`)
  - Updated dependency [`@codemirror/lang-javascript@^6.2.4` ↗︎](https://www.npmjs.com/package/@codemirror/lang-javascript/v/6.2.4) (from `^6.2.2`, in `dependencies`)
  - Updated dependency [`@codemirror/state@^6.5.4` ↗︎](https://www.npmjs.com/package/@codemirror/state/v/6.5.4) (from `^6.5.2`, in `dependencies`)
  - Updated dependency [`@codemirror/view@^6.39.12` ↗︎](https://www.npmjs.com/package/@codemirror/view/v/6.39.12) (from `^6.38.6`, in `dependencies`)

- dependencies updates: ([#11830](https://github.com/mastra-ai/mastra/pull/11830))
  - Updated dependency [`@uiw/codemirror-theme-dracula@^4.25.4` ↗︎](https://www.npmjs.com/package/@uiw/codemirror-theme-dracula/v/4.25.4) (from `^4.23.14`, in `dependencies`)

- dependencies updates: ([#11843](https://github.com/mastra-ai/mastra/pull/11843))
  - Updated dependency [`@uiw/react-codemirror@^4.25.4` ↗︎](https://www.npmjs.com/package/@uiw/react-codemirror/v/4.25.4) (from `^4.23.14`, in `dependencies`)

- dependencies updates: ([#12782](https://github.com/mastra-ai/mastra/pull/12782))
  - Updated dependency [`@uiw/codemirror-theme-github@^4.25.4` ↗︎](https://www.npmjs.com/package/@uiw/codemirror-theme-github/v/4.25.4) (from `^4.25.3`, in `dependencies`)

- Improved workspace file browser with mount point support. Mounted directories now display provider-specific icons (S3, GCS, Azure, Cloudflare, MinIO) and optional description tooltips. File entries include mount metadata for distinguishing storage providers at a glance. ([#12851](https://github.com/mastra-ai/mastra/pull/12851))

- Fix memory configuration in agent forms: ([#12704](https://github.com/mastra-ai/mastra/pull/12704))
  - Fixed memory configuration in agent forms to use `SerializedMemoryConfig` object instead of string
  - Added `MemoryConfigurator` component for proper memory settings UI
  - Fixed scorer sampling configuration to remove unsupported 'count' option
  - Added `useVectors` and `useEmbedders` hooks to fetch available options from API
  - Fixed agent creation flow to use the server-returned agent ID for navigation
  - Fixed form validation schema to properly handle memory configuration object

- Update docs links to request context ([#12144](https://github.com/mastra-ai/mastra/pull/12144))

- Supporting changes for async buffering in observational memory, including new config options, streaming events, and UI markers. ([#12891](https://github.com/mastra-ai/mastra/pull/12891))

- Fixed skill install/update/remove error toasts showing generic "Internal Server Error" instead of the actual error message. Added mount status indicators to the file browser. ([#12605](https://github.com/mastra-ai/mastra/pull/12605))

- Supporting work to enable workflow step metadata ([#12508](https://github.com/mastra-ai/mastra/pull/12508))

- Made description and instructions required fields in the scorer edit form ([#12897](https://github.com/mastra-ai/mastra/pull/12897))

- Fixed chat messages flashing when loading a thread. Messages now update reactively via useEffect instead of lazy state initialization, preventing the brief flash of empty state. ([#12863](https://github.com/mastra-ai/mastra/pull/12863))

- Fixed observational memory progress bars resetting to zero after agent responses finish. The messages and observations sidebar bars now retain their values on stream completion, cancellation, and page reload. ([#12939](https://github.com/mastra-ai/mastra/pull/12939))

- Fixed skills search dialog to correctly identify individual skills. Selection now highlights only the clicked skill, and the Installed badge only shows for the exact skill that was installed (matching by source repository + name). Gracefully handles older server versions without source info by falling back to name-only matching. ([#12678](https://github.com/mastra-ai/mastra/pull/12678))

- Updated dependencies [[`717ffab`](https://github.com/mastra-ai/mastra/commit/717ffab42cfd58ff723b5c19ada4939997773004), [`b31c922`](https://github.com/mastra-ai/mastra/commit/b31c922215b513791d98feaea1b98784aa00803a), [`e4b6dab`](https://github.com/mastra-ai/mastra/commit/e4b6dab171c5960e340b3ea3ea6da8d64d2b8672), [`6c40593`](https://github.com/mastra-ai/mastra/commit/6c40593d6d2b1b68b0c45d1a3a4c6ac5ecac3937), [`5719fa8`](https://github.com/mastra-ai/mastra/commit/5719fa8880e86e8affe698ec4b3807c7e0e0a06f), [`83cda45`](https://github.com/mastra-ai/mastra/commit/83cda4523e588558466892bff8f80f631a36945a), [`11804ad`](https://github.com/mastra-ai/mastra/commit/11804adf1d6be46ebe216be40a43b39bb8b397d7), [`11804ad`](https://github.com/mastra-ai/mastra/commit/11804adf1d6be46ebe216be40a43b39bb8b397d7), [`aa95f95`](https://github.com/mastra-ai/mastra/commit/aa95f958b186ae5c9f4219c88e268f5565c277a2), [`f8772f5`](https://github.com/mastra-ai/mastra/commit/f8772f595d34926ae2135ed4ec2e9441704d239c), [`047635c`](https://github.com/mastra-ai/mastra/commit/047635ccd7861d726c62d135560c0022a5490aec), [`90f7894`](https://github.com/mastra-ai/mastra/commit/90f7894568dc9481f40a4d29672234fae23090bb), [`f5501ae`](https://github.com/mastra-ai/mastra/commit/f5501aedb0a11106c7db7e480d6eaf3971b7bda8), [`44573af`](https://github.com/mastra-ai/mastra/commit/44573afad0a4bc86f627d6cbc0207961cdcb3bc3), [`00e3861`](https://github.com/mastra-ai/mastra/commit/00e3861863fbfee78faeb1ebbdc7c0223aae13ff), [`2e02cd7`](https://github.com/mastra-ai/mastra/commit/2e02cd7e08ba2d84a275c80d80c069d2b8b66211), [`8109aee`](https://github.com/mastra-ai/mastra/commit/8109aeeab758e16cd4255a6c36f044b70eefc6a6), [`8109aee`](https://github.com/mastra-ai/mastra/commit/8109aeeab758e16cd4255a6c36f044b70eefc6a6), [`7bfbc52`](https://github.com/mastra-ai/mastra/commit/7bfbc52a8604feb0fff2c0a082c13c0c2a3df1a2), [`42a2e13`](https://github.com/mastra-ai/mastra/commit/42a2e1388869c87d81f09fcdc58b1e9e3c99abe6), [`1445994`](https://github.com/mastra-ai/mastra/commit/1445994aee19c9334a6a101cf7bd80ca7ed4d186), [`73b0925`](https://github.com/mastra-ai/mastra/commit/73b0925b63edaeacd32b0613f83fcd1daec40846), [`61f44a2`](https://github.com/mastra-ai/mastra/commit/61f44a26861c89e364f367ff40825bdb7f19df55), [`37145d2`](https://github.com/mastra-ai/mastra/commit/37145d25f99dc31f1a9105576e5452609843ce32), [`fdad759`](https://github.com/mastra-ai/mastra/commit/fdad75939ff008b27625f5ec0ce9c6915d99d9ec), [`e4569c5`](https://github.com/mastra-ai/mastra/commit/e4569c589e00c4061a686c9eb85afe1b7050b0a8), [`be42958`](https://github.com/mastra-ai/mastra/commit/be42958d62c9f3d6b3a037580a6ef362afa47240), [`7309a85`](https://github.com/mastra-ai/mastra/commit/7309a85427281a8be23f4fb80ca52e18eaffd596), [`5bee8ea`](https://github.com/mastra-ai/mastra/commit/5bee8eaa5e25566994a10f1c76fd9e72e05f925a), [`99424f6`](https://github.com/mastra-ai/mastra/commit/99424f6862ffb679c4ec6765501486034754a4c2), [`1445994`](https://github.com/mastra-ai/mastra/commit/1445994aee19c9334a6a101cf7bd80ca7ed4d186), [`44eb452`](https://github.com/mastra-ai/mastra/commit/44eb4529b10603c279688318bebf3048543a1d61), [`a211248`](https://github.com/mastra-ai/mastra/commit/a21124845b1b1321b6075a8377c341c7f5cda1b6), [`6c40593`](https://github.com/mastra-ai/mastra/commit/6c40593d6d2b1b68b0c45d1a3a4c6ac5ecac3937), [`4493fb9`](https://github.com/mastra-ai/mastra/commit/4493fb93f68e504c8531b90fd5b2e1866bee6381), [`8c1135d`](https://github.com/mastra-ai/mastra/commit/8c1135dfb91b057283eae7ee11f9ec28753cc64f), [`dd39e54`](https://github.com/mastra-ai/mastra/commit/dd39e54ea34532c995b33bee6e0e808bf41a7341), [`b6fad9a`](https://github.com/mastra-ai/mastra/commit/b6fad9a602182b1cc0df47cd8c55004fa829ad61), [`e8f3910`](https://github.com/mastra-ai/mastra/commit/e8f3910d5323d91a69ec35ad78d14a524f54ca8a), [`4129c07`](https://github.com/mastra-ai/mastra/commit/4129c073349b5a66643fd8136ebfe9d7097cf793), [`5b930ab`](https://github.com/mastra-ai/mastra/commit/5b930aba1834d9898e8460a49d15106f31ac7c8d), [`4be93d0`](https://github.com/mastra-ai/mastra/commit/4be93d09d68e20aaf0ea3f210749422719618b5f), [`047635c`](https://github.com/mastra-ai/mastra/commit/047635ccd7861d726c62d135560c0022a5490aec), [`047635c`](https://github.com/mastra-ai/mastra/commit/047635ccd7861d726c62d135560c0022a5490aec), [`8c90ff4`](https://github.com/mastra-ai/mastra/commit/8c90ff4d3414e7f2a2d216ea91274644f7b29133), [`ed232d1`](https://github.com/mastra-ai/mastra/commit/ed232d1583f403925dc5ae45f7bee948cf2a182b), [`3891795`](https://github.com/mastra-ai/mastra/commit/38917953518eb4154a984ee36e6ededdcfe80f72), [`4f955b2`](https://github.com/mastra-ai/mastra/commit/4f955b20c7f66ed282ee1fd8709696fa64c4f19d), [`55a4c90`](https://github.com/mastra-ai/mastra/commit/55a4c9044ac7454349b9f6aeba0bbab5ee65d10f)]:
  - @mastra/core@1.3.0
  - @mastra/client-js@1.3.0
  - @mastra/ai-sdk@1.0.4
  - @mastra/react@0.2.2

## 10.0.0-alpha.3

### Patch Changes

- Fixed observational memory progress bars resetting to zero after agent responses finish. The messages and observations sidebar bars now retain their values on stream completion, cancellation, and page reload. ([#12939](https://github.com/mastra-ai/mastra/pull/12939))

- Updated dependencies [[`2e02cd7`](https://github.com/mastra-ai/mastra/commit/2e02cd7e08ba2d84a275c80d80c069d2b8b66211)]:
  - @mastra/client-js@1.3.0-alpha.3
  - @mastra/react@0.2.2-alpha.3

## 10.0.0-alpha.2

### Patch Changes

- Fixed observational memory progress bars resetting to zero after agent responses finish. The messages and observations sidebar bars now retain their values on stream completion, cancellation, and page reload. Also added a buffer-status endpoint so buffering badges resolve with accurate token counts instead of spinning forever when buffering outlives the stream. ([#12934](https://github.com/mastra-ai/mastra/pull/12934))

- Updated dependencies [[`b31c922`](https://github.com/mastra-ai/mastra/commit/b31c922215b513791d98feaea1b98784aa00803a)]:
  - @mastra/client-js@1.3.0-alpha.2
  - @mastra/core@1.3.0-alpha.2
  - @mastra/react@0.2.2-alpha.2
  - @mastra/ai-sdk@1.0.4-alpha.0

## 10.0.0-alpha.1

### Minor Changes

- Supporting work to allow for cloning agents via the client SDK ([#12796](https://github.com/mastra-ai/mastra/pull/12796))

- Added support for request context presets in Mastra Studio. You can now define a JSON file with named requestContext presets and pass it via the `--request-context-presets` CLI flag to both `mastra dev` and `mastra studio` commands. A dropdown selector appears in the Studio Playground, allowing you to quickly switch between preset configurations. ([#12501](https://github.com/mastra-ai/mastra/pull/12501))

  **Usage:**

  ```bash
  mastra dev --request-context-presets ./presets.json
  mastra studio --request-context-presets ./presets.json
  ```

  **Presets file format:**

  ```json
  {
    "development": { "userId": "dev-user", "env": "development" },
    "production": { "userId": "prod-user", "env": "production" }
  }
  ```

  When presets are loaded, a dropdown appears above the JSON editor on the Request Context page. Selecting a preset populates the editor, and manually editing the JSON automatically switches back to "Custom".

- Added multi-block instruction editing for agents. Instructions can now be split into separate blocks that are reorderable via drag-and-drop, each with optional conditional display rules based on agent variables. Includes a preview dialog to test how blocks compile with different variable values. ([#12759](https://github.com/mastra-ai/mastra/pull/12759))

- Update peer dependencies to match core package version bump (1.1.0) ([#12508](https://github.com/mastra-ai/mastra/pull/12508))

### Patch Changes

- dependencies updates: ([#11750](https://github.com/mastra-ai/mastra/pull/11750))
  - Updated dependency [`@assistant-ui/react@^0.12.3` ↗︎](https://www.npmjs.com/package/@assistant-ui/react/v/0.12.3) (from `^0.11.47`, in `dependencies`)
  - Updated dependency [`@assistant-ui/react-markdown@^0.12.1` ↗︎](https://www.npmjs.com/package/@assistant-ui/react-markdown/v/0.12.1) (from `^0.11.6`, in `dependencies`)
  - Updated dependency [`@assistant-ui/react-syntax-highlighter@^0.12.1` ↗︎](https://www.npmjs.com/package/@assistant-ui/react-syntax-highlighter/v/0.12.1) (from `^0.11.6`, in `dependencies`)

- dependencies updates: ([#11829](https://github.com/mastra-ai/mastra/pull/11829))
  - Updated dependency [`@codemirror/autocomplete@^6.20.0` ↗︎](https://www.npmjs.com/package/@codemirror/autocomplete/v/6.20.0) (from `^6.18.0`, in `dependencies`)
  - Updated dependency [`@codemirror/lang-javascript@^6.2.4` ↗︎](https://www.npmjs.com/package/@codemirror/lang-javascript/v/6.2.4) (from `^6.2.2`, in `dependencies`)
  - Updated dependency [`@codemirror/state@^6.5.4` ↗︎](https://www.npmjs.com/package/@codemirror/state/v/6.5.4) (from `^6.5.2`, in `dependencies`)
  - Updated dependency [`@codemirror/view@^6.39.12` ↗︎](https://www.npmjs.com/package/@codemirror/view/v/6.39.12) (from `^6.38.6`, in `dependencies`)

- dependencies updates: ([#11830](https://github.com/mastra-ai/mastra/pull/11830))
  - Updated dependency [`@uiw/codemirror-theme-dracula@^4.25.4` ↗︎](https://www.npmjs.com/package/@uiw/codemirror-theme-dracula/v/4.25.4) (from `^4.23.14`, in `dependencies`)

- dependencies updates: ([#11843](https://github.com/mastra-ai/mastra/pull/11843))
  - Updated dependency [`@uiw/react-codemirror@^4.25.4` ↗︎](https://www.npmjs.com/package/@uiw/react-codemirror/v/4.25.4) (from `^4.23.14`, in `dependencies`)

- dependencies updates: ([#12782](https://github.com/mastra-ai/mastra/pull/12782))
  - Updated dependency [`@uiw/codemirror-theme-github@^4.25.4` ↗︎](https://www.npmjs.com/package/@uiw/codemirror-theme-github/v/4.25.4) (from `^4.25.3`, in `dependencies`)

- Improved workspace file browser with mount point support. Mounted directories now display provider-specific icons (S3, GCS, Azure, Cloudflare, MinIO) and optional description tooltips. File entries include mount metadata for distinguishing storage providers at a glance. ([#12851](https://github.com/mastra-ai/mastra/pull/12851))

- Update docs links to request context ([#12144](https://github.com/mastra-ai/mastra/pull/12144))

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

- Fixed skill install/update/remove error toasts showing generic "Internal Server Error" instead of the actual error message. Added mount status indicators to the file browser. ([#12605](https://github.com/mastra-ai/mastra/pull/12605))

- Supporting work to enable workflow step metadata ([#12508](https://github.com/mastra-ai/mastra/pull/12508))

- Fixed chat messages flashing when loading a thread. Messages now update reactively via useEffect instead of lazy state initialization, preventing the brief flash of empty state. ([#12863](https://github.com/mastra-ai/mastra/pull/12863))

- Updated dependencies [[`717ffab`](https://github.com/mastra-ai/mastra/commit/717ffab42cfd58ff723b5c19ada4939997773004), [`e4b6dab`](https://github.com/mastra-ai/mastra/commit/e4b6dab171c5960e340b3ea3ea6da8d64d2b8672), [`6c40593`](https://github.com/mastra-ai/mastra/commit/6c40593d6d2b1b68b0c45d1a3a4c6ac5ecac3937), [`5719fa8`](https://github.com/mastra-ai/mastra/commit/5719fa8880e86e8affe698ec4b3807c7e0e0a06f), [`83cda45`](https://github.com/mastra-ai/mastra/commit/83cda4523e588558466892bff8f80f631a36945a), [`11804ad`](https://github.com/mastra-ai/mastra/commit/11804adf1d6be46ebe216be40a43b39bb8b397d7), [`11804ad`](https://github.com/mastra-ai/mastra/commit/11804adf1d6be46ebe216be40a43b39bb8b397d7), [`aa95f95`](https://github.com/mastra-ai/mastra/commit/aa95f958b186ae5c9f4219c88e268f5565c277a2), [`f8772f5`](https://github.com/mastra-ai/mastra/commit/f8772f595d34926ae2135ed4ec2e9441704d239c), [`047635c`](https://github.com/mastra-ai/mastra/commit/047635ccd7861d726c62d135560c0022a5490aec), [`f5501ae`](https://github.com/mastra-ai/mastra/commit/f5501aedb0a11106c7db7e480d6eaf3971b7bda8), [`44573af`](https://github.com/mastra-ai/mastra/commit/44573afad0a4bc86f627d6cbc0207961cdcb3bc3), [`00e3861`](https://github.com/mastra-ai/mastra/commit/00e3861863fbfee78faeb1ebbdc7c0223aae13ff), [`7bfbc52`](https://github.com/mastra-ai/mastra/commit/7bfbc52a8604feb0fff2c0a082c13c0c2a3df1a2), [`42a2e13`](https://github.com/mastra-ai/mastra/commit/42a2e1388869c87d81f09fcdc58b1e9e3c99abe6), [`1445994`](https://github.com/mastra-ai/mastra/commit/1445994aee19c9334a6a101cf7bd80ca7ed4d186), [`73b0925`](https://github.com/mastra-ai/mastra/commit/73b0925b63edaeacd32b0613f83fcd1daec40846), [`61f44a2`](https://github.com/mastra-ai/mastra/commit/61f44a26861c89e364f367ff40825bdb7f19df55), [`37145d2`](https://github.com/mastra-ai/mastra/commit/37145d25f99dc31f1a9105576e5452609843ce32), [`fdad759`](https://github.com/mastra-ai/mastra/commit/fdad75939ff008b27625f5ec0ce9c6915d99d9ec), [`e4569c5`](https://github.com/mastra-ai/mastra/commit/e4569c589e00c4061a686c9eb85afe1b7050b0a8), [`be42958`](https://github.com/mastra-ai/mastra/commit/be42958d62c9f3d6b3a037580a6ef362afa47240), [`7309a85`](https://github.com/mastra-ai/mastra/commit/7309a85427281a8be23f4fb80ca52e18eaffd596), [`5bee8ea`](https://github.com/mastra-ai/mastra/commit/5bee8eaa5e25566994a10f1c76fd9e72e05f925a), [`99424f6`](https://github.com/mastra-ai/mastra/commit/99424f6862ffb679c4ec6765501486034754a4c2), [`1445994`](https://github.com/mastra-ai/mastra/commit/1445994aee19c9334a6a101cf7bd80ca7ed4d186), [`44eb452`](https://github.com/mastra-ai/mastra/commit/44eb4529b10603c279688318bebf3048543a1d61), [`a211248`](https://github.com/mastra-ai/mastra/commit/a21124845b1b1321b6075a8377c341c7f5cda1b6), [`6c40593`](https://github.com/mastra-ai/mastra/commit/6c40593d6d2b1b68b0c45d1a3a4c6ac5ecac3937), [`4493fb9`](https://github.com/mastra-ai/mastra/commit/4493fb93f68e504c8531b90fd5b2e1866bee6381), [`8c1135d`](https://github.com/mastra-ai/mastra/commit/8c1135dfb91b057283eae7ee11f9ec28753cc64f), [`dd39e54`](https://github.com/mastra-ai/mastra/commit/dd39e54ea34532c995b33bee6e0e808bf41a7341), [`b6fad9a`](https://github.com/mastra-ai/mastra/commit/b6fad9a602182b1cc0df47cd8c55004fa829ad61), [`e8f3910`](https://github.com/mastra-ai/mastra/commit/e8f3910d5323d91a69ec35ad78d14a524f54ca8a), [`4129c07`](https://github.com/mastra-ai/mastra/commit/4129c073349b5a66643fd8136ebfe9d7097cf793), [`5b930ab`](https://github.com/mastra-ai/mastra/commit/5b930aba1834d9898e8460a49d15106f31ac7c8d), [`4be93d0`](https://github.com/mastra-ai/mastra/commit/4be93d09d68e20aaf0ea3f210749422719618b5f), [`047635c`](https://github.com/mastra-ai/mastra/commit/047635ccd7861d726c62d135560c0022a5490aec), [`047635c`](https://github.com/mastra-ai/mastra/commit/047635ccd7861d726c62d135560c0022a5490aec), [`8c90ff4`](https://github.com/mastra-ai/mastra/commit/8c90ff4d3414e7f2a2d216ea91274644f7b29133), [`ed232d1`](https://github.com/mastra-ai/mastra/commit/ed232d1583f403925dc5ae45f7bee948cf2a182b), [`3891795`](https://github.com/mastra-ai/mastra/commit/38917953518eb4154a984ee36e6ededdcfe80f72), [`4f955b2`](https://github.com/mastra-ai/mastra/commit/4f955b20c7f66ed282ee1fd8709696fa64c4f19d), [`55a4c90`](https://github.com/mastra-ai/mastra/commit/55a4c9044ac7454349b9f6aeba0bbab5ee65d10f)]:
  - @mastra/core@1.3.0-alpha.1
  - @mastra/client-js@1.3.0-alpha.1
  - @mastra/ai-sdk@1.0.4-alpha.0
  - @mastra/react@0.2.2-alpha.1

## 9.1.0-alpha.0

### Minor Changes

- Added new agent creation page with CMS-style layout featuring Identity, Capabilities, and Revisions tabs. The page includes a prompt editor with Handlebars template support, partials management, and instruction diff viewing for revisions. ([#12569](https://github.com/mastra-ai/mastra/pull/12569))

### Patch Changes

- Fix memory configuration in agent forms: ([#12704](https://github.com/mastra-ai/mastra/pull/12704))
  - Fixed memory configuration in agent forms to use `SerializedMemoryConfig` object instead of string
  - Added `MemoryConfigurator` component for proper memory settings UI
  - Fixed scorer sampling configuration to remove unsupported 'count' option
  - Added `useVectors` and `useEmbedders` hooks to fetch available options from API
  - Fixed agent creation flow to use the server-returned agent ID for navigation
  - Fixed form validation schema to properly handle memory configuration object

- Fixed skills search dialog to correctly identify individual skills. Selection now highlights only the clicked skill, and the Installed badge only shows for the exact skill that was installed (matching by source repository + name). Gracefully handles older server versions without source info by falling back to name-only matching. ([#12678](https://github.com/mastra-ai/mastra/pull/12678))

- Updated dependencies [[`90f7894`](https://github.com/mastra-ai/mastra/commit/90f7894568dc9481f40a4d29672234fae23090bb), [`8109aee`](https://github.com/mastra-ai/mastra/commit/8109aeeab758e16cd4255a6c36f044b70eefc6a6), [`8109aee`](https://github.com/mastra-ai/mastra/commit/8109aeeab758e16cd4255a6c36f044b70eefc6a6)]:
  - @mastra/core@1.2.1-alpha.0
  - @mastra/client-js@1.2.1-alpha.0
  - @mastra/react@0.2.2-alpha.0

## 9.0.0

### Minor Changes

- Add Observational Memory UI to the playground. Shows observation/reflection markers inline in the chat thread, and adds an Observational Memory panel to the agent info section with observations, reflection history, token usage, and config. All OM UI is gated behind a context provider that no-ops when OM isn't configured. ([#12599](https://github.com/mastra-ai/mastra/pull/12599))

- Added MultiCombobox component for multi-select scenarios, and JSONSchemaForm compound component for building JSON schema definitions visually. The Combobox component now supports description text on options and error states. ([#12616](https://github.com/mastra-ai/mastra/pull/12616))

- Added ContentBlocks, a reusable drag-and-drop component for building ordered lists of editable content. Also includes AgentCMSBlocks, a ready-to-use implementation for agent system prompts with add, delete, and reorder functionality. ([#12629](https://github.com/mastra-ai/mastra/pull/12629))

- Added markdown language support to CodeEditor with syntax highlighting for headings, emphasis, links, and code blocks. New `language` prop accepts 'json' (default) or 'markdown'. Added variable highlighting extension that visually distinguishes `{{variableName}}` patterns with orange styling when `highlightVariables` prop is enabled. ([#12621](https://github.com/mastra-ai/mastra/pull/12621))

- Added Add Skill dialog for browsing and installing skills from skills.sh registry. ([#12492](https://github.com/mastra-ai/mastra/pull/12492))

  **New features:**
  - Search skills or browse popular skills from skills.sh
  - Preview skill content with rendered SKILL.md (tables, code blocks, etc.)
  - Install, update, and remove skills directly from the UI
  - Shows installed status for skills already in workspace

### Patch Changes

- Use EntryCell icon prop for source indicator in agent table ([#12515](https://github.com/mastra-ai/mastra/pull/12515))

- Redesigned toast component with outline circle icons, left-aligned layout, and consistent design system styling ([#12618](https://github.com/mastra-ai/mastra/pull/12618))

- Updated Badge component styling: increased height to 28px, changed to pill shape with rounded-full, added border, and increased padding for better visual appearance. ([#12511](https://github.com/mastra-ai/mastra/pull/12511))

- Fixed custom gateway provider detection in Studio. ([#11815](https://github.com/mastra-ai/mastra/pull/11815))

  **What changed:**
  - Studio now correctly detects connected custom gateway providers (e.g., providers registered as `acme/custom` are now found when the agent uses model `acme/custom/gpt-4o`)
  - The model selector properly displays and updates models for custom gateway providers
  - "Enhance prompt" feature works correctly with custom gateway providers

  **Why:**
  Custom gateway providers are stored with a gateway prefix (e.g., `acme/custom`), but the model router extracts just the provider part (e.g., `custom`). The lookups were failing because they only did exact matching. Now both backend and frontend use fallback logic to find providers with gateway prefixes.

  Fixes #11732

- Fixed variable highlighting in markdown lists - variables like `{{name}}` now correctly display in orange inside list items. ([#12653](https://github.com/mastra-ai/mastra/pull/12653))

- Fixed the Tools page incorrectly displaying as empty when tools are defined inline in agent files. ([#12531](https://github.com/mastra-ai/mastra/pull/12531))

- Fixed rule engine bugs: type-safe comparisons for greater_than/less_than operators, array support for contains/not_contains, consistent path parsing for dot notation, and prevented Infinity/NaN strings from being converted to JS special values ([#12624](https://github.com/mastra-ai/mastra/pull/12624))

- Fixed toast imports to use custom wrapper for consistent styling ([#12618](https://github.com/mastra-ai/mastra/pull/12618))

- Fixed sidebar tooltip styling in collapsed mode by removing hardcoded color overrides ([#12537](https://github.com/mastra-ai/mastra/pull/12537))

- Added CMS block conditional rules component and unified JsonSchema types across the codebase. The new AgentCMSBlockRules component allows content blocks to be displayed conditionally based on rules. Also added jsonSchemaToFields utility for bi-directional schema conversion. ([#12651](https://github.com/mastra-ai/mastra/pull/12651))

- Improved workspace filesystem error handling: return 404 for not-found errors instead of 500, show user-friendly error messages in UI, and add MastraClientError class with status/body properties for better error handling ([#12533](https://github.com/mastra-ai/mastra/pull/12533))

- Fixed combobox dropdowns in agent create/edit dialogs to render within the modal container, preventing z-index and scrolling issues. ([#12510](https://github.com/mastra-ai/mastra/pull/12510))

- Added warning toast and banner when installing skills that aren't discovered due to missing .agents/skills path configuration. ([#12547](https://github.com/mastra-ai/mastra/pull/12547))

- Updated dependencies [[`e6fc281`](https://github.com/mastra-ai/mastra/commit/e6fc281896a3584e9e06465b356a44fe7faade65), [`97be6c8`](https://github.com/mastra-ai/mastra/commit/97be6c8963130fca8a664fcf99d7b3a38e463595), [`2770921`](https://github.com/mastra-ai/mastra/commit/2770921eec4d55a36b278d15c3a83f694e462ee5), [`b1695db`](https://github.com/mastra-ai/mastra/commit/b1695db2d7be0c329d499619c7881899649188d0), [`5fe1fe0`](https://github.com/mastra-ai/mastra/commit/5fe1fe0109faf2c87db34b725d8a4571a594f80e), [`4133d48`](https://github.com/mastra-ai/mastra/commit/4133d48eaa354cdb45920dc6265732ffbc96788d), [`abae238`](https://github.com/mastra-ai/mastra/commit/abae238c755ebaf867bbfa1a3a219ef003a1021a), [`5dd01cc`](https://github.com/mastra-ai/mastra/commit/5dd01cce68d61874aa3ecbd91ee17884cfd5aca2), [`13e0a2a`](https://github.com/mastra-ai/mastra/commit/13e0a2a2bcec01ff4d701274b3727d5e907a6a01), [`f6673b8`](https://github.com/mastra-ai/mastra/commit/f6673b893b65b7d273ad25ead42e990704cc1e17), [`cd6be8a`](https://github.com/mastra-ai/mastra/commit/cd6be8ad32741cd41cabf508355bb31b71e8a5bd), [`9eb4e8e`](https://github.com/mastra-ai/mastra/commit/9eb4e8e39efbdcfff7a40ff2ce07ce2714c65fa8), [`c987384`](https://github.com/mastra-ai/mastra/commit/c987384d6c8ca844a9701d7778f09f5a88da7f9f), [`cb8cc12`](https://github.com/mastra-ai/mastra/commit/cb8cc12bfadd526aa95a01125076f1da44e4afa7), [`aa37c84`](https://github.com/mastra-ai/mastra/commit/aa37c84d29b7db68c72517337932ef486c316275), [`62f5d50`](https://github.com/mastra-ai/mastra/commit/62f5d5043debbba497dacb7ab008fe86b38b8de3), [`47eba72`](https://github.com/mastra-ai/mastra/commit/47eba72f0397d0d14fbe324b97940c3d55e5a525)]:
  - @mastra/core@1.2.0
  - @mastra/client-js@1.2.0
  - @mastra/schema-compat@1.1.0
  - @mastra/react@0.2.1
  - @mastra/ai-sdk@1.0.3

## 9.0.0-alpha.1

### Minor Changes

- Add Observational Memory UI to the playground. Shows observation/reflection markers inline in the chat thread, and adds an Observational Memory panel to the agent info section with observations, reflection history, token usage, and config. All OM UI is gated behind a context provider that no-ops when OM isn't configured. ([#12599](https://github.com/mastra-ai/mastra/pull/12599))

- Added ContentBlocks, a reusable drag-and-drop component for building ordered lists of editable content. Also includes AgentCMSBlocks, a ready-to-use implementation for agent system prompts with add, delete, and reorder functionality. ([#12629](https://github.com/mastra-ai/mastra/pull/12629))

### Patch Changes

- Fixed variable highlighting in markdown lists - variables like `{{name}}` now correctly display in orange inside list items. ([#12653](https://github.com/mastra-ai/mastra/pull/12653))

- Fixed rule engine bugs: type-safe comparisons for greater_than/less_than operators, array support for contains/not_contains, consistent path parsing for dot notation, and prevented Infinity/NaN strings from being converted to JS special values ([#12624](https://github.com/mastra-ai/mastra/pull/12624))

- Added CMS block conditional rules component and unified JsonSchema types across the codebase. The new AgentCMSBlockRules component allows content blocks to be displayed conditionally based on rules. Also added jsonSchemaToFields utility for bi-directional schema conversion. ([#12651](https://github.com/mastra-ai/mastra/pull/12651))

- Added warning toast and banner when installing skills that aren't discovered due to missing .agents/skills path configuration. ([#12547](https://github.com/mastra-ai/mastra/pull/12547))

- Updated dependencies [[`2770921`](https://github.com/mastra-ai/mastra/commit/2770921eec4d55a36b278d15c3a83f694e462ee5), [`b1695db`](https://github.com/mastra-ai/mastra/commit/b1695db2d7be0c329d499619c7881899649188d0), [`4133d48`](https://github.com/mastra-ai/mastra/commit/4133d48eaa354cdb45920dc6265732ffbc96788d), [`abae238`](https://github.com/mastra-ai/mastra/commit/abae238c755ebaf867bbfa1a3a219ef003a1021a), [`5dd01cc`](https://github.com/mastra-ai/mastra/commit/5dd01cce68d61874aa3ecbd91ee17884cfd5aca2), [`13e0a2a`](https://github.com/mastra-ai/mastra/commit/13e0a2a2bcec01ff4d701274b3727d5e907a6a01), [`c987384`](https://github.com/mastra-ai/mastra/commit/c987384d6c8ca844a9701d7778f09f5a88da7f9f), [`cb8cc12`](https://github.com/mastra-ai/mastra/commit/cb8cc12bfadd526aa95a01125076f1da44e4afa7), [`62f5d50`](https://github.com/mastra-ai/mastra/commit/62f5d5043debbba497dacb7ab008fe86b38b8de3)]:
  - @mastra/client-js@1.2.0-alpha.1
  - @mastra/core@1.2.0-alpha.1
  - @mastra/schema-compat@1.1.0-alpha.0
  - @mastra/react@0.2.1-alpha.1
  - @mastra/ai-sdk@1.0.3

## 8.1.0-alpha.0

### Minor Changes

- Added MultiCombobox component for multi-select scenarios, and JSONSchemaForm compound component for building JSON schema definitions visually. The Combobox component now supports description text on options and error states. ([#12616](https://github.com/mastra-ai/mastra/pull/12616))

- Added markdown language support to CodeEditor with syntax highlighting for headings, emphasis, links, and code blocks. New `language` prop accepts 'json' (default) or 'markdown'. Added variable highlighting extension that visually distinguishes `{{variableName}}` patterns with orange styling when `highlightVariables` prop is enabled. ([#12621](https://github.com/mastra-ai/mastra/pull/12621))

- Added Add Skill dialog for browsing and installing skills from skills.sh registry. ([#12492](https://github.com/mastra-ai/mastra/pull/12492))

  **New features:**
  - Search skills or browse popular skills from skills.sh
  - Preview skill content with rendered SKILL.md (tables, code blocks, etc.)
  - Install, update, and remove skills directly from the UI
  - Shows installed status for skills already in workspace

### Patch Changes

- Use EntryCell icon prop for source indicator in agent table ([#12515](https://github.com/mastra-ai/mastra/pull/12515))

- Redesigned toast component with outline circle icons, left-aligned layout, and consistent design system styling ([#12618](https://github.com/mastra-ai/mastra/pull/12618))

- Updated Badge component styling: increased height to 28px, changed to pill shape with rounded-full, added border, and increased padding for better visual appearance. ([#12511](https://github.com/mastra-ai/mastra/pull/12511))

- Fixed custom gateway provider detection in Studio. ([#11815](https://github.com/mastra-ai/mastra/pull/11815))

  **What changed:**
  - Studio now correctly detects connected custom gateway providers (e.g., providers registered as `acme/custom` are now found when the agent uses model `acme/custom/gpt-4o`)
  - The model selector properly displays and updates models for custom gateway providers
  - "Enhance prompt" feature works correctly with custom gateway providers

  **Why:**
  Custom gateway providers are stored with a gateway prefix (e.g., `acme/custom`), but the model router extracts just the provider part (e.g., `custom`). The lookups were failing because they only did exact matching. Now both backend and frontend use fallback logic to find providers with gateway prefixes.

  Fixes #11732

- Fixed the Tools page incorrectly displaying as empty when tools are defined inline in agent files. ([#12531](https://github.com/mastra-ai/mastra/pull/12531))

- Fixed toast imports to use custom wrapper for consistent styling ([#12618](https://github.com/mastra-ai/mastra/pull/12618))

- Fixed sidebar tooltip styling in collapsed mode by removing hardcoded color overrides ([#12537](https://github.com/mastra-ai/mastra/pull/12537))

- Improved workspace filesystem error handling: return 404 for not-found errors instead of 500, show user-friendly error messages in UI, and add MastraClientError class with status/body properties for better error handling ([#12533](https://github.com/mastra-ai/mastra/pull/12533))

- Fixed combobox dropdowns in agent create/edit dialogs to render within the modal container, preventing z-index and scrolling issues. ([#12510](https://github.com/mastra-ai/mastra/pull/12510))

- Updated dependencies [[`e6fc281`](https://github.com/mastra-ai/mastra/commit/e6fc281896a3584e9e06465b356a44fe7faade65), [`97be6c8`](https://github.com/mastra-ai/mastra/commit/97be6c8963130fca8a664fcf99d7b3a38e463595), [`5fe1fe0`](https://github.com/mastra-ai/mastra/commit/5fe1fe0109faf2c87db34b725d8a4571a594f80e), [`f6673b8`](https://github.com/mastra-ai/mastra/commit/f6673b893b65b7d273ad25ead42e990704cc1e17), [`cd6be8a`](https://github.com/mastra-ai/mastra/commit/cd6be8ad32741cd41cabf508355bb31b71e8a5bd), [`9eb4e8e`](https://github.com/mastra-ai/mastra/commit/9eb4e8e39efbdcfff7a40ff2ce07ce2714c65fa8), [`aa37c84`](https://github.com/mastra-ai/mastra/commit/aa37c84d29b7db68c72517337932ef486c316275), [`47eba72`](https://github.com/mastra-ai/mastra/commit/47eba72f0397d0d14fbe324b97940c3d55e5a525)]:
  - @mastra/core@1.2.0-alpha.0
  - @mastra/client-js@1.1.1-alpha.0
  - @mastra/react@0.2.1-alpha.0

## 8.0.0

### Minor Changes

- Moved model provider and model selection dropdowns from the agent side panel to the chat composer area for easier access during conversations ([#12407](https://github.com/mastra-ai/mastra/pull/12407))

- Refactored Combobox component to use @base-ui/react instead of custom Radix UI Popover implementation. This removes ~70 lines of manual keyboard navigation code while preserving the same props interface and styling. ([#12377](https://github.com/mastra-ai/mastra/pull/12377))

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

- Added Command component (CMDK) with CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandSeparator, and CommandShortcut subcomponents for building command palettes and searchable menus ([#12360](https://github.com/mastra-ai/mastra/pull/12360))

- Bump playground-ui to v7.1.0 ([#12186](https://github.com/mastra-ai/mastra/pull/12186))

- Added keyboard navigation support to Table component with new `useTableKeyboardNavigation` hook and `isActive` prop on Row ([#12352](https://github.com/mastra-ai/mastra/pull/12352))

- Added global command palette (Cmd+K) for quick navigation to any entity in Mastra Studio. Press Cmd+K (or Ctrl+K on Windows/Linux) to search and navigate to agents, workflows, tools, scorers, processors, and MCP servers. ([#12360](https://github.com/mastra-ai/mastra/pull/12360))

- Improved command palette with sidebar toggle, direct links to agent/workflow traces, and preserved search result ordering ([#12406](https://github.com/mastra-ai/mastra/pull/12406))

- Added workspace UI components for the Mastra playground. ([#11986](https://github.com/mastra-ai/mastra/pull/11986))

  **New components:**
  - `FileBrowser` - Browse and manage workspace files with breadcrumb navigation
  - `FileViewer` - View file contents with syntax highlighting
  - `SkillsTable` - List and search available skills
  - `SkillDetail` - View skill details, instructions, and references
  - `SearchPanel` - Search workspace content with BM25/vector/hybrid modes
  - `ReferenceViewerDialog` - View skill reference file contents

  **Usage:**

  ```tsx
  import { FileBrowser, FileViewer, SkillsTable } from '@mastra/playground-ui';

  // File browser with navigation
  <FileBrowser
    entries={files}
    currentPath="/docs"
    onNavigate={setPath}
    onFileSelect={handleFileSelect}
  />

  // Skills table with search
  <SkillsTable
    skills={skills}
    onSkillSelect={handleSkillSelect}
  />
  ```

- Developers can now configure a custom API route prefix in the Studio UI, enabling Studio to work with servers using custom base paths (e.g., `/mastra` instead of the default `/api`). See #12261 for more details. ([#12295](https://github.com/mastra-ai/mastra/pull/12295))

### Patch Changes

- Fix link to evals documentation ([#12122](https://github.com/mastra-ai/mastra/pull/12122))

- Added ghost variant support to domain comboboxes (AgentCombobox, WorkflowCombobox, MCPServerCombobox, ScorerCombobox, ToolCombobox) and moved them into the breadcrumb for a cleaner navigation pattern ([#12357](https://github.com/mastra-ai/mastra/pull/12357))

- Added processor combobox to processor page header for quick navigation between processors ([#12368](https://github.com/mastra-ai/mastra/pull/12368))

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

- Added Request Context tab to Tools, Agents, and Workflows in Mastra Studio. When an entity defines a requestContextSchema, a form is displayed allowing you to input context values before execution. ([#12259](https://github.com/mastra-ai/mastra/pull/12259))

- Fixed keyboard events in command palette propagating to underlying page elements like tables ([#12458](https://github.com/mastra-ai/mastra/pull/12458))

- fix workflow run input caching bug in studio UI ([#11784](https://github.com/mastra-ai/mastra/pull/11784))

- Refactored agent model dropdowns to use the Combobox design system component, reducing code complexity while preserving all features including custom model ID support and provider connection status indicators. ([#12367](https://github.com/mastra-ai/mastra/pull/12367))

- Fixed model combobox auto-opening on mount. The model selector now only opens when explicitly changing providers, improving the initial page load experience. ([#12456](https://github.com/mastra-ai/mastra/pull/12456))

- Fixed legacy agent runs so each request now gets a unique run ID, improving trace readability in observability tools. ([#12229](https://github.com/mastra-ai/mastra/pull/12229))

- Improved skill activation styling with cleaner badge appearance and dark-themed tooltip on hover. ([#12487](https://github.com/mastra-ai/mastra/pull/12487))

- Added workflow run ID to breadcrumbs with truncation and copy functionality ([#12409](https://github.com/mastra-ai/mastra/pull/12409))

- Refactored WorkflowTrigger component into focused sub-components for better maintainability. Extracted WorkflowTriggerForm, WorkflowSuspendedSteps, WorkflowCancelButton, and WorkflowStepsStatus. Added useSuspendedSteps and useWorkflowSchemas hooks for memoized computations. No changes to public API. ([#12349](https://github.com/mastra-ai/mastra/pull/12349))

- Use useExecuteWorkflow hook from @mastra/react instead of local implementation in playground-ui ([#12138](https://github.com/mastra-ai/mastra/pull/12138))

- Refined color palette for a more polished dark theme. Surfaces now use warm near-blacks, accents are softer and less neon, borders are subtle white overlays for a modern look. ([#12350](https://github.com/mastra-ai/mastra/pull/12350))

- Added useCancelWorkflowRun hook to @mastra/react for canceling workflow runs. This hook was previously only available internally in playground-ui and is now exported for use in custom applications. ([#12142](https://github.com/mastra-ai/mastra/pull/12142))

- Fixed skill detail page crashing when skills have object-typed compatibility or metadata fields. Skills from skills.sh and other external sources now display correctly. ([#12491](https://github.com/mastra-ai/mastra/pull/12491))

- Remove hardcoded temperature: 0.5 and topP: 1 defaults from playground agent settings ([#12256](https://github.com/mastra-ai/mastra/pull/12256))
  Let agent config and provider defaults handle these values instead

- Added useStreamWorkflow hook to @mastra/react for streaming workflow execution. This hook supports streaming, observing, resuming, and time-traveling workflows. It accepts tracingOptions and onError as parameters for better customization. ([#12151](https://github.com/mastra-ai/mastra/pull/12151))

- Added view transitions to internal sidebar navigation links for smoother page transitions ([#12358](https://github.com/mastra-ai/mastra/pull/12358))

- Added raw SKILL.md source view in skill detail page. The 'Source' toggle now shows the full file contents including YAML frontmatter. ([#12497](https://github.com/mastra-ai/mastra/pull/12497))

- Added IconButton design system component that combines button styling with built-in tooltip support. Replaced TooltipIconButton with IconButton throughout the chat interface for consistency. ([#12410](https://github.com/mastra-ai/mastra/pull/12410))

- Updated dependencies [[`90fc0e5`](https://github.com/mastra-ai/mastra/commit/90fc0e5717cb280c2d4acf4f0410b510bb4c0a72), [`1cf5d2e`](https://github.com/mastra-ai/mastra/commit/1cf5d2ea1b085be23e34fb506c80c80a4e6d9c2b), [`b99ceac`](https://github.com/mastra-ai/mastra/commit/b99ceace2c830dbdef47c8692d56a91954aefea2), [`deea43e`](https://github.com/mastra-ai/mastra/commit/deea43eb1366d03a864c5e597d16a48592b9893f), [`60d9d89`](https://github.com/mastra-ai/mastra/commit/60d9d899e44b35bc43f1bcd967a74e0ce010b1af), [`833ae96`](https://github.com/mastra-ai/mastra/commit/833ae96c3e34370e58a1e979571c41f39a720592), [`943772b`](https://github.com/mastra-ai/mastra/commit/943772b4378f625f0f4e19ea2b7c392bd8e71786), [`b5c711b`](https://github.com/mastra-ai/mastra/commit/b5c711b281dd1fb81a399a766bc9f86c55efc13e), [`0350626`](https://github.com/mastra-ai/mastra/commit/03506267ec41b67add80d994c0c0fcce93bbc75f), [`3efbe5a`](https://github.com/mastra-ai/mastra/commit/3efbe5ae20864c4f3143457f4f3ee7dc2fa5ca76), [`1e49e7a`](https://github.com/mastra-ai/mastra/commit/1e49e7ab5f173582154cb26b29d424de67d09aef), [`751eaab`](https://github.com/mastra-ai/mastra/commit/751eaab4e0d3820a94e4c3d39a2ff2663ded3d91), [`69d8156`](https://github.com/mastra-ai/mastra/commit/69d81568bcf062557c24471ce26812446bec465d), [`60d9d89`](https://github.com/mastra-ai/mastra/commit/60d9d899e44b35bc43f1bcd967a74e0ce010b1af), [`5c544c8`](https://github.com/mastra-ai/mastra/commit/5c544c8d12b08ab40d64d8f37b3c4215bee95b87), [`771ad96`](https://github.com/mastra-ai/mastra/commit/771ad962441996b5c43549391a3e6a02c6ddedc2), [`2b0936b`](https://github.com/mastra-ai/mastra/commit/2b0936b0c9a43eeed9bef63e614d7e02ee803f7e), [`3b04f30`](https://github.com/mastra-ai/mastra/commit/3b04f3010604f3cdfc8a0674731700ad66471cee), [`97e26de`](https://github.com/mastra-ai/mastra/commit/97e26deaebd9836647a67b96423281d66421ca07), [`ac9ec66`](https://github.com/mastra-ai/mastra/commit/ac9ec6672779b2e6d4344e415481d1a6a7d4911a), [`dc82e6c`](https://github.com/mastra-ai/mastra/commit/dc82e6c5a05d6a9160c522af08b8c809ddbcdb66), [`dc82e6c`](https://github.com/mastra-ai/mastra/commit/dc82e6c5a05d6a9160c522af08b8c809ddbcdb66), [`10523f4`](https://github.com/mastra-ai/mastra/commit/10523f4882d9b874b40ce6e3715f66dbcd4947d2), [`cb72d20`](https://github.com/mastra-ai/mastra/commit/cb72d2069d7339bda8a0e76d4f35615debb07b84), [`42856b1`](https://github.com/mastra-ai/mastra/commit/42856b1c8aeea6371c9ee77ae2f5f5fe34400933), [`70237c5`](https://github.com/mastra-ai/mastra/commit/70237c51e9e92332eb55d6e3c6dd7f1ea8435d26), [`66f33ff`](https://github.com/mastra-ai/mastra/commit/66f33ff68620018513e499c394411d1d39b3aa5c), [`910367c`](https://github.com/mastra-ai/mastra/commit/910367ce8f89905bd1d958ccfdf0ba1e713696aa), [`ab3c190`](https://github.com/mastra-ai/mastra/commit/ab3c1901980a99910ca9b96a7090c22e24060113), [`d4f06c8`](https://github.com/mastra-ai/mastra/commit/d4f06c85ffa5bb0da38fb82ebf3b040cc6b4ec4e), [`0caf854`](https://github.com/mastra-ai/mastra/commit/0caf854cdeea7bd524e5149de9df56e862be4bc9), [`1d70a4a`](https://github.com/mastra-ai/mastra/commit/1d70a4a6d53c3f2571544dc0767f2c5f4e445ba0), [`0350626`](https://github.com/mastra-ai/mastra/commit/03506267ec41b67add80d994c0c0fcce93bbc75f), [`a64a24c`](https://github.com/mastra-ai/mastra/commit/a64a24c9bce499b989667c7963f2f71a11d90334), [`bc9fa00`](https://github.com/mastra-ai/mastra/commit/bc9fa00859c5c4a796d53a0a5cae46ab4a3072e4), [`f46a478`](https://github.com/mastra-ai/mastra/commit/f46a4782f595949c696569e891f81c8d26338508), [`90fc0e5`](https://github.com/mastra-ai/mastra/commit/90fc0e5717cb280c2d4acf4f0410b510bb4c0a72), [`f05a3a5`](https://github.com/mastra-ai/mastra/commit/f05a3a5cf2b9a9c2d40c09cb8c762a4b6cd5d565), [`a64a24c`](https://github.com/mastra-ai/mastra/commit/a64a24c9bce499b989667c7963f2f71a11d90334), [`a291da9`](https://github.com/mastra-ai/mastra/commit/a291da9363efd92dafd8775dccb4f2d0511ece7a), [`c5d71da`](https://github.com/mastra-ai/mastra/commit/c5d71da1c680ce5640b1a7f8ca0e024a4ab1cfed), [`07042f9`](https://github.com/mastra-ai/mastra/commit/07042f9f89080f38b8f72713ba1c972d5b1905b8), [`0423442`](https://github.com/mastra-ai/mastra/commit/0423442b7be2dfacba95890bea8f4a810db4d603)]:
  - @mastra/core@1.1.0
  - @mastra/client-js@1.1.0
  - @mastra/react@0.2.0
  - @mastra/ai-sdk@1.0.3

## 8.0.0-alpha.3

### Patch Changes

- Updated dependencies [[`a64a24c`](https://github.com/mastra-ai/mastra/commit/a64a24c9bce499b989667c7963f2f71a11d90334), [`a64a24c`](https://github.com/mastra-ai/mastra/commit/a64a24c9bce499b989667c7963f2f71a11d90334)]:
  - @mastra/client-js@1.1.0-alpha.2
  - @mastra/react@0.2.0-alpha.2
  - @mastra/ai-sdk@1.0.3-alpha.0
  - @mastra/core@1.1.0-alpha.2

## 8.0.0-alpha.2

### Patch Changes

- Added raw SKILL.md source view in skill detail page. The 'Source' toggle now shows the full file contents including YAML frontmatter. ([#12497](https://github.com/mastra-ai/mastra/pull/12497))

## 8.0.0-alpha.1

### Patch Changes

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

- Improved skill activation styling with cleaner badge appearance and dark-themed tooltip on hover. ([#12487](https://github.com/mastra-ai/mastra/pull/12487))

- Fixed skill detail page crashing when skills have object-typed compatibility or metadata fields. Skills from skills.sh and other external sources now display correctly. ([#12491](https://github.com/mastra-ai/mastra/pull/12491))

- Updated dependencies [[`b99ceac`](https://github.com/mastra-ai/mastra/commit/b99ceace2c830dbdef47c8692d56a91954aefea2), [`deea43e`](https://github.com/mastra-ai/mastra/commit/deea43eb1366d03a864c5e597d16a48592b9893f), [`ac9ec66`](https://github.com/mastra-ai/mastra/commit/ac9ec6672779b2e6d4344e415481d1a6a7d4911a)]:
  - @mastra/core@1.1.0-alpha.1
  - @mastra/client-js@1.1.0-alpha.1
  - @mastra/react@0.2.0-alpha.1
  - @mastra/ai-sdk@1.0.3-alpha.0

## 8.0.0-alpha.0

### Minor Changes

- Moved model provider and model selection dropdowns from the agent side panel to the chat composer area for easier access during conversations ([#12407](https://github.com/mastra-ai/mastra/pull/12407))

- Refactored Combobox component to use @base-ui/react instead of custom Radix UI Popover implementation. This removes ~70 lines of manual keyboard navigation code while preserving the same props interface and styling. ([#12377](https://github.com/mastra-ai/mastra/pull/12377))

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

- Added Command component (CMDK) with CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandSeparator, and CommandShortcut subcomponents for building command palettes and searchable menus ([#12360](https://github.com/mastra-ai/mastra/pull/12360))

- Bump playground-ui to v7.1.0 ([#12186](https://github.com/mastra-ai/mastra/pull/12186))

- Added keyboard navigation support to Table component with new `useTableKeyboardNavigation` hook and `isActive` prop on Row ([#12352](https://github.com/mastra-ai/mastra/pull/12352))

- Added global command palette (Cmd+K) for quick navigation to any entity in Mastra Studio. Press Cmd+K (or Ctrl+K on Windows/Linux) to search and navigate to agents, workflows, tools, scorers, processors, and MCP servers. ([#12360](https://github.com/mastra-ai/mastra/pull/12360))

- Improved command palette with sidebar toggle, direct links to agent/workflow traces, and preserved search result ordering ([#12406](https://github.com/mastra-ai/mastra/pull/12406))

- Added workspace UI components for the Mastra playground. ([#11986](https://github.com/mastra-ai/mastra/pull/11986))

  **New components:**
  - `FileBrowser` - Browse and manage workspace files with breadcrumb navigation
  - `FileViewer` - View file contents with syntax highlighting
  - `SkillsTable` - List and search available skills
  - `SkillDetail` - View skill details, instructions, and references
  - `SearchPanel` - Search workspace content with BM25/vector/hybrid modes
  - `ReferenceViewerDialog` - View skill reference file contents

  **Usage:**

  ```tsx
  import { FileBrowser, FileViewer, SkillsTable } from '@mastra/playground-ui';

  // File browser with navigation
  <FileBrowser
    entries={files}
    currentPath="/docs"
    onNavigate={setPath}
    onFileSelect={handleFileSelect}
  />

  // Skills table with search
  <SkillsTable
    skills={skills}
    onSkillSelect={handleSkillSelect}
  />
  ```

- Developers can now configure a custom API route prefix in the Studio UI, enabling Studio to work with servers using custom base paths (e.g., `/mastra` instead of the default `/api`). See #12261 for more details. ([#12295](https://github.com/mastra-ai/mastra/pull/12295))

### Patch Changes

- Fix link to evals documentation ([#12122](https://github.com/mastra-ai/mastra/pull/12122))

- Added ghost variant support to domain comboboxes (AgentCombobox, WorkflowCombobox, MCPServerCombobox, ScorerCombobox, ToolCombobox) and moved them into the breadcrumb for a cleaner navigation pattern ([#12357](https://github.com/mastra-ai/mastra/pull/12357))

- Added processor combobox to processor page header for quick navigation between processors ([#12368](https://github.com/mastra-ai/mastra/pull/12368))

- Added Request Context tab to Tools, Agents, and Workflows in Mastra Studio. When an entity defines a requestContextSchema, a form is displayed allowing you to input context values before execution. ([#12259](https://github.com/mastra-ai/mastra/pull/12259))

- Fixed keyboard events in command palette propagating to underlying page elements like tables ([#12458](https://github.com/mastra-ai/mastra/pull/12458))

- fix workflow run input caching bug in studio UI ([#11784](https://github.com/mastra-ai/mastra/pull/11784))

- Refactored agent model dropdowns to use the Combobox design system component, reducing code complexity while preserving all features including custom model ID support and provider connection status indicators. ([#12367](https://github.com/mastra-ai/mastra/pull/12367))

- Fixed model combobox auto-opening on mount. The model selector now only opens when explicitly changing providers, improving the initial page load experience. ([#12456](https://github.com/mastra-ai/mastra/pull/12456))

- Fixed legacy agent runs so each request now gets a unique run ID, improving trace readability in observability tools. ([#12229](https://github.com/mastra-ai/mastra/pull/12229))

- Added workflow run ID to breadcrumbs with truncation and copy functionality ([#12409](https://github.com/mastra-ai/mastra/pull/12409))

- Refactored WorkflowTrigger component into focused sub-components for better maintainability. Extracted WorkflowTriggerForm, WorkflowSuspendedSteps, WorkflowCancelButton, and WorkflowStepsStatus. Added useSuspendedSteps and useWorkflowSchemas hooks for memoized computations. No changes to public API. ([#12349](https://github.com/mastra-ai/mastra/pull/12349))

- Use useExecuteWorkflow hook from @mastra/react instead of local implementation in playground-ui ([#12138](https://github.com/mastra-ai/mastra/pull/12138))

- Refined color palette for a more polished dark theme. Surfaces now use warm near-blacks, accents are softer and less neon, borders are subtle white overlays for a modern look. ([#12350](https://github.com/mastra-ai/mastra/pull/12350))

- Added useCancelWorkflowRun hook to @mastra/react for canceling workflow runs. This hook was previously only available internally in playground-ui and is now exported for use in custom applications. ([#12142](https://github.com/mastra-ai/mastra/pull/12142))

- Remove hardcoded temperature: 0.5 and topP: 1 defaults from playground agent settings ([#12256](https://github.com/mastra-ai/mastra/pull/12256))
  Let agent config and provider defaults handle these values instead

- Added useStreamWorkflow hook to @mastra/react for streaming workflow execution. This hook supports streaming, observing, resuming, and time-traveling workflows. It accepts tracingOptions and onError as parameters for better customization. ([#12151](https://github.com/mastra-ai/mastra/pull/12151))

- Added view transitions to internal sidebar navigation links for smoother page transitions ([#12358](https://github.com/mastra-ai/mastra/pull/12358))

- Added IconButton design system component that combines button styling with built-in tooltip support. Replaced TooltipIconButton with IconButton throughout the chat interface for consistency. ([#12410](https://github.com/mastra-ai/mastra/pull/12410))

- Updated dependencies [[`90fc0e5`](https://github.com/mastra-ai/mastra/commit/90fc0e5717cb280c2d4acf4f0410b510bb4c0a72), [`1cf5d2e`](https://github.com/mastra-ai/mastra/commit/1cf5d2ea1b085be23e34fb506c80c80a4e6d9c2b), [`60d9d89`](https://github.com/mastra-ai/mastra/commit/60d9d899e44b35bc43f1bcd967a74e0ce010b1af), [`833ae96`](https://github.com/mastra-ai/mastra/commit/833ae96c3e34370e58a1e979571c41f39a720592), [`943772b`](https://github.com/mastra-ai/mastra/commit/943772b4378f625f0f4e19ea2b7c392bd8e71786), [`b5c711b`](https://github.com/mastra-ai/mastra/commit/b5c711b281dd1fb81a399a766bc9f86c55efc13e), [`0350626`](https://github.com/mastra-ai/mastra/commit/03506267ec41b67add80d994c0c0fcce93bbc75f), [`3efbe5a`](https://github.com/mastra-ai/mastra/commit/3efbe5ae20864c4f3143457f4f3ee7dc2fa5ca76), [`1e49e7a`](https://github.com/mastra-ai/mastra/commit/1e49e7ab5f173582154cb26b29d424de67d09aef), [`751eaab`](https://github.com/mastra-ai/mastra/commit/751eaab4e0d3820a94e4c3d39a2ff2663ded3d91), [`69d8156`](https://github.com/mastra-ai/mastra/commit/69d81568bcf062557c24471ce26812446bec465d), [`60d9d89`](https://github.com/mastra-ai/mastra/commit/60d9d899e44b35bc43f1bcd967a74e0ce010b1af), [`5c544c8`](https://github.com/mastra-ai/mastra/commit/5c544c8d12b08ab40d64d8f37b3c4215bee95b87), [`771ad96`](https://github.com/mastra-ai/mastra/commit/771ad962441996b5c43549391a3e6a02c6ddedc2), [`2b0936b`](https://github.com/mastra-ai/mastra/commit/2b0936b0c9a43eeed9bef63e614d7e02ee803f7e), [`3b04f30`](https://github.com/mastra-ai/mastra/commit/3b04f3010604f3cdfc8a0674731700ad66471cee), [`97e26de`](https://github.com/mastra-ai/mastra/commit/97e26deaebd9836647a67b96423281d66421ca07), [`dc82e6c`](https://github.com/mastra-ai/mastra/commit/dc82e6c5a05d6a9160c522af08b8c809ddbcdb66), [`dc82e6c`](https://github.com/mastra-ai/mastra/commit/dc82e6c5a05d6a9160c522af08b8c809ddbcdb66), [`10523f4`](https://github.com/mastra-ai/mastra/commit/10523f4882d9b874b40ce6e3715f66dbcd4947d2), [`cb72d20`](https://github.com/mastra-ai/mastra/commit/cb72d2069d7339bda8a0e76d4f35615debb07b84), [`42856b1`](https://github.com/mastra-ai/mastra/commit/42856b1c8aeea6371c9ee77ae2f5f5fe34400933), [`70237c5`](https://github.com/mastra-ai/mastra/commit/70237c51e9e92332eb55d6e3c6dd7f1ea8435d26), [`66f33ff`](https://github.com/mastra-ai/mastra/commit/66f33ff68620018513e499c394411d1d39b3aa5c), [`910367c`](https://github.com/mastra-ai/mastra/commit/910367ce8f89905bd1d958ccfdf0ba1e713696aa), [`ab3c190`](https://github.com/mastra-ai/mastra/commit/ab3c1901980a99910ca9b96a7090c22e24060113), [`d4f06c8`](https://github.com/mastra-ai/mastra/commit/d4f06c85ffa5bb0da38fb82ebf3b040cc6b4ec4e), [`0caf854`](https://github.com/mastra-ai/mastra/commit/0caf854cdeea7bd524e5149de9df56e862be4bc9), [`1d70a4a`](https://github.com/mastra-ai/mastra/commit/1d70a4a6d53c3f2571544dc0767f2c5f4e445ba0), [`0350626`](https://github.com/mastra-ai/mastra/commit/03506267ec41b67add80d994c0c0fcce93bbc75f), [`bc9fa00`](https://github.com/mastra-ai/mastra/commit/bc9fa00859c5c4a796d53a0a5cae46ab4a3072e4), [`f46a478`](https://github.com/mastra-ai/mastra/commit/f46a4782f595949c696569e891f81c8d26338508), [`90fc0e5`](https://github.com/mastra-ai/mastra/commit/90fc0e5717cb280c2d4acf4f0410b510bb4c0a72), [`f05a3a5`](https://github.com/mastra-ai/mastra/commit/f05a3a5cf2b9a9c2d40c09cb8c762a4b6cd5d565), [`a291da9`](https://github.com/mastra-ai/mastra/commit/a291da9363efd92dafd8775dccb4f2d0511ece7a), [`c5d71da`](https://github.com/mastra-ai/mastra/commit/c5d71da1c680ce5640b1a7f8ca0e024a4ab1cfed), [`07042f9`](https://github.com/mastra-ai/mastra/commit/07042f9f89080f38b8f72713ba1c972d5b1905b8), [`0423442`](https://github.com/mastra-ai/mastra/commit/0423442b7be2dfacba95890bea8f4a810db4d603)]:
  - @mastra/core@1.1.0-alpha.0
  - @mastra/client-js@1.1.0-alpha.0
  - @mastra/react@0.2.0-alpha.0
  - @mastra/ai-sdk@1.0.3-alpha.0

## 7.0.1

### Patch Changes

- Updated dependencies [[`4dc9a51`](https://github.com/mastra-ai/mastra/commit/4dc9a51be626fd9ed51da3ad7e78dedeaabade88)]:
  - @mastra/ai-sdk@1.0.2
  - @mastra/core@1.0.4
  - @mastra/client-js@1.0.1
  - @mastra/react@0.1.1

## 7.0.1-alpha.0

### Patch Changes

- Updated dependencies [[`4dc9a51`](https://github.com/mastra-ai/mastra/commit/4dc9a51be626fd9ed51da3ad7e78dedeaabade88)]:
  - @mastra/ai-sdk@1.0.2-alpha.0
  - @mastra/core@1.0.4-alpha.0
  - @mastra/client-js@1.0.1-alpha.0
  - @mastra/react@0.1.1-alpha.0

## 7.0.0

### Major Changes

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

- Replace `getThreadsByResourceIdPaginated` with `listThreadsByResourceId` across memory handlers. Update client SDK to use `listThreads()` with `offset`/`limit` parameters instead of deprecated `getMemoryThreads()`. Consolidate `/api/memory/threads` routes to single paginated endpoint. ([#9508](https://github.com/mastra-ai/mastra/pull/9508))

- Rename RuntimeContext to RequestContext ([#9511](https://github.com/mastra-ai/mastra/pull/9511))

- Renamed a bunch of observability/tracing-related things to drop the AI prefix. ([#9744](https://github.com/mastra-ai/mastra/pull/9744))

- **Breaking Change**: Remove legacy v1 watch events and consolidate on v2 implementation. ([#9252](https://github.com/mastra-ai/mastra/pull/9252))

  This change simplifies the workflow watching API by removing the legacy v1 event system and promoting v2 as the standard (renamed to just `watch`).

  **What's Changed**
  - Removed legacy v1 watch event handlers and types
  - Renamed `watch-v2` to `watch` throughout the codebase
  - Removed `.watch()` method from client-js SDK (`Workflow` and `AgentBuilder` classes)
  - Removed `/watch` HTTP endpoints from server and deployer
  - Removed `WorkflowWatchResult` and v1 `WatchEvent` types

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

- Changing getAgents -> listAgents, getTools -> listTools, getWorkflows -> listWorkflows ([#9495](https://github.com/mastra-ai/mastra/pull/9495))

- Mark as stable ([`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc))

- Renamed `MastraMessageV2` to `MastraDBMessage` ([#9255](https://github.com/mastra-ai/mastra/pull/9255))
  Made the return format of all methods that return db messages consistent. It's always `{ messages: MastraDBMessage[] }` now, and messages can be converted after that using `@mastra/ai-sdk/ui`'s `toAISdkV4/5Messages()` function

- Remove legacy evals from Mastra ([#9491](https://github.com/mastra-ai/mastra/pull/9491))

### Minor Changes

- Added consistent sizing, radius, and focus effects across all form elements. ([#11970](https://github.com/mastra-ai/mastra/pull/11970))

  **New size prop** for form elements with unified values:
  - `sm` (24px)
  - `md` (32px)
  - `lg` (40px)

  Components now share a consistent `size` prop: Button, Input, SelectTrigger, Searchbar, InputField, SelectField, and Combobox.

  ```tsx
  // Before - inconsistent props
  <Input customSize="default" />
  <Button size="md" /> // was 24px

  // After - unified size prop
  <Input size="md" />
  <Button size="md" /> // now 32px
  <SelectTrigger size="lg" />
  ```

  **Breaking changes:**
  - Input: `customSize` prop renamed to `size`
  - Button: `size="md"` now renders at 32px (was 24px). Use `size="sm"` for 24px height.

  **Other changes:**
  - All form elements now use `rounded-md` radius
  - All form elements now use `focus:outline focus:outline-accent1` focus effect
  - Removed `button-md` and `button-lg` size tokens (use `form-sm`, `form-md`, `form-lg` instead)

- Added platform-aware navigation filtering using `useMastraPlatform` hook. Nav links now include an `isOnMastraPlatform` property that controls visibility based on whether the app is running on Mastra Platform or locally. ([#11990](https://github.com/mastra-ai/mastra/pull/11990))

- Moving scorers under the eval domain, api method consistency, prebuilt evals, scorers require ids. ([#9589](https://github.com/mastra-ai/mastra/pull/9589))

- Enhance design system components with visual polish and micro-interactions. ([#12045](https://github.com/mastra-ai/mastra/pull/12045))

  Phase 2 of DS enhancement covering 40+ components:
  - **Form Controls**: Checkbox, RadioGroup, Switch, Slider, Combobox with focus rings, hover states, and smooth transitions
  - **Navigation**: Tabs with animated indicator, Steps with progress animation, Collapsible with icon rotation
  - **Feedback**: Alert with entrance animation, Notification with slide animations, Skeleton with gradient shimmer
  - **Display**: Badge with semantic variants, Avatar with interactive mode, StatusBadge enhancements
  - **Layout**: SideDialog with backdrop blur, ScrollArea with visibility transitions

  All components now use consistent design tokens (duration-normal, ease-out-custom, shadow-focus-ring) and GPU-accelerated properties for smooth 60fps animations.

- Update peer dependencies to match core package version bump (0.22.1) ([#8649](https://github.com/mastra-ai/mastra/pull/8649))

- Toast error from workflow stream and resume stream ([#9431](https://github.com/mastra-ai/mastra/pull/9431))
  Update peer dependencies to match core package version bump (0.22.3)

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

- Update peer dependencies to match core package version bump (0.22.0) ([#9045](https://github.com/mastra-ai/mastra/pull/9045))

- consolidate duplicated components between ds and ui directories ([#11876](https://github.com/mastra-ai/mastra/pull/11876))

- Fix "MessagePartRuntime is not available" error when chatting with agents in Studio playground by replacing deprecated `useMessagePart` hook with `useAssistantState` ([#11039](https://github.com/mastra-ai/mastra/pull/11039))

### Patch Changes

- dependencies updates: ([#10057](https://github.com/mastra-ai/mastra/pull/10057))
  - Updated dependency [`@uiw/codemirror-theme-github@^4.25.3` ↗︎](https://www.npmjs.com/package/@uiw/codemirror-theme-github/v/4.25.3) (from `^4.25.2`, in `dependencies`)

- dependencies updates: ([#10085](https://github.com/mastra-ai/mastra/pull/10085))
  - Updated dependency [`@xyflow/react@^12.9.3` ↗︎](https://www.npmjs.com/package/@xyflow/react/v/12.9.3) (from `^12.8.6`, in `dependencies`)

- dependencies updates: ([#11404](https://github.com/mastra-ai/mastra/pull/11404))
  - Updated dependency [`zustand@^5.0.9` ↗︎](https://www.npmjs.com/package/zustand/v/5.0.9) (from `^5.0.8`, in `dependencies`)

- dependencies updates: ([#11588](https://github.com/mastra-ai/mastra/pull/11588))
  - Updated dependency [`zustand@^5.0.9` ↗︎](https://www.npmjs.com/package/zustand/v/5.0.9) (from `^5.0.8`, in `dependencies`)

- dependencies updates: ([#9800](https://github.com/mastra-ai/mastra/pull/9800))
  - Updated dependency [`@lezer/highlight@^1.2.3` ↗︎](https://www.npmjs.com/package/@lezer/highlight/v/1.2.3) (from `^1.2.1`, in `dependencies`)

- dependencies updates: ([#9850](https://github.com/mastra-ai/mastra/pull/9850))
  - Updated dependency [`@dagrejs/dagre@^1.1.8` ↗︎](https://www.npmjs.com/package/@dagrejs/dagre/v/1.1.8) (from `^1.1.5`, in `dependencies`)

- Add missing loading state handlers to TanStack Query hooks. Components now properly show skeleton/loading UI instead of returning null or rendering incomplete states while data is being fetched. ([#11681](https://github.com/mastra-ai/mastra/pull/11681))

- Add Storybook stories for all design system components. Includes stories for 48 components organized by category (Elements, Feedback, Navigation, DataDisplay, Layout, Composite) plus an Icons showcase displaying all 41 icons. ([#11921](https://github.com/mastra-ai/mastra/pull/11921))

- Added human-in-the-loop (HITL) tool approval support for `generate()` method. ([#12056](https://github.com/mastra-ai/mastra/pull/12056))

  **Why:** This provides parity between `stream()` and `generate()` for tool approval flows, allowing non-streaming use cases to leverage `requireToolApproval` without needing to switch to streaming.

  Previously, tool approval with `requireToolApproval` only worked with `stream()`. Now you can use the same approval flow with `generate()` for non-streaming use cases.

  **Using tool approval with generate()**

  ```typescript
  const output = await agent.generate('Find user John', {
    requireToolApproval: true,
  });

  // Check if a tool is waiting for approval
  if (output.finishReason === 'suspended') {
    console.log('Tool requires approval:', output.suspendPayload.toolName);

    // Approve the tool call
    const result = await agent.approveToolCallGenerate({
      runId: output.runId,
      toolCallId: output.suspendPayload.toolCallId,
    });

    console.log(result.text);
  }
  ```

  **Declining a tool call**

  ```typescript
  if (output.finishReason === 'suspended') {
    const result = await agent.declineToolCallGenerate({
      runId: output.runId,
      toolCallId: output.suspendPayload.toolCallId,
    });
  }
  ```

  **New methods added:**
  - `agent.approveToolCallGenerate({ runId, toolCallId })` - Approves a pending tool call and returns the complete result
  - `agent.declineToolCallGenerate({ runId, toolCallId })` - Declines a pending tool call and returns the complete result

  **Server routes added:**
  - `POST /api/agents/:agentId/approve-tool-call-generate`
  - `POST /api/agents/:agentId/decline-tool-call-generate`

  The playground UI now also supports tool approval when using generate mode.

- Remove `streamVNext`, `resumeStreamVNext`, and `observeStreamVNext` methods, call `stream`, `resumeStream` and `observeStream` directly ([#11499](https://github.com/mastra-ai/mastra/pull/11499))

  ```diff
  + const run = await workflow.createRun({ runId: '123' });
  - const stream = await run.streamVNext({ inputData: { ... } });
  + const stream = await run.stream({ inputData: { ... } });
  ```

- Replace deprecated client.getTraces with a client.listTraces ([#11711](https://github.com/mastra-ai/mastra/pull/11711))

- fetch from the client-js sdk instead of local fetch ([#9376](https://github.com/mastra-ai/mastra/pull/9376))

- Add StudioConfig and associated context to manage the headers and base URL of a given Mastra instance. ([#10804](https://github.com/mastra-ai/mastra/pull/10804))

  This also introduces a header form available from the side bar to edit those headers.

- Fix navigation for processors Studio tab ([#12062](https://github.com/mastra-ai/mastra/pull/12062))

- Fix select options overflow when list is long by adding maximum height ([#10813](https://github.com/mastra-ai/mastra/pull/10813))

- Change searchbar to search on input with debounce instead of on Enter key press ([#11138](https://github.com/mastra-ai/mastra/pull/11138))

- Dedupe Avatar component by removing UI avatar and using DS Avatar with size variants ([#11637](https://github.com/mastra-ai/mastra/pull/11637))

- Add Mastra version footer component that displays installed packages and checks npm registry for available updates and deprecation warnings ([#11211](https://github.com/mastra-ai/mastra/pull/11211))

- Fix clicking nested workflows in sidepanel: resolve runtime error when clicking "View Nested Graph" inside an already-open nested workflow panel, and ensure the graph updates when switching between nested workflows. ([#11391](https://github.com/mastra-ai/mastra/pull/11391))

- Consolidate date picker components by removing duplicate DatePicker and Calendar components. DateField now uses the DayPicker wrapper from date-time-picker folder directly. ([#11649](https://github.com/mastra-ai/mastra/pull/11649))

- Consolidate UI components into design system folder. Moves all UI primitives from `src/components/ui/` to `src/ds/components/` to establish a single source of truth for UI components. Import paths updated across the codebase. No API changes - all exports remain the same. ([#11886](https://github.com/mastra-ai/mastra/pull/11886))

- Consolidate tabs components: remove redundant implementations and add onClose prop support ([#11650](https://github.com/mastra-ai/mastra/pull/11650))

- Consolidate Tailwind config as the single source of truth. The playground package now imports the config via a preset export instead of duplicating all theme definitions. ([#11916](https://github.com/mastra-ai/mastra/pull/11916))

- Removed uneeded calls to the message endpoint when the user is on a new thread ([#10872](https://github.com/mastra-ai/mastra/pull/10872))

- Aligned border, background, and radius styles across Dialog, AlertDialog, Popover, and Select components for visual consistency. All overlay components now use border-border1, bg-surface3, and rounded-md. ([#11974](https://github.com/mastra-ai/mastra/pull/11974))

- Add support for AI SDK v6 (LanguageModelV3) ([#11191](https://github.com/mastra-ai/mastra/pull/11191))

  Agents can now use `LanguageModelV3` models from AI SDK v6 beta providers like `@ai-sdk/openai@^3.0.0-beta`.

  **New features:**
  - Usage normalization: V3's nested usage format is normalized to Mastra's flat format with `reasoningTokens`, `cachedInputTokens`, and raw data preserved in a `raw` field

  **Backward compatible:** All existing V1 and V2 models continue to work unchanged.

- Adds tool/workflow error being surfaced to the side panel in the playground ([#11099](https://github.com/mastra-ai/mastra/pull/11099))

- Update MainSidebar component to fit required changes in Cloud CTA link ([#9318](https://github.com/mastra-ai/mastra/pull/9318))

- Fix default value showing on workflow form after user submits ([#10983](https://github.com/mastra-ai/mastra/pull/10983))

- Auto resume suspended tools if `autoResumeSuspendedTools: true` ([#11157](https://github.com/mastra-ai/mastra/pull/11157))

  The flag can be added to `defaultAgentOptions` when creating the agent or to options in `agent.stream` or `agent.generate`

  ```typescript
  const agent = new Agent({
    //...agent information,
    defaultAgentOptions: {
      autoResumeSuspendedTools: true,
    },
  });
  ```

- Add enhance instruction capability + instruction tweak for experiment purpose ([#9302](https://github.com/mastra-ai/mastra/pull/9302))

- Update peer dependencies to match core package version bump (1.0.0) ([#9237](https://github.com/mastra-ai/mastra/pull/9237))

- Fix trace-span-usage component to handle object values in token usage data. Usage objects can contain nested `inputDetails` and `outputDetails` properties which are objects, not numbers. The component now properly type-checks values and renders object properties as nested key-value pairs. ([#11141](https://github.com/mastra-ai/mastra/pull/11141))

- Make MainSidebar toggle button sticky to bottom, always visible ([#9682](https://github.com/mastra-ai/mastra/pull/9682))

- Use client-js search memory instead of custom fetch one ([#9326](https://github.com/mastra-ai/mastra/pull/9326))

- Add resizable and collapsible side panels for agents and workflows ([#11371](https://github.com/mastra-ai/mastra/pull/11371))

- Add human-in-the-loop (HITL) support to agent networks ([#11678](https://github.com/mastra-ai/mastra/pull/11678))
  - Add suspend/resume capabilities to agent network
  - Enable auto-resume for suspended network execution via `autoResumeSuspendedTools`

  `agent.resumeNetwork`, `agent.approveNetworkToolCall`, `agent.declineNetworkToolCall`

- Fixed scorer eligibility check in observability to also check span.entityType field ([#12078](https://github.com/mastra-ai/mastra/pull/12078))

- Render zod unions and discriminated unions correctly in dynamic form. ([#9317](https://github.com/mastra-ai/mastra/pull/9317))

- Removing uneeded files ([#9877](https://github.com/mastra-ai/mastra/pull/9877))

- Add `Run` instance to client-js. `workflow.createRun` returns the `Run` instance which can be used for the different run methods. ([#11207](https://github.com/mastra-ai/mastra/pull/11207))
  With this change, run methods cannot be called directly on workflow instance anymore

  ```diff
  - const result = await workflow.stream({ runId: '123', inputData: { ... } });
  + const run = await workflow.createRun({ runId: '123' });
  + const stream = await run.stream({ inputData: { ... } });
  ```

- Add breacrumb action for popovers ([#9378](https://github.com/mastra-ai/mastra/pull/9378))

- Prefill `providerOptions` on Mastra Studio. When creating your agent, you can add `providerOptions` to the Agent `instructions`, we now prefill the `providerOptions` field on Mastra Studio model settings advanced settings section with the `instructions.providerOptions` added. ([#9156](https://github.com/mastra-ai/mastra/pull/9156))

  Example agent code:

  ```typescript
  export const chefModelV2Agent = new Agent({
    name: 'Chef Agent V2 Model',
    description: 'A chef agent that can help you cook great meals with whatever ingredients you have available.',
    instructions: {
      content: `
        You are Michel, a practical and experienced home chef who helps people cook great meals with whatever
        ingredients they have available. Your first priority is understanding what ingredients and equipment the user has access to, then suggesting achievable recipes.
        You explain cooking steps clearly and offer substitutions when needed, maintaining a friendly and encouraging tone throughout.
        `,
      role: 'system',
      providerOptions: {
        openai: {
          reasoning_effort: 'high',
        },
      },
    },
    model: openai('gpt-4o-mini'),
    tools: {
      cookingTool,
    },
    memory,
  });
  ```

- Fix wrong hook arg type when retrieving workflow runs ([#10755](https://github.com/mastra-ai/mastra/pull/10755))

- Refactor agent information for easier cloud recomposable UIs ([#9995](https://github.com/mastra-ai/mastra/pull/9995))

- Remove console.log in playground-ui ([#11004](https://github.com/mastra-ai/mastra/pull/11004))

- Fix workflow observability view broken by invalid entityType parameter ([#11427](https://github.com/mastra-ai/mastra/pull/11427))

  The UI workflow observability view was failing with a Zod validation error when trying to filter traces by workflow. The UI was sending `entityType=workflow`, but the backend's `EntityType` enum only accepts `workflow_run`.

  **Root Cause**: The legacy value transformation was happening in the handler (after validation), but Zod validation occurred earlier in the request pipeline, rejecting the request before it could be transformed.

  **Solution**:
  - Added `z.preprocess()` to the query schema to transform `workflow` → `workflow_run` before validation
  - Kept handler transformation for defense in depth
  - Updated UI to use `EntityType.WORKFLOW_RUN` enum value for type safety

  This maintains backward compatibility with legacy clients while fixing the validation error.

  Fixes #11412

- Add timeTravel APIs and add timeTravel feature to studio ([#10361](https://github.com/mastra-ai/mastra/pull/10361))

- Use the same Button component every where. Remove duplicates. ([#11635](https://github.com/mastra-ai/mastra/pull/11635))

- Add tool call approval ([#8649](https://github.com/mastra-ai/mastra/pull/8649))

- Fixes issues where thread and messages were not saved before suspension when tools require approval or call suspend() during execution. This caused conversation history to be lost if users refreshed during tool approval or suspension. ([#10369](https://github.com/mastra-ai/mastra/pull/10369))

  **Backend changes (@mastra/core):**
  - Add assistant messages to messageList immediately after LLM execution
  - Flush messages synchronously before suspension to persist state
  - Create thread if it doesn't exist before flushing
  - Add metadata helpers to persist and remove tool approval state
  - Pass saveQueueManager and memory context through workflow for immediate persistence

  **Frontend changes (@mastra/react):**
  - Extract runId from pending approvals to enable resumption after refresh
  - Convert `pendingToolApprovals` (DB format) to `requireApprovalMetadata` (runtime format)
  - Handle both `dynamic-tool` and `tool-{NAME}` part types for approval state
  - Change runId from hardcoded `agentId` to unique `uuid()`

  **UI changes (@mastra/playground-ui):**
  - Handle tool calls awaiting approval in message initialization
  - Convert approval metadata format when loading initial messages

  Fixes #9745, #9906

- fix(playground-ui): prevent temperature and topP conflict for Anthropic Claude 4.5+ models ([#11777](https://github.com/mastra-ai/mastra/pull/11777))
  - Auto-clear topP for Claude 4.5+ models when both temperature and topP are set
  - Show warning banner when user manually sets both values for restricted models
  - Non-restricted models (OpenAI, Google, Claude 3.5) keep both defaults

  Fixes #11760

- Fixes issue where clicking the reset button in the model picker would fail to restore the original LanguageModelV2 (or any other types) object that was passed during agent construction. ([#9481](https://github.com/mastra-ai/mastra/pull/9481))

- Removed legacy spacing tokens (sm, md, lg) from the design system. These tokens were deprecated aliases that mapped to standard Tailwind spacing values (0.5, 1, 2). All components have been updated to use the standard spacing tokens directly. ([#11978](https://github.com/mastra-ai/mastra/pull/11978))

- Use the hash based stringification mechanism of tanstack query to ensure keys ordering (and to keep the caching key valid and consistent) ([#11008](https://github.com/mastra-ai/mastra/pull/11008))

- Fix multi modal in playground-ui ([#9373](https://github.com/mastra-ai/mastra/pull/9373))

- Add export for agent memory for use in cloud ([#10025](https://github.com/mastra-ai/mastra/pull/10025))

- Remove deprecated playground-only prompt generation handler (functionality moved to @mastra/server) ([#11074](https://github.com/mastra-ai/mastra/pull/11074))

  Improve prompt enhancement UX: show toast errors when enhancement fails, disable button when no model has a configured API key, and prevent users from disabling all models in the model list

  Add missing `/api/agents/:agentId/instructions/enhance` endpoint that was referenced by `@mastra/client-js` and `@mastra/playground-ui`

- Add debugger-like click-through UI to workflow graph ([#11350](https://github.com/mastra-ai/mastra/pull/11350))

- Focus the textarea when clicking anywhere in the entire chat prompt input box ([#11160](https://github.com/mastra-ai/mastra/pull/11160))

- Add prominent warning banner in observability UI when token limits are exceeded (finishReason: 'length'). ([#10835](https://github.com/mastra-ai/mastra/pull/10835))

  When a model stops generating due to token limits, the span details now display:
  - Clear warning with alert icon
  - Detailed token usage breakdown (input + output = total)
  - Explanation that the response was truncated

  This helps developers quickly identify and debug token limit issues in the observation page.

  Fixes #8828

- Add delete workflow run API ([#10991](https://github.com/mastra-ai/mastra/pull/10991))

  ```typescript
  await workflow.deleteWorkflowRunById(runId);
  ```

- Add initial state input to workflow form in studio ([#11560](https://github.com/mastra-ai/mastra/pull/11560))

- Move AutoForm from ds/components to lib/form for better organization ([#11915](https://github.com/mastra-ai/mastra/pull/11915))

- Fixed "Module not found: Can't resolve '@mastra/ai-sdk/ui'" error when playground-ui is used on Cloud by converting @mastra/ai-sdk to a peer dependency ([#10388](https://github.com/mastra-ai/mastra/pull/10388))

- Remove "show trace" that pointed to legacy traces ([#9470](https://github.com/mastra-ai/mastra/pull/9470))

- Fix resume form for nested workflow not displaying when viewing a previously suspended run on studio ([#9805](https://github.com/mastra-ai/mastra/pull/9805))

- Make initialState optional in studio ([#11744](https://github.com/mastra-ai/mastra/pull/11744))

- Remove unused files and dependencies identified by Knip ([#11677](https://github.com/mastra-ai/mastra/pull/11677))

- Merge `IconColors` into `Colors` object in design tokens. Icon color tokens (`icon1` through `icon6`) are now part of the main `Colors` export. ([#11932](https://github.com/mastra-ai/mastra/pull/11932))

- Remove legacy `colors.mastra` from Tailwind config and migrate to design system tokens (`Colors`, `IconColors`). ([#11925](https://github.com/mastra-ai/mastra/pull/11925))

- Added Processors tab to Mastra Studio. You can now view all configured processors, see which agents use them, and test processors directly from the UI. Processor workflows automatically redirect to the workflow graph view with a simplified input mode for testing. ([#12059](https://github.com/mastra-ai/mastra/pull/12059))

- Fix react/react-DOM version mismatch. ([#11620](https://github.com/mastra-ai/mastra/pull/11620))

- Fix discriminatedUnion schema information lost when json schema is converted to zod ([#10500](https://github.com/mastra-ai/mastra/pull/10500))

- Avoid fetch retries when fetching model providers ([#9452](https://github.com/mastra-ai/mastra/pull/9452))

- Rollback color of sidebar cloud cta ([#11877](https://github.com/mastra-ai/mastra/pull/11877))

- Remove unused keyframes and animations from tailwind config ([#11930](https://github.com/mastra-ai/mastra/pull/11930))

- Rename icon color tokens to neutral for better semantic naming ([#11933](https://github.com/mastra-ai/mastra/pull/11933))

- Replaced arbitrary Tailwind CSS values with standard utility classes for better consistency and maintainability. ([#11965](https://github.com/mastra-ai/mastra/pull/11965))
  - Changed arbitrary spacing values like `gap-[1rem]`, `p-[1.5rem]`, `px-[2rem]` to standard classes (`gap-4`, `p-6`, `px-8`)
  - Updated z-index values from `z-[1]` and `z-[100]` to standard `z-10` and `z-50`
  - Replaced arbitrary gap values like `gap-[6px]` with `gap-1.5`
  - Updated duration values from `duration-[1s]` to `duration-1000`

- Replaced arbitrary Tailwind text sizes with semantic design tokens for consistent typography. ([#11956](https://github.com/mastra-ai/mastra/pull/11956))

  **Changes:**
  - Consolidated font size tokens from 5 fractional rem values to 8 clean sizes
  - Replaced 129 occurrences of arbitrary `text-[...]` patterns across 44 files
  - Added new header size tokens (`header-sm`, `header-lg`, `header-xl`)

  **New token scale:**
  - `ui-xs`: 10px
  - `ui-sm`: 12px (was 11px)
  - `ui-md`: 14px (was 12px)
  - `ui-lg`: 16px (was 13px)
  - `header-sm`: 18px
  - `header-md`: 20px (was 16px)
  - `header-lg`: 24px
  - `header-xl`: 28px

- Replaced direct `clsx` imports with the `cn` utility across all components for consistent Tailwind class merging. ([#11938](https://github.com/mastra-ai/mastra/pull/11938))

- Replace CSS variable colors with design tokens ([#11928](https://github.com/mastra-ai/mastra/pull/11928))

- Remove unused /model-providers API ([#9533](https://github.com/mastra-ai/mastra/pull/9533))

- Move useScorers down to trace page to trigger it once for all trace spans ([#10985](https://github.com/mastra-ai/mastra/pull/10985))

- - Removes redundant "Working Memory" section from memory config panel (already displayed in dedicated working memory component) ([#11104](https://github.com/mastra-ai/mastra/pull/11104))
  - Fixes badge rendering for falsy values by using ?? instead of || (e.g., false was incorrectly displayed as empty string)
  - Adds tooltip on disabled "Edit Working Memory" button explaining that working memory becomes available after the agent calls updateWorkingMemory

- Update Observability Trace Spans list UI, so a user can expand/collapse span children/descendants and can filter the list by span type or name ([#10378](https://github.com/mastra-ai/mastra/pull/10378))

- Add UI to match with the mastra studio command ([#10283](https://github.com/mastra-ai/mastra/pull/10283))

- Fix undefined runtimeContext using memory from playground ([#9328](https://github.com/mastra-ai/mastra/pull/9328))

- Fix workflow trigger form overflow ([#10986](https://github.com/mastra-ai/mastra/pull/10986))

- Removed unused files, dependencies, and exports from playground packages. Deleted orphaned tool-list.tsx and workflow-list.tsx components, removed unused react-code-block dependency, and cleaned up 12 unused exports across object utilities, string helpers, and hooks. ([#11979](https://github.com/mastra-ai/mastra/pull/11979))

- Fix scorer filtering for SpanScoring, add error and info message for user ([#10160](https://github.com/mastra-ai/mastra/pull/10160))

- Templates now don't dynamically create a branch for every provider, each template should be agnostic and just use a env var to set the models until the user wants to set it otherwise. ([#10036](https://github.com/mastra-ai/mastra/pull/10036))
  MCP docs server will install the beta version of the docs server if they create a project with the beta tag.
  Updates to the templates now will get pushed to the beta branch, when beta goes stable we will merge the beta branch into the main branch for all templates and update the github script to push to main.
  Templates have been cleaned up
  small docs updates based off of how the template migrations went

- Fix playground white screen when Zod discriminatedUnion is intersected using `and()`. ([#9692](https://github.com/mastra-ai/mastra/pull/9692))
  This now works, but zod validation will fail, please use `extend` instead

  Instead of

  ```ts
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('byCity'), city: z.string() }),
    z.object({ type: z.literal('byCoords'), lat: z.number(), lon: z.number() }),
  ]).and(z.object({ order: z.number() }));
  ```

  do

  ```ts
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('byCity'), city: z.string() }).extend({ order: z.number() }),
    z.object({ type: z.literal('byCoords'), lat: z.number(), lon: z.number() }).extend({ order: z.number() }),
  ]);
  ```

- Hide time travel on map steps in Studio ([#10631](https://github.com/mastra-ai/mastra/pull/10631))

- Extract more components to playground-ui for sharing with cloud ([#9241](https://github.com/mastra-ai/mastra/pull/9241))

- Converted spacing design tokens from pixels to REM units for better accessibility. Spacing now scales with the user's browser font size settings. All existing Tailwind spacing classes (`p-4`, `gap-2`, `m-8`, etc.) continue to work unchanged. ([#11968](https://github.com/mastra-ai/mastra/pull/11968))

- Adds thread cloning to create independent copies of conversations that can diverge. ([#11517](https://github.com/mastra-ai/mastra/pull/11517))

  ```typescript
  // Clone a thread
  const { thread, clonedMessages } = await memory.cloneThread({
    sourceThreadId: 'thread-123',
    title: 'My Clone',
    options: {
      messageLimit: 10, // optional: only copy last N messages
    },
  });

  // Check if a thread is a clone
  if (memory.isClone(thread)) {
    const source = await memory.getSourceThread(thread.id);
  }

  // List all clones of a thread
  const clones = await memory.listClones('thread-123');
  ```

  Includes:
  - Storage implementations for InMemory, PostgreSQL, LibSQL, Upstash
  - API endpoint: `POST /api/memory/threads/:threadId/clone`
  - Embeddings created for cloned messages (semantic recall)
  - Clone button in playground UI Memory tab

- Simplify Storybook configuration by removing Radix UI module resolution hacks and creating a dedicated CSS file for Storybook ([#11920](https://github.com/mastra-ai/mastra/pull/11920))

- Fix undefined window issue when Sidebar used in Next app ([#9448](https://github.com/mastra-ai/mastra/pull/9448))

- Fix double scroll on agent chat container ([#10253](https://github.com/mastra-ai/mastra/pull/10253))

- Display network completion validation results and scorer feedback in the Playground when viewing agent network runs, letting users see pass/fail status and actionable feedback from completion scorers ([#11562](https://github.com/mastra-ai/mastra/pull/11562))

- Move WorkflowInformation to playground-ui ([#9297](https://github.com/mastra-ai/mastra/pull/9297))

- Remove `waitForEvent` from workflows. `waitForEvent` is now removed, please use suspend & resume flow instead. See https://mastra.ai/en/docs/workflows/suspend-and-resume for more details on suspend & resume flow. ([#9214](https://github.com/mastra-ai/mastra/pull/9214))

- Add the possibility to pass down options to the tanstack query client. Goal is to have cacheable request in cloud and it's not possible for now because of context resolution beeing different ([#11026](https://github.com/mastra-ai/mastra/pull/11026))

- Add combobox in playground for entities and update routes and error handling ([#9743](https://github.com/mastra-ai/mastra/pull/9743))

- **Breaking Changes:** ([#9045](https://github.com/mastra-ai/mastra/pull/9045))
  - Moved `generateTitle` from `threads.generateTitle` to top-level memory option
  - Changed default value from `true` to `false`
  - Using `threads.generateTitle` now throws an error

  **Migration:**
  Replace `threads: { generateTitle: true }` with `generateTitle: true` at the top level of memory options.

  **Playground:**
  The playground UI now displays thread IDs instead of "Chat from" when titles aren't generated.

- Agent's right sidebar is now 30% wide before resizing. It makes it easier to read the information at a first glance ([#11803](https://github.com/mastra-ai/mastra/pull/11803))

- Support new Workflow tripwire run status. Tripwires that are thrown from within a workflow will now bubble up and return a graceful state with information about tripwires. ([#10947](https://github.com/mastra-ai/mastra/pull/10947))

  When a workflow contains an agent step that triggers a tripwire, the workflow returns with `status: 'tripwire'` and includes tripwire details:

  ```typescript
  const run = await workflow.createRun();
  const result = await run.start({ inputData: { message: 'Hello' } });

  if (result.status === 'tripwire') {
    console.log('Workflow terminated by tripwire:', result.tripwire?.reason);
    console.log('Processor ID:', result.tripwire?.processorId);
    console.log('Retry requested:', result.tripwire?.retry);
  }
  ```

  Adds new UI state for tripwire in agent chat and workflow UI.

  This is distinct from `status: 'failed'` which indicates an unexpected error. A tripwire status means a processor intentionally stopped execution (e.g., for content moderation).

- Move some components to playground-ui for usage in cloud ([#9177](https://github.com/mastra-ai/mastra/pull/9177))

- Fix the link from traces to workflow ([#9764](https://github.com/mastra-ai/mastra/pull/9764))

- Add a specific page for the studio settings and moved the headers configuration form here instead of in a dialog ([#10812](https://github.com/mastra-ai/mastra/pull/10812))

- Unified `getWorkflowRunById` and `getWorkflowRunExecutionResult` into a single API that returns `WorkflowState` with both metadata and execution state. ([#11429](https://github.com/mastra-ai/mastra/pull/11429))

  **What changed:**
  - `getWorkflowRunById` now returns a unified `WorkflowState` object containing metadata (runId, workflowName, resourceId, createdAt, updatedAt) along with processed execution state (status, result, error, payload, steps)
  - Added optional `fields` parameter to request only specific fields for better performance
  - Added optional `withNestedWorkflows` parameter to control nested workflow step inclusion
  - Removed `getWorkflowRunExecutionResult` - use `getWorkflowRunById` instead (breaking change)
  - Removed `/execution-result` API endpoints from server (breaking change)
  - Removed `runExecutionResult()` method from client SDK (breaking change)
  - Removed `GetWorkflowRunExecutionResultResponse` type from client SDK (breaking change)

  **Before:**

  ```typescript
  // Had to call two different methods for different data
  const run = await workflow.getWorkflowRunById(runId); // Returns raw WorkflowRun with snapshot
  const result = await workflow.getWorkflowRunExecutionResult(runId); // Returns processed execution state
  ```

  **After:**

  ```typescript
  // Single method returns everything
  const run = await workflow.getWorkflowRunById(runId);
  // Returns: { runId, workflowName, resourceId, createdAt, updatedAt, status, result, error, payload, steps }

  // Request only specific fields for better performance (avoids expensive step fetching)
  const status = await workflow.getWorkflowRunById(runId, { fields: ['status'] });

  // Skip nested workflow steps for faster response
  const run = await workflow.getWorkflowRunById(runId, { withNestedWorkflows: false });
  ```

  **Why:** The previous API required calling two separate methods to get complete workflow run information. This unification simplifies the API surface and gives users control over performance - fetching all steps (especially nested workflows) can be expensive, so the `fields` and `withNestedWorkflows` options let users request only what they need.

- - Add persistence for custom data chunks (`data-*` parts) emitted via `writer.custom()` in tools ([#10884](https://github.com/mastra-ai/mastra/pull/10884))
  - Data chunks are now saved to message storage so they survive page refreshes
  - Update `@assistant-ui/react` to v0.11.47 with native `DataMessagePart` support
  - Convert `data-*` parts to `DataMessagePart` format (`{ type: 'data', name: string, data: T }`)
  - Update related `@assistant-ui/*` packages for compatibility

- Explicitly set color of line number in CodeMirror ([#9878](https://github.com/mastra-ai/mastra/pull/9878))

- Workflow step detail panel improvements ([#11134](https://github.com/mastra-ai/mastra/pull/11134))
  - Add step detail panel to view map configs and nested workflows from the workflow graph
  - Enable line wrapping for code display in map config panel and WHEN condition nodes
  - Auto-switch to "Current Run" tab when opening step details
  - Add colored icons matching workflow graph (orange for map, purple for workflow)
  - Simplify step detail context by removing unused parent stack navigation

- Fix agent default settings not being applied in playground ([#11107](https://github.com/mastra-ai/mastra/pull/11107))
  - Fix settings hook to properly merge agent default options with localStorage values
  - Map `maxOutputTokens` (AI SDK v5) to `maxTokens` for UI compatibility
  - Add `seed` parameter support to model settings
  - Add frequency/presence penalty inputs with sliders
  - Extract and apply agent's `defaultOptions.modelSettings` on load

- Remove unecessary react components + dependencies ([#9295](https://github.com/mastra-ai/mastra/pull/9295))

- Fix studio crashing when message contains non JSON text output of tool call ([#9189](https://github.com/mastra-ai/mastra/pull/9189))

- Add container queries, adjust the agent chat and use container queries to better display information on the agent sidebar ([#11408](https://github.com/mastra-ai/mastra/pull/11408))

- Make suspendPayload optional when calling `suspend()` ([#9926](https://github.com/mastra-ai/mastra/pull/9926))
  Save value returned as `suspendOutput` if user returns data still after calling `suspend()`
  Automatically call `commit()` on uncommitted workflows when registering in Mastra instance
  Show actual suspendPayload on Studio in suspend/resume flow

- Added tracing options to workflow runs and agent generate / stream / network. You can now configure tracing options, custom request context keys, and parent trace/span IDs through a new "Tracing options" tab in the workflow/agent ui UI. ([#10742](https://github.com/mastra-ai/mastra/pull/10742))

  **Usage:**

  The workflow settings are now accessible via the new `useTracingSettings` hook and `TracingSettingsProvider`:

  ```tsx
  import { TracingSettingsProvider, useWorkflowSettings } from '@mastra/playground-ui';

  // Wrap your workflow components with the provider
  <TracingSettingsProvider entityId="my-workflow" entityType="workflow">
    <YourWorkflowUI />
  </TracingSettingsProvider>;

  // Access settings in child components
  const { settings, setSettings } = useTracingSettings();

  // Configure tracing options
  setSettings({
    tracingOptions: {
      metadata: { userId: '123' },
      requestContextKeys: ['user.email'],
      traceId: 'abc123',
    },
  });
  ```

  Tracing options are persisted per workflow/agent in localStorage and automatically applied to all workflow/agent executions.

- Add visual styles and labels for more workflow node types ([#9777](https://github.com/mastra-ai/mastra/pull/9777))

- fix isTopLevelSpan value definition on SpanScoring to properly recognize lack of span?.parentSpanId value (null or empty string) ([#11083](https://github.com/mastra-ai/mastra/pull/11083))

- Updated dependencies [[`ac0d2f4`](https://github.com/mastra-ai/mastra/commit/ac0d2f4ff8831f72c1c66c2be809706d17f65789), [`2319326`](https://github.com/mastra-ai/mastra/commit/2319326f8c64e503a09bbcf14be2dd65405445e0), [`d2d3e22`](https://github.com/mastra-ai/mastra/commit/d2d3e22a419ee243f8812a84e3453dd44365ecb0), [`08766f1`](https://github.com/mastra-ai/mastra/commit/08766f15e13ac0692fde2a8bd366c2e16e4321df), [`72df8ae`](https://github.com/mastra-ai/mastra/commit/72df8ae595584cdd7747d5c39ffaca45e4507227), [`ebae12a`](https://github.com/mastra-ai/mastra/commit/ebae12a2dd0212e75478981053b148a2c246962d), [`6edf340`](https://github.com/mastra-ai/mastra/commit/6edf3402f6a46ee8def2f42a2287785251fbffd6), [`c8417b4`](https://github.com/mastra-ai/mastra/commit/c8417b41d9f3486854dc7842d977fbe5e2166264), [`bc72b52`](https://github.com/mastra-ai/mastra/commit/bc72b529ee4478fe89ecd85a8be47ce0127b82a0), [`39c9743`](https://github.com/mastra-ai/mastra/commit/39c97432d084294f8ba85fbf3ef28098ff21459e), [`1dbd8c7`](https://github.com/mastra-ai/mastra/commit/1dbd8c729fb6536ec52f00064d76b80253d346e9), [`c61a0a5`](https://github.com/mastra-ai/mastra/commit/c61a0a5de4904c88fd8b3718bc26d1be1c2ec6e7), [`05b8bee`](https://github.com/mastra-ai/mastra/commit/05b8bee9e50e6c2a4a2bf210eca25ee212ca24fa), [`3076c67`](https://github.com/mastra-ai/mastra/commit/3076c6778b18988ae7d5c4c5c466366974b2d63f), [`3d93a15`](https://github.com/mastra-ai/mastra/commit/3d93a15796b158c617461c8b98bede476ebb43e2), [`9198899`](https://github.com/mastra-ai/mastra/commit/91988995c427b185c33714b7f3be955367911324), [`ed3e3dd`](https://github.com/mastra-ai/mastra/commit/ed3e3ddec69d564fe2b125e083437f76331f1283), [`c59e13c`](https://github.com/mastra-ai/mastra/commit/c59e13c7688284bd96b2baee3e314335003548de), [`c042bd0`](https://github.com/mastra-ai/mastra/commit/c042bd0b743e0e86199d0cb83344ca7690e34a9c), [`f743dbb`](https://github.com/mastra-ai/mastra/commit/f743dbb8b40d1627b5c10c0e6fc154f4ebb6e394), [`21a15de`](https://github.com/mastra-ai/mastra/commit/21a15de369fe82aac26bb642ed7be73505475e8b), [`e54953e`](https://github.com/mastra-ai/mastra/commit/e54953ed8ce1b28c0d62a19950163039af7834b4), [`3852192`](https://github.com/mastra-ai/mastra/commit/3852192c81b2a4f1f883f17d80ce50e0c60dba55), [`ae8baf7`](https://github.com/mastra-ai/mastra/commit/ae8baf7d8adcb0ff9dac11880400452bc49b33ff), [`17b4b46`](https://github.com/mastra-ai/mastra/commit/17b4b46339898f13f52c4c4e3d16c52630629c29), [`fec5129`](https://github.com/mastra-ai/mastra/commit/fec5129de7fc64423ea03661a56cef31dc747a0d), [`940a2b2`](https://github.com/mastra-ai/mastra/commit/940a2b27480626ed7e74f55806dcd2181c1dd0c2), [`1a0d3fc`](https://github.com/mastra-ai/mastra/commit/1a0d3fc811482c9c376cdf79ee615c23bae9b2d6), [`85d7ee1`](https://github.com/mastra-ai/mastra/commit/85d7ee18ff4e14d625a8a30ec6656bb49804989b), [`c6c1092`](https://github.com/mastra-ai/mastra/commit/c6c1092f8fbf76109303f69e000e96fd1960c4ce), [`0491e7c`](https://github.com/mastra-ai/mastra/commit/0491e7c9b714cb0ba22187ee062147ec2dd7c712), [`f6f4903`](https://github.com/mastra-ai/mastra/commit/f6f4903397314f73362061dc5a3e8e7c61ea34aa), [`d5ed981`](https://github.com/mastra-ai/mastra/commit/d5ed981c8701c1b8a27a5f35a9a2f7d9244e695f), [`85a628b`](https://github.com/mastra-ai/mastra/commit/85a628b1224a8f64cd82ea7f033774bf22df7a7e), [`0e8ed46`](https://github.com/mastra-ai/mastra/commit/0e8ed467c54d6901a6a365f270ec15d6faadb36c), [`33a4d2e`](https://github.com/mastra-ai/mastra/commit/33a4d2e4ed8af51f69256232f00c34d6b6b51d48), [`b9b7ffd`](https://github.com/mastra-ai/mastra/commit/b9b7ffdad6936a7d50b6b814b5bbe54e19087f66), [`9650cce`](https://github.com/mastra-ai/mastra/commit/9650cce52a1d917ff9114653398e2a0f5c3ba808), [`6c049d9`](https://github.com/mastra-ai/mastra/commit/6c049d94063fdcbd5b81c4912a2bf82a92c9cc0b), [`910db9e`](https://github.com/mastra-ai/mastra/commit/910db9e0312888495eb5617b567f247d03303814), [`bd18eb0`](https://github.com/mastra-ai/mastra/commit/bd18eb0928b1c4f263426f45f49765b32d1ef802), [`2f897df`](https://github.com/mastra-ai/mastra/commit/2f897df208508f46f51b7625e5dd20c37f93e0e3), [`d629361`](https://github.com/mastra-ai/mastra/commit/d629361a60f6565b5bfb11976fdaf7308af858e2), [`4f94ed8`](https://github.com/mastra-ai/mastra/commit/4f94ed8177abfde3ec536e3574883e075423350c), [`feb7ee4`](https://github.com/mastra-ai/mastra/commit/feb7ee4d09a75edb46c6669a3beaceec78811747), [`4aaa844`](https://github.com/mastra-ai/mastra/commit/4aaa844a4f19d054490f43638a990cc57bda8d2f), [`c237233`](https://github.com/mastra-ai/mastra/commit/c23723399ccedf7f5744b3f40997b79246bfbe64), [`38380b6`](https://github.com/mastra-ai/mastra/commit/38380b60fca905824bdf6b43df307a58efb1aa15), [`6833c69`](https://github.com/mastra-ai/mastra/commit/6833c69607418d257750bbcdd84638993d343539), [`932d63d`](https://github.com/mastra-ai/mastra/commit/932d63dd51be9c8bf1e00e3671fe65606c6fb9cd), [`4a1a6cb`](https://github.com/mastra-ai/mastra/commit/4a1a6cb3facad54b2bb6780b00ce91d6de1edc08), [`08c31c1`](https://github.com/mastra-ai/mastra/commit/08c31c188ebccd598acaf55e888b6397d01f7eae), [`919a22b`](https://github.com/mastra-ai/mastra/commit/919a22b25876f9ed5891efe5facbe682c30ff497), [`f0f8f12`](https://github.com/mastra-ai/mastra/commit/f0f8f125c308f2d0fd36942ef652fd852df7522f), [`15f9e21`](https://github.com/mastra-ai/mastra/commit/15f9e216177201ea6e3f6d0bfb063fcc0953444f), [`3443770`](https://github.com/mastra-ai/mastra/commit/3443770662df8eb24c9df3589b2792d78cfcb811), [`69136e7`](https://github.com/mastra-ai/mastra/commit/69136e748e32f57297728a4e0f9a75988462f1a7), [`b0e2ea5`](https://github.com/mastra-ai/mastra/commit/b0e2ea5b52c40fae438b9e2f7baee6f0f89c5442), [`f0a07e0`](https://github.com/mastra-ai/mastra/commit/f0a07e0111b3307c5fabfa4094c5c2cfb734fbe6), [`ff94dea`](https://github.com/mastra-ai/mastra/commit/ff94dea935f4e34545c63bcb6c29804732698809), [`0d41fe2`](https://github.com/mastra-ai/mastra/commit/0d41fe245355dfc66d61a0d9c85d9400aac351ff), [`b760b73`](https://github.com/mastra-ai/mastra/commit/b760b731aca7c8a3f041f61d57a7f125ae9cb215), [`aaa40e7`](https://github.com/mastra-ai/mastra/commit/aaa40e788628b319baa8e889407d11ad626547fa), [`1521d71`](https://github.com/mastra-ai/mastra/commit/1521d716e5daedc74690c983fbd961123c56756b), [`449aed2`](https://github.com/mastra-ai/mastra/commit/449aed2ba9d507b75bf93d427646ea94f734dfd1), [`eb648a2`](https://github.com/mastra-ai/mastra/commit/eb648a2cc1728f7678768dd70cd77619b448dab9), [`695a621`](https://github.com/mastra-ai/mastra/commit/695a621528bdabeb87f83c2277cf2bb084c7f2b4), [`9e1911d`](https://github.com/mastra-ai/mastra/commit/9e1911db2b4db85e0e768c3f15e0d61e319869f6), [`ac3cc23`](https://github.com/mastra-ai/mastra/commit/ac3cc2397d1966bc0fc2736a223abc449d3c7719), [`c456e01`](https://github.com/mastra-ai/mastra/commit/c456e0149e3c176afcefdbd9bb1d2c5917723725), [`ebac155`](https://github.com/mastra-ai/mastra/commit/ebac15564a590117db7078233f927a7e28a85106), [`a86f4df`](https://github.com/mastra-ai/mastra/commit/a86f4df0407311e0d2ea49b9a541f0938810d6a9), [`47c34d8`](https://github.com/mastra-ai/mastra/commit/47c34d8e8c3e8aae5c00efc6085c064f2404b346), [`dd1c38d`](https://github.com/mastra-ai/mastra/commit/dd1c38d1b75f1b695c27b40d8d9d6ed00d5e0f6f), [`5948e6a`](https://github.com/mastra-ai/mastra/commit/5948e6a5146c83666ba3f294b2be576c82a513fb), [`5b2ff46`](https://github.com/mastra-ai/mastra/commit/5b2ff4651df70c146523a7fca773f8eb0a2272f8), [`edb07e4`](https://github.com/mastra-ai/mastra/commit/edb07e49283e0c28bd094a60e03439bf6ecf0221), [`e0941c3`](https://github.com/mastra-ai/mastra/commit/e0941c3d7fc75695d5d258e7008fd5d6e650800c), [`f93e2f5`](https://github.com/mastra-ai/mastra/commit/f93e2f575e775e627e5c1927cefdd72db07858ed), [`6de8ffd`](https://github.com/mastra-ai/mastra/commit/6de8ffda7ab06bce012fdeac3eacc6d2d138c097), [`db41688`](https://github.com/mastra-ai/mastra/commit/db4168806d007417e2e60b4f68656dca4e5f40c9), [`91c3a61`](https://github.com/mastra-ai/mastra/commit/91c3a61c533b348a18ba4394069efff26ac7d5a7), [`2b459f4`](https://github.com/mastra-ai/mastra/commit/2b459f466fd91688eeb2a44801dc23f7f8a887ab), [`798d0c7`](https://github.com/mastra-ai/mastra/commit/798d0c740232653b1d754870e6b43a55c364ffe2), [`0c0580a`](https://github.com/mastra-ai/mastra/commit/0c0580a42f697cd2a7d5973f25bfe7da9055038a), [`8940859`](https://github.com/mastra-ai/mastra/commit/89408593658199b4ad67f7b65e888f344e64a442), [`486352b`](https://github.com/mastra-ai/mastra/commit/486352b66c746602b68a95839f830de14c7fb8c0), [`ab035c2`](https://github.com/mastra-ai/mastra/commit/ab035c2ef6d8cc7bb25f06f1a38508bd9e6f126b), [`e629310`](https://github.com/mastra-ai/mastra/commit/e629310f1a73fa236d49ec7a1d1cceb6229dc7cc), [`0131105`](https://github.com/mastra-ai/mastra/commit/0131105532e83bdcbb73352fc7d0879eebf140dc), [`ad7e8f1`](https://github.com/mastra-ai/mastra/commit/ad7e8f16ac843cbd16687ad47b66ba96bcffe111), [`5ca599d`](https://github.com/mastra-ai/mastra/commit/5ca599d0bb59a1595f19f58473fcd67cc71cef58), [`09e4bae`](https://github.com/mastra-ai/mastra/commit/09e4bae18dd5357d2ae078a4a95a2af32168ab08), [`47b1c16`](https://github.com/mastra-ai/mastra/commit/47b1c16a01c7ffb6765fe1e499b49092f8b7eba3), [`4c6b492`](https://github.com/mastra-ai/mastra/commit/4c6b492c4dd591c6a592520c1f6855d6e936d71f), [`bff1145`](https://github.com/mastra-ai/mastra/commit/bff114556b3cbadad9b2768488708f8ad0e91475), [`a54793a`](https://github.com/mastra-ai/mastra/commit/a54793a6377edb87d43a795711deedf487152d5c), [`dff01d8`](https://github.com/mastra-ai/mastra/commit/dff01d81ce1f4e4087cfac20fa868e6db138dd14), [`9d5059e`](https://github.com/mastra-ai/mastra/commit/9d5059eae810829935fb08e81a9bb7ecd5b144a7), [`ffe84d5`](https://github.com/mastra-ai/mastra/commit/ffe84d54f3b0f85167fe977efd027dba027eb998), [`7491634`](https://github.com/mastra-ai/mastra/commit/7491634fd198c37d9934675756b274ae2e5e415e), [`5c8ca24`](https://github.com/mastra-ai/mastra/commit/5c8ca247094e0cc2cdbd7137822fb47241f86e77), [`9d819d5`](https://github.com/mastra-ai/mastra/commit/9d819d54b61481639f4008e4694791bddf187edd), [`e1b7118`](https://github.com/mastra-ai/mastra/commit/e1b7118f42ca0a97247afc75e57dcd5fdf987752), [`441c7b6`](https://github.com/mastra-ai/mastra/commit/441c7b6665915cfa7fd625fded8c0f518530bf10), [`461e448`](https://github.com/mastra-ai/mastra/commit/461e448852fe999506a6046d50b1efc27d8aa378), [`24b76d8`](https://github.com/mastra-ai/mastra/commit/24b76d8e17656269c8ed09a0c038adb9cc2ae95a), [`441c7b6`](https://github.com/mastra-ai/mastra/commit/441c7b6665915cfa7fd625fded8c0f518530bf10), [`b7de533`](https://github.com/mastra-ai/mastra/commit/b7de53361667eb51fefd89fcaed924f3c57cee8d), [`31d13d5`](https://github.com/mastra-ai/mastra/commit/31d13d5fdc2e2380e2e3ee3ec9fb29d2a00f265d), [`ef756c6`](https://github.com/mastra-ai/mastra/commit/ef756c65f82d16531c43f49a27290a416611e526), [`e191844`](https://github.com/mastra-ai/mastra/commit/e1918444ca3f80e82feef1dad506cd4ec6e2875f), [`243a823`](https://github.com/mastra-ai/mastra/commit/243a8239c5906f5c94e4f78b54676793f7510ae3), [`b00ccd3`](https://github.com/mastra-ai/mastra/commit/b00ccd325ebd5d9e37e34dd0a105caae67eb568f), [`28f5f89`](https://github.com/mastra-ai/mastra/commit/28f5f89705f2409921e3c45178796c0e0d0bbb64), [`87cf8d3`](https://github.com/mastra-ai/mastra/commit/87cf8d37564040eb4137a5923edb134c6ea51114), [`22553f1`](https://github.com/mastra-ai/mastra/commit/22553f11c63ee5e966a9c034a349822249584691), [`4c62166`](https://github.com/mastra-ai/mastra/commit/4c621669f4a29b1f443eca3ba70b814afa286266), [`e601b27`](https://github.com/mastra-ai/mastra/commit/e601b272c70f3a5ecca610373aa6223012704892), [`7d56d92`](https://github.com/mastra-ai/mastra/commit/7d56d9213886e8353956d7d40df10045fd12b299), [`81dc110`](https://github.com/mastra-ai/mastra/commit/81dc11008d147cf5bdc8996ead1aa61dbdebb6fc), [`7bcbf10`](https://github.com/mastra-ai/mastra/commit/7bcbf10133516e03df964b941f9a34e9e4ab4177), [`029540c`](https://github.com/mastra-ai/mastra/commit/029540ca1e582fc2dd8d288ecd4a9b0f31a954ef), [`7237163`](https://github.com/mastra-ai/mastra/commit/72371635dbf96a87df4b073cc48fc655afbdce3d), [`2500740`](https://github.com/mastra-ai/mastra/commit/2500740ea23da067d6e50ec71c625ab3ce275e64), [`4353600`](https://github.com/mastra-ai/mastra/commit/43536005a65988a8eede236f69122e7f5a284ba2), [`653e65a`](https://github.com/mastra-ai/mastra/commit/653e65ae1f9502c2958a32f47a5a2df11e612a92), [`873ecbb`](https://github.com/mastra-ai/mastra/commit/873ecbb517586aa17d2f1e99283755b3ebb2863f), [`6986fb0`](https://github.com/mastra-ai/mastra/commit/6986fb064f5db6ecc24aa655e1d26529087b43b3), [`3d3366f`](https://github.com/mastra-ai/mastra/commit/3d3366f31683e7137d126a3a57174a222c5801fb), [`5a4953f`](https://github.com/mastra-ai/mastra/commit/5a4953f7d25bb15ca31ed16038092a39cb3f98b3), [`4f9bbe5`](https://github.com/mastra-ai/mastra/commit/4f9bbe5968f42c86f4930b8193de3c3c17e5bd36), [`efe406a`](https://github.com/mastra-ai/mastra/commit/efe406a1353c24993280ebc2ed61dd9f65b84b26), [`eb9e522`](https://github.com/mastra-ai/mastra/commit/eb9e522ce3070a405e5b949b7bf5609ca51d7fe2), [`fd3d338`](https://github.com/mastra-ai/mastra/commit/fd3d338a2c362174ed5b383f1f011ad9fb0302aa), [`20e6f19`](https://github.com/mastra-ai/mastra/commit/20e6f1971d51d3ff6dd7accad8aaaae826d540ed), [`2b7aede`](https://github.com/mastra-ai/mastra/commit/2b7aede89494efaf7c28efe264a86cad8ee1cee6), [`053e979`](https://github.com/mastra-ai/mastra/commit/053e9793b28e970086b0507f7f3b76ea32c1e838), [`02e51fe`](https://github.com/mastra-ai/mastra/commit/02e51feddb3d4155cfbcc42624fd0d0970d032c0), [`71c8d6c`](https://github.com/mastra-ai/mastra/commit/71c8d6c161253207b2b9588bdadb7eed604f7253), [`7aedb74`](https://github.com/mastra-ai/mastra/commit/7aedb74883adf66af38e270e4068fd42e7a37036), [`e09a788`](https://github.com/mastra-ai/mastra/commit/e09a788e01698a711c7f705ce8d64ef8a20c3582), [`3bdfa75`](https://github.com/mastra-ai/mastra/commit/3bdfa7507a91db66f176ba8221aa28dd546e464a), [`119e5c6`](https://github.com/mastra-ai/mastra/commit/119e5c65008f3e5cfca954eefc2eb85e3bf40da4), [`c6fd6fe`](https://github.com/mastra-ai/mastra/commit/c6fd6fedd09e9cf8004b03a80925f5e94826ad7e), [`8f02d80`](https://github.com/mastra-ai/mastra/commit/8f02d800777397e4b45d7f1ad041988a8b0c6630), [`fdac646`](https://github.com/mastra-ai/mastra/commit/fdac646033a0930a1a4e00d13aa64c40bb7f1e02), [`6179a9b`](https://github.com/mastra-ai/mastra/commit/6179a9ba36ffac326de3cc3c43cdc8028d37c251), [`8f3fa3a`](https://github.com/mastra-ai/mastra/commit/8f3fa3a652bb77da092f913ec51ae46e3a7e27dc), [`d07b568`](https://github.com/mastra-ai/mastra/commit/d07b5687819ea8cb1dffa776d0c1765faf4aa1ae), [`e770de9`](https://github.com/mastra-ai/mastra/commit/e770de941a287a49b1964d44db5a5763d19890a6), [`e26dc9c`](https://github.com/mastra-ai/mastra/commit/e26dc9c3ccfec54ae3dc3e2b2589f741f9ae60a6), [`55edf73`](https://github.com/mastra-ai/mastra/commit/55edf7302149d6c964fbb7908b43babfc2b52145), [`c30400a`](https://github.com/mastra-ai/mastra/commit/c30400a49b994b1b97256fe785eb6c906fc2b232), [`1b85674`](https://github.com/mastra-ai/mastra/commit/1b85674123708d9b85834dccc9eae601a9d0891c), [`486352b`](https://github.com/mastra-ai/mastra/commit/486352b66c746602b68a95839f830de14c7fb8c0), [`627067b`](https://github.com/mastra-ai/mastra/commit/627067b22eeb26601f65fee3646ba17fc0c91501), [`00f4921`](https://github.com/mastra-ai/mastra/commit/00f4921dd2c91a1e5446799599ef7116a8214a1a), [`1a46a56`](https://github.com/mastra-ai/mastra/commit/1a46a566f45a3fcbadc1cf36bf86d351f264bfa3), [`5a1ede1`](https://github.com/mastra-ai/mastra/commit/5a1ede1f7ab527b9ead11f7eee2f73e67aeca9e4), [`47b1c16`](https://github.com/mastra-ai/mastra/commit/47b1c16a01c7ffb6765fe1e499b49092f8b7eba3), [`ca8041c`](https://github.com/mastra-ai/mastra/commit/ca8041cce0379fda22ed293a565bcb5b6ddca68a), [`b5dc973`](https://github.com/mastra-ai/mastra/commit/b5dc9733a5158850298dfb103acb3babdba8a318), [`7051bf3`](https://github.com/mastra-ai/mastra/commit/7051bf38b3b122a069008f861f7bfc004a6d9f6e), [`a8f1494`](https://github.com/mastra-ai/mastra/commit/a8f1494f4bbdc2770bcf327d4c7d869e332183f1), [`52e2716`](https://github.com/mastra-ai/mastra/commit/52e2716b42df6eff443de72360ae83e86ec23993), [`d7aad50`](https://github.com/mastra-ai/mastra/commit/d7aad501ce61646b76b4b511e558ac4eea9884d0), [`4f0b3c6`](https://github.com/mastra-ai/mastra/commit/4f0b3c66f196c06448487f680ccbb614d281e2f7), [`27b4040`](https://github.com/mastra-ai/mastra/commit/27b4040bfa1a95d92546f420a02a626b1419a1d6), [`c61fac3`](https://github.com/mastra-ai/mastra/commit/c61fac3add96f0dcce0208c07415279e2537eb62), [`6f14f70`](https://github.com/mastra-ai/mastra/commit/6f14f706ccaaf81b69544b6c1b75ab66a41e5317), [`69e0a87`](https://github.com/mastra-ai/mastra/commit/69e0a878896a2da9494945d86e056a5f8f05b851), [`cd29ad2`](https://github.com/mastra-ai/mastra/commit/cd29ad23a255534e8191f249593849ed29160886), [`1ee3411`](https://github.com/mastra-ai/mastra/commit/1ee34113192b11aa8bcdd8d9d5830ae13254b345), [`dbd9db0`](https://github.com/mastra-ai/mastra/commit/dbd9db0d5c2797a210b9098e7e3e613718e5442f), [`6a86fe5`](https://github.com/mastra-ai/mastra/commit/6a86fe56b8ff53ca2eb3ed87ffc0748749ebadce), [`bdf4d8c`](https://github.com/mastra-ai/mastra/commit/bdf4d8cdc656d8a2c21d81834bfa3bfa70f56c16), [`854e3da`](https://github.com/mastra-ai/mastra/commit/854e3dad5daac17a91a20986399d3a51f54bf68b), [`ce18d38`](https://github.com/mastra-ai/mastra/commit/ce18d38678c65870350d123955014a8432075fd9), [`3cf540b`](https://github.com/mastra-ai/mastra/commit/3cf540b9fbfea8f4fc8d3a2319a4e6c0b0cbfd52), [`352a5d6`](https://github.com/mastra-ai/mastra/commit/352a5d625cfe09849b21e8f52a24c9f0366759d5), [`1c6ce51`](https://github.com/mastra-ai/mastra/commit/1c6ce51f875915ab57fd36873623013699a2a65d), [`74c4f22`](https://github.com/mastra-ai/mastra/commit/74c4f22ed4c71e72598eacc346ba95cdbc00294f), [`3a76a80`](https://github.com/mastra-ai/mastra/commit/3a76a80284cb71a0faa975abb3d4b2a9631e60cd), [`898a972`](https://github.com/mastra-ai/mastra/commit/898a9727d286c2510d6b702dfd367e6aaf5c6b0f), [`0793497`](https://github.com/mastra-ai/mastra/commit/079349753620c40246ffd673e3f9d7d9820beff3), [`09e4bae`](https://github.com/mastra-ai/mastra/commit/09e4bae18dd5357d2ae078a4a95a2af32168ab08), [`026b848`](https://github.com/mastra-ai/mastra/commit/026b8483fbf5b6d977be8f7e6aac8d15c75558ac), [`2c212e7`](https://github.com/mastra-ai/mastra/commit/2c212e704c90e2db83d4109e62c03f0f6ebd2667), [`a97003a`](https://github.com/mastra-ai/mastra/commit/a97003aa1cf2f4022a41912324a1e77263b326b8), [`f9a2509`](https://github.com/mastra-ai/mastra/commit/f9a25093ea72d210a5e52cfcb3bcc8b5e02dc25c), [`66741d1`](https://github.com/mastra-ai/mastra/commit/66741d1a99c4f42cf23a16109939e8348ac6852e), [`ccc141e`](https://github.com/mastra-ai/mastra/commit/ccc141ed27da0abc3a3fc28e9e5128152e8e37f4), [`922305b`](https://github.com/mastra-ai/mastra/commit/922305b747c9b081b51af81f5f4d5ba09fb22f5d), [`27c0009`](https://github.com/mastra-ai/mastra/commit/27c0009777a6073d7631b0eb7b481d94e165b5ca), [`01f8878`](https://github.com/mastra-ai/mastra/commit/01f88783de25e4de048c1c8aace43e26373c6ea5), [`dee388d`](https://github.com/mastra-ai/mastra/commit/dee388dde02f2e63c53385ae69252a47ab6825cc), [`610a70b`](https://github.com/mastra-ai/mastra/commit/610a70bdad282079f0c630e0d7bb284578f20151), [`5df9cce`](https://github.com/mastra-ai/mastra/commit/5df9cce1a753438413f64c11eeef8f845745c2a8), [`b7e17d3`](https://github.com/mastra-ai/mastra/commit/b7e17d3f5390bb5a71efc112204413656fcdc18d), [`f93d992`](https://github.com/mastra-ai/mastra/commit/f93d992a37d5431ab4a71246835d403ef7c4ce85), [`4c77209`](https://github.com/mastra-ai/mastra/commit/4c77209e6c11678808b365d545845918c40045c8), [`a854ede`](https://github.com/mastra-ai/mastra/commit/a854ede62bf5ac0945a624ac48913dd69c73aabf), [`fe3b897`](https://github.com/mastra-ai/mastra/commit/fe3b897c2ccbcd2b10e81b099438c7337feddf89), [`c576fc0`](https://github.com/mastra-ai/mastra/commit/c576fc0b100b2085afded91a37c97a0ea0ec09c7), [`3defc80`](https://github.com/mastra-ai/mastra/commit/3defc80cf2b88a1b7fc1cc4ddcb91e982a614609), [`00123ba`](https://github.com/mastra-ai/mastra/commit/00123ba96dc9e5cd0b110420ebdba56d8f237b25), [`16153fe`](https://github.com/mastra-ai/mastra/commit/16153fe7eb13c99401f48e6ca32707c965ee28b9), [`9f4a683`](https://github.com/mastra-ai/mastra/commit/9f4a6833e88b52574665c028fd5508ad5c2f6004), [`595a3b8`](https://github.com/mastra-ai/mastra/commit/595a3b8727c901f44e333909c09843c711224440), [`ea0b8de`](https://github.com/mastra-ai/mastra/commit/ea0b8dec0d4bc86a72a7e75b2f56c6017c58786d), [`bc94344`](https://github.com/mastra-ai/mastra/commit/bc943444a1342d8a662151b7bce1df7dae32f59c), [`4ca4306`](https://github.com/mastra-ai/mastra/commit/4ca430614daa5fa04730205a302a43bf4accfe9f), [`64554f4`](https://github.com/mastra-ai/mastra/commit/64554f48f26f028b738a04576d34ff992983529e), [`cccf9c8`](https://github.com/mastra-ai/mastra/commit/cccf9c8b2d2dfc1a5e63919395b83d78c89682a0), [`d4efaf3`](https://github.com/mastra-ai/mastra/commit/d4efaf34e6ec269714d50984d2ba7858f2d2079f), [`74e504a`](https://github.com/mastra-ai/mastra/commit/74e504a3b584eafd2f198001c6a113bbec589fd3), [`29c4309`](https://github.com/mastra-ai/mastra/commit/29c4309f818b24304c041bcb4a8f19b5f13f6b62), [`16785ce`](https://github.com/mastra-ai/mastra/commit/16785ced928f6f22638f4488cf8a125d99211799), [`57d157f`](https://github.com/mastra-ai/mastra/commit/57d157f0b163a95c3e6c9eae31bdb11d1bfc64f9), [`61a5705`](https://github.com/mastra-ai/mastra/commit/61a570551278b6743e64243b3ce7d73de915ca8a), [`903f67d`](https://github.com/mastra-ai/mastra/commit/903f67d184504a273893818c02b961f5423a79ad), [`3f3fc30`](https://github.com/mastra-ai/mastra/commit/3f3fc3096f24c4a26cffeecfe73085928f72aa63), [`d827d08`](https://github.com/mastra-ai/mastra/commit/d827d0808ffe1f3553a84e975806cc989b9735dd), [`e33fdbd`](https://github.com/mastra-ai/mastra/commit/e33fdbd07b33920d81e823122331b0c0bee0bb59), [`4524734`](https://github.com/mastra-ai/mastra/commit/45247343e384717a7c8404296275c56201d6470f), [`7a010c5`](https://github.com/mastra-ai/mastra/commit/7a010c56b846a313a49ae42fccd3d8de2b9f292d), [`2a90c55`](https://github.com/mastra-ai/mastra/commit/2a90c55a86a9210697d5adaab5ee94584b079adc), [`2a53598`](https://github.com/mastra-ai/mastra/commit/2a53598c6d8cfeb904a7fc74e57e526d751c8fa6), [`51acef9`](https://github.com/mastra-ai/mastra/commit/51acef95b5977826594fe3ee24475842bd3d5780), [`81b6a8f`](https://github.com/mastra-ai/mastra/commit/81b6a8ff79f49a7549d15d66624ac1a0b8f5f971), [`8538a0d`](https://github.com/mastra-ai/mastra/commit/8538a0d232619bf55dad7ddc2a8b0ca77c679a87), [`b98ba1a`](https://github.com/mastra-ai/mastra/commit/b98ba1af73e5d6106965c3de30fbe9e6edc907ce), [`af56599`](https://github.com/mastra-ai/mastra/commit/af56599d73244ae3bf0d7bcade656410f8ded37b), [`d90ea65`](https://github.com/mastra-ai/mastra/commit/d90ea6536f7aa51c6545a4e9215b55858e98e16d), [`db70a48`](https://github.com/mastra-ai/mastra/commit/db70a48aeeeeb8e5f92007e8ede52c364ce15287), [`0b6112e`](https://github.com/mastra-ai/mastra/commit/0b6112eea01134d2dce13aabda8bb15c37993315), [`261473a`](https://github.com/mastra-ai/mastra/commit/261473ac637e633064a22076671e2e02b002214d), [`70b300e`](https://github.com/mastra-ai/mastra/commit/70b300ebc631dfc0aa14e61547fef7994adb4ea6), [`eb09742`](https://github.com/mastra-ai/mastra/commit/eb09742197f66c4c38154c3beec78313e69760b2), [`de8239b`](https://github.com/mastra-ai/mastra/commit/de8239bdcb1d8c0cfa06da21f1569912a66bbc8a), [`e4d366a`](https://github.com/mastra-ai/mastra/commit/e4d366aeb500371dd4210d6aa8361a4c21d87034), [`486352b`](https://github.com/mastra-ai/mastra/commit/486352b66c746602b68a95839f830de14c7fb8c0), [`23c10a1`](https://github.com/mastra-ai/mastra/commit/23c10a1efdd9a693c405511ab2dc8a1236603162), [`b5e6cd7`](https://github.com/mastra-ai/mastra/commit/b5e6cd77fc8c8e64e0494c1d06cee3d84e795d1e), [`d171e55`](https://github.com/mastra-ai/mastra/commit/d171e559ead9f52ec728d424844c8f7b164c4510), [`f0fdc14`](https://github.com/mastra-ai/mastra/commit/f0fdc14ee233d619266b3d2bbdeea7d25cfc6d13), [`a4f010b`](https://github.com/mastra-ai/mastra/commit/a4f010b22e4355a5fdee70a1fe0f6e4a692cc29e), [`c7cd3c7`](https://github.com/mastra-ai/mastra/commit/c7cd3c7a187d7aaf79e2ca139de328bf609a14b4), [`db18bc9`](https://github.com/mastra-ai/mastra/commit/db18bc9c3825e2c1a0ad9a183cc9935f6691bfa1), [`96d35f6`](https://github.com/mastra-ai/mastra/commit/96d35f61376bc2b1bf148648a2c1985bd51bef55), [`68ec97d`](https://github.com/mastra-ai/mastra/commit/68ec97d4c07c6393fcf95c2481fc5d73da99f8c8), [`8dc7f55`](https://github.com/mastra-ai/mastra/commit/8dc7f55900395771da851dc7d78d53ae84fe34ec), [`cfabdd4`](https://github.com/mastra-ai/mastra/commit/cfabdd4aae7a726b706942d6836eeca110fb6267), [`9b37b56`](https://github.com/mastra-ai/mastra/commit/9b37b565e1f2a76c24f728945cc740c2b09be9da), [`01b20fe`](https://github.com/mastra-ai/mastra/commit/01b20fefb7c67c2b7d79417598ef4e60256d1225), [`632fdb8`](https://github.com/mastra-ai/mastra/commit/632fdb8b3cd9ff6f90399256d526db439fc1758b), [`dd4f34c`](https://github.com/mastra-ai/mastra/commit/dd4f34c78cbae24063463475b0619575c415f9b8), [`8379099`](https://github.com/mastra-ai/mastra/commit/8379099fc467af6bef54dd7f80c9bd75bf8bbddf), [`0dbf199`](https://github.com/mastra-ai/mastra/commit/0dbf199110f22192ce5c95b1c8148d4872b4d119), [`5cbe88a`](https://github.com/mastra-ai/mastra/commit/5cbe88aefbd9f933bca669fd371ea36bf939ac6d), [`41a23c3`](https://github.com/mastra-ai/mastra/commit/41a23c32f9877d71810f37e24930515df2ff7a0f), [`a1bd7b8`](https://github.com/mastra-ai/mastra/commit/a1bd7b8571db16b94eb01588f451a74758c96d65), [`497f918`](https://github.com/mastra-ai/mastra/commit/497f9182135aaf2beb00887d94fcd93afe149d8b), [`d78b38d`](https://github.com/mastra-ai/mastra/commit/d78b38d898fce285260d3bbb4befade54331617f), [`a0a5b4b`](https://github.com/mastra-ai/mastra/commit/a0a5b4bbebe6c701ebbadf744873aa0d5ca01371), [`ce0a73a`](https://github.com/mastra-ai/mastra/commit/ce0a73abeaa75b10ca38f9e40a255a645d50ebfb), [`5d171ad`](https://github.com/mastra-ai/mastra/commit/5d171ad9ef340387276b77c2bb3e83e83332d729), [`0633100`](https://github.com/mastra-ai/mastra/commit/0633100a911ad22f5256471bdf753da21c104742), [`3759cb0`](https://github.com/mastra-ai/mastra/commit/3759cb064935b5f74c65ac2f52a1145f7352899d), [`929f69c`](https://github.com/mastra-ai/mastra/commit/929f69c3436fa20dd0f0e2f7ebe8270bd82a1529), [`c710c16`](https://github.com/mastra-ai/mastra/commit/c710c1652dccfdc4111c8412bca7a6bb1d48b441), [`10c2735`](https://github.com/mastra-ai/mastra/commit/10c27355edfdad1ee2b826b897df74125eb81fb8), [`354ad0b`](https://github.com/mastra-ai/mastra/commit/354ad0b7b1b8183ac567f236a884fc7ede6d7138), [`cfae733`](https://github.com/mastra-ai/mastra/commit/cfae73394f4920635e6c919c8e95ff9a0788e2e5), [`8c0ec25`](https://github.com/mastra-ai/mastra/commit/8c0ec25646c8a7df253ed1e5ff4863a0d3f1316c), [`e3dfda7`](https://github.com/mastra-ai/mastra/commit/e3dfda7b11bf3b8c4bb55637028befb5f387fc74), [`69ea758`](https://github.com/mastra-ai/mastra/commit/69ea758358edd7117f191c2e69c8bb5fc79e7a1a), [`73b0bb3`](https://github.com/mastra-ai/mastra/commit/73b0bb394dba7c9482eb467a97ab283dbc0ef4db), [`651e772`](https://github.com/mastra-ai/mastra/commit/651e772eb1475fb13e126d3fcc01751297a88214), [`92a2ab4`](https://github.com/mastra-ai/mastra/commit/92a2ab408a21d7f88f8db111838bc247069c2ee9), [`a02e542`](https://github.com/mastra-ai/mastra/commit/a02e542d23179bad250b044b17ff023caa61739f), [`f03ae60`](https://github.com/mastra-ai/mastra/commit/f03ae60500fe350c9d828621006cdafe1975fdd8), [`6b3ba91`](https://github.com/mastra-ai/mastra/commit/6b3ba91494cc10394df96782f349a4f7b1e152cc), [`0bed332`](https://github.com/mastra-ai/mastra/commit/0bed332843f627202c6520eaf671771313cd20f3), [`3bf08bf`](https://github.com/mastra-ai/mastra/commit/3bf08bf9c7c73818ac937b5a69d90e205653115f), [`a372c64`](https://github.com/mastra-ai/mastra/commit/a372c640ad1fd12e8f0613cebdc682fc156b4d95), [`519d9e6`](https://github.com/mastra-ai/mastra/commit/519d9e6d31910457c54bdae8b7b7cb3a69f41831), [`993ad98`](https://github.com/mastra-ai/mastra/commit/993ad98d7ad3bebda9ecef5fec5c94349a0d04bc), [`676ccc7`](https://github.com/mastra-ai/mastra/commit/676ccc7fe92468d2d45d39c31a87825c89fd1ea0), [`3ff2c17`](https://github.com/mastra-ai/mastra/commit/3ff2c17a58e312fad5ea37377262c12d92ca0908), [`a0e437f`](https://github.com/mastra-ai/mastra/commit/a0e437fac561b28ee719e0302d72b2f9b4c138f0), [`d1e74a0`](https://github.com/mastra-ai/mastra/commit/d1e74a0a293866dece31022047f5dbab65a304d0), [`844ea5d`](https://github.com/mastra-ai/mastra/commit/844ea5dc0c248961e7bf73629ae7dcff503e853c), [`5627a8c`](https://github.com/mastra-ai/mastra/commit/5627a8c6dc11fe3711b3fa7a6ffd6eb34100a306), [`398fde3`](https://github.com/mastra-ai/mastra/commit/398fde3f39e707cda79372cdae8f9870e3b57c8d), [`5fe71bc`](https://github.com/mastra-ai/mastra/commit/5fe71bc925dfce597df69c89241f33b378028c63), [`c10398d`](https://github.com/mastra-ai/mastra/commit/c10398d5b88f1d4af556f4267ff06f1d11e89179), [`3ff45d1`](https://github.com/mastra-ai/mastra/commit/3ff45d10e0c80c5335a957ab563da72feb623520), [`dfe3f8c`](https://github.com/mastra-ai/mastra/commit/dfe3f8c7376ffe159236819e19ca522143c1f972), [`f0f8f12`](https://github.com/mastra-ai/mastra/commit/f0f8f125c308f2d0fd36942ef652fd852df7522f), [`b61b93f`](https://github.com/mastra-ai/mastra/commit/b61b93f9e058b11dd2eec169853175d31dbdd567), [`bae33d9`](https://github.com/mastra-ai/mastra/commit/bae33d91a63fbb64d1e80519e1fc1acaed1e9013), [`39e7869`](https://github.com/mastra-ai/mastra/commit/39e7869bc7d0ee391077ce291474d8a84eedccff), [`0d7618b`](https://github.com/mastra-ai/mastra/commit/0d7618bc650bf2800934b243eca5648f4aeed9c2), [`7b763e5`](https://github.com/mastra-ai/mastra/commit/7b763e52fc3eaf699c2a99f2adf418dd46e4e9a5), [`e8dcd71`](https://github.com/mastra-ai/mastra/commit/e8dcd71fa5e473c8ba1d6dad99eef182d20a0491), [`251df45`](https://github.com/mastra-ai/mastra/commit/251df4531407dfa46d805feb40ff3fb49769f455), [`d36cfbb`](https://github.com/mastra-ai/mastra/commit/d36cfbbb6565ba5f827883cc9bb648eb14befdc1), [`e849603`](https://github.com/mastra-ai/mastra/commit/e849603a596269069f58a438b98449ea2770493d), [`f894d14`](https://github.com/mastra-ai/mastra/commit/f894d148946629af7b1f452d65a9cf864cec3765), [`8846867`](https://github.com/mastra-ai/mastra/commit/8846867ffa9a3746767618e314bebac08eb77d87), [`1924cf0`](https://github.com/mastra-ai/mastra/commit/1924cf06816e5e4d4d5333065ec0f4bb02a97799), [`c0b731f`](https://github.com/mastra-ai/mastra/commit/c0b731fb27d712dc8582e846df5c0332a6a0c5ba), [`63f2f18`](https://github.com/mastra-ai/mastra/commit/63f2f1863dffe3ad23221d0660ed4e4f2b81789d), [`5761926`](https://github.com/mastra-ai/mastra/commit/57619260c4a2cdd598763abbacd90de594c6bc76), [`c2b9547`](https://github.com/mastra-ai/mastra/commit/c2b9547bf435f56339f23625a743b2147ab1c7a6), [`3697853`](https://github.com/mastra-ai/mastra/commit/3697853deeb72017d90e0f38a93c1e29221aeca0), [`c900fdd`](https://github.com/mastra-ai/mastra/commit/c900fdd504c41348efdffb205cfe80d48c38fa33), [`c23200d`](https://github.com/mastra-ai/mastra/commit/c23200ddfd60830effb39329674ba4ca93be6aac), [`9312dcd`](https://github.com/mastra-ai/mastra/commit/9312dcd1c6f5b321929e7d382e763d95fdc030f5), [`b2e45ec`](https://github.com/mastra-ai/mastra/commit/b2e45eca727a8db01a81ba93f1a5219c7183c839), [`e4ab0a4`](https://github.com/mastra-ai/mastra/commit/e4ab0a4ff7aae1b837cfbd8fb726fc1376165b56), [`271519f`](https://github.com/mastra-ai/mastra/commit/271519ffffb7efcd5bd2a34ec5c290620c4e7114), [`5d7000f`](https://github.com/mastra-ai/mastra/commit/5d7000f757cd65ea9dc5b05e662fd83dfd44e932), [`43ca8f2`](https://github.com/mastra-ai/mastra/commit/43ca8f2c7334851cc7b4d3d2f037d8784bfbdd5f), [`d6d49f7`](https://github.com/mastra-ai/mastra/commit/d6d49f7b8714fa19a52ff9c7cf7fb7e73751901e), [`00c2387`](https://github.com/mastra-ai/mastra/commit/00c2387f5f04a365316f851e58666ac43f8c4edf), [`a534e95`](https://github.com/mastra-ai/mastra/commit/a534e9591f83b3cc1ebff99c67edf4cda7bf81d3), [`9d0e7fe`](https://github.com/mastra-ai/mastra/commit/9d0e7feca8ed98de959f53476ee1456073673348), [`184f01d`](https://github.com/mastra-ai/mastra/commit/184f01d1f534ec0be9703d3996f2e088b4a560eb), [`53d927c`](https://github.com/mastra-ai/mastra/commit/53d927cc6f03bff33655b7e2b788da445a08731d), [`ad6250d`](https://github.com/mastra-ai/mastra/commit/ad6250dbdaad927e29f74a27b83f6c468b50a705), [`580b592`](https://github.com/mastra-ai/mastra/commit/580b5927afc82fe460dfdf9a38a902511b6b7e7f), [`604a79f`](https://github.com/mastra-ai/mastra/commit/604a79fecf276e26a54a3fe01bb94e65315d2e0e), [`b7b0930`](https://github.com/mastra-ai/mastra/commit/b7b0930dbe72eade8d3882992f2f2db53220e4eb), [`42a42cf`](https://github.com/mastra-ai/mastra/commit/42a42cf3132b9786feecbb8c13c583dce5b0e198), [`3f2faf2`](https://github.com/mastra-ai/mastra/commit/3f2faf2e2d685d6c053cc5af1bf9fedf267b2ce5), [`22f64bc`](https://github.com/mastra-ai/mastra/commit/22f64bc1d37149480b58bf2fefe35b79a1e3e7d5), [`ff4d9a6`](https://github.com/mastra-ai/mastra/commit/ff4d9a6704fc87b31a380a76ed22736fdedbba5a), [`50fd320`](https://github.com/mastra-ai/mastra/commit/50fd320003d0d93831c230ef531bef41f5ba7b3a), [`847c212`](https://github.com/mastra-ai/mastra/commit/847c212caba7df0d6f2fc756b494ac3c75c3720d), [`69821ef`](https://github.com/mastra-ai/mastra/commit/69821ef806482e2c44e2197ac0b050c3fe3a5285), [`363284b`](https://github.com/mastra-ai/mastra/commit/363284bb974e850f06f40f89a28c79d9f432d7e4), [`3a73998`](https://github.com/mastra-ai/mastra/commit/3a73998fa4ebeb7f3dc9301afe78095fc63e7999), [`ffa553a`](https://github.com/mastra-ai/mastra/commit/ffa553a3edc1bd17d73669fba66d6b6f4ac10897), [`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc), [`58e3931`](https://github.com/mastra-ai/mastra/commit/58e3931af9baa5921688566210f00fb0c10479fa), [`ae08bf0`](https://github.com/mastra-ai/mastra/commit/ae08bf0ebc6a4e4da992b711c4a389c32ba84cf4), [`0bed332`](https://github.com/mastra-ai/mastra/commit/0bed332843f627202c6520eaf671771313cd20f3), [`439eaf7`](https://github.com/mastra-ai/mastra/commit/439eaf75447809b05e326666675a4dcbf9c334ce), [`3d3c9e7`](https://github.com/mastra-ai/mastra/commit/3d3c9e7dc0b7b291abe6a11cf3807dd130034961), [`887f0b4`](https://github.com/mastra-ai/mastra/commit/887f0b4746cdbd7cb7d6b17ac9f82aeb58037ea5), [`580b592`](https://github.com/mastra-ai/mastra/commit/580b5927afc82fe460dfdf9a38a902511b6b7e7f), [`b98d9a0`](https://github.com/mastra-ai/mastra/commit/b98d9a02e1a4381a4faf65b7371fe76978a42d2e), [`7fa87f0`](https://github.com/mastra-ai/mastra/commit/7fa87f09b9edfd45a274e5e0d5e109d1a5d9ae8b), [`2562143`](https://github.com/mastra-ai/mastra/commit/256214336b4faa78646c9c1776612393790d8784), [`b7959e6`](https://github.com/mastra-ai/mastra/commit/b7959e6e25a46b480f9ea2217c4c6c588c423791), [`a7ce182`](https://github.com/mastra-ai/mastra/commit/a7ce1822a8785ce45d62dd5c911af465e144f7d7), [`bda6370`](https://github.com/mastra-ai/mastra/commit/bda637009360649aaf579919e7873e33553c273e), [`d7acd8e`](https://github.com/mastra-ai/mastra/commit/d7acd8e987b5d7eff4fd98b0906c17c06a2e83d5), [`c7f1f7d`](https://github.com/mastra-ai/mastra/commit/c7f1f7d24f61f247f018cc2d1f33bf63212959a7), [`0bddc6d`](https://github.com/mastra-ai/mastra/commit/0bddc6d8dbd6f6008c0cba2e4960a2da75a55af1), [`bec5efd`](https://github.com/mastra-ai/mastra/commit/bec5efde96653ccae6604e68c696d1bc6c1a0bf5), [`5947fcd`](https://github.com/mastra-ai/mastra/commit/5947fcdd425531f29f9422026d466c2ee3113c93), [`4aa55b3`](https://github.com/mastra-ai/mastra/commit/4aa55b383cf06043943359ea316572fd969861a7), [`21735a7`](https://github.com/mastra-ai/mastra/commit/21735a7ef306963554a69a89b44f06c3bcd85141), [`735d8c1`](https://github.com/mastra-ai/mastra/commit/735d8c1c0d19fbc09e6f8b66cf41bc7655993838), [`7907fd1`](https://github.com/mastra-ai/mastra/commit/7907fd1c5059813b7b870b81ca71041dc807331b), [`1ed5716`](https://github.com/mastra-ai/mastra/commit/1ed5716830867b3774c4a1b43cc0d82935f32b96), [`acf322e`](https://github.com/mastra-ai/mastra/commit/acf322e0f1fd0189684cf529d91c694bea918a45), [`3bf6c5f`](https://github.com/mastra-ai/mastra/commit/3bf6c5f104c25226cd84e0c77f9dec15f2cac2db), [`2ca67cc`](https://github.com/mastra-ai/mastra/commit/2ca67cc3bb1f6a617353fdcab197d9efebe60d6f), [`9eedf7d`](https://github.com/mastra-ai/mastra/commit/9eedf7de1d6e0022a2f4e5e9e6fe1ec468f9b43c), [`b339816`](https://github.com/mastra-ai/mastra/commit/b339816df0984d0243d944ac2655d6ba5f809cde), [`e16d553`](https://github.com/mastra-ai/mastra/commit/e16d55338403c7553531cc568125c63d53653dff), [`6f941c4`](https://github.com/mastra-ai/mastra/commit/6f941c438ca5f578619788acc7608fc2e23bd176), [`4186bdd`](https://github.com/mastra-ai/mastra/commit/4186bdd00731305726fa06adba0b076a1d50b49f), [`08bb631`](https://github.com/mastra-ai/mastra/commit/08bb631ae2b14684b2678e3549d0b399a6f0561e), [`c942802`](https://github.com/mastra-ai/mastra/commit/c942802a477a925b01859a7b8688d4355715caaa), [`4f0331a`](https://github.com/mastra-ai/mastra/commit/4f0331a79bf6eb5ee598a5086e55de4b5a0ada03), [`a0c8c1b`](https://github.com/mastra-ai/mastra/commit/a0c8c1b87d4fee252aebda73e8637fbe01d761c9), [`1d877b8`](https://github.com/mastra-ai/mastra/commit/1d877b8d7b536a251c1a7a18db7ddcf4f68d6f8b), [`151fe4d`](https://github.com/mastra-ai/mastra/commit/151fe4dd441c8ee038c628a3b9bbece7caf9b406), [`6cbb549`](https://github.com/mastra-ai/mastra/commit/6cbb549475201a2fbf158f0fd7323f6495f46d08), [`cc34739`](https://github.com/mastra-ai/mastra/commit/cc34739c34b6266a91bea561119240a7acf47887), [`c218bd3`](https://github.com/mastra-ai/mastra/commit/c218bd3759e32423735b04843a09404572631014), [`e24d4c0`](https://github.com/mastra-ai/mastra/commit/e24d4c0e8a340c47cfa901ebe299cb9ed6c699b4), [`9e67002`](https://github.com/mastra-ai/mastra/commit/9e67002b52c9be19936c420a489dbee9c5fd6a78), [`7aaf973`](https://github.com/mastra-ai/mastra/commit/7aaf973f83fbbe9521f1f9e7a4fd99b8de464617), [`2c4438b`](https://github.com/mastra-ai/mastra/commit/2c4438b87817ab7eed818c7990fef010475af1a3), [`35edc49`](https://github.com/mastra-ai/mastra/commit/35edc49ac0556db609189641d6341e76771b81fc), [`4d59f58`](https://github.com/mastra-ai/mastra/commit/4d59f58de2d90d6e2810a19d4518e38ddddb9038), [`ef11a61`](https://github.com/mastra-ai/mastra/commit/ef11a61920fa0ed08a5b7ceedd192875af119749), [`2b8893c`](https://github.com/mastra-ai/mastra/commit/2b8893cb108ef9acb72ee7835cd625610d2c1a4a), [`dfe0f61`](https://github.com/mastra-ai/mastra/commit/dfe0f61b48a8b0ad43e55b0c88920089d199a7eb), [`8e5c75b`](https://github.com/mastra-ai/mastra/commit/8e5c75bdb1d08a42d45309a4c72def4b6890230f), [`55ae5af`](https://github.com/mastra-ai/mastra/commit/55ae5afa0a59d777e519825171cef9d73f02992e), [`e1bb9c9`](https://github.com/mastra-ai/mastra/commit/e1bb9c94b4eb68b019ae275981be3feb769b5365), [`351a11f`](https://github.com/mastra-ai/mastra/commit/351a11fcaf2ed1008977fa9b9a489fc422e51cd4), [`8a73529`](https://github.com/mastra-ai/mastra/commit/8a73529ca01187f604b1f3019d0a725ac63ae55f), [`e59e0d3`](https://github.com/mastra-ai/mastra/commit/e59e0d32afb5fcf2c9f3c00c8f81f6c21d3a63fa), [`4fba91b`](https://github.com/mastra-ai/mastra/commit/4fba91bec7c95911dc28e369437596b152b04cd0), [`465ac05`](https://github.com/mastra-ai/mastra/commit/465ac0526a91d175542091c675181f1a96c98c46), [`fa8409b`](https://github.com/mastra-ai/mastra/commit/fa8409bc39cfd8ba6643b9db5269b90b22e2a2f7), [`8a000da`](https://github.com/mastra-ai/mastra/commit/8a000da0c09c679a2312f6b3aa05b2ca78ca7393), [`e7266a2`](https://github.com/mastra-ai/mastra/commit/e7266a278db02035c97a5e9cd9d1669a6b7a535d), [`173c535`](https://github.com/mastra-ai/mastra/commit/173c535c0645b0da404fe09f003778f0b0d4e019), [`7691bb3`](https://github.com/mastra-ai/mastra/commit/7691bb317f62d43b0733209aaa83b428414c8dd1), [`106c960`](https://github.com/mastra-ai/mastra/commit/106c960df5d110ec15ac8f45de8858597fb90ad5), [`ee6c628`](https://github.com/mastra-ai/mastra/commit/ee6c628fabfb18323bee319268d122f3835e393f), [`12b0cc4`](https://github.com/mastra-ai/mastra/commit/12b0cc4077d886b1a552637dedb70a7ade93528c), [`3bf6c5f`](https://github.com/mastra-ai/mastra/commit/3bf6c5f104c25226cd84e0c77f9dec15f2cac2db)]:
  - @mastra/core@1.0.0
  - @mastra/client-js@1.0.0
  - @mastra/ai-sdk@1.0.0
  - @mastra/react@0.1.0
  - @mastra/schema-compat@1.0.0

## 7.0.0-beta.27

### Patch Changes

- Updated dependencies [[`50fd320`](https://github.com/mastra-ai/mastra/commit/50fd320003d0d93831c230ef531bef41f5ba7b3a)]:
  - @mastra/core@1.0.0-beta.27
  - @mastra/client-js@1.0.0-beta.27
  - @mastra/react@0.1.0-beta.27

## 7.0.0-beta.26

### Patch Changes

- Fixed scorer eligibility check in observability to also check span.entityType field ([#12078](https://github.com/mastra-ai/mastra/pull/12078))

- Updated dependencies [[`026b848`](https://github.com/mastra-ai/mastra/commit/026b8483fbf5b6d977be8f7e6aac8d15c75558ac), [`ffa553a`](https://github.com/mastra-ai/mastra/commit/ffa553a3edc1bd17d73669fba66d6b6f4ac10897)]:
  - @mastra/client-js@1.0.0-beta.26
  - @mastra/core@1.0.0-beta.26
  - @mastra/react@0.1.0-beta.26
  - @mastra/ai-sdk@1.0.0-beta.16

## 7.0.0-beta.25

### Patch Changes

- Added human-in-the-loop (HITL) tool approval support for `generate()` method. ([#12056](https://github.com/mastra-ai/mastra/pull/12056))

  **Why:** This provides parity between `stream()` and `generate()` for tool approval flows, allowing non-streaming use cases to leverage `requireToolApproval` without needing to switch to streaming.

  Previously, tool approval with `requireToolApproval` only worked with `stream()`. Now you can use the same approval flow with `generate()` for non-streaming use cases.

  **Using tool approval with generate()**

  ```typescript
  const output = await agent.generate('Find user John', {
    requireToolApproval: true,
  });

  // Check if a tool is waiting for approval
  if (output.finishReason === 'suspended') {
    console.log('Tool requires approval:', output.suspendPayload.toolName);

    // Approve the tool call
    const result = await agent.approveToolCallGenerate({
      runId: output.runId,
      toolCallId: output.suspendPayload.toolCallId,
    });

    console.log(result.text);
  }
  ```

  **Declining a tool call**

  ```typescript
  if (output.finishReason === 'suspended') {
    const result = await agent.declineToolCallGenerate({
      runId: output.runId,
      toolCallId: output.suspendPayload.toolCallId,
    });
  }
  ```

  **New methods added:**
  - `agent.approveToolCallGenerate({ runId, toolCallId })` - Approves a pending tool call and returns the complete result
  - `agent.declineToolCallGenerate({ runId, toolCallId })` - Declines a pending tool call and returns the complete result

  **Server routes added:**
  - `POST /api/agents/:agentId/approve-tool-call-generate`
  - `POST /api/agents/:agentId/decline-tool-call-generate`

  The playground UI now also supports tool approval when using generate mode.

- Fix navigation for processors Studio tab ([#12062](https://github.com/mastra-ai/mastra/pull/12062))

- Added Processors tab to Mastra Studio. You can now view all configured processors, see which agents use them, and test processors directly from the UI. Processor workflows automatically redirect to the workflow graph view with a simplified input mode for testing. ([#12059](https://github.com/mastra-ai/mastra/pull/12059))

- Updated dependencies [[`ed3e3dd`](https://github.com/mastra-ai/mastra/commit/ed3e3ddec69d564fe2b125e083437f76331f1283), [`6833c69`](https://github.com/mastra-ai/mastra/commit/6833c69607418d257750bbcdd84638993d343539), [`47b1c16`](https://github.com/mastra-ai/mastra/commit/47b1c16a01c7ffb6765fe1e499b49092f8b7eba3), [`47b1c16`](https://github.com/mastra-ai/mastra/commit/47b1c16a01c7ffb6765fe1e499b49092f8b7eba3), [`3a76a80`](https://github.com/mastra-ai/mastra/commit/3a76a80284cb71a0faa975abb3d4b2a9631e60cd), [`8538a0d`](https://github.com/mastra-ai/mastra/commit/8538a0d232619bf55dad7ddc2a8b0ca77c679a87), [`9312dcd`](https://github.com/mastra-ai/mastra/commit/9312dcd1c6f5b321929e7d382e763d95fdc030f5), [`7691bb3`](https://github.com/mastra-ai/mastra/commit/7691bb317f62d43b0733209aaa83b428414c8dd1)]:
  - @mastra/core@1.0.0-beta.25
  - @mastra/client-js@1.0.0-beta.25
  - @mastra/react@1.0.0-beta.25
  - @mastra/schema-compat@1.0.0-beta.8
  - @mastra/ai-sdk@1.0.0-beta.16

## 7.0.0-beta.24

### Minor Changes

- Enhance design system components with visual polish and micro-interactions. ([#12045](https://github.com/mastra-ai/mastra/pull/12045))

  Phase 2 of DS enhancement covering 40+ components:
  - **Form Controls**: Checkbox, RadioGroup, Switch, Slider, Combobox with focus rings, hover states, and smooth transitions
  - **Navigation**: Tabs with animated indicator, Steps with progress animation, Collapsible with icon rotation
  - **Feedback**: Alert with entrance animation, Notification with slide animations, Skeleton with gradient shimmer
  - **Display**: Badge with semantic variants, Avatar with interactive mode, StatusBadge enhancements
  - **Layout**: SideDialog with backdrop blur, ScrollArea with visibility transitions

  All components now use consistent design tokens (duration-normal, ease-out-custom, shadow-focus-ring) and GPU-accelerated properties for smooth 60fps animations.

### Patch Changes

- Updated dependencies [[`1dbd8c7`](https://github.com/mastra-ai/mastra/commit/1dbd8c729fb6536ec52f00064d76b80253d346e9), [`c59e13c`](https://github.com/mastra-ai/mastra/commit/c59e13c7688284bd96b2baee3e314335003548de), [`f93e2f5`](https://github.com/mastra-ai/mastra/commit/f93e2f575e775e627e5c1927cefdd72db07858ed), [`461e448`](https://github.com/mastra-ai/mastra/commit/461e448852fe999506a6046d50b1efc27d8aa378), [`f9a2509`](https://github.com/mastra-ai/mastra/commit/f9a25093ea72d210a5e52cfcb3bcc8b5e02dc25c), [`64554f4`](https://github.com/mastra-ai/mastra/commit/64554f48f26f028b738a04576d34ff992983529e), [`7a010c5`](https://github.com/mastra-ai/mastra/commit/7a010c56b846a313a49ae42fccd3d8de2b9f292d)]:
  - @mastra/core@1.0.0-beta.24
  - @mastra/schema-compat@1.0.0-beta.7
  - @mastra/client-js@1.0.0-beta.24
  - @mastra/react@1.0.0-beta.24

## 7.0.0-beta.23

### Patch Changes

- Updated dependencies [[`c8417b4`](https://github.com/mastra-ai/mastra/commit/c8417b41d9f3486854dc7842d977fbe5e2166264), [`dd4f34c`](https://github.com/mastra-ai/mastra/commit/dd4f34c78cbae24063463475b0619575c415f9b8)]:
  - @mastra/core@1.0.0-beta.23
  - @mastra/client-js@1.0.0-beta.23
  - @mastra/react@0.1.0-beta.23

## 7.0.0-beta.22

### Minor Changes

- Added consistent sizing, radius, and focus effects across all form elements. ([#11970](https://github.com/mastra-ai/mastra/pull/11970))

  **New size prop** for form elements with unified values:
  - `sm` (24px)
  - `md` (32px)
  - `lg` (40px)

  Components now share a consistent `size` prop: Button, Input, SelectTrigger, Searchbar, InputField, SelectField, and Combobox.

  ```tsx
  // Before - inconsistent props
  <Input customSize="default" />
  <Button size="md" /> // was 24px

  // After - unified size prop
  <Input size="md" />
  <Button size="md" /> // now 32px
  <SelectTrigger size="lg" />
  ```

  **Breaking changes:**
  - Input: `customSize` prop renamed to `size`
  - Button: `size="md"` now renders at 32px (was 24px). Use `size="sm"` for 24px height.

  **Other changes:**
  - All form elements now use `rounded-md` radius
  - All form elements now use `focus:outline focus:outline-accent1` focus effect
  - Removed `button-md` and `button-lg` size tokens (use `form-sm`, `form-md`, `form-lg` instead)

- Added platform-aware navigation filtering using `useMastraPlatform` hook. Nav links now include an `isOnMastraPlatform` property that controls visibility based on whether the app is running on Mastra Platform or locally. ([#11990](https://github.com/mastra-ai/mastra/pull/11990))

- consolidate duplicated components between ds and ui directories ([#11876](https://github.com/mastra-ai/mastra/pull/11876))

### Patch Changes

- Add Storybook stories for all design system components. Includes stories for 48 components organized by category (Elements, Feedback, Navigation, DataDisplay, Layout, Composite) plus an Icons showcase displaying all 41 icons. ([#11921](https://github.com/mastra-ai/mastra/pull/11921))

- Consolidate UI components into design system folder. Moves all UI primitives from `src/components/ui/` to `src/ds/components/` to establish a single source of truth for UI components. Import paths updated across the codebase. No API changes - all exports remain the same. ([#11886](https://github.com/mastra-ai/mastra/pull/11886))

- Consolidate Tailwind config as the single source of truth. The playground package now imports the config via a preset export instead of duplicating all theme definitions. ([#11916](https://github.com/mastra-ai/mastra/pull/11916))

- Aligned border, background, and radius styles across Dialog, AlertDialog, Popover, and Select components for visual consistency. All overlay components now use border-border1, bg-surface3, and rounded-md. ([#11974](https://github.com/mastra-ai/mastra/pull/11974))

- Add human-in-the-loop (HITL) support to agent networks ([#11678](https://github.com/mastra-ai/mastra/pull/11678))
  - Add suspend/resume capabilities to agent network
  - Enable auto-resume for suspended network execution via `autoResumeSuspendedTools`

  `agent.resumeNetwork`, `agent.approveNetworkToolCall`, `agent.declineNetworkToolCall`

- fix(playground-ui): prevent temperature and topP conflict for Anthropic Claude 4.5+ models ([#11777](https://github.com/mastra-ai/mastra/pull/11777))
  - Auto-clear topP for Claude 4.5+ models when both temperature and topP are set
  - Show warning banner when user manually sets both values for restricted models
  - Non-restricted models (OpenAI, Google, Claude 3.5) keep both defaults

  Fixes #11760

- Removed legacy spacing tokens (sm, md, lg) from the design system. These tokens were deprecated aliases that mapped to standard Tailwind spacing values (0.5, 1, 2). All components have been updated to use the standard spacing tokens directly. ([#11978](https://github.com/mastra-ai/mastra/pull/11978))

- Move AutoForm from ds/components to lib/form for better organization ([#11915](https://github.com/mastra-ai/mastra/pull/11915))

- Merge `IconColors` into `Colors` object in design tokens. Icon color tokens (`icon1` through `icon6`) are now part of the main `Colors` export. ([#11932](https://github.com/mastra-ai/mastra/pull/11932))

- Remove legacy `colors.mastra` from Tailwind config and migrate to design system tokens (`Colors`, `IconColors`). ([#11925](https://github.com/mastra-ai/mastra/pull/11925))

- Rollback color of sidebar cloud cta ([#11877](https://github.com/mastra-ai/mastra/pull/11877))

- Remove unused keyframes and animations from tailwind config ([#11930](https://github.com/mastra-ai/mastra/pull/11930))

- Rename icon color tokens to neutral for better semantic naming ([#11933](https://github.com/mastra-ai/mastra/pull/11933))

- Replaced arbitrary Tailwind CSS values with standard utility classes for better consistency and maintainability. ([#11965](https://github.com/mastra-ai/mastra/pull/11965))
  - Changed arbitrary spacing values like `gap-[1rem]`, `p-[1.5rem]`, `px-[2rem]` to standard classes (`gap-4`, `p-6`, `px-8`)
  - Updated z-index values from `z-[1]` and `z-[100]` to standard `z-10` and `z-50`
  - Replaced arbitrary gap values like `gap-[6px]` with `gap-1.5`
  - Updated duration values from `duration-[1s]` to `duration-1000`

- Replaced arbitrary Tailwind text sizes with semantic design tokens for consistent typography. ([#11956](https://github.com/mastra-ai/mastra/pull/11956))

  **Changes:**
  - Consolidated font size tokens from 5 fractional rem values to 8 clean sizes
  - Replaced 129 occurrences of arbitrary `text-[...]` patterns across 44 files
  - Added new header size tokens (`header-sm`, `header-lg`, `header-xl`)

  **New token scale:**
  - `ui-xs`: 10px
  - `ui-sm`: 12px (was 11px)
  - `ui-md`: 14px (was 12px)
  - `ui-lg`: 16px (was 13px)
  - `header-sm`: 18px
  - `header-md`: 20px (was 16px)
  - `header-lg`: 24px
  - `header-xl`: 28px

- Replaced direct `clsx` imports with the `cn` utility across all components for consistent Tailwind class merging. ([#11938](https://github.com/mastra-ai/mastra/pull/11938))

- Replace CSS variable colors with design tokens ([#11928](https://github.com/mastra-ai/mastra/pull/11928))

- Removed unused files, dependencies, and exports from playground packages. Deleted orphaned tool-list.tsx and workflow-list.tsx components, removed unused react-code-block dependency, and cleaned up 12 unused exports across object utilities, string helpers, and hooks. ([#11979](https://github.com/mastra-ai/mastra/pull/11979))

- Converted spacing design tokens from pixels to REM units for better accessibility. Spacing now scales with the user's browser font size settings. All existing Tailwind spacing classes (`p-4`, `gap-2`, `m-8`, etc.) continue to work unchanged. ([#11968](https://github.com/mastra-ai/mastra/pull/11968))

- Simplify Storybook configuration by removing Radix UI module resolution hacks and creating a dedicated CSS file for Storybook ([#11920](https://github.com/mastra-ai/mastra/pull/11920))

- Agent's right sidebar is now 30% wide before resizing. It makes it easier to read the information at a first glance ([#11803](https://github.com/mastra-ai/mastra/pull/11803))

- Updated dependencies [[`ebae12a`](https://github.com/mastra-ai/mastra/commit/ebae12a2dd0212e75478981053b148a2c246962d), [`c61a0a5`](https://github.com/mastra-ai/mastra/commit/c61a0a5de4904c88fd8b3718bc26d1be1c2ec6e7), [`69136e7`](https://github.com/mastra-ai/mastra/commit/69136e748e32f57297728a4e0f9a75988462f1a7), [`449aed2`](https://github.com/mastra-ai/mastra/commit/449aed2ba9d507b75bf93d427646ea94f734dfd1), [`eb648a2`](https://github.com/mastra-ai/mastra/commit/eb648a2cc1728f7678768dd70cd77619b448dab9), [`0131105`](https://github.com/mastra-ai/mastra/commit/0131105532e83bdcbb73352fc7d0879eebf140dc), [`9d5059e`](https://github.com/mastra-ai/mastra/commit/9d5059eae810829935fb08e81a9bb7ecd5b144a7), [`ef756c6`](https://github.com/mastra-ai/mastra/commit/ef756c65f82d16531c43f49a27290a416611e526), [`b00ccd3`](https://github.com/mastra-ai/mastra/commit/b00ccd325ebd5d9e37e34dd0a105caae67eb568f), [`e09a788`](https://github.com/mastra-ai/mastra/commit/e09a788e01698a711c7f705ce8d64ef8a20c3582), [`3bdfa75`](https://github.com/mastra-ai/mastra/commit/3bdfa7507a91db66f176ba8221aa28dd546e464a), [`e770de9`](https://github.com/mastra-ai/mastra/commit/e770de941a287a49b1964d44db5a5763d19890a6), [`52e2716`](https://github.com/mastra-ai/mastra/commit/52e2716b42df6eff443de72360ae83e86ec23993), [`27b4040`](https://github.com/mastra-ai/mastra/commit/27b4040bfa1a95d92546f420a02a626b1419a1d6), [`610a70b`](https://github.com/mastra-ai/mastra/commit/610a70bdad282079f0c630e0d7bb284578f20151), [`8dc7f55`](https://github.com/mastra-ai/mastra/commit/8dc7f55900395771da851dc7d78d53ae84fe34ec), [`8379099`](https://github.com/mastra-ai/mastra/commit/8379099fc467af6bef54dd7f80c9bd75bf8bbddf), [`8c0ec25`](https://github.com/mastra-ai/mastra/commit/8c0ec25646c8a7df253ed1e5ff4863a0d3f1316c), [`ff4d9a6`](https://github.com/mastra-ai/mastra/commit/ff4d9a6704fc87b31a380a76ed22736fdedbba5a), [`69821ef`](https://github.com/mastra-ai/mastra/commit/69821ef806482e2c44e2197ac0b050c3fe3a5285), [`1ed5716`](https://github.com/mastra-ai/mastra/commit/1ed5716830867b3774c4a1b43cc0d82935f32b96), [`4186bdd`](https://github.com/mastra-ai/mastra/commit/4186bdd00731305726fa06adba0b076a1d50b49f), [`7aaf973`](https://github.com/mastra-ai/mastra/commit/7aaf973f83fbbe9521f1f9e7a4fd99b8de464617)]:
  - @mastra/core@1.0.0-beta.22
  - @mastra/react@0.1.0-beta.22
  - @mastra/client-js@1.0.0-beta.22
  - @mastra/ai-sdk@1.0.0-beta.15

## 7.0.0-beta.21

### Patch Changes

- Replace deprecated client.getTraces with a client.listTraces ([#11711](https://github.com/mastra-ai/mastra/pull/11711))

- Make initialState optional in studio ([#11744](https://github.com/mastra-ai/mastra/pull/11744))

- Updated dependencies [[`08766f1`](https://github.com/mastra-ai/mastra/commit/08766f15e13ac0692fde2a8bd366c2e16e4321df), [`ae8baf7`](https://github.com/mastra-ai/mastra/commit/ae8baf7d8adcb0ff9dac11880400452bc49b33ff), [`cfabdd4`](https://github.com/mastra-ai/mastra/commit/cfabdd4aae7a726b706942d6836eeca110fb6267), [`3bf08bf`](https://github.com/mastra-ai/mastra/commit/3bf08bf9c7c73818ac937b5a69d90e205653115f), [`a0e437f`](https://github.com/mastra-ai/mastra/commit/a0e437fac561b28ee719e0302d72b2f9b4c138f0), [`bec5efd`](https://github.com/mastra-ai/mastra/commit/bec5efde96653ccae6604e68c696d1bc6c1a0bf5), [`9eedf7d`](https://github.com/mastra-ai/mastra/commit/9eedf7de1d6e0022a2f4e5e9e6fe1ec468f9b43c)]:
  - @mastra/core@1.0.0-beta.21
  - @mastra/schema-compat@1.0.0-beta.6
  - @mastra/ai-sdk@1.0.0-beta.14
  - @mastra/client-js@1.0.0-beta.21
  - @mastra/react@0.1.0-beta.21

## 7.0.0-beta.20

### Patch Changes

- dependencies updates: ([#11404](https://github.com/mastra-ai/mastra/pull/11404))
  - Updated dependency [`zustand@^5.0.9` ↗︎](https://www.npmjs.com/package/zustand/v/5.0.9) (from `^5.0.8`, in `dependencies`)

- dependencies updates: ([#11588](https://github.com/mastra-ai/mastra/pull/11588))
  - Updated dependency [`zustand@^5.0.9` ↗︎](https://www.npmjs.com/package/zustand/v/5.0.9) (from `^5.0.8`, in `dependencies`)

- Add missing loading state handlers to TanStack Query hooks. Components now properly show skeleton/loading UI instead of returning null or rendering incomplete states while data is being fetched. ([#11681](https://github.com/mastra-ai/mastra/pull/11681))

- Remove `streamVNext`, `resumeStreamVNext`, and `observeStreamVNext` methods, call `stream`, `resumeStream` and `observeStream` directly ([#11499](https://github.com/mastra-ai/mastra/pull/11499))

  ```diff
  + const run = await workflow.createRun({ runId: '123' });
  - const stream = await run.streamVNext({ inputData: { ... } });
  + const stream = await run.stream({ inputData: { ... } });
  ```

- Dedupe Avatar component by removing UI avatar and using DS Avatar with size variants ([#11637](https://github.com/mastra-ai/mastra/pull/11637))

- Consolidate date picker components by removing duplicate DatePicker and Calendar components. DateField now uses the DayPicker wrapper from date-time-picker folder directly. ([#11649](https://github.com/mastra-ai/mastra/pull/11649))

- Consolidate tabs components: remove redundant implementations and add onClose prop support ([#11650](https://github.com/mastra-ai/mastra/pull/11650))

- Use the same Button component every where. Remove duplicates. ([#11635](https://github.com/mastra-ai/mastra/pull/11635))

- Add initial state input to workflow form in studio ([#11560](https://github.com/mastra-ai/mastra/pull/11560))

- Remove unused files and dependencies identified by Knip ([#11677](https://github.com/mastra-ai/mastra/pull/11677))

- Fix react/react-DOM version mismatch. ([#11620](https://github.com/mastra-ai/mastra/pull/11620))

- Adds thread cloning to create independent copies of conversations that can diverge. ([#11517](https://github.com/mastra-ai/mastra/pull/11517))

  ```typescript
  // Clone a thread
  const { thread, clonedMessages } = await memory.cloneThread({
    sourceThreadId: 'thread-123',
    title: 'My Clone',
    options: {
      messageLimit: 10, // optional: only copy last N messages
    },
  });

  // Check if a thread is a clone
  if (memory.isClone(thread)) {
    const source = await memory.getSourceThread(thread.id);
  }

  // List all clones of a thread
  const clones = await memory.listClones('thread-123');
  ```

  Includes:
  - Storage implementations for InMemory, PostgreSQL, LibSQL, Upstash
  - API endpoint: `POST /api/memory/threads/:threadId/clone`
  - Embeddings created for cloned messages (semantic recall)
  - Clone button in playground UI Memory tab

- Display network completion validation results and scorer feedback in the Playground when viewing agent network runs, letting users see pass/fail status and actionable feedback from completion scorers ([#11562](https://github.com/mastra-ai/mastra/pull/11562))

- Unified `getWorkflowRunById` and `getWorkflowRunExecutionResult` into a single API that returns `WorkflowState` with both metadata and execution state. ([#11429](https://github.com/mastra-ai/mastra/pull/11429))

  **What changed:**
  - `getWorkflowRunById` now returns a unified `WorkflowState` object containing metadata (runId, workflowName, resourceId, createdAt, updatedAt) along with processed execution state (status, result, error, payload, steps)
  - Added optional `fields` parameter to request only specific fields for better performance
  - Added optional `withNestedWorkflows` parameter to control nested workflow step inclusion
  - Removed `getWorkflowRunExecutionResult` - use `getWorkflowRunById` instead (breaking change)
  - Removed `/execution-result` API endpoints from server (breaking change)
  - Removed `runExecutionResult()` method from client SDK (breaking change)
  - Removed `GetWorkflowRunExecutionResultResponse` type from client SDK (breaking change)

  **Before:**

  ```typescript
  // Had to call two different methods for different data
  const run = await workflow.getWorkflowRunById(runId); // Returns raw WorkflowRun with snapshot
  const result = await workflow.getWorkflowRunExecutionResult(runId); // Returns processed execution state
  ```

  **After:**

  ```typescript
  // Single method returns everything
  const run = await workflow.getWorkflowRunById(runId);
  // Returns: { runId, workflowName, resourceId, createdAt, updatedAt, status, result, error, payload, steps }

  // Request only specific fields for better performance (avoids expensive step fetching)
  const status = await workflow.getWorkflowRunById(runId, { fields: ['status'] });

  // Skip nested workflow steps for faster response
  const run = await workflow.getWorkflowRunById(runId, { withNestedWorkflows: false });
  ```

  **Why:** The previous API required calling two separate methods to get complete workflow run information. This unification simplifies the API surface and gives users control over performance - fetching all steps (especially nested workflows) can be expensive, so the `fields` and `withNestedWorkflows` options let users request only what they need.

- Updated dependencies [[`d2d3e22`](https://github.com/mastra-ai/mastra/commit/d2d3e22a419ee243f8812a84e3453dd44365ecb0), [`bc72b52`](https://github.com/mastra-ai/mastra/commit/bc72b529ee4478fe89ecd85a8be47ce0127b82a0), [`05b8bee`](https://github.com/mastra-ai/mastra/commit/05b8bee9e50e6c2a4a2bf210eca25ee212ca24fa), [`c042bd0`](https://github.com/mastra-ai/mastra/commit/c042bd0b743e0e86199d0cb83344ca7690e34a9c), [`940a2b2`](https://github.com/mastra-ai/mastra/commit/940a2b27480626ed7e74f55806dcd2181c1dd0c2), [`e0941c3`](https://github.com/mastra-ai/mastra/commit/e0941c3d7fc75695d5d258e7008fd5d6e650800c), [`0c0580a`](https://github.com/mastra-ai/mastra/commit/0c0580a42f697cd2a7d5973f25bfe7da9055038a), [`28f5f89`](https://github.com/mastra-ai/mastra/commit/28f5f89705f2409921e3c45178796c0e0d0bbb64), [`e601b27`](https://github.com/mastra-ai/mastra/commit/e601b272c70f3a5ecca610373aa6223012704892), [`3d3366f`](https://github.com/mastra-ai/mastra/commit/3d3366f31683e7137d126a3a57174a222c5801fb), [`5a4953f`](https://github.com/mastra-ai/mastra/commit/5a4953f7d25bb15ca31ed16038092a39cb3f98b3), [`eb9e522`](https://github.com/mastra-ai/mastra/commit/eb9e522ce3070a405e5b949b7bf5609ca51d7fe2), [`20e6f19`](https://github.com/mastra-ai/mastra/commit/20e6f1971d51d3ff6dd7accad8aaaae826d540ed), [`2b7aede`](https://github.com/mastra-ai/mastra/commit/2b7aede89494efaf7c28efe264a86cad8ee1cee6), [`4f0b3c6`](https://github.com/mastra-ai/mastra/commit/4f0b3c66f196c06448487f680ccbb614d281e2f7), [`74c4f22`](https://github.com/mastra-ai/mastra/commit/74c4f22ed4c71e72598eacc346ba95cdbc00294f), [`81b6a8f`](https://github.com/mastra-ai/mastra/commit/81b6a8ff79f49a7549d15d66624ac1a0b8f5f971), [`e4d366a`](https://github.com/mastra-ai/mastra/commit/e4d366aeb500371dd4210d6aa8361a4c21d87034), [`a4f010b`](https://github.com/mastra-ai/mastra/commit/a4f010b22e4355a5fdee70a1fe0f6e4a692cc29e), [`73b0bb3`](https://github.com/mastra-ai/mastra/commit/73b0bb394dba7c9482eb467a97ab283dbc0ef4db), [`5627a8c`](https://github.com/mastra-ai/mastra/commit/5627a8c6dc11fe3711b3fa7a6ffd6eb34100a306), [`3ff45d1`](https://github.com/mastra-ai/mastra/commit/3ff45d10e0c80c5335a957ab563da72feb623520), [`251df45`](https://github.com/mastra-ai/mastra/commit/251df4531407dfa46d805feb40ff3fb49769f455), [`f894d14`](https://github.com/mastra-ai/mastra/commit/f894d148946629af7b1f452d65a9cf864cec3765), [`c2b9547`](https://github.com/mastra-ai/mastra/commit/c2b9547bf435f56339f23625a743b2147ab1c7a6), [`580b592`](https://github.com/mastra-ai/mastra/commit/580b5927afc82fe460dfdf9a38a902511b6b7e7f), [`58e3931`](https://github.com/mastra-ai/mastra/commit/58e3931af9baa5921688566210f00fb0c10479fa), [`580b592`](https://github.com/mastra-ai/mastra/commit/580b5927afc82fe460dfdf9a38a902511b6b7e7f), [`08bb631`](https://github.com/mastra-ai/mastra/commit/08bb631ae2b14684b2678e3549d0b399a6f0561e), [`4fba91b`](https://github.com/mastra-ai/mastra/commit/4fba91bec7c95911dc28e369437596b152b04cd0), [`106c960`](https://github.com/mastra-ai/mastra/commit/106c960df5d110ec15ac8f45de8858597fb90ad5), [`12b0cc4`](https://github.com/mastra-ai/mastra/commit/12b0cc4077d886b1a552637dedb70a7ade93528c)]:
  - @mastra/core@1.0.0-beta.20
  - @mastra/client-js@1.0.0-beta.20
  - @mastra/ai-sdk@1.0.0-beta.13
  - @mastra/react@0.1.0-beta.20

## 7.0.0-beta.19

### Patch Changes

- Updated dependencies [[`e54953e`](https://github.com/mastra-ai/mastra/commit/e54953ed8ce1b28c0d62a19950163039af7834b4), [`bd18eb0`](https://github.com/mastra-ai/mastra/commit/bd18eb0928b1c4f263426f45f49765b32d1ef802), [`7d56d92`](https://github.com/mastra-ai/mastra/commit/7d56d9213886e8353956d7d40df10045fd12b299), [`fdac646`](https://github.com/mastra-ai/mastra/commit/fdac646033a0930a1a4e00d13aa64c40bb7f1e02), [`d07b568`](https://github.com/mastra-ai/mastra/commit/d07b5687819ea8cb1dffa776d0c1765faf4aa1ae), [`70b300e`](https://github.com/mastra-ai/mastra/commit/70b300ebc631dfc0aa14e61547fef7994adb4ea6), [`68ec97d`](https://github.com/mastra-ai/mastra/commit/68ec97d4c07c6393fcf95c2481fc5d73da99f8c8), [`4aa55b3`](https://github.com/mastra-ai/mastra/commit/4aa55b383cf06043943359ea316572fd969861a7)]:
  - @mastra/core@1.0.0-beta.19
  - @mastra/ai-sdk@1.0.0-beta.12
  - @mastra/schema-compat@1.0.0-beta.5
  - @mastra/client-js@1.0.0-beta.19
  - @mastra/react@0.1.0-beta.19

## 7.0.0-beta.18

### Patch Changes

- Updated dependencies [[`5947fcd`](https://github.com/mastra-ai/mastra/commit/5947fcdd425531f29f9422026d466c2ee3113c93)]:
  - @mastra/core@1.0.0-beta.18
  - @mastra/client-js@1.0.0-beta.18
  - @mastra/react@0.1.0-beta.18

## 7.0.0-beta.17

### Patch Changes

- Updated dependencies [[`b5dc973`](https://github.com/mastra-ai/mastra/commit/b5dc9733a5158850298dfb103acb3babdba8a318), [`af56599`](https://github.com/mastra-ai/mastra/commit/af56599d73244ae3bf0d7bcade656410f8ded37b)]:
  - @mastra/core@1.0.0-beta.17
  - @mastra/schema-compat@1.0.0-beta.4
  - @mastra/client-js@1.0.0-beta.17
  - @mastra/react@0.1.0-beta.17

## 7.0.0-beta.16

### Patch Changes

- Fix workflow observability view broken by invalid entityType parameter ([#11427](https://github.com/mastra-ai/mastra/pull/11427))

  The UI workflow observability view was failing with a Zod validation error when trying to filter traces by workflow. The UI was sending `entityType=workflow`, but the backend's `EntityType` enum only accepts `workflow_run`.

  **Root Cause**: The legacy value transformation was happening in the handler (after validation), but Zod validation occurred earlier in the request pipeline, rejecting the request before it could be transformed.

  **Solution**:
  - Added `z.preprocess()` to the query schema to transform `workflow` → `workflow_run` before validation
  - Kept handler transformation for defense in depth
  - Updated UI to use `EntityType.WORKFLOW_RUN` enum value for type safety

  This maintains backward compatibility with legacy clients while fixing the validation error.

  Fixes #11412

- Add container queries, adjust the agent chat and use container queries to better display information on the agent sidebar ([#11408](https://github.com/mastra-ai/mastra/pull/11408))

- Updated dependencies [[`3d93a15`](https://github.com/mastra-ai/mastra/commit/3d93a15796b158c617461c8b98bede476ebb43e2), [`efe406a`](https://github.com/mastra-ai/mastra/commit/efe406a1353c24993280ebc2ed61dd9f65b84b26), [`119e5c6`](https://github.com/mastra-ai/mastra/commit/119e5c65008f3e5cfca954eefc2eb85e3bf40da4), [`74e504a`](https://github.com/mastra-ai/mastra/commit/74e504a3b584eafd2f198001c6a113bbec589fd3), [`e33fdbd`](https://github.com/mastra-ai/mastra/commit/e33fdbd07b33920d81e823122331b0c0bee0bb59), [`929f69c`](https://github.com/mastra-ai/mastra/commit/929f69c3436fa20dd0f0e2f7ebe8270bd82a1529), [`6cbb549`](https://github.com/mastra-ai/mastra/commit/6cbb549475201a2fbf158f0fd7323f6495f46d08), [`8a73529`](https://github.com/mastra-ai/mastra/commit/8a73529ca01187f604b1f3019d0a725ac63ae55f)]:
  - @mastra/core@1.0.0-beta.16
  - @mastra/client-js@1.0.0-beta.16
  - @mastra/react@0.1.0-beta.16
  - @mastra/ai-sdk@1.0.0-beta.11

## 7.0.0-beta.15

### Minor Changes

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

- Add Mastra version footer component that displays installed packages and checks npm registry for available updates and deprecation warnings ([#11211](https://github.com/mastra-ai/mastra/pull/11211))

- Fix clicking nested workflows in sidepanel: resolve runtime error when clicking "View Nested Graph" inside an already-open nested workflow panel, and ensure the graph updates when switching between nested workflows. ([#11391](https://github.com/mastra-ai/mastra/pull/11391))

- Add resizable and collapsible side panels for agents and workflows ([#11371](https://github.com/mastra-ai/mastra/pull/11371))

- Add debugger-like click-through UI to workflow graph ([#11350](https://github.com/mastra-ai/mastra/pull/11350))

- Updated dependencies [[`33a4d2e`](https://github.com/mastra-ai/mastra/commit/33a4d2e4ed8af51f69256232f00c34d6b6b51d48), [`4aaa844`](https://github.com/mastra-ai/mastra/commit/4aaa844a4f19d054490f43638a990cc57bda8d2f), [`4a1a6cb`](https://github.com/mastra-ai/mastra/commit/4a1a6cb3facad54b2bb6780b00ce91d6de1edc08), [`31d13d5`](https://github.com/mastra-ai/mastra/commit/31d13d5fdc2e2380e2e3ee3ec9fb29d2a00f265d), [`4c62166`](https://github.com/mastra-ai/mastra/commit/4c621669f4a29b1f443eca3ba70b814afa286266), [`7bcbf10`](https://github.com/mastra-ai/mastra/commit/7bcbf10133516e03df964b941f9a34e9e4ab4177), [`4353600`](https://github.com/mastra-ai/mastra/commit/43536005a65988a8eede236f69122e7f5a284ba2), [`6986fb0`](https://github.com/mastra-ai/mastra/commit/6986fb064f5db6ecc24aa655e1d26529087b43b3), [`053e979`](https://github.com/mastra-ai/mastra/commit/053e9793b28e970086b0507f7f3b76ea32c1e838), [`e26dc9c`](https://github.com/mastra-ai/mastra/commit/e26dc9c3ccfec54ae3dc3e2b2589f741f9ae60a6), [`55edf73`](https://github.com/mastra-ai/mastra/commit/55edf7302149d6c964fbb7908b43babfc2b52145), [`27c0009`](https://github.com/mastra-ai/mastra/commit/27c0009777a6073d7631b0eb7b481d94e165b5ca), [`dee388d`](https://github.com/mastra-ai/mastra/commit/dee388dde02f2e63c53385ae69252a47ab6825cc), [`3f3fc30`](https://github.com/mastra-ai/mastra/commit/3f3fc3096f24c4a26cffeecfe73085928f72aa63), [`d90ea65`](https://github.com/mastra-ai/mastra/commit/d90ea6536f7aa51c6545a4e9215b55858e98e16d), [`d171e55`](https://github.com/mastra-ai/mastra/commit/d171e559ead9f52ec728d424844c8f7b164c4510), [`632fdb8`](https://github.com/mastra-ai/mastra/commit/632fdb8b3cd9ff6f90399256d526db439fc1758b), [`10c2735`](https://github.com/mastra-ai/mastra/commit/10c27355edfdad1ee2b826b897df74125eb81fb8), [`1924cf0`](https://github.com/mastra-ai/mastra/commit/1924cf06816e5e4d4d5333065ec0f4bb02a97799), [`184f01d`](https://github.com/mastra-ai/mastra/commit/184f01d1f534ec0be9703d3996f2e088b4a560eb), [`b339816`](https://github.com/mastra-ai/mastra/commit/b339816df0984d0243d944ac2655d6ba5f809cde)]:
  - @mastra/core@1.0.0-beta.15
  - @mastra/ai-sdk@1.0.0-beta.11
  - @mastra/client-js@1.0.0-beta.15
  - @mastra/react@0.1.0-beta.15

## 7.0.0-beta.14

### Patch Changes

- Change searchbar to search on input with debounce instead of on Enter key press ([#11138](https://github.com/mastra-ai/mastra/pull/11138))

- Add support for AI SDK v6 (LanguageModelV3) ([#11191](https://github.com/mastra-ai/mastra/pull/11191))

  Agents can now use `LanguageModelV3` models from AI SDK v6 beta providers like `@ai-sdk/openai@^3.0.0-beta`.

  **New features:**
  - Usage normalization: V3's nested usage format is normalized to Mastra's flat format with `reasoningTokens`, `cachedInputTokens`, and raw data preserved in a `raw` field

  **Backward compatible:** All existing V1 and V2 models continue to work unchanged.

- Updated dependencies [[`4f94ed8`](https://github.com/mastra-ai/mastra/commit/4f94ed8177abfde3ec536e3574883e075423350c), [`ac3cc23`](https://github.com/mastra-ai/mastra/commit/ac3cc2397d1966bc0fc2736a223abc449d3c7719), [`a86f4df`](https://github.com/mastra-ai/mastra/commit/a86f4df0407311e0d2ea49b9a541f0938810d6a9), [`029540c`](https://github.com/mastra-ai/mastra/commit/029540ca1e582fc2dd8d288ecd4a9b0f31a954ef), [`66741d1`](https://github.com/mastra-ai/mastra/commit/66741d1a99c4f42cf23a16109939e8348ac6852e), [`01b20fe`](https://github.com/mastra-ai/mastra/commit/01b20fefb7c67c2b7d79417598ef4e60256d1225), [`0dbf199`](https://github.com/mastra-ai/mastra/commit/0dbf199110f22192ce5c95b1c8148d4872b4d119), [`b7b0930`](https://github.com/mastra-ai/mastra/commit/b7b0930dbe72eade8d3882992f2f2db53220e4eb), [`a7ce182`](https://github.com/mastra-ai/mastra/commit/a7ce1822a8785ce45d62dd5c911af465e144f7d7)]:
  - @mastra/core@1.0.0-beta.14
  - @mastra/ai-sdk@1.0.0-beta.10
  - @mastra/client-js@1.0.0-beta.14
  - @mastra/react@0.1.0-beta.14

## 7.0.0-beta.13

### Patch Changes

- Updated dependencies [[`919a22b`](https://github.com/mastra-ai/mastra/commit/919a22b25876f9ed5891efe5facbe682c30ff497)]:
  - @mastra/core@1.0.0-beta.13
  - @mastra/client-js@1.0.0-beta.13
  - @mastra/react@0.1.0-beta.13

## 7.0.0-beta.12

### Patch Changes

- Adds tool/workflow error being surfaced to the side panel in the playground ([#11099](https://github.com/mastra-ai/mastra/pull/11099))

- Auto resume suspended tools if `autoResumeSuspendedTools: true` ([#11157](https://github.com/mastra-ai/mastra/pull/11157))

  The flag can be added to `defaultAgentOptions` when creating the agent or to options in `agent.stream` or `agent.generate`

  ```typescript
  const agent = new Agent({
    //...agent information,
    defaultAgentOptions: {
      autoResumeSuspendedTools: true,
    },
  });
  ```

- Fix trace-span-usage component to handle object values in token usage data. Usage objects can contain nested `inputDetails` and `outputDetails` properties which are objects, not numbers. The component now properly type-checks values and renders object properties as nested key-value pairs. ([#11141](https://github.com/mastra-ai/mastra/pull/11141))

- Add `Run` instance to client-js. `workflow.createRun` returns the `Run` instance which can be used for the different run methods. ([#11207](https://github.com/mastra-ai/mastra/pull/11207))
  With this change, run methods cannot be called directly on workflow instance anymore

  ```diff
  - const result = await workflow.stream({ runId: '123', inputData: { ... } });
  + const run = await workflow.createRun({ runId: '123' });
  + const stream = await run.stream({ inputData: { ... } });
  ```

- Remove deprecated playground-only prompt generation handler (functionality moved to @mastra/server) ([#11074](https://github.com/mastra-ai/mastra/pull/11074))

  Improve prompt enhancement UX: show toast errors when enhancement fails, disable button when no model has a configured API key, and prevent users from disabling all models in the model list

  Add missing `/api/agents/:agentId/instructions/enhance` endpoint that was referenced by `@mastra/client-js` and `@mastra/playground-ui`

- Focus the textarea when clicking anywhere in the entire chat prompt input box ([#11160](https://github.com/mastra-ai/mastra/pull/11160))

- Removes redundant "Working Memory" section from memory config panel (already displayed in dedicated working memory component) ([#11104](https://github.com/mastra-ai/mastra/pull/11104))
  Fixes badge rendering for falsy values by using ?? instead of || (e.g., false was incorrectly displayed as empty string)
  Adds tooltip on disabled "Edit Working Memory" button explaining that working memory becomes available after the agent calls updateWorkingMemory

- Workflow step detail panel improvements ([#11134](https://github.com/mastra-ai/mastra/pull/11134))
  - Add step detail panel to view map configs and nested workflows from the workflow graph
  - Enable line wrapping for code display in map config panel and WHEN condition nodes
  - Auto-switch to "Current Run" tab when opening step details
  - Add colored icons matching workflow graph (orange for map, purple for workflow)
  - Simplify step detail context by removing unused parent stack navigation

- Fix agent default settings not being applied in playground ([#11107](https://github.com/mastra-ai/mastra/pull/11107))
  - Fix settings hook to properly merge agent default options with localStorage values
  - Map `maxOutputTokens` (AI SDK v5) to `maxTokens` for UI compatibility
  - Add `seed` parameter support to model settings
  - Add frequency/presence penalty inputs with sliders
  - Extract and apply agent's `defaultOptions.modelSettings` on load

- fix isTopLevelSpan value definition on SpanScoring to properly recognize lack of span?.parentSpanId value (null or empty string) ([#11083](https://github.com/mastra-ai/mastra/pull/11083))

- Updated dependencies [[`d5ed981`](https://github.com/mastra-ai/mastra/commit/d5ed981c8701c1b8a27a5f35a9a2f7d9244e695f), [`9650cce`](https://github.com/mastra-ai/mastra/commit/9650cce52a1d917ff9114653398e2a0f5c3ba808), [`932d63d`](https://github.com/mastra-ai/mastra/commit/932d63dd51be9c8bf1e00e3671fe65606c6fb9cd), [`b760b73`](https://github.com/mastra-ai/mastra/commit/b760b731aca7c8a3f041f61d57a7f125ae9cb215), [`695a621`](https://github.com/mastra-ai/mastra/commit/695a621528bdabeb87f83c2277cf2bb084c7f2b4), [`2b459f4`](https://github.com/mastra-ai/mastra/commit/2b459f466fd91688eeb2a44801dc23f7f8a887ab), [`486352b`](https://github.com/mastra-ai/mastra/commit/486352b66c746602b68a95839f830de14c7fb8c0), [`09e4bae`](https://github.com/mastra-ai/mastra/commit/09e4bae18dd5357d2ae078a4a95a2af32168ab08), [`24b76d8`](https://github.com/mastra-ai/mastra/commit/24b76d8e17656269c8ed09a0c038adb9cc2ae95a), [`243a823`](https://github.com/mastra-ai/mastra/commit/243a8239c5906f5c94e4f78b54676793f7510ae3), [`1b85674`](https://github.com/mastra-ai/mastra/commit/1b85674123708d9b85834dccc9eae601a9d0891c), [`486352b`](https://github.com/mastra-ai/mastra/commit/486352b66c746602b68a95839f830de14c7fb8c0), [`c61fac3`](https://github.com/mastra-ai/mastra/commit/c61fac3add96f0dcce0208c07415279e2537eb62), [`6f14f70`](https://github.com/mastra-ai/mastra/commit/6f14f706ccaaf81b69544b6c1b75ab66a41e5317), [`09e4bae`](https://github.com/mastra-ai/mastra/commit/09e4bae18dd5357d2ae078a4a95a2af32168ab08), [`4524734`](https://github.com/mastra-ai/mastra/commit/45247343e384717a7c8404296275c56201d6470f), [`2a53598`](https://github.com/mastra-ai/mastra/commit/2a53598c6d8cfeb904a7fc74e57e526d751c8fa6), [`486352b`](https://github.com/mastra-ai/mastra/commit/486352b66c746602b68a95839f830de14c7fb8c0), [`c7cd3c7`](https://github.com/mastra-ai/mastra/commit/c7cd3c7a187d7aaf79e2ca139de328bf609a14b4), [`847c212`](https://github.com/mastra-ai/mastra/commit/847c212caba7df0d6f2fc756b494ac3c75c3720d), [`439eaf7`](https://github.com/mastra-ai/mastra/commit/439eaf75447809b05e326666675a4dcbf9c334ce), [`b98d9a0`](https://github.com/mastra-ai/mastra/commit/b98d9a02e1a4381a4faf65b7371fe76978a42d2e), [`6f941c4`](https://github.com/mastra-ai/mastra/commit/6f941c438ca5f578619788acc7608fc2e23bd176), [`55ae5af`](https://github.com/mastra-ai/mastra/commit/55ae5afa0a59d777e519825171cef9d73f02992e)]:
  - @mastra/core@1.0.0-beta.12
  - @mastra/react@0.1.0-beta.12
  - @mastra/schema-compat@1.0.0-beta.3
  - @mastra/client-js@1.0.0-beta.12
  - @mastra/ai-sdk@1.0.0-beta.9

## 7.0.0-beta.11

### Patch Changes

- Support new Workflow tripwire run status. Tripwires that are thrown from within a workflow will now bubble up and return a graceful state with information about tripwires. ([#10947](https://github.com/mastra-ai/mastra/pull/10947))

  When a workflow contains an agent step that triggers a tripwire, the workflow returns with `status: 'tripwire'` and includes tripwire details:

  ```typescript showLineNumbers copy
  const run = await workflow.createRun();
  const result = await run.start({ inputData: { message: 'Hello' } });

  if (result.status === 'tripwire') {
    console.log('Workflow terminated by tripwire:', result.tripwire?.reason);
    console.log('Processor ID:', result.tripwire?.processorId);
    console.log('Retry requested:', result.tripwire?.retry);
  }
  ```

  Adds new UI state for tripwire in agent chat and workflow UI.

  This is distinct from `status: 'failed'` which indicates an unexpected error. A tripwire status means a processor intentionally stopped execution (e.g., for content moderation).

- Updated dependencies [[`38380b6`](https://github.com/mastra-ai/mastra/commit/38380b60fca905824bdf6b43df307a58efb1aa15), [`798d0c7`](https://github.com/mastra-ai/mastra/commit/798d0c740232653b1d754870e6b43a55c364ffe2), [`ffe84d5`](https://github.com/mastra-ai/mastra/commit/ffe84d54f3b0f85167fe977efd027dba027eb998), [`2c212e7`](https://github.com/mastra-ai/mastra/commit/2c212e704c90e2db83d4109e62c03f0f6ebd2667), [`4ca4306`](https://github.com/mastra-ai/mastra/commit/4ca430614daa5fa04730205a302a43bf4accfe9f), [`3bf6c5f`](https://github.com/mastra-ai/mastra/commit/3bf6c5f104c25226cd84e0c77f9dec15f2cac2db), [`3bf6c5f`](https://github.com/mastra-ai/mastra/commit/3bf6c5f104c25226cd84e0c77f9dec15f2cac2db)]:
  - @mastra/core@1.0.0-beta.11
  - @mastra/client-js@1.0.0-beta.11
  - @mastra/ai-sdk@1.0.0-beta.8
  - @mastra/react@0.1.0-beta.11

## 7.0.0-beta.10

### Minor Changes

- Fix "MessagePartRuntime is not available" error when chatting with agents in Studio playground by replacing deprecated `useMessagePart` hook with `useAssistantState` ([#11039](https://github.com/mastra-ai/mastra/pull/11039))

### Patch Changes

- Remove console.log in playground-ui ([#11004](https://github.com/mastra-ai/mastra/pull/11004))

- Use the hash based stringification mechanism of tanstack query to ensure keys ordering (and to keep the caching key valid and consistent) ([#11008](https://github.com/mastra-ai/mastra/pull/11008))

- Add delete workflow run API ([#10991](https://github.com/mastra-ai/mastra/pull/10991))

  ```typescript
  await workflow.deleteWorkflowRunById(runId);
  ```

- Add the possibility to pass down options to the tanstack query client. Goal is to have cacheable request in cloud and it's not possible for now because of context resolution beeing different ([#11026](https://github.com/mastra-ai/mastra/pull/11026))

- fix: persist data-\* chunks from writer.custom() to memory storage ([#10884](https://github.com/mastra-ai/mastra/pull/10884))
  - Add persistence for custom data chunks (`data-*` parts) emitted via `writer.custom()` in tools
  - Data chunks are now saved to message storage so they survive page refreshes
  - Update `@assistant-ui/react` to v0.11.47 with native `DataMessagePart` support
  - Convert `data-*` parts to `DataMessagePart` format (`{ type: 'data', name: string, data: T }`)
  - Update related `@assistant-ui/*` packages for compatibility

- Updated dependencies [[`edb07e4`](https://github.com/mastra-ai/mastra/commit/edb07e49283e0c28bd094a60e03439bf6ecf0221), [`b7e17d3`](https://github.com/mastra-ai/mastra/commit/b7e17d3f5390bb5a71efc112204413656fcdc18d), [`261473a`](https://github.com/mastra-ai/mastra/commit/261473ac637e633064a22076671e2e02b002214d), [`5d7000f`](https://github.com/mastra-ai/mastra/commit/5d7000f757cd65ea9dc5b05e662fd83dfd44e932), [`4f0331a`](https://github.com/mastra-ai/mastra/commit/4f0331a79bf6eb5ee598a5086e55de4b5a0ada03), [`151fe4d`](https://github.com/mastra-ai/mastra/commit/151fe4dd441c8ee038c628a3b9bbece7caf9b406), [`8a000da`](https://github.com/mastra-ai/mastra/commit/8a000da0c09c679a2312f6b3aa05b2ca78ca7393)]:
  - @mastra/core@1.0.0-beta.10
  - @mastra/client-js@1.0.0-beta.10
  - @mastra/react@0.1.0-beta.10
  - @mastra/ai-sdk@1.0.0-beta.7

## 7.0.0-beta.9

### Patch Changes

- Fix default value showing on workflow form after user submits ([#10983](https://github.com/mastra-ai/mastra/pull/10983))

- Move useScorers down to trace page to trigger it once for all trace spans ([#10985](https://github.com/mastra-ai/mastra/pull/10985))

- Update Observability Trace Spans list UI, so a user can expand/collapse span children/descendants and can filter the list by span type or name ([#10378](https://github.com/mastra-ai/mastra/pull/10378))

- Add UI to match with the mastra studio command ([#10283](https://github.com/mastra-ai/mastra/pull/10283))

- Fix workflow trigger form overflow ([#10986](https://github.com/mastra-ai/mastra/pull/10986))

- Updated dependencies [[`72df8ae`](https://github.com/mastra-ai/mastra/commit/72df8ae595584cdd7747d5c39ffaca45e4507227), [`9198899`](https://github.com/mastra-ai/mastra/commit/91988995c427b185c33714b7f3be955367911324), [`a54793a`](https://github.com/mastra-ai/mastra/commit/a54793a6377edb87d43a795711deedf487152d5c), [`653e65a`](https://github.com/mastra-ai/mastra/commit/653e65ae1f9502c2958a32f47a5a2df11e612a92), [`c6fd6fe`](https://github.com/mastra-ai/mastra/commit/c6fd6fedd09e9cf8004b03a80925f5e94826ad7e), [`5a1ede1`](https://github.com/mastra-ai/mastra/commit/5a1ede1f7ab527b9ead11f7eee2f73e67aeca9e4), [`92a2ab4`](https://github.com/mastra-ai/mastra/commit/92a2ab408a21d7f88f8db111838bc247069c2ee9), [`0bed332`](https://github.com/mastra-ai/mastra/commit/0bed332843f627202c6520eaf671771313cd20f3), [`0bed332`](https://github.com/mastra-ai/mastra/commit/0bed332843f627202c6520eaf671771313cd20f3)]:
  - @mastra/core@1.0.0-beta.9
  - @mastra/ai-sdk@1.0.0-beta.7
  - @mastra/client-js@1.0.0-beta.9
  - @mastra/react@0.1.0-beta.9

## 7.0.0-beta.8

### Patch Changes

- Updated dependencies [[`0d41fe2`](https://github.com/mastra-ai/mastra/commit/0d41fe245355dfc66d61a0d9c85d9400aac351ff), [`6b3ba91`](https://github.com/mastra-ai/mastra/commit/6b3ba91494cc10394df96782f349a4f7b1e152cc), [`3d3c9e7`](https://github.com/mastra-ai/mastra/commit/3d3c9e7dc0b7b291abe6a11cf3807dd130034961), [`7907fd1`](https://github.com/mastra-ai/mastra/commit/7907fd1c5059813b7b870b81ca71041dc807331b)]:
  - @mastra/core@1.0.0-beta.8
  - @mastra/ai-sdk@1.0.0-beta.6
  - @mastra/client-js@1.0.0-beta.8
  - @mastra/react@0.1.0-beta.8

## 7.0.0-beta.7

### Patch Changes

- Add StudioConfig and associated context to manage the headers and base URL of a given Mastra instance. ([#10804](https://github.com/mastra-ai/mastra/pull/10804))

  This also introduces a header form available from the side bar to edit those headers.

- Fix select options overflow when list is long by adding maximum height ([#10813](https://github.com/mastra-ai/mastra/pull/10813))

- Removed uneeded calls to the message endpoint when the user is on a new thread ([#10872](https://github.com/mastra-ai/mastra/pull/10872))

- Add prominent warning banner in observability UI when token limits are exceeded (finishReason: 'length'). ([#10835](https://github.com/mastra-ai/mastra/pull/10835))

  When a model stops generating due to token limits, the span details now display:
  - Clear warning with alert icon
  - Detailed token usage breakdown (input + output = total)
  - Explanation that the response was truncated

  This helps developers quickly identify and debug token limit issues in the observation page.

  Fixes #8828

- Add a specific page for the studio settings and moved the headers configuration form here instead of in a dialog ([#10812](https://github.com/mastra-ai/mastra/pull/10812))

- Updated dependencies [[`3076c67`](https://github.com/mastra-ai/mastra/commit/3076c6778b18988ae7d5c4c5c466366974b2d63f), [`85d7ee1`](https://github.com/mastra-ai/mastra/commit/85d7ee18ff4e14d625a8a30ec6656bb49804989b), [`c6c1092`](https://github.com/mastra-ai/mastra/commit/c6c1092f8fbf76109303f69e000e96fd1960c4ce), [`81dc110`](https://github.com/mastra-ai/mastra/commit/81dc11008d147cf5bdc8996ead1aa61dbdebb6fc), [`7aedb74`](https://github.com/mastra-ai/mastra/commit/7aedb74883adf66af38e270e4068fd42e7a37036), [`8f02d80`](https://github.com/mastra-ai/mastra/commit/8f02d800777397e4b45d7f1ad041988a8b0c6630), [`d7aad50`](https://github.com/mastra-ai/mastra/commit/d7aad501ce61646b76b4b511e558ac4eea9884d0), [`ce0a73a`](https://github.com/mastra-ai/mastra/commit/ce0a73abeaa75b10ca38f9e40a255a645d50ebfb), [`a02e542`](https://github.com/mastra-ai/mastra/commit/a02e542d23179bad250b044b17ff023caa61739f), [`a372c64`](https://github.com/mastra-ai/mastra/commit/a372c640ad1fd12e8f0613cebdc682fc156b4d95), [`5fe71bc`](https://github.com/mastra-ai/mastra/commit/5fe71bc925dfce597df69c89241f33b378028c63), [`8846867`](https://github.com/mastra-ai/mastra/commit/8846867ffa9a3746767618e314bebac08eb77d87), [`42a42cf`](https://github.com/mastra-ai/mastra/commit/42a42cf3132b9786feecbb8c13c583dce5b0e198), [`ae08bf0`](https://github.com/mastra-ai/mastra/commit/ae08bf0ebc6a4e4da992b711c4a389c32ba84cf4), [`21735a7`](https://github.com/mastra-ai/mastra/commit/21735a7ef306963554a69a89b44f06c3bcd85141), [`1d877b8`](https://github.com/mastra-ai/mastra/commit/1d877b8d7b536a251c1a7a18db7ddcf4f68d6f8b)]:
  - @mastra/core@1.0.0-beta.7
  - @mastra/client-js@1.0.0-beta.7
  - @mastra/react@0.1.0-beta.7

## 7.0.0-beta.6

### Patch Changes

- Fix wrong hook arg type when retrieving workflow runs ([#10755](https://github.com/mastra-ai/mastra/pull/10755))

- Fix discriminatedUnion schema information lost when json schema is converted to zod ([#10500](https://github.com/mastra-ai/mastra/pull/10500))

- Hide time travel on map steps in Studio ([#10631](https://github.com/mastra-ai/mastra/pull/10631))

- Added tracing options to workflow runs and agent generate / stream / network. You can now configure tracing options, custom request context keys, and parent trace/span IDs through a new "Tracing options" tab in the workflow/agent ui UI. ([#10742](https://github.com/mastra-ai/mastra/pull/10742))

  **Usage:**

  The workflow settings are now accessible via the new `useTracingSettings` hook and `TracingSettingsProvider`:

  ```tsx
  import { TracingSettingsProvider, useWorkflowSettings } from '@mastra/playground-ui';

  // Wrap your workflow components with the provider
  <TracingSettingsProvider entityId="my-workflow" entityType="workflow">
    <YourWorkflowUI />
  </TracingSettingsProvider>;

  // Access settings in child components
  const { settings, setSettings } = useTracingSettings();

  // Configure tracing options
  setSettings({
    tracingOptions: {
      metadata: { userId: '123' },
      requestContextKeys: ['user.email'],
      traceId: 'abc123',
    },
  });
  ```

  Tracing options are persisted per workflow/agent in localStorage and automatically applied to all workflow/agent executions.

- Updated dependencies [[`ac0d2f4`](https://github.com/mastra-ai/mastra/commit/ac0d2f4ff8831f72c1c66c2be809706d17f65789), [`6edf340`](https://github.com/mastra-ai/mastra/commit/6edf3402f6a46ee8def2f42a2287785251fbffd6), [`17b4b46`](https://github.com/mastra-ai/mastra/commit/17b4b46339898f13f52c4c4e3d16c52630629c29), [`1a0d3fc`](https://github.com/mastra-ai/mastra/commit/1a0d3fc811482c9c376cdf79ee615c23bae9b2d6), [`85a628b`](https://github.com/mastra-ai/mastra/commit/85a628b1224a8f64cd82ea7f033774bf22df7a7e), [`c237233`](https://github.com/mastra-ai/mastra/commit/c23723399ccedf7f5744b3f40997b79246bfbe64), [`15f9e21`](https://github.com/mastra-ai/mastra/commit/15f9e216177201ea6e3f6d0bfb063fcc0953444f), [`ff94dea`](https://github.com/mastra-ai/mastra/commit/ff94dea935f4e34545c63bcb6c29804732698809), [`5b2ff46`](https://github.com/mastra-ai/mastra/commit/5b2ff4651df70c146523a7fca773f8eb0a2272f8), [`db41688`](https://github.com/mastra-ai/mastra/commit/db4168806d007417e2e60b4f68656dca4e5f40c9), [`91c3a61`](https://github.com/mastra-ai/mastra/commit/91c3a61c533b348a18ba4394069efff26ac7d5a7), [`ad7e8f1`](https://github.com/mastra-ai/mastra/commit/ad7e8f16ac843cbd16687ad47b66ba96bcffe111), [`5ca599d`](https://github.com/mastra-ai/mastra/commit/5ca599d0bb59a1595f19f58473fcd67cc71cef58), [`bff1145`](https://github.com/mastra-ai/mastra/commit/bff114556b3cbadad9b2768488708f8ad0e91475), [`5c8ca24`](https://github.com/mastra-ai/mastra/commit/5c8ca247094e0cc2cdbd7137822fb47241f86e77), [`e1b7118`](https://github.com/mastra-ai/mastra/commit/e1b7118f42ca0a97247afc75e57dcd5fdf987752), [`441c7b6`](https://github.com/mastra-ai/mastra/commit/441c7b6665915cfa7fd625fded8c0f518530bf10), [`441c7b6`](https://github.com/mastra-ai/mastra/commit/441c7b6665915cfa7fd625fded8c0f518530bf10), [`e191844`](https://github.com/mastra-ai/mastra/commit/e1918444ca3f80e82feef1dad506cd4ec6e2875f), [`22553f1`](https://github.com/mastra-ai/mastra/commit/22553f11c63ee5e966a9c034a349822249584691), [`7237163`](https://github.com/mastra-ai/mastra/commit/72371635dbf96a87df4b073cc48fc655afbdce3d), [`2500740`](https://github.com/mastra-ai/mastra/commit/2500740ea23da067d6e50ec71c625ab3ce275e64), [`873ecbb`](https://github.com/mastra-ai/mastra/commit/873ecbb517586aa17d2f1e99283755b3ebb2863f), [`4f9bbe5`](https://github.com/mastra-ai/mastra/commit/4f9bbe5968f42c86f4930b8193de3c3c17e5bd36), [`02e51fe`](https://github.com/mastra-ai/mastra/commit/02e51feddb3d4155cfbcc42624fd0d0970d032c0), [`8f3fa3a`](https://github.com/mastra-ai/mastra/commit/8f3fa3a652bb77da092f913ec51ae46e3a7e27dc), [`cd29ad2`](https://github.com/mastra-ai/mastra/commit/cd29ad23a255534e8191f249593849ed29160886), [`bdf4d8c`](https://github.com/mastra-ai/mastra/commit/bdf4d8cdc656d8a2c21d81834bfa3bfa70f56c16), [`854e3da`](https://github.com/mastra-ai/mastra/commit/854e3dad5daac17a91a20986399d3a51f54bf68b), [`ce18d38`](https://github.com/mastra-ai/mastra/commit/ce18d38678c65870350d123955014a8432075fd9), [`cccf9c8`](https://github.com/mastra-ai/mastra/commit/cccf9c8b2d2dfc1a5e63919395b83d78c89682a0), [`61a5705`](https://github.com/mastra-ai/mastra/commit/61a570551278b6743e64243b3ce7d73de915ca8a), [`db70a48`](https://github.com/mastra-ai/mastra/commit/db70a48aeeeeb8e5f92007e8ede52c364ce15287), [`f0fdc14`](https://github.com/mastra-ai/mastra/commit/f0fdc14ee233d619266b3d2bbdeea7d25cfc6d13), [`db18bc9`](https://github.com/mastra-ai/mastra/commit/db18bc9c3825e2c1a0ad9a183cc9935f6691bfa1), [`9b37b56`](https://github.com/mastra-ai/mastra/commit/9b37b565e1f2a76c24f728945cc740c2b09be9da), [`41a23c3`](https://github.com/mastra-ai/mastra/commit/41a23c32f9877d71810f37e24930515df2ff7a0f), [`5d171ad`](https://github.com/mastra-ai/mastra/commit/5d171ad9ef340387276b77c2bb3e83e83332d729), [`f03ae60`](https://github.com/mastra-ai/mastra/commit/f03ae60500fe350c9d828621006cdafe1975fdd8), [`d1e74a0`](https://github.com/mastra-ai/mastra/commit/d1e74a0a293866dece31022047f5dbab65a304d0), [`39e7869`](https://github.com/mastra-ai/mastra/commit/39e7869bc7d0ee391077ce291474d8a84eedccff), [`e849603`](https://github.com/mastra-ai/mastra/commit/e849603a596269069f58a438b98449ea2770493d), [`5761926`](https://github.com/mastra-ai/mastra/commit/57619260c4a2cdd598763abbacd90de594c6bc76), [`c900fdd`](https://github.com/mastra-ai/mastra/commit/c900fdd504c41348efdffb205cfe80d48c38fa33), [`604a79f`](https://github.com/mastra-ai/mastra/commit/604a79fecf276e26a54a3fe01bb94e65315d2e0e), [`887f0b4`](https://github.com/mastra-ai/mastra/commit/887f0b4746cdbd7cb7d6b17ac9f82aeb58037ea5), [`2562143`](https://github.com/mastra-ai/mastra/commit/256214336b4faa78646c9c1776612393790d8784), [`e24d4c0`](https://github.com/mastra-ai/mastra/commit/e24d4c0e8a340c47cfa901ebe299cb9ed6c699b4), [`ef11a61`](https://github.com/mastra-ai/mastra/commit/ef11a61920fa0ed08a5b7ceedd192875af119749)]:
  - @mastra/core@1.0.0-beta.6
  - @mastra/client-js@1.0.0-beta.6
  - @mastra/ai-sdk@1.0.0-beta.5
  - @mastra/react@0.1.0-beta.6
  - @mastra/schema-compat@1.0.0-beta.2

## 7.0.0-beta.5

### Patch Changes

- Add timeTravel APIs and add timeTravel feature to studio ([#10361](https://github.com/mastra-ai/mastra/pull/10361))

- fix(agent): persist messages before tool suspension ([#10369](https://github.com/mastra-ai/mastra/pull/10369))

  Fixes issues where thread and messages were not saved before suspension when tools require approval or call suspend() during execution. This caused conversation history to be lost if users refreshed during tool approval or suspension.

  **Backend changes (@mastra/core):**
  - Add assistant messages to messageList immediately after LLM execution
  - Flush messages synchronously before suspension to persist state
  - Create thread if it doesn't exist before flushing
  - Add metadata helpers to persist and remove tool approval state
  - Pass saveQueueManager and memory context through workflow for immediate persistence

  **Frontend changes (@mastra/react):**
  - Extract runId from pending approvals to enable resumption after refresh
  - Convert `pendingToolApprovals` (DB format) to `requireApprovalMetadata` (runtime format)
  - Handle both `dynamic-tool` and `tool-{NAME}` part types for approval state
  - Change runId from hardcoded `agentId` to unique `uuid()`

  **UI changes (@mastra/playground-ui):**
  - Handle tool calls awaiting approval in message initialization
  - Convert approval metadata format when loading initial messages

  Fixes #9745, #9906

- Fixed "Module not found: Can't resolve '@mastra/ai-sdk/ui'" error when playground-ui is used on Cloud by converting @mastra/ai-sdk to a peer dependency ([#10388](https://github.com/mastra-ai/mastra/pull/10388))

- Updated dependencies [[`21a15de`](https://github.com/mastra-ai/mastra/commit/21a15de369fe82aac26bb642ed7be73505475e8b), [`feb7ee4`](https://github.com/mastra-ai/mastra/commit/feb7ee4d09a75edb46c6669a3beaceec78811747), [`b0e2ea5`](https://github.com/mastra-ai/mastra/commit/b0e2ea5b52c40fae438b9e2f7baee6f0f89c5442), [`c456e01`](https://github.com/mastra-ai/mastra/commit/c456e0149e3c176afcefdbd9bb1d2c5917723725), [`6de8ffd`](https://github.com/mastra-ai/mastra/commit/6de8ffda7ab06bce012fdeac3eacc6d2d138c097), [`ab035c2`](https://github.com/mastra-ai/mastra/commit/ab035c2ef6d8cc7bb25f06f1a38508bd9e6f126b), [`87cf8d3`](https://github.com/mastra-ai/mastra/commit/87cf8d37564040eb4137a5923edb134c6ea51114), [`1a46a56`](https://github.com/mastra-ai/mastra/commit/1a46a566f45a3fcbadc1cf36bf86d351f264bfa3), [`3cf540b`](https://github.com/mastra-ai/mastra/commit/3cf540b9fbfea8f4fc8d3a2319a4e6c0b0cbfd52), [`1c6ce51`](https://github.com/mastra-ai/mastra/commit/1c6ce51f875915ab57fd36873623013699a2a65d), [`898a972`](https://github.com/mastra-ai/mastra/commit/898a9727d286c2510d6b702dfd367e6aaf5c6b0f), [`a97003a`](https://github.com/mastra-ai/mastra/commit/a97003aa1cf2f4022a41912324a1e77263b326b8), [`ccc141e`](https://github.com/mastra-ai/mastra/commit/ccc141ed27da0abc3a3fc28e9e5128152e8e37f4), [`922305b`](https://github.com/mastra-ai/mastra/commit/922305b747c9b081b51af81f5f4d5ba09fb22f5d), [`fe3b897`](https://github.com/mastra-ai/mastra/commit/fe3b897c2ccbcd2b10e81b099438c7337feddf89), [`00123ba`](https://github.com/mastra-ai/mastra/commit/00123ba96dc9e5cd0b110420ebdba56d8f237b25), [`29c4309`](https://github.com/mastra-ai/mastra/commit/29c4309f818b24304c041bcb4a8f19b5f13f6b62), [`16785ce`](https://github.com/mastra-ai/mastra/commit/16785ced928f6f22638f4488cf8a125d99211799), [`de8239b`](https://github.com/mastra-ai/mastra/commit/de8239bdcb1d8c0cfa06da21f1569912a66bbc8a), [`b5e6cd7`](https://github.com/mastra-ai/mastra/commit/b5e6cd77fc8c8e64e0494c1d06cee3d84e795d1e), [`497f918`](https://github.com/mastra-ai/mastra/commit/497f9182135aaf2beb00887d94fcd93afe149d8b), [`3759cb0`](https://github.com/mastra-ai/mastra/commit/3759cb064935b5f74c65ac2f52a1145f7352899d), [`651e772`](https://github.com/mastra-ai/mastra/commit/651e772eb1475fb13e126d3fcc01751297a88214), [`b61b93f`](https://github.com/mastra-ai/mastra/commit/b61b93f9e058b11dd2eec169853175d31dbdd567), [`bae33d9`](https://github.com/mastra-ai/mastra/commit/bae33d91a63fbb64d1e80519e1fc1acaed1e9013), [`c0b731f`](https://github.com/mastra-ai/mastra/commit/c0b731fb27d712dc8582e846df5c0332a6a0c5ba), [`43ca8f2`](https://github.com/mastra-ai/mastra/commit/43ca8f2c7334851cc7b4d3d2f037d8784bfbdd5f), [`2ca67cc`](https://github.com/mastra-ai/mastra/commit/2ca67cc3bb1f6a617353fdcab197d9efebe60d6f), [`9e67002`](https://github.com/mastra-ai/mastra/commit/9e67002b52c9be19936c420a489dbee9c5fd6a78), [`35edc49`](https://github.com/mastra-ai/mastra/commit/35edc49ac0556db609189641d6341e76771b81fc), [`dfe0f61`](https://github.com/mastra-ai/mastra/commit/dfe0f61b48a8b0ad43e55b0c88920089d199a7eb), [`ee6c628`](https://github.com/mastra-ai/mastra/commit/ee6c628fabfb18323bee319268d122f3835e393f)]:
  - @mastra/core@1.0.0-beta.5
  - @mastra/ai-sdk@1.0.0-beta.4
  - @mastra/client-js@1.0.0-beta.5
  - @mastra/react@0.1.0-beta.5

## 7.0.0-beta.4

### Patch Changes

- Updated dependencies [[`47c34d8`](https://github.com/mastra-ai/mastra/commit/47c34d8e8c3e8aae5c00efc6085c064f2404b346), [`6a86fe5`](https://github.com/mastra-ai/mastra/commit/6a86fe56b8ff53ca2eb3ed87ffc0748749ebadce), [`352a5d6`](https://github.com/mastra-ai/mastra/commit/352a5d625cfe09849b21e8f52a24c9f0366759d5), [`595a3b8`](https://github.com/mastra-ai/mastra/commit/595a3b8727c901f44e333909c09843c711224440), [`a0a5b4b`](https://github.com/mastra-ai/mastra/commit/a0a5b4bbebe6c701ebbadf744873aa0d5ca01371), [`69ea758`](https://github.com/mastra-ai/mastra/commit/69ea758358edd7117f191c2e69c8bb5fc79e7a1a), [`993ad98`](https://github.com/mastra-ai/mastra/commit/993ad98d7ad3bebda9ecef5fec5c94349a0d04bc), [`3ff2c17`](https://github.com/mastra-ai/mastra/commit/3ff2c17a58e312fad5ea37377262c12d92ca0908)]:
  - @mastra/ai-sdk@1.0.0-beta.3
  - @mastra/client-js@1.0.0-beta.4
  - @mastra/core@1.0.0-beta.4
  - @mastra/react@0.1.0-beta.4

## 7.0.0-beta.3

### Patch Changes

- dependencies updates: ([#10057](https://github.com/mastra-ai/mastra/pull/10057))
  - Updated dependency [`@uiw/codemirror-theme-github@^4.25.3` ↗︎](https://www.npmjs.com/package/@uiw/codemirror-theme-github/v/4.25.3) (from `^4.25.2`, in `dependencies`)

- dependencies updates: ([#10085](https://github.com/mastra-ai/mastra/pull/10085))
  - Updated dependency [`@xyflow/react@^12.9.3` ↗︎](https://www.npmjs.com/package/@xyflow/react/v/12.9.3) (from `^12.8.6`, in `dependencies`)

- dependencies updates: ([#9850](https://github.com/mastra-ai/mastra/pull/9850))
  - Updated dependency [`@dagrejs/dagre@^1.1.8` ↗︎](https://www.npmjs.com/package/@dagrejs/dagre/v/1.1.8) (from `^1.1.5`, in `dependencies`)

- Refactor agent information for easier cloud recomposable UIs ([#9995](https://github.com/mastra-ai/mastra/pull/9995))

- Add export for agent memory for use in cloud ([#10025](https://github.com/mastra-ai/mastra/pull/10025))

- Fix scorer filtering for SpanScoring, add error and info message for user ([#10160](https://github.com/mastra-ai/mastra/pull/10160))

- Templates now don't dynamically create a branch for every provider, each template should be agnostic and just use a env var to set the models until the user wants to set it otherwise. ([#10036](https://github.com/mastra-ai/mastra/pull/10036))
  MCP docs server will install the beta version of the docs server if they create a project with the beta tag.
  Updates to the templates now will get pushed to the beta branch, when beta goes stable we will merge the beta branch into the main branch for all templates and update the github script to push to main.
  Templates have been cleaned up
  small docs updates based off of how the template migrations went

- Fix double scroll on agent chat container ([#10253](https://github.com/mastra-ai/mastra/pull/10253))

- Updated dependencies [[`2319326`](https://github.com/mastra-ai/mastra/commit/2319326f8c64e503a09bbcf14be2dd65405445e0), [`d629361`](https://github.com/mastra-ai/mastra/commit/d629361a60f6565b5bfb11976fdaf7308af858e2), [`08c31c1`](https://github.com/mastra-ai/mastra/commit/08c31c188ebccd598acaf55e888b6397d01f7eae), [`fd3d338`](https://github.com/mastra-ai/mastra/commit/fd3d338a2c362174ed5b383f1f011ad9fb0302aa), [`c30400a`](https://github.com/mastra-ai/mastra/commit/c30400a49b994b1b97256fe785eb6c906fc2b232), [`69e0a87`](https://github.com/mastra-ai/mastra/commit/69e0a878896a2da9494945d86e056a5f8f05b851), [`01f8878`](https://github.com/mastra-ai/mastra/commit/01f88783de25e4de048c1c8aace43e26373c6ea5), [`4c77209`](https://github.com/mastra-ai/mastra/commit/4c77209e6c11678808b365d545845918c40045c8), [`d827d08`](https://github.com/mastra-ai/mastra/commit/d827d0808ffe1f3553a84e975806cc989b9735dd), [`b98ba1a`](https://github.com/mastra-ai/mastra/commit/b98ba1af73e5d6106965c3de30fbe9e6edc907ce), [`23c10a1`](https://github.com/mastra-ai/mastra/commit/23c10a1efdd9a693c405511ab2dc8a1236603162), [`676ccc7`](https://github.com/mastra-ai/mastra/commit/676ccc7fe92468d2d45d39c31a87825c89fd1ea0), [`c10398d`](https://github.com/mastra-ai/mastra/commit/c10398d5b88f1d4af556f4267ff06f1d11e89179), [`271519f`](https://github.com/mastra-ai/mastra/commit/271519ffffb7efcd5bd2a34ec5c290620c4e7114), [`00c2387`](https://github.com/mastra-ai/mastra/commit/00c2387f5f04a365316f851e58666ac43f8c4edf), [`ad6250d`](https://github.com/mastra-ai/mastra/commit/ad6250dbdaad927e29f74a27b83f6c468b50a705), [`3a73998`](https://github.com/mastra-ai/mastra/commit/3a73998fa4ebeb7f3dc9301afe78095fc63e7999), [`e16d553`](https://github.com/mastra-ai/mastra/commit/e16d55338403c7553531cc568125c63d53653dff), [`4d59f58`](https://github.com/mastra-ai/mastra/commit/4d59f58de2d90d6e2810a19d4518e38ddddb9038), [`e1bb9c9`](https://github.com/mastra-ai/mastra/commit/e1bb9c94b4eb68b019ae275981be3feb769b5365), [`351a11f`](https://github.com/mastra-ai/mastra/commit/351a11fcaf2ed1008977fa9b9a489fc422e51cd4)]:
  - @mastra/core@1.0.0-beta.3
  - @mastra/ai-sdk@1.0.0-beta.2
  - @mastra/client-js@1.0.0-beta.3
  - @mastra/react@0.1.0-beta.3

## 7.0.0-beta.2

### Patch Changes

- Make suspendPayload optional when calling `suspend()` ([#9926](https://github.com/mastra-ai/mastra/pull/9926))
  Save value returned as `suspendOutput` if user returns data still after calling `suspend()`
  Automatically call `commit()` on uncommitted workflows when registering in Mastra instance
  Show actual suspendPayload on Studio in suspend/resume flow
- Updated dependencies [[`627067b`](https://github.com/mastra-ai/mastra/commit/627067b22eeb26601f65fee3646ba17fc0c91501), [`465ac05`](https://github.com/mastra-ai/mastra/commit/465ac0526a91d175542091c675181f1a96c98c46)]:
  - @mastra/ai-sdk@1.0.0-beta.1
  - @mastra/core@1.0.0-beta.2
  - @mastra/client-js@1.0.0-beta.2
  - @mastra/react@0.1.0-beta.2

## 7.0.0-beta.1

### Patch Changes

- Make MainSidebar toggle button sticky to bottom, always visible ([#9682](https://github.com/mastra-ai/mastra/pull/9682))

- Removing uneeded files ([#9877](https://github.com/mastra-ai/mastra/pull/9877))

- Explicitly set color of line number in CodeMirror ([#9878](https://github.com/mastra-ai/mastra/pull/9878))

- Add visual styles and labels for more workflow node types ([#9777](https://github.com/mastra-ai/mastra/pull/9777))

- Updated dependencies [[`910db9e`](https://github.com/mastra-ai/mastra/commit/910db9e0312888495eb5617b567f247d03303814), [`dbd9db0`](https://github.com/mastra-ai/mastra/commit/dbd9db0d5c2797a210b9098e7e3e613718e5442f), [`e7266a2`](https://github.com/mastra-ai/mastra/commit/e7266a278db02035c97a5e9cd9d1669a6b7a535d)]:
  - @mastra/core@1.0.0-beta.1
  - @mastra/client-js@1.0.0-beta.1
  - @mastra/react@0.1.0-beta.1

## 7.0.0-beta.0

### Major Changes

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

- Replace `getThreadsByResourceIdPaginated` with `listThreadsByResourceId` across memory handlers. Update client SDK to use `listThreads()` with `offset`/`limit` parameters instead of deprecated `getMemoryThreads()`. Consolidate `/api/memory/threads` routes to single paginated endpoint. ([#9508](https://github.com/mastra-ai/mastra/pull/9508))

- Rename RuntimeContext to RequestContext ([#9511](https://github.com/mastra-ai/mastra/pull/9511))

- Renamed a bunch of observability/tracing-related things to drop the AI prefix. ([#9744](https://github.com/mastra-ai/mastra/pull/9744))

- **Breaking Change**: Remove legacy v1 watch events and consolidate on v2 implementation. ([#9252](https://github.com/mastra-ai/mastra/pull/9252))

  This change simplifies the workflow watching API by removing the legacy v1 event system and promoting v2 as the standard (renamed to just `watch`).

  ### What's Changed
  - Removed legacy v1 watch event handlers and types
  - Renamed `watch-v2` to `watch` throughout the codebase
  - Removed `.watch()` method from client-js SDK (`Workflow` and `AgentBuilder` classes)
  - Removed `/watch` HTTP endpoints from server and deployer
  - Removed `WorkflowWatchResult` and v1 `WatchEvent` types

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

- Changing getAgents -> listAgents, getTools -> listTools, getWorkflows -> listWorkflows ([#9495](https://github.com/mastra-ai/mastra/pull/9495))

- Mark as stable ([`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc))

- Renamed `MastraMessageV2` to `MastraDBMessage` ([#9255](https://github.com/mastra-ai/mastra/pull/9255))
  Made the return format of all methods that return db messages consistent. It's always `{ messages: MastraDBMessage[] }` now, and messages can be converted after that using `@mastra/ai-sdk/ui`'s `toAISdkV4/5Messages()` function

- Remove legacy evals from Mastra ([#9491](https://github.com/mastra-ai/mastra/pull/9491))

### Minor Changes

- Moving scorers under the eval domain, api method consistency, prebuilt evals, scorers require ids. ([#9589](https://github.com/mastra-ai/mastra/pull/9589))

- Update peer dependencies to match core package version bump (0.22.1) ([#8649](https://github.com/mastra-ai/mastra/pull/8649))

- Toast error from workflow stream and resume stream ([#9431](https://github.com/mastra-ai/mastra/pull/9431))
  Update peer dependencies to match core package version bump (0.22.3)

- Update peer dependencies to match core package version bump (0.22.0) ([#9045](https://github.com/mastra-ai/mastra/pull/9045))

### Patch Changes

- dependencies updates: ([#9800](https://github.com/mastra-ai/mastra/pull/9800))
  - Updated dependency [`@lezer/highlight@^1.2.3` ↗︎](https://www.npmjs.com/package/@lezer/highlight/v/1.2.3) (from `^1.2.1`, in `dependencies`)

- fetch from the client-js sdk instead of local fetch ([#9376](https://github.com/mastra-ai/mastra/pull/9376))

- Update MainSidebar component to fit required changes in Cloud CTA link ([#9318](https://github.com/mastra-ai/mastra/pull/9318))

- Add enhance instruction capability + instruction tweak for experiment purpose ([#9302](https://github.com/mastra-ai/mastra/pull/9302))

- Update peer dependencies to match core package version bump (1.0.0) ([#9237](https://github.com/mastra-ai/mastra/pull/9237))

- Use client-js search memory instead of custom fetch one ([#9326](https://github.com/mastra-ai/mastra/pull/9326))

- Render zod unions and discriminated unions correctly in dynamic form. ([#9317](https://github.com/mastra-ai/mastra/pull/9317))

- Add breacrumb action for popovers ([#9378](https://github.com/mastra-ai/mastra/pull/9378))

- Prefill `providerOptions` on Mastra Studio. When creating your agent, you can add `providerOptions` to the Agent `instructions`, we now prefill the `providerOptions` field on Mastra Studio model settings advanced settings section with the `instructions.providerOptions` added. ([#9156](https://github.com/mastra-ai/mastra/pull/9156))

  Example agent code

  ```@typescript
  export const chefModelV2Agent = new Agent({
    name: 'Chef Agent V2 Model',
    description: 'A chef agent that can help you cook great meals with whatever ingredients you have available.',
    instructions: {
      content: `
        You are Michel, a practical and experienced home chef who helps people cook great meals with whatever
        ingredients they have available. Your first priority is understanding what ingredients and equipment the user has access to, then suggesting achievable recipes.
        You explain cooking steps clearly and offer substitutions when needed, maintaining a friendly and encouraging tone throughout.
        `,
      role: 'system',
      providerOptions: {
        openai: {
          reasoning_effort: 'high',
        },
      },
    },
    model: openai('gpt-4o-mini'),
    tools: {
      cookingTool,
    },
    memory
  });
  ```

- Add tool call approval ([#8649](https://github.com/mastra-ai/mastra/pull/8649))

- Fixes issue where clicking the reset button in the model picker would fail to restore the original LanguageModelV2 (or any other types) object that was passed during agent construction. ([#9481](https://github.com/mastra-ai/mastra/pull/9481))

- Fix multi modal in playground-ui ([#9373](https://github.com/mastra-ai/mastra/pull/9373))

- Remove "show trace" that pointed to legacy traces ([#9470](https://github.com/mastra-ai/mastra/pull/9470))

- Fix resume form for nested workflow not displaying when viewing a previously suspended run on studio ([#9805](https://github.com/mastra-ai/mastra/pull/9805))

- Avoid fetch retries when fetching model providers ([#9452](https://github.com/mastra-ai/mastra/pull/9452))

- Remove unused /model-providers API ([#9533](https://github.com/mastra-ai/mastra/pull/9533))

- Fix undefined runtimeContext using memory from playground ([#9328](https://github.com/mastra-ai/mastra/pull/9328))

- Fix playground white screen when Zod discriminatedUnion is intersected using `and()`. ([#9692](https://github.com/mastra-ai/mastra/pull/9692))
  This now works, but zod validation will fail, please use `extend` instead

  Instead of

  ```
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('byCity'), city: z.string() }),
    z.object({ type: z.literal('byCoords'), lat: z.number(), lon: z.number() }),
  ]).and(
    z.object({ order: z.number() })
  )
  ```

  do

  ```
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('byCity'), city: z.string() }).extend({ order: z.number() }),
    z.object({ type: z.literal('byCoords'), lat: z.number(), lon: z.number() }).extend({ order: z.number() }),
  ]);
  ```

- Extract more components to playground-ui for sharing with cloud ([#9241](https://github.com/mastra-ai/mastra/pull/9241))

- Fix undefined window issue when Sidebar used in Next app ([#9448](https://github.com/mastra-ai/mastra/pull/9448))

- Move WorkflowInformation to playground-ui ([#9297](https://github.com/mastra-ai/mastra/pull/9297))

- Remove `waitForEvent` from workflows. `waitForEvent` is now removed, please use suspend & resume flow instead. See https://mastra.ai/en/docs/workflows/suspend-and-resume for more details on suspend & resume flow. ([#9214](https://github.com/mastra-ai/mastra/pull/9214))

- Add combobox in playground for entities and update routes and error handling ([#9743](https://github.com/mastra-ai/mastra/pull/9743))

- **Breaking Changes:** ([#9045](https://github.com/mastra-ai/mastra/pull/9045))
  - Moved `generateTitle` from `threads.generateTitle` to top-level memory option
  - Changed default value from `true` to `false`
  - Using `threads.generateTitle` now throws an error

  **Migration:**
  Replace `threads: { generateTitle: true }` with `generateTitle: true` at the top level of memory options.

  **Playground:**
  The playground UI now displays thread IDs instead of "Chat from" when titles aren't generated.

- Move some components to playground-ui for usage in cloud ([#9177](https://github.com/mastra-ai/mastra/pull/9177))

- Fix the link from traces to workflow ([#9764](https://github.com/mastra-ai/mastra/pull/9764))

- Remove unecessary react components + dependencies ([#9295](https://github.com/mastra-ai/mastra/pull/9295))

- Fix studio crashing when message contains non JSON text output of tool call ([#9189](https://github.com/mastra-ai/mastra/pull/9189))

- Updated dependencies [[`39c9743`](https://github.com/mastra-ai/mastra/commit/39c97432d084294f8ba85fbf3ef28098ff21459e), [`f743dbb`](https://github.com/mastra-ai/mastra/commit/f743dbb8b40d1627b5c10c0e6fc154f4ebb6e394), [`3852192`](https://github.com/mastra-ai/mastra/commit/3852192c81b2a4f1f883f17d80ce50e0c60dba55), [`fec5129`](https://github.com/mastra-ai/mastra/commit/fec5129de7fc64423ea03661a56cef31dc747a0d), [`0491e7c`](https://github.com/mastra-ai/mastra/commit/0491e7c9b714cb0ba22187ee062147ec2dd7c712), [`f6f4903`](https://github.com/mastra-ai/mastra/commit/f6f4903397314f73362061dc5a3e8e7c61ea34aa), [`0e8ed46`](https://github.com/mastra-ai/mastra/commit/0e8ed467c54d6901a6a365f270ec15d6faadb36c), [`6c049d9`](https://github.com/mastra-ai/mastra/commit/6c049d94063fdcbd5b81c4912a2bf82a92c9cc0b), [`2f897df`](https://github.com/mastra-ai/mastra/commit/2f897df208508f46f51b7625e5dd20c37f93e0e3), [`f0f8f12`](https://github.com/mastra-ai/mastra/commit/f0f8f125c308f2d0fd36942ef652fd852df7522f), [`3443770`](https://github.com/mastra-ai/mastra/commit/3443770662df8eb24c9df3589b2792d78cfcb811), [`f0a07e0`](https://github.com/mastra-ai/mastra/commit/f0a07e0111b3307c5fabfa4094c5c2cfb734fbe6), [`aaa40e7`](https://github.com/mastra-ai/mastra/commit/aaa40e788628b319baa8e889407d11ad626547fa), [`1521d71`](https://github.com/mastra-ai/mastra/commit/1521d716e5daedc74690c983fbd961123c56756b), [`9e1911d`](https://github.com/mastra-ai/mastra/commit/9e1911db2b4db85e0e768c3f15e0d61e319869f6), [`ebac155`](https://github.com/mastra-ai/mastra/commit/ebac15564a590117db7078233f927a7e28a85106), [`dd1c38d`](https://github.com/mastra-ai/mastra/commit/dd1c38d1b75f1b695c27b40d8d9d6ed00d5e0f6f), [`5948e6a`](https://github.com/mastra-ai/mastra/commit/5948e6a5146c83666ba3f294b2be576c82a513fb), [`8940859`](https://github.com/mastra-ai/mastra/commit/89408593658199b4ad67f7b65e888f344e64a442), [`e629310`](https://github.com/mastra-ai/mastra/commit/e629310f1a73fa236d49ec7a1d1cceb6229dc7cc), [`4c6b492`](https://github.com/mastra-ai/mastra/commit/4c6b492c4dd591c6a592520c1f6855d6e936d71f), [`dff01d8`](https://github.com/mastra-ai/mastra/commit/dff01d81ce1f4e4087cfac20fa868e6db138dd14), [`7491634`](https://github.com/mastra-ai/mastra/commit/7491634fd198c37d9934675756b274ae2e5e415e), [`9d819d5`](https://github.com/mastra-ai/mastra/commit/9d819d54b61481639f4008e4694791bddf187edd), [`b7de533`](https://github.com/mastra-ai/mastra/commit/b7de53361667eb51fefd89fcaed924f3c57cee8d), [`71c8d6c`](https://github.com/mastra-ai/mastra/commit/71c8d6c161253207b2b9588bdadb7eed604f7253), [`6179a9b`](https://github.com/mastra-ai/mastra/commit/6179a9ba36ffac326de3cc3c43cdc8028d37c251), [`00f4921`](https://github.com/mastra-ai/mastra/commit/00f4921dd2c91a1e5446799599ef7116a8214a1a), [`ca8041c`](https://github.com/mastra-ai/mastra/commit/ca8041cce0379fda22ed293a565bcb5b6ddca68a), [`7051bf3`](https://github.com/mastra-ai/mastra/commit/7051bf38b3b122a069008f861f7bfc004a6d9f6e), [`a8f1494`](https://github.com/mastra-ai/mastra/commit/a8f1494f4bbdc2770bcf327d4c7d869e332183f1), [`1ee3411`](https://github.com/mastra-ai/mastra/commit/1ee34113192b11aa8bcdd8d9d5830ae13254b345), [`0793497`](https://github.com/mastra-ai/mastra/commit/079349753620c40246ffd673e3f9d7d9820beff3), [`5df9cce`](https://github.com/mastra-ai/mastra/commit/5df9cce1a753438413f64c11eeef8f845745c2a8), [`f93d992`](https://github.com/mastra-ai/mastra/commit/f93d992a37d5431ab4a71246835d403ef7c4ce85), [`a854ede`](https://github.com/mastra-ai/mastra/commit/a854ede62bf5ac0945a624ac48913dd69c73aabf), [`c576fc0`](https://github.com/mastra-ai/mastra/commit/c576fc0b100b2085afded91a37c97a0ea0ec09c7), [`3defc80`](https://github.com/mastra-ai/mastra/commit/3defc80cf2b88a1b7fc1cc4ddcb91e982a614609), [`16153fe`](https://github.com/mastra-ai/mastra/commit/16153fe7eb13c99401f48e6ca32707c965ee28b9), [`9f4a683`](https://github.com/mastra-ai/mastra/commit/9f4a6833e88b52574665c028fd5508ad5c2f6004), [`ea0b8de`](https://github.com/mastra-ai/mastra/commit/ea0b8dec0d4bc86a72a7e75b2f56c6017c58786d), [`bc94344`](https://github.com/mastra-ai/mastra/commit/bc943444a1342d8a662151b7bce1df7dae32f59c), [`d4efaf3`](https://github.com/mastra-ai/mastra/commit/d4efaf34e6ec269714d50984d2ba7858f2d2079f), [`57d157f`](https://github.com/mastra-ai/mastra/commit/57d157f0b163a95c3e6c9eae31bdb11d1bfc64f9), [`903f67d`](https://github.com/mastra-ai/mastra/commit/903f67d184504a273893818c02b961f5423a79ad), [`2a90c55`](https://github.com/mastra-ai/mastra/commit/2a90c55a86a9210697d5adaab5ee94584b079adc), [`0b6112e`](https://github.com/mastra-ai/mastra/commit/0b6112eea01134d2dce13aabda8bb15c37993315), [`eb09742`](https://github.com/mastra-ai/mastra/commit/eb09742197f66c4c38154c3beec78313e69760b2), [`96d35f6`](https://github.com/mastra-ai/mastra/commit/96d35f61376bc2b1bf148648a2c1985bd51bef55), [`5cbe88a`](https://github.com/mastra-ai/mastra/commit/5cbe88aefbd9f933bca669fd371ea36bf939ac6d), [`a1bd7b8`](https://github.com/mastra-ai/mastra/commit/a1bd7b8571db16b94eb01588f451a74758c96d65), [`d78b38d`](https://github.com/mastra-ai/mastra/commit/d78b38d898fce285260d3bbb4befade54331617f), [`0633100`](https://github.com/mastra-ai/mastra/commit/0633100a911ad22f5256471bdf753da21c104742), [`c710c16`](https://github.com/mastra-ai/mastra/commit/c710c1652dccfdc4111c8412bca7a6bb1d48b441), [`354ad0b`](https://github.com/mastra-ai/mastra/commit/354ad0b7b1b8183ac567f236a884fc7ede6d7138), [`cfae733`](https://github.com/mastra-ai/mastra/commit/cfae73394f4920635e6c919c8e95ff9a0788e2e5), [`e3dfda7`](https://github.com/mastra-ai/mastra/commit/e3dfda7b11bf3b8c4bb55637028befb5f387fc74), [`519d9e6`](https://github.com/mastra-ai/mastra/commit/519d9e6d31910457c54bdae8b7b7cb3a69f41831), [`844ea5d`](https://github.com/mastra-ai/mastra/commit/844ea5dc0c248961e7bf73629ae7dcff503e853c), [`398fde3`](https://github.com/mastra-ai/mastra/commit/398fde3f39e707cda79372cdae8f9870e3b57c8d), [`dfe3f8c`](https://github.com/mastra-ai/mastra/commit/dfe3f8c7376ffe159236819e19ca522143c1f972), [`f0f8f12`](https://github.com/mastra-ai/mastra/commit/f0f8f125c308f2d0fd36942ef652fd852df7522f), [`0d7618b`](https://github.com/mastra-ai/mastra/commit/0d7618bc650bf2800934b243eca5648f4aeed9c2), [`7b763e5`](https://github.com/mastra-ai/mastra/commit/7b763e52fc3eaf699c2a99f2adf418dd46e4e9a5), [`e8dcd71`](https://github.com/mastra-ai/mastra/commit/e8dcd71fa5e473c8ba1d6dad99eef182d20a0491), [`d36cfbb`](https://github.com/mastra-ai/mastra/commit/d36cfbbb6565ba5f827883cc9bb648eb14befdc1), [`63f2f18`](https://github.com/mastra-ai/mastra/commit/63f2f1863dffe3ad23221d0660ed4e4f2b81789d), [`3697853`](https://github.com/mastra-ai/mastra/commit/3697853deeb72017d90e0f38a93c1e29221aeca0), [`c23200d`](https://github.com/mastra-ai/mastra/commit/c23200ddfd60830effb39329674ba4ca93be6aac), [`b2e45ec`](https://github.com/mastra-ai/mastra/commit/b2e45eca727a8db01a81ba93f1a5219c7183c839), [`e4ab0a4`](https://github.com/mastra-ai/mastra/commit/e4ab0a4ff7aae1b837cfbd8fb726fc1376165b56), [`d6d49f7`](https://github.com/mastra-ai/mastra/commit/d6d49f7b8714fa19a52ff9c7cf7fb7e73751901e), [`a534e95`](https://github.com/mastra-ai/mastra/commit/a534e9591f83b3cc1ebff99c67edf4cda7bf81d3), [`9d0e7fe`](https://github.com/mastra-ai/mastra/commit/9d0e7feca8ed98de959f53476ee1456073673348), [`53d927c`](https://github.com/mastra-ai/mastra/commit/53d927cc6f03bff33655b7e2b788da445a08731d), [`3f2faf2`](https://github.com/mastra-ai/mastra/commit/3f2faf2e2d685d6c053cc5af1bf9fedf267b2ce5), [`22f64bc`](https://github.com/mastra-ai/mastra/commit/22f64bc1d37149480b58bf2fefe35b79a1e3e7d5), [`363284b`](https://github.com/mastra-ai/mastra/commit/363284bb974e850f06f40f89a28c79d9f432d7e4), [`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc), [`7fa87f0`](https://github.com/mastra-ai/mastra/commit/7fa87f09b9edfd45a274e5e0d5e109d1a5d9ae8b), [`b7959e6`](https://github.com/mastra-ai/mastra/commit/b7959e6e25a46b480f9ea2217c4c6c588c423791), [`bda6370`](https://github.com/mastra-ai/mastra/commit/bda637009360649aaf579919e7873e33553c273e), [`d7acd8e`](https://github.com/mastra-ai/mastra/commit/d7acd8e987b5d7eff4fd98b0906c17c06a2e83d5), [`c7f1f7d`](https://github.com/mastra-ai/mastra/commit/c7f1f7d24f61f247f018cc2d1f33bf63212959a7), [`0bddc6d`](https://github.com/mastra-ai/mastra/commit/0bddc6d8dbd6f6008c0cba2e4960a2da75a55af1), [`735d8c1`](https://github.com/mastra-ai/mastra/commit/735d8c1c0d19fbc09e6f8b66cf41bc7655993838), [`acf322e`](https://github.com/mastra-ai/mastra/commit/acf322e0f1fd0189684cf529d91c694bea918a45), [`c942802`](https://github.com/mastra-ai/mastra/commit/c942802a477a925b01859a7b8688d4355715caaa), [`a0c8c1b`](https://github.com/mastra-ai/mastra/commit/a0c8c1b87d4fee252aebda73e8637fbe01d761c9), [`cc34739`](https://github.com/mastra-ai/mastra/commit/cc34739c34b6266a91bea561119240a7acf47887), [`c218bd3`](https://github.com/mastra-ai/mastra/commit/c218bd3759e32423735b04843a09404572631014), [`2c4438b`](https://github.com/mastra-ai/mastra/commit/2c4438b87817ab7eed818c7990fef010475af1a3), [`2b8893c`](https://github.com/mastra-ai/mastra/commit/2b8893cb108ef9acb72ee7835cd625610d2c1a4a), [`8e5c75b`](https://github.com/mastra-ai/mastra/commit/8e5c75bdb1d08a42d45309a4c72def4b6890230f), [`e59e0d3`](https://github.com/mastra-ai/mastra/commit/e59e0d32afb5fcf2c9f3c00c8f81f6c21d3a63fa), [`fa8409b`](https://github.com/mastra-ai/mastra/commit/fa8409bc39cfd8ba6643b9db5269b90b22e2a2f7), [`173c535`](https://github.com/mastra-ai/mastra/commit/173c535c0645b0da404fe09f003778f0b0d4e019)]:
  - @mastra/core@1.0.0-beta.0
  - @mastra/client-js@1.0.0-beta.0
  - @mastra/ai-sdk@1.0.0-beta.0
  - @mastra/react@0.1.0-beta.0

## 6.6.2

### Patch Changes

- Move all the fetching hooks that should be shared with cloud into playground-ui ([#9133](https://github.com/mastra-ai/mastra/pull/9133))

- Updated dependencies [[`2b031e2`](https://github.com/mastra-ai/mastra/commit/2b031e25ca10cd3e4d63e6a27f909cba26d91405)]:
  - @mastra/core@0.22.2
  - @mastra/client-js@0.16.4
  - @mastra/react@0.0.10

## 6.6.2-alpha.0

### Patch Changes

- Updated dependencies [[`2b031e2`](https://github.com/mastra-ai/mastra/commit/2b031e25ca10cd3e4d63e6a27f909cba26d91405)]:
  - @mastra/core@0.22.2-alpha.0
  - @mastra/client-js@0.16.4-alpha.0
  - @mastra/react@0.0.10-alpha.0

## 6.6.1

### Patch Changes

- Fix subagent link not working in agents overview pane ([#9099](https://github.com/mastra-ai/mastra/pull/9099))

- Fix wrong MCP link in playground ([#9103](https://github.com/mastra-ai/mastra/pull/9103))

- Updated dependencies []:
  - @mastra/core@0.22.1
  - @mastra/client-js@0.16.3
  - @mastra/react@0.0.9

## 6.6.1-alpha.0

### Patch Changes

- Fix subagent link not working in agents overview pane ([#9099](https://github.com/mastra-ai/mastra/pull/9099))

- Fix wrong MCP link in playground ([#9103](https://github.com/mastra-ai/mastra/pull/9103))

- Updated dependencies []:
  - @mastra/core@0.22.1-alpha.0
  - @mastra/client-js@0.16.3-alpha.0
  - @mastra/react@0.0.9-alpha.0

## 6.6.0

### Minor Changes

- Update peer dependencies to match core package version bump (0.21.2) ([#9021](https://github.com/mastra-ai/mastra/pull/9021))

### Patch Changes

- Handle nested optional objects in dynamic form ([#9059](https://github.com/mastra-ai/mastra/pull/9059))

- Threads are not refreshing correctly after generate / stream / network ([#9015](https://github.com/mastra-ai/mastra/pull/9015))

- Move "Playground" to "Studio" in UI only ([#9052](https://github.com/mastra-ai/mastra/pull/9052))

- fix template background image overflow ([#9011](https://github.com/mastra-ai/mastra/pull/9011))

- Show agent tool output better in playground ([#9021](https://github.com/mastra-ai/mastra/pull/9021))

- Update peerdeps to 0.23.0-0 ([#9043](https://github.com/mastra-ai/mastra/pull/9043))

- Updated dependencies [[`c67ca32`](https://github.com/mastra-ai/mastra/commit/c67ca32e3c2cf69bfc146580770c720220ca44ac), [`efb5ed9`](https://github.com/mastra-ai/mastra/commit/efb5ed946ae7f410bc68c9430beb4b010afd25ec), [`dbc9e12`](https://github.com/mastra-ai/mastra/commit/dbc9e1216ba575ba59ead4afb727a01215f7de4f), [`99e41b9`](https://github.com/mastra-ai/mastra/commit/99e41b94957cdd25137d3ac12e94e8b21aa01b68), [`c28833c`](https://github.com/mastra-ai/mastra/commit/c28833c5b6d8e10eeffd7f7d39129d53b8bca240), [`8ea07b4`](https://github.com/mastra-ai/mastra/commit/8ea07b4bdc73e4218437dbb6dcb0f4b23e745a44), [`ba201b8`](https://github.com/mastra-ai/mastra/commit/ba201b8f8feac4c72350f2dbd52c13c7297ba7b0), [`f053e89`](https://github.com/mastra-ai/mastra/commit/f053e89160dbd0bd3333fc3492f68231b5c7c349), [`1f058c6`](https://github.com/mastra-ai/mastra/commit/1f058c63ccb88d718b9876490d17e112cc026467), [`4fc4136`](https://github.com/mastra-ai/mastra/commit/4fc413652866a8d2240694fddb2562e9edbb70df), [`b78e04d`](https://github.com/mastra-ai/mastra/commit/b78e04d935a16ecb1e59c5c96e564903527edddd), [`d10baf5`](https://github.com/mastra-ai/mastra/commit/d10baf5a3c924f2a6654e23a3e318ed03f189b76), [`038c55a`](https://github.com/mastra-ai/mastra/commit/038c55a7090fc1b1513a966386d3072617f836ac), [`5ea29c6`](https://github.com/mastra-ai/mastra/commit/5ea29c6a72dc3a6c837076fd37ee54ebae77a02a), [`182f045`](https://github.com/mastra-ai/mastra/commit/182f0458f25bd70aa774e64fd923c8a483eddbf1), [`9a1a485`](https://github.com/mastra-ai/mastra/commit/9a1a4859b855e37239f652bf14b1ecd1029b8c4e), [`9257233`](https://github.com/mastra-ai/mastra/commit/9257233c4ffce09b2bedc2a9adbd70d7a83fa8e2), [`7620d2b`](https://github.com/mastra-ai/mastra/commit/7620d2bddeb4fae4c3c0a0b4e672969795fca11a), [`b2365f0`](https://github.com/mastra-ai/mastra/commit/b2365f038dd4c5f06400428b224af963f399ad50), [`0f1a4c9`](https://github.com/mastra-ai/mastra/commit/0f1a4c984fb4b104b2f0b63ba18c9fa77f567700), [`9029ba3`](https://github.com/mastra-ai/mastra/commit/9029ba34459c8859fed4c6b73efd8e2d0021e7ba), [`426cc56`](https://github.com/mastra-ai/mastra/commit/426cc561c85ae76a112ded2385532a91f9f9f074), [`00931fb`](https://github.com/mastra-ai/mastra/commit/00931fb1a21aa42c4fbc20c2c40dd62466b8fc8f), [`e473bfe`](https://github.com/mastra-ai/mastra/commit/e473bfe416c0b8e876973c2b6a6f13c394b7a93f), [`b78e04d`](https://github.com/mastra-ai/mastra/commit/b78e04d935a16ecb1e59c5c96e564903527edddd), [`2db6160`](https://github.com/mastra-ai/mastra/commit/2db6160e2022ff8827c15d30157e684683b934b5), [`8aeea37`](https://github.com/mastra-ai/mastra/commit/8aeea37efdde347c635a67fed56794943b7f74ec), [`02fe153`](https://github.com/mastra-ai/mastra/commit/02fe15351d6021d214da48ec982a0e9e4150bcee), [`648e2ca`](https://github.com/mastra-ai/mastra/commit/648e2ca42da54838c6ccbdaadc6fadd808fa6b86), [`74567b3`](https://github.com/mastra-ai/mastra/commit/74567b3d237ae3915cd0bca3cf55fa0a64e4e4a4), [`b65c5e0`](https://github.com/mastra-ai/mastra/commit/b65c5e0fe6f3c390a9a8bbcf69304d972c3a4afb), [`15a1733`](https://github.com/mastra-ai/mastra/commit/15a1733074cee8bd37370e1af34cd818e89fa7ac), [`fc2a774`](https://github.com/mastra-ai/mastra/commit/fc2a77468981aaddc3e77f83f0c4ad4a4af140da), [`4e08933`](https://github.com/mastra-ai/mastra/commit/4e08933625464dfde178347af5b6278fcf34188e)]:
  - @mastra/core@0.22.0
  - @mastra/react@0.0.8
  - @mastra/client-js@0.16.2

## 6.6.0-alpha.1

### Minor Changes

- Update peer dependencies to match core package version bump (0.21.2) ([#9021](https://github.com/mastra-ai/mastra/pull/9021))

### Patch Changes

- Handle nested optional objects in dynamic form ([#9059](https://github.com/mastra-ai/mastra/pull/9059))

- Move "Playground" to "Studio" in UI only ([#9052](https://github.com/mastra-ai/mastra/pull/9052))

- Show agent tool output better in playground ([#9021](https://github.com/mastra-ai/mastra/pull/9021))

- Update peerdeps to 0.23.0-0 ([#9043](https://github.com/mastra-ai/mastra/pull/9043))

- Updated dependencies [[`efb5ed9`](https://github.com/mastra-ai/mastra/commit/efb5ed946ae7f410bc68c9430beb4b010afd25ec), [`8ea07b4`](https://github.com/mastra-ai/mastra/commit/8ea07b4bdc73e4218437dbb6dcb0f4b23e745a44), [`ba201b8`](https://github.com/mastra-ai/mastra/commit/ba201b8f8feac4c72350f2dbd52c13c7297ba7b0), [`1f058c6`](https://github.com/mastra-ai/mastra/commit/1f058c63ccb88d718b9876490d17e112cc026467), [`4fc4136`](https://github.com/mastra-ai/mastra/commit/4fc413652866a8d2240694fddb2562e9edbb70df), [`b78e04d`](https://github.com/mastra-ai/mastra/commit/b78e04d935a16ecb1e59c5c96e564903527edddd), [`d10baf5`](https://github.com/mastra-ai/mastra/commit/d10baf5a3c924f2a6654e23a3e318ed03f189b76), [`038c55a`](https://github.com/mastra-ai/mastra/commit/038c55a7090fc1b1513a966386d3072617f836ac), [`5ea29c6`](https://github.com/mastra-ai/mastra/commit/5ea29c6a72dc3a6c837076fd37ee54ebae77a02a), [`182f045`](https://github.com/mastra-ai/mastra/commit/182f0458f25bd70aa774e64fd923c8a483eddbf1), [`7620d2b`](https://github.com/mastra-ai/mastra/commit/7620d2bddeb4fae4c3c0a0b4e672969795fca11a), [`b2365f0`](https://github.com/mastra-ai/mastra/commit/b2365f038dd4c5f06400428b224af963f399ad50), [`9029ba3`](https://github.com/mastra-ai/mastra/commit/9029ba34459c8859fed4c6b73efd8e2d0021e7ba), [`426cc56`](https://github.com/mastra-ai/mastra/commit/426cc561c85ae76a112ded2385532a91f9f9f074), [`00931fb`](https://github.com/mastra-ai/mastra/commit/00931fb1a21aa42c4fbc20c2c40dd62466b8fc8f), [`e473bfe`](https://github.com/mastra-ai/mastra/commit/e473bfe416c0b8e876973c2b6a6f13c394b7a93f), [`b78e04d`](https://github.com/mastra-ai/mastra/commit/b78e04d935a16ecb1e59c5c96e564903527edddd), [`648e2ca`](https://github.com/mastra-ai/mastra/commit/648e2ca42da54838c6ccbdaadc6fadd808fa6b86), [`b65c5e0`](https://github.com/mastra-ai/mastra/commit/b65c5e0fe6f3c390a9a8bbcf69304d972c3a4afb)]:
  - @mastra/core@0.22.0-alpha.1
  - @mastra/react@0.0.8-alpha.1
  - @mastra/client-js@0.16.2-alpha.1

## 6.5.2-alpha.0

### Patch Changes

- Threads are not refreshing correctly after generate / stream / network ([#9015](https://github.com/mastra-ai/mastra/pull/9015))

- fix template background image overflow ([#9011](https://github.com/mastra-ai/mastra/pull/9011))

- Updated dependencies [[`c67ca32`](https://github.com/mastra-ai/mastra/commit/c67ca32e3c2cf69bfc146580770c720220ca44ac), [`dbc9e12`](https://github.com/mastra-ai/mastra/commit/dbc9e1216ba575ba59ead4afb727a01215f7de4f), [`99e41b9`](https://github.com/mastra-ai/mastra/commit/99e41b94957cdd25137d3ac12e94e8b21aa01b68), [`c28833c`](https://github.com/mastra-ai/mastra/commit/c28833c5b6d8e10eeffd7f7d39129d53b8bca240), [`f053e89`](https://github.com/mastra-ai/mastra/commit/f053e89160dbd0bd3333fc3492f68231b5c7c349), [`9a1a485`](https://github.com/mastra-ai/mastra/commit/9a1a4859b855e37239f652bf14b1ecd1029b8c4e), [`9257233`](https://github.com/mastra-ai/mastra/commit/9257233c4ffce09b2bedc2a9adbd70d7a83fa8e2), [`0f1a4c9`](https://github.com/mastra-ai/mastra/commit/0f1a4c984fb4b104b2f0b63ba18c9fa77f567700), [`2db6160`](https://github.com/mastra-ai/mastra/commit/2db6160e2022ff8827c15d30157e684683b934b5), [`8aeea37`](https://github.com/mastra-ai/mastra/commit/8aeea37efdde347c635a67fed56794943b7f74ec), [`02fe153`](https://github.com/mastra-ai/mastra/commit/02fe15351d6021d214da48ec982a0e9e4150bcee), [`74567b3`](https://github.com/mastra-ai/mastra/commit/74567b3d237ae3915cd0bca3cf55fa0a64e4e4a4), [`15a1733`](https://github.com/mastra-ai/mastra/commit/15a1733074cee8bd37370e1af34cd818e89fa7ac), [`fc2a774`](https://github.com/mastra-ai/mastra/commit/fc2a77468981aaddc3e77f83f0c4ad4a4af140da), [`4e08933`](https://github.com/mastra-ai/mastra/commit/4e08933625464dfde178347af5b6278fcf34188e)]:
  - @mastra/core@0.21.2-alpha.0
  - @mastra/client-js@0.16.2-alpha.0
  - @mastra/react@0.0.8-alpha.0

## 6.5.1

### Patch Changes

- Add @mastra/react to peer deps ([#8857](https://github.com/mastra-ai/mastra/pull/8857))

- Updated dependencies [[`ca85c93`](https://github.com/mastra-ai/mastra/commit/ca85c932b232e6ad820c811ec176d98e68c59b0a), [`a1d40f8`](https://github.com/mastra-ai/mastra/commit/a1d40f88d4ce42c4508774ad22e38ac582157af2), [`01c4a25`](https://github.com/mastra-ai/mastra/commit/01c4a2506c514d5e861c004d3d2fb3791c6391f3), [`9ba695e`](https://github.com/mastra-ai/mastra/commit/9ba695e9ff977b8f13cc71df3b452775757361e5), [`cce8aad`](https://github.com/mastra-ai/mastra/commit/cce8aad878a0dd98e5647680f3765caba0b1701c)]:
  - @mastra/core@0.21.1
  - @mastra/react@0.0.7
  - @mastra/client-js@0.16.1

## 6.5.1-alpha.0

### Patch Changes

- Add @mastra/react to peer deps ([#8857](https://github.com/mastra-ai/mastra/pull/8857))

- Updated dependencies [[`ca85c93`](https://github.com/mastra-ai/mastra/commit/ca85c932b232e6ad820c811ec176d98e68c59b0a), [`a1d40f8`](https://github.com/mastra-ai/mastra/commit/a1d40f88d4ce42c4508774ad22e38ac582157af2), [`01c4a25`](https://github.com/mastra-ai/mastra/commit/01c4a2506c514d5e861c004d3d2fb3791c6391f3), [`9ba695e`](https://github.com/mastra-ai/mastra/commit/9ba695e9ff977b8f13cc71df3b452775757361e5), [`cce8aad`](https://github.com/mastra-ai/mastra/commit/cce8aad878a0dd98e5647680f3765caba0b1701c)]:
  - @mastra/core@0.21.1-alpha.0
  - @mastra/react@0.0.7-alpha.0
  - @mastra/client-js@0.16.1-alpha.0

## 6.5.0

### Minor Changes

- Update peer dependencies to match core package version bump (0.21.0) ([#8619](https://github.com/mastra-ai/mastra/pull/8619))

### Patch Changes

- dependencies updates: ([#8685](https://github.com/mastra-ai/mastra/pull/8685))
  - Updated dependency [`zod@^4.1.12` ↗︎](https://www.npmjs.com/package/zod/v/4.1.12) (from `^4.1.9`, in `dependencies`)

- Prepares some basic set of homemade components ([#8619](https://github.com/mastra-ai/mastra/pull/8619))

- Improve the surface API of the react sdk ([#8715](https://github.com/mastra-ai/mastra/pull/8715))

- Fix auto tab for model picker in playground-ui, the UI no longer auto tabs to the next selector when selecting a model/provider. ([#8680](https://github.com/mastra-ai/mastra/pull/8680))

- Create unified Sidebar component to use on Playground and Cloud ([#8655](https://github.com/mastra-ai/mastra/pull/8655))

- Adds reset button to model picker to reset to original model set on the agent. ([#8633](https://github.com/mastra-ai/mastra/pull/8633))

- Fix back the tripwire verification inside the new react system ([#8674](https://github.com/mastra-ai/mastra/pull/8674))

- Use only zod validation in dynamic form ([#8802](https://github.com/mastra-ai/mastra/pull/8802))

- Add div wrapper around entity tables to fix table vertical position ([#8758](https://github.com/mastra-ai/mastra/pull/8758))

- Update peer dependencies to match core package version bump (0.21.0) ([#8557](https://github.com/mastra-ai/mastra/pull/8557))

- handle error case in react sdk ([#8676](https://github.com/mastra-ai/mastra/pull/8676))

- Make sure to convert the agent instructions when showing them ([#8702](https://github.com/mastra-ai/mastra/pull/8702))

- Update peer dependencies to match core package version bump (0.21.0) ([#8626](https://github.com/mastra-ai/mastra/pull/8626))

- Customize AITraces type to seamlessly work on Cloud too ([#8759](https://github.com/mastra-ai/mastra/pull/8759))

- Refactor EntryList component and Scorer and Observability pages ([#8652](https://github.com/mastra-ai/mastra/pull/8652))

- fix maxSteps model settings not being passed to generate and stream endpoints ([#8627](https://github.com/mastra-ai/mastra/pull/8627))

- Update peer dependencies to match core package version bump (0.21.0) ([#8686](https://github.com/mastra-ai/mastra/pull/8686))

- Updated dependencies [[`f920afd`](https://github.com/mastra-ai/mastra/commit/f920afdf8725d14d73f895f51a24bb7c79bb4fba), [`2ddb851`](https://github.com/mastra-ai/mastra/commit/2ddb8519c4b6f1d31be10ffd33b41d2b649a04ff), [`421f019`](https://github.com/mastra-ai/mastra/commit/421f01949651d2766046ca1961e32a2dc2fd712b), [`1ed9670`](https://github.com/mastra-ai/mastra/commit/1ed9670d3ca50cb60dc2e517738c5eef3968ed27), [`b5a66b7`](https://github.com/mastra-ai/mastra/commit/b5a66b748a14fc8b3f63b04642ddb9621fbcc9e0), [`f59fc1e`](https://github.com/mastra-ai/mastra/commit/f59fc1e406b8912e692f6bff6cfd4754cc8d165c), [`158381d`](https://github.com/mastra-ai/mastra/commit/158381d39335be934b81ef8a1947bccace492c25), [`a1799bc`](https://github.com/mastra-ai/mastra/commit/a1799bcc1b5a1cdc188f2ac0165f17a1c4ac6f7b), [`6ff6094`](https://github.com/mastra-ai/mastra/commit/6ff60946f4ecfebdeef6e21d2b230c2204f2c9b8), [`288c2ec`](https://github.com/mastra-ai/mastra/commit/288c2ec873ff9f296cebfdb4654d1b9ba498ad9b), [`fb703b9`](https://github.com/mastra-ai/mastra/commit/fb703b9634eeaff1a6eb2b5531ce0f9e8fb04727), [`2a90197`](https://github.com/mastra-ai/mastra/commit/2a90197276e8439a1ee8371c10cde4d6a23bddef), [`37a2314`](https://github.com/mastra-ai/mastra/commit/37a23148e0e5a3b40d4f9f098b194671a8a49faf), [`7b1ef57`](https://github.com/mastra-ai/mastra/commit/7b1ef57fc071c2aa2a2e32905b18cd88719c5a39), [`05a9dee`](https://github.com/mastra-ai/mastra/commit/05a9dee3d355694d28847bfffb6289657fcf7dfa), [`e3c1077`](https://github.com/mastra-ai/mastra/commit/e3c107763aedd1643d3def5df450c235da9ff76c), [`1908ca0`](https://github.com/mastra-ai/mastra/commit/1908ca0521f90e43779cc29ab590173ca560443c), [`1bccdb3`](https://github.com/mastra-ai/mastra/commit/1bccdb33eb90cbeba2dc5ece1c2561fb774b26b6), [`5ef944a`](https://github.com/mastra-ai/mastra/commit/5ef944a3721d93105675cac2b2311432ff8cc393), [`c3ef11f`](https://github.com/mastra-ai/mastra/commit/c3ef11f76e1931cf8f041e9eccf3b382260da022), [`78cfb6b`](https://github.com/mastra-ai/mastra/commit/78cfb6b66fe88bc848105fccb6459fd75413ec87), [`d6b186f`](https://github.com/mastra-ai/mastra/commit/d6b186fb08f1caf1b86f73d3a5ee88fb999ca3be), [`ee68e82`](https://github.com/mastra-ai/mastra/commit/ee68e8289ea4408d29849e899bc6e78b3bd4e843), [`228228b`](https://github.com/mastra-ai/mastra/commit/228228b0b1de9291cb8887587f5cea1a8757ebad), [`ea33930`](https://github.com/mastra-ai/mastra/commit/ea339301e82d6318257720d811b043014ee44064), [`5f7c6a9`](https://github.com/mastra-ai/mastra/commit/5f7c6a986cd9469279820961f8da0a0321fbbd71), [`65493b3`](https://github.com/mastra-ai/mastra/commit/65493b31c36f6fdb78f9679f7e1ecf0c250aa5ee), [`a998b8f`](https://github.com/mastra-ai/mastra/commit/a998b8f858091c2ec47683e60766cf12d03001e4), [`b5a66b7`](https://github.com/mastra-ai/mastra/commit/b5a66b748a14fc8b3f63b04642ddb9621fbcc9e0), [`8a37bdd`](https://github.com/mastra-ai/mastra/commit/8a37bddb6d8614a32c5b70303d583d80c620ea61), [`135d6f2`](https://github.com/mastra-ai/mastra/commit/135d6f22a326ed1dffff858700669dff09d2c9eb)]:
  - @mastra/react@0.0.6
  - @mastra/core@0.21.0
  - @mastra/client-js@0.16.0

## 6.5.0-alpha.4

### Patch Changes

- Updated dependencies [[`1908ca0`](https://github.com/mastra-ai/mastra/commit/1908ca0521f90e43779cc29ab590173ca560443c)]:
  - @mastra/core@0.21.0-alpha.4
  - @mastra/client-js@0.16.0-alpha.4
  - @mastra/react@0.0.6-alpha.4

## 6.5.0-alpha.3

### Patch Changes

- Updated dependencies [[`a1799bc`](https://github.com/mastra-ai/mastra/commit/a1799bcc1b5a1cdc188f2ac0165f17a1c4ac6f7b), [`6ff6094`](https://github.com/mastra-ai/mastra/commit/6ff60946f4ecfebdeef6e21d2b230c2204f2c9b8)]:
  - @mastra/core@0.21.0-alpha.3
  - @mastra/client-js@0.16.0-alpha.3
  - @mastra/react@0.0.6-alpha.3

## 6.5.0-alpha.2

### Patch Changes

- Updated dependencies [[`f59fc1e`](https://github.com/mastra-ai/mastra/commit/f59fc1e406b8912e692f6bff6cfd4754cc8d165c)]:
  - @mastra/core@0.21.0-alpha.2
  - @mastra/client-js@0.16.0-alpha.2
  - @mastra/react@0.0.6-alpha.2

## 6.5.0-alpha.1

### Patch Changes

- Improve the surface API of the react sdk ([#8715](https://github.com/mastra-ai/mastra/pull/8715))

- Fix auto tab for model picker in playground-ui, the UI no longer auto tabs to the next selector when selecting a model/provider. ([#8680](https://github.com/mastra-ai/mastra/pull/8680))

- Create unified Sidebar component to use on Playground and Cloud ([#8655](https://github.com/mastra-ai/mastra/pull/8655))

- Use only zod validation in dynamic form ([#8802](https://github.com/mastra-ai/mastra/pull/8802))

- Add div wrapper around entity tables to fix table vertical position ([#8758](https://github.com/mastra-ai/mastra/pull/8758))

- Customize AITraces type to seamlessly work on Cloud too ([#8759](https://github.com/mastra-ai/mastra/pull/8759))

- Updated dependencies [[`421f019`](https://github.com/mastra-ai/mastra/commit/421f01949651d2766046ca1961e32a2dc2fd712b), [`1ed9670`](https://github.com/mastra-ai/mastra/commit/1ed9670d3ca50cb60dc2e517738c5eef3968ed27), [`158381d`](https://github.com/mastra-ai/mastra/commit/158381d39335be934b81ef8a1947bccace492c25), [`288c2ec`](https://github.com/mastra-ai/mastra/commit/288c2ec873ff9f296cebfdb4654d1b9ba498ad9b), [`fb703b9`](https://github.com/mastra-ai/mastra/commit/fb703b9634eeaff1a6eb2b5531ce0f9e8fb04727), [`37a2314`](https://github.com/mastra-ai/mastra/commit/37a23148e0e5a3b40d4f9f098b194671a8a49faf), [`05a9dee`](https://github.com/mastra-ai/mastra/commit/05a9dee3d355694d28847bfffb6289657fcf7dfa), [`e3c1077`](https://github.com/mastra-ai/mastra/commit/e3c107763aedd1643d3def5df450c235da9ff76c), [`1bccdb3`](https://github.com/mastra-ai/mastra/commit/1bccdb33eb90cbeba2dc5ece1c2561fb774b26b6), [`5ef944a`](https://github.com/mastra-ai/mastra/commit/5ef944a3721d93105675cac2b2311432ff8cc393), [`d6b186f`](https://github.com/mastra-ai/mastra/commit/d6b186fb08f1caf1b86f73d3a5ee88fb999ca3be), [`65493b3`](https://github.com/mastra-ai/mastra/commit/65493b31c36f6fdb78f9679f7e1ecf0c250aa5ee), [`a998b8f`](https://github.com/mastra-ai/mastra/commit/a998b8f858091c2ec47683e60766cf12d03001e4), [`8a37bdd`](https://github.com/mastra-ai/mastra/commit/8a37bddb6d8614a32c5b70303d583d80c620ea61)]:
  - @mastra/react@0.0.6-alpha.1
  - @mastra/core@0.21.0-alpha.1
  - @mastra/client-js@0.16.0-alpha.1

## 6.5.0-alpha.0

### Minor Changes

- Update peer dependencies to match core package version bump (0.21.0) ([#8619](https://github.com/mastra-ai/mastra/pull/8619))

### Patch Changes

- dependencies updates: ([#8685](https://github.com/mastra-ai/mastra/pull/8685))
  - Updated dependency [`zod@^4.1.12` ↗︎](https://www.npmjs.com/package/zod/v/4.1.12) (from `^4.1.9`, in `dependencies`)

- Prepares some basic set of homemade components ([#8619](https://github.com/mastra-ai/mastra/pull/8619))

- Adds reset button to model picker to reset to original model set on the agent. ([#8633](https://github.com/mastra-ai/mastra/pull/8633))

- Fix back the tripwire verification inside the new react system ([#8674](https://github.com/mastra-ai/mastra/pull/8674))

- Update peer dependencies to match core package version bump (0.21.0) ([#8557](https://github.com/mastra-ai/mastra/pull/8557))

- handle error case in react sdk ([#8676](https://github.com/mastra-ai/mastra/pull/8676))

- Make sure to convert the agent instructions when showing them ([#8702](https://github.com/mastra-ai/mastra/pull/8702))

- Update peer dependencies to match core package version bump (0.21.0) ([#8626](https://github.com/mastra-ai/mastra/pull/8626))

- Refactor EntryList component and Scorer and Observability pages ([#8652](https://github.com/mastra-ai/mastra/pull/8652))

- fix maxSteps model settings not being passed to generate and stream endpoints ([#8627](https://github.com/mastra-ai/mastra/pull/8627))

- Update peer dependencies to match core package version bump (0.21.0) ([#8686](https://github.com/mastra-ai/mastra/pull/8686))

- Updated dependencies [[`f920afd`](https://github.com/mastra-ai/mastra/commit/f920afdf8725d14d73f895f51a24bb7c79bb4fba), [`2ddb851`](https://github.com/mastra-ai/mastra/commit/2ddb8519c4b6f1d31be10ffd33b41d2b649a04ff), [`b5a66b7`](https://github.com/mastra-ai/mastra/commit/b5a66b748a14fc8b3f63b04642ddb9621fbcc9e0), [`2a90197`](https://github.com/mastra-ai/mastra/commit/2a90197276e8439a1ee8371c10cde4d6a23bddef), [`7b1ef57`](https://github.com/mastra-ai/mastra/commit/7b1ef57fc071c2aa2a2e32905b18cd88719c5a39), [`c3ef11f`](https://github.com/mastra-ai/mastra/commit/c3ef11f76e1931cf8f041e9eccf3b382260da022), [`78cfb6b`](https://github.com/mastra-ai/mastra/commit/78cfb6b66fe88bc848105fccb6459fd75413ec87), [`ee68e82`](https://github.com/mastra-ai/mastra/commit/ee68e8289ea4408d29849e899bc6e78b3bd4e843), [`228228b`](https://github.com/mastra-ai/mastra/commit/228228b0b1de9291cb8887587f5cea1a8757ebad), [`ea33930`](https://github.com/mastra-ai/mastra/commit/ea339301e82d6318257720d811b043014ee44064), [`5f7c6a9`](https://github.com/mastra-ai/mastra/commit/5f7c6a986cd9469279820961f8da0a0321fbbd71), [`b5a66b7`](https://github.com/mastra-ai/mastra/commit/b5a66b748a14fc8b3f63b04642ddb9621fbcc9e0), [`135d6f2`](https://github.com/mastra-ai/mastra/commit/135d6f22a326ed1dffff858700669dff09d2c9eb), [`59d036d`](https://github.com/mastra-ai/mastra/commit/59d036d4c2706b430b0e3f1f1e0ee853ce16ca04)]:
  - @mastra/react@0.0.6-alpha.0
  - @mastra/core@0.21.0-alpha.0
  - @mastra/client-js@0.16.0-alpha.0

## 6.4.1

### Patch Changes

- Updated dependencies [[`07eaf25`](https://github.com/mastra-ai/mastra/commit/07eaf25aada9e42235dbf905854de53da4d8121b), [`0d71771`](https://github.com/mastra-ai/mastra/commit/0d71771f5711164c79f8e80919bc84d6bffeb6bc), [`0d6e55e`](https://github.com/mastra-ai/mastra/commit/0d6e55ecc5a2e689cd4fc9c86525e0eb54d82372), [`68b1111`](https://github.com/mastra-ai/mastra/commit/68b11118a1303f93e9c0c157850c0751309304c5)]:
  - @mastra/core@0.20.2
  - @mastra/client-js@0.15.2
  - @mastra/react@0.0.5

## 6.4.1-alpha.1

### Patch Changes

- Updated dependencies [[`07eaf25`](https://github.com/mastra-ai/mastra/commit/07eaf25aada9e42235dbf905854de53da4d8121b), [`68b1111`](https://github.com/mastra-ai/mastra/commit/68b11118a1303f93e9c0c157850c0751309304c5)]:
  - @mastra/core@0.20.2-alpha.1
  - @mastra/client-js@0.15.2-alpha.1
  - @mastra/react@0.0.5-alpha.1

## 6.4.1-alpha.0

### Patch Changes

- Updated dependencies [[`0d71771`](https://github.com/mastra-ai/mastra/commit/0d71771f5711164c79f8e80919bc84d6bffeb6bc), [`0d6e55e`](https://github.com/mastra-ai/mastra/commit/0d6e55ecc5a2e689cd4fc9c86525e0eb54d82372)]:
  - @mastra/core@0.20.2-alpha.0
  - @mastra/client-js@0.15.2-alpha.0
  - @mastra/react@0.0.5-alpha.0

## 6.4.0

### Minor Changes

- Update peer dependencies to match core package version bump (0.20.1) ([#8589](https://github.com/mastra-ai/mastra/pull/8589))

### Patch Changes

- workflow run thread more visible ([#8539](https://github.com/mastra-ai/mastra/pull/8539))

- Mutable shared workflow run state ([#8545](https://github.com/mastra-ai/mastra/pull/8545))

- streamLegacy/generateLegacy clarification in playground ([#8468](https://github.com/mastra-ai/mastra/pull/8468))

- add tripwire reason in playground ([#8568](https://github.com/mastra-ai/mastra/pull/8568))

- Save waiting step status in snapshot ([#8576](https://github.com/mastra-ai/mastra/pull/8576))

- Added AI SDK provider packages to model router for anthropic/google/openai/openrouter/xai ([#8559](https://github.com/mastra-ai/mastra/pull/8559))

- type fixes and missing changeset ([#8545](https://github.com/mastra-ai/mastra/pull/8545))

- Convert WorkflowWatchResult to WorkflowResult in workflow graph ([#8541](https://github.com/mastra-ai/mastra/pull/8541))

- remove icons in entity lists ([#8520](https://github.com/mastra-ai/mastra/pull/8520))

- extract mcp servers into playground + use a table instead of custom stuff ([#8521](https://github.com/mastra-ai/mastra/pull/8521))

- add client search to all entities ([#8523](https://github.com/mastra-ai/mastra/pull/8523))

- Fixed an issue where model router was adding /chat/completions to API urls when it shouldn't. ([#8589](https://github.com/mastra-ai/mastra/pull/8589))
  fixed an issue with provider ID rendering in playground UI

- UX for the agents page ([#8517](https://github.com/mastra-ai/mastra/pull/8517))

- add icons into playground titles + a link to the entity doc ([#8518](https://github.com/mastra-ai/mastra/pull/8518))

- Updated dependencies [[`c621613`](https://github.com/mastra-ai/mastra/commit/c621613069173c69eb2c3ef19a5308894c6549f0), [`12b1189`](https://github.com/mastra-ai/mastra/commit/12b118942445e4de0dd916c593e33ec78dc3bc73), [`4783b30`](https://github.com/mastra-ai/mastra/commit/4783b3063efea887825514b783ba27f67912c26d), [`076b092`](https://github.com/mastra-ai/mastra/commit/076b0924902ff0f49d5712d2df24c4cca683713f), [`2aee9e7`](https://github.com/mastra-ai/mastra/commit/2aee9e7d188b8b256a4ddc203ccefb366b4867fa), [`c582906`](https://github.com/mastra-ai/mastra/commit/c5829065a346260f96c4beb8af131b94804ae3ad), [`fa2eb96`](https://github.com/mastra-ai/mastra/commit/fa2eb96af16c7d433891a73932764960d3235c1d), [`ee9108f`](https://github.com/mastra-ai/mastra/commit/ee9108fa29bb8368fc23df158c9f0645b2d7b65c), [`4783b30`](https://github.com/mastra-ai/mastra/commit/4783b3063efea887825514b783ba27f67912c26d), [`a739d0c`](https://github.com/mastra-ai/mastra/commit/a739d0c8b37cd89569e04a6ca0827083c6167e19), [`603e927`](https://github.com/mastra-ai/mastra/commit/603e9279db8bf8a46caf83881c6b7389ccffff7e), [`cd45982`](https://github.com/mastra-ai/mastra/commit/cd4598291cda128a88738734ae6cbef076ebdebd), [`874f74d`](https://github.com/mastra-ai/mastra/commit/874f74da4b1acf6517f18132d035612c3ecc394a), [`b728a45`](https://github.com/mastra-ai/mastra/commit/b728a45ab3dba59da0f5ee36b81fe246659f305d), [`0baf2ba`](https://github.com/mastra-ai/mastra/commit/0baf2bab8420277072ef1f95df5ea7b0a2f61fe7), [`10e633a`](https://github.com/mastra-ai/mastra/commit/10e633a07d333466d9734c97acfc3dbf757ad2d0), [`a6d69c5`](https://github.com/mastra-ai/mastra/commit/a6d69c5fb50c0875b46275811fece5862f03c6a0), [`84199af`](https://github.com/mastra-ai/mastra/commit/84199af8673f6f9cb59286ffb5477a41932775de), [`7f431af`](https://github.com/mastra-ai/mastra/commit/7f431afd586b7d3265075e73106eb73167edbb86), [`26e968d`](https://github.com/mastra-ai/mastra/commit/26e968db2171ded9e4d47aa1b4f19e1e771158d0), [`cbd3fb6`](https://github.com/mastra-ai/mastra/commit/cbd3fb65adb03a7c0df193cb998aed5ac56675ee)]:
  - @mastra/core@0.20.1
  - @mastra/client-js@0.15.1
  - @mastra/react@0.0.4

## 6.4.0-alpha.4

### Minor Changes

- Update peer dependencies to match core package version bump (0.20.1) ([#8589](https://github.com/mastra-ai/mastra/pull/8589))

### Patch Changes

- Fixed an issue where model router was adding /chat/completions to API urls when it shouldn't. ([#8589](https://github.com/mastra-ai/mastra/pull/8589))
  fixed an issue with provider ID rendering in playground UI
- Updated dependencies [[`b728a45`](https://github.com/mastra-ai/mastra/commit/b728a45ab3dba59da0f5ee36b81fe246659f305d)]:
  - @mastra/core@0.20.1-alpha.4
  - @mastra/client-js@0.15.1-alpha.4
  - @mastra/react@0.0.4-alpha.4

## 6.3.1-alpha.3

### Patch Changes

- Updated dependencies [[`a6d69c5`](https://github.com/mastra-ai/mastra/commit/a6d69c5fb50c0875b46275811fece5862f03c6a0), [`84199af`](https://github.com/mastra-ai/mastra/commit/84199af8673f6f9cb59286ffb5477a41932775de), [`7f431af`](https://github.com/mastra-ai/mastra/commit/7f431afd586b7d3265075e73106eb73167edbb86)]:
  - @mastra/core@0.20.1-alpha.3
  - @mastra/client-js@0.15.1-alpha.3
  - @mastra/react@0.0.4-alpha.3

## 6.3.1-alpha.2

### Patch Changes

- Added AI SDK provider packages to model router for anthropic/google/openai/openrouter/xai ([#8559](https://github.com/mastra-ai/mastra/pull/8559))

- Updated dependencies [[`ee9108f`](https://github.com/mastra-ai/mastra/commit/ee9108fa29bb8368fc23df158c9f0645b2d7b65c)]:
  - @mastra/core@0.20.1-alpha.2
  - @mastra/client-js@0.15.1-alpha.2
  - @mastra/react@0.0.4-alpha.2

## 6.3.1-alpha.1

### Patch Changes

- workflow run thread more visible ([#8539](https://github.com/mastra-ai/mastra/pull/8539))

- Mutable shared workflow run state ([#8545](https://github.com/mastra-ai/mastra/pull/8545))

- add tripwire reason in playground ([#8568](https://github.com/mastra-ai/mastra/pull/8568))

- Save waiting step status in snapshot ([#8576](https://github.com/mastra-ai/mastra/pull/8576))

- type fixes and missing changeset ([#8545](https://github.com/mastra-ai/mastra/pull/8545))

- Convert WorkflowWatchResult to WorkflowResult in workflow graph ([#8541](https://github.com/mastra-ai/mastra/pull/8541))

- remove icons in entity lists ([#8520](https://github.com/mastra-ai/mastra/pull/8520))

- extract mcp servers into playground + use a table instead of custom stuff ([#8521](https://github.com/mastra-ai/mastra/pull/8521))

- add client search to all entities ([#8523](https://github.com/mastra-ai/mastra/pull/8523))

- UX for the agents page ([#8517](https://github.com/mastra-ai/mastra/pull/8517))

- add icons into playground titles + a link to the entity doc ([#8518](https://github.com/mastra-ai/mastra/pull/8518))

- Updated dependencies [[`c621613`](https://github.com/mastra-ai/mastra/commit/c621613069173c69eb2c3ef19a5308894c6549f0), [`12b1189`](https://github.com/mastra-ai/mastra/commit/12b118942445e4de0dd916c593e33ec78dc3bc73), [`4783b30`](https://github.com/mastra-ai/mastra/commit/4783b3063efea887825514b783ba27f67912c26d), [`076b092`](https://github.com/mastra-ai/mastra/commit/076b0924902ff0f49d5712d2df24c4cca683713f), [`2aee9e7`](https://github.com/mastra-ai/mastra/commit/2aee9e7d188b8b256a4ddc203ccefb366b4867fa), [`c582906`](https://github.com/mastra-ai/mastra/commit/c5829065a346260f96c4beb8af131b94804ae3ad), [`fa2eb96`](https://github.com/mastra-ai/mastra/commit/fa2eb96af16c7d433891a73932764960d3235c1d), [`4783b30`](https://github.com/mastra-ai/mastra/commit/4783b3063efea887825514b783ba27f67912c26d), [`a739d0c`](https://github.com/mastra-ai/mastra/commit/a739d0c8b37cd89569e04a6ca0827083c6167e19), [`603e927`](https://github.com/mastra-ai/mastra/commit/603e9279db8bf8a46caf83881c6b7389ccffff7e), [`cd45982`](https://github.com/mastra-ai/mastra/commit/cd4598291cda128a88738734ae6cbef076ebdebd), [`874f74d`](https://github.com/mastra-ai/mastra/commit/874f74da4b1acf6517f18132d035612c3ecc394a), [`0baf2ba`](https://github.com/mastra-ai/mastra/commit/0baf2bab8420277072ef1f95df5ea7b0a2f61fe7), [`26e968d`](https://github.com/mastra-ai/mastra/commit/26e968db2171ded9e4d47aa1b4f19e1e771158d0), [`cbd3fb6`](https://github.com/mastra-ai/mastra/commit/cbd3fb65adb03a7c0df193cb998aed5ac56675ee)]:
  - @mastra/core@0.20.1-alpha.1
  - @mastra/client-js@0.15.1-alpha.1
  - @mastra/react@0.0.4-alpha.1

## 6.3.1-alpha.0

### Patch Changes

- streamLegacy/generateLegacy clarification in playground ([#8468](https://github.com/mastra-ai/mastra/pull/8468))

- Updated dependencies [[`10e633a`](https://github.com/mastra-ai/mastra/commit/10e633a07d333466d9734c97acfc3dbf757ad2d0)]:
  - @mastra/core@0.20.1-alpha.0
  - @mastra/client-js@0.15.1-alpha.0
  - @mastra/react@0.0.4-alpha.0

## 6.3.0

### Minor Changes

- Breaking change to move the agent.streamVNext/generateVNext implementation to the default stream/generate. The old stream/generate have now been moved to streamLegacy and generateLegacy ([#8097](https://github.com/mastra-ai/mastra/pull/8097))

### Patch Changes

- dependencies updates: ([#8298](https://github.com/mastra-ai/mastra/pull/8298))
  - Updated dependency [`@xyflow/react@^12.8.6` ↗︎](https://www.npmjs.com/package/@xyflow/react/v/12.8.6) (from `^12.8.5`, in `dependencies`)

- dependencies updates: ([#8333](https://github.com/mastra-ai/mastra/pull/8333))
  - Updated dependency [`motion@^12.23.22` ↗︎](https://www.npmjs.com/package/motion/v/12.23.22) (from `^12.23.13`, in `dependencies`)

- better memory message ([#8382](https://github.com/mastra-ai/mastra/pull/8382))

- generateVNext into react SDK + to asistant ui message ([#8345](https://github.com/mastra-ai/mastra/pull/8345))

- Add doc url to netlify gateway ([#8356](https://github.com/mastra-ai/mastra/pull/8356))

- fix codeblock line number color contrast for legacy traces ([#8385](https://github.com/mastra-ai/mastra/pull/8385))

- distinguish between legacy and regular messages in agent chat for useChat usage ([#8409](https://github.com/mastra-ai/mastra/pull/8409))

- Model router documentation and playground UI improvements ([#8372](https://github.com/mastra-ai/mastra/pull/8372))

  **Documentation generation (`@mastra/core`):**
  - Fixed inverted dynamic model selection logic in provider examples
  - Improved copy: replaced marketing language with action-oriented descriptions
  - Added generated file comments with timestamps to all MDX outputs so maintainers know not to directly edit generated files

  **Playground UI model picker (`@mastra/playground-ui`):**
  - Fixed provider field clearing when typing in model input
  - Added responsive layout (stacks on mobile, side-by-side on desktop)
  - Improved general styling of provider/model pickers

  **Environment variables (`@mastra/deployer`):**
  - Properly handle array of env vars (e.g., NETLIFY_TOKEN, NETLIFY_SITE_ID)
  - Added correct singular/plural handling for "environment variable(s)"

- fix playground message history initial state for v1 models ([#8427](https://github.com/mastra-ai/mastra/pull/8427))

- show thread list in desc order ([#8381](https://github.com/mastra-ai/mastra/pull/8381))

- Add observe strean to get streans after workflow has been interrupted ([#8318](https://github.com/mastra-ai/mastra/pull/8318))

- Updated dependencies [[`00cb6bd`](https://github.com/mastra-ai/mastra/commit/00cb6bdf78737c0fac14a5a0c7b532a11e38558a), [`869ba22`](https://github.com/mastra-ai/mastra/commit/869ba222e1d6b58fc1b65e7c9fd55ca4e01b8c2f), [`1b73665`](https://github.com/mastra-ai/mastra/commit/1b73665e8e23f5c09d49fcf3e7d709c75259259e), [`b537cce`](https://github.com/mastra-ai/mastra/commit/b537cce9f83d801f73b3328a17eb61b7701a11ea), [`f7d7475`](https://github.com/mastra-ai/mastra/commit/f7d747507341aef60ed39e4b49318db1f86034a6), [`084b77b`](https://github.com/mastra-ai/mastra/commit/084b77b2955960e0190af8db3f77138aa83ed65c), [`a93ff84`](https://github.com/mastra-ai/mastra/commit/a93ff84b5e1af07ee236ac8873dac9b49aa5d501), [`96d4600`](https://github.com/mastra-ai/mastra/commit/96d4600723d5c26cd4cb67ea3c02f76ad78a6887), [`bc5aacb`](https://github.com/mastra-ai/mastra/commit/bc5aacb646d468d325327e36117129f28cd13bf6), [`6b5af12`](https://github.com/mastra-ai/mastra/commit/6b5af12ce9e09066e0c32e821c203a6954498bea), [`bf60e4a`](https://github.com/mastra-ai/mastra/commit/bf60e4a89c515afd9570b7b79f33b95e7d07c397), [`d41aee5`](https://github.com/mastra-ai/mastra/commit/d41aee526d124e35f42720a08e64043229193679), [`e8fe13c`](https://github.com/mastra-ai/mastra/commit/e8fe13c4b4c255a42520127797ec394310f7c919), [`3ca833d`](https://github.com/mastra-ai/mastra/commit/3ca833dc994c38e3c9b4f9b4478a61cd8e07b32a), [`1edb8d1`](https://github.com/mastra-ai/mastra/commit/1edb8d1cfb963e72a12412990fb9170936c9904c), [`fbf6e32`](https://github.com/mastra-ai/mastra/commit/fbf6e324946332d0f5ed8930bf9d4d4479cefd7a), [`4753027`](https://github.com/mastra-ai/mastra/commit/4753027ee889288775c6958bdfeda03ff909af67)]:
  - @mastra/core@0.20.0
  - @mastra/react@0.0.3
  - @mastra/client-js@0.15.0

## 6.3.0-alpha.0

### Minor Changes

- Breaking change to move the agent.streamVNext/generateVNext implementation to the default stream/generate. The old stream/generate have now been moved to streamLegacy and generateLegacy ([#8097](https://github.com/mastra-ai/mastra/pull/8097))

### Patch Changes

- dependencies updates: ([#8298](https://github.com/mastra-ai/mastra/pull/8298))
  - Updated dependency [`@xyflow/react@^12.8.6` ↗︎](https://www.npmjs.com/package/@xyflow/react/v/12.8.6) (from `^12.8.5`, in `dependencies`)

- dependencies updates: ([#8333](https://github.com/mastra-ai/mastra/pull/8333))
  - Updated dependency [`motion@^12.23.22` ↗︎](https://www.npmjs.com/package/motion/v/12.23.22) (from `^12.23.13`, in `dependencies`)

- better memory message ([#8382](https://github.com/mastra-ai/mastra/pull/8382))

- generateVNext into react SDK + to asistant ui message ([#8345](https://github.com/mastra-ai/mastra/pull/8345))

- Add doc url to netlify gateway ([#8356](https://github.com/mastra-ai/mastra/pull/8356))

- fix codeblock line number color contrast for legacy traces ([#8385](https://github.com/mastra-ai/mastra/pull/8385))

- distinguish between legacy and regular messages in agent chat for useChat usage ([#8409](https://github.com/mastra-ai/mastra/pull/8409))

- Model router documentation and playground UI improvements ([#8372](https://github.com/mastra-ai/mastra/pull/8372))

  **Documentation generation (`@mastra/core`):**
  - Fixed inverted dynamic model selection logic in provider examples
  - Improved copy: replaced marketing language with action-oriented descriptions
  - Added generated file comments with timestamps to all MDX outputs so maintainers know not to directly edit generated files

  **Playground UI model picker (`@mastra/playground-ui`):**
  - Fixed provider field clearing when typing in model input
  - Added responsive layout (stacks on mobile, side-by-side on desktop)
  - Improved general styling of provider/model pickers

  **Environment variables (`@mastra/deployer`):**
  - Properly handle array of env vars (e.g., NETLIFY_TOKEN, NETLIFY_SITE_ID)
  - Added correct singular/plural handling for "environment variable(s)"

- fix playground message history initial state for v1 models ([#8427](https://github.com/mastra-ai/mastra/pull/8427))

- show thread list in desc order ([#8381](https://github.com/mastra-ai/mastra/pull/8381))

- Add observe strean to get streans after workflow has been interrupted ([#8318](https://github.com/mastra-ai/mastra/pull/8318))

- Updated dependencies [[`00cb6bd`](https://github.com/mastra-ai/mastra/commit/00cb6bdf78737c0fac14a5a0c7b532a11e38558a), [`869ba22`](https://github.com/mastra-ai/mastra/commit/869ba222e1d6b58fc1b65e7c9fd55ca4e01b8c2f), [`1b73665`](https://github.com/mastra-ai/mastra/commit/1b73665e8e23f5c09d49fcf3e7d709c75259259e), [`b537cce`](https://github.com/mastra-ai/mastra/commit/b537cce9f83d801f73b3328a17eb61b7701a11ea), [`f7d7475`](https://github.com/mastra-ai/mastra/commit/f7d747507341aef60ed39e4b49318db1f86034a6), [`084b77b`](https://github.com/mastra-ai/mastra/commit/084b77b2955960e0190af8db3f77138aa83ed65c), [`a93ff84`](https://github.com/mastra-ai/mastra/commit/a93ff84b5e1af07ee236ac8873dac9b49aa5d501), [`96d4600`](https://github.com/mastra-ai/mastra/commit/96d4600723d5c26cd4cb67ea3c02f76ad78a6887), [`bc5aacb`](https://github.com/mastra-ai/mastra/commit/bc5aacb646d468d325327e36117129f28cd13bf6), [`6b5af12`](https://github.com/mastra-ai/mastra/commit/6b5af12ce9e09066e0c32e821c203a6954498bea), [`bf60e4a`](https://github.com/mastra-ai/mastra/commit/bf60e4a89c515afd9570b7b79f33b95e7d07c397), [`d41aee5`](https://github.com/mastra-ai/mastra/commit/d41aee526d124e35f42720a08e64043229193679), [`e8fe13c`](https://github.com/mastra-ai/mastra/commit/e8fe13c4b4c255a42520127797ec394310f7c919), [`3ca833d`](https://github.com/mastra-ai/mastra/commit/3ca833dc994c38e3c9b4f9b4478a61cd8e07b32a), [`1edb8d1`](https://github.com/mastra-ai/mastra/commit/1edb8d1cfb963e72a12412990fb9170936c9904c), [`fbf6e32`](https://github.com/mastra-ai/mastra/commit/fbf6e324946332d0f5ed8930bf9d4d4479cefd7a), [`4753027`](https://github.com/mastra-ai/mastra/commit/4753027ee889288775c6958bdfeda03ff909af67)]:
  - @mastra/core@0.20.0-alpha.0
  - @mastra/react@0.0.3-alpha.0
  - @mastra/client-js@0.15.0-alpha.0

## 6.2.4

### Patch Changes

- disable network label when memory is not enabled OR the agent has no subagents ([#8341](https://github.com/mastra-ai/mastra/pull/8341))

- Added Mastra model router to Playground UI ([#8332](https://github.com/mastra-ai/mastra/pull/8332))

- Updated dependencies [[`4a70ccc`](https://github.com/mastra-ai/mastra/commit/4a70ccc5cfa12ae9c2b36545a5814cd98e5a0ead), [`0992b8b`](https://github.com/mastra-ai/mastra/commit/0992b8bf0f4f1ba7ad9940883ec4bb8d867d3105), [`283bea0`](https://github.com/mastra-ai/mastra/commit/283bea07adbaf04a27fa3ad2df611095e0825195)]:
  - @mastra/core@0.19.1
  - @mastra/client-js@0.14.1
  - @mastra/react@0.0.2

## 6.2.4-alpha.1

### Patch Changes

- disable network label when memory is not enabled OR the agent has no subagents ([#8341](https://github.com/mastra-ai/mastra/pull/8341))

- Updated dependencies [[`4a70ccc`](https://github.com/mastra-ai/mastra/commit/4a70ccc5cfa12ae9c2b36545a5814cd98e5a0ead)]:
  - @mastra/core@0.19.1-alpha.1
  - @mastra/client-js@0.14.1-alpha.1
  - @mastra/react@0.0.2-alpha.1

## 6.2.4-alpha.0

### Patch Changes

- Added Mastra model router to Playground UI ([#8332](https://github.com/mastra-ai/mastra/pull/8332))

- Updated dependencies [[`0992b8b`](https://github.com/mastra-ai/mastra/commit/0992b8bf0f4f1ba7ad9940883ec4bb8d867d3105), [`283bea0`](https://github.com/mastra-ai/mastra/commit/283bea07adbaf04a27fa3ad2df611095e0825195)]:
  - @mastra/core@0.19.1-alpha.0
  - @mastra/client-js@0.14.1-alpha.0
  - @mastra/react@0.0.2-alpha.0

## 6.2.3

### Patch Changes

- Remove legacy helpers ([#8017](https://github.com/mastra-ai/mastra/pull/8017))

- Update peer deps ([#8154](https://github.com/mastra-ai/mastra/pull/8154))

- Fix an issue about instructions not working in a different format than string ([#8284](https://github.com/mastra-ai/mastra/pull/8284))

- Fixed an issue in playground where text-start/end parts were ignored in handleStreamChunk and tool ordering vs text wasn't retained ([#8234](https://github.com/mastra-ai/mastra/pull/8234))

- fixNetworkChunkType ([#8210](https://github.com/mastra-ai/mastra/pull/8210))

- Add conditional chaining to scorer.agentNames return ([#8199](https://github.com/mastra-ai/mastra/pull/8199))

- Show model that worked when there are model fallbacks ([#8167](https://github.com/mastra-ai/mastra/pull/8167))

- Add types in the streamVNext codepath, fixes for various issues across multiple packages surfaced from type issues, align return types. ([#8010](https://github.com/mastra-ai/mastra/pull/8010))

- modify the useMastraChat hook to useChat ([#8265](https://github.com/mastra-ai/mastra/pull/8265))

- Add model fallbacks to playground ([#7427](https://github.com/mastra-ai/mastra/pull/7427))

- Updated dependencies [[`dc099b4`](https://github.com/mastra-ai/mastra/commit/dc099b40fb31147ba3f362f98d991892033c4c67), [`5cb4596`](https://github.com/mastra-ai/mastra/commit/5cb4596c644104ea817bb0c5a07b8b1f8de595a8), [`504438b`](https://github.com/mastra-ai/mastra/commit/504438b961bde211071186bba63a842c4e3db879), [`86be6be`](https://github.com/mastra-ai/mastra/commit/86be6bee7e64b7d828a6b4eec283265c820dfa43), [`57b6dd5`](https://github.com/mastra-ai/mastra/commit/57b6dd50f9e6d92c0ed3e7199e6a92752025e3a1), [`b342a68`](https://github.com/mastra-ai/mastra/commit/b342a68e1399cf1ece9ba11bda112db89d21118c), [`a7243e2`](https://github.com/mastra-ai/mastra/commit/a7243e2e58762667a6e3921e755e89d6bb0a3282), [`7fceb0a`](https://github.com/mastra-ai/mastra/commit/7fceb0a327d678e812f90f5387c5bc4f38bd039e), [`303a9c0`](https://github.com/mastra-ai/mastra/commit/303a9c0d7dd58795915979f06a0512359e4532fb), [`df64f9e`](https://github.com/mastra-ai/mastra/commit/df64f9ef814916fff9baedd861c988084e7c41de), [`370f8a6`](https://github.com/mastra-ai/mastra/commit/370f8a6480faec70fef18d72e5f7538f27004301), [`809eea0`](https://github.com/mastra-ai/mastra/commit/809eea092fa80c3f69b9eaf078d843b57fd2a88e), [`683e5a1`](https://github.com/mastra-ai/mastra/commit/683e5a1466e48b686825b2c11f84680f296138e4), [`3679378`](https://github.com/mastra-ai/mastra/commit/3679378673350aa314741dc826f837b1984149bc), [`7775bc2`](https://github.com/mastra-ai/mastra/commit/7775bc20bb1ad1ab24797fb420e4f96c65b0d8ec), [`623ffaf`](https://github.com/mastra-ai/mastra/commit/623ffaf2d969e11e99a0224633cf7b5a0815c857), [`9fc1613`](https://github.com/mastra-ai/mastra/commit/9fc16136400186648880fd990119ac15f7c02ee4), [`61f62aa`](https://github.com/mastra-ai/mastra/commit/61f62aa31bc88fe4ddf8da6240dbcfbeb07358bd), [`db1891a`](https://github.com/mastra-ai/mastra/commit/db1891a4707443720b7cd8a260dc7e1d49b3609c), [`e8f379d`](https://github.com/mastra-ai/mastra/commit/e8f379d390efa264c4e0874f9ac0cf8839b07777), [`652066b`](https://github.com/mastra-ai/mastra/commit/652066bd1efc6bb6813ba950ed1d7573e8b7d9d4), [`3e292ba`](https://github.com/mastra-ai/mastra/commit/3e292ba00837886d5d68a34cbc0d9b703c991883), [`418c136`](https://github.com/mastra-ai/mastra/commit/418c1366843d88e491bca3f87763899ce855ca29), [`ea8d386`](https://github.com/mastra-ai/mastra/commit/ea8d386cd8c5593664515fd5770c06bf2aa980ef), [`67b0f00`](https://github.com/mastra-ai/mastra/commit/67b0f005b520335c71fb85cbaa25df4ce8484a81), [`c2a4919`](https://github.com/mastra-ai/mastra/commit/c2a4919ba6797d8bdb1509e02287496eef69303e), [`8e087b1`](https://github.com/mastra-ai/mastra/commit/8e087b126c0e1a38dd45bde24bdb97d1ecaacca4), [`c84b7d0`](https://github.com/mastra-ai/mastra/commit/c84b7d093c4657772140cbfd2b15ef72f3315ed5), [`6f67656`](https://github.com/mastra-ai/mastra/commit/6f676562276926e2982401574d1e07157579be30), [`0130986`](https://github.com/mastra-ai/mastra/commit/0130986fc62d0edcc626dd593282661dbb9af141)]:
  - @mastra/client-js@0.14.0
  - @mastra/core@0.19.0
  - @mastra/react@0.0.1

## 6.2.3-alpha.1

### Patch Changes

- Update peer deps ([#8154](https://github.com/mastra-ai/mastra/pull/8154))

- Fix an issue about instructions not working in a different format than string ([#8284](https://github.com/mastra-ai/mastra/pull/8284))

- Fixed an issue in playground where text-start/end parts were ignored in handleStreamChunk and tool ordering vs text wasn't retained ([#8234](https://github.com/mastra-ai/mastra/pull/8234))

- fixNetworkChunkType ([#8210](https://github.com/mastra-ai/mastra/pull/8210))

- Add conditional chaining to scorer.agentNames return ([#8199](https://github.com/mastra-ai/mastra/pull/8199))

- Show model that worked when there are model fallbacks ([#8167](https://github.com/mastra-ai/mastra/pull/8167))

- modify the useMastraChat hook to useChat ([#8265](https://github.com/mastra-ai/mastra/pull/8265))

- Updated dependencies [[`5cb4596`](https://github.com/mastra-ai/mastra/commit/5cb4596c644104ea817bb0c5a07b8b1f8de595a8), [`504438b`](https://github.com/mastra-ai/mastra/commit/504438b961bde211071186bba63a842c4e3db879), [`86be6be`](https://github.com/mastra-ai/mastra/commit/86be6bee7e64b7d828a6b4eec283265c820dfa43), [`57b6dd5`](https://github.com/mastra-ai/mastra/commit/57b6dd50f9e6d92c0ed3e7199e6a92752025e3a1), [`a7243e2`](https://github.com/mastra-ai/mastra/commit/a7243e2e58762667a6e3921e755e89d6bb0a3282), [`7fceb0a`](https://github.com/mastra-ai/mastra/commit/7fceb0a327d678e812f90f5387c5bc4f38bd039e), [`df64f9e`](https://github.com/mastra-ai/mastra/commit/df64f9ef814916fff9baedd861c988084e7c41de), [`809eea0`](https://github.com/mastra-ai/mastra/commit/809eea092fa80c3f69b9eaf078d843b57fd2a88e), [`683e5a1`](https://github.com/mastra-ai/mastra/commit/683e5a1466e48b686825b2c11f84680f296138e4), [`3679378`](https://github.com/mastra-ai/mastra/commit/3679378673350aa314741dc826f837b1984149bc), [`7775bc2`](https://github.com/mastra-ai/mastra/commit/7775bc20bb1ad1ab24797fb420e4f96c65b0d8ec), [`db1891a`](https://github.com/mastra-ai/mastra/commit/db1891a4707443720b7cd8a260dc7e1d49b3609c), [`e8f379d`](https://github.com/mastra-ai/mastra/commit/e8f379d390efa264c4e0874f9ac0cf8839b07777), [`652066b`](https://github.com/mastra-ai/mastra/commit/652066bd1efc6bb6813ba950ed1d7573e8b7d9d4), [`ea8d386`](https://github.com/mastra-ai/mastra/commit/ea8d386cd8c5593664515fd5770c06bf2aa980ef), [`c2a4919`](https://github.com/mastra-ai/mastra/commit/c2a4919ba6797d8bdb1509e02287496eef69303e), [`8e087b1`](https://github.com/mastra-ai/mastra/commit/8e087b126c0e1a38dd45bde24bdb97d1ecaacca4), [`6f67656`](https://github.com/mastra-ai/mastra/commit/6f676562276926e2982401574d1e07157579be30), [`0130986`](https://github.com/mastra-ai/mastra/commit/0130986fc62d0edcc626dd593282661dbb9af141)]:
  - @mastra/client-js@0.14.0-alpha.1
  - @mastra/core@0.19.0-alpha.1
  - @mastra/react@0.0.1-alpha.1

## 6.2.3-alpha.0

### Patch Changes

- Remove legacy helpers ([#8017](https://github.com/mastra-ai/mastra/pull/8017))

- Add types in the streamVNext codepath, fixes for various issues across multiple packages surfaced from type issues, align return types. ([#8010](https://github.com/mastra-ai/mastra/pull/8010))

- Add model fallbacks to playground ([#7427](https://github.com/mastra-ai/mastra/pull/7427))

- Updated dependencies [[`dc099b4`](https://github.com/mastra-ai/mastra/commit/dc099b40fb31147ba3f362f98d991892033c4c67), [`b342a68`](https://github.com/mastra-ai/mastra/commit/b342a68e1399cf1ece9ba11bda112db89d21118c), [`303a9c0`](https://github.com/mastra-ai/mastra/commit/303a9c0d7dd58795915979f06a0512359e4532fb), [`370f8a6`](https://github.com/mastra-ai/mastra/commit/370f8a6480faec70fef18d72e5f7538f27004301), [`623ffaf`](https://github.com/mastra-ai/mastra/commit/623ffaf2d969e11e99a0224633cf7b5a0815c857), [`9fc1613`](https://github.com/mastra-ai/mastra/commit/9fc16136400186648880fd990119ac15f7c02ee4), [`61f62aa`](https://github.com/mastra-ai/mastra/commit/61f62aa31bc88fe4ddf8da6240dbcfbeb07358bd), [`3e292ba`](https://github.com/mastra-ai/mastra/commit/3e292ba00837886d5d68a34cbc0d9b703c991883), [`418c136`](https://github.com/mastra-ai/mastra/commit/418c1366843d88e491bca3f87763899ce855ca29), [`c84b7d0`](https://github.com/mastra-ai/mastra/commit/c84b7d093c4657772140cbfd2b15ef72f3315ed5)]:
  - @mastra/client-js@0.14.0-alpha.0
  - @mastra/core@0.18.1-alpha.0
  - @mastra/react-hooks@0.0.1-alpha.1

## 6.2.2

### Patch Changes

- dependencies updates: ([#7980](https://github.com/mastra-ai/mastra/pull/7980))
  - Updated dependency [`zod@^4.1.8` ↗︎](https://www.npmjs.com/package/zod/v/4.1.8) (from `^4.1.5`, in `dependencies`)

- dependencies updates: ([#8019](https://github.com/mastra-ai/mastra/pull/8019))
  - Updated dependency [`motion@^12.23.13` ↗︎](https://www.npmjs.com/package/motion/v/12.23.13) (from `^12.23.12`, in `dependencies`)

- dependencies updates: ([#8034](https://github.com/mastra-ai/mastra/pull/8034))
  - Updated dependency [`zod@^4.1.9` ↗︎](https://www.npmjs.com/package/zod/v/4.1.9) (from `^4.1.8`, in `dependencies`)

- dependencies updates: ([#8050](https://github.com/mastra-ai/mastra/pull/8050))
  - Updated dependency [`@xyflow/react@^12.8.5` ↗︎](https://www.npmjs.com/package/@xyflow/react/v/12.8.5) (from `^12.8.4`, in `dependencies`)

- show the tool-output stream in the playground for streamVNext ([#7983](https://github.com/mastra-ai/mastra/pull/7983))

- Get rid off swr one for all ([#7931](https://github.com/mastra-ai/mastra/pull/7931))

- Fix DateTimePicker style issue ([#8106](https://github.com/mastra-ai/mastra/pull/8106))

- Fix navigating between scores and entity types ([#8129](https://github.com/mastra-ai/mastra/pull/8129))

- Fix getting tool link path from agent in playground ui tools page ([#8135](https://github.com/mastra-ai/mastra/pull/8135))

- Update Peerdeps for packages based on core minor bump ([#8025](https://github.com/mastra-ai/mastra/pull/8025))

- Add UI for scoring traces ([#8089](https://github.com/mastra-ai/mastra/pull/8089))

- Updated dependencies [[`cf34503`](https://github.com/mastra-ai/mastra/commit/cf345031de4e157f29087946449e60b965e9c8a9), [`6b4b1e4`](https://github.com/mastra-ai/mastra/commit/6b4b1e4235428d39e51cbda9832704c0ba70ab32), [`3469fca`](https://github.com/mastra-ai/mastra/commit/3469fca7bb7e5e19369ff9f7044716a5e4b02585), [`a61f23f`](https://github.com/mastra-ai/mastra/commit/a61f23fbbca4b88b763d94f1d784c47895ed72d7), [`4b339b8`](https://github.com/mastra-ai/mastra/commit/4b339b8141c20d6a6d80583c7e8c5c05d8c19492), [`8f56160`](https://github.com/mastra-ai/mastra/commit/8f56160fd45c740076529148b9c225f6842d43b0), [`d1dc606`](https://github.com/mastra-ai/mastra/commit/d1dc6067b0557a71190b68d56ee15b48c26d2411), [`c45298a`](https://github.com/mastra-ai/mastra/commit/c45298a0a0791db35cf79f1199d77004da0704cb), [`c4a8204`](https://github.com/mastra-ai/mastra/commit/c4a82046bfd241d6044e234bc5917d5a01fe6b55), [`d3bd4d4`](https://github.com/mastra-ai/mastra/commit/d3bd4d482a685bbb67bfa89be91c90dca3fa71ad), [`c591dfc`](https://github.com/mastra-ai/mastra/commit/c591dfc1e600fae1dedffe239357d250e146378f), [`1920c5c`](https://github.com/mastra-ai/mastra/commit/1920c5c6d666f687785c73021196aa551e579e0d), [`b6a3b65`](https://github.com/mastra-ai/mastra/commit/b6a3b65d830fa0ca7754ad6481661d1f2c878f21), [`af3abb6`](https://github.com/mastra-ai/mastra/commit/af3abb6f7c7585d856e22d27f4e7d2ece2186b9a), [`282379f`](https://github.com/mastra-ai/mastra/commit/282379fafed80c6417fe1e791087110decd481ca)]:
  - @mastra/core@0.18.0
  - @mastra/client-js@0.13.2

## 6.2.2-alpha.4

### Patch Changes

- Fix getting tool link path from agent in playground ui tools page ([#8135](https://github.com/mastra-ai/mastra/pull/8135))

## 6.2.2-alpha.3

### Patch Changes

- Fix DateTimePicker style issue ([#8106](https://github.com/mastra-ai/mastra/pull/8106))

- Fix navigating between scores and entity types ([#8129](https://github.com/mastra-ai/mastra/pull/8129))

- Add UI for scoring traces ([#8089](https://github.com/mastra-ai/mastra/pull/8089))

- Updated dependencies [[`4b339b8`](https://github.com/mastra-ai/mastra/commit/4b339b8141c20d6a6d80583c7e8c5c05d8c19492), [`8f56160`](https://github.com/mastra-ai/mastra/commit/8f56160fd45c740076529148b9c225f6842d43b0), [`c591dfc`](https://github.com/mastra-ai/mastra/commit/c591dfc1e600fae1dedffe239357d250e146378f), [`1920c5c`](https://github.com/mastra-ai/mastra/commit/1920c5c6d666f687785c73021196aa551e579e0d), [`b6a3b65`](https://github.com/mastra-ai/mastra/commit/b6a3b65d830fa0ca7754ad6481661d1f2c878f21), [`af3abb6`](https://github.com/mastra-ai/mastra/commit/af3abb6f7c7585d856e22d27f4e7d2ece2186b9a), [`282379f`](https://github.com/mastra-ai/mastra/commit/282379fafed80c6417fe1e791087110decd481ca)]:
  - @mastra/core@0.18.0-alpha.3
  - @mastra/client-js@0.13.2-alpha.3

## 6.2.2-alpha.2

### Patch Changes

- dependencies updates: ([#8034](https://github.com/mastra-ai/mastra/pull/8034))
  - Updated dependency [`zod@^4.1.9` ↗︎](https://www.npmjs.com/package/zod/v/4.1.9) (from `^4.1.8`, in `dependencies`)

- dependencies updates: ([#8050](https://github.com/mastra-ai/mastra/pull/8050))
  - Updated dependency [`@xyflow/react@^12.8.5` ↗︎](https://www.npmjs.com/package/@xyflow/react/v/12.8.5) (from `^12.8.4`, in `dependencies`)

- Update Peerdeps for packages based on core minor bump ([#8025](https://github.com/mastra-ai/mastra/pull/8025))

- Updated dependencies [[`cf34503`](https://github.com/mastra-ai/mastra/commit/cf345031de4e157f29087946449e60b965e9c8a9), [`6b4b1e4`](https://github.com/mastra-ai/mastra/commit/6b4b1e4235428d39e51cbda9832704c0ba70ab32), [`3469fca`](https://github.com/mastra-ai/mastra/commit/3469fca7bb7e5e19369ff9f7044716a5e4b02585), [`c4a8204`](https://github.com/mastra-ai/mastra/commit/c4a82046bfd241d6044e234bc5917d5a01fe6b55)]:
  - @mastra/core@0.18.0-alpha.2
  - @mastra/client-js@0.13.2-alpha.2

## 6.2.2-alpha.1

### Patch Changes

- dependencies updates: ([#8019](https://github.com/mastra-ai/mastra/pull/8019))
  - Updated dependency [`motion@^12.23.13` ↗︎](https://www.npmjs.com/package/motion/v/12.23.13) (from `^12.23.12`, in `dependencies`)

- show the tool-output stream in the playground for streamVNext ([#7983](https://github.com/mastra-ai/mastra/pull/7983))

- Updated dependencies [[`c45298a`](https://github.com/mastra-ai/mastra/commit/c45298a0a0791db35cf79f1199d77004da0704cb)]:
  - @mastra/core@0.17.2-alpha.1
  - @mastra/client-js@0.13.2-alpha.1

## 6.2.2-alpha.0

### Patch Changes

- dependencies updates: ([#7980](https://github.com/mastra-ai/mastra/pull/7980))
  - Updated dependency [`zod@^4.1.8` ↗︎](https://www.npmjs.com/package/zod/v/4.1.8) (from `^4.1.5`, in `dependencies`)

- Get rid off swr one for all ([#7931](https://github.com/mastra-ai/mastra/pull/7931))

- Updated dependencies [[`a61f23f`](https://github.com/mastra-ai/mastra/commit/a61f23fbbca4b88b763d94f1d784c47895ed72d7), [`d1dc606`](https://github.com/mastra-ai/mastra/commit/d1dc6067b0557a71190b68d56ee15b48c26d2411), [`d3bd4d4`](https://github.com/mastra-ai/mastra/commit/d3bd4d482a685bbb67bfa89be91c90dca3fa71ad)]:
  - @mastra/client-js@0.13.2-alpha.0
  - @mastra/core@0.17.2-alpha.0

## 6.2.1

### Patch Changes

- Updated dependencies [[`fd00e63`](https://github.com/mastra-ai/mastra/commit/fd00e63759cbcca3473c40cac9843280b0557cff), [`ab610f6`](https://github.com/mastra-ai/mastra/commit/ab610f6f41dbfe6c9502368671485ca7a0aac09b), [`e6bda5f`](https://github.com/mastra-ai/mastra/commit/e6bda5f954ee8493ea18adc1a883f0a5b785ad9b)]:
  - @mastra/core@0.17.1
  - @mastra/client-js@0.13.1

## 6.2.1-alpha.0

### Patch Changes

- Updated dependencies [[`fd00e63`](https://github.com/mastra-ai/mastra/commit/fd00e63759cbcca3473c40cac9843280b0557cff), [`ab610f6`](https://github.com/mastra-ai/mastra/commit/ab610f6f41dbfe6c9502368671485ca7a0aac09b), [`e6bda5f`](https://github.com/mastra-ai/mastra/commit/e6bda5f954ee8493ea18adc1a883f0a5b785ad9b)]:
  - @mastra/core@0.17.1-alpha.0
  - @mastra/client-js@0.13.1-alpha.0

## 6.2.0

### Minor Changes

- Remove original AgentNetwork ([#7919](https://github.com/mastra-ai/mastra/pull/7919))

### Patch Changes

- dependencies updates: ([#7802](https://github.com/mastra-ai/mastra/pull/7802))
  - Updated dependency [`react-syntax-highlighter@^15.6.6` ↗︎](https://www.npmjs.com/package/react-syntax-highlighter/v/15.6.6) (from `^15.6.1`, in `dependencies`)

- dependencies updates: ([#7868](https://github.com/mastra-ai/mastra/pull/7868))
  - Updated dependency [`swr@^2.3.6` ↗︎](https://www.npmjs.com/package/swr/v/2.3.6) (from `^2.3.4`, in `dependencies`)

- dependencies updates: ([#7908](https://github.com/mastra-ai/mastra/pull/7908))
  - Updated dependency [`use-debounce@^10.0.6` ↗︎](https://www.npmjs.com/package/use-debounce/v/10.0.6) (from `^10.0.5`, in `dependencies`)

- dependencies updates: ([#7912](https://github.com/mastra-ai/mastra/pull/7912))
  - Updated dependency [`zustand@^5.0.8` ↗︎](https://www.npmjs.com/package/zustand/v/5.0.8) (from `^5.0.7`, in `dependencies`)

- Update peerdep of @mastra/core ([#7619](https://github.com/mastra-ai/mastra/pull/7619))

- Update data printed in AI span dialogs ([#7847](https://github.com/mastra-ai/mastra/pull/7847))

- avoid refetching on error when resolving a workflow in cloud ([#7842](https://github.com/mastra-ai/mastra/pull/7842))

- fix scorers table link full row ([#7915](https://github.com/mastra-ai/mastra/pull/7915))

- adjust the way we display scorers in agent metadata ([#7910](https://github.com/mastra-ai/mastra/pull/7910))

- Add default width to AI span timeline presentation ([#7853](https://github.com/mastra-ai/mastra/pull/7853))

- fix minor playground stuff for observability ([#7765](https://github.com/mastra-ai/mastra/pull/7765))

- Handle zod intersections in dynamic form ([#7768](https://github.com/mastra-ai/mastra/pull/7768))

- Fix VNext generate/stream usage tokens. They used to be undefined, now we are receiving the proper values. ([#7901](https://github.com/mastra-ai/mastra/pull/7901))

- Playground ui -pass runtimeContext to client SDK get methods ([#7767](https://github.com/mastra-ai/mastra/pull/7767))

- fix markdown rendering in agent in agent text-delta ([#7851](https://github.com/mastra-ai/mastra/pull/7851))

- Fixed createRun change in agent builder that was missed ([#7966](https://github.com/mastra-ai/mastra/pull/7966))

- fix error message when fetching observability things ([#7956](https://github.com/mastra-ai/mastra/pull/7956))

- Set null as empty value for score prompts ([#7875](https://github.com/mastra-ai/mastra/pull/7875))

- fix workflows runs fetching and displaying ([#7852](https://github.com/mastra-ai/mastra/pull/7852))

- fix empty state for scorers on agent page ([#7846](https://github.com/mastra-ai/mastra/pull/7846))

- Updated dependencies [[`197cbb2`](https://github.com/mastra-ai/mastra/commit/197cbb248fc8cb4bbf61bf70b770f1388b445df2), [`a1bb887`](https://github.com/mastra-ai/mastra/commit/a1bb887e8bfae44230f487648da72e96ef824561), [`6590763`](https://github.com/mastra-ai/mastra/commit/65907630ef4bf4127067cecd1cb21b56f55d5f1b), [`fb84c21`](https://github.com/mastra-ai/mastra/commit/fb84c21859d09bdc8f158bd5412bdc4b5835a61c), [`5802bf5`](https://github.com/mastra-ai/mastra/commit/5802bf57f6182e4b67c28d7d91abed349a8d14f3), [`5bda53a`](https://github.com/mastra-ai/mastra/commit/5bda53a9747bfa7d876d754fc92c83a06e503f62), [`c2eade3`](https://github.com/mastra-ai/mastra/commit/c2eade3508ef309662f065e5f340d7840295dd53), [`f26a8fd`](https://github.com/mastra-ai/mastra/commit/f26a8fd99fcb0497a5d86c28324430d7f6a5fb83), [`8a3f5e4`](https://github.com/mastra-ai/mastra/commit/8a3f5e4212ec36b302957deb4bd47005ab598382), [`222965a`](https://github.com/mastra-ai/mastra/commit/222965a98ce8197b86673ec594244650b5960257), [`6047778`](https://github.com/mastra-ai/mastra/commit/6047778e501df460648f31decddf8e443f36e373), [`a0f5f1c`](https://github.com/mastra-ai/mastra/commit/a0f5f1ca39c3c5c6d26202e9fcab986b4fe14568), [`9d4fc09`](https://github.com/mastra-ai/mastra/commit/9d4fc09b2ad55caa7738c7ceb3a905e454f74cdd), [`05c7abf`](https://github.com/mastra-ai/mastra/commit/05c7abfe105a015b7760c9bf33ff4419727502a0), [`0324ceb`](https://github.com/mastra-ai/mastra/commit/0324ceb8af9d16c12a531f90e575f6aab797ac81), [`d75ccf0`](https://github.com/mastra-ai/mastra/commit/d75ccf06dfd2582b916aa12624e3cd61b279edf1), [`0f9d227`](https://github.com/mastra-ai/mastra/commit/0f9d227890a98db33865abbea39daf407cd55ef7), [`b356f5f`](https://github.com/mastra-ai/mastra/commit/b356f5f7566cb3edb755d91f00b72fc1420b2a37), [`de056a0`](https://github.com/mastra-ai/mastra/commit/de056a02cbb43f6aa0380ab2150ea404af9ec0dd), [`f5ce05f`](https://github.com/mastra-ai/mastra/commit/f5ce05f831d42c69559bf4c0fdb46ccb920fc3a3), [`60c9cec`](https://github.com/mastra-ai/mastra/commit/60c9cec7048a79a87440f7840c383875bd710d93), [`c93532a`](https://github.com/mastra-ai/mastra/commit/c93532a340b80e4dd946d4c138d9381de5f70399), [`6cb1fcb`](https://github.com/mastra-ai/mastra/commit/6cb1fcbc8d0378ffed0d17784c96e68f30cb0272), [`aee4f00`](https://github.com/mastra-ai/mastra/commit/aee4f00e61e1a42e81a6d74ff149dbe69e32695a), [`f0ab020`](https://github.com/mastra-ai/mastra/commit/f0ab02034532a4afb71a1ef4fe243f9a8dffde84), [`cdc63c0`](https://github.com/mastra-ai/mastra/commit/cdc63c0d2725ee0191aa7f5287ccf83629019748), [`9f6f30f`](https://github.com/mastra-ai/mastra/commit/9f6f30f04ec6648bbca798ea8aad59317c40d8db), [`e6e37a0`](https://github.com/mastra-ai/mastra/commit/e6e37a05ec2b6de4f34ee77bb2dd08edfae4ae4a), [`547c621`](https://github.com/mastra-ai/mastra/commit/547c62104af3f7a551b3754e9cbdf0a3fbba15e4), [`897995e`](https://github.com/mastra-ai/mastra/commit/897995e630d572fe2891e7ede817938cabb43251), [`0fed8f2`](https://github.com/mastra-ai/mastra/commit/0fed8f2aa84b167b3415ea6f8f70755775132c8d), [`4f9ea8c`](https://github.com/mastra-ai/mastra/commit/4f9ea8c95ea74ba9abbf3b2ab6106c7d7bc45689), [`c4dbd12`](https://github.com/mastra-ai/mastra/commit/c4dbd12a05e75db124c5d8abff3d893ea1b88c30), [`1a1fbe6`](https://github.com/mastra-ai/mastra/commit/1a1fbe66efb7d94abc373ed0dd9676adb8122454), [`d706fad`](https://github.com/mastra-ai/mastra/commit/d706fad6e6e4b72357b18d229ba38e6c913c0e70), [`87fd07f`](https://github.com/mastra-ai/mastra/commit/87fd07ff35387a38728967163460231b5d33ae3b), [`5c3768f`](https://github.com/mastra-ai/mastra/commit/5c3768fa959454232ad76715c381f4aac00c6881), [`2685a78`](https://github.com/mastra-ai/mastra/commit/2685a78f224b8b04e20d4fab5ac1adb638190071), [`36f39c0`](https://github.com/mastra-ai/mastra/commit/36f39c00dc794952dc3c11aab91c2fa8bca74b11), [`239b5a4`](https://github.com/mastra-ai/mastra/commit/239b5a497aeae2e8b4d764f46217cfff2284788e), [`8a3f5e4`](https://github.com/mastra-ai/mastra/commit/8a3f5e4212ec36b302957deb4bd47005ab598382)]:
  - @mastra/core@0.17.0
  - @mastra/client-js@0.13.0

## 6.2.0-alpha.5

### Patch Changes

- Fix VNext generate/stream usage tokens. They used to be undefined, now we are receiving the proper values. ([#7901](https://github.com/mastra-ai/mastra/pull/7901))

- Updated dependencies [[`05c7abf`](https://github.com/mastra-ai/mastra/commit/05c7abfe105a015b7760c9bf33ff4419727502a0), [`aee4f00`](https://github.com/mastra-ai/mastra/commit/aee4f00e61e1a42e81a6d74ff149dbe69e32695a)]:
  - @mastra/core@0.17.0-alpha.8
  - @mastra/client-js@0.13.0-alpha.8

## 6.2.0-alpha.4

### Patch Changes

- Fixed createRun change in agent builder that was missed ([#7966](https://github.com/mastra-ai/mastra/pull/7966))

- fix error message when fetching observability things ([#7956](https://github.com/mastra-ai/mastra/pull/7956))

- Updated dependencies [[`4f9ea8c`](https://github.com/mastra-ai/mastra/commit/4f9ea8c95ea74ba9abbf3b2ab6106c7d7bc45689)]:
  - @mastra/core@0.17.0-alpha.7
  - @mastra/client-js@0.13.0-alpha.7

## 6.2.0-alpha.3

### Minor Changes

- Remove original AgentNetwork ([#7919](https://github.com/mastra-ai/mastra/pull/7919))

### Patch Changes

- dependencies updates: ([#7908](https://github.com/mastra-ai/mastra/pull/7908))
  - Updated dependency [`use-debounce@^10.0.6` ↗︎](https://www.npmjs.com/package/use-debounce/v/10.0.6) (from `^10.0.5`, in `dependencies`)

- dependencies updates: ([#7912](https://github.com/mastra-ai/mastra/pull/7912))
  - Updated dependency [`zustand@^5.0.8` ↗︎](https://www.npmjs.com/package/zustand/v/5.0.8) (from `^5.0.7`, in `dependencies`)

- fix scorers table link full row ([#7915](https://github.com/mastra-ai/mastra/pull/7915))

- adjust the way we display scorers in agent metadata ([#7910](https://github.com/mastra-ai/mastra/pull/7910))

- Updated dependencies [[`197cbb2`](https://github.com/mastra-ai/mastra/commit/197cbb248fc8cb4bbf61bf70b770f1388b445df2), [`6590763`](https://github.com/mastra-ai/mastra/commit/65907630ef4bf4127067cecd1cb21b56f55d5f1b), [`c2eade3`](https://github.com/mastra-ai/mastra/commit/c2eade3508ef309662f065e5f340d7840295dd53), [`222965a`](https://github.com/mastra-ai/mastra/commit/222965a98ce8197b86673ec594244650b5960257), [`0324ceb`](https://github.com/mastra-ai/mastra/commit/0324ceb8af9d16c12a531f90e575f6aab797ac81), [`0f9d227`](https://github.com/mastra-ai/mastra/commit/0f9d227890a98db33865abbea39daf407cd55ef7), [`de056a0`](https://github.com/mastra-ai/mastra/commit/de056a02cbb43f6aa0380ab2150ea404af9ec0dd), [`c93532a`](https://github.com/mastra-ai/mastra/commit/c93532a340b80e4dd946d4c138d9381de5f70399), [`6cb1fcb`](https://github.com/mastra-ai/mastra/commit/6cb1fcbc8d0378ffed0d17784c96e68f30cb0272), [`2685a78`](https://github.com/mastra-ai/mastra/commit/2685a78f224b8b04e20d4fab5ac1adb638190071), [`239b5a4`](https://github.com/mastra-ai/mastra/commit/239b5a497aeae2e8b4d764f46217cfff2284788e)]:
  - @mastra/core@0.17.0-alpha.6
  - @mastra/client-js@0.13.0-alpha.6

## 6.1.4-alpha.2

### Patch Changes

- Updated dependencies [[`fb84c21`](https://github.com/mastra-ai/mastra/commit/fb84c21859d09bdc8f158bd5412bdc4b5835a61c), [`9d4fc09`](https://github.com/mastra-ai/mastra/commit/9d4fc09b2ad55caa7738c7ceb3a905e454f74cdd), [`d75ccf0`](https://github.com/mastra-ai/mastra/commit/d75ccf06dfd2582b916aa12624e3cd61b279edf1), [`0fed8f2`](https://github.com/mastra-ai/mastra/commit/0fed8f2aa84b167b3415ea6f8f70755775132c8d), [`c4dbd12`](https://github.com/mastra-ai/mastra/commit/c4dbd12a05e75db124c5d8abff3d893ea1b88c30), [`87fd07f`](https://github.com/mastra-ai/mastra/commit/87fd07ff35387a38728967163460231b5d33ae3b)]:
  - @mastra/core@0.17.0-alpha.4
  - @mastra/client-js@0.13.0-alpha.4

## 6.1.4-alpha.1

### Patch Changes

- dependencies updates: ([#7802](https://github.com/mastra-ai/mastra/pull/7802))
  - Updated dependency [`react-syntax-highlighter@^15.6.6` ↗︎](https://www.npmjs.com/package/react-syntax-highlighter/v/15.6.6) (from `^15.6.1`, in `dependencies`)

- dependencies updates: ([#7868](https://github.com/mastra-ai/mastra/pull/7868))
  - Updated dependency [`swr@^2.3.6` ↗︎](https://www.npmjs.com/package/swr/v/2.3.6) (from `^2.3.4`, in `dependencies`)

- Update peerdep of @mastra/core ([#7619](https://github.com/mastra-ai/mastra/pull/7619))

- Update data printed in AI span dialogs ([#7847](https://github.com/mastra-ai/mastra/pull/7847))

- avoid refetching on error when resolving a workflow in cloud ([#7842](https://github.com/mastra-ai/mastra/pull/7842))

- Add default width to AI span timeline presentation ([#7853](https://github.com/mastra-ai/mastra/pull/7853))

- fix markdown rendering in agent in agent text-delta ([#7851](https://github.com/mastra-ai/mastra/pull/7851))

- Set null as empty value for score prompts ([#7875](https://github.com/mastra-ai/mastra/pull/7875))

- fix workflows runs fetching and displaying ([#7852](https://github.com/mastra-ai/mastra/pull/7852))

- fix empty state for scorers on agent page ([#7846](https://github.com/mastra-ai/mastra/pull/7846))

- Updated dependencies [[`a1bb887`](https://github.com/mastra-ai/mastra/commit/a1bb887e8bfae44230f487648da72e96ef824561), [`8a3f5e4`](https://github.com/mastra-ai/mastra/commit/8a3f5e4212ec36b302957deb4bd47005ab598382), [`a0f5f1c`](https://github.com/mastra-ai/mastra/commit/a0f5f1ca39c3c5c6d26202e9fcab986b4fe14568), [`b356f5f`](https://github.com/mastra-ai/mastra/commit/b356f5f7566cb3edb755d91f00b72fc1420b2a37), [`f5ce05f`](https://github.com/mastra-ai/mastra/commit/f5ce05f831d42c69559bf4c0fdb46ccb920fc3a3), [`9f6f30f`](https://github.com/mastra-ai/mastra/commit/9f6f30f04ec6648bbca798ea8aad59317c40d8db), [`d706fad`](https://github.com/mastra-ai/mastra/commit/d706fad6e6e4b72357b18d229ba38e6c913c0e70), [`5c3768f`](https://github.com/mastra-ai/mastra/commit/5c3768fa959454232ad76715c381f4aac00c6881), [`8a3f5e4`](https://github.com/mastra-ai/mastra/commit/8a3f5e4212ec36b302957deb4bd47005ab598382)]:
  - @mastra/core@0.17.0-alpha.3
  - @mastra/client-js@0.12.4-alpha.3

## 6.1.4-alpha.0

### Patch Changes

- fix minor playground stuff for observability ([#7765](https://github.com/mastra-ai/mastra/pull/7765))

- Handle zod intersections in dynamic form ([#7768](https://github.com/mastra-ai/mastra/pull/7768))

- Playground ui -pass runtimeContext to client SDK get methods ([#7767](https://github.com/mastra-ai/mastra/pull/7767))

- Updated dependencies [[`5802bf5`](https://github.com/mastra-ai/mastra/commit/5802bf57f6182e4b67c28d7d91abed349a8d14f3), [`5bda53a`](https://github.com/mastra-ai/mastra/commit/5bda53a9747bfa7d876d754fc92c83a06e503f62), [`f26a8fd`](https://github.com/mastra-ai/mastra/commit/f26a8fd99fcb0497a5d86c28324430d7f6a5fb83), [`f0ab020`](https://github.com/mastra-ai/mastra/commit/f0ab02034532a4afb71a1ef4fe243f9a8dffde84), [`cdc63c0`](https://github.com/mastra-ai/mastra/commit/cdc63c0d2725ee0191aa7f5287ccf83629019748), [`e6e37a0`](https://github.com/mastra-ai/mastra/commit/e6e37a05ec2b6de4f34ee77bb2dd08edfae4ae4a), [`1a1fbe6`](https://github.com/mastra-ai/mastra/commit/1a1fbe66efb7d94abc373ed0dd9676adb8122454), [`36f39c0`](https://github.com/mastra-ai/mastra/commit/36f39c00dc794952dc3c11aab91c2fa8bca74b11)]:
  - @mastra/core@0.16.4-alpha.0
  - @mastra/client-js@0.12.4-alpha.0

## 6.1.3

### Patch Changes

- AN packages ([#7711](https://github.com/mastra-ai/mastra/pull/7711))

- Client SDK Agents, Mastra server - support runtimeContext with GET requests ([#7734](https://github.com/mastra-ai/mastra/pull/7734))

- fix playground UI issue about dynmic workflow exec in agent thread ([#7665](https://github.com/mastra-ai/mastra/pull/7665))

- Updated dependencies [[`b4379f7`](https://github.com/mastra-ai/mastra/commit/b4379f703fd74474f253420e8c3a684f2c4b2f8e), [`2a6585f`](https://github.com/mastra-ai/mastra/commit/2a6585f7cb71f023f805d521d1c3c95fb9a3aa59), [`3d26e83`](https://github.com/mastra-ai/mastra/commit/3d26e8353a945719028f087cc6ac4b06f0ce27d2), [`dd9119b`](https://github.com/mastra-ai/mastra/commit/dd9119b175a8f389082f75c12750e51f96d65dca), [`d34aaa1`](https://github.com/mastra-ai/mastra/commit/d34aaa1da5d3c5f991740f59e2fe6d28d3e2dd91), [`56e55d1`](https://github.com/mastra-ai/mastra/commit/56e55d1e9eb63e7d9e41aa46e012aae471256812), [`ce1e580`](https://github.com/mastra-ai/mastra/commit/ce1e580f6391e94a0c6816a9c5db0a21566a262f), [`b2babfa`](https://github.com/mastra-ai/mastra/commit/b2babfa9e75b22f2759179e71d8473f6dc5421ed), [`d8c3ba5`](https://github.com/mastra-ai/mastra/commit/d8c3ba516f4173282d293f7e64769cfc8738d360), [`a566c4e`](https://github.com/mastra-ai/mastra/commit/a566c4e92d86c1671707c54359b1d33934f7cc13), [`0666082`](https://github.com/mastra-ai/mastra/commit/06660820230dcb1fa7c1d51c8254107afd68cd67), [`af333aa`](https://github.com/mastra-ai/mastra/commit/af333aa30fe6d1b127024b03a64736c46eddeca2), [`4c81b65`](https://github.com/mastra-ai/mastra/commit/4c81b65a28d128560bdf63bc9b8a1bddd4884812), [`3863c52`](https://github.com/mastra-ai/mastra/commit/3863c52d44b4e5779968b802d977e87adf939d8e), [`6424c7e`](https://github.com/mastra-ai/mastra/commit/6424c7ec38b6921d66212431db1e0958f441b2a7), [`db94750`](https://github.com/mastra-ai/mastra/commit/db94750a41fd29b43eb1f7ce8e97ba8b9978c91b), [`a66a371`](https://github.com/mastra-ai/mastra/commit/a66a3716b00553d7f01842be9deb34f720b10fab), [`779d469`](https://github.com/mastra-ai/mastra/commit/779d469366bb9f7fcb6d1638fdabb9f3acc49218), [`69fc3cd`](https://github.com/mastra-ai/mastra/commit/69fc3cd0fd814901785bdcf49bf536ab1e7fd975)]:
  - @mastra/core@0.16.3
  - @mastra/client-js@0.12.3

## 6.1.3-alpha.1

### Patch Changes

- Client SDK Agents, Mastra server - support runtimeContext with GET requests ([#7734](https://github.com/mastra-ai/mastra/pull/7734))

- Updated dependencies [[`2a6585f`](https://github.com/mastra-ai/mastra/commit/2a6585f7cb71f023f805d521d1c3c95fb9a3aa59), [`3d26e83`](https://github.com/mastra-ai/mastra/commit/3d26e8353a945719028f087cc6ac4b06f0ce27d2), [`56e55d1`](https://github.com/mastra-ai/mastra/commit/56e55d1e9eb63e7d9e41aa46e012aae471256812), [`4c81b65`](https://github.com/mastra-ai/mastra/commit/4c81b65a28d128560bdf63bc9b8a1bddd4884812)]:
  - @mastra/client-js@0.12.3-alpha.1
  - @mastra/core@0.16.3-alpha.1

## 6.1.3-alpha.0

### Patch Changes

- AN packages ([#7711](https://github.com/mastra-ai/mastra/pull/7711))

- fix playground UI issue about dynmic workflow exec in agent thread ([#7665](https://github.com/mastra-ai/mastra/pull/7665))

- Updated dependencies [[`b4379f7`](https://github.com/mastra-ai/mastra/commit/b4379f703fd74474f253420e8c3a684f2c4b2f8e), [`dd9119b`](https://github.com/mastra-ai/mastra/commit/dd9119b175a8f389082f75c12750e51f96d65dca), [`d34aaa1`](https://github.com/mastra-ai/mastra/commit/d34aaa1da5d3c5f991740f59e2fe6d28d3e2dd91), [`ce1e580`](https://github.com/mastra-ai/mastra/commit/ce1e580f6391e94a0c6816a9c5db0a21566a262f), [`b2babfa`](https://github.com/mastra-ai/mastra/commit/b2babfa9e75b22f2759179e71d8473f6dc5421ed), [`d8c3ba5`](https://github.com/mastra-ai/mastra/commit/d8c3ba516f4173282d293f7e64769cfc8738d360), [`a566c4e`](https://github.com/mastra-ai/mastra/commit/a566c4e92d86c1671707c54359b1d33934f7cc13), [`0666082`](https://github.com/mastra-ai/mastra/commit/06660820230dcb1fa7c1d51c8254107afd68cd67), [`af333aa`](https://github.com/mastra-ai/mastra/commit/af333aa30fe6d1b127024b03a64736c46eddeca2), [`3863c52`](https://github.com/mastra-ai/mastra/commit/3863c52d44b4e5779968b802d977e87adf939d8e), [`6424c7e`](https://github.com/mastra-ai/mastra/commit/6424c7ec38b6921d66212431db1e0958f441b2a7), [`db94750`](https://github.com/mastra-ai/mastra/commit/db94750a41fd29b43eb1f7ce8e97ba8b9978c91b), [`a66a371`](https://github.com/mastra-ai/mastra/commit/a66a3716b00553d7f01842be9deb34f720b10fab), [`779d469`](https://github.com/mastra-ai/mastra/commit/779d469366bb9f7fcb6d1638fdabb9f3acc49218), [`69fc3cd`](https://github.com/mastra-ai/mastra/commit/69fc3cd0fd814901785bdcf49bf536ab1e7fd975)]:
  - @mastra/core@0.16.3-alpha.0
  - @mastra/client-js@0.12.3-alpha.0

## 6.1.2

### Patch Changes

- Updated dependencies [[`61926ef`](https://github.com/mastra-ai/mastra/commit/61926ef40d415b805a63527cffe27a50542e15e5)]:
  - @mastra/core@0.16.2
  - @mastra/client-js@0.12.2

## 6.1.2-alpha.0

### Patch Changes

- Updated dependencies [[`61926ef`](https://github.com/mastra-ai/mastra/commit/61926ef40d415b805a63527cffe27a50542e15e5)]:
  - @mastra/core@0.16.2-alpha.0
  - @mastra/client-js@0.12.2-alpha.0

## 6.1.1

### Patch Changes

- Use workflow streamVNext in playground ([#7575](https://github.com/mastra-ai/mastra/pull/7575))

- add workflow streaming in agent thread ([#7506](https://github.com/mastra-ai/mastra/pull/7506))

- Fix template slug when getting template environment variables ([#7650](https://github.com/mastra-ai/mastra/pull/7650))

- Updated dependencies [[`47b6dc9`](https://github.com/mastra-ai/mastra/commit/47b6dc94f4976d4f3d3882e8f19eb365bbc5976c), [`827d876`](https://github.com/mastra-ai/mastra/commit/827d8766f36a900afcaf64a040f7ba76249009b3), [`0662d02`](https://github.com/mastra-ai/mastra/commit/0662d02ef16916e67531890639fcd72c69cfb6e2), [`565d65f`](https://github.com/mastra-ai/mastra/commit/565d65fc16314a99f081975ec92f2636dff0c86d), [`6189844`](https://github.com/mastra-ai/mastra/commit/61898448e65bda02bb814fb15801a89dc6476938), [`4da3d68`](https://github.com/mastra-ai/mastra/commit/4da3d68a778e5c4d5a17351ef223289fe2f45a45), [`fd9bbfe`](https://github.com/mastra-ai/mastra/commit/fd9bbfee22484f8493582325f53e8171bf8e682b), [`7eaf1d1`](https://github.com/mastra-ai/mastra/commit/7eaf1d1cec7e828d7a98efc2a748ac395bbdba3b), [`6f046b5`](https://github.com/mastra-ai/mastra/commit/6f046b5ccc5c8721302a9a61d5d16c12374cc8d7), [`d7a8f59`](https://github.com/mastra-ai/mastra/commit/d7a8f59154b0621aec4f41a6b2ea2b3882f03cb7), [`0b0bbb2`](https://github.com/mastra-ai/mastra/commit/0b0bbb24f4198ead69792e92b68a350f52b45cf3), [`d951f41`](https://github.com/mastra-ai/mastra/commit/d951f41771e4e5da8da4b9f870949f9509e38756), [`4dda259`](https://github.com/mastra-ai/mastra/commit/4dda2593b6343f9258671de5fb237aeba3ef6bb7), [`8049e2e`](https://github.com/mastra-ai/mastra/commit/8049e2e8cce80a00353c64894c62b695ac34e35e), [`f3427cd`](https://github.com/mastra-ai/mastra/commit/f3427cdaf9eecd63360dfc897a4acbf5f4143a4e), [`defed1c`](https://github.com/mastra-ai/mastra/commit/defed1ca8040cc8d42e645c5a50a1bc52a4918d7), [`6991ced`](https://github.com/mastra-ai/mastra/commit/6991cedcb5a44a49d9fe58ef67926e1f96ba55b1), [`9cb9c42`](https://github.com/mastra-ai/mastra/commit/9cb9c422854ee81074989dd2d8dccc0500ba8d3e), [`9ad094f`](https://github.com/mastra-ai/mastra/commit/9ad094fe813b115734a0c1f4859fe4191e05b186), [`8334859`](https://github.com/mastra-ai/mastra/commit/83348594d4f37b311ba4a94d679c5f8721d796d4), [`05f13b8`](https://github.com/mastra-ai/mastra/commit/05f13b8fb269ccfc4de98e9db58dbe16eae55a5e)]:
  - @mastra/core@0.16.1
  - @mastra/client-js@0.12.1

## 6.1.1-alpha.2

### Patch Changes

- Fix template slug when getting template environment variables ([#7650](https://github.com/mastra-ai/mastra/pull/7650))

- Updated dependencies [[`fd9bbfe`](https://github.com/mastra-ai/mastra/commit/fd9bbfee22484f8493582325f53e8171bf8e682b)]:
  - @mastra/core@0.16.1-alpha.3
  - @mastra/client-js@0.12.1-alpha.3

## 6.1.1-alpha.1

### Patch Changes

- Use workflow streamVNext in playground ([#7575](https://github.com/mastra-ai/mastra/pull/7575))

- add workflow streaming in agent thread ([#7506](https://github.com/mastra-ai/mastra/pull/7506))

- Updated dependencies [[`47b6dc9`](https://github.com/mastra-ai/mastra/commit/47b6dc94f4976d4f3d3882e8f19eb365bbc5976c), [`565d65f`](https://github.com/mastra-ai/mastra/commit/565d65fc16314a99f081975ec92f2636dff0c86d), [`4da3d68`](https://github.com/mastra-ai/mastra/commit/4da3d68a778e5c4d5a17351ef223289fe2f45a45), [`0b0bbb2`](https://github.com/mastra-ai/mastra/commit/0b0bbb24f4198ead69792e92b68a350f52b45cf3), [`d951f41`](https://github.com/mastra-ai/mastra/commit/d951f41771e4e5da8da4b9f870949f9509e38756), [`8049e2e`](https://github.com/mastra-ai/mastra/commit/8049e2e8cce80a00353c64894c62b695ac34e35e), [`9ad094f`](https://github.com/mastra-ai/mastra/commit/9ad094fe813b115734a0c1f4859fe4191e05b186)]:
  - @mastra/core@0.16.1-alpha.1
  - @mastra/client-js@0.12.1-alpha.1

## 6.1.1-alpha.0

### Patch Changes

- Updated dependencies [[`0662d02`](https://github.com/mastra-ai/mastra/commit/0662d02ef16916e67531890639fcd72c69cfb6e2), [`6189844`](https://github.com/mastra-ai/mastra/commit/61898448e65bda02bb814fb15801a89dc6476938), [`d7a8f59`](https://github.com/mastra-ai/mastra/commit/d7a8f59154b0621aec4f41a6b2ea2b3882f03cb7), [`4dda259`](https://github.com/mastra-ai/mastra/commit/4dda2593b6343f9258671de5fb237aeba3ef6bb7), [`defed1c`](https://github.com/mastra-ai/mastra/commit/defed1ca8040cc8d42e645c5a50a1bc52a4918d7), [`6991ced`](https://github.com/mastra-ai/mastra/commit/6991cedcb5a44a49d9fe58ef67926e1f96ba55b1), [`9cb9c42`](https://github.com/mastra-ai/mastra/commit/9cb9c422854ee81074989dd2d8dccc0500ba8d3e), [`8334859`](https://github.com/mastra-ai/mastra/commit/83348594d4f37b311ba4a94d679c5f8721d796d4)]:
  - @mastra/core@0.16.1-alpha.0
  - @mastra/client-js@0.12.1-alpha.0

## 6.1.0

### Minor Changes

- a01cf14: Add workflow graph in agent (workflow as tool in agent)
- 376913a: Update peerdeps of @mastra/core

### Patch Changes

- cf4e353: Agent Builder Template - adding in UI components to use agent builder template actions
- 788e612: Fix playground workflow graph is broken when workflow starts with a branch
- 5397eb4: Add public URL support when adding files in Multi Modal
- Updated dependencies [8fbf79e]
- Updated dependencies [cf4e353]
- Updated dependencies [6155cfc]
- Updated dependencies [fd83526]
- Updated dependencies [d0b90ab]
- Updated dependencies [6f5eb7a]
- Updated dependencies [a01cf14]
- Updated dependencies [a9e50ee]
- Updated dependencies [5397eb4]
- Updated dependencies [c9f4e4a]
- Updated dependencies [0acbc80]
  - @mastra/core@0.16.0
  - @mastra/client-js@0.12.0

## 6.1.0-alpha.1

### Minor Changes

- 376913a: Update peerdeps of @mastra/core

### Patch Changes

- Updated dependencies [8fbf79e]
  - @mastra/core@0.16.0-alpha.1
  - @mastra/client-js@0.12.0-alpha.1

## 6.1.0-alpha.0

### Minor Changes

- a01cf14: Add workflow graph in agent (workflow as tool in agent)

### Patch Changes

- cf4e353: Agent Builder Template - adding in UI components to use agent builder template actions
- 788e612: Fix playground workflow graph is broken when workflow starts with a branch
- 5397eb4: Add public URL support when adding files in Multi Modal
- Updated dependencies [cf4e353]
- Updated dependencies [6155cfc]
- Updated dependencies [fd83526]
- Updated dependencies [d0b90ab]
- Updated dependencies [6f5eb7a]
- Updated dependencies [a01cf14]
- Updated dependencies [a9e50ee]
- Updated dependencies [5397eb4]
- Updated dependencies [c9f4e4a]
- Updated dependencies [0acbc80]
  - @mastra/client-js@0.12.0-alpha.0
  - @mastra/core@0.16.0-alpha.0

## 6.0.0

### Major Changes

- 0c2a95f: Fix submit button visibility in DynamicForm of ToolExecutor by ensuring extra bottom spacing.

### Patch Changes

- ab48c97: dependencies updates:
  - Updated dependency [`zod@^4.1.5` ↗︎](https://www.npmjs.com/package/zod/v/4.1.5) (from `^4.0.15`, in `dependencies`)
- dbdc91f: dependencies updates:
  - Updated dependency [`@assistant-ui/react@^0.10.44` ↗︎](https://www.npmjs.com/package/@assistant-ui/react/v/0.10.44) (from `^0.7.91`, in `dependencies`)
  - Updated dependency [`@assistant-ui/react-markdown@^0.10.9` ↗︎](https://www.npmjs.com/package/@assistant-ui/react-markdown/v/0.10.9) (from `^0.7.21`, in `dependencies`)
  - Updated dependency [`@assistant-ui/react-syntax-highlighter@^0.10.10` ↗︎](https://www.npmjs.com/package/@assistant-ui/react-syntax-highlighter/v/0.10.10) (from `^0.7.10`, in `dependencies`)
  - Added dependency [`@assistant-ui/react-ui@^0.1.8` ↗︎](https://www.npmjs.com/package/@assistant-ui/react-ui/v/0.1.8) (to `dependencies`)
- 0fe56ce: dependencies updates:
  - Updated dependency [`@xyflow/react@^12.8.4` ↗︎](https://www.npmjs.com/package/@xyflow/react/v/12.8.4) (from `^12.8.2`, in `dependencies`)
- 572acd0: dependencies updates:
  - Updated dependency [`@assistant-ui/react@^0.10.45` ↗︎](https://www.npmjs.com/package/@assistant-ui/react/v/0.10.45) (from `^0.10.44`, in `dependencies`)
- de3cbc6: Update the `package.json` file to include additional fields like `repository`, `homepage` or `files`.
- 8e4fe90: Unify focus outlines
- f0dfcac: updated core peerdep
- 87de958: fix chat outline
- 3308c9f: fix dev:playground command
- d99baf6: change outline
- Updated dependencies [ab48c97]
- Updated dependencies [ab48c97]
- Updated dependencies [85ef90b]
- Updated dependencies [aedbbfa]
- Updated dependencies [ff89505]
- Updated dependencies [637f323]
- Updated dependencies [de3cbc6]
- Updated dependencies [c19bcf7]
- Updated dependencies [26b0d7c]
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
- Updated dependencies [48f0742]
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
  - @mastra/client-js@0.11.3
  - @mastra/core@0.15.3

## 6.0.0-alpha.5

### Patch Changes

- [#7394](https://github.com/mastra-ai/mastra/pull/7394) [`f0dfcac`](https://github.com/mastra-ai/mastra/commit/f0dfcac4458bdf789b975e2d63e984f5d1e7c4d3) Thanks [@NikAiyer](https://github.com/NikAiyer)! - updated core peerdep

- Updated dependencies [[`7149d8d`](https://github.com/mastra-ai/mastra/commit/7149d8d4bdc1edf0008e0ca9b7925eb0b8b60dbe)]:
  - @mastra/core@0.15.3-alpha.7
  - @mastra/client-js@0.11.3-alpha.7

## 6.0.0-alpha.4

### Patch Changes

- [#7351](https://github.com/mastra-ai/mastra/pull/7351) [`572acd0`](https://github.com/mastra-ai/mastra/commit/572acd0919479455ee654753877f2c1564d0b29e) Thanks [@dane-ai-mastra](https://github.com/apps/dane-ai-mastra)! - dependencies updates:
  - Updated dependency [`@assistant-ui/react@^0.10.45` ↗︎](https://www.npmjs.com/package/@assistant-ui/react/v/0.10.45) (from `^0.10.44`, in `dependencies`)
- Updated dependencies [[`c19bcf7`](https://github.com/mastra-ai/mastra/commit/c19bcf7b43542b02157b5e17303e519933a153ab), [`b42a961`](https://github.com/mastra-ai/mastra/commit/b42a961a5aefd19d6e938a7705fc0ecc90e8f756), [`45e4d39`](https://github.com/mastra-ai/mastra/commit/45e4d391a2a09fc70c48e4d60f505586ada1ba0e), [`0302f50`](https://github.com/mastra-ai/mastra/commit/0302f50861a53c66ff28801fc371b37c5f97e41e), [`74db265`](https://github.com/mastra-ai/mastra/commit/74db265b96aa01a72ffd91dcae0bc3b346cca0f2), [`7f3b8da`](https://github.com/mastra-ai/mastra/commit/7f3b8da6dd21c35d3672e44b4f5dd3502b8f8f92), [`905352b`](https://github.com/mastra-ai/mastra/commit/905352bcda134552400eb252bca1cb05a7975c14), [`f2cda47`](https://github.com/mastra-ai/mastra/commit/f2cda47ae911038c5d5489f54c36517d6f15bdcc), [`cfd377a`](https://github.com/mastra-ai/mastra/commit/cfd377a3a33a9c88b644f6540feed9cd9832db47)]:
  - @mastra/core@0.15.3-alpha.6
  - @mastra/client-js@0.11.3-alpha.6

## 6.0.0-alpha.3

### Patch Changes

- [#6969](https://github.com/mastra-ai/mastra/pull/6969) [`0fe56ce`](https://github.com/mastra-ai/mastra/commit/0fe56ce24e1317d545ca24d7f2ec341af9f2085f) Thanks [@dane-ai-mastra](https://github.com/apps/dane-ai-mastra)! - dependencies updates:
  - Updated dependency [`@xyflow/react@^12.8.4` ↗︎](https://www.npmjs.com/package/@xyflow/react/v/12.8.4) (from `^12.8.2`, in `dependencies`)

- [#7343](https://github.com/mastra-ai/mastra/pull/7343) [`de3cbc6`](https://github.com/mastra-ai/mastra/commit/de3cbc61079211431bd30487982ea3653517278e) Thanks [@LekoArts](https://github.com/LekoArts)! - Update the `package.json` file to include additional fields like `repository`, `homepage` or `files`.

- Updated dependencies [[`85ef90b`](https://github.com/mastra-ai/mastra/commit/85ef90bb2cd4ae4df855c7ac175f7d392c55c1bf), [`de3cbc6`](https://github.com/mastra-ai/mastra/commit/de3cbc61079211431bd30487982ea3653517278e)]:
  - @mastra/core@0.15.3-alpha.5
  - @mastra/client-js@0.11.3-alpha.5

## 6.0.0-alpha.2

### Major Changes

- [#7265](https://github.com/mastra-ai/mastra/pull/7265) [`0c2a95f`](https://github.com/mastra-ai/mastra/commit/0c2a95ffc0f5a8fcaa3012793f62fcf820690317) Thanks [@HichamELBSI](https://github.com/HichamELBSI)! - Fix submit button visibility in DynamicForm of ToolExecutor by ensuring extra bottom spacing.

### Patch Changes

- [#5816](https://github.com/mastra-ai/mastra/pull/5816) [`ab48c97`](https://github.com/mastra-ai/mastra/commit/ab48c979098ea571faf998a55d3a00e7acd7a715) Thanks [@dane-ai-mastra](https://github.com/apps/dane-ai-mastra)! - dependencies updates:
  - Updated dependency [`zod@^4.1.5` ↗︎](https://www.npmjs.com/package/zod/v/4.1.5) (from `^4.0.15`, in `dependencies`)

- [#5817](https://github.com/mastra-ai/mastra/pull/5817) [`dbdc91f`](https://github.com/mastra-ai/mastra/commit/dbdc91fdedba01bf2fa2e62086a89d2b8101cf8c) Thanks [@dane-ai-mastra](https://github.com/apps/dane-ai-mastra)! - dependencies updates:
  - Updated dependency [`@assistant-ui/react@^0.10.44` ↗︎](https://www.npmjs.com/package/@assistant-ui/react/v/0.10.44) (from `^0.7.91`, in `dependencies`)
  - Updated dependency [`@assistant-ui/react-markdown@^0.10.9` ↗︎](https://www.npmjs.com/package/@assistant-ui/react-markdown/v/0.10.9) (from `^0.7.21`, in `dependencies`)
  - Updated dependency [`@assistant-ui/react-syntax-highlighter@^0.10.10` ↗︎](https://www.npmjs.com/package/@assistant-ui/react-syntax-highlighter/v/0.10.10) (from `^0.7.10`, in `dependencies`)
  - Added dependency [`@assistant-ui/react-ui@^0.1.8` ↗︎](https://www.npmjs.com/package/@assistant-ui/react-ui/v/0.1.8) (to `dependencies`)
- Updated dependencies [[`ab48c97`](https://github.com/mastra-ai/mastra/commit/ab48c979098ea571faf998a55d3a00e7acd7a715), [`ab48c97`](https://github.com/mastra-ai/mastra/commit/ab48c979098ea571faf998a55d3a00e7acd7a715), [`ff89505`](https://github.com/mastra-ai/mastra/commit/ff895057c8c7e91a5535faef46c5e5391085ddfa), [`26b0d7c`](https://github.com/mastra-ai/mastra/commit/26b0d7c7cba46469351d453714e119ac7aae9da2), [`183dc95`](https://github.com/mastra-ai/mastra/commit/183dc95596f391b977bd1a2c050b8498dac74891), [`a1111e2`](https://github.com/mastra-ai/mastra/commit/a1111e24e705488adfe5e0a6f20c53bddf26cb22), [`61debef`](https://github.com/mastra-ai/mastra/commit/61debefd80ad3a7ed5737e19df6a23d40091689a), [`9beaeff`](https://github.com/mastra-ai/mastra/commit/9beaeffa4a97b1d5fd01a7f8af8708b16067f67c), [`9eee594`](https://github.com/mastra-ai/mastra/commit/9eee594e35e0ca2a650fcc33fa82009a142b9ed0), [`979912c`](https://github.com/mastra-ai/mastra/commit/979912cfd180aad53287cda08af771df26454e2c), [`7dcf4c0`](https://github.com/mastra-ai/mastra/commit/7dcf4c04f44d9345b1f8bc5d41eae3f11ac61611), [`ad78bfc`](https://github.com/mastra-ai/mastra/commit/ad78bfc4ea6a1fff140432bf4f638e01af7af668), [`48f0742`](https://github.com/mastra-ai/mastra/commit/48f0742662414610dc9a7a99d45902d059ee123d), [`0ce418a`](https://github.com/mastra-ai/mastra/commit/0ce418a1ccaa5e125d4483a9651b635046152569), [`8387952`](https://github.com/mastra-ai/mastra/commit/838795227b4edf758c84a2adf6f7fba206c27719), [`5eca5d2`](https://github.com/mastra-ai/mastra/commit/5eca5d2655788863ea0442a46c9ef5d3c6dbe0a8)]:
  - @mastra/client-js@0.11.3-alpha.4
  - @mastra/core@0.15.3-alpha.4

## 5.2.5-alpha.1

### Patch Changes

- [#7210](https://github.com/mastra-ai/mastra/pull/7210) [`87de958`](https://github.com/mastra-ai/mastra/commit/87de95832a7bdfa9ecb14473c84dc874331f1a7d) Thanks [@mfrachet](https://github.com/mfrachet)! - fix chat outline

- Updated dependencies [[`aedbbfa`](https://github.com/mastra-ai/mastra/commit/aedbbfa064124ddde039111f12629daebfea7e48), [`f643c65`](https://github.com/mastra-ai/mastra/commit/f643c651bdaf57c2343cf9dbfc499010495701fb), [`fef7375`](https://github.com/mastra-ai/mastra/commit/fef737534574f41b432a7361a285f776c3bac42b), [`e3d8fea`](https://github.com/mastra-ai/mastra/commit/e3d8feaacfb8b5c5c03c13604cc06ea2873d45fe), [`3412597`](https://github.com/mastra-ai/mastra/commit/3412597a6644c0b6bf3236d6e319ed1450c5bae8)]:
  - @mastra/core@0.15.3-alpha.3
  - @mastra/client-js@0.11.3-alpha.3

## 5.2.5-alpha.0

### Patch Changes

- [#7076](https://github.com/mastra-ai/mastra/pull/7076) [`8e4fe90`](https://github.com/mastra-ai/mastra/commit/8e4fe90605ee4dfcfd911a7f07e1355fe49205ba) Thanks [@mfrachet](https://github.com/mfrachet)! - Unify focus outlines

- [#7044](https://github.com/mastra-ai/mastra/pull/7044) [`3308c9f`](https://github.com/mastra-ai/mastra/commit/3308c9ff1da7594925d193a825f33da2880fb9c1) Thanks [@mfrachet](https://github.com/mfrachet)! - fix dev:playground command

- [#7101](https://github.com/mastra-ai/mastra/pull/7101) [`d99baf6`](https://github.com/mastra-ai/mastra/commit/d99baf6e69bbf83e9a286fbd18c47543de12cb58) Thanks [@mfrachet](https://github.com/mfrachet)! - change outline

- Updated dependencies [[`00c74e7`](https://github.com/mastra-ai/mastra/commit/00c74e73b1926be0d475693bb886fb67a22ff352), [`af90672`](https://github.com/mastra-ai/mastra/commit/af906722d8da28688882193b1e531026f9e2e81e), [`56041d0`](https://github.com/mastra-ai/mastra/commit/56041d018863a3da6b98c512e47348647c075fb3), [`5de1555`](https://github.com/mastra-ai/mastra/commit/5de15554d3d6695211945a36928f6657e76cddc9), [`1ed5a3e`](https://github.com/mastra-ai/mastra/commit/1ed5a3e19330374c4347a4237cd2f4b9ffb60376)]:
  - @mastra/core@0.15.3-alpha.0
  - @mastra/client-js@0.11.3-alpha.0

## 5.2.4

### Patch Changes

- [`c6113ed`](https://github.com/mastra-ai/mastra/commit/c6113ed7f9df297e130d94436ceee310273d6430) Thanks [@wardpeet](https://github.com/wardpeet)! - Fix peerdpes for @mastra/core

- Updated dependencies [[`c6113ed`](https://github.com/mastra-ai/mastra/commit/c6113ed7f9df297e130d94436ceee310273d6430)]:
  - @mastra/client-js@0.11.2
  - @mastra/core@0.15.2

## 5.2.3

### Patch Changes

- [`95b2aa9`](https://github.com/mastra-ai/mastra/commit/95b2aa908230919e67efcac0d69005a2d5745298) Thanks [@wardpeet](https://github.com/wardpeet)! - Fix peerdeps @mastra/core

- Updated dependencies []:
  - @mastra/core@0.15.1
  - @mastra/client-js@0.11.1

## 5.2.2

### Patch Changes

- [#6995](https://github.com/mastra-ai/mastra/pull/6995) [`681252d`](https://github.com/mastra-ai/mastra/commit/681252d20e57fcee6821377dea96cacab3bc230f) Thanks [@wardpeet](https://github.com/wardpeet)! - Improve type resolving

- [#6967](https://github.com/mastra-ai/mastra/pull/6967) [`01be5d3`](https://github.com/mastra-ai/mastra/commit/01be5d358fad8faa101e5c69dfa54562c02cc0af) Thanks [@YujohnNattrass](https://github.com/YujohnNattrass)! - Implement AI traces for server apis and client sdk

- [#6944](https://github.com/mastra-ai/mastra/pull/6944) [`a93f3ba`](https://github.com/mastra-ai/mastra/commit/a93f3ba05eef4cf17f876d61d29cf0841a9e70b7) Thanks [@wardpeet](https://github.com/wardpeet)! - Add support for zod v4

- Updated dependencies [[`0778757`](https://github.com/mastra-ai/mastra/commit/07787570e4addbd501522037bd2542c3d9e26822), [`943a7f3`](https://github.com/mastra-ai/mastra/commit/943a7f3dbc6a8ab3f9b7bc7c8a1c5b319c3d7f56), [`01be5d3`](https://github.com/mastra-ai/mastra/commit/01be5d358fad8faa101e5c69dfa54562c02cc0af), [`bf504a8`](https://github.com/mastra-ai/mastra/commit/bf504a833051f6f321d832cc7d631f3cb86d657b), [`00ef6c1`](https://github.com/mastra-ai/mastra/commit/00ef6c1d3c76708712acd3de7f39c4d6b0f3b427), [`be49354`](https://github.com/mastra-ai/mastra/commit/be493546dca540101923ec700feb31f9a13939f2), [`d591ab3`](https://github.com/mastra-ai/mastra/commit/d591ab3ecc985c1870c0db347f8d7a20f7360536), [`ba82abe`](https://github.com/mastra-ai/mastra/commit/ba82abe76e869316bb5a9c95e8ea3946f3436fae), [`727f7e5`](https://github.com/mastra-ai/mastra/commit/727f7e5086e62e0dfe3356fb6dcd8bcb420af246), [`e6f5046`](https://github.com/mastra-ai/mastra/commit/e6f50467aff317e67e8bd74c485c3fbe2a5a6db1), [`82d9f64`](https://github.com/mastra-ai/mastra/commit/82d9f647fbe4f0177320e7c05073fce88599aa95), [`2e58325`](https://github.com/mastra-ai/mastra/commit/2e58325beb170f5b92f856e27d915cd26917e5e6), [`1191ce9`](https://github.com/mastra-ai/mastra/commit/1191ce946b40ed291e7877a349f8388e3cff7e5c), [`4189486`](https://github.com/mastra-ai/mastra/commit/4189486c6718fda78347bdf4ce4d3fc33b2236e1), [`ca8ec2f`](https://github.com/mastra-ai/mastra/commit/ca8ec2f61884b9dfec5fc0d5f4f29d281ad13c01), [`9613558`](https://github.com/mastra-ai/mastra/commit/9613558e6475f4710e05d1be7553a32ee7bddc20)]:
  - @mastra/core@0.15.0
  - @mastra/client-js@0.11.0

## 5.2.2-alpha.1

### Patch Changes

- [#6995](https://github.com/mastra-ai/mastra/pull/6995) [`681252d`](https://github.com/mastra-ai/mastra/commit/681252d20e57fcee6821377dea96cacab3bc230f) Thanks [@wardpeet](https://github.com/wardpeet)! - Improve type resolving

- [#6967](https://github.com/mastra-ai/mastra/pull/6967) [`01be5d3`](https://github.com/mastra-ai/mastra/commit/01be5d358fad8faa101e5c69dfa54562c02cc0af) Thanks [@YujohnNattrass](https://github.com/YujohnNattrass)! - Implement AI traces for server apis and client sdk

- [#6944](https://github.com/mastra-ai/mastra/pull/6944) [`a93f3ba`](https://github.com/mastra-ai/mastra/commit/a93f3ba05eef4cf17f876d61d29cf0841a9e70b7) Thanks [@wardpeet](https://github.com/wardpeet)! - Add support for zod v4

- Updated dependencies [[`943a7f3`](https://github.com/mastra-ai/mastra/commit/943a7f3dbc6a8ab3f9b7bc7c8a1c5b319c3d7f56), [`01be5d3`](https://github.com/mastra-ai/mastra/commit/01be5d358fad8faa101e5c69dfa54562c02cc0af), [`00ef6c1`](https://github.com/mastra-ai/mastra/commit/00ef6c1d3c76708712acd3de7f39c4d6b0f3b427), [`be49354`](https://github.com/mastra-ai/mastra/commit/be493546dca540101923ec700feb31f9a13939f2), [`d591ab3`](https://github.com/mastra-ai/mastra/commit/d591ab3ecc985c1870c0db347f8d7a20f7360536), [`ba82abe`](https://github.com/mastra-ai/mastra/commit/ba82abe76e869316bb5a9c95e8ea3946f3436fae), [`727f7e5`](https://github.com/mastra-ai/mastra/commit/727f7e5086e62e0dfe3356fb6dcd8bcb420af246), [`82d9f64`](https://github.com/mastra-ai/mastra/commit/82d9f647fbe4f0177320e7c05073fce88599aa95), [`4189486`](https://github.com/mastra-ai/mastra/commit/4189486c6718fda78347bdf4ce4d3fc33b2236e1), [`ca8ec2f`](https://github.com/mastra-ai/mastra/commit/ca8ec2f61884b9dfec5fc0d5f4f29d281ad13c01)]:
  - @mastra/core@0.14.2-alpha.1
  - @mastra/client-js@0.11.0-alpha.1

## 5.2.2-alpha.0

### Patch Changes

- Updated dependencies [[`0778757`](https://github.com/mastra-ai/mastra/commit/07787570e4addbd501522037bd2542c3d9e26822), [`bf504a8`](https://github.com/mastra-ai/mastra/commit/bf504a833051f6f321d832cc7d631f3cb86d657b), [`e6f5046`](https://github.com/mastra-ai/mastra/commit/e6f50467aff317e67e8bd74c485c3fbe2a5a6db1), [`9613558`](https://github.com/mastra-ai/mastra/commit/9613558e6475f4710e05d1be7553a32ee7bddc20)]:
  - @mastra/core@0.14.2-alpha.0
  - @mastra/client-js@0.10.24-alpha.0

## 5.2.1

### Patch Changes

- Updated dependencies [[`6e7e120`](https://github.com/mastra-ai/mastra/commit/6e7e1207d6e8d8b838f9024f90bd10df1181ba27), [`0f00e17`](https://github.com/mastra-ai/mastra/commit/0f00e172953ccdccadb35ed3d70f5e4d89115869), [`217cd7a`](https://github.com/mastra-ai/mastra/commit/217cd7a4ce171e9a575c41bb8c83300f4db03236), [`a5a23d9`](https://github.com/mastra-ai/mastra/commit/a5a23d981920d458dc6078919992a5338931ef02)]:
  - @mastra/core@0.14.1
  - @mastra/client-js@0.10.23

## 5.2.1-alpha.0

### Patch Changes

- Updated dependencies [[`6e7e120`](https://github.com/mastra-ai/mastra/commit/6e7e1207d6e8d8b838f9024f90bd10df1181ba27), [`a5a23d9`](https://github.com/mastra-ai/mastra/commit/a5a23d981920d458dc6078919992a5338931ef02)]:
  - @mastra/core@0.14.1-alpha.0
  - @mastra/client-js@0.10.23-alpha.0

## 5.2.0

### Minor Changes

- 03997ae: Update peer deps of core

### Patch Changes

- dd702eb: Fix default in playground
- 6313063: Implement model switcher in playground
- 1d59515: Add options to playground based on modelVersion
- 9ce22c5: Fix swagger-ui link
- 36928f0: Use right icon for anthropic in model switcher
- 2454423: Agentic loop and streaming workflow: generateVNext and streamVNext
- 398ed81: PG types
- Updated dependencies [227c7e6]
- Updated dependencies [0a7f675]
- Updated dependencies [12cae67]
- Updated dependencies [fd3a3eb]
- Updated dependencies [6faaee5]
- Updated dependencies [4232b14]
- Updated dependencies [6313063]
- Updated dependencies [a89de7e]
- Updated dependencies [5a37d0c]
- Updated dependencies [4bde0cb]
- Updated dependencies [1d59515]
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
  - @mastra/client-js@0.10.22

## 5.2.0-alpha.6

### Minor Changes

- 03997ae: Update peer deps of core

### Patch Changes

- @mastra/core@0.14.0-alpha.7
- @mastra/client-js@0.10.22-alpha.7

## 5.1.21-alpha.5

### Patch Changes

- 9ce22c5: Fix swagger-ui link
- Updated dependencies [ad888a2]
- Updated dependencies [481751d]
- Updated dependencies [194e395]
  - @mastra/core@0.14.0-alpha.6
  - @mastra/client-js@0.10.22-alpha.6

## 5.1.21-alpha.4

### Patch Changes

- dd702eb: Fix default in playground

## 5.1.21-alpha.3

### Patch Changes

- 1d59515: Add options to playground based on modelVersion
- 398ed81: PG types
- b78b95b: Support generateVNext in playground
- Updated dependencies [0a7f675]
- Updated dependencies [12cae67]
- Updated dependencies [5a37d0c]
- Updated dependencies [4bde0cb]
- Updated dependencies [1a80071]
- Updated dependencies [36a3be8]
- Updated dependencies [1d59515]
- Updated dependencies [361757b]
- Updated dependencies [2bb9955]
- Updated dependencies [2454423]
- Updated dependencies [a44d91e]
- Updated dependencies [dfb91e9]
- Updated dependencies [a741dde]
- Updated dependencies [7cb3fc0]
- Updated dependencies [195eabb]
- Updated dependencies [b78b95b]
  - @mastra/core@0.14.0-alpha.4
  - @mastra/client-js@0.10.22-alpha.4

## 5.1.21-alpha.2

### Patch Changes

- 36928f0: Use right icon for anthropic in model switcher
- Updated dependencies [227c7e6]
- Updated dependencies [fd3a3eb]
- Updated dependencies [a8f129d]
  - @mastra/core@0.14.0-alpha.3
  - @mastra/client-js@0.10.22-alpha.3

## 5.1.21-alpha.1

### Patch Changes

- 6313063: Implement model switcher in playground
- Updated dependencies [6faaee5]
- Updated dependencies [4232b14]
- Updated dependencies [6313063]
- Updated dependencies [a89de7e]
- Updated dependencies [cf4f357]
- Updated dependencies [a722c0b]
- Updated dependencies [3b5fec7]
  - @mastra/core@0.14.0-alpha.1
  - @mastra/client-js@0.10.22-alpha.1

## 5.1.21-alpha.0

### Patch Changes

- Updated dependencies [c30bca8]
  - @mastra/core@0.13.3-alpha.0
  - @mastra/client-js@0.10.22-alpha.0

## 5.1.20

### Patch Changes

- 0d32203: dependencies updates:
  - Updated dependency [`zustand@^5.0.7` ↗︎](https://www.npmjs.com/package/zustand/v/5.0.7) (from `^5.0.6`, in `dependencies`)
- c6d2603: Properly set baseUrl in playground when user sets the host or port in Mastra instance.
- 7aad750: Fix tool ui showing after message when chat is refreshed
- Updated dependencies [d5330bf]
- Updated dependencies [2e74797]
- Updated dependencies [8388649]
- Updated dependencies [a239d41]
- Updated dependencies [dd94a26]
- Updated dependencies [3ba6772]
- Updated dependencies [96169cc]
- Updated dependencies [b5cf2a3]
- Updated dependencies [2fff911]
- Updated dependencies [b32c50d]
- Updated dependencies [63449d0]
- Updated dependencies [121a3f8]
- Updated dependencies [ce04175]
- Updated dependencies [ec510e7]
  - @mastra/core@0.13.2
  - @mastra/client-js@0.10.21

## 5.1.20-alpha.1

### Patch Changes

- 0d32203: dependencies updates:
  - Updated dependency [`zustand@^5.0.7` ↗︎](https://www.npmjs.com/package/zustand/v/5.0.7) (from `^5.0.6`, in `dependencies`)
- c6d2603: Properly set baseUrl in playground when user sets the host or port in Mastra instance.
- Updated dependencies [d5330bf]
- Updated dependencies [a239d41]
- Updated dependencies [96169cc]
- Updated dependencies [b32c50d]
- Updated dependencies [121a3f8]
- Updated dependencies [ce04175]
- Updated dependencies [ec510e7]
  - @mastra/core@0.13.2-alpha.2
  - @mastra/client-js@0.10.21-alpha.2

## 5.1.20-alpha.0

### Patch Changes

- 7aad750: Fix tool ui showing after message when chat is refreshed
- Updated dependencies [8388649]
- Updated dependencies [dd94a26]
- Updated dependencies [3ba6772]
- Updated dependencies [2fff911]
  - @mastra/core@0.13.2-alpha.0
  - @mastra/client-js@0.10.21-alpha.0

## 5.1.19

### Patch Changes

- Updated dependencies [cd0042e]
  - @mastra/core@0.13.1
  - @mastra/client-js@0.10.20

## 5.1.19-alpha.0

### Patch Changes

- Updated dependencies [cd0042e]
  - @mastra/core@0.13.1-alpha.0
  - @mastra/client-js@0.10.20-alpha.0

## 5.1.18

### Patch Changes

- 0ebfe8a: dependencies updates:
  - Updated dependency [`motion@^12.23.12` ↗︎](https://www.npmjs.com/package/motion/v/12.23.12) (from `^12.23.9`, in `dependencies`)
- f5853be: Added a preview button that opens a modal, rendering the markdown in the working memory text area
- ea0c5f2: Update to support new scorer api
- Updated dependencies [cb36de0]
- Updated dependencies [d0496e6]
- Updated dependencies [a82b851]
- Updated dependencies [ea0c5f2]
- Updated dependencies [41a0a0e]
- Updated dependencies [2871020]
- Updated dependencies [42dfc48]
- Updated dependencies [94f4812]
- Updated dependencies [e202b82]
- Updated dependencies [e00f6a0]
- Updated dependencies [4a406ec]
- Updated dependencies [b0e43c1]
- Updated dependencies [5d377e5]
- Updated dependencies [1fb812e]
- Updated dependencies [35c5798]
  - @mastra/core@0.13.0
  - @mastra/client-js@0.10.19

## 5.1.18-alpha.3

### Patch Changes

- f5853be: Added a preview button that opens a modal, rendering the markdown in the working memory text area

## 5.1.18-alpha.2

### Patch Changes

- 0ebfe8a: dependencies updates:
  - Updated dependency [`motion@^12.23.12` ↗︎](https://www.npmjs.com/package/motion/v/12.23.12) (from `^12.23.9`, in `dependencies`)
- Updated dependencies [cb36de0]
- Updated dependencies [a82b851]
- Updated dependencies [41a0a0e]
- Updated dependencies [2871020]
- Updated dependencies [42dfc48]
- Updated dependencies [4a406ec]
- Updated dependencies [5d377e5]
  - @mastra/core@0.13.0-alpha.2
  - @mastra/client-js@0.10.19-alpha.2

## 5.1.18-alpha.1

### Patch Changes

- ea0c5f2: Update to support new scorer api
- Updated dependencies [ea0c5f2]
- Updated dependencies [b0e43c1]
- Updated dependencies [1fb812e]
- Updated dependencies [35c5798]
  - @mastra/core@0.13.0-alpha.1
  - @mastra/client-js@0.10.19-alpha.1

## 5.1.18-alpha.0

### Patch Changes

- Updated dependencies [94f4812]
- Updated dependencies [e202b82]
- Updated dependencies [e00f6a0]
  - @mastra/core@0.12.2-alpha.0
  - @mastra/client-js@0.10.19-alpha.0

## 5.1.17

### Patch Changes

- d8e8349: dependencies updates:
  - Updated dependency [`@xyflow/react@^12.8.2` ↗︎](https://www.npmjs.com/package/@xyflow/react/v/12.8.2) (from `^12.8.1`, in `dependencies`)
- c8924b6: dependencies updates:
  - Updated dependency [`motion@^12.23.9` ↗︎](https://www.npmjs.com/package/motion/v/12.23.9) (from `^12.23.0`, in `dependencies`)
- Updated dependencies [6690a16]
- Updated dependencies [33dcb07]
- Updated dependencies [d0d9500]
- Updated dependencies [d30b1a0]
- Updated dependencies [bff87f7]
- Updated dependencies [b4a8df0]
  - @mastra/client-js@0.10.18
  - @mastra/core@0.12.1

## 5.1.17-alpha.0

### Patch Changes

- d8e8349: dependencies updates:
  - Updated dependency [`@xyflow/react@^12.8.2` ↗︎](https://www.npmjs.com/package/@xyflow/react/v/12.8.2) (from `^12.8.1`, in `dependencies`)
- c8924b6: dependencies updates:
  - Updated dependency [`motion@^12.23.9` ↗︎](https://www.npmjs.com/package/motion/v/12.23.9) (from `^12.23.0`, in `dependencies`)
- Updated dependencies [6690a16]
- Updated dependencies [33dcb07]
- Updated dependencies [d30b1a0]
- Updated dependencies [bff87f7]
- Updated dependencies [b4a8df0]
  - @mastra/client-js@0.10.18-alpha.0
  - @mastra/core@0.12.1-alpha.0

## 5.1.16

### Patch Changes

- f873f3a: dependencies updates:
  - Updated dependency [`zustand@^5.0.6` ↗︎](https://www.npmjs.com/package/zustand/v/5.0.6) (from `^5.0.5`, in `dependencies`)
- f442224: speech to text using voice config
- 6336993: Fix workflow input form overflow
- f42c4c2: update peer deps for packages to latest core range
- 89d2f4e: add TTS to the playground
- Updated dependencies [510e2c8]
- Updated dependencies [2f72fb2]
- Updated dependencies [27cc97a]
- Updated dependencies [aa2715b]
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
- Updated dependencies [6bd354c]
- Updated dependencies [23a6a7c]
- Updated dependencies [cda801d]
- Updated dependencies [a77c823]
- Updated dependencies [ff9c125]
- Updated dependencies [09bca64]
- Updated dependencies [b641ba3]
- Updated dependencies [9802f42]
- Updated dependencies [1ac8f6b]
- Updated dependencies [b8efbb9]
- Updated dependencies [71466e7]
- Updated dependencies [0c99fbe]
  - @mastra/core@0.12.0
  - @mastra/client-js@0.10.17

## 5.1.16-alpha.2

### Patch Changes

- f42c4c2: update peer deps for packages to latest core range
  - @mastra/core@0.12.0-alpha.5
  - @mastra/client-js@0.10.17-alpha.5

## 5.1.16-alpha.1

### Patch Changes

- 6336993: Fix workflow input form overflow
- Updated dependencies [e0f73c6]
- Updated dependencies [cda801d]
- Updated dependencies [a77c823]
  - @mastra/core@0.12.0-alpha.1
  - @mastra/client-js@0.10.17-alpha.1

## 5.1.16-alpha.0

### Patch Changes

- f873f3a: dependencies updates:
  - Updated dependency [`zustand@^5.0.6` ↗︎](https://www.npmjs.com/package/zustand/v/5.0.6) (from `^5.0.5`, in `dependencies`)
- f442224: speech to text using voice config
- 89d2f4e: add TTS to the playground
- Updated dependencies [510e2c8]
- Updated dependencies [2f72fb2]
- Updated dependencies [3f89307]
- Updated dependencies [9eda7d4]
- Updated dependencies [9d49408]
- Updated dependencies [2ecf658]
- Updated dependencies [7a7754f]
- Updated dependencies [fc92d80]
- Updated dependencies [6bd354c]
- Updated dependencies [23a6a7c]
- Updated dependencies [09bca64]
- Updated dependencies [b641ba3]
  - @mastra/core@0.12.0-alpha.0
  - @mastra/client-js@0.10.17-alpha.0

## 5.1.15

### Patch Changes

- ce088f5: Update all peerdeps to latest core
  - @mastra/core@0.11.1
  - @mastra/client-js@0.10.16

## 5.1.14

### Patch Changes

- dd2a4c9: change the way we start the dev process of playground
- af1f902: share thread list between agent, network and cloud
- 8f89bcd: fix traces pagination + sharing trace view with cloud
- 0bf0bc8: fix link in shared components + add e2e tests
- f6c4d75: fix date picker on change
- 59f0dcd: Add light background color for step statuses
- 35b1155: Added "Semantic recall search" to playground UI chat sidebar, to search for messages and find them in the chat list
- 8aa97c7: Show docs link in place of semantic recall + working memory in playground if they're not enabled
- cf8d497: factorize tabs component between cloud and core
- 7827943: Handle streaming large data
- 808b493: wrap runtime context with tooltip provider for usage in cloud
- 09464dd: Share AgentMetadata component with cloud
- 65e3395: Add Scores playground-ui and add scorer hooks
- 80692d5: refactor: sharing only the UI and not data fetching for traces
- 80c2b06: Fix agent chat stop button to cancel stream/generate reqs in the playground
- Updated dependencies [4832752]
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
- Updated dependencies [80c2b06]
- Updated dependencies [7ba91fa]
- Updated dependencies [6f6e651]
  - @mastra/client-js@0.10.15
  - @mastra/core@0.11.0

## 5.1.14-alpha.3

### Patch Changes

- 8aa97c7: Show docs link in place of semantic recall + working memory in playground if they're not enabled

## 5.1.14-alpha.2

### Patch Changes

- dd2a4c9: change the way we start the dev process of playground
- af1f902: share thread list between agent, network and cloud
- f6c4d75: fix date picker on change
- 35b1155: Added "Semantic recall search" to playground UI chat sidebar, to search for messages and find them in the chat list
- 09464dd: Share AgentMetadata component with cloud
- 65e3395: Add Scores playground-ui and add scorer hooks
- 80c2b06: Fix agent chat stop button to cancel stream/generate reqs in the playground
- Updated dependencies [4832752]
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
- Updated dependencies [80c2b06]
- Updated dependencies [7ba91fa]
- Updated dependencies [6f6e651]
  - @mastra/client-js@0.10.15-alpha.2
  - @mastra/core@0.11.0-alpha.2

## 5.1.14-alpha.1

### Patch Changes

- 8f89bcd: fix traces pagination + sharing trace view with cloud
- 59f0dcd: Add light background color for step statuses
- cf8d497: factorize tabs component between cloud and core
- 80692d5: refactor: sharing only the UI and not data fetching for traces
  - @mastra/core@0.11.0-alpha.1
  - @mastra/client-js@0.10.15-alpha.1

## 5.1.14-alpha.0

### Patch Changes

- 0bf0bc8: fix link in shared components + add e2e tests
- 7827943: Handle streaming large data
- 808b493: wrap runtime context with tooltip provider for usage in cloud
- Updated dependencies [7827943]
- Updated dependencies [bf1e7e7]
- Updated dependencies [cbddd18]
  - @mastra/client-js@0.10.15-alpha.0
  - @mastra/core@0.11.0-alpha.0

## 5.1.13

### Patch Changes

- 5130bcb: dependencies updates:
  - Updated dependency [`swr@^2.3.4` ↗︎](https://www.npmjs.com/package/swr/v/2.3.4) (from `^2.3.3`, in `dependencies`)
- 984887a: dependencies updates:
  - Updated dependency [`prettier@^3.6.2` ↗︎](https://www.npmjs.com/package/prettier/v/3.6.2) (from `^3.5.3`, in `dependencies`)
- 593631d: allow to pass ref to the link abstraction
- 5237998: Fix foreach output
- 1aa60b1: Pipe runtimeContext to vNext network agent stream and generate steps, wire up runtimeContext for vNext Networks in cliet SDK & playground
- d49334d: export tool list for usage in cloud
- 9cdfcb5: fix infinite rerenders on agents table + share runtime context for cloud
- 794d9f3: Fix thread creation in playground
- aa9528a: Display reasoning in playground
- 45174f3: share network list between core and cloud
- 48f5532: export workflow list for usage in cloud
- 626b0f4: [Cloud-126] Working Memory Playground - Added working memory to playground to allow users to view/edit working memory
- e1d0080: abstract Link component between cloud and core
- f9b1508: add the same agent table as in cloud and export it from the playground
- dfbeec6: Fix navigation to vnext AgentNetwork agents
- Updated dependencies [31f9f6b]
- Updated dependencies [0b56518]
- Updated dependencies [db5cc15]
- Updated dependencies [2ba5b76]
- Updated dependencies [5237998]
- Updated dependencies [c3a30de]
- Updated dependencies [37c1acd]
- Updated dependencies [1aa60b1]
- Updated dependencies [89ec9d4]
- Updated dependencies [cf3a184]
- Updated dependencies [d6bfd60]
- Updated dependencies [626b0f4]
- Updated dependencies [c22a91f]
- Updated dependencies [f7403ab]
- Updated dependencies [6c89d7f]
  - @mastra/client-js@0.10.14
  - @mastra/core@0.10.15

## 5.1.13-alpha.2

### Patch Changes

- 794d9f3: Fix thread creation in playground
- dfbeec6: Fix navigation to vnext AgentNetwork agents

## 5.1.13-alpha.1

### Patch Changes

- d49334d: export tool list for usage in cloud
- 9cdfcb5: fix infinite rerenders on agents table + share runtime context for cloud
- 45174f3: share network list between core and cloud
- 48f5532: export workflow list for usage in cloud
- Updated dependencies [0b56518]
- Updated dependencies [2ba5b76]
- Updated dependencies [c3a30de]
- Updated dependencies [cf3a184]
- Updated dependencies [d6bfd60]
  - @mastra/core@0.10.15-alpha.1
  - @mastra/client-js@0.10.14-alpha.1

## 5.1.13-alpha.0

### Patch Changes

- 5130bcb: dependencies updates:
  - Updated dependency [`swr@^2.3.4` ↗︎](https://www.npmjs.com/package/swr/v/2.3.4) (from `^2.3.3`, in `dependencies`)
- 984887a: dependencies updates:
  - Updated dependency [`prettier@^3.6.2` ↗︎](https://www.npmjs.com/package/prettier/v/3.6.2) (from `^3.5.3`, in `dependencies`)
- 593631d: allow to pass ref to the link abstraction
- 5237998: Fix foreach output
- 1aa60b1: Pipe runtimeContext to vNext network agent stream and generate steps, wire up runtimeContext for vNext Networks in cliet SDK & playground
- aa9528a: Display reasoning in playground
- 626b0f4: [Cloud-126] Working Memory Playground - Added working memory to playground to allow users to view/edit working memory
- e1d0080: abstract Link component between cloud and core
- f9b1508: add the same agent table as in cloud and export it from the playground
- Updated dependencies [31f9f6b]
- Updated dependencies [db5cc15]
- Updated dependencies [5237998]
- Updated dependencies [37c1acd]
- Updated dependencies [1aa60b1]
- Updated dependencies [89ec9d4]
- Updated dependencies [626b0f4]
- Updated dependencies [c22a91f]
- Updated dependencies [f7403ab]
- Updated dependencies [6c89d7f]
  - @mastra/client-js@0.10.14-alpha.0
  - @mastra/core@0.10.15-alpha.0

## 5.1.12

### Patch Changes

- 640f47e: move agent model settings into agent settings
- Updated dependencies [9468be4]
- Updated dependencies [b4a9811]
- Updated dependencies [4d5583d]
- Updated dependencies [44731a4]
  - @mastra/client-js@0.10.11
  - @mastra/core@0.10.12

## 5.1.12-alpha.0

### Patch Changes

- 640f47e: move agent model settings into agent settings
- Updated dependencies [9468be4]
- Updated dependencies [b4a9811]
- Updated dependencies [44731a4]
  - @mastra/client-js@0.10.11-alpha.0
  - @mastra/core@0.10.12-alpha.0

## 5.1.11

### Patch Changes

- 7fb0909: dependencies updates:
  - Updated dependency [`@dagrejs/dagre@^1.1.5` ↗︎](https://www.npmjs.com/package/@dagrejs/dagre/v/1.1.5) (from `^1.1.4`, in `dependencies`)
- 05ba777: dependencies updates:
  - Updated dependency [`@xyflow/react@^12.8.1` ↗︎](https://www.npmjs.com/package/@xyflow/react/v/12.8.1) (from `^12.6.4`, in `dependencies`)
- 7ccbf43: dependencies updates:
  - Updated dependency [`motion@^12.23.0` ↗︎](https://www.npmjs.com/package/motion/v/12.23.0) (from `^12.16.0`, in `dependencies`)
- 4b4b339: dependencies updates:
  - Updated dependency [`@uiw/react-codemirror@^4.23.14` ↗︎](https://www.npmjs.com/package/@uiw/react-codemirror/v/4.23.14) (from `^4.23.13`, in `dependencies`)
- f457d86: reset localstorage when resetting model settings
- 8722d53: Fix multi modal remaining steps
- 4219597: add JSON input close to form input
- b790fd1: Use SerializedStepFlowEntry in playground
- c1cceea: Bump peerdeps of @matra/core
- a7a836a: Highlight send event button
- Updated dependencies [2873c7f]
- Updated dependencies [1c1c6a1]
- Updated dependencies [f8ce2cc]
- Updated dependencies [8c846b6]
- Updated dependencies [c7bbf1e]
- Updated dependencies [8722d53]
- Updated dependencies [565cc0c]
- Updated dependencies [b790fd1]
- Updated dependencies [132027f]
- Updated dependencies [0c85311]
- Updated dependencies [d7ed04d]
- Updated dependencies [18da791]
- Updated dependencies [cb16baf]
- Updated dependencies [f36e4f1]
- Updated dependencies [7f6e403]
  - @mastra/core@0.10.11
  - @mastra/client-js@0.10.10

## 5.1.11-alpha.4

### Patch Changes

- c1cceea: Bump peerdeps of @matra/core
  - @mastra/core@0.10.11-alpha.4
  - @mastra/client-js@0.10.10-alpha.4

## 5.1.11-alpha.3

### Patch Changes

- f457d86: reset localstorage when resetting model settings
- 8722d53: Fix multi modal remaining steps
- Updated dependencies [c7bbf1e]
- Updated dependencies [8722d53]
- Updated dependencies [132027f]
- Updated dependencies [0c85311]
- Updated dependencies [cb16baf]
  - @mastra/core@0.10.11-alpha.3
  - @mastra/client-js@0.10.10-alpha.3

## 5.1.11-alpha.2

### Patch Changes

- 7fb0909: dependencies updates:
  - Updated dependency [`@dagrejs/dagre@^1.1.5` ↗︎](https://www.npmjs.com/package/@dagrejs/dagre/v/1.1.5) (from `^1.1.4`, in `dependencies`)
- 05ba777: dependencies updates:
  - Updated dependency [`@xyflow/react@^12.8.1` ↗︎](https://www.npmjs.com/package/@xyflow/react/v/12.8.1) (from `^12.6.4`, in `dependencies`)
- 7ccbf43: dependencies updates:
  - Updated dependency [`motion@^12.23.0` ↗︎](https://www.npmjs.com/package/motion/v/12.23.0) (from `^12.16.0`, in `dependencies`)
- 4b4b339: dependencies updates:
  - Updated dependency [`@uiw/react-codemirror@^4.23.14` ↗︎](https://www.npmjs.com/package/@uiw/react-codemirror/v/4.23.14) (from `^4.23.13`, in `dependencies`)
- 4219597: add JSON input close to form input
- Updated dependencies [2873c7f]
- Updated dependencies [1c1c6a1]
- Updated dependencies [565cc0c]
- Updated dependencies [18da791]
  - @mastra/core@0.10.11-alpha.2
  - @mastra/client-js@0.10.10-alpha.2

## 5.1.11-alpha.1

### Patch Changes

- a7a836a: Highlight send event button
- Updated dependencies [7f6e403]
  - @mastra/core@0.10.11-alpha.1
  - @mastra/client-js@0.10.10-alpha.1

## 5.1.11-alpha.0

### Patch Changes

- b790fd1: Use SerializedStepFlowEntry in playground
- Updated dependencies [f8ce2cc]
- Updated dependencies [8c846b6]
- Updated dependencies [b790fd1]
- Updated dependencies [d7ed04d]
- Updated dependencies [f36e4f1]
  - @mastra/core@0.10.11-alpha.0
  - @mastra/client-js@0.10.10-alpha.0

## 5.1.10

### Patch Changes

- 6997af1: add send event to server, deployer, client-js and playground-ui
- 45f0dba: Display too-call finish reason error in playground
- Updated dependencies [b60f510]
- Updated dependencies [6997af1]
- Updated dependencies [4d3fbdf]
  - @mastra/client-js@0.10.9
  - @mastra/core@0.10.10

## 5.1.10-alpha.1

### Patch Changes

- 6997af1: add send event to server, deployer, client-js and playground-ui
- Updated dependencies [b60f510]
- Updated dependencies [6997af1]
  - @mastra/client-js@0.10.9-alpha.1
  - @mastra/core@0.10.10-alpha.1

## 5.1.10-alpha.0

### Patch Changes

- 45f0dba: Display too-call finish reason error in playground
- Updated dependencies [4d3fbdf]
  - @mastra/core@0.10.10-alpha.0
  - @mastra/client-js@0.10.9-alpha.0

## 5.1.9

### Patch Changes

- 4e06e3f: timing not displayed correctly in traces
- 7e801dd: [MASTRA-4118] fixes issue with agent network loopStream where subsequent messages aren't present in playground on refresh
- a606c75: show right suspend schema for nested workflow on playground
- 1760a1c: Use workflow stream in playground instead of watch
- 038e5ae: Add cancel workflow run
- 81a1b3b: Update peerdeps
- ac369c6: Show resume data on workflow graph
- 976a62b: remove persistence capabilities in model settings components
- 4e809ad: Visualizations for .sleep()/.sleepUntil()/.waitForEvent()
- 57929df: [MASTRA-4143[ change message-list and agent network display
- f78f399: Make AgentModelSettings shareable between cloud and playground
- Updated dependencies [9dda1ac]
- Updated dependencies [9047bda]
- Updated dependencies [c984582]
- Updated dependencies [7e801dd]
- Updated dependencies [a606c75]
- Updated dependencies [7aa70a4]
- Updated dependencies [764f86a]
- Updated dependencies [1760a1c]
- Updated dependencies [038e5ae]
- Updated dependencies [7dda16a]
- Updated dependencies [5ebfcdd]
- Updated dependencies [b2d0c91]
- Updated dependencies [4e809ad]
- Updated dependencies [57929df]
- Updated dependencies [7e801dd]
- Updated dependencies [b7852ed]
- Updated dependencies [6320a61]
  - @mastra/core@0.10.9
  - @mastra/client-js@0.10.8

## 5.1.9-alpha.0

### Patch Changes

- 4e06e3f: timing not displayed correctly in traces
- 7e801dd: [MASTRA-4118] fixes issue with agent network loopStream where subsequent messages aren't present in playground on refresh
- a606c75: show right suspend schema for nested workflow on playground
- 1760a1c: Use workflow stream in playground instead of watch
- 038e5ae: Add cancel workflow run
- 81a1b3b: Update peerdeps
- ac369c6: Show resume data on workflow graph
- 976a62b: remove persistence capabilities in model settings components
- 4e809ad: Visualizations for .sleep()/.sleepUntil()/.waitForEvent()
- 57929df: [MASTRA-4143[ change message-list and agent network display
- f78f399: Make AgentModelSettings shareable between cloud and playground
- Updated dependencies [9dda1ac]
- Updated dependencies [9047bda]
- Updated dependencies [c984582]
- Updated dependencies [7e801dd]
- Updated dependencies [a606c75]
- Updated dependencies [7aa70a4]
- Updated dependencies [764f86a]
- Updated dependencies [1760a1c]
- Updated dependencies [038e5ae]
- Updated dependencies [7dda16a]
- Updated dependencies [5ebfcdd]
- Updated dependencies [b2d0c91]
- Updated dependencies [4e809ad]
- Updated dependencies [57929df]
- Updated dependencies [7e801dd]
- Updated dependencies [b7852ed]
- Updated dependencies [6320a61]
  - @mastra/core@0.10.9-alpha.0
  - @mastra/client-js@0.10.8-alpha.0

## 5.1.8

### Patch Changes

- a344ac7: Fix tool streaming in agent network
- Updated dependencies [b8f16b2]
- Updated dependencies [3e04487]
- Updated dependencies [a344ac7]
- Updated dependencies [dc4ca0a]
  - @mastra/core@0.10.8
  - @mastra/client-js@0.10.7

## 5.1.8-alpha.1

### Patch Changes

- Updated dependencies [b8f16b2]
- Updated dependencies [3e04487]
- Updated dependencies [dc4ca0a]
  - @mastra/core@0.10.8-alpha.1
  - @mastra/client-js@0.10.7-alpha.1

## 5.1.8-alpha.0

### Patch Changes

- a344ac7: Fix tool streaming in agent network
- Updated dependencies [a344ac7]
  - @mastra/client-js@0.10.7-alpha.0
  - @mastra/core@0.10.8-alpha.0

## 5.1.7

### Patch Changes

- 8e1b6e9: dependencies updates:
  - Updated dependency [`zod@^3.25.67` ↗︎](https://www.npmjs.com/package/zod/v/3.25.67) (from `^3.25.57`, in `dependencies`)
- d569c16: dependencies updates:
  - Updated dependency [`react-code-block@1.1.3` ↗︎](https://www.npmjs.com/package/react-code-block/v/1.1.3) (from `1.1.1`, in `dependencies`)
- b9f5599: dependencies updates:
  - Updated dependency [`@codemirror/lang-json@^6.0.2` ↗︎](https://www.npmjs.com/package/@codemirror/lang-json/v/6.0.2) (from `^6.0.1`, in `dependencies`)
- 5af21a8: fix: remove final output on workflows for now
- 5d74aab: vNext network in playground
- 9102d89: Fix final output not showing on playground for previously suspended steps
- 21ffb97: Make dynamic form handle schema better
- be3d5a3: Remove recharts and ramada (unused deps)
- Updated dependencies [8e1b6e9]
- Updated dependencies [15e9d26]
- Updated dependencies [d1baedb]
- Updated dependencies [d8f2d19]
- Updated dependencies [9bf1d55]
- Updated dependencies [4d21bf2]
- Updated dependencies [07d6d88]
- Updated dependencies [9d52b17]
- Updated dependencies [2097952]
- Updated dependencies [18a5d59]
- Updated dependencies [792c4c0]
- Updated dependencies [5d74aab]
- Updated dependencies [5d74aab]
- Updated dependencies [bee3fe4]
- Updated dependencies [a8b194f]
- Updated dependencies [4fb0cc2]
- Updated dependencies [d2a7a31]
- Updated dependencies [502fe05]
- Updated dependencies [144eb0b]
- Updated dependencies [8ba1b51]
- Updated dependencies [4efcfa0]
- Updated dependencies [c0d41f6]
- Updated dependencies [0e17048]
  - @mastra/client-js@0.10.6
  - @mastra/core@0.10.7

## 5.1.7-alpha.7

### Patch Changes

- Updated dependencies [c0d41f6]
  - @mastra/client-js@0.10.6-alpha.6

## 5.1.7-alpha.6

### Patch Changes

- b9f5599: dependencies updates:
  - Updated dependency [`@codemirror/lang-json@^6.0.2` ↗︎](https://www.npmjs.com/package/@codemirror/lang-json/v/6.0.2) (from `^6.0.1`, in `dependencies`)
- 5af21a8: fix: remove final output on workflows for now
- Updated dependencies [bee3fe4]
  - @mastra/client-js@0.10.6-alpha.5
  - @mastra/core@0.10.7-alpha.5

## 5.1.7-alpha.5

### Patch Changes

- d569c16: dependencies updates:
  - Updated dependency [`react-code-block@1.1.3` ↗︎](https://www.npmjs.com/package/react-code-block/v/1.1.3) (from `1.1.1`, in `dependencies`)

## 5.1.7-alpha.4

### Patch Changes

- Updated dependencies [a8b194f]
  - @mastra/core@0.10.7-alpha.4
  - @mastra/client-js@0.10.6-alpha.4

## 5.1.7-alpha.3

### Patch Changes

- Updated dependencies [18a5d59]
- Updated dependencies [792c4c0]
- Updated dependencies [502fe05]
- Updated dependencies [4efcfa0]
  - @mastra/client-js@0.10.6-alpha.3
  - @mastra/core@0.10.7-alpha.3

## 5.1.7-alpha.2

### Patch Changes

- 8e1b6e9: dependencies updates:
  - Updated dependency [`zod@^3.25.67` ↗︎](https://www.npmjs.com/package/zod/v/3.25.67) (from `^3.25.57`, in `dependencies`)
- 5d74aab: vNext network in playground
- be3d5a3: Remove recharts and ramada (unused deps)
- Updated dependencies [8e1b6e9]
- Updated dependencies [15e9d26]
- Updated dependencies [9bf1d55]
- Updated dependencies [07d6d88]
- Updated dependencies [5d74aab]
- Updated dependencies [5d74aab]
- Updated dependencies [144eb0b]
  - @mastra/client-js@0.10.6-alpha.2
  - @mastra/core@0.10.7-alpha.2

## 5.1.7-alpha.1

### Patch Changes

- 21ffb97: Make dynamic form handle schema better
- Updated dependencies [d1baedb]
- Updated dependencies [4d21bf2]
- Updated dependencies [2097952]
- Updated dependencies [4fb0cc2]
- Updated dependencies [d2a7a31]
- Updated dependencies [0e17048]
  - @mastra/core@0.10.7-alpha.1
  - @mastra/client-js@0.10.6-alpha.1

## 5.1.7-alpha.0

### Patch Changes

- 9102d89: Fix final output not showing on playground for previously suspended steps
- Updated dependencies [d8f2d19]
- Updated dependencies [9d52b17]
- Updated dependencies [8ba1b51]
  - @mastra/core@0.10.7-alpha.0
  - @mastra/client-js@0.10.6-alpha.0

## 5.1.6

### Patch Changes

- 63f6b7d: dependencies updates:
  - Updated dependency [`@ai-sdk/ui-utils@^1.2.11` ↗︎](https://www.npmjs.com/package/@ai-sdk/ui-utils/v/1.2.11) (from `^1.1.19`, in `dependencies`)
  - Updated dependency [`@autoform/core@^2.2.0` ↗︎](https://www.npmjs.com/package/@autoform/core/v/2.2.0) (from `^2.1.0`, in `dependencies`)
  - Updated dependency [`@autoform/react@^3.1.0` ↗︎](https://www.npmjs.com/package/@autoform/react/v/3.1.0) (from `^3.0.0`, in `dependencies`)
  - Updated dependency [`@autoform/zod@^2.2.0` ↗︎](https://www.npmjs.com/package/@autoform/zod/v/2.2.0) (from `^2.1.0`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-avatar@^1.1.10` ↗︎](https://www.npmjs.com/package/@radix-ui/react-avatar/v/1.1.10) (from `^1.1.3`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-checkbox@^1.3.2` ↗︎](https://www.npmjs.com/package/@radix-ui/react-checkbox/v/1.3.2) (from `^1.1.4`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-collapsible@^1.1.11` ↗︎](https://www.npmjs.com/package/@radix-ui/react-collapsible/v/1.1.11) (from `^1.1.3`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-dialog@^1.1.14` ↗︎](https://www.npmjs.com/package/@radix-ui/react-dialog/v/1.1.14) (from `^1.1.6`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-label@^2.1.7` ↗︎](https://www.npmjs.com/package/@radix-ui/react-label/v/2.1.7) (from `^2.1.2`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-popover@^1.1.14` ↗︎](https://www.npmjs.com/package/@radix-ui/react-popover/v/1.1.14) (from `^1.1.6`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-scroll-area@^1.2.9` ↗︎](https://www.npmjs.com/package/@radix-ui/react-scroll-area/v/1.2.9) (from `^1.2.3`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-select@^2.2.5` ↗︎](https://www.npmjs.com/package/@radix-ui/react-select/v/2.2.5) (from `^2.1.6`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-slider@^1.3.5` ↗︎](https://www.npmjs.com/package/@radix-ui/react-slider/v/1.3.5) (from `^1.2.3`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-slot@^1.2.3` ↗︎](https://www.npmjs.com/package/@radix-ui/react-slot/v/1.2.3) (from `^1.1.2`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-switch@^1.2.5` ↗︎](https://www.npmjs.com/package/@radix-ui/react-switch/v/1.2.5) (from `^1.1.3`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-tabs@^1.1.12` ↗︎](https://www.npmjs.com/package/@radix-ui/react-tabs/v/1.1.12) (from `^1.1.2`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-toggle@^1.1.9` ↗︎](https://www.npmjs.com/package/@radix-ui/react-toggle/v/1.1.9) (from `^1.1.2`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-tooltip@^1.2.7` ↗︎](https://www.npmjs.com/package/@radix-ui/react-tooltip/v/1.2.7) (from `^1.1.8`, in `dependencies`)
  - Updated dependency [`@tanstack/react-table@^8.21.3` ↗︎](https://www.npmjs.com/package/@tanstack/react-table/v/8.21.3) (from `^8.21.2`, in `dependencies`)
  - Updated dependency [`@uiw/codemirror-theme-dracula@^4.23.13` ↗︎](https://www.npmjs.com/package/@uiw/codemirror-theme-dracula/v/4.23.13) (from `^4.23.10`, in `dependencies`)
  - Updated dependency [`@uiw/react-codemirror@^4.23.13` ↗︎](https://www.npmjs.com/package/@uiw/react-codemirror/v/4.23.13) (from `^4.23.8`, in `dependencies`)
  - Updated dependency [`@xyflow/react@^12.6.4` ↗︎](https://www.npmjs.com/package/@xyflow/react/v/12.6.4) (from `^12.3.6`, in `dependencies`)
  - Updated dependency [`cmdk@^1.1.1` ↗︎](https://www.npmjs.com/package/cmdk/v/1.1.1) (from `^1.0.0`, in `dependencies`)
  - Updated dependency [`json-schema-to-zod@^2.6.1` ↗︎](https://www.npmjs.com/package/json-schema-to-zod/v/2.6.1) (from `^2.5.0`, in `dependencies`)
  - Updated dependency [`motion@^12.16.0` ↗︎](https://www.npmjs.com/package/motion/v/12.16.0) (from `^12.4.2`, in `dependencies`)
  - Updated dependency [`prism-react-renderer@^2.4.1` ↗︎](https://www.npmjs.com/package/prism-react-renderer/v/2.4.1) (from `^2.4.0`, in `dependencies`)
  - Updated dependency [`react-hook-form@^7.57.0` ↗︎](https://www.npmjs.com/package/react-hook-form/v/7.57.0) (from `^7.54.2`, in `dependencies`)
  - Updated dependency [`react-resizable-panels@^2.1.9` ↗︎](https://www.npmjs.com/package/react-resizable-panels/v/2.1.9) (from `^2.1.7`, in `dependencies`)
  - Updated dependency [`remark-rehype@^11.1.2` ↗︎](https://www.npmjs.com/package/remark-rehype/v/11.1.2) (from `^11.1.1`, in `dependencies`)
  - Updated dependency [`remeda@^2.23.0` ↗︎](https://www.npmjs.com/package/remeda/v/2.23.0) (from `^2.21.1`, in `dependencies`)
  - Updated dependency [`sonner@^2.0.5` ↗︎](https://www.npmjs.com/package/sonner/v/2.0.5) (from `^2.0.1`, in `dependencies`)
  - Updated dependency [`use-debounce@^10.0.5` ↗︎](https://www.npmjs.com/package/use-debounce/v/10.0.5) (from `^10.0.4`, in `dependencies`)
  - Updated dependency [`zod@^3.25.57` ↗︎](https://www.npmjs.com/package/zod/v/3.25.57) (from `^3.25.56`, in `dependencies`)
  - Updated dependency [`zustand@^5.0.5` ↗︎](https://www.npmjs.com/package/zustand/v/5.0.5) (from `^5.0.3`, in `dependencies`)
- 02560d4: lift evals fetching to the playground package instead
- 5f2aa3e: Move workflow hooks to playground
- 311132e: move useWorkflow to playground instead of playground-ui
- fc677d7: For final result for a workflow
- Updated dependencies [63f6b7d]
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
- Updated dependencies [3270d9d]
- Updated dependencies [53d3c37]
- Updated dependencies [751c894]
- Updated dependencies [577ce3a]
- Updated dependencies [9260b3a]
  - @mastra/client-js@0.10.5
  - @mastra/core@0.10.6

## 5.1.6-alpha.5

### Patch Changes

- 5f2aa3e: Move workflow hooks to playground
- Updated dependencies [12a95fc]
- Updated dependencies [51264a5]
- Updated dependencies [8e6f677]
  - @mastra/core@0.10.6-alpha.5
  - @mastra/client-js@0.10.5-alpha.5

## 5.1.6-alpha.4

### Patch Changes

- Updated dependencies [9589624]
  - @mastra/core@0.10.6-alpha.4
  - @mastra/client-js@0.10.5-alpha.4

## 5.1.6-alpha.3

### Patch Changes

- Updated dependencies [d70c420]
- Updated dependencies [2a16996]
  - @mastra/core@0.10.6-alpha.3
  - @mastra/client-js@0.10.5-alpha.3

## 5.1.6-alpha.2

### Patch Changes

- Updated dependencies [4b0f8a6]
  - @mastra/core@0.10.6-alpha.2
  - @mastra/client-js@0.10.5-alpha.2

## 5.1.6-alpha.1

### Patch Changes

- fc677d7: For final result for a workflow
- Updated dependencies [ee9af57]
- Updated dependencies [3270d9d]
- Updated dependencies [751c894]
- Updated dependencies [577ce3a]
- Updated dependencies [9260b3a]
  - @mastra/client-js@0.10.5-alpha.1
  - @mastra/core@0.10.6-alpha.1

## 5.1.6-alpha.0

### Patch Changes

- 63f6b7d: dependencies updates:
  - Updated dependency [`@ai-sdk/ui-utils@^1.2.11` ↗︎](https://www.npmjs.com/package/@ai-sdk/ui-utils/v/1.2.11) (from `^1.1.19`, in `dependencies`)
  - Updated dependency [`@autoform/core@^2.2.0` ↗︎](https://www.npmjs.com/package/@autoform/core/v/2.2.0) (from `^2.1.0`, in `dependencies`)
  - Updated dependency [`@autoform/react@^3.1.0` ↗︎](https://www.npmjs.com/package/@autoform/react/v/3.1.0) (from `^3.0.0`, in `dependencies`)
  - Updated dependency [`@autoform/zod@^2.2.0` ↗︎](https://www.npmjs.com/package/@autoform/zod/v/2.2.0) (from `^2.1.0`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-avatar@^1.1.10` ↗︎](https://www.npmjs.com/package/@radix-ui/react-avatar/v/1.1.10) (from `^1.1.3`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-checkbox@^1.3.2` ↗︎](https://www.npmjs.com/package/@radix-ui/react-checkbox/v/1.3.2) (from `^1.1.4`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-collapsible@^1.1.11` ↗︎](https://www.npmjs.com/package/@radix-ui/react-collapsible/v/1.1.11) (from `^1.1.3`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-dialog@^1.1.14` ↗︎](https://www.npmjs.com/package/@radix-ui/react-dialog/v/1.1.14) (from `^1.1.6`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-label@^2.1.7` ↗︎](https://www.npmjs.com/package/@radix-ui/react-label/v/2.1.7) (from `^2.1.2`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-popover@^1.1.14` ↗︎](https://www.npmjs.com/package/@radix-ui/react-popover/v/1.1.14) (from `^1.1.6`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-scroll-area@^1.2.9` ↗︎](https://www.npmjs.com/package/@radix-ui/react-scroll-area/v/1.2.9) (from `^1.2.3`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-select@^2.2.5` ↗︎](https://www.npmjs.com/package/@radix-ui/react-select/v/2.2.5) (from `^2.1.6`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-slider@^1.3.5` ↗︎](https://www.npmjs.com/package/@radix-ui/react-slider/v/1.3.5) (from `^1.2.3`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-slot@^1.2.3` ↗︎](https://www.npmjs.com/package/@radix-ui/react-slot/v/1.2.3) (from `^1.1.2`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-switch@^1.2.5` ↗︎](https://www.npmjs.com/package/@radix-ui/react-switch/v/1.2.5) (from `^1.1.3`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-tabs@^1.1.12` ↗︎](https://www.npmjs.com/package/@radix-ui/react-tabs/v/1.1.12) (from `^1.1.2`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-toggle@^1.1.9` ↗︎](https://www.npmjs.com/package/@radix-ui/react-toggle/v/1.1.9) (from `^1.1.2`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-tooltip@^1.2.7` ↗︎](https://www.npmjs.com/package/@radix-ui/react-tooltip/v/1.2.7) (from `^1.1.8`, in `dependencies`)
  - Updated dependency [`@tanstack/react-table@^8.21.3` ↗︎](https://www.npmjs.com/package/@tanstack/react-table/v/8.21.3) (from `^8.21.2`, in `dependencies`)
  - Updated dependency [`@uiw/codemirror-theme-dracula@^4.23.13` ↗︎](https://www.npmjs.com/package/@uiw/codemirror-theme-dracula/v/4.23.13) (from `^4.23.10`, in `dependencies`)
  - Updated dependency [`@uiw/react-codemirror@^4.23.13` ↗︎](https://www.npmjs.com/package/@uiw/react-codemirror/v/4.23.13) (from `^4.23.8`, in `dependencies`)
  - Updated dependency [`@xyflow/react@^12.6.4` ↗︎](https://www.npmjs.com/package/@xyflow/react/v/12.6.4) (from `^12.3.6`, in `dependencies`)
  - Updated dependency [`cmdk@^1.1.1` ↗︎](https://www.npmjs.com/package/cmdk/v/1.1.1) (from `^1.0.0`, in `dependencies`)
  - Updated dependency [`json-schema-to-zod@^2.6.1` ↗︎](https://www.npmjs.com/package/json-schema-to-zod/v/2.6.1) (from `^2.5.0`, in `dependencies`)
  - Updated dependency [`motion@^12.16.0` ↗︎](https://www.npmjs.com/package/motion/v/12.16.0) (from `^12.4.2`, in `dependencies`)
  - Updated dependency [`prism-react-renderer@^2.4.1` ↗︎](https://www.npmjs.com/package/prism-react-renderer/v/2.4.1) (from `^2.4.0`, in `dependencies`)
  - Updated dependency [`react-hook-form@^7.57.0` ↗︎](https://www.npmjs.com/package/react-hook-form/v/7.57.0) (from `^7.54.2`, in `dependencies`)
  - Updated dependency [`react-resizable-panels@^2.1.9` ↗︎](https://www.npmjs.com/package/react-resizable-panels/v/2.1.9) (from `^2.1.7`, in `dependencies`)
  - Updated dependency [`remark-rehype@^11.1.2` ↗︎](https://www.npmjs.com/package/remark-rehype/v/11.1.2) (from `^11.1.1`, in `dependencies`)
  - Updated dependency [`remeda@^2.23.0` ↗︎](https://www.npmjs.com/package/remeda/v/2.23.0) (from `^2.21.1`, in `dependencies`)
  - Updated dependency [`sonner@^2.0.5` ↗︎](https://www.npmjs.com/package/sonner/v/2.0.5) (from `^2.0.1`, in `dependencies`)
  - Updated dependency [`use-debounce@^10.0.5` ↗︎](https://www.npmjs.com/package/use-debounce/v/10.0.5) (from `^10.0.4`, in `dependencies`)
  - Updated dependency [`zod@^3.25.57` ↗︎](https://www.npmjs.com/package/zod/v/3.25.57) (from `^3.25.56`, in `dependencies`)
  - Updated dependency [`zustand@^5.0.5` ↗︎](https://www.npmjs.com/package/zustand/v/5.0.5) (from `^5.0.3`, in `dependencies`)
- 02560d4: lift evals fetching to the playground package instead
- 311132e: move useWorkflow to playground instead of playground-ui
- Updated dependencies [63f6b7d]
- Updated dependencies [63f6b7d]
- Updated dependencies [36f1c36]
- Updated dependencies [10d352e]
- Updated dependencies [53d3c37]
  - @mastra/client-js@0.10.5-alpha.0
  - @mastra/core@0.10.6-alpha.0

## 5.1.5

### Patch Changes

- 13c97f9: Save run status, result and error in storage snapshot
- Updated dependencies [13c97f9]
  - @mastra/core@0.10.5
  - @mastra/client-js@0.10.4

## 5.1.4

### Patch Changes

- 1ccccff: dependencies updates:
  - Updated dependency [`zod@^3.25.56` ↗︎](https://www.npmjs.com/package/zod/v/3.25.56) (from `^3.24.3`, in `dependencies`)
- 1ccccff: dependencies updates:
  - Updated dependency [`zod@^3.25.56` ↗︎](https://www.npmjs.com/package/zod/v/3.25.56) (from `^3.24.3`, in `dependencies`)
- e719504: don't start posthog when the browser is Brave
- 5c68759: Update vite to fix CVE-2025-31125
- 29f1c91: revert: final step of workflow not working as expected
- 8f60de4: fix workflow output when the schema is a primitive
- Updated dependencies [1ccccff]
- Updated dependencies [1ccccff]
- Updated dependencies [d1ed912]
- Updated dependencies [f6fd25f]
- Updated dependencies [dffb67b]
- Updated dependencies [f1f1f1b]
- Updated dependencies [925ab94]
- Updated dependencies [b2810ab]
- Updated dependencies [f9816ae]
- Updated dependencies [82090c1]
- Updated dependencies [1b443fd]
- Updated dependencies [ce97900]
- Updated dependencies [f1309d3]
- Updated dependencies [14a2566]
- Updated dependencies [67d21b5]
- Updated dependencies [f7f8293]
- Updated dependencies [48eddb9]
  - @mastra/client-js@0.10.3
  - @mastra/core@0.10.4

## 5.1.4-alpha.5

### Patch Changes

- 29f1c91: revert: final step of workflow not working as expected

## 5.1.4-alpha.4

### Patch Changes

- Updated dependencies [925ab94]
  - @mastra/core@0.10.4-alpha.3
  - @mastra/client-js@0.10.3-alpha.3

## 5.1.4-alpha.3

### Patch Changes

- Updated dependencies [48eddb9]
  - @mastra/core@0.10.4-alpha.2
  - @mastra/client-js@0.10.3-alpha.2

## 5.1.4-alpha.2

### Patch Changes

- e719504: don't start posthog when the browser is Brave

## 5.1.4-alpha.1

### Patch Changes

- 1ccccff: dependencies updates:
  - Updated dependency [`zod@^3.25.56` ↗︎](https://www.npmjs.com/package/zod/v/3.25.56) (from `^3.24.3`, in `dependencies`)
- 1ccccff: dependencies updates:
  - Updated dependency [`zod@^3.25.56` ↗︎](https://www.npmjs.com/package/zod/v/3.25.56) (from `^3.24.3`, in `dependencies`)
- Updated dependencies [1ccccff]
- Updated dependencies [1ccccff]
- Updated dependencies [f6fd25f]
- Updated dependencies [dffb67b]
- Updated dependencies [f1309d3]
- Updated dependencies [f7f8293]
  - @mastra/client-js@0.10.3-alpha.1
  - @mastra/core@0.10.4-alpha.1

## 5.1.4-alpha.0

### Patch Changes

- 5c68759: Update vite to fix CVE-2025-31125
- 8f60de4: fix workflow output when the schema is a primitive
- Updated dependencies [d1ed912]
- Updated dependencies [f1f1f1b]
- Updated dependencies [b2810ab]
- Updated dependencies [f9816ae]
- Updated dependencies [82090c1]
- Updated dependencies [1b443fd]
- Updated dependencies [ce97900]
- Updated dependencies [14a2566]
- Updated dependencies [67d21b5]
  - @mastra/core@0.10.4-alpha.0
  - @mastra/client-js@0.10.3-alpha.0

## 5.1.3

### Patch Changes

- 6303367: Fixed an issue where a recent memory images in playground fix broke playground tool calls

## 5.1.3-alpha.0

### Patch Changes

- 6303367: Fixed an issue where a recent memory images in playground fix broke playground tool calls

## 5.1.2

### Patch Changes

- 401bbae: Show workflow graph from stepGraph of previous runs when viewing a previous run
- 9666468: move the fetch traces call to the playground instead of playground-ui
- 89a69d0: add a way to go to the given trace of a workflow step
- 6fd77b5: add docs and txt support for multi modal
- 9faee5b: small fixes in the workflows graph
- 4b23936: fix: typos
- 631683f: move workflow runs list in playground-ui instead of playground
- 068b850: fix: able to pass headers to playground components which are using the mastra client
- f0d559f: Fix peerdeps for alpha channel
- f6ddf55: fix traces not showing and reduce API surface from playground ui
- 9a31c09: Highlight steps in nested workflows on workflow graph
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
- Updated dependencies [b72c768]
- Updated dependencies [ecebbeb]
- Updated dependencies [79d5145]
- Updated dependencies [12b7002]
- Updated dependencies [f0d559f]
- Updated dependencies [2901125]
  - @mastra/core@0.10.2
  - @mastra/client-js@0.10.2

## 5.1.2-alpha.7

### Patch Changes

- Updated dependencies [37643b8]
- Updated dependencies [b72c768]
- Updated dependencies [79d5145]
  - @mastra/core@0.10.2-alpha.8
  - @mastra/client-js@0.10.2-alpha.3

## 5.1.2-alpha.6

### Patch Changes

- 6fd77b5: add docs and txt support for multi modal
- 631683f: move workflow runs list in playground-ui instead of playground
- Updated dependencies [99fd6cf]
- Updated dependencies [8dc94d8]
  - @mastra/core@0.10.2-alpha.6

## 5.1.2-alpha.5

### Patch Changes

- 9666468: move the fetch traces call to the playground instead of playground-ui
- Updated dependencies [1b5fc55]
- Updated dependencies [add596e]
- Updated dependencies [ecebbeb]
  - @mastra/core@0.10.2-alpha.5

## 5.1.2-alpha.4

### Patch Changes

- 401bbae: Show workflow graph from stepGraph of previous runs when viewing a previous run
- 4b23936: fix: typos

## 5.1.2-alpha.3

### Patch Changes

- Updated dependencies [c5bf1ce]
- Updated dependencies [12b7002]
  - @mastra/client-js@0.10.2-alpha.2
  - @mastra/core@0.10.2-alpha.4

## 5.1.2-alpha.2

### Patch Changes

- 068b850: fix: able to pass headers to playground components which are using the mastra client
- Updated dependencies [ab5adbe]
- Updated dependencies [195c428]
- Updated dependencies [f73e11b]
  - @mastra/core@0.10.2-alpha.3

## 5.1.2-alpha.1

### Patch Changes

- f0d559f: Fix peerdeps for alpha channel
- f6ddf55: fix traces not showing and reduce API surface from playground ui
- Updated dependencies [1e8bb40]
- Updated dependencies [f0d559f]
  - @mastra/core@0.10.2-alpha.2
  - @mastra/client-js@0.10.2-alpha.1

## 5.1.2-alpha.0

### Patch Changes

- 89a69d0: add a way to go to the given trace of a workflow step
- 9faee5b: small fixes in the workflows graph
- 9a31c09: Highlight steps in nested workflows on workflow graph
- Updated dependencies [592a2db]
- Updated dependencies [e5dc18d]
  - @mastra/client-js@0.10.2-alpha.0
  - @mastra/core@0.10.2-alpha.0

## 5.1.1

### Patch Changes

- b4365f6: add empty states for agents network and tools
- d0932ac: add multi modal input behind feature flag
- 3c2dba5: add workflow run list
- 267773e: Show map config on workflow graph
  Highlight borders for conditions too on workflow graph
  Fix watch stream
- 33f1c64: revamp the experience for workflows
- 6015bdf: Leverage defaultAgentStreamOption, defaultAgentGenerateOption in playground
- 7a32205: add empty states for workflows, agents and mcp servers
- Updated dependencies [d70b807]
- Updated dependencies [6d16390]
- Updated dependencies [1e4a421]
- Updated dependencies [200d0da]
- Updated dependencies [267773e]
- Updated dependencies [bf5f17b]
- Updated dependencies [5343f93]
- Updated dependencies [f622cfa]
- Updated dependencies [38aee50]
- Updated dependencies [5c41100]
- Updated dependencies [d6a759b]
- Updated dependencies [6015bdf]
  - @mastra/core@0.10.1
  - @mastra/client-js@0.10.1

## 5.1.1-alpha.5

### Patch Changes

- 267773e: Show map config on workflow graph
  Highlight borders for conditions too on workflow graph
  Fix watch stream
- Updated dependencies [267773e]
  - @mastra/client-js@0.10.1-alpha.3

## 5.1.1-alpha.4

### Patch Changes

- 3c2dba5: add workflow run list
- 33f1c64: revamp the experience for workflows
- Updated dependencies [d70b807]
  - @mastra/core@0.10.1-alpha.3

## 5.1.1-alpha.3

### Patch Changes

- 6015bdf: Leverage defaultAgentStreamOption, defaultAgentGenerateOption in playground
- Updated dependencies [6015bdf]
  - @mastra/client-js@0.10.1-alpha.2
  - @mastra/core@0.10.1-alpha.2

## 5.1.1-alpha.2

### Patch Changes

- b4365f6: add empty states for agents network and tools
- d0932ac: add multi modal input behind feature flag
- Updated dependencies [200d0da]
- Updated dependencies [bf5f17b]
- Updated dependencies [5343f93]
- Updated dependencies [38aee50]
- Updated dependencies [5c41100]
- Updated dependencies [d6a759b]
  - @mastra/core@0.10.1-alpha.1
  - @mastra/client-js@0.10.1-alpha.1

## 5.1.1-alpha.1

### Patch Changes

- 7a32205: add empty states for workflows, agents and mcp servers

## 5.1.1-alpha.0

### Patch Changes

- Updated dependencies [6d16390]
- Updated dependencies [1e4a421]
- Updated dependencies [f622cfa]
  - @mastra/core@0.10.1-alpha.0
  - @mastra/client-js@0.10.1-alpha.0

## 5.1.0

### Minor Changes

- 83da932: Move @mastra/core to peerdeps

### Patch Changes

- b3a3d63: BREAKING: Make vnext workflow the default worklow, and old workflow legacy_workflow
- 99552bc: revamp the UI of the tools page
- 9b7294a: Revamp the UI for the right sidebar of the agents page
- e2c2cf1: Persist playground agent settings across refresh
- fd69cc3: revamp UI of workflow "Run" pane
- 1270183: Add waterfull traces instead of stacked progressbar (UI improvement mostly)
- cbf153f: Handle broken images on the playground
- 0cae9b1: sidebar adjustments (storing status + showing the action of collapsing / expanding)
- 1f6886f: bring back the memory not activated warning in agent chat
- 8a68886: revamp the UI of the workflow form input
- Updated dependencies [b3a3d63]
- Updated dependencies [344f453]
- Updated dependencies [0215b0b]
- Updated dependencies [0a3ae6d]
- Updated dependencies [95911be]
- Updated dependencies [83da932]
- Updated dependencies [f53a6ac]
- Updated dependencies [5eb5a99]
- Updated dependencies [7e632c5]
- Updated dependencies [1e9fbfa]
- Updated dependencies [eabdcd9]
- Updated dependencies [90be034]
- Updated dependencies [ccdabdc]
- Updated dependencies [99f050a]
- Updated dependencies [d0ee3c6]
- Updated dependencies [b2ae5aa]
- Updated dependencies [a6e3881]
- Updated dependencies [fddae56]
- Updated dependencies [23f258c]
- Updated dependencies [a7292b0]
- Updated dependencies [0dcb9f0]
- Updated dependencies [5063646]
- Updated dependencies [2672a05]
  - @mastra/client-js@0.10.0
  - @mastra/core@0.10.0

## 5.1.0-alpha.1

### Minor Changes

- 83da932: Move @mastra/core to peerdeps

### Patch Changes

- b3a3d63: BREAKING: Make vnext workflow the default worklow, and old workflow legacy_workflow
- fd69cc3: revamp UI of workflow "Run" pane
- cbf153f: Handle broken images on the playground
- 0cae9b1: sidebar adjustments (storing status + showing the action of collapsing / expanding)
- 1f6886f: bring back the memory not activated warning in agent chat
- 8a68886: revamp the UI of the workflow form input
- Updated dependencies [b3a3d63]
- Updated dependencies [344f453]
- Updated dependencies [0215b0b]
- Updated dependencies [0a3ae6d]
- Updated dependencies [95911be]
- Updated dependencies [83da932]
- Updated dependencies [5eb5a99]
- Updated dependencies [7e632c5]
- Updated dependencies [1e9fbfa]
- Updated dependencies [b2ae5aa]
- Updated dependencies [a7292b0]
- Updated dependencies [0dcb9f0]
- Updated dependencies [5063646]
  - @mastra/client-js@0.2.0-alpha.1
  - @mastra/core@0.10.0-alpha.1

## 5.0.5-alpha.0

### Patch Changes

- 99552bc: revamp the UI of the tools page
- 9b7294a: Revamp the UI for the right sidebar of the agents page
- e2c2cf1: Persist playground agent settings across refresh
- 1270183: Add waterfull traces instead of stacked progressbar (UI improvement mostly)
- Updated dependencies [f53a6ac]
- Updated dependencies [eabdcd9]
- Updated dependencies [90be034]
- Updated dependencies [ccdabdc]
- Updated dependencies [99f050a]
- Updated dependencies [d0ee3c6]
- Updated dependencies [a6e3881]
- Updated dependencies [fddae56]
- Updated dependencies [23f258c]
- Updated dependencies [2672a05]
  - @mastra/client-js@0.1.23-alpha.0
  - @mastra/core@0.9.5-alpha.0

## 5.0.4

### Patch Changes

- cb1f698: Set runtimeContext from playground for agents, tools, workflows
- Updated dependencies [396be50]
- Updated dependencies [ab80e7e]
- Updated dependencies [c2f9e60]
- Updated dependencies [5c70b8a]
- Updated dependencies [c3bd795]
- Updated dependencies [da082f8]
- Updated dependencies [b4c6c87]
- Updated dependencies [0c3d117]
- Updated dependencies [a5810ce]
- Updated dependencies [3e9c131]
- Updated dependencies [3171b5b]
- Updated dependencies [c2b980b]
- Updated dependencies [cb1f698]
- Updated dependencies [973e5ac]
- Updated dependencies [daf942f]
- Updated dependencies [0b8b868]
- Updated dependencies [9e1eff5]
- Updated dependencies [6fa1ad1]
- Updated dependencies [c28d7a0]
- Updated dependencies [edf1e88]
  - @mastra/core@0.9.4
  - @mastra/client-js@0.1.22

## 5.0.4-alpha.4

### Patch Changes

- Updated dependencies [5c70b8a]
- Updated dependencies [3e9c131]
  - @mastra/client-js@0.1.22-alpha.4
  - @mastra/core@0.9.4-alpha.4

## 5.0.4-alpha.3

### Patch Changes

- Updated dependencies [396be50]
- Updated dependencies [c2f9e60]
- Updated dependencies [c3bd795]
- Updated dependencies [da082f8]
- Updated dependencies [0c3d117]
- Updated dependencies [a5810ce]
  - @mastra/core@0.9.4-alpha.3
  - @mastra/client-js@0.1.22-alpha.3

## 5.0.4-alpha.2

### Patch Changes

- Updated dependencies [b4c6c87]
- Updated dependencies [3171b5b]
- Updated dependencies [c2b980b]
- Updated dependencies [973e5ac]
- Updated dependencies [9e1eff5]
  - @mastra/client-js@0.1.22-alpha.2
  - @mastra/core@0.9.4-alpha.2

## 5.0.4-alpha.1

### Patch Changes

- Updated dependencies [ab80e7e]
- Updated dependencies [6fa1ad1]
- Updated dependencies [c28d7a0]
- Updated dependencies [edf1e88]
  - @mastra/core@0.9.4-alpha.1
  - @mastra/client-js@0.1.22-alpha.1

## 5.0.4-alpha.0

### Patch Changes

- cb1f698: Set runtimeContext from playground for agents, tools, workflows
- Updated dependencies [cb1f698]
- Updated dependencies [daf942f]
- Updated dependencies [0b8b868]
  - @mastra/client-js@0.1.22-alpha.0
  - @mastra/core@0.9.4-alpha.0

## 5.0.3

### Patch Changes

- b5d2de0: In vNext workflow serializedStepGraph, return only serializedStepFlow for steps created from a workflow
  allow viewing inner nested workflows in a multi-layered nested vnext workflow on the playground
- 62c9e7d: Fix disappearing tool calls in streaming
- d2dfc37: Fix autoform number form default value
- Updated dependencies [e450778]
- Updated dependencies [8902157]
- Updated dependencies [ca0dc88]
- Updated dependencies [526c570]
- Updated dependencies [36eb1aa]
- Updated dependencies [d7a6a33]
- Updated dependencies [9cd1a46]
- Updated dependencies [b5d2de0]
- Updated dependencies [62c9e7d]
- Updated dependencies [644f8ad]
- Updated dependencies [70dbf51]
  - @mastra/core@0.9.3
  - @mastra/client-js@0.1.21

## 5.0.3-alpha.1

### Patch Changes

- 62c9e7d: Fix disappearing tool calls in streaming
- Updated dependencies [e450778]
- Updated dependencies [8902157]
- Updated dependencies [ca0dc88]
- Updated dependencies [36eb1aa]
- Updated dependencies [9cd1a46]
- Updated dependencies [62c9e7d]
- Updated dependencies [70dbf51]
  - @mastra/core@0.9.3-alpha.1
  - @mastra/client-js@0.1.21-alpha.1

## 5.0.3-alpha.0

### Patch Changes

- b5d2de0: In vNext workflow serializedStepGraph, return only serializedStepFlow for steps created from a workflow
  allow viewing inner nested workflows in a multi-layered nested vnext workflow on the playground
- d2dfc37: Fix autoform number form default value
- Updated dependencies [526c570]
- Updated dependencies [b5d2de0]
- Updated dependencies [644f8ad]
  - @mastra/client-js@0.1.21-alpha.0
  - @mastra/core@0.9.3-alpha.0

## 5.0.2

### Patch Changes

- 2cf3b8f: dependencies updates:
  - Updated dependency [`zod@^3.24.3` ↗︎](https://www.npmjs.com/package/zod/v/3.24.3) (from `^3.24.2`, in `dependencies`)
- 144fa1b: lift up the traces fetching and allow to pass them down in the TracesTable. It allows passing down mastra client traces OR clickhouse traces
- 33b84fd: fix showing sig digits in trace / span duration
- 26738f4: Switched from a custom MCP tools schema deserializer to json-schema-to-zod - fixes an issue where MCP tool schemas didn't deserialize properly in Mastra playground. Also added support for testing tools with no input arguments in playground
- 0097d50: Add serializedStepGraph to vNext workflow
  Return serializedStepGraph from vNext workflow
  Use serializedStepGraph in vNext workflow graph
- 5b43dd0: revamp ui for threads
- fba031f: Show traces for vNext workflow
- b63e712: refactor: Separate fetching traces from within playground-ui components
- Updated dependencies [2cf3b8f]
- Updated dependencies [6052aa6]
- Updated dependencies [967b41c]
- Updated dependencies [3d2fb5c]
- Updated dependencies [26738f4]
- Updated dependencies [4155f47]
- Updated dependencies [254f5c3]
- Updated dependencies [7eeb2bc]
- Updated dependencies [b804723]
- Updated dependencies [8607972]
- Updated dependencies [ccef9f9]
- Updated dependencies [0097d50]
- Updated dependencies [7eeb2bc]
- Updated dependencies [17826a9]
- Updated dependencies [7d8b7c7]
- Updated dependencies [2429c74]
- Updated dependencies [fba031f]
- Updated dependencies [2e4f8e9]
- Updated dependencies [3a5f1e1]
- Updated dependencies [51e6923]
- Updated dependencies [8398d89]
  - @mastra/client-js@0.1.20
  - @mastra/core@0.9.2

## 5.0.2-alpha.6

### Patch Changes

- 144fa1b: lift up the traces fetching and allow to pass them down in the TracesTable. It allows passing down mastra client traces OR clickhouse traces
- Updated dependencies [6052aa6]
- Updated dependencies [7d8b7c7]
- Updated dependencies [2e4f8e9]
- Updated dependencies [3a5f1e1]
- Updated dependencies [8398d89]
  - @mastra/core@0.9.2-alpha.6
  - @mastra/client-js@0.1.20-alpha.6

## 5.0.2-alpha.5

### Patch Changes

- fba031f: Show traces for vNext workflow
- Updated dependencies [3d2fb5c]
- Updated dependencies [7eeb2bc]
- Updated dependencies [8607972]
- Updated dependencies [7eeb2bc]
- Updated dependencies [fba031f]
  - @mastra/core@0.9.2-alpha.5
  - @mastra/client-js@0.1.20-alpha.5

## 5.0.2-alpha.4

### Patch Changes

- 5b43dd0: revamp ui for threads
- Updated dependencies [ccef9f9]
- Updated dependencies [51e6923]
  - @mastra/core@0.9.2-alpha.4
  - @mastra/client-js@0.1.20-alpha.4

## 5.0.2-alpha.3

### Patch Changes

- 33b84fd: fix showing sig digits in trace / span duration
- b63e712: refactor: Separate fetching traces from within playground-ui components
- Updated dependencies [967b41c]
- Updated dependencies [4155f47]
- Updated dependencies [17826a9]
  - @mastra/core@0.9.2-alpha.3
  - @mastra/client-js@0.1.20-alpha.3

## 5.0.2-alpha.2

### Patch Changes

- 26738f4: Switched from a custom MCP tools schema deserializer to json-schema-to-zod - fixes an issue where MCP tool schemas didn't deserialize properly in Mastra playground. Also added support for testing tools with no input arguments in playground
- Updated dependencies [26738f4]
  - @mastra/core@0.9.2-alpha.2
  - @mastra/client-js@0.1.20-alpha.2

## 5.0.2-alpha.1

### Patch Changes

- Updated dependencies [254f5c3]
- Updated dependencies [b804723]
- Updated dependencies [2429c74]
  - @mastra/client-js@0.1.20-alpha.1
  - @mastra/core@0.9.2-alpha.1

## 5.0.2-alpha.0

### Patch Changes

- 0097d50: Add serializedStepGraph to vNext workflow
  Return serializedStepGraph from vNext workflow
  Use serializedStepGraph in vNext workflow graph
- Updated dependencies [0097d50]
  - @mastra/client-js@0.1.20-alpha.0
  - @mastra/core@0.9.2-alpha.0

## 5.0.1

### Patch Changes

- 34a76ca: Call workflow cleanup function when closing watch stream controller
- 70124e1: revamp the ui for traces
- 3b74a74: add badge for failure / successful traces
- 05806e3: revamp the UI of the chat in playground
- 926821d: Fix triggerSchema default not showing in workflow ui
- 0c3c4f4: Playground routing model settings for AgentNetworks
- 1700eca: fixing overflow on agent traces
- 11d4485: Show VNext workflows on the playground
  Show running status for step in vNext workflowState
- ca665d3: fix the ui for smaller screen regarding traces
- 57b25ed: Use resumeSchema to show inputs on the playground for suspended workflows
- f1d4b7a: Add x-mastra-dev-playground header to all playground requests
- 5a66ced: add click on trace row
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
- Updated dependencies [b50b9b7]
- Updated dependencies [11d4485]
- Updated dependencies [479f490]
- Updated dependencies [c23a81c]
- Updated dependencies [2d4001d]
- Updated dependencies [c71013a]
- Updated dependencies [1d3b1cd]
  - @mastra/core@0.9.1
  - @mastra/client-js@0.1.19

## 5.0.1-alpha.9

### Patch Changes

- ca665d3: fix the ui for smaller screen regarding traces

## 5.0.1-alpha.8

### Patch Changes

- Updated dependencies [2d17c73]
  - @mastra/core@0.9.1-alpha.8
  - @mastra/client-js@0.1.19-alpha.8

## 5.0.1-alpha.7

### Patch Changes

- Updated dependencies [1d3b1cd]
  - @mastra/core@0.9.1-alpha.7
  - @mastra/client-js@0.1.19-alpha.7

## 5.0.1-alpha.6

### Patch Changes

- Updated dependencies [c23a81c]
  - @mastra/core@0.9.1-alpha.6
  - @mastra/client-js@0.1.19-alpha.6

## 5.0.1-alpha.5

### Patch Changes

- Updated dependencies [3e7b69d]
  - @mastra/core@0.9.1-alpha.5
  - @mastra/client-js@0.1.19-alpha.5

## 5.0.1-alpha.4

### Patch Changes

- 3b74a74: add badge for failure / successful traces
- 5a66ced: add click on trace row
- Updated dependencies [e4943b8]
- Updated dependencies [479f490]
  - @mastra/core@0.9.1-alpha.4
  - @mastra/client-js@0.1.19-alpha.4

## 5.0.1-alpha.3

### Patch Changes

- 34a76ca: Call workflow cleanup function when closing watch stream controller
- 0c3c4f4: Playground routing model settings for AgentNetworks
- 1700eca: fixing overflow on agent traces
- Updated dependencies [6262bd5]
  - @mastra/core@0.9.1-alpha.3
  - @mastra/client-js@0.1.19-alpha.3

## 5.0.1-alpha.2

### Patch Changes

- 70124e1: revamp the ui for traces
- 926821d: Fix triggerSchema default not showing in workflow ui
- 57b25ed: Use resumeSchema to show inputs on the playground for suspended workflows
- f1d4b7a: Add x-mastra-dev-playground header to all playground requests
- Updated dependencies [405b63d]
- Updated dependencies [61e92f5]
- Updated dependencies [c71013a]
  - @mastra/core@0.9.1-alpha.2
  - @mastra/client-js@0.1.19-alpha.2

## 5.0.1-alpha.1

### Patch Changes

- 05806e3: revamp the UI of the chat in playground
- 11d4485: Show VNext workflows on the playground
  Show running status for step in vNext workflowState
- Updated dependencies [20275d4]
- Updated dependencies [7d1892c]
- Updated dependencies [a90a082]
- Updated dependencies [35955b0]
- Updated dependencies [c1409ef]
- Updated dependencies [b50b9b7]
- Updated dependencies [11d4485]
- Updated dependencies [2d4001d]
  - @mastra/core@0.9.1-alpha.1
  - @mastra/client-js@0.1.19-alpha.1

## 5.0.1-alpha.0

### Patch Changes

- Updated dependencies [81fb7f6]
  - @mastra/core@0.9.1-alpha.0
  - @mastra/client-js@0.1.19-alpha.0

## 5.0.0

### Patch Changes

- bdbde72: Sync DS components with Cloud
- Updated dependencies [000a6d4]
- Updated dependencies [08bb78e]
- Updated dependencies [ed2f549]
- Updated dependencies [7e92011]
- Updated dependencies [9ee4293]
- Updated dependencies [03f3cd0]
- Updated dependencies [c0f22b4]
- Updated dependencies [71d9444]
- Updated dependencies [157c741]
- Updated dependencies [8a8a73b]
- Updated dependencies [0a033fa]
- Updated dependencies [fe3ae4d]
- Updated dependencies [2538066]
- Updated dependencies [9c26508]
- Updated dependencies [0f4eae3]
- Updated dependencies [16a8648]
- Updated dependencies [6f92295]
  - @mastra/core@0.9.0
  - @mastra/client-js@0.1.18

## 5.0.0-alpha.8

### Patch Changes

- bdbde72: Sync DS components with Cloud
- Updated dependencies [000a6d4]
- Updated dependencies [ed2f549]
- Updated dependencies [c0f22b4]
- Updated dependencies [0a033fa]
- Updated dependencies [2538066]
- Updated dependencies [9c26508]
- Updated dependencies [0f4eae3]
- Updated dependencies [16a8648]
  - @mastra/core@0.9.0-alpha.8
  - @mastra/client-js@0.1.18-alpha.8

## 5.0.0-alpha.7

### Patch Changes

- Updated dependencies [71d9444]
  - @mastra/core@0.9.0-alpha.7
  - @mastra/client-js@0.1.18-alpha.7

## 5.0.0-alpha.6

### Patch Changes

- Updated dependencies [157c741]
  - @mastra/core@0.9.0-alpha.6
  - @mastra/client-js@0.1.18-alpha.6

## 5.0.0-alpha.5

### Patch Changes

- Updated dependencies [08bb78e]
  - @mastra/core@0.9.0-alpha.5
  - @mastra/client-js@0.1.18-alpha.5

## 5.0.0-alpha.4

### Patch Changes

- Updated dependencies [7e92011]
  - @mastra/core@0.9.0-alpha.4
  - @mastra/client-js@0.1.18-alpha.4

## 5.0.0-alpha.3

### Patch Changes

- Updated dependencies [fe3ae4d]
  - @mastra/core@0.9.0-alpha.3
  - @mastra/client-js@0.1.18-alpha.3

## 4.0.5-alpha.2

### Patch Changes

- Updated dependencies [9ee4293]
  - @mastra/core@0.8.4-alpha.2
  - @mastra/client-js@0.1.18-alpha.2

## 4.0.5-alpha.1

### Patch Changes

- Updated dependencies [8a8a73b]
- Updated dependencies [6f92295]
  - @mastra/core@0.8.4-alpha.1
  - @mastra/client-js@0.1.18-alpha.1

## 4.0.5-alpha.0

### Patch Changes

- Updated dependencies [03f3cd0]
  - @mastra/core@0.8.4-alpha.0
  - @mastra/client-js@0.1.18-alpha.0

## 4.0.4

### Patch Changes

- d72318f: Refactored the evals table to use the DS tables
- 1ebbfbf: Ability to toggle stream vs generate in playground
- 9b47dfa: Fix dynamic form for suspended workflow in playground ui
- f5451a4: bundle tokens as CJS in playground UI for tailwind usage
- ed52379: enum-type trigger schemas could not be submitted in the Playground UI has been resolved.
- 37bb612: Add Elastic-2.0 licensing for packages
- bc4acb3: updated traces to not be wrapped in traces object
- c8fe5f0: change the header of all pages with the one from the DS
- Updated dependencies [d72318f]
- Updated dependencies [0bcc862]
- Updated dependencies [10a8caf]
- Updated dependencies [359b089]
- Updated dependencies [32e7b71]
- Updated dependencies [37bb612]
- Updated dependencies [bc4acb3]
- Updated dependencies [7f1b291]
  - @mastra/core@0.8.3
  - @mastra/client-js@0.1.17

## 4.0.4-alpha.6

### Patch Changes

- d72318f: Refactored the evals table to use the DS tables
- Updated dependencies [d72318f]
  - @mastra/core@0.8.3-alpha.5
  - @mastra/client-js@0.1.17-alpha.5

## 4.0.4-alpha.5

### Patch Changes

- ed52379: enum-type trigger schemas could not be submitted in the Playground UI has been resolved.

## 4.0.4-alpha.4

### Patch Changes

- 1ebbfbf: Ability to toggle stream vs generate in playground
- 9b47dfa: Fix dynamic form for suspended workflow in playground ui
- Updated dependencies [7f1b291]
  - @mastra/core@0.8.3-alpha.4
  - @mastra/client-js@0.1.17-alpha.4

## 4.0.4-alpha.3

### Patch Changes

- Updated dependencies [10a8caf]
  - @mastra/core@0.8.3-alpha.3
  - @mastra/client-js@0.1.17-alpha.3

## 4.0.4-alpha.2

### Patch Changes

- Updated dependencies [0bcc862]
  - @mastra/core@0.8.3-alpha.2
  - @mastra/client-js@0.1.17-alpha.2

## 4.0.4-alpha.1

### Patch Changes

- f5451a4: bundle tokens as CJS in playground UI for tailwind usage
- 37bb612: Add Elastic-2.0 licensing for packages
- bc4acb3: updated traces to not be wrapped in traces object
- c8fe5f0: change the header of all pages with the one from the DS
- Updated dependencies [32e7b71]
- Updated dependencies [37bb612]
- Updated dependencies [bc4acb3]
  - @mastra/core@0.8.3-alpha.1
  - @mastra/client-js@0.1.17-alpha.1

## 4.0.4-alpha.0

### Patch Changes

- Updated dependencies [359b089]
  - @mastra/core@0.8.3-alpha.0
  - @mastra/client-js@0.1.17-alpha.0

## 4.0.3

### Patch Changes

- d3c372c: Show status UI of steps on playground workflow when workflow has no triggerSchema
  Show number of steps on workflows table
- Updated dependencies [a06aadc]
  - @mastra/core@0.8.2
  - @mastra/client-js@0.1.16

## 4.0.3-alpha.0

### Patch Changes

- d3c372c: Show status UI of steps on playground workflow when workflow has no triggerSchema
  Show number of steps on workflows table
- Updated dependencies [a06aadc]
  - @mastra/core@0.8.2-alpha.0
  - @mastra/client-js@0.1.16-alpha.0

## 4.0.2

### Patch Changes

- 99e2998: Set default max steps to 5
- Updated dependencies [99e2998]
- Updated dependencies [8fdb414]
  - @mastra/core@0.8.1
  - @mastra/client-js@0.1.15

## 4.0.2-alpha.0

### Patch Changes

- 99e2998: Set default max steps to 5
- Updated dependencies [99e2998]
- Updated dependencies [8fdb414]
  - @mastra/core@0.8.1-alpha.0
  - @mastra/client-js@0.1.15-alpha.0

## 4.0.1

### Patch Changes

- 87b96d7: set playground agent maxSteps default to 3

## 4.0.1-alpha.0

### Patch Changes

- 87b96d7: set playground agent maxSteps default to 3

## 4.0.0

### Patch Changes

- 5ae0180: Removed prefixed doc references
- a4a1151: Fix playground freezing when buffer is passed between steps
- 7bdbb64: Show no input when attributs are empty
- 9d13790: update playground-ui dynamic form, cleanups
- 055c4ea: Fix traces page showing e.reduce error
- 124ce08: Ability to set maxTokens, temperature, and other common features in playground
- 40dca45: Fix expanding workflow sidebar not expanding the output section
- 8393832: Handle nested workflow view on workflow graph
- 23999d4: Add Design System tokens and components into playground ui
- 8076ecf: Unify workflow watch/start response
- d16ed18: Make playground-ui dynamic forms better
- Updated dependencies [56c31b7]
- Updated dependencies [619c39d]
- Updated dependencies [5ae0180]
- Updated dependencies [fe56be0]
- Updated dependencies [93875ed]
- Updated dependencies [107bcfe]
- Updated dependencies [9bfa12b]
- Updated dependencies [515ebfb]
- Updated dependencies [5b4e19f]
- Updated dependencies [dbbbf80]
- Updated dependencies [a0967a0]
- Updated dependencies [055c4ea]
- Updated dependencies [fca3b21]
- Updated dependencies [88fa727]
- Updated dependencies [f37f535]
- Updated dependencies [789bef3]
- Updated dependencies [a3f0e90]
- Updated dependencies [4d67826]
- Updated dependencies [6330967]
- Updated dependencies [8393832]
- Updated dependencies [6330967]
- Updated dependencies [84fe241]
- Updated dependencies [5646a01]
- Updated dependencies [99d43b9]
- Updated dependencies [d7e08e8]
- Updated dependencies [febc8a6]
- Updated dependencies [7599d77]
- Updated dependencies [0118361]
- Updated dependencies [bffd64f]
- Updated dependencies [619c39d]
- Updated dependencies [cafae83]
- Updated dependencies [8076ecf]
- Updated dependencies [8df4a77]
- Updated dependencies [304397c]
  - @mastra/core@0.8.0
  - @mastra/client-js@0.1.14

## 4.0.0-alpha.9

### Patch Changes

- a4a1151: Fix playground freezing when buffer is passed between steps
- 124ce08: Ability to set maxTokens, temperature, and other common features in playground
- 23999d4: Add Design System tokens and components into playground ui

## 4.0.0-alpha.8

### Patch Changes

- 055c4ea: Fix traces page showing e.reduce error
- Updated dependencies [055c4ea]
- Updated dependencies [bffd64f]
- Updated dependencies [8df4a77]
  - @mastra/client-js@0.1.14-alpha.8
  - @mastra/core@0.8.0-alpha.8

## 4.0.0-alpha.7

### Patch Changes

- Updated dependencies [febc8a6]
  - @mastra/core@0.8.0-alpha.7
  - @mastra/client-js@0.1.14-alpha.7

## 4.0.0-alpha.6

### Patch Changes

- 9d13790: update playground-ui dynamic form, cleanups
- 40dca45: Fix expanding workflow sidebar not expanding the output section
- d16ed18: Make playground-ui dynamic forms better
- Updated dependencies [a3f0e90]
- Updated dependencies [5646a01]
  - @mastra/core@0.8.0-alpha.6
  - @mastra/client-js@0.1.14-alpha.6

## 4.0.0-alpha.5

### Patch Changes

- Updated dependencies [93875ed]
  - @mastra/core@0.8.0-alpha.5
  - @mastra/client-js@0.1.14-alpha.5

## 4.0.0-alpha.4

### Patch Changes

- Updated dependencies [d7e08e8]
  - @mastra/core@0.8.0-alpha.4
  - @mastra/client-js@0.1.14-alpha.4

## 4.0.0-alpha.3

### Patch Changes

- 5ae0180: Removed prefixed doc references
- 7bdbb64: Show no input when attributs are empty
- 8393832: Handle nested workflow view on workflow graph
- Updated dependencies [5ae0180]
- Updated dependencies [9bfa12b]
- Updated dependencies [515ebfb]
- Updated dependencies [88fa727]
- Updated dependencies [f37f535]
- Updated dependencies [789bef3]
- Updated dependencies [4d67826]
- Updated dependencies [6330967]
- Updated dependencies [8393832]
- Updated dependencies [6330967]
  - @mastra/core@0.8.0-alpha.3
  - @mastra/client-js@0.1.14-alpha.3

## 4.0.0-alpha.2

### Patch Changes

- Updated dependencies [56c31b7]
- Updated dependencies [dbbbf80]
- Updated dependencies [84fe241]
- Updated dependencies [99d43b9]
  - @mastra/core@0.8.0-alpha.2
  - @mastra/client-js@0.1.14-alpha.2

## 4.0.0-alpha.1

### Patch Changes

- Updated dependencies [619c39d]
- Updated dependencies [fe56be0]
- Updated dependencies [a0967a0]
- Updated dependencies [fca3b21]
- Updated dependencies [0118361]
- Updated dependencies [619c39d]
  - @mastra/core@0.8.0-alpha.1
  - @mastra/client-js@0.1.14-alpha.1

## 3.0.1-alpha.0

### Patch Changes

- 8076ecf: Unify workflow watch/start response
- Updated dependencies [107bcfe]
- Updated dependencies [5b4e19f]
- Updated dependencies [7599d77]
- Updated dependencies [cafae83]
- Updated dependencies [8076ecf]
- Updated dependencies [304397c]
  - @mastra/core@0.7.1-alpha.0
  - @mastra/client-js@0.1.14-alpha.0

## 3.0.0

### Patch Changes

- 6d5d9c6: Show tool calls in playground chat
- 2447900: Show No input for steps without input on traces UI
- c30787b: Stop automatically scrolling to bottom in agent chat if user has scrolled up
- 214e7ce: Only mark required fields as required on the playground
- 2134786: Fix traces navigation not working in playground
- Updated dependencies [b4fbc59]
- Updated dependencies [0206617]
- Updated dependencies [a838fde]
- Updated dependencies [a8bd4cf]
- Updated dependencies [7a3eeb0]
- Updated dependencies [0b54522]
- Updated dependencies [160f88e]
- Updated dependencies [b3b34f5]
- Updated dependencies [3811029]
- Updated dependencies [1af25d5]
- Updated dependencies [a4686e8]
- Updated dependencies [6530ad1]
- Updated dependencies [27439ad]
  - @mastra/core@0.7.0
  - @mastra/client-js@0.1.13

## 3.0.0-alpha.4

### Patch Changes

- 6d5d9c6: Show tool calls in playground chat

## 3.0.0-alpha.3

### Patch Changes

- 2134786: Fix traces navigation not working in playground
- Updated dependencies [160f88e]
- Updated dependencies [b3b34f5]
- Updated dependencies [a4686e8]
  - @mastra/client-js@0.1.13-alpha.3
  - @mastra/core@0.7.0-alpha.3

## 3.0.0-alpha.2

### Patch Changes

- Updated dependencies [a838fde]
- Updated dependencies [a8bd4cf]
- Updated dependencies [7a3eeb0]
- Updated dependencies [6530ad1]
  - @mastra/core@0.7.0-alpha.2
  - @mastra/client-js@0.1.13-alpha.2

## 3.0.0-alpha.1

### Patch Changes

- 2447900: Show No input for steps without input on traces UI
- c30787b: Stop automatically scrolling to bottom in agent chat if user has scrolled up
- 214e7ce: Only mark required fields as required on the playground
- Updated dependencies [0b54522]
- Updated dependencies [1af25d5]
- Updated dependencies [27439ad]
  - @mastra/core@0.7.0-alpha.1
  - @mastra/client-js@0.1.13-alpha.1

## 2.0.5-alpha.0

### Patch Changes

- Updated dependencies [b4fbc59]
- Updated dependencies [0206617]
- Updated dependencies [3811029]
  - @mastra/core@0.6.5-alpha.0
  - @mastra/client-js@0.1.13-alpha.0

## 2.0.4

### Patch Changes

- 933ea4d: Fix messages in thread not showing latest when switching between threads
- 9cba774: Fix new thread title not reflecting until refresh or new message is sent
- 77e4c35: Pop a dialog showing the functional condition when a functional condition is clicked on workflow graph
- 248cb07: Allow ai-sdk Message type for messages in agent generate and stream
  Fix sidebar horizontal overflow in playground
- Updated dependencies [6794797]
- Updated dependencies [fb68a80]
- Updated dependencies [05ef3e0]
- Updated dependencies [b56a681]
- Updated dependencies [248cb07]
  - @mastra/core@0.6.4
  - @mastra/client-js@0.1.12

## 2.0.4-alpha.1

### Patch Changes

- 77e4c35: Pop a dialog showing the functional condition when a functional condition is clicked on workflow graph
- Updated dependencies [6794797]
  - @mastra/core@0.6.4-alpha.1
  - @mastra/client-js@0.1.12-alpha.1

## 2.0.4-alpha.0

### Patch Changes

- 933ea4d: Fix messages in thread not showing latest when switching between threads
- 9cba774: Fix new thread title not reflecting until refresh or new message is sent
- 248cb07: Allow ai-sdk Message type for messages in agent generate and stream
  Fix sidebar horizontal overflow in playground
- Updated dependencies [fb68a80]
- Updated dependencies [05ef3e0]
- Updated dependencies [b56a681]
- Updated dependencies [248cb07]
  - @mastra/core@0.6.4-alpha.0
  - @mastra/client-js@0.1.12-alpha.0

## 2.0.3

### Patch Changes

- 404640e: AgentNetwork changeset
- Updated dependencies [404640e]
- Updated dependencies [3bce733]
  - @mastra/client-js@0.1.11
  - @mastra/core@0.6.3

## 2.0.3-alpha.1

### Patch Changes

- Updated dependencies [3bce733]
  - @mastra/core@0.6.3-alpha.1
  - @mastra/client-js@0.1.11-alpha.1

## 2.0.3-alpha.0

### Patch Changes

- 404640e: AgentNetwork changeset
- Updated dependencies [404640e]
  - @mastra/client-js@0.1.11-alpha.0
  - @mastra/core@0.6.3-alpha.0

## 2.0.2

### Patch Changes

- Updated dependencies [beaf1c2]
- Updated dependencies [3084e13]
  - @mastra/core@0.6.2
  - @mastra/client-js@0.1.10

## 2.0.2-alpha.0

### Patch Changes

- Updated dependencies [beaf1c2]
- Updated dependencies [3084e13]
  - @mastra/core@0.6.2-alpha.0
  - @mastra/client-js@0.1.10-alpha.0

## 2.0.1

### Patch Changes

- 1291e89: Add resizable-panel to playground-ui and use in agent and workflow sidebars
- 0850b4c: Watch and resume per run
- 5baf1ec: animate new traces
- 9116d70: Handle the different workflow methods in workflow graph
- 0709d99: add prop for dynamic empty text
- 9ba1e97: fix loading state for evals page
- Updated dependencies [fc2f89c]
- Updated dependencies [dfbb131]
- Updated dependencies [f4854ee]
- Updated dependencies [afaf73f]
- Updated dependencies [0850b4c]
- Updated dependencies [7bcfaee]
- Updated dependencies [4356859]
- Updated dependencies [44631b1]
- Updated dependencies [9116d70]
- Updated dependencies [6e559a0]
- Updated dependencies [5f43505]
  - @mastra/core@0.6.1
  - @mastra/client-js@0.1.9

## 2.0.1-alpha.2

### Patch Changes

- 0850b4c: Watch and resume per run
- 5baf1ec: animate new traces
- 9116d70: Handle the different workflow methods in workflow graph
- 0709d99: add prop for dynamic empty text
- Updated dependencies [fc2f89c]
- Updated dependencies [dfbb131]
- Updated dependencies [0850b4c]
- Updated dependencies [9116d70]
  - @mastra/core@0.6.1-alpha.2
  - @mastra/client-js@0.1.9-alpha.2

## 2.0.1-alpha.1

### Patch Changes

- 1291e89: Add resizable-panel to playground-ui and use in agent and workflow sidebars
- 9ba1e97: fix loading state for evals page
- Updated dependencies [f4854ee]
- Updated dependencies [afaf73f]
- Updated dependencies [4356859]
- Updated dependencies [44631b1]
- Updated dependencies [6e559a0]
- Updated dependencies [5f43505]
  - @mastra/core@0.6.1-alpha.1
  - @mastra/client-js@0.1.9-alpha.1

## 2.0.1-alpha.0

### Patch Changes

- Updated dependencies [7bcfaee]
  - @mastra/core@0.6.1-alpha.0
  - @mastra/client-js@0.1.9-alpha.0

## 2.0.0

### Patch Changes

- Updated dependencies [16b98d9]
- Updated dependencies [1c8cda4]
- Updated dependencies [95b4144]
- Updated dependencies [3729dbd]
- Updated dependencies [c2144f4]
  - @mastra/core@0.6.0
  - @mastra/client-js@0.1.8

## 2.0.0-alpha.1

### Patch Changes

- Updated dependencies [16b98d9]
- Updated dependencies [1c8cda4]
- Updated dependencies [95b4144]
- Updated dependencies [c2144f4]
  - @mastra/core@0.6.0-alpha.1
  - @mastra/client-js@0.1.8-alpha.1

## 1.0.1-alpha.0

### Patch Changes

- Updated dependencies [3729dbd]
  - @mastra/core@0.5.1-alpha.0
  - @mastra/client-js@0.1.8-alpha.0

## 1.0.0

### Patch Changes

- dbd9f2d: Handle different condition types on workflow graph
- 07a7470: Move WorkflowTrigger to playground-ui package and use in dev playground
- e5149bb: Fix playground-ui agent-evals tab-content
- d79aedf: Fix import/require paths in these package.json
- 144b3d5: Update traces table UI, agent Chat UI
  Fix get workflows breaking
- fd4a1d7: Update cjs bundling to make sure files are split
- Updated dependencies [a910463]
- Updated dependencies [59df7b6]
- Updated dependencies [22643eb]
- Updated dependencies [6feb23f]
- Updated dependencies [f2d6727]
- Updated dependencies [7a7a547]
- Updated dependencies [29f3a82]
- Updated dependencies [3d0e290]
- Updated dependencies [e9fbac5]
- Updated dependencies [301e4ee]
- Updated dependencies [960690d]
- Updated dependencies [ee667a2]
- Updated dependencies [dfbe4e9]
- Updated dependencies [dab255b]
- Updated dependencies [1e8bcbc]
- Updated dependencies [f6678e4]
- Updated dependencies [9e81f35]
- Updated dependencies [c93798b]
- Updated dependencies [a85ab24]
- Updated dependencies [dbd9f2d]
- Updated dependencies [59df7b6]
- Updated dependencies [caefaa2]
- Updated dependencies [c151ae6]
- Updated dependencies [52e0418]
- Updated dependencies [d79aedf]
- Updated dependencies [8deb34c]
- Updated dependencies [03236ec]
- Updated dependencies [3764e71]
- Updated dependencies [df982db]
- Updated dependencies [a171b37]
- Updated dependencies [506f1d5]
- Updated dependencies [02ffb7b]
- Updated dependencies [0461849]
- Updated dependencies [2259379]
- Updated dependencies [aeb5e36]
- Updated dependencies [f2301de]
- Updated dependencies [358f069]
- Updated dependencies [fd4a1d7]
- Updated dependencies [c139344]
  - @mastra/core@0.5.0
  - @mastra/client-js@0.1.7

## 1.0.0-alpha.12

### Patch Changes

- 07a7470: Move WorkflowTrigger to playground-ui package and use in dev playground
- Updated dependencies [a85ab24]
  - @mastra/core@0.5.0-alpha.12
  - @mastra/client-js@0.1.7-alpha.12

## 1.0.0-alpha.11

### Patch Changes

- dbd9f2d: Handle different condition types on workflow graph
- fd4a1d7: Update cjs bundling to make sure files are split
- Updated dependencies [7a7a547]
- Updated dependencies [c93798b]
- Updated dependencies [dbd9f2d]
- Updated dependencies [8deb34c]
- Updated dependencies [a171b37]
- Updated dependencies [fd4a1d7]
  - @mastra/core@0.5.0-alpha.11
  - @mastra/client-js@0.1.7-alpha.11

## 1.0.0-alpha.10

### Patch Changes

- Updated dependencies [a910463]
  - @mastra/core@0.5.0-alpha.10
  - @mastra/client-js@0.1.7-alpha.10

## 1.0.0-alpha.9

### Patch Changes

- Updated dependencies [e9fbac5]
- Updated dependencies [1e8bcbc]
- Updated dependencies [aeb5e36]
- Updated dependencies [f2301de]
  - @mastra/core@0.5.0-alpha.9
  - @mastra/client-js@0.1.7-alpha.9

## 1.0.0-alpha.8

### Patch Changes

- Updated dependencies [506f1d5]
  - @mastra/core@0.5.0-alpha.8
  - @mastra/client-js@0.1.7-alpha.8

## 1.0.0-alpha.7

### Patch Changes

- Updated dependencies [ee667a2]
  - @mastra/core@0.5.0-alpha.7
  - @mastra/client-js@0.1.7-alpha.7

## 1.0.0-alpha.6

### Patch Changes

- Updated dependencies [f6678e4]
  - @mastra/core@0.5.0-alpha.6
  - @mastra/client-js@0.1.7-alpha.6

## 1.0.0-alpha.5

### Patch Changes

- Updated dependencies [22643eb]
- Updated dependencies [6feb23f]
- Updated dependencies [f2d6727]
- Updated dependencies [301e4ee]
- Updated dependencies [dfbe4e9]
- Updated dependencies [9e81f35]
- Updated dependencies [caefaa2]
- Updated dependencies [c151ae6]
- Updated dependencies [52e0418]
- Updated dependencies [03236ec]
- Updated dependencies [3764e71]
- Updated dependencies [df982db]
- Updated dependencies [0461849]
- Updated dependencies [2259379]
- Updated dependencies [358f069]
  - @mastra/core@0.5.0-alpha.5
  - @mastra/client-js@0.1.7-alpha.5

## 1.0.0-alpha.4

### Patch Changes

- d79aedf: Fix import/require paths in these package.json
- 144b3d5: Update traces table UI, agent Chat UI
  Fix get workflows breaking
- Updated dependencies [d79aedf]
  - @mastra/core@0.5.0-alpha.4
  - @mastra/client-js@0.1.7-alpha.4

## 1.0.0-alpha.3

### Patch Changes

- Updated dependencies [3d0e290]
  - @mastra/core@0.5.0-alpha.3
  - @mastra/client-js@0.1.7-alpha.3

## 1.0.0-alpha.2

### Patch Changes

- Updated dependencies [02ffb7b]
  - @mastra/core@0.5.0-alpha.2
  - @mastra/client-js@0.1.7-alpha.2

## 1.0.0-alpha.1

### Patch Changes

- e5149bb: Fix playground-ui agent-evals tab-content
- Updated dependencies [dab255b]
  - @mastra/core@0.5.0-alpha.1
  - @mastra/client-js@0.1.7-alpha.1

## 1.0.0-alpha.0

### Patch Changes

- Updated dependencies [59df7b6]
- Updated dependencies [29f3a82]
- Updated dependencies [960690d]
- Updated dependencies [59df7b6]
- Updated dependencies [c139344]
  - @mastra/core@0.5.0-alpha.0
  - @mastra/client-js@0.1.7-alpha.0

## 0.0.2

### Patch Changes

- Updated dependencies [1da20e7]
  - @mastra/core@0.4.4
  - @mastra/client-js@0.1.6

## 0.0.2-alpha.0

### Patch Changes

- Updated dependencies [1da20e7]
  - @mastra/core@0.4.4-alpha.0
  - @mastra/client-js@0.1.6-alpha.0

## 0.0.1

### Patch Changes

- 7a64aff: playground-ui lib package to enhance dev/cloud ui unification
- 0d25b75: Add all agent stream,generate option to cliend-js sdk
- Updated dependencies [0d185b1]
- Updated dependencies [ed55f1d]
- Updated dependencies [06aa827]
- Updated dependencies [0fd78ac]
- Updated dependencies [2512a93]
- Updated dependencies [e62de74]
- Updated dependencies [0d25b75]
- Updated dependencies [fd14a3f]
- Updated dependencies [8d13b14]
- Updated dependencies [3f369a2]
- Updated dependencies [3ee4831]
- Updated dependencies [7a64aff]
- Updated dependencies [4d4e1e1]
- Updated dependencies [bb4f447]
- Updated dependencies [108793c]
- Updated dependencies [5f28f44]
- Updated dependencies [dabecf4]
  - @mastra/core@0.4.3
  - @mastra/client-js@0.1.5

## 0.0.1-alpha.3

### Patch Changes

- Updated dependencies [dabecf4]
  - @mastra/core@0.4.3-alpha.4
  - @mastra/client-js@0.1.5-alpha.4

## 0.0.1-alpha.2

### Patch Changes

- 7a64aff: playground-ui lib package to enhance dev/cloud ui unification
- 0d25b75: Add all agent stream,generate option to cliend-js sdk
- Updated dependencies [0fd78ac]
- Updated dependencies [0d25b75]
- Updated dependencies [fd14a3f]
- Updated dependencies [3f369a2]
- Updated dependencies [7a64aff]
- Updated dependencies [4d4e1e1]
- Updated dependencies [bb4f447]
  - @mastra/core@0.4.3-alpha.3
  - @mastra/client-js@0.1.5-alpha.3
