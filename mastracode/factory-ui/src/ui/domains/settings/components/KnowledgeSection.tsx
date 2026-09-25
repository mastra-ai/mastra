/**
 * Knowledge settings page.
 *
 * Top-level container for everything organized around the Factory's Knowledge
 * runtime — currently just the connect-driven importer providers, but any
 * future knowledge-adjacent settings (scope defaults, access profiles,
 * curation preferences) belong here rather than under Work Intake.
 *
 * The page is only mounted when `useServerFeatures().data?.knowledge === true`
 * — see `SettingsPanel` for the redirect that keeps the URL honest when the
 * feature is off. `KnowledgeImportersSection` also self-gates on the same
 * flag as a defence in depth so a stray render can never surface a dead
 * Connect button.
 */

import { KnowledgeImportersSection } from './KnowledgeImportersSection';

export function KnowledgeSection() {
  return (
    <div className="flex flex-col gap-6">
      <KnowledgeImportersSection />
    </div>
  );
}
