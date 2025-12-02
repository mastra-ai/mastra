// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import { SinglePage } from '../../pagination';

export class AudioTracks extends APIResource {
  /**
   * Deletes additional audio tracks on a video. Deleting a default audio track is
   * not allowed. You must assign another audio track as default prior to deletion.
   *
   * @example
   * ```ts
   * const audioTrack = await client.stream.audioTracks.delete(
   *   'ea95132c15732412d22c1476fa83f27a',
   *   'ea95132c15732412d22c1476fa83f27a',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  delete(
    identifier: string,
    audioIdentifier: string,
    params: AudioTrackDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<AudioTrackDeleteResponse> {
    const { account_id } = params;
    return (
      this._client.delete(
        `/accounts/${account_id}/stream/${identifier}/audio/${audioIdentifier}`,
        options,
      ) as Core.APIPromise<{ result: AudioTrackDeleteResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Adds an additional audio track to a video using the provided audio track URL.
   *
   * @example
   * ```ts
   * const audio = await client.stream.audioTracks.copy(
   *   'ea95132c15732412d22c1476fa83f27a',
   *   {
   *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *     label: 'director commentary',
   *   },
   * );
   * ```
   */
  copy(
    identifier: string,
    params: AudioTrackCopyParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<Audio> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/stream/${identifier}/audio/copy`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: Audio }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Edits additional audio tracks on a video. Editing the default status of an audio
   * track to `true` will mark all other audio tracks on the video default status to
   * `false`.
   *
   * @example
   * ```ts
   * const audio = await client.stream.audioTracks.edit(
   *   'ea95132c15732412d22c1476fa83f27a',
   *   'ea95132c15732412d22c1476fa83f27a',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  edit(
    identifier: string,
    audioIdentifier: string,
    params: AudioTrackEditParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<Audio> {
    const { account_id, ...body } = params;
    return (
      this._client.patch(`/accounts/${account_id}/stream/${identifier}/audio/${audioIdentifier}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: Audio }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Lists additional audio tracks on a video. Note this API will not return
   * information for audio attached to the video upload.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const audio of client.stream.audioTracks.get(
   *   'ea95132c15732412d22c1476fa83f27a',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * )) {
   *   // ...
   * }
   * ```
   */
  get(
    identifier: string,
    params: AudioTrackGetParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<AudioSinglePage, Audio> {
    const { account_id } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/stream/${identifier}/audio`,
      AudioSinglePage,
      options,
    );
  }
}

export class AudioSinglePage extends SinglePage<Audio> {}

export interface Audio {
  /**
   * Denotes whether the audio track will be played by default in a player.
   */
  default?: boolean;

  /**
   * A string to uniquely identify the track amongst other audio track labels for the
   * specified video.
   */
  label?: string;

  /**
   * Specifies the processing status of the video.
   */
  status?: 'queued' | 'ready' | 'error';

  /**
   * A Cloudflare-generated unique identifier for a media item.
   */
  uid?: string;
}

export type AudioTrackDeleteResponse = string;

export interface AudioTrackDeleteParams {
  /**
   * The account identifier tag.
   */
  account_id: string;
}

export interface AudioTrackCopyParams {
  /**
   * Path param: The account identifier tag.
   */
  account_id: string;

  /**
   * Body param: A string to uniquely identify the track amongst other audio track
   * labels for the specified video.
   */
  label: string;

  /**
   * Body param: An audio track URL. The server must be publicly routable and support
   * `HTTP HEAD` requests and `HTTP GET` range requests. The server should respond to
   * `HTTP HEAD` requests with a `content-range` header that includes the size of the
   * file.
   */
  url?: string;
}

export interface AudioTrackEditParams {
  /**
   * Path param: The account identifier tag.
   */
  account_id: string;

  /**
   * Body param: Denotes whether the audio track will be played by default in a
   * player.
   */
  default?: boolean;

  /**
   * Body param: A string to uniquely identify the track amongst other audio track
   * labels for the specified video.
   */
  label?: string;
}

export interface AudioTrackGetParams {
  /**
   * The account identifier tag.
   */
  account_id: string;
}

AudioTracks.AudioSinglePage = AudioSinglePage;

export declare namespace AudioTracks {
  export {
    type Audio as Audio,
    type AudioTrackDeleteResponse as AudioTrackDeleteResponse,
    AudioSinglePage as AudioSinglePage,
    type AudioTrackDeleteParams as AudioTrackDeleteParams,
    type AudioTrackCopyParams as AudioTrackCopyParams,
    type AudioTrackEditParams as AudioTrackEditParams,
    type AudioTrackGetParams as AudioTrackGetParams,
  };
}
