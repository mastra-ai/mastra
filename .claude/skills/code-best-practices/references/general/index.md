# General Principles

- UI should not lie unless explicitly requested by the user. Keeping the frontend honest helps reveal errors instead of hiding them.
- Prefer a single source of truth (SSOT) for facts and rules that must stay consistent. Reuse or derive them to reduce drift, while preserving intentional duplication required by compatibility or package boundaries. Avoid coupling behavior that should evolve independently.
