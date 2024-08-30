
import { Integration, IntegrationAuth } from '@arkw/core';
import { createClient, type NormalizeOAS } from 'fets'
import { z } from 'zod'
import type openapi from './openapi'
import { -multiple-albums } from './events/-multiple-albums'
import { -an-album } from './events/-an-album'
import { -an-albums-tracks } from './events/-an-albums-tracks'
import { -multiple-artists } from './events/-multiple-artists'
import { -an-artist } from './events/-an-artist'
import { -an-artists-albums } from './events/-an-artists-albums'
import { -an-artists-related-artists } from './events/-an-artists-related-artists'
import { -an-artists-top-tracks } from './events/-an-artists-top-tracks'
import { -audio-analysis } from './events/-audio-analysis'
import { -several-audio-features } from './events/-several-audio-features'
import { -audio-features } from './events/-audio-features'
import { -multiple-audiobooks } from './events/-multiple-audiobooks'
import { -an-audiobook } from './events/-an-audiobook'
import { -audiobook-chapters } from './events/-audiobook-chapters'
import { -categories } from './events/-categories'
import { -a-category } from './events/-a-category'
import { -a-categories-playlists } from './events/-a-categories-playlists'
import { -featured-playlists } from './events/-featured-playlists'
import { -new-releases } from './events/-new-releases'
import { -several-chapters } from './events/-several-chapters'
import { -a-chapter } from './events/-a-chapter'
import { -multiple-episodes } from './events/-multiple-episodes'
import { -an-episode } from './events/-an-episode'
import { -current-users-profile } from './events/-current-users-profile'
import { -users-saved-albums } from './events/-users-saved-albums'
import { check-users-saved-albums } from './events/check-users-saved-albums'
import { -users-saved-audiobooks } from './events/-users-saved-audiobooks'
import { check-users-saved-audiobooks } from './events/check-users-saved-audiobooks'
import { -users-saved-episodes } from './events/-users-saved-episodes'
import { check-users-saved-episodes } from './events/check-users-saved-episodes'
import { -followed } from './events/-followed'
import { check-current-user-follows } from './events/check-current-user-follows'
import { -information-about-the-users-current-playback } from './events/-information-about-the-users-current-playback'
import { -the-users-currently-playing-track } from './events/-the-users-currently-playing-track'
import { -a-users-available-devices } from './events/-a-users-available-devices'
import { -queue } from './events/-queue'
import { -recently-played } from './events/-recently-played'
import { -a-list-of-current-users-playlists } from './events/-a-list-of-current-users-playlists'
import { -users-saved-shows } from './events/-users-saved-shows'
import { check-users-saved-shows } from './events/check-users-saved-shows'
import { -users-top-artists-and-tracks } from './events/-users-top-artists-and-tracks'
import { -users-saved-tracks } from './events/-users-saved-tracks'
import { check-users-saved-tracks } from './events/check-users-saved-tracks'
import { -playlist } from './events/-playlist'
import { check-if-user-follows-playlist } from './events/check-if-user-follows-playlist'
import { -playlist-cover } from './events/-playlist-cover'
import { -playlists-tracks } from './events/-playlists-tracks'
import { -recommendations } from './events/-recommendations'
import { -recommendation-genres } from './events/-recommendation-genres'
import { search } from './events/search'
import { -multiple-shows } from './events/-multiple-shows'
import { -a-show } from './events/-a-show'
import { -a-shows-episodes } from './events/-a-shows-episodes'
import { -several-tracks } from './events/-several-tracks'
import { -track } from './events/-track'
import { -users-profile } from './events/-users-profile'
import { -list-users-playlists } from './events/-list-users-playlists'

type SpotifyConfig = {
  CLIENT_ID: string;
  CLIENT_SECRET: string;
  REDIRECT_URI: string;
  [key: string]: any;
};

export class SpotifyIntegration extends Integration {
  config: SpotifyConfig;

  constructor({ config }: { config: SpotifyConfig }) {
    config.authType = `OAUTH`;

    super({
      ...config,
      name: 'SPOTIFY',
      logoUrl: "TODO",
    });

    this.config = config;
  }

