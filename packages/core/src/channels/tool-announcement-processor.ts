import type { Processor, ProcessOutputStreamArgs } from '../processors';
import type { RequestContext } from '../request-context';
import type { ChunkType } from '../stream';
import { resolveChannelRenderContext } from './thread-lookup';
import type { ChannelsSource } from './thread-lookup';

export interface ChannelToolAnnouncement {
  toolName: string;
  args: unknown;
  result: unknown;
  requestContext: RequestContext;
}

export interface ChannelToolAnnouncementOptions {
  /** Markdown to post in the run's chat thread after a tool succeeds, or undefined to post nothing. */
  announce: (tool: ChannelToolAnnouncement) => string | undefined;
  /** The channels the run's thread may be linked to, so runs not started in the channel announce too. */
  channels?: ChannelsSource;
}

/**
 * Posts into the run's chat thread when a tool call produces something people
 * there should know about, such as an opened pull request, whether or not the
 * agent mentions it. The host decides what is worth a post; failed calls never
 * announce. The post is not awaited, so the run never waits on the platform.
 */
export class ChannelToolAnnouncementProcessor implements Processor {
  readonly id = 'channel-tool-announcement';
  readonly #options: ChannelToolAnnouncementOptions;

  constructor(options: ChannelToolAnnouncementOptions) {
    this.#options = options;
  }

  async processOutputStream({ part, requestContext }: ProcessOutputStreamArgs): Promise<ChunkType> {
    if (part.type !== 'tool-result' || !requestContext) return part;
    const { toolName, args, result, isError, preliminary } = part.payload;
    if (isError || preliminary) return part;
    const markdown = this.#options.announce({ toolName, args, result, requestContext });
    if (!markdown) return part;
    void resolveChannelRenderContext(requestContext, this.#options.channels)
      .then(render => render?.chatThread.post({ markdown }))
      .catch(error => console.warn('[channels] tool announcement failed', error));
    return part;
  }
}
