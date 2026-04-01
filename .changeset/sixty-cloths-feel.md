---
'mastracode': minor
---

Added headless config file support (`.mastracode/headless.json`) and new CLI flags (`--mode`, `--thinking-level`, `--config`, `--profile`) to headless mode. Users can configure model selection per execution mode (build/plan/fast), thinking level, and yolo preference via a checked-in config file or CLI flags. Named profiles allow multiple configurations in one file (e.g., `ci`, `review`) selected via `--profile <name>`. Flags override config/profile values.

The headless config `models` section now mirrors the full `settings.json` shape: `activeModelPackId` and `activeOmPackId` resolve built-in packs to models at runtime, `subagentModels` overrides per-agent model wiring, `omModelOverride` sets observer/reflector models directly, and `omObservationThreshold`/`omReflectionThreshold` control OM sensitivity. Explicit `modeDefaults` override pack references. See `mastracode --help` for details.