  registerEvents() {
    this.events = {
             'spotify.-multiple-albums/sync': {
                schema: z.object({
                  'QueryAlbumIds': z.string(),
'QueryMarket': z.string()}),
                handler: -multiple-albums,
            },
        

             'spotify.-an-album/sync': {
                schema: z.object({
                  'PathAlbumId': z.string(),
'QueryMarket': z.string(),
id: z.string()}),
                handler: -an-album,
            },
        

             'spotify.-an-albums-tracks/sync': {
                schema: z.object({
                  'PathAlbumId': z.string(),
'QueryMarket': z.string(),
'QueryLimit': z.string(),
'QueryOffset': z.string(),
id: z.string()}),
                handler: -an-albums-tracks,
            },
        

             'spotify.-multiple-artists/sync': {
                schema: z.object({
                  'ids': z.string()}),
                handler: -multiple-artists,
            },
        

             'spotify.-an-artist/sync': {
                schema: z.object({
                  'PathArtistId': z.string(),
id: z.string()}),
                handler: -an-artist,
            },
        

             'spotify.-an-artists-albums/sync': {
                schema: z.object({
                  'PathArtistId': z.string(),
'QueryIncludeGroups': z.string(),
'QueryMarket': z.string(),
'QueryLimit': z.string(),
'QueryOffset': z.string(),
id: z.string()}),
                handler: -an-artists-albums,
            },
        

             'spotify.-an-artists-related-artists/sync': {
                schema: z.object({
                  'PathArtistId': z.string(),
id: z.string()}),
                handler: -an-artists-related-artists,
            },
        

             'spotify.-an-artists-top-tracks/sync': {
                schema: z.object({
                  'PathArtistId': z.string(),
'QueryMarket': z.string(),
id: z.string()}),
                handler: -an-artists-top-tracks,
            },
        

             'spotify.-audio-analysis/sync': {
                schema: z.object({
                  'id': z.string(),
id: z.string()}),
                handler: -audio-analysis,
            },
        

             'spotify.-several-audio-features/sync': {
                schema: z.object({
                  'ids': z.string()}),
                handler: -several-audio-features,
            },
        

             'spotify.-audio-features/sync': {
                schema: z.object({
                  'id': z.string(),
id: z.string()}),
                handler: -audio-features,
            },
        

             'spotify.-multiple-audiobooks/sync': {
                schema: z.object({
                  'QueryAudiobookIds': z.string(),
'QueryMarket': z.string()}),
                handler: -multiple-audiobooks,
            },
        

             'spotify.-an-audiobook/sync': {
                schema: z.object({
                  'PathAudiobookId': z.string(),
'QueryMarket': z.string(),
id: z.string()}),
                handler: -an-audiobook,
            },
        

             'spotify.-audiobook-chapters/sync': {
                schema: z.object({
                  'PathAudiobookId': z.string(),
'QueryMarket': z.string(),
'QueryLimit': z.string(),
'QueryOffset': z.string(),
id: z.string()}),
                handler: -audiobook-chapters,
            },
        

             'spotify.-categories/sync': {
                schema: z.object({
                  'country': z.string(),
'locale': z.string(),
'QueryLimit': z.string(),
'QueryOffset': z.string()}),
                handler: -categories,
            },
        

             'spotify.-a-category/sync': {
                schema: z.object({
                  'category_id': z.string(),
'country': z.string(),
'locale': z.string(),
category_id: z.string()}),
                handler: -a-category,
            },
        

             'spotify.-a-categories-playlists/sync': {
                schema: z.object({
                  'category_id': z.string(),
'country': z.string(),
'QueryLimit': z.string(),
'QueryOffset': z.string(),
category_id: z.string()}),
                handler: -a-categories-playlists,
            },
        

             'spotify.-featured-playlists/sync': {
                schema: z.object({
                  'country': z.string(),
'locale': z.string(),
'timestamp': z.string(),
'QueryLimit': z.string(),
'QueryOffset': z.string()}),
                handler: -featured-playlists,
            },
        

             'spotify.-new-releases/sync': {
                schema: z.object({
                  'country': z.string(),
'QueryLimit': z.string(),
'QueryOffset': z.string()}),
                handler: -new-releases,
            },
        

             'spotify.-several-chapters/sync': {
                schema: z.object({
                  'QueryChapterIds': z.string(),
'QueryMarket': z.string()}),
                handler: -several-chapters,
            },
        

             'spotify.-a-chapter/sync': {
                schema: z.object({
                  'PathChapterId': z.string(),
'QueryMarket': z.string(),
id: z.string()}),
                handler: -a-chapter,
            },
        

             'spotify.-multiple-episodes/sync': {
                schema: z.object({
                  'ids': z.string(),
'QueryMarket': z.string()}),
                handler: -multiple-episodes,
            },
        

             'spotify.-an-episode/sync': {
                schema: z.object({
                  'id': z.string(),
'QueryMarket': z.string(),
id: z.string()}),
                handler: -an-episode,
            },
        

             'spotify.-current-users-profile/sync': {
                schema: z.object({}),
                handler: -current-users-profile,
            },
        

             'spotify.-users-saved-albums/sync': {
                schema: z.object({
                  'QueryLimit': z.string(),
'QueryOffset': z.string(),
'QueryMarket': z.string()}),
                handler: -users-saved-albums,
            },
        

             'spotify.check-users-saved-albums/sync': {
                schema: z.object({
                  'QueryAlbumIds': z.string()}),
                handler: check-users-saved-albums,
            },
        

             'spotify.-users-saved-audiobooks/sync': {
                schema: z.object({
                  'QueryLimit': z.string(),
'QueryOffset': z.string()}),
                handler: -users-saved-audiobooks,
            },
        

             'spotify.check-users-saved-audiobooks/sync': {
                schema: z.object({
                  'QueryAudiobookIds': z.string()}),
                handler: check-users-saved-audiobooks,
            },
        

             'spotify.-users-saved-episodes/sync': {
                schema: z.object({
                  'QueryMarket': z.string(),
'QueryLimit': z.string(),
'QueryOffset': z.string()}),
                handler: -users-saved-episodes,
            },
        

             'spotify.check-users-saved-episodes/sync': {
                schema: z.object({
                  'ids': z.string()}),
                handler: check-users-saved-episodes,
            },
        

             'spotify.-followed/sync': {
                schema: z.object({
                  'type': z.string(),
'after': z.string(),
'limit': z.number()}),
                handler: -followed,
            },
        

             'spotify.check-current-user-follows/sync': {
                schema: z.object({
                  'type': z.string(),
'ids': z.string()}),
                handler: check-current-user-follows,
            },
        

             'spotify.-information-about-the-users-current-playback/sync': {
                schema: z.object({
                  'QueryMarket': z.string(),
'QueryAdditionalTypes': z.string()}),
                handler: -information-about-the-users-current-playback,
            },
        

             'spotify.-the-users-currently-playing-track/sync': {
                schema: z.object({
                  'QueryMarket': z.string(),
'QueryAdditionalTypes': z.string()}),
                handler: -the-users-currently-playing-track,
            },
        

             'spotify.-a-users-available-devices/sync': {
                schema: z.object({}),
                handler: -a-users-available-devices,
            },
        

             'spotify.-queue/sync': {
                schema: z.object({}),
                handler: -queue,
            },
        

             'spotify.-recently-played/sync': {
                schema: z.object({
                  'limit': z.number(),
'after': z.number(),
'before': z.number()}),
                handler: -recently-played,
            },
        

             'spotify.-a-list-of-current-users-playlists/sync': {
                schema: z.object({
                  'QueryLimit': z.string(),
'offset': z.number()}),
                handler: -a-list-of-current-users-playlists,
            },
        

             'spotify.-users-saved-shows/sync': {
                schema: z.object({
                  'QueryLimit': z.string(),
'QueryOffset': z.string()}),
                handler: -users-saved-shows,
            },
        

             'spotify.check-users-saved-shows/sync': {
                schema: z.object({
                  'QueryShowIds': z.string()}),
                handler: check-users-saved-shows,
            },
        

             'spotify.-users-top-artists-and-tracks/sync': {
                schema: z.object({
                  'type': z.string(),
'time_range': z.string(),
'QueryLimit': z.string(),
'QueryOffset': z.string(),
type: z.string()}),
                handler: -users-top-artists-and-tracks,
            },
        

             'spotify.-users-saved-tracks/sync': {
                schema: z.object({
                  'QueryMarket': z.string(),
'QueryLimit': z.string(),
'QueryOffset': z.string()}),
                handler: -users-saved-tracks,
            },
        

             'spotify.check-users-saved-tracks/sync': {
                schema: z.object({
                  'QueryTrackIds': z.string()}),
                handler: check-users-saved-tracks,
            },
        

             'spotify.-playlist/sync': {
                schema: z.object({
                  'PathPlaylistId': z.string(),
'QueryMarket': z.string(),
'fields': z.string(),
'QueryAdditionalTypes': z.string(),
playlist_id: z.string()}),
                handler: -playlist,
            },
        

             'spotify.check-if-user-follows-playlist/sync': {
                schema: z.object({
                  'PathPlaylistId': z.string(),
'ids': z.string(),
playlist_id: z.string()}),
                handler: check-if-user-follows-playlist,
            },
        

             'spotify.-playlist-cover/sync': {
                schema: z.object({
                  'PathPlaylistId': z.string(),
playlist_id: z.string()}),
                handler: -playlist-cover,
            },
        

             'spotify.-playlists-tracks/sync': {
                schema: z.object({
                  'PathPlaylistId': z.string(),
'QueryMarket': z.string(),
'fields': z.string(),
'QueryLimit': z.string(),
'QueryOffset': z.string(),
'QueryAdditionalTypes': z.string(),
playlist_id: z.string()}),
                handler: -playlists-tracks,
            },
        

             'spotify.-recommendations/sync': {
                schema: z.object({
                  'limit': z.number(),
'QueryMarket': z.string(),
'seed_artists': z.string(),
'seed_genres': z.string(),
'seed_tracks': z.string(),
'min_acousticness': z.string(),
'max_acousticness': z.string(),
'target_acousticness': z.string(),
'min_danceability': z.string(),
'max_danceability': z.string(),
'target_danceability': z.string(),
'min_duration_ms': z.number(),
'max_duration_ms': z.number(),
'target_duration_ms': z.number(),
'min_energy': z.string(),
'max_energy': z.string(),
'target_energy': z.string(),
'min_instrumentalness': z.string(),
'max_instrumentalness': z.string(),
'target_instrumentalness': z.string(),
'min_key': z.number(),
'max_key': z.number(),
'target_key': z.number(),
'min_liveness': z.string(),
'max_liveness': z.string(),
'target_liveness': z.string(),
'min_loudness': z.string(),
'max_loudness': z.string(),
'target_loudness': z.string(),
'min_mode': z.number(),
'max_mode': z.number(),
'target_mode': z.number(),
'min_popularity': z.number(),
'max_popularity': z.number(),
'target_popularity': z.number(),
'min_speechiness': z.string(),
'max_speechiness': z.string(),
'target_speechiness': z.string(),
'min_tempo': z.string(),
'max_tempo': z.string(),
'target_tempo': z.string(),
'min_time_signature': z.number(),
'max_time_signature': z.number(),
'target_time_signature': z.number(),
'min_valence': z.string(),
'max_valence': z.string(),
'target_valence': z.string()}),
                handler: -recommendations,
            },
        

             'spotify.-recommendation-genres/sync': {
                schema: z.object({}),
                handler: -recommendation-genres,
            },
        

             'spotify.search/sync': {
                schema: z.object({
                  'q': z.string(),
'type': z.string(),
'QueryMarket': z.string(),
'limit': z.number(),
'offset': z.number(),
'include_external': z.string()}),
                handler: search,
            },
        

             'spotify.-multiple-shows/sync': {
                schema: z.object({
                  'QueryMarket': z.string(),
'QueryShowIds': z.string()}),
                handler: -multiple-shows,
            },
        

             'spotify.-a-show/sync': {
                schema: z.object({
                  'QueryMarket': z.string(),
'PathShowId': z.string(),
id: z.string()}),
                handler: -a-show,
            },
        

             'spotify.-a-shows-episodes/sync': {
                schema: z.object({
                  'PathShowId': z.string(),
'QueryMarket': z.string(),
'QueryLimit': z.string(),
'QueryOffset': z.string(),
id: z.string()}),
                handler: -a-shows-episodes,
            },
        

             'spotify.-several-tracks/sync': {
                schema: z.object({
                  'QueryMarket': z.string(),
'QueryTrackIds': z.string()}),
                handler: -several-tracks,
            },
        

             'spotify.-track/sync': {
                schema: z.object({
                  'id': z.string(),
'QueryMarket': z.string(),
id: z.string()}),
                handler: -track,
            },
        

             'spotify.-users-profile/sync': {
                schema: z.object({
                  'PathUserId': z.string(),
user_id: z.string()}),
                handler: -users-profile,
            },
        

             'spotify.-list-users-playlists/sync': {
                schema: z.object({
                  'PathUserId': z.string(),
'QueryLimit': z.string(),
'offset': z.number(),
user_id: z.string()}),
                handler: -list-users-playlists,
            },
        }
    return this.events;
  }


