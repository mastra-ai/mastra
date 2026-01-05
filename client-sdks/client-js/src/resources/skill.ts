import type { ClientOptions, Skill, ListSkillReferencesResponse, GetSkillReferenceResponse } from '../types';

import { BaseResource } from './base';

/**
 * Resource for interacting with a specific skill
 */
export class SkillResource extends BaseResource {
  constructor(
    options: ClientOptions,
    private skillName: string,
  ) {
    super(options);
  }

  /**
   * Gets the full details of this skill including instructions
   * @returns Promise containing skill details
   */
  details(): Promise<Skill> {
    return this.request(`/api/skills/${encodeURIComponent(this.skillName)}`);
  }

  /**
   * Lists all reference file paths for this skill
   * @returns Promise containing list of reference paths
   */
  listReferences(): Promise<ListSkillReferencesResponse> {
    return this.request(`/api/skills/${encodeURIComponent(this.skillName)}/references`);
  }

  /**
   * Gets the content of a specific reference file
   * @param referencePath - Path to the reference file
   * @returns Promise containing reference content
   */
  getReference(referencePath: string): Promise<GetSkillReferenceResponse> {
    return this.request(
      `/api/skills/${encodeURIComponent(this.skillName)}/references/${encodeURIComponent(referencePath)}`,
    );
  }
}
