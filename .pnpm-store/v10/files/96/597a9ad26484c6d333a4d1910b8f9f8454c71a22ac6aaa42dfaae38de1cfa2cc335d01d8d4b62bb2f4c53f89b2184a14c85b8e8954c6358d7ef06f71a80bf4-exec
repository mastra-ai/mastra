// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as TimeseriesGroupsAPI from './timeseries-groups';
import {
  TimeseriesGroupUserAgentParams,
  TimeseriesGroupUserAgentResponse,
  TimeseriesGroups,
} from './timeseries-groups';
import * as ToMarkdownAPI from './to-markdown';
import {
  ToMarkdown,
  ToMarkdownCreateParams,
  ToMarkdownCreateResponse,
  ToMarkdownCreateResponsesSinglePage,
} from './to-markdown';
import * as BotsAPI from './bots/bots';
import { Bots } from './bots/bots';
import * as InferenceAPI from './inference/inference';
import { Inference } from './inference/inference';

export class AI extends APIResource {
  toMarkdown: ToMarkdownAPI.ToMarkdown = new ToMarkdownAPI.ToMarkdown(this._client);
  inference: InferenceAPI.Inference = new InferenceAPI.Inference(this._client);
  bots: BotsAPI.Bots = new BotsAPI.Bots(this._client);
  timeseriesGroups: TimeseriesGroupsAPI.TimeseriesGroups = new TimeseriesGroupsAPI.TimeseriesGroups(
    this._client,
  );
}

AI.ToMarkdown = ToMarkdown;
AI.ToMarkdownCreateResponsesSinglePage = ToMarkdownCreateResponsesSinglePage;
AI.Inference = Inference;
AI.Bots = Bots;
AI.TimeseriesGroups = TimeseriesGroups;

export declare namespace AI {
  export {
    ToMarkdown as ToMarkdown,
    type ToMarkdownCreateResponse as ToMarkdownCreateResponse,
    ToMarkdownCreateResponsesSinglePage as ToMarkdownCreateResponsesSinglePage,
    type ToMarkdownCreateParams as ToMarkdownCreateParams,
  };

  export { Inference as Inference };

  export { Bots as Bots };

  export {
    TimeseriesGroups as TimeseriesGroups,
    type TimeseriesGroupUserAgentResponse as TimeseriesGroupUserAgentResponse,
    type TimeseriesGroupUserAgentParams as TimeseriesGroupUserAgentParams,
  };
}