  async getApiClient({ referenceId }: { referenceId: string }) {
    const connection = await this.dataLayer?.getConnectionByReferenceId({ name: this.name, referenceId })

    if (!connection) {
      throw new Error(`Connection not found for referenceId: ${referenceId}`)
    }

    // TODO: HANDLE REFRESH TOKEN IF EXPIRED
    const credential = await this.dataLayer?.getCredentialsByConnectionId(connection.id)

    const client = createClient<NormalizeOAS<typeof openapi>>({
      endpoint: "https://api.spotify.com/v1",
      globalParams: {
        headers: {
          Authorization: `Bearer ${credential?.value}`
        }
      }
    })
    
    return client
  }

  getAuthenticator() {
    return new IntegrationAuth({
      dataAccess: this.dataLayer!,
      onConnectionCreated: () => {
        // TODO
      },
      config: {
        INTEGRATION_NAME: this.name,
        AUTH_TYPE: this.config.authType,
        CLIENT_ID: this.config.CLIENT_ID,
        CLIENT_SECRET: this.config.CLIENT_SECRET,
        REDIRECT_URI: this.config.REDIRECT_URI || this.corePresets.redirectURI,
        SERVER: `https://${this.config.zendesk_subdomain}.zendesk.com`,
        AUTHORIZATION_ENDPOINT: '/oauth/authorizations/new',
        TOKEN_ENDPOINT: '/oauth/authorizations/tokens',
        SCOPES: [],
      },
    });
  }
}
    
    