import { z } from 'zod/v4';

export const STUDIO_AREA_SECTION_KEY = 'areas';
const STORAGE_KEY = 'mastra:studio:area-visibility:v2';
const LEGACY_STORAGE_KEY = 'mastra:studio:area-visibility:v1';
const placementsSchema = z.record(z.string(), z.enum(['sidebar', 'more', 'hidden']));
type Placements = z.infer<typeof placementsSchema>;

function getPlacement(placements: Placements, ...names: string[]) {
  for (const name of names) {
    // Prefer the canonical area key when the former desktop and mobile choices differ.
    const value = placements[`areas:${name}`] ?? placements[`more:${name}`];
    if (value) return value;
  }
  return undefined;
}

function resourcesPlacement(placements: Placements) {
  const canonical = getPlacement(placements, 'Resources');
  if (canonical) return canonical;
  const connections = getPlacement(placements, 'Connections');
  const workspaces = getPlacement(placements, 'Workspaces');
  if (!connections && !workspaces) return undefined;
  // An uncustomized former area was visible by default. Preserve either visible entry.
  if (!connections || !workspaces || connections === 'sidebar' || workspaces === 'sidebar') return 'sidebar';
  if (connections === 'more' || workspaces === 'more') return 'more';
  return 'hidden';
}

/** Migrate once before Sidebar.Sections reads storage; desktop and mobile share one namespace. */
export function migrateStudioAreaVisibility() {
  try {
    if (localStorage.getItem(STORAGE_KEY) !== null) return STORAGE_KEY;
    const parsed = placementsSchema.safeParse(JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) ?? '{}'));
    const legacy = parsed.success ? parsed.data : {};
    const placements: Placements = {};
    const choices = {
      Chat: getPlacement(legacy, 'Chat'),
      Build: getPlacement(legacy, 'Build', 'Agents'),
      Evaluate: getPlacement(legacy, 'Evaluate'),
      Monitor: getPlacement(legacy, 'Monitor', 'Observe'),
      Resources: resourcesPlacement(legacy),
    };
    for (const [name, placement] of Object.entries(choices)) {
      if (placement) placements[`${STUDIO_AREA_SECTION_KEY}:${name}`] = placement;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(placements));
  } catch {
    // A malformed or inaccessible preference must never block Studio navigation.
  }
  return STORAGE_KEY;
}
