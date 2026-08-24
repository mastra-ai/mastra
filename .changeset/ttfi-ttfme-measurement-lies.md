---
'@mastra/factory': patch
---

Fix TTFI/TTFME measurement lies on `source_control_sessions`.

`first_message_at` no longer stamps on skill loads, phase markers, or other `role='signal'` writes: it now fires on the first `message_start` event whose role is `user` or `assistant`, so zero-message model-init failures correctly stay NULL and drop out of TTFI percentiles instead of contaminating them.

`first_meaningful_exec_at` no longer requires a foreground `execute_command` exit. It now stamps on the first successful `tool_end` for any workspace tool (names starting with `mastra_workspace_` or the post-remap mastracode tool names — `view`, `write_file`, `string_replace_lsp`, `find_files`, `delete_file`, `file_stat`, `mkdir`, `search_content`, `ast_smart_edit`, `lsp_inspect`, `execute_command`, `get_process_output`, `kill_process`). Sessions that read files or grepped the workspace but never ran a shell command now count toward TTFME.
