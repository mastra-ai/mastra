export const comments = {
  "getAnAlbum": {
    "comment": "Get Album",
    "doc": "Get Album\n \n  Get Spotify catalog information for a single album."
  },
  "getMultipleAlbums": {
    "comment": "Get Several Albums",
    "doc": "Get Several Albums\n \n  Get Spotify catalog information for multiple albums identified by their Spotify IDs."
  },
  "getAnAlbumsTracks": {
    "comment": "Get Album Tracks",
    "doc": "Get Album Tracks\n \n  Get Spotify catalog information about an album’s tracks.\n  Optional parameters can be used to limit the number of tracks returned."
  },
  "getAnArtist": {
    "comment": "Get Artist",
    "doc": "Get Artist\n \n  Get Spotify catalog information for a single artist identified by their unique Spotify ID."
  },
  "getMultipleArtists": {
    "comment": "Get Several Artists",
    "doc": "Get Several Artists\n \n  Get Spotify catalog information for several artists based on their Spotify IDs."
  },
  "getAnArtistsAlbums": {
    "comment": "Get Artist's Albums",
    "doc": "Get Artist's Albums\n \n  Get Spotify catalog information about an artist's albums."
  },
  "getAnArtistsTopTracks": {
    "comment": "Get Artist's Top Tracks",
    "doc": "Get Artist's Top Tracks\n \n  Get Spotify catalog information about an artist's top tracks by country."
  },
  "getAnArtistsRelatedArtists": {
    "comment": "Get Artist's Related Artists",
    "doc": "Get Artist's Related Artists\n \n  Get Spotify catalog information about artists similar to a given artist. Similarity is based on analysis of the Spotify community's listening history."
  },
  "getAShow": {
    "comment": "Get Show",
    "doc": "Get Show\n \n  Get Spotify catalog information for a single show identified by its\n  unique Spotify ID."
  },
  "getMultipleShows": {
    "comment": "Get Several Shows",
    "doc": "Get Several Shows\n \n  Get Spotify catalog information for several shows based on their Spotify IDs."
  },
  "getAShowsEpisodes": {
    "comment": "Get Show Episodes",
    "doc": "Get Show Episodes\n \n  Get Spotify catalog information about an show’s episodes. Optional parameters can be used to limit the number of episodes returned."
  },
  "getAnEpisode": {
    "comment": "Get Episode",
    "doc": "Get Episode\n \n  Get Spotify catalog information for a single episode identified by its\n  unique Spotify ID."
  },
  "getMultipleEpisodes": {
    "comment": "Get Several Episodes",
    "doc": "Get Several Episodes\n \n  Get Spotify catalog information for several episodes based on their Spotify IDs."
  },
  "getAnAudiobook": {
    "comment": "Get an Audiobook",
    "doc": "Get an Audiobook\n \n  Get Spotify catalog information for a single audiobook. Audiobooks are only available within the US, UK, Canada, Ireland, New Zealand and Australia markets."
  },
  "getMultipleAudiobooks": {
    "comment": "Get Several Audiobooks",
    "doc": "Get Several Audiobooks\n \n  Get Spotify catalog information for several audiobooks identified by their Spotify IDs. Audiobooks are only available within the US, UK, Canada, Ireland, New Zealand and Australia markets."
  },
  "getAudiobookChapters": {
    "comment": "Get Audiobook Chapters",
    "doc": "Get Audiobook Chapters\n \n  Get Spotify catalog information about an audiobook's chapters. Audiobooks are only available within the US, UK, Canada, Ireland, New Zealand and Australia markets."
  },
  "getUsersSavedAudiobooks": {
    "comment": "Get User's Saved Audiobooks",
    "doc": "Get User's Saved Audiobooks\n \n  Get a list of the audiobooks saved in the current Spotify user's 'Your Music' library."
  },
  "saveAudiobooksUser": {
    "comment": "Save Audiobooks for Current User",
    "doc": "Save Audiobooks for Current User\n \n  Save one or more audiobooks to the current Spotify user's library."
  },
  "removeAudiobooksUser": {
    "comment": "Remove User's Saved Audiobooks",
    "doc": "Remove User's Saved Audiobooks\n \n  Remove one or more audiobooks from the Spotify user's library."
  },
  "checkUsersSavedAudiobooks": {
    "comment": "Check User's Saved Audiobooks",
    "doc": "Check User's Saved Audiobooks\n \n  Check if one or more audiobooks are already saved in the current Spotify user's library."
  },
  "getAChapter": {
    "comment": "Get a Chapter",
    "doc": "Get a Chapter\n \n  Get Spotify catalog information for a single audiobook chapter. Chapters are only available within the US, UK, Canada, Ireland, New Zealand and Australia markets."
  },
  "getSeveralChapters": {
    "comment": "Get Several Chapters",
    "doc": "Get Several Chapters\n \n  Get Spotify catalog information for several audiobook chapters identified by their Spotify IDs. Chapters are only available within the US, UK, Canada, Ireland, New Zealand and Australia markets."
  },
  "getTrack": {
    "comment": "Get Track",
    "doc": "Get Track\n \n  Get Spotify catalog information for a single track identified by its\n  unique Spotify ID."
  },
  "getSeveralTracks": {
    "comment": "Get Several Tracks",
    "doc": "Get Several Tracks\n \n  Get Spotify catalog information for multiple tracks based on their Spotify IDs."
  },
  "search": {
    "comment": "Search for Item",
    "doc": "Search for Item\n \n  Get Spotify catalog information about albums, artists, playlists, tracks, shows, episodes or audiobooks\n  that match a keyword string. Audiobooks are only available within the US, UK, Canada, Ireland, New Zealand and Australia markets."
  },
  "getCurrentUsersProfile": {
    "comment": "Get Current User's Profile",
    "doc": "Get Current User's Profile\n \n  Get detailed profile information about the current user (including the\n  current user's username)."
  },
  "getPlaylist": {
    "comment": "Get Playlist",
    "doc": "Get Playlist\n \n  Get a playlist owned by a Spotify user."
  },
  "changePlaylistDetails": {
    "comment": "Change Playlist Details",
    "doc": "Change Playlist Details\n \n  Change a playlist's name and public/private state. (The user must, of\n  course, own the playlist.)"
  },
  "getPlaylistsTracks": {
    "comment": "Get Playlist Items",
    "doc": "Get Playlist Items\n \n  Get full details of the items of a playlist owned by a Spotify user."
  },
  "addTracksToPlaylist": {
    "comment": "Add Items to Playlist",
    "doc": "Add Items to Playlist\n \n  Add one or more items to a user's playlist."
  },
  "reorderOrReplacePlaylistsTracks": {
    "comment": "Update Playlist Items",
    "doc": "Update Playlist Items\n \n  Either reorder or replace items in a playlist depending on the request's parameters.\n  To reorder items, include `range_start`, `insert_before`, `range_length` and `snapshot_id` in the request's body.\n  To replace items, include `uris` as either a query parameter or in the request's body.\n  Replacing items in a playlist will overwrite its existing items. This operation can be used for replacing or clearing items in a playlist.\n  <br/>\n  Note: Replace and reorder are mutually exclusive operations which share the same endpoint, but have different parameters.\n  These operations can't be applied together in a single request."
  },
  "removeTracksPlaylist": {
    "comment": "Remove Playlist Items",
    "doc": "Remove Playlist Items\n \n  Remove one or more items from a user's playlist."
  },
  "getAListOfCurrentUsersPlaylists": {
    "comment": "Get Current User's Playlists",
    "doc": "Get Current User's Playlists\n \n  Get a list of the playlists owned or followed by the current Spotify\n  user."
  },
  "getUsersSavedAlbums": {
    "comment": "Get User's Saved Albums",
    "doc": "Get User's Saved Albums\n \n  Get a list of the albums saved in the current Spotify user's 'Your Music' library."
  },
  "saveAlbumsUser": {
    "comment": "Save Albums for Current User",
    "doc": "Save Albums for Current User\n \n  Save one or more albums to the current user's 'Your Music' library."
  },
  "removeAlbumsUser": {
    "comment": "Remove Users' Saved Albums",
    "doc": "Remove Users' Saved Albums\n \n  Remove one or more albums from the current user's 'Your Music' library."
  },
  "checkUsersSavedAlbums": {
    "comment": "Check User's Saved Albums",
    "doc": "Check User's Saved Albums\n \n  Check if one or more albums is already saved in the current Spotify user's 'Your Music' library."
  },
  "getUsersSavedTracks": {
    "comment": "Get User's Saved Tracks",
    "doc": "Get User's Saved Tracks\n \n  Get a list of the songs saved in the current Spotify user's 'Your Music' library."
  },
  "saveTracksUser": {
    "comment": "Save Tracks for Current User",
    "doc": "Save Tracks for Current User\n \n  Save one or more tracks to the current user's 'Your Music' library."
  },
  "removeTracksUser": {
    "comment": "Remove User's Saved Tracks",
    "doc": "Remove User's Saved Tracks\n \n  Remove one or more tracks from the current user's 'Your Music' library."
  },
  "checkUsersSavedTracks": {
    "comment": "Check User's Saved Tracks",
    "doc": "Check User's Saved Tracks\n \n  Check if one or more tracks is already saved in the current Spotify user's 'Your Music' library."
  },
  "getUsersSavedEpisodes": {
    "comment": "Get User's Saved Episodes",
    "doc": "Get User's Saved Episodes\n \n  Get a list of the episodes saved in the current Spotify user's library.<br/>\n  This API endpoint is in __beta__ and could change without warning. Please share any feedback that you have, or issues that you discover, in our [developer community forum](https://community.spotify.com/t5/Spotify-for-Developers/bd-p/Spotify_Developer)."
  },
  "saveEpisodesUser": {
    "comment": "Save Episodes for Current User",
    "doc": "Save Episodes for Current User\n \n  Save one or more episodes to the current user's library.<br/>\n  This API endpoint is in __beta__ and could change without warning. Please share any feedback that you have, or issues that you discover, in our [developer community forum](https://community.spotify.com/t5/Spotify-for-Developers/bd-p/Spotify_Developer)."
  },
  "removeEpisodesUser": {
    "comment": "Remove User's Saved Episodes",
    "doc": "Remove User's Saved Episodes\n \n  Remove one or more episodes from the current user's library.<br/>\n  This API endpoint is in __beta__ and could change without warning. Please share any feedback that you have, or issues that you discover, in our [developer community forum](https://community.spotify.com/t5/Spotify-for-Developers/bd-p/Spotify_Developer)."
  },
  "checkUsersSavedEpisodes": {
    "comment": "Check User's Saved Episodes",
    "doc": "Check User's Saved Episodes\n \n  Check if one or more episodes is already saved in the current Spotify user's 'Your Episodes' library.<br/>\n  This API endpoint is in __beta__ and could change without warning. Please share any feedback that you have, or issues that you discover, in our [developer community forum](https://community.spotify.com/t5/Spotify-for-Developers/bd-p/Spotify_Developer).."
  },
  "getUsersSavedShows": {
    "comment": "Get User's Saved Shows",
    "doc": "Get User's Saved Shows\n \n  Get a list of shows saved in the current Spotify user's library. Optional parameters can be used to limit the number of shows returned."
  },
  "saveShowsUser": {
    "comment": "Save Shows for Current User",
    "doc": "Save Shows for Current User\n \n  Save one or more shows to current Spotify user's library."
  },
  "removeShowsUser": {
    "comment": "Remove User's Saved Shows",
    "doc": "Remove User's Saved Shows\n \n  Delete one or more shows from current Spotify user's library."
  },
  "checkUsersSavedShows": {
    "comment": "Check User's Saved Shows",
    "doc": "Check User's Saved Shows\n \n  Check if one or more shows is already saved in the current Spotify user's library."
  },
  "getUsersTopArtistsAndTracks": {
    "comment": "Get User's Top Items",
    "doc": "Get User's Top Items\n \n  Get the current user's top artists or tracks based on calculated affinity."
  },
  "getUsersProfile": {
    "comment": "Get User's Profile",
    "doc": "Get User's Profile\n \n  Get public profile information about a Spotify user."
  },
  "getListUsersPlaylists": {
    "comment": "Get User's Playlists",
    "doc": "Get User's Playlists\n \n  Get a list of the playlists owned or followed by a Spotify user."
  },
  "createPlaylist": {
    "comment": "Create Playlist",
    "doc": "Create Playlist\n \n  Create a playlist for a Spotify user. (The playlist will be empty until\n  you [add tracks](/documentation/web-api/reference/add-tracks-to-playlist).)\n  Each user is generally limited to a maximum of 11000 playlists."
  },
  "followPlaylist": {
    "comment": "Follow Playlist",
    "doc": "Follow Playlist\n \n  Add the current user as a follower of a playlist."
  },
  "unfollowPlaylist": {
    "comment": "Unfollow Playlist",
    "doc": "Unfollow Playlist\n \n  Remove the current user as a follower of a playlist."
  },
  "getFeaturedPlaylists": {
    "comment": "Get Featured Playlists",
    "doc": "Get Featured Playlists\n \n  Get a list of Spotify featured playlists (shown, for example, on a Spotify player's 'Browse' tab)."
  },
  "getCategories": {
    "comment": "Get Several Browse Categories",
    "doc": "Get Several Browse Categories\n \n  Get a list of categories used to tag items in Spotify (on, for example, the Spotify player’s “Browse” tab)."
  },
  "getACategory": {
    "comment": "Get Single Browse Category",
    "doc": "Get Single Browse Category\n \n  Get a single category used to tag items in Spotify (on, for example, the Spotify player’s “Browse” tab)."
  },
  "getACategoriesPlaylists": {
    "comment": "Get Category's Playlists",
    "doc": "Get Category's Playlists\n \n  Get a list of Spotify playlists tagged with a particular category."
  },
  "getPlaylistCover": {
    "comment": "Get Playlist Cover Image",
    "doc": "Get Playlist Cover Image\n \n  Get the current image associated with a specific playlist."
  },
  "uploadCustomPlaylistCover": {
    "comment": "Add Custom Playlist Cover Image",
    "doc": "Add Custom Playlist Cover Image\n \n  Replace the image used to represent a specific playlist."
  },
  "getNewReleases": {
    "comment": "Get New Releases",
    "doc": "Get New Releases\n \n  Get a list of new album releases featured in Spotify (shown, for example, on a Spotify player’s “Browse” tab)."
  },
  "getFollowed": {
    "comment": "Get Followed Artists",
    "doc": "Get Followed Artists\n \n  Get the current user's followed artists."
  },
  "followArtistsUsers": {
    "comment": "Follow Artists or Users",
    "doc": "Follow Artists or Users\n \n  Add the current user as a follower of one or more artists or other Spotify users."
  },
  "unfollowArtistsUsers": {
    "comment": "Unfollow Artists or Users",
    "doc": "Unfollow Artists or Users\n \n  Remove the current user as a follower of one or more artists or other Spotify users."
  },
  "checkCurrentUserFollows": {
    "comment": "Check If User Follows Artists or Users",
    "doc": "Check If User Follows Artists or Users\n \n  Check to see if the current user is following one or more artists or other Spotify users."
  },
  "checkIfUserFollowsPlaylist": {
    "comment": "Check if Current User Follows Playlist",
    "doc": "Check if Current User Follows Playlist\n \n  Check to see if the current user is following a specified playlist."
  },
  "getSeveralAudioFeatures": {
    "comment": "Get Several Tracks' Audio Features",
    "doc": "Get Several Tracks' Audio Features\n \n  Get audio features for multiple tracks based on their Spotify IDs."
  },
  "getAudioFeatures": {
    "comment": "Get Track's Audio Features",
    "doc": "Get Track's Audio Features\n \n  Get audio feature information for a single track identified by its unique\n  Spotify ID."
  },
  "getAudioAnalysis": {
    "comment": "Get Track's Audio Analysis",
    "doc": "Get Track's Audio Analysis\n \n  Get a low-level audio analysis for a track in the Spotify catalog. The audio analysis describes the track’s structure and musical content, including rhythm, pitch, and timbre."
  },
  "getRecommendations": {
    "comment": "Get Recommendations",
    "doc": "Get Recommendations\n \n  Recommendations are generated based on the available information for a given seed entity and matched against similar artists and tracks. If there is sufficient information about the provided seeds, a list of tracks will be returned together with pool size details.\n \n  For artists and tracks that are very new or obscure there might not be enough data to generate a list of tracks."
  },
  "getRecommendationGenres": {
    "comment": "Get Available Genre Seeds",
    "doc": "Get Available Genre Seeds\n \n  Retrieve a list of available genres seed parameter values for [recommendations](/documentation/web-api/reference/get-recommendations)."
  },
  "getInformationAboutTheUsersCurrentPlayback": {
    "comment": "Get Playback State",
    "doc": "Get Playback State\n \n  Get information about the user’s current playback state, including track or episode, progress, and active device."
  },
  "transferAUsersPlayback": {
    "comment": "Transfer Playback",
    "doc": "Transfer Playback\n \n  Transfer playback to a new device and optionally begin playback. This API only works for users who have Spotify Premium. The order of execution is not guaranteed when you use this API with other Player API endpoints."
  },
  "getAUsersAvailableDevices": {
    "comment": "Get Available Devices",
    "doc": "Get Available Devices\n \n  Get information about a user’s available Spotify Connect devices. Some device models are not supported and will not be listed in the API response."
  },
  "getTheUsersCurrentlyPlayingTrack": {
    "comment": "Get Currently Playing Track",
    "doc": "Get Currently Playing Track\n \n  Get the object currently being played on the user's Spotify account."
  },
  "startAUsersPlayback": {
    "comment": "Start/Resume Playback",
    "doc": "Start/Resume Playback\n \n  Start a new context or resume current playback on the user's active device. This API only works for users who have Spotify Premium. The order of execution is not guaranteed when you use this API with other Player API endpoints."
  },
  "pauseAUsersPlayback": {
    "comment": "Pause Playback",
    "doc": "Pause Playback\n \n  Pause playback on the user's account. This API only works for users who have Spotify Premium. The order of execution is not guaranteed when you use this API with other Player API endpoints."
  },
  "skipUsersPlaybackToNextTrack": {
    "comment": "Skip To Next",
    "doc": "Skip To Next\n \n  Skips to next track in the user’s queue. This API only works for users who have Spotify Premium. The order of execution is not guaranteed when you use this API with other Player API endpoints."
  },
  "skipUsersPlaybackToPreviousTrack": {
    "comment": "Skip To Previous",
    "doc": "Skip To Previous\n \n  Skips to previous track in the user’s queue. This API only works for users who have Spotify Premium. The order of execution is not guaranteed when you use this API with other Player API endpoints."
  },
  "seekToPositionInCurrentlyPlayingTrack": {
    "comment": "Seek To Position",
    "doc": "Seek To Position\n \n  Seeks to the given position in the user’s currently playing track. This API only works for users who have Spotify Premium. The order of execution is not guaranteed when you use this API with other Player API endpoints."
  },
  "setRepeatModeOnUsersPlayback": {
    "comment": "Set Repeat Mode",
    "doc": "Set Repeat Mode\n \n  Set the repeat mode for the user's playback. This API only works for users who have Spotify Premium. The order of execution is not guaranteed when you use this API with other Player API endpoints."
  },
  "setVolumeForUsersPlayback": {
    "comment": "Set Playback Volume",
    "doc": "Set Playback Volume\n \n  Set the volume for the user’s current playback device. This API only works for users who have Spotify Premium. The order of execution is not guaranteed when you use this API with other Player API endpoints."
  },
  "toggleShuffleForUsersPlayback": {
    "comment": "Toggle Playback Shuffle",
    "doc": "Toggle Playback Shuffle\n \n  Toggle shuffle on or off for user’s playback. This API only works for users who have Spotify Premium. The order of execution is not guaranteed when you use this API with other Player API endpoints."
  },
  "getRecentlyPlayed": {
    "comment": "Get Recently Played Tracks",
    "doc": "Get Recently Played Tracks\n \n  Get tracks from the current user's recently played tracks.\n  _Note: Currently doesn't support podcast episodes._"
  },
  "getQueue": {
    "comment": "Get the User's Queue",
    "doc": "Get the User's Queue\n \n  Get the list of objects that make up the user's queue."
  },
  "addToQueue": {
    "comment": "Add Item to Playback Queue",
    "doc": "Add Item to Playback Queue\n \n  Add an item to the end of the user's current playback queue. This API only works for users who have Spotify Premium. The order of execution is not guaranteed when you use this API with other Player API endpoints."
  },
  "getAvailableMarkets": {
    "comment": "Get Available Markets",
    "doc": "Get Available Markets\n \n  Get the list of markets where Spotify is available."
  }
}