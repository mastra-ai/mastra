---
'mastracode': minor
---

Added headless config file support (`.mastracode/headless.json`) and new CLI flags (`--mode`, `--thinking-level`, `--config`) to headless mode. Users can configure model selection per execution mode (build/plan/fast), thinking level, and yolo preference via a checked-in config file or CLI flags. Flags override config file values. See `mastracode --help` for details.
