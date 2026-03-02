---
'mastracode': patch
---

Fixed test failures caused by cross-test module contamination (vi.resetModules) and wired edit tools (string_replace_lsp, ast_smart_edit, write_file) into createDynamicTools() so they pick up the project root from harness state
