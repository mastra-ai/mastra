// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as ProjectsAPI from './projects/projects';
import {
  Deployment,
  DeploymentsSinglePage,
  Project,
  ProjectCreateParams,
  ProjectDeleteParams,
  ProjectDeleteResponse,
  ProjectEditParams,
  ProjectGetParams,
  ProjectListParams,
  ProjectPurgeBuildCacheParams,
  ProjectPurgeBuildCacheResponse,
  Projects,
  Stage,
} from './projects/projects';

export class Pages extends APIResource {
  projects: ProjectsAPI.Projects = new ProjectsAPI.Projects(this._client);
}

Pages.Projects = Projects;
Pages.DeploymentsSinglePage = DeploymentsSinglePage;

export declare namespace Pages {
  export {
    Projects as Projects,
    type Deployment as Deployment,
    type Project as Project,
    type Stage as Stage,
    type ProjectDeleteResponse as ProjectDeleteResponse,
    type ProjectPurgeBuildCacheResponse as ProjectPurgeBuildCacheResponse,
    DeploymentsSinglePage as DeploymentsSinglePage,
    type ProjectCreateParams as ProjectCreateParams,
    type ProjectListParams as ProjectListParams,
    type ProjectDeleteParams as ProjectDeleteParams,
    type ProjectEditParams as ProjectEditParams,
    type ProjectGetParams as ProjectGetParams,
    type ProjectPurgeBuildCacheParams as ProjectPurgeBuildCacheParams,
  };
}
