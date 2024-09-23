// @ts-nocheck
export type TPaths = {
  '/albums': {
    get: {
      description: 'Get Spotify catalog information for multiple albums identified by their Spotify IDs.\n';
      operationId: 'get-multiple-albums';
      parameters: [
        {
          $ref: '#/components/parameters/QueryAlbumIds';
        },
        {
          $ref: '#/components/parameters/QueryMarket';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/ManyAlbums';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: [];
        },
      ];
      summary: 'Get Several Albums\n';
      tags: ['Albums'];
      'x-spotify-docs-console-url': '/console/get-several-albums/';
      'x-spotify-docs-endpoint-name': 'Get Multiple Albums';
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/metadataPolicyList';
      };
    };
    'x-spotify-docs-category': 'Albums';
    'x-spotify-docs-display-name': 'several-albums';
  };
  '/albums/{id}': {
    get: {
      description: 'Get Spotify catalog information for a single album.\n';
      operationId: 'get-an-album';
      parameters: [
        {
          $ref: '#/components/parameters/PathAlbumId';
        },
        {
          $ref: '#/components/parameters/QueryMarket';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/OneAlbum';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: [];
        },
      ];
      summary: 'Get Album\n';
      tags: ['Albums'];
      'x-spotify-docs-console-url': '/console/get-album/?id=0sNOF9WDwhWunNAHPD3Baj';
      'x-spotify-docs-endpoint-name': 'Get an Album';
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/metadataPolicyList';
      };
    };
    'x-spotify-docs-category': 'Albums';
    'x-spotify-docs-display-name': 'album';
  };
  '/albums/{id}/tracks': {
    get: {
      description: 'Get Spotify catalog information about an album’s tracks.\nOptional parameters can be used to limit the number of tracks returned.\n';
      operationId: 'get-an-albums-tracks';
      parameters: [
        {
          $ref: '#/components/parameters/PathAlbumId';
        },
        {
          $ref: '#/components/parameters/QueryMarket';
        },
        {
          $ref: '#/components/parameters/QueryLimit';
        },
        {
          $ref: '#/components/parameters/QueryOffset';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/PagingSimplifiedTrackObject';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: [];
        },
      ];
      summary: 'Get Album Tracks\n';
      tags: ['Albums', 'Tracks'];
      'x-spotify-docs-console-url': '/console/get-album-tracks/';
      'x-spotify-docs-endpoint-name': "Get an Album's Tracks";
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/metadataPolicyList';
      };
    };
    'x-spotify-docs-category': 'Albums';
    'x-spotify-docs-display-name': 'album-tracks';
  };
  '/artists': {
    get: {
      description: 'Get Spotify catalog information for several artists based on their Spotify IDs.\n';
      operationId: 'get-multiple-artists';
      parameters: [
        {
          in: 'query';
          name: 'ids';
          required: true;
          schema: {
            description: 'A comma-separated list of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids) for the artists. Maximum: 50 IDs.\n';
            example: '2CIMQHirSU0MQqyYHq0eOx,57dN52uHvrHOxijzpIgu3E,1vCWHaC5f2uS3yhpwWbIA6';
            title: 'Spotify Artist IDs';
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/ManyArtists';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: [];
        },
      ];
      summary: 'Get Several Artists\n';
      tags: ['Artists'];
      'x-spotify-docs-console-url': '/console/get-several-artists/?ids=0oSGxfWSnnOXhD2fKuz2Gy,3dBVyJ7JuOMt4GE9607Qin';
      'x-spotify-docs-endpoint-name': 'Get Multiple Artists';
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/metadataPolicyList';
      };
    };
    'x-spotify-docs-category': 'Artists';
    'x-spotify-docs-display-name': 'several-artists';
  };
  '/artists/{id}': {
    get: {
      description: 'Get Spotify catalog information for a single artist identified by their unique Spotify ID.\n';
      operationId: 'get-an-artist';
      parameters: [
        {
          $ref: '#/components/parameters/PathArtistId';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/OneArtist';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: [];
        },
      ];
      summary: 'Get Artist\n';
      tags: ['Artists'];
      'x-spotify-docs-console-url': '/console/get-artist/?id=0OdUWJ0sBjDrqHygGUXeCF';
      'x-spotify-docs-endpoint-name': 'Get an Artist';
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/metadataPolicyList';
      };
    };
    'x-spotify-docs-category': 'Artists';
    'x-spotify-docs-display-name': 'artist';
  };
  '/artists/{id}/albums': {
    get: {
      description: "Get Spotify catalog information about an artist's albums.\n";
      operationId: 'get-an-artists-albums';
      parameters: [
        {
          $ref: '#/components/parameters/PathArtistId';
        },
        {
          $ref: '#/components/parameters/QueryIncludeGroups';
        },
        {
          $ref: '#/components/parameters/QueryMarket';
        },
        {
          $ref: '#/components/parameters/QueryLimit';
        },
        {
          $ref: '#/components/parameters/QueryOffset';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/PagingSimplifiedAlbumObject';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: [];
        },
      ];
      summary: "Get Artist's Albums\n";
      tags: ['Artists', 'Albums'];
      'x-spotify-docs-console-url': '/console/get-artist-albums/?album_type=single&amp;limit=2&amp;market=ES&amp;id=1vCWHaC5f2uS3yhpwWbIA6';
      'x-spotify-docs-endpoint-name': "Get an Artist's Albums";
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/metadataPolicyList';
      };
    };
    'x-spotify-docs-category': 'Artists';
    'x-spotify-docs-display-name': 'artist-albums';
  };
  '/artists/{id}/related-artists': {
    get: {
      description: "Get Spotify catalog information about artists similar to a given artist. Similarity is based on analysis of the Spotify community's [listening history](http://news.spotify.com/se/2010/02/03/related-artists/).\n";
      operationId: 'get-an-artists-related-artists';
      parameters: [
        {
          $ref: '#/components/parameters/PathArtistId';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/ManyArtists';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: [];
        },
      ];
      summary: "Get Artist's Related Artists\n";
      tags: ['Artists'];
      'x-spotify-docs-console-url': '/console/get-artist-related-artists/?id=43ZHCT0cAZBISjO8DG9PnE';
      'x-spotify-docs-endpoint-name': "Get an Artist's Related Artists";
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/metadataPolicyList';
      };
    };
    'x-spotify-docs-category': 'Artists';
    'x-spotify-docs-display-name': 'artist-related-artists';
  };
  '/artists/{id}/top-tracks': {
    get: {
      description: "Get Spotify catalog information about an artist's top tracks by country.\n";
      operationId: 'get-an-artists-top-tracks';
      parameters: [
        {
          $ref: '#/components/parameters/PathArtistId';
        },
        {
          $ref: '#/components/parameters/QueryMarket';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/ManyTracks';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: [];
        },
      ];
      summary: "Get Artist's Top Tracks\n";
      tags: ['Artists', 'Tracks'];
      'x-spotify-docs-console-url': '/console/get-artist-top-tracks/?country=SE&amp;id=43ZHCT0cAZBISjO8DG9PnE';
      'x-spotify-docs-endpoint-name': "Get an Artist's Top Tracks";
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/metadataPolicyList';
      };
    };
    'x-spotify-docs-category': 'Artists';
    'x-spotify-docs-display-name': 'artist-top-tracks';
  };
  '/audio-analysis/{id}': {
    get: {
      description: 'Get a low-level audio analysis for a track in the Spotify catalog. The audio analysis describes the track’s structure and musical content, including rhythm, pitch, and timbre.\n';
      operationId: 'get-audio-analysis';
      parameters: [
        {
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            description: 'The [Spotify ID](/documentation/web-api/concepts/spotify-uris-ids)\nfor the track.\n';
            example: '11dFghVXANMlKmJXsNCbNl';
            title: 'Spotify Track ID';
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/OneAudioAnalysis';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: [];
        },
      ];
      summary: "Get Track's Audio Analysis\n";
      tags: ['Tracks'];
      'x-spotify-docs-console-url': '/console/get-audio-analysis-track/?id=06AKEBrKUckW0KREUWRnvT';
      'x-spotify-docs-endpoint-name': 'Get Audio Analysis for a Track';
    };
    'x-spotify-docs-category': 'Tracks';
    'x-spotify-docs-display-name': 'audio-analysis-track';
  };
  '/audio-features': {
    get: {
      description: 'Get audio features for multiple tracks based on their Spotify IDs.\n';
      operationId: 'get-several-audio-features';
      parameters: [
        {
          in: 'query';
          name: 'ids';
          required: true;
          schema: {
            description: 'A comma-separated list of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids)\nfor the tracks. Maximum: 100 IDs.\n';
            example: '7ouMYWpwJ422jRcDASZB7P,4VqPOruhp5EdPBeR92t6lQ,2takcwOaAZWiXQijPHIx7B';
            title: 'Spotify Track IDs';
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/ManyAudioFeatures';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: [];
        },
      ];
      summary: "Get Tracks' Audio Features\n";
      tags: ['Tracks'];
      'x-spotify-docs-console-url': '/console/get-audio-features-several-tracks/?ids=4JpKVNYnVcJ8tuMKjAj50A,2NRANZE9UCmPAS5XVbXL40,24JygzOLM0EmRQeGtFcIcG';
      'x-spotify-docs-endpoint-name': 'Get Audio Features for Several Tracks';
    };
    'x-spotify-docs-category': 'Tracks';
    'x-spotify-docs-display-name': 'audio-features-several-tracks';
  };
  '/audio-features/{id}': {
    get: {
      description: 'Get audio feature information for a single track identified by its unique\nSpotify ID.\n';
      operationId: 'get-audio-features';
      parameters: [
        {
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            description: 'The [Spotify ID](/documentation/web-api/concepts/spotify-uris-ids) for the track.\n';
            example: '11dFghVXANMlKmJXsNCbNl';
            title: 'Spotify Track ID';
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/OneAudioFeatures';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: [];
        },
      ];
      summary: "Get Track's Audio Features\n";
      tags: ['Tracks'];
      'x-spotify-docs-console-url': '/console/get-audio-features-track/?id=06AKEBrKUckW0KREUWRnvT';
      'x-spotify-docs-endpoint-name': 'Get Audio Features for a Track';
    };
    'x-spotify-docs-category': 'Tracks';
    'x-spotify-docs-display-name': 'audio-features-track';
  };
  '/audiobooks': {
    get: {
      description: 'Get Spotify catalog information for several audiobooks identified by their Spotify IDs.<br />\n**Note: Audiobooks are only available for the US, UK, Ireland, New Zealand and Australia markets.**\n';
      operationId: 'get-multiple-audiobooks';
      parameters: [
        {
          $ref: '#/components/parameters/QueryAudiobookIds';
        },
        {
          $ref: '#/components/parameters/QueryMarket';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/ManyAudiobooks';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: [];
        },
      ];
      summary: 'Get Several Audiobooks\n';
      tags: ['Audiobooks'];
      'x-spotify-docs-console-url': '/console/get-several-audiobooks/?ids=5thw29eqjomhIDMY1XKsLk,2IEBhnu61ieYGFRPEJIO40';
      'x-spotify-docs-endpoint-name': 'Get Several Audiobooks';
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/metadataPolicyList';
      };
    };
    'x-spotify-docs-category': 'Audiobooks';
    'x-spotify-docs-display-name': 'several-audiobooks';
  };
  '/audiobooks/{id}': {
    get: {
      description: 'Get Spotify catalog information for a single audiobook.<br />\n**Note: Audiobooks are only available for the US, UK, Ireland, New Zealand and Australia markets.**\n';
      operationId: 'get-an-audiobook';
      parameters: [
        {
          $ref: '#/components/parameters/PathAudiobookId';
        },
        {
          $ref: '#/components/parameters/QueryMarket';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/OneAudiobook';
        };
        '400': {
          $ref: '#/components/responses/BadRequest';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '404': {
          $ref: '#/components/responses/NotFound';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: [];
        },
      ];
      summary: 'Get an Audiobook\n';
      tags: ['Audiobooks'];
      'x-spotify-docs-console-url': '/console/get-audiobook/?id=5thw29eqjomhIDMY1XKsLk';
      'x-spotify-docs-endpoint-name': 'Get an Audiobook';
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/metadataPolicyList';
      };
    };
    'x-spotify-docs-category': 'Audiobooks';
    'x-spotify-docs-display-name': 'audiobook';
  };
  '/audiobooks/{id}/chapters': {
    get: {
      description: "Get Spotify catalog information about an audiobook's chapters.<br />\n**Note: Audiobooks are only available for the US, UK, Ireland, New Zealand and Australia markets.**\n";
      operationId: 'get-audiobook-chapters';
      parameters: [
        {
          $ref: '#/components/parameters/PathAudiobookId';
        },
        {
          $ref: '#/components/parameters/QueryMarket';
        },
        {
          $ref: '#/components/parameters/QueryLimit';
        },
        {
          $ref: '#/components/parameters/QueryOffset';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/PagingSimplifiedChapterObject';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: [];
        },
      ];
      summary: 'Get Audiobook Chapters\n';
      tags: ['Audiobooks', 'Chapters'];
      'x-spotify-docs-console-url': '/console/get-audiobook-chapters/?id=5thw29eqjomhIDMY1XKsLk';
      'x-spotify-docs-endpoint-name': "Get an Audiobook's Chapters";
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/metadataPolicyList';
      };
    };
    'x-spotify-docs-category': 'Audiobooks';
    'x-spotify-docs-display-name': 'audiobook-chapters';
  };
  '/browse/categories': {
    get: {
      description: 'Get a list of categories used to tag items in Spotify (on, for example, the Spotify player’s “Browse” tab).\n';
      operationId: 'get-categories';
      parameters: [
        {
          in: 'query';
          name: 'country';
          required: false;
          schema: {
            description: 'A country: an [ISO 3166-1 alpha-2 country code](http://en.wikipedia.org/wiki/ISO_3166-1_alpha-2). Provide this parameter if you want to narrow the list of returned categories to those relevant to a particular country. If omitted, the returned items will be globally relevant.\n';
            example: 'SE';
            title: 'Country';
            type: 'string';
          };
        },
        {
          in: 'query';
          name: 'locale';
          required: false;
          schema: {
            description: 'The desired language, consisting of an [ISO 639-1](http://en.wikipedia.org/wiki/ISO_639-1) language code and an [ISO 3166-1 alpha-2 country code](http://en.wikipedia.org/wiki/ISO_3166-1_alpha-2), joined by an underscore. For example: `es_MX`, meaning "Spanish (Mexico)". Provide this parameter if you want the category metadata returned in a particular language. <br/>\n_**Note**: if `locale` is not supplied, or if the specified language is not available, all strings will be returned in the Spotify default language (American English). The `locale` parameter, combined with the `country` parameter, may give odd results if not carefully matched. For example `country=SE&locale=de_DE` will return a list of categories relevant to Sweden but as German language strings._\n';
            example: 'sv_SE';
            title: 'Locale';
            type: 'string';
          };
        },
        {
          $ref: '#/components/parameters/QueryLimit';
        },
        {
          $ref: '#/components/parameters/QueryOffset';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/PagedCategories';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: [];
        },
      ];
      summary: 'Get Several Browse Categories\n';
      tags: ['Categories'];
      'x-spotify-docs-console-url': '/console/get-browse-categories/';
      'x-spotify-docs-endpoint-name': 'Get All Categories';
    };
    'x-spotify-docs-category': 'Browse';
    'x-spotify-docs-display-name': 'browse-categories';
  };
  '/browse/categories/{category_id}': {
    get: {
      description: 'Get a single category used to tag items in Spotify (on, for example, the Spotify player’s “Browse” tab).\n';
      operationId: 'get-a-category';
      parameters: [
        {
          in: 'path';
          name: 'category_id';
          required: true;
          schema: {
            description: 'The [Spotify category ID](/documentation/web-api/concepts/spotify-uris-ids) for the category.\n';
            example: 'dinner';
            title: 'Category ID';
            type: 'string';
          };
        },
        {
          in: 'query';
          name: 'country';
          required: false;
          schema: {
            description: 'A country: an [ISO 3166-1 alpha-2 country code](http://en.wikipedia.org/wiki/ISO_3166-1_alpha-2). Provide this parameter to ensure that the category exists for a particular country.\n';
            example: 'SE';
            title: 'Country';
            type: 'string';
          };
        },
        {
          in: 'query';
          name: 'locale';
          required: false;
          schema: {
            description: 'The desired language, consisting of an [ISO 639-1](http://en.wikipedia.org/wiki/ISO_639-1) language code and an [ISO 3166-1 alpha-2 country code](http://en.wikipedia.org/wiki/ISO_3166-1_alpha-2), joined by an underscore. For example: `es_MX`, meaning &quot;Spanish (Mexico)&quot;. Provide this parameter if you want the category strings returned in a particular language.<br/> _**Note**: if `locale` is not supplied, or if the specified language is not available, the category strings returned will be in the Spotify default language (American English)._\n';
            example: 'sv_SE';
            title: 'Locale';
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/OneCategory';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: [];
        },
      ];
      summary: 'Get Single Browse Category\n';
      tags: ['Categories'];
      'x-spotify-docs-console-url': '/console/get-browse-category/';
      'x-spotify-docs-endpoint-name': 'Get a Category';
    };
    'x-spotify-docs-category': 'Browse';
    'x-spotify-docs-display-name': 'browse-category';
  };
  '/browse/categories/{category_id}/playlists': {
    get: {
      description: 'Get a list of Spotify playlists tagged with a particular category.\n';
      operationId: 'get-a-categories-playlists';
      parameters: [
        {
          in: 'path';
          name: 'category_id';
          required: true;
          schema: {
            description: 'The [Spotify category ID](/documentation/web-api/concepts/spotify-uris-ids) for the category.\n';
            example: 'dinner';
            title: 'Category ID';
            type: 'string';
          };
        },
        {
          in: 'query';
          name: 'country';
          required: false;
          schema: {
            description: 'A country: an [ISO 3166-1 alpha-2 country code](http://en.wikipedia.org/wiki/ISO_3166-1_alpha-2). Provide this parameter to ensure that the category exists for a particular country.\n';
            example: 'SE';
            title: 'Country';
            type: 'string';
          };
        },
        {
          $ref: '#/components/parameters/QueryLimit';
        },
        {
          $ref: '#/components/parameters/QueryOffset';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/PagedFeaturedPlaylists';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: [];
        },
      ];
      summary: "Get Category's Playlists\n";
      tags: ['Playlists', 'Categories'];
      'x-spotify-docs-console-url': '/console/get-category-playlists/?country=BR&amp;category_id=party&amp;limit=2';
      'x-spotify-docs-endpoint-name': "Get a Category's Playlists";
    };
    'x-spotify-docs-category': 'Browse';
    'x-spotify-docs-display-name': 'category-playlists';
  };
  '/browse/featured-playlists': {
    get: {
      description: "Get a list of Spotify featured playlists (shown, for example, on a Spotify player's 'Browse' tab).\n";
      operationId: 'get-featured-playlists';
      parameters: [
        {
          in: 'query';
          name: 'country';
          required: false;
          schema: {
            description: 'A country: an [ISO 3166-1 alpha-2 country code](http://en.wikipedia.org/wiki/ISO_3166-1_alpha-2). Provide this parameter if you want the list of returned items to be relevant to a particular country. If omitted, the returned items will be relevant to all countries.\n';
            example: 'SE';
            title: 'Country';
            type: 'string';
          };
        },
        {
          in: 'query';
          name: 'locale';
          required: false;
          schema: {
            description: 'The desired language, consisting of a lowercase [ISO 639-1 language code](http://en.wikipedia.org/wiki/ISO_639-1) and an uppercase [ISO 3166-1 alpha-2 country code](http://en.wikipedia.org/wiki/ISO_3166-1_alpha-2), joined by an underscore. For example: `es_MX`, meaning "Spanish (Mexico)". Provide this parameter if you want the results returned in a particular language (where available). <br/>\n_**Note**: if `locale` is not supplied, or if the specified language is not available, all strings will be returned in the Spotify default language (American English). The `locale` parameter, combined with the `country` parameter, may give odd results if not carefully matched. For example `country=SE&locale=de_DE` will return a list of categories relevant to Sweden but as German language strings._\n';
            example: 'sv_SE';
            title: 'Locale';
            type: 'string';
          };
        },
        {
          in: 'query';
          name: 'timestamp';
          required: false;
          schema: {
            description: 'A timestamp in [ISO 8601 format](http://en.wikipedia.org/wiki/ISO_8601): `yyyy-MM-ddTHH:mm:ss`. Use this parameter to specify the user\'s local time to get results tailored for that specific date and time in the day. If not provided, the response defaults to the current UTC time. Example: "2014-10-23T09:00:00" for a user whose local time is 9AM. If there were no featured playlists (or there is no data) at the specified time, the response will revert to the current UTC time.\n';
            example: '2014-10-23T09:00:00';
            title: 'Timestamp';
            type: 'string';
          };
        },
        {
          $ref: '#/components/parameters/QueryLimit';
        },
        {
          $ref: '#/components/parameters/QueryOffset';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/PagedFeaturedPlaylists';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: [];
        },
      ];
      summary: 'Get Featured Playlists\n';
      tags: ['Playlists'];
      'x-spotify-docs-console-url': '/console/get-featured-playlists/?country=SE&amp;limit=2';
      'x-spotify-docs-endpoint-name': 'Get All Featured Playlists';
      'x-spotify-policy-list': [
        {
          $ref: '#/components/x-spotify-policy/MultipleIntegrations';
        },
      ];
    };
    'x-spotify-docs-category': 'Browse';
    'x-spotify-docs-display-name': 'featured-playlists';
  };
  '/browse/new-releases': {
    get: {
      description: 'Get a list of new album releases featured in Spotify (shown, for example, on a Spotify player’s “Browse” tab).\n';
      operationId: 'get-new-releases';
      parameters: [
        {
          in: 'query';
          name: 'country';
          required: false;
          schema: {
            description: 'A country: an [ISO 3166-1 alpha-2 country code](http://en.wikipedia.org/wiki/ISO_3166-1_alpha-2). Provide this parameter if you want the list of returned items to be relevant to a particular country. If omitted, the returned items will be relevant to all countries.\n';
            example: 'SE';
            title: 'Country';
            type: 'string';
          };
        },
        {
          $ref: '#/components/parameters/QueryLimit';
        },
        {
          $ref: '#/components/parameters/QueryOffset';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/PagedAlbums';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: [];
        },
      ];
      summary: 'Get New Releases\n';
      tags: ['Albums'];
      'x-spotify-docs-console-url': '/console/get-new-releases/?country=SE';
      'x-spotify-docs-endpoint-name': 'Get All New Releases';
      'x-spotify-policy-list': [
        {
          $ref: '#/components/x-spotify-policy/MultipleIntegrations';
        },
      ];
    };
    'x-spotify-docs-category': 'Browse';
    'x-spotify-docs-display-name': 'new-releases';
  };
  '/chapters': {
    get: {
      description: 'Get Spotify catalog information for several chapters identified by their Spotify IDs.<br />\n**Note: Chapters are only available for the US, UK, Ireland, New Zealand and Australia markets.**\n';
      operationId: 'get-several-chapters';
      parameters: [
        {
          $ref: '#/components/parameters/QueryChapterIds';
        },
        {
          $ref: '#/components/parameters/QueryMarket';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/ManyChapters';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: [];
        },
      ];
      summary: 'Get Several Chapters\n';
      tags: ['Chapters'];
      'x-spotify-docs-console-url': '/console/get-several-chapters/?ids=2i47HuOBSV2XaJNy0NCZXM,2GUbORsUnP1qVVlLwd9DzP';
      'x-spotify-docs-endpoint-name': 'Get Several Chapters';
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/metadataPolicyList';
      };
    };
    'x-spotify-docs-category': 'Chapters';
    'x-spotify-docs-display-name': 'several-chapters';
  };
  '/chapters/{id}': {
    get: {
      description: 'Get Spotify catalog information for a single chapter.<br />\n**Note: Chapters are only available for the US, UK, Ireland, New Zealand and Australia markets.**\n';
      operationId: 'get-a-chapter';
      parameters: [
        {
          $ref: '#/components/parameters/PathChapterId';
        },
        {
          $ref: '#/components/parameters/QueryMarket';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/OneChapter';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: [];
        },
      ];
      summary: 'Get a Chapter\n';
      tags: ['Chapters'];
      'x-spotify-docs-console-url': '/console/get-chapter/?id=2i47HuOBSV2XaJNy0NCZXM';
      'x-spotify-docs-endpoint-name': 'Get a Chapter';
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/metadataPolicyList';
      };
    };
    'x-spotify-docs-category': 'Chapters';
    'x-spotify-docs-display-name': 'chapters';
  };
  '/episodes': {
    get: {
      description: 'Get Spotify catalog information for several episodes based on their Spotify IDs.\n';
      operationId: 'get-multiple-episodes';
      parameters: [
        {
          in: 'query';
          name: 'ids';
          required: true;
          schema: {
            description: 'A comma-separated list of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids) for the episodes. Maximum: 50 IDs.\n';
            example: '77o6BIVlYM3msb4MMIL1jH,0Q86acNRm6V9GYx55SXKwf';
            title: 'Ids';
            type: 'string';
          };
        },
        {
          $ref: '#/components/parameters/QueryMarket';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/ManyEpisodes';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['user-read-playback-position'];
        },
      ];
      summary: 'Get Several Episodes\n';
      tags: ['Episodes'];
      'x-spotify-docs-console-url': '/console/get-several-episodes/?ids=77o6BIVlYM3msb4MMIL1jH,0Q86acNRm6V9GYx55SXKwf';
      'x-spotify-docs-endpoint-name': 'Get Multiple Episodes';
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/metadataPolicyList';
      };
    };
    'x-spotify-docs-category': 'Episodes';
    'x-spotify-docs-display-name': 'several-episodes';
  };
  '/episodes/{id}': {
    get: {
      description: 'Get Spotify catalog information for a single episode identified by its\nunique Spotify ID.\n';
      operationId: 'get-an-episode';
      parameters: [
        {
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            description: 'The [Spotify ID](/documentation/web-api/concepts/spotify-uris-ids) for the episode.';
            example: '512ojhOuo1ktJprKbVcKyQ';
            title: 'Get an Episode';
            type: 'string';
          };
        },
        {
          $ref: '#/components/parameters/QueryMarket';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/OneEpisode';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['user-read-playback-position'];
        },
      ];
      summary: 'Get Episode\n';
      tags: ['Episodes'];
      'x-spotify-docs-console-url': '/console/get-episode/?id=512ojhOuo1ktJprKbVcKyQ';
      'x-spotify-docs-endpoint-name': 'Get an Episode';
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/metadataPolicyList';
      };
    };
    'x-spotify-docs-category': 'Episodes';
    'x-spotify-docs-display-name': 'episode';
  };
  '/markets': {
    get: {
      description: 'Get the list of markets where Spotify is available.\n';
      operationId: 'get-available-markets';
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                properties: {
                  markets: {
                    example: ['CA', 'BR', 'IT'];
                    items: {
                      type: 'string';
                    };
                    type: 'array';
                  };
                };
                type: 'object';
              };
            };
          };
          description: 'A markets object with an array of country codes';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: [];
        },
      ];
      summary: 'Get Available Markets\n';
      tags: ['Markets'];
      'x-spotify-docs-console-url': '/console/get-available-markets/';
      'x-spotify-docs-endpoint-name': 'Get Available Markets';
    };
    'x-spotify-docs-category': 'Markets';
    'x-spotify-docs-display-name': 'available-markets';
  };
  '/me': {
    get: {
      description: "Get detailed profile information about the current user (including the\ncurrent user's username).\n";
      operationId: 'get-current-users-profile';
      responses: {
        '200': {
          $ref: '#/components/responses/OnePrivateUser';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['user-read-private', 'user-read-email'];
        },
      ];
      summary: "Get Current User's Profile\n";
      tags: ['Users'];
      'x-spotify-docs-console-url': '/console/get-current-user/';
      'x-spotify-docs-endpoint-name': "Get Current User's Profile";
    };
    'x-spotify-docs-category': 'Users Profile';
    'x-spotify-docs-display-name': 'current-user';
  };
  '/me/albums': {
    delete: {
      description: "Remove one or more albums from the current user's 'Your Music' library.\n";
      operationId: 'remove-albums-user';
      parameters: [
        {
          $ref: '#/components/parameters/QueryAlbumIds';
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              additionalProperties: true;
              properties: {
                ids: {
                  description: 'A JSON array of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids). For example: `["4iV5W9uYEdYUVa79Axb7Rh", "1301WleyT98MSxVHPZCA6M"]`<br/>A maximum of 50 items can be specified in one request. _**Note**: if the `ids` parameter is present in the query string, any IDs listed here in the body will be ignored._\n';
                  items: {
                    type: 'string';
                  };
                  type: 'array';
                };
              };
              type: 'object';
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Album(s) have been removed from the library';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['user-library-modify'];
        },
      ];
      summary: "Remove Users' Saved Albums\n";
      tags: ['Albums', 'Library'];
      'x-spotify-docs-console-url': '/console/delete-current-user-saved-albums/?ids=07bYtmE3bPsLB6ZbmmFi8d%2C48JYNjh7GMie6NjqYHMmtT%2C27cZdqrQiKt3IT00338dws';
      'x-spotify-docs-endpoint-name': 'Remove Albums for Current User';
    };
    get: {
      description: "Get a list of the albums saved in the current Spotify user's 'Your Music' library.\n";
      operationId: 'get-users-saved-albums';
      parameters: [
        {
          $ref: '#/components/parameters/QueryLimit';
        },
        {
          $ref: '#/components/parameters/QueryOffset';
        },
        {
          $ref: '#/components/parameters/QueryMarket';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/PagingSavedAlbumObject';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['user-library-read'];
        },
      ];
      summary: "Get User's Saved Albums\n";
      tags: ['Albums', 'Library'];
      'x-spotify-docs-console-url': '/console/get-current-user-saved-albums/?limit=1';
      'x-spotify-docs-endpoint-name': "Get User's Saved Albums";
    };
    put: {
      description: "Save one or more albums to the current user's 'Your Music' library.\n";
      operationId: 'save-albums-user';
      parameters: [
        {
          $ref: '#/components/parameters/QueryAlbumIds';
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              additionalProperties: true;
              properties: {
                ids: {
                  description: 'A JSON array of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids). For example: `["4iV5W9uYEdYUVa79Axb7Rh", "1301WleyT98MSxVHPZCA6M"]`<br/>A maximum of 50 items can be specified in one request. _**Note**: if the `ids` parameter is present in the query string, any IDs listed here in the body will be ignored._\n';
                  items: {
                    type: 'string';
                  };
                  type: 'array';
                };
              };
              type: 'object';
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'The album is saved';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['user-library-modify'];
        },
      ];
      summary: 'Save Albums for Current User\n';
      tags: ['Albums', 'Library'];
      'x-spotify-docs-console-url': '/console/put-current-user-saved-albums/?ids=07bYtmE3bPsLB6ZbmmFi8d%2C48JYNjh7GMie6NjqYHMmtT%2C27cZdqrQiKt3IT00338dws';
      'x-spotify-docs-endpoint-name': 'Save Albums for Current User';
    };
    'x-spotify-docs-category': 'Library';
    'x-spotify-docs-display-name': 'current-user-saved-albums';
  };
  '/me/albums/contains': {
    get: {
      description: "Check if one or more albums is already saved in the current Spotify user's 'Your Music' library.\n";
      operationId: 'check-users-saved-albums';
      parameters: [
        {
          $ref: '#/components/parameters/QueryAlbumIds';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/ArrayOfBooleans';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['user-library-read'];
        },
      ];
      summary: "Check User's Saved Albums\n";
      tags: ['Albums', 'Library'];
      'x-spotify-docs-console-url': '/console/get-current-user-contains-saved-albums/?ids=0pJJgBzj26qnE1nSQUxaB0%2C5ZAKzV4ZIa5Gt7z29OYHv0';
      'x-spotify-docs-endpoint-name': "Check User's Saved Albums";
    };
    'x-spotify-docs-category': 'Library';
    'x-spotify-docs-display-name': 'current-user-contains-saved-albums';
  };
  '/me/audiobooks': {
    delete: {
      description: "Remove one or more audiobooks from the Spotify user's library.\n";
      operationId: 'remove-audiobooks-user';
      parameters: [
        {
          $ref: '#/components/parameters/QueryAudiobookIds';
        },
      ];
      responses: {
        '200': {
          description: 'Audiobook(s) have been removed from the library';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['user-library-modify'];
        },
      ];
      summary: "Remove User's Saved Audiobooks\n";
      tags: ['Audiobooks', 'Library'];
      'x-spotify-docs-console-url': '/console/delete-current-user-saved-audiobooks/?ids=07bYtmE3bPsLB6ZbmmFi8d%2C48JYNjh7GMie6NjqYHMmtT%2C27cZdqrQiKt3IT00338dws';
      'x-spotify-docs-endpoint-name': 'Remove Audiobooks for Current User';
    };
    get: {
      description: "Get a list of the audiobooks saved in the current Spotify user's 'Your Music' library.\n";
      operationId: 'get-users-saved-audiobooks';
      parameters: [
        {
          $ref: '#/components/parameters/QueryLimit';
        },
        {
          $ref: '#/components/parameters/QueryOffset';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/PagingSimplifiedAudiobookObject';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['user-library-read'];
        },
      ];
      summary: "Get User's Saved Audiobooks\n";
      tags: ['Audiobooks', 'Library'];
      'x-spotify-docs-console-url': '/console/get-current-user-saved-audiobooks/?limit=1';
      'x-spotify-docs-endpoint-name': "Get User's Saved Audiobooks";
    };
    put: {
      description: "Save one or more audiobooks to the current Spotify user's library.\n";
      operationId: 'save-audiobooks-user';
      parameters: [
        {
          $ref: '#/components/parameters/QueryAudiobookIds';
        },
      ];
      responses: {
        '200': {
          description: 'Audiobook(s) are saved to the library';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['user-library-modify'];
        },
      ];
      summary: 'Save Audiobooks for Current User\n';
      tags: ['Audiobooks', 'Library'];
      'x-spotify-docs-console-url': '/console/put-current-user-saved-audiobooks/?ids=07bYtmE3bPsLB6ZbmmFi8d%2C48JYNjh7GMie6NjqYHMmtT%2C27cZdqrQiKt3IT00338dws';
      'x-spotify-docs-endpoint-name': 'Save Audiobooks for Current User';
    };
    'x-spotify-docs-category': 'Library';
    'x-spotify-docs-display-name': 'current-user-saved-audiobooks';
  };
  '/me/audiobooks/contains': {
    get: {
      description: "Check if one or more audiobooks are already saved in the current Spotify user's library.\n";
      operationId: 'check-users-saved-audiobooks';
      parameters: [
        {
          $ref: '#/components/parameters/QueryAudiobookIds';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/ArrayOfBooleans';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['user-library-read'];
        },
      ];
      summary: "Check User's Saved Audiobooks\n";
      tags: ['Audiobooks', 'Library'];
      'x-spotify-docs-console-url': '/console/get-current-user-contains-saved-audiobooks/?ids=0pJJgBzj26qnE1nSQUxaB0%2C5ZAKzV4ZIa5Gt7z29OYHv0';
      'x-spotify-docs-endpoint-name': "Check User's Saved Audiobooks";
    };
    'x-spotify-docs-category': 'Library';
    'x-spotify-docs-display-name': 'current-user-contains-saved-audiobooks';
  };
  '/me/episodes': {
    delete: {
      description: "Remove one or more episodes from the current user's library.<br/>\nThis API endpoint is in __beta__ and could change without warning. Please share any feedback that you have, or issues that you discover, in our [developer community forum](https://community.spotify.com/t5/Spotify-for-Developers/bd-p/Spotify_Developer).\n";
      operationId: 'remove-episodes-user';
      parameters: [
        {
          $ref: '#/components/parameters/QueryTrackIds';
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              additionalProperties: true;
              properties: {
                ids: {
                  description: 'A JSON array of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids). <br/>A maximum of 50 items can be specified in one request. _**Note**: if the `ids` parameter is present in the query string, any IDs listed here in the body will be ignored._\n';
                  items: {
                    type: 'string';
                  };
                  type: 'array';
                };
              };
              type: 'object';
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Episode removed';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['user-library-modify'];
        },
      ];
      summary: "Remove User's Saved Episodes\n";
      tags: ['Episodes', 'Library'];
      'x-spotify-docs-console-url': '/console/delete-current-user-saved-episodes/?ids=77o6BIVlYM3msb4MMIL1jH%2C0Q86acNRm6V9GYx55SXKwf';
      'x-spotify-docs-endpoint-name': "Remove User's Saved Episodes";
    };
    get: {
      description: "Get a list of the episodes saved in the current Spotify user's library.<br/>\nThis API endpoint is in __beta__ and could change without warning. Please share any feedback that you have, or issues that you discover, in our [developer community forum](https://community.spotify.com/t5/Spotify-for-Developers/bd-p/Spotify_Developer).\n";
      operationId: 'get-users-saved-episodes';
      parameters: [
        {
          $ref: '#/components/parameters/QueryMarket';
        },
        {
          $ref: '#/components/parameters/QueryLimit';
        },
        {
          $ref: '#/components/parameters/QueryOffset';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/PagingSavedEpisodeObject';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['user-library-read', 'user-read-playback-position'];
        },
      ];
      summary: "Get User's Saved Episodes\n";
      tags: ['Episodes', 'Library'];
      'x-spotify-docs-console-url': '/console/get-current-user-saved-episodes/';
      'x-spotify-docs-endpoint-name': "Get User's Saved Episodes";
    };
    put: {
      description: "Save one or more episodes to the current user's library.<br/>\nThis API endpoint is in __beta__ and could change without warning. Please share any feedback that you have, or issues that you discover, in our [developer community forum](https://community.spotify.com/t5/Spotify-for-Developers/bd-p/Spotify_Developer).\n";
      operationId: 'save-episodes-user';
      parameters: [
        {
          in: 'query';
          name: 'ids';
          required: true;
          schema: {
            description: 'A comma-separated list of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids). Maximum: 50 IDs.\n';
            example: '77o6BIVlYM3msb4MMIL1jH,0Q86acNRm6V9GYx55SXKwf';
            title: 'Spotify Episodes IDs';
            type: 'string';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              additionalProperties: true;
              properties: {
                ids: {
                  description: 'A JSON array of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids). <br/>A maximum of 50 items can be specified in one request. _**Note**: if the `ids` parameter is present in the query string, any IDs listed here in the body will be ignored._\n';
                  items: {
                    type: 'string';
                  };
                  type: 'array';
                };
              };
              required: ['uris'];
              type: 'object';
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Episode saved';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['user-library-modify'];
        },
      ];
      summary: 'Save Episodes for Current User\n';
      tags: ['Episodes', 'Library'];
      'x-spotify-docs-console-url': '/console/put-current-user-saved-episodes/?ids=77o6BIVlYM3msb4MMIL1jH%2C0Q86acNRm6V9GYx55SXKwf';
      'x-spotify-docs-endpoint-name': 'Save Episodes for Current User';
    };
    'x-spotify-docs-category': 'Library';
    'x-spotify-docs-display-name': 'current-user-saved-episodes';
  };
  '/me/episodes/contains': {
    get: {
      description: "Check if one or more episodes is already saved in the current Spotify user's 'Your Episodes' library.<br/>\nThis API endpoint is in __beta__ and could change without warning. Please share any feedback that you have, or issues that you discover, in our [developer community forum](https://community.spotify.com/t5/Spotify-for-Developers/bd-p/Spotify_Developer)..\n";
      operationId: 'check-users-saved-episodes';
      parameters: [
        {
          in: 'query';
          name: 'ids';
          required: true;
          schema: {
            description: 'A comma-separated list of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids) for the episodes. Maximum: 50 IDs.\n';
            example: '77o6BIVlYM3msb4MMIL1jH,0Q86acNRm6V9GYx55SXKwf';
            title: 'Spotify Episode IDs';
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/ArrayOfBooleans';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['user-library-read'];
        },
      ];
      summary: "Check User's Saved Episodes\n";
      tags: ['Episodes', 'Library'];
      'x-spotify-docs-console-url': '/console/get-current-user-contains-saved-episodes/?ids=77o6BIVlYM3msb4MMIL1jH%2C0Q86acNRm6V9GYx55SXKwf';
      'x-spotify-docs-endpoint-name': "Check User's Saved Episodes";
    };
    'x-spotify-docs-category': 'Library';
    'x-spotify-docs-display-name': 'current-user-contains-saved-episodes';
  };
  '/me/following': {
    delete: {
      description: 'Remove the current user as a follower of one or more artists or other Spotify users.\n';
      operationId: 'unfollow-artists-users';
      parameters: [
        {
          in: 'query';
          name: 'type';
          required: true;
          schema: {
            description: 'The ID type: either `artist` or `user`.\n';
            enum: ['artist', 'user'];
            example: 'artist';
            title: 'Item Type';
            type: 'string';
          };
        },
        {
          in: 'query';
          name: 'ids';
          required: true;
          schema: {
            description: 'A comma-separated list of the artist or the user [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids). For example: `ids=74ASZWbe4lXaubB36ztrGX,08td7MxkoHQkXnWAYD8d6Q`. A maximum of 50 IDs can be sent in one request.\n';
            example: '2CIMQHirSU0MQqyYHq0eOx,57dN52uHvrHOxijzpIgu3E,1vCWHaC5f2uS3yhpwWbIA6';
            title: 'Spotify IDs';
            type: 'string';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              additionalProperties: true;
              properties: {
                ids: {
                  description: 'A JSON array of the artist or user [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids). For example: `{ids:["74ASZWbe4lXaubB36ztrGX", "08td7MxkoHQkXnWAYD8d6Q"]}`. A maximum of 50 IDs can be sent in one request. _**Note**: if the `ids` parameter is present in the query string, any IDs listed here in the body will be ignored._\n';
                  items: {
                    type: 'string';
                  };
                  type: 'array';
                };
              };
              type: 'object';
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Artist or user unfollowed';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['user-follow-modify'];
        },
      ];
      summary: 'Unfollow Artists or Users\n';
      tags: ['Users', 'Artists', 'Library'];
      'x-spotify-docs-console-url': '/console/delete-following/?type=user&amp;ids=exampleuser01';
      'x-spotify-docs-endpoint-name': 'Unfollow Artists or Users';
    };
    get: {
      description: "Get the current user's followed artists.\n";
      operationId: 'get-followed';
      parameters: [
        {
          in: 'query';
          name: 'type';
          required: true;
          schema: {
            description: 'The ID type: currently only `artist` is supported.\n';
            enum: ['artist'];
            example: 'artist';
            title: 'Item Type';
            type: 'string';
          };
        },
        {
          in: 'query';
          name: 'after';
          required: false;
          schema: {
            description: 'The last artist ID retrieved from the previous request.\n';
            example: '0I2XqVXqHScXjHhk6AYYRe';
            title: 'After';
            type: 'string';
          };
        },
        {
          in: 'query';
          name: 'limit';
          required: false;
          schema: {
            default: 20;
            description: 'The maximum number of items to return. Default: 20\\. Minimum: 1\\. Maximum: 50\\.\n';
            example: 10;
            maximum: 50;
            minimum: 0;
            title: 'Limit';
            type: 'integer';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/CursorPagedArtists';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['user-follow-read'];
        },
      ];
      summary: 'Get Followed Artists\n';
      tags: ['Users', 'Library', 'Artists'];
      'x-spotify-docs-console-url': '/console/get-following/?type=artist&amp;limit=20';
      'x-spotify-docs-endpoint-name': "Get User's Followed Artists";
    };
    put: {
      description: 'Add the current user as a follower of one or more artists or other Spotify users.\n';
      operationId: 'follow-artists-users';
      parameters: [
        {
          in: 'query';
          name: 'type';
          required: true;
          schema: {
            description: 'The ID type.\n';
            enum: ['artist', 'user'];
            example: 'artist';
            title: 'Item Type';
            type: 'string';
          };
        },
        {
          in: 'query';
          name: 'ids';
          required: true;
          schema: {
            description: 'A comma-separated list of the artist or the user [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids).\nA maximum of 50 IDs can be sent in one request.\n';
            example: '2CIMQHirSU0MQqyYHq0eOx,57dN52uHvrHOxijzpIgu3E,1vCWHaC5f2uS3yhpwWbIA6';
            title: 'Spotify IDs';
            type: 'string';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              additionalProperties: true;
              properties: {
                ids: {
                  description: 'A JSON array of the artist or user [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids).\nFor example: `{ids:["74ASZWbe4lXaubB36ztrGX", "08td7MxkoHQkXnWAYD8d6Q"]}`. A maximum of 50 IDs can be sent in one request. _**Note**: if the `ids` parameter is present in the query string, any IDs listed here in the body will be ignored._\n';
                  items: {
                    type: 'string';
                  };
                  type: 'array';
                };
              };
              required: ['ids'];
              type: 'object';
            };
          };
        };
      };
      responses: {
        '204': {
          description: 'Artist or user followed';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['user-follow-modify'];
        },
      ];
      summary: 'Follow Artists or Users\n';
      tags: ['Users', 'Artists', 'Library'];
      'x-spotify-docs-console-url': '/console/put-following/?type=user&amp;ids=exampleuser01';
      'x-spotify-docs-endpoint-name': 'Follow Artists or Users';
    };
    'x-spotify-docs-category': 'Follow';
    'x-spotify-docs-display-name': 'following';
  };
  '/me/following/contains': {
    get: {
      description: 'Check to see if the current user is following one or more artists or other Spotify users.\n';
      operationId: 'check-current-user-follows';
      parameters: [
        {
          in: 'query';
          name: 'type';
          required: true;
          schema: {
            description: 'The ID type: either `artist` or `user`.\n';
            enum: ['artist', 'user'];
            example: 'artist';
            title: 'Item Type';
            type: 'string';
          };
        },
        {
          in: 'query';
          name: 'ids';
          required: true;
          schema: {
            description: 'A comma-separated list of the artist or the user [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids) to check. For example: `ids=74ASZWbe4lXaubB36ztrGX,08td7MxkoHQkXnWAYD8d6Q`. A maximum of 50 IDs can be sent in one request.\n';
            example: '2CIMQHirSU0MQqyYHq0eOx,57dN52uHvrHOxijzpIgu3E,1vCWHaC5f2uS3yhpwWbIA6';
            title: 'Spotify IDs';
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/ArrayOfBooleans';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['user-follow-read'];
        },
      ];
      summary: 'Check If User Follows Artists or Users\n';
      tags: ['Users', 'Artists', 'Library'];
      'x-spotify-docs-console-url': '/console/get-following-contains/?type=user&amp;ids=exampleuser01';
      'x-spotify-docs-endpoint-name': 'Get Following State for Artists/Users';
    };
    'x-spotify-docs-category': 'Follow';
    'x-spotify-docs-display-name': 'following-contains';
  };
  '/me/player': {
    get: {
      description: 'Get information about the user’s current playback state, including track or episode, progress, and active device.\n';
      operationId: 'get-information-about-the-users-current-playback';
      parameters: [
        {
          $ref: '#/components/parameters/QueryMarket';
        },
        {
          $ref: '#/components/parameters/QueryAdditionalTypes';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/OneCurrentlyPlaying';
        };
        '204': {
          description: 'Playback not available or active';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['user-read-playback-state'];
        },
      ];
      summary: 'Get Playback State\n';
      tags: ['Player'];
      'x-spotify-docs-console-url': '/console/get-user-player/';
      'x-spotify-docs-endpoint-name': "Get Information About The User's Current Playback";
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/playerPolicyList';
      };
    };
    put: {
      description: 'Transfer playback to a new device and determine if it should start playing.\n';
      operationId: 'transfer-a-users-playback';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              additionalProperties: true;
              example: {
                device_ids: ['74ASZWbe4lXaubB36ztrGX'];
              };
              properties: {
                device_ids: {
                  description: 'A JSON array containing the ID of the device on which playback should be started/transferred.<br/>For example:`{device_ids:["74ASZWbe4lXaubB36ztrGX"]}`<br/>_**Note**: Although an array is accepted, only a single device_id is currently supported. Supplying more than one will return `400 Bad Request`_\n';
                  items: {
                    type: 'string';
                  };
                  type: 'array';
                };
                play: {
                  additionalProperties: true;
                  description: '**true**: ensure playback happens on new device.<br/>**false** or not provided: keep the current playback state.\n';
                  type: 'boolean';
                };
              };
              required: ['device_ids'];
              type: 'object';
            };
          };
        };
      };
      responses: {
        '204': {
          description: 'Playback transferred';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['user-modify-playback-state'];
        },
      ];
      summary: 'Transfer Playback\n';
      tags: ['Player'];
      'x-spotify-docs-console-url': '/console/put-user-player';
      'x-spotify-docs-endpoint-name': "Transfer a User's Playback";
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/playerPolicyList';
      };
    };
    'x-spotify-docs-category': 'Player';
    'x-spotify-docs-display-name': 'user-player';
  };
  '/me/player/currently-playing': {
    get: {
      description: "Get the object currently being played on the user's Spotify account.\n";
      operationId: 'get-the-users-currently-playing-track';
      parameters: [
        {
          $ref: '#/components/parameters/QueryMarket';
        },
        {
          $ref: '#/components/parameters/QueryAdditionalTypes';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/OneCurrentlyPlayingTrack';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['user-read-currently-playing'];
        },
      ];
      summary: 'Get Currently Playing Track\n';
      tags: ['Player'];
      'x-spotify-docs-console-url': '/console/get-users-currently-playing-track/';
      'x-spotify-docs-endpoint-name': "Get the User's Currently Playing Track";
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/playerPolicyList';
      };
    };
    'x-spotify-docs-category': 'Player';
    'x-spotify-docs-display-name': 'users-currently-playing-track';
  };
  '/me/player/devices': {
    get: {
      description: 'Get information about a user’s available devices.\n';
      operationId: 'get-a-users-available-devices';
      responses: {
        '200': {
          $ref: '#/components/responses/ManyDevices';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['user-read-playback-state'];
        },
      ];
      summary: 'Get Available Devices\n';
      tags: ['Player'];
      'x-spotify-docs-console-url': '/console/get-users-available-devices/';
      'x-spotify-docs-endpoint-name': "Get a User's Available Devices";
    };
    'x-spotify-docs-category': 'Player';
    'x-spotify-docs-display-name': 'users-available-devices';
  };
  '/me/player/next': {
    post: {
      description: 'Skips to next track in the user’s queue.\n';
      operationId: 'skip-users-playback-to-next-track';
      parameters: [
        {
          in: 'query';
          name: 'device_id';
          required: false;
          schema: {
            description: "The id of the device this command is targeting. If not supplied, the user's currently active device is the target.";
            example: '0d1841b0976bae2a3a310dd74c0f3df354899bc8';
            title: 'Device ID';
            type: 'string';
          };
        },
      ];
      responses: {
        '204': {
          description: 'Command sent';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['user-modify-playback-state'];
        },
      ];
      summary: 'Skip To Next\n';
      tags: ['Player'];
      'x-spotify-docs-console-url': '/console/post-next/';
      'x-spotify-docs-endpoint-name': 'Skip User’s Playback To Next Track';
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/playerPolicyList';
      };
    };
    'x-spotify-docs-category': 'Player';
    'x-spotify-docs-display-name': 'next';
  };
  '/me/player/pause': {
    put: {
      description: "Pause playback on the user's account.\n";
      operationId: 'pause-a-users-playback';
      parameters: [
        {
          in: 'query';
          name: 'device_id';
          required: false;
          schema: {
            description: "The id of the device this command is targeting. If not supplied, the user's currently active device is the target.\n";
            example: '0d1841b0976bae2a3a310dd74c0f3df354899bc8';
            title: 'Device ID';
            type: 'string';
          };
        },
      ];
      responses: {
        '204': {
          description: 'Playback paused';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['user-modify-playback-state'];
        },
      ];
      summary: 'Pause Playback\n';
      tags: ['Player'];
      'x-spotify-docs-console-url': '/console/put-pause/';
      'x-spotify-docs-endpoint-name': "Pause a User's Playback";
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/playerPolicyList';
      };
    };
    'x-spotify-docs-category': 'Player';
    'x-spotify-docs-display-name': 'pause';
  };
  '/me/player/play': {
    put: {
      description: "Start a new context or resume current playback on the user's active device.\n";
      operationId: 'start-a-users-playback';
      parameters: [
        {
          in: 'query';
          name: 'device_id';
          required: false;
          schema: {
            description: "The id of the device this command is targeting. If not supplied, the user's currently active device is the target.";
            example: '0d1841b0976bae2a3a310dd74c0f3df354899bc8';
            title: 'Device ID';
            type: 'string';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              additionalProperties: true;
              example: {
                context_uri: 'spotify:album:5ht7ItJgpBH7W6vJ5BqpPr';
                offset: {
                  position: 5;
                };
                position_ms: 0;
              };
              properties: {
                context_uri: {
                  additionalProperties: true;
                  description: 'Optional. Spotify URI of the context to play.\nValid contexts are albums, artists & playlists.\n`{context_uri:"spotify:album:1Je1IMUlBXcx1Fz0WE7oPT"}`\n';
                  type: 'string';
                };
                offset: {
                  additionalProperties: true;
                  description: 'Optional. Indicates from where in the context playback should start. Only available when context_uri corresponds to an album or playlist object\n"position" is zero based and can’t be negative. Example: `"offset": {"position": 5}`\n"uri" is a string representing the uri of the item to start at. Example: `"offset": {"uri": "spotify:track:1301WleyT98MSxVHPZCA6M"}`\n';
                  type: 'object';
                };
                position_ms: {
                  additionalProperties: true;
                  description: 'integer';
                  type: 'integer';
                };
                uris: {
                  description: 'Optional. A JSON array of the Spotify track URIs to play.\nFor example: `{"uris": ["spotify:track:4iV5W9uYEdYUVa79Axb7Rh", "spotify:track:1301WleyT98MSxVHPZCA6M"]}`\n';
                  items: {
                    type: 'string';
                  };
                  type: 'array';
                };
              };
              type: 'object';
            };
          };
        };
      };
      responses: {
        '204': {
          description: 'Playback started';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['user-modify-playback-state'];
        },
      ];
      summary: 'Start/Resume Playback\n';
      tags: ['Player'];
      'x-spotify-docs-console-url': '/console/put-play/';
      'x-spotify-docs-endpoint-name': "Start/Resume a User's Playback";
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/playerPolicyList';
      };
    };
    'x-spotify-docs-category': 'Player';
    'x-spotify-docs-display-name': 'play';
  };
  '/me/player/previous': {
    post: {
      description: 'Skips to previous track in the user’s queue.\n';
      operationId: 'skip-users-playback-to-previous-track';
      parameters: [
        {
          in: 'query';
          name: 'device_id';
          required: false;
          schema: {
            description: "The id of the device this command is targeting. If\nnot supplied, the user's currently active device is the target.\n";
            example: '0d1841b0976bae2a3a310dd74c0f3df354899bc8';
            title: 'Device ID';
            type: 'string';
          };
        },
      ];
      responses: {
        '204': {
          description: 'Command sent';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['user-modify-playback-state'];
        },
      ];
      summary: 'Skip To Previous\n';
      tags: ['Player'];
      'x-spotify-docs-console-url': '/console/post-previous/';
      'x-spotify-docs-endpoint-name': 'Skip User’s Playback To Previous Track';
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/playerPolicyList';
      };
    };
    'x-spotify-docs-category': 'Player';
    'x-spotify-docs-display-name': 'previous';
  };
  '/me/player/queue': {
    get: {
      description: "Get the list of objects that make up the user's queue.\n";
      operationId: 'get-queue';
      responses: {
        '200': {
          $ref: '#/components/responses/Queue';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['user-read-playback-state'];
        },
      ];
      summary: "Get the User's Queue\n";
      tags: ['Player'];
      'x-spotify-docs-console-url': '/console/get-queue/';
      'x-spotify-docs-endpoint-name': "Get the User's Queue";
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/playerPolicyList';
      };
    };
    post: {
      description: "Add an item to the end of the user's current playback queue.\n";
      operationId: 'add-to-queue';
      parameters: [
        {
          in: 'query';
          name: 'uri';
          required: true;
          schema: {
            description: 'The uri of the item to add to the queue. Must be a track or an episode uri.\n';
            example: 'spotify:track:4iV5W9uYEdYUVa79Axb7Rh';
            title: 'Spotify URI';
            type: 'string';
          };
        },
        {
          in: 'query';
          name: 'device_id';
          required: false;
          schema: {
            description: "The id of the device this command is targeting. If\nnot supplied, the user's currently active device is the target.\n";
            example: '0d1841b0976bae2a3a310dd74c0f3df354899bc8';
            title: 'Device ID';
            type: 'string';
          };
        },
      ];
      responses: {
        '204': {
          description: 'Command received';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['user-modify-playback-state'];
        },
      ];
      summary: 'Add Item to Playback Queue\n';
      tags: ['Player'];
      'x-spotify-docs-console-url': '/console/post-queue/';
      'x-spotify-docs-endpoint-name': 'Add an item to queue';
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/playerPolicyList';
      };
    };
    'x-spotify-docs-category': 'Player';
    'x-spotify-docs-display-name': 'queue';
  };
  '/me/player/recently-played': {
    get: {
      description: "Get tracks from the current user's recently played tracks.\n_**Note**: Currently doesn't support podcast episodes._\n";
      operationId: 'get-recently-played';
      parameters: [
        {
          in: 'query';
          name: 'limit';
          required: false;
          schema: {
            default: 20;
            description: 'The maximum number of items to return. Default: 20. Minimum: 1. Maximum: 50.\n';
            example: 10;
            maximum: 50;
            minimum: 0;
            title: 'Limit';
            type: 'integer';
          };
        },
        {
          in: 'query';
          name: 'after';
          required: false;
          schema: {
            description: 'A Unix timestamp in milliseconds. Returns all items\nafter (but not including) this cursor position. If `after` is specified, `before`\nmust not be specified.\n';
            example: 1484811043508;
            title: 'After';
            type: 'integer';
          };
        },
        {
          in: 'query';
          name: 'before';
          required: false;
          schema: {
            description: 'A Unix timestamp in milliseconds. Returns all items\nbefore (but not including) this cursor position. If `before` is specified,\n`after` must not be specified.\n';
            title: 'Before';
            type: 'integer';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/CursorPagedPlayHistory';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['user-read-recently-played'];
        },
      ];
      summary: 'Get Recently Played Tracks\n';
      tags: ['Player'];
      'x-spotify-docs-console-url': '/console/get-recently-played/';
      'x-spotify-docs-endpoint-name': "Get Current User's Recently Played Tracks";
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/playerPolicyList';
      };
    };
    'x-spotify-docs-category': 'Player';
    'x-spotify-docs-display-name': 'recently-played';
  };
  '/me/player/repeat': {
    put: {
      description: "Set the repeat mode for the user's playback. Options are repeat-track,\nrepeat-context, and off.\n";
      operationId: 'set-repeat-mode-on-users-playback';
      parameters: [
        {
          in: 'query';
          name: 'state';
          required: true;
          schema: {
            description: '**track**, **context** or **off**.<br/>\n**track** will repeat the current track.<br/>\n**context** will repeat the current context.<br/>\n**off** will turn repeat off.\n';
            example: 'context';
            title: 'State';
            type: 'string';
          };
        },
        {
          in: 'query';
          name: 'device_id';
          required: false;
          schema: {
            description: "The id of the device this command is targeting. If\nnot supplied, the user's currently active device is the target.\n";
            example: '0d1841b0976bae2a3a310dd74c0f3df354899bc8';
            title: 'Device ID';
            type: 'string';
          };
        },
      ];
      responses: {
        '204': {
          description: 'Command sent';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['user-modify-playback-state'];
        },
      ];
      summary: 'Set Repeat Mode\n';
      tags: ['Player'];
      'x-spotify-docs-console-url': '/console/put-repeat/';
      'x-spotify-docs-endpoint-name': 'Set Repeat Mode On User’s Playback';
    };
    'x-spotify-docs-category': 'Player';
    'x-spotify-docs-display-name': 'repeat';
  };
  '/me/player/seek': {
    put: {
      description: 'Seeks to the given position in the user’s currently playing track.\n';
      operationId: 'seek-to-position-in-currently-playing-track';
      parameters: [
        {
          in: 'query';
          name: 'position_ms';
          required: true;
          schema: {
            description: 'The position in milliseconds to seek to. Must be a\npositive number. Passing in a position that is greater than the length of\nthe track will cause the player to start playing the next song.\n';
            example: 25000;
            title: 'Position (ms)';
            type: 'integer';
          };
        },
        {
          in: 'query';
          name: 'device_id';
          required: false;
          schema: {
            description: "The id of the device this command is targeting. If\nnot supplied, the user's currently active device is the target.\n";
            example: '0d1841b0976bae2a3a310dd74c0f3df354899bc8';
            title: 'Device ID';
            type: 'string';
          };
        },
      ];
      responses: {
        '204': {
          description: 'Command sent';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['user-modify-playback-state'];
        },
      ];
      summary: 'Seek To Position\n';
      tags: ['Player'];
      'x-spotify-docs-console-url': '/console/put-seek/';
      'x-spotify-docs-endpoint-name': 'Seek To Position In Currently Playing Track';
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/playerPolicyList';
      };
    };
    'x-spotify-docs-category': 'Player';
    'x-spotify-docs-display-name': 'seek';
  };
  '/me/player/shuffle': {
    put: {
      description: 'Toggle shuffle on or off for user’s playback.\n';
      operationId: 'toggle-shuffle-for-users-playback';
      parameters: [
        {
          in: 'query';
          name: 'state';
          required: true;
          schema: {
            description: "**true** : Shuffle user's playback.<br/>\n**false** : Do not shuffle user's playback.\n";
            example: true;
            title: 'State';
            type: 'boolean';
          };
        },
        {
          in: 'query';
          name: 'device_id';
          required: false;
          schema: {
            description: "The id of the device this command is targeting. If\nnot supplied, the user's currently active device is the target.\n";
            example: '0d1841b0976bae2a3a310dd74c0f3df354899bc8';
            title: 'Device ID';
            type: 'string';
          };
        },
      ];
      responses: {
        '204': {
          description: 'Command sent';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['user-modify-playback-state'];
        },
      ];
      summary: 'Toggle Playback Shuffle\n';
      tags: ['Player'];
      'x-spotify-docs-console-url': '/console/put-shuffle/?state=true';
      'x-spotify-docs-endpoint-name': 'Toggle Shuffle For User’s Playback';
    };
    'x-spotify-docs-category': 'Player';
    'x-spotify-docs-display-name': 'shuffle';
  };
  '/me/player/volume': {
    put: {
      description: 'Set the volume for the user’s current playback device.\n';
      operationId: 'set-volume-for-users-playback';
      parameters: [
        {
          in: 'query';
          name: 'volume_percent';
          required: true;
          schema: {
            description: 'The volume to set. Must be a value from 0 to 100 inclusive.\n';
            example: 50;
            title: 'Volume %';
            type: 'integer';
          };
        },
        {
          in: 'query';
          name: 'device_id';
          required: false;
          schema: {
            description: "The id of the device this command is targeting. If not supplied, the user's currently active device is the target.\n";
            example: '0d1841b0976bae2a3a310dd74c0f3df354899bc8';
            title: 'Device ID';
            type: 'string';
          };
        },
      ];
      responses: {
        '204': {
          description: 'Command sent';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['user-modify-playback-state'];
        },
      ];
      summary: 'Set Playback Volume\n';
      tags: ['Player'];
      'x-spotify-docs-console-url': '/console/put-volume/';
      'x-spotify-docs-endpoint-name': "Set Volume For User's Playback";
    };
    'x-spotify-docs-category': 'Player';
    'x-spotify-docs-display-name': 'volume';
  };
  '/me/playlists': {
    get: {
      description: 'Get a list of the playlists owned or followed by the current Spotify\nuser.\n';
      operationId: 'get-a-list-of-current-users-playlists';
      parameters: [
        {
          $ref: '#/components/parameters/QueryLimit';
        },
        {
          in: 'query';
          name: 'offset';
          required: false;
          schema: {
            default: 0;
            description: "'The index of the first playlist to return. Default:\n0 (the first object). Maximum offset: 100.000\\. Use with `limit` to get the\nnext set of playlists.'\n";
            example: 5;
            title: 'Offset';
            type: 'integer';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/PagedPlaylists';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['playlist-read-private'];
        },
      ];
      summary: "Get Current User's Playlists\n";
      tags: ['Playlists', 'Library'];
      'x-spotify-docs-console-url': '/console/get-current-user-playlists/';
      'x-spotify-docs-endpoint-name': "Get a List of Current User's Playlists";
    };
    'x-spotify-docs-category': 'Playlists';
    'x-spotify-docs-display-name': 'current-user-playlists';
  };
  '/me/shows': {
    delete: {
      description: "Delete one or more shows from current Spotify user's library.\n";
      operationId: 'remove-shows-user';
      parameters: [
        {
          $ref: '#/components/parameters/QueryShowIds';
        },
        {
          $ref: '#/components/parameters/QueryMarket';
        },
      ];
      responses: {
        '200': {
          description: 'Show removed';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['user-library-modify'];
        },
      ];
      summary: "Remove User's Saved Shows\n";
      tags: ['Shows', 'Library'];
      'x-spotify-docs-console-url': '/console/delete-current-user-saved-shows/?ids=5AvwZVawapvyhJUIx71pdJ%2C6ups0LMt1G8n81XLlkbsPo%2C5AvwZVawapvyhJUIx71pdJ';
      'x-spotify-docs-endpoint-name': "Remove User's Saved Shows";
    };
    get: {
      description: "Get a list of shows saved in the current Spotify user's library. Optional parameters can be used to limit the number of shows returned.\n";
      operationId: 'get-users-saved-shows';
      parameters: [
        {
          $ref: '#/components/parameters/QueryLimit';
        },
        {
          $ref: '#/components/parameters/QueryOffset';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/PagingSavedShowObject';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['user-library-read'];
        },
      ];
      summary: "Get User's Saved Shows\n";
      tags: ['Shows', 'Library'];
      'x-spotify-docs-console-url': '/console/get-current-user-saved-shows/';
      'x-spotify-docs-endpoint-name': "Get User's Saved Shows";
    };
    put: {
      description: "Save one or more shows to current Spotify user's library.\n";
      operationId: 'save-shows-user';
      parameters: [
        {
          $ref: '#/components/parameters/QueryShowIds';
        },
      ];
      responses: {
        '200': {
          description: 'Show saved';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['user-library-modify'];
        },
      ];
      summary: 'Save Shows for Current User\n';
      tags: ['Shows', 'Library'];
      'x-spotify-docs-console-url': '/console/put-current-user-saved-shows/?ids=5AvwZVawapvyhJUIx71pdJ%2C6ups0LMt1G8n81XLlkbsPo%2C5AvwZVawapvyhJUIx71pdJ';
      'x-spotify-docs-endpoint-name': 'Save Shows for Current User';
    };
    'x-spotify-docs-category': 'Library';
    'x-spotify-docs-display-name': 'current-user-saved-shows';
  };
  '/me/shows/contains': {
    get: {
      description: "Check if one or more shows is already saved in the current Spotify user's library.\n";
      operationId: 'check-users-saved-shows';
      parameters: [
        {
          $ref: '#/components/parameters/QueryShowIds';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/ArrayOfBooleans';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['user-library-read'];
        },
      ];
      summary: "Check User's Saved Shows\n";
      tags: ['Shows', 'Library'];
      'x-spotify-docs-console-url': '/console/get-current-user-contains-saved-shows/?ids=5AvwZVawapvyhJUIx71pdJ%2C6ups0LMt1G8n81XLlkbsPo%2C5AvwZVawapvyhJUIx71pdJ';
      'x-spotify-docs-endpoint-name': "Check User's Saved Shows";
    };
    'x-spotify-docs-category': 'Library';
    'x-spotify-docs-display-name': 'current-user-contains-saved-shows';
  };
  '/me/top/{type}': {
    get: {
      description: "Get the current user's top artists or tracks based on calculated affinity.\n";
      operationId: 'get-users-top-artists-and-tracks';
      parameters: [
        {
          in: 'path';
          name: 'type';
          required: true;
          schema: {
            description: 'The type of entity to return. Valid values: `artists` or `tracks`\n';
            enum: ['artists', 'tracks'];
            title: 'Type';
            type: 'string';
          };
        },
        {
          in: 'query';
          name: 'time_range';
          required: false;
          schema: {
            default: 'medium_term';
            description: 'Over what time frame the affinities are computed. Valid values: `long_term` (calculated from several years of data and including all new data as it becomes available), `medium_term` (approximately last 6 months), `short_term` (approximately last 4 weeks). Default: `medium_term`\n';
            example: 'medium_term';
            title: 'Time Range';
            type: 'string';
          };
        },
        {
          $ref: '#/components/parameters/QueryLimit';
        },
        {
          $ref: '#/components/parameters/QueryOffset';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/PagingArtistOrTrackObject';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['user-top-read'];
        },
      ];
      summary: "Get User's Top Items\n";
      tags: ['Users', 'Tracks', 'Library'];
      'x-spotify-docs-console-url': '/console/get-current-user-top-artists-and-tracks/?type=artists';
      'x-spotify-docs-endpoint-name': "Get a User's Top Artists and Tracks";
    };
    'x-spotify-docs-category': 'Personalization';
    'x-spotify-docs-display-name': 'current-user-top-artists-and-tracks';
  };
  '/me/tracks': {
    delete: {
      description: "Remove one or more tracks from the current user's 'Your Music' library.\n";
      operationId: 'remove-tracks-user';
      parameters: [
        {
          $ref: '#/components/parameters/QueryTrackIds';
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              additionalProperties: true;
              properties: {
                ids: {
                  description: 'A JSON array of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids). For example: `["4iV5W9uYEdYUVa79Axb7Rh", "1301WleyT98MSxVHPZCA6M"]`<br/>A maximum of 50 items can be specified in one request. _**Note**: if the `ids` parameter is present in the query string, any IDs listed here in the body will be ignored._\n';
                  items: {
                    type: 'string';
                  };
                  type: 'array';
                };
              };
              type: 'object';
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Track removed';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['user-library-modify'];
        },
      ];
      summary: "Remove User's Saved Tracks\n";
      tags: ['Tracks', 'Library'];
      'x-spotify-docs-console-url': '/console/delete-current-user-saved-tracks/?ids=7ouMYWpwJ422jRcDASZB7P%2C4VqPOruhp5EdPBeR92t6lQ%2C2takcwOaAZWiXQijPHIx7B';
      'x-spotify-docs-endpoint-name': "Remove User's Saved Tracks";
    };
    get: {
      description: "Get a list of the songs saved in the current Spotify user's 'Your Music' library.\n";
      operationId: 'get-users-saved-tracks';
      parameters: [
        {
          $ref: '#/components/parameters/QueryMarket';
        },
        {
          $ref: '#/components/parameters/QueryLimit';
        },
        {
          $ref: '#/components/parameters/QueryOffset';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/PagingSavedTrackObject';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['user-library-read'];
        },
      ];
      summary: "Get User's Saved Tracks\n";
      tags: ['Tracks', 'Library'];
      'x-spotify-docs-console-url': '/console/get-current-user-saved-tracks/';
      'x-spotify-docs-endpoint-name': "Get User's Saved Tracks";
    };
    put: {
      description: "Save one or more tracks to the current user's 'Your Music' library.\n";
      operationId: 'save-tracks-user';
      parameters: [
        {
          $ref: '#/components/parameters/QueryTrackIds';
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              additionalProperties: true;
              properties: {
                ids: {
                  description: 'A JSON array of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids). For example: `["4iV5W9uYEdYUVa79Axb7Rh", "1301WleyT98MSxVHPZCA6M"]`<br/>A maximum of 50 items can be specified in one request. _**Note**: if the `ids` parameter is present in the query string, any IDs listed here in the body will be ignored._\n';
                  items: {
                    type: 'string';
                  };
                  type: 'array';
                };
              };
              required: ['uris'];
              type: 'object';
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Track saved';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['user-library-modify'];
        },
      ];
      summary: 'Save Tracks for Current User\n';
      tags: ['Tracks', 'Library'];
      'x-spotify-docs-console-url': '/console/put-current-user-saved-tracks/?ids=7ouMYWpwJ422jRcDASZB7P%2C4VqPOruhp5EdPBeR92t6lQ%2C2takcwOaAZWiXQijPHIx7B';
      'x-spotify-docs-endpoint-name': 'Save Tracks for User';
    };
    'x-spotify-docs-category': 'Library';
    'x-spotify-docs-display-name': 'current-user-saved-tracks';
  };
  '/me/tracks/contains': {
    get: {
      description: "Check if one or more tracks is already saved in the current Spotify user's 'Your Music' library.\n";
      operationId: 'check-users-saved-tracks';
      parameters: [
        {
          $ref: '#/components/parameters/QueryTrackIds';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/ArrayOfBooleans';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['user-library-read'];
        },
      ];
      summary: "Check User's Saved Tracks\n";
      tags: ['Tracks', 'Library'];
      'x-spotify-docs-console-url': '/console/get-current-user-contains-saved-tracks/?ids=0udZHhCi7p1YzMlvI4fXoK%2C3SF5puV5eb6bgRSxBeMOk9';
      'x-spotify-docs-endpoint-name': "Check User's Saved Tracks";
    };
    'x-spotify-docs-category': 'Library';
    'x-spotify-docs-display-name': 'current-user-contains-saved-tracks';
  };
  '/playlists/{playlist_id}': {
    get: {
      description: 'Get a playlist owned by a Spotify user.\n';
      operationId: 'get-playlist';
      parameters: [
        {
          $ref: '#/components/parameters/PathPlaylistId';
        },
        {
          $ref: '#/components/parameters/QueryMarket';
        },
        {
          in: 'query';
          name: 'fields';
          required: false;
          schema: {
            description: "Filters for the query: a comma-separated list of the\nfields to return. If omitted, all fields are returned. For example, to get\njust the playlist''s description and URI: `fields=description,uri`. A dot\nseparator can be used to specify non-reoccurring fields, while parentheses\ncan be used to specify reoccurring fields within objects. For example, to\nget just the added date and user ID of the adder: `fields=tracks.items(added_at,added_by.id)`.\nUse multiple parentheses to drill down into nested objects, for example: `fields=tracks.items(track(name,href,album(name,href)))`.\nFields can be excluded by prefixing them with an exclamation mark, for example:\n`fields=tracks.items(track(name,href,album(!name,href)))`\n";
            example: 'items(added_by.id,track(name,href,album(name,href)))';
            title: 'Fields';
            type: 'string';
          };
        },
        {
          $ref: '#/components/parameters/QueryAdditionalTypes';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/OnePlaylist';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: [];
        },
      ];
      summary: 'Get Playlist\n';
      tags: ['Playlists'];
      'x-spotify-docs-console-url': '/console/get-playlist/?playlist_id=59ZbFPES4DQwEjBpWHzrtC&amp;user_id=spotify';
      'x-spotify-docs-endpoint-name': 'Get a Playlist';
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/metadataPolicyList';
      };
    };
    put: {
      description: "Change a playlist's name and public/private state. (The user must, of\ncourse, own the playlist.)\n";
      operationId: 'change-playlist-details';
      parameters: [
        {
          $ref: '#/components/parameters/PathPlaylistId';
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              additionalProperties: true;
              example: {
                description: 'Updated playlist description';
                name: 'Updated Playlist Name';
                public: false;
              };
              properties: {
                collaborative: {
                  description: 'If `true`, the playlist will become collaborative and other users will be able to modify the playlist in their Spotify client. <br/>\n_**Note**: You can only set `collaborative` to `true` on non-public playlists._\n';
                  type: 'boolean';
                };
                description: {
                  description: 'Value for playlist description as displayed in Spotify Clients and in the Web API.\n';
                  type: 'string';
                };
                name: {
                  description: 'The new name for the playlist, for example `"My New Playlist Title"`\n';
                  type: 'string';
                };
                public: {
                  description: 'If `true` the playlist will be public, if `false` it will be private.\n';
                  type: 'boolean';
                };
              };
              type: 'object';
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Playlist updated';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['playlist-modify-public', 'playlist-modify-private'];
        },
      ];
      summary: 'Change Playlist Details\n';
      tags: ['Playlists', 'Library'];
      'x-spotify-docs-console-url': '/console/put-playlist/';
      'x-spotify-docs-endpoint-name': "Change a Playlist's Details";
    };
    'x-spotify-docs-category': 'Playlists';
    'x-spotify-docs-display-name': 'playlist';
  };
  '/playlists/{playlist_id}/followers': {
    delete: {
      description: 'Remove the current user as a follower of a playlist.\n';
      operationId: 'unfollow-playlist';
      parameters: [
        {
          $ref: '#/components/parameters/PathPlaylistId';
        },
      ];
      responses: {
        '200': {
          description: 'Playlist unfollowed';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['playlist-modify-public', 'playlist-modify-private'];
        },
      ];
      summary: 'Unfollow Playlist\n';
      tags: ['Users', 'Playlists'];
      'x-spotify-docs-console-url': '/console/delete-playlist-followers/?playlist_id=2v3iNvBX8Ay1Gt2uXtUKUT&amp;user_id=jmperezperez';
      'x-spotify-docs-endpoint-name': 'Unfollow Playlist';
    };
    put: {
      description: 'Add the current user as a follower of a playlist.\n';
      operationId: 'follow-playlist';
      parameters: [
        {
          $ref: '#/components/parameters/PathPlaylistId';
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              additionalProperties: true;
              example: {
                public: false;
              };
              properties: {
                public: {
                  description: "Defaults to `true`. If `true` the playlist will be included in user's public playlists, if `false` it will remain private.\n";
                  type: 'boolean';
                };
              };
              type: 'object';
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Playlist followed';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['playlist-modify-public', 'playlist-modify-private'];
        },
      ];
      summary: 'Follow Playlist\n';
      tags: ['Users', 'Playlists'];
      'x-spotify-docs-console-url': '/console/put-playlist-followers/?playlist_id=2v3iNvBX8Ay1Gt2uXtUKUT&amp;body-json=%7B%0D%0A++%22public%22%3A+true%0D%0A%7D&amp;user_id=jmperezperez';
      'x-spotify-docs-endpoint-name': 'Follow a Playlist';
    };
    'x-spotify-docs-category': 'Follow';
    'x-spotify-docs-display-name': 'playlist-followers';
  };
  '/playlists/{playlist_id}/followers/contains': {
    get: {
      description: 'Check to see if one or more Spotify users are following a specified playlist.\n';
      operationId: 'check-if-user-follows-playlist';
      parameters: [
        {
          $ref: '#/components/parameters/PathPlaylistId';
        },
        {
          in: 'query';
          name: 'ids';
          required: true;
          schema: {
            description: 'A comma-separated list of [Spotify User IDs](/documentation/web-api/concepts/spotify-uris-ids) ; the ids of the users that you want to check to see if they follow the playlist. Maximum: 5 ids.\n';
            example: 'jmperezperez,thelinmichael,wizzler';
            title: 'Spotify user IDs';
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/ArrayOfBooleans';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: [];
        },
      ];
      summary: 'Check if Users Follow Playlist\n';
      tags: ['Users', 'Playlists'];
      'x-spotify-docs-console-url': '/console/get-playlist-followers-contains/?ids=possan,elogain&amp;user_id=jmperezperez&amp;playlist_id=2v3iNvBX8Ay1Gt2uXtUKUT';
      'x-spotify-docs-endpoint-name': 'Check if Users Follow a Playlist';
    };
    'x-spotify-docs-category': 'Follow';
    'x-spotify-docs-display-name': 'playlist-followers-contains';
  };
  '/playlists/{playlist_id}/images': {
    get: {
      description: 'Get the current image associated with a specific playlist.\n';
      operationId: 'get-playlist-cover';
      parameters: [
        {
          $ref: '#/components/parameters/PathPlaylistId';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/ArrayOfImages';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: [];
        },
      ];
      summary: 'Get Playlist Cover Image\n';
      tags: ['Playlists'];
      'x-spotify-docs-console-url': '/console/get-playlist-images?playlist_id=3cEYpjA9oz9GiPac4AsH4n';
      'x-spotify-docs-endpoint-name': 'Get a Playlist Cover Image';
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/metadataPolicyList';
      };
    };
    put: {
      description: 'Replace the image used to represent a specific playlist.\n';
      operationId: 'upload-custom-playlist-cover';
      parameters: [
        {
          $ref: '#/components/parameters/PathPlaylistId';
        },
      ];
      requestBody: {
        content: {
          'image/jpeg': {
            schema: {
              description: 'Base64 encoded JPEG image data, maximum payload size is 256 KB.';
              example: '/9j/2wCEABoZGSccJz4lJT5CLy8vQkc9Ozs9R0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0cBHCcnMyYzPSYmPUc9Mj1HR0dEREdHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR//dAAQAAf/uAA5BZG9iZQBkwAAAAAH/wAARCAABAAEDACIAAREBAhEB/8QASwABAQAAAAAAAAAAAAAAAAAAAAYBAQAAAAAAAAAAAAAAAAAAAAAQAQAAAAAAAAAAAAAAAAAAAAARAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwAAARECEQA/AJgAH//Z';
              format: 'byte';
              type: 'string';
            };
          };
        };
      };
      responses: {
        '202': {
          description: 'Image uploaded';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['ugc-image-upload', 'playlist-modify-public', 'playlist-modify-private'];
        },
      ];
      summary: 'Add Custom Playlist Cover Image\n';
      tags: ['Playlists'];
      'x-spotify-docs-console-url': '/console/put-playlist-images?playlist_id=3cEYpjA9oz9GiPac4AsH4n';
      'x-spotify-docs-endpoint-name': 'Upload a Custom Playlist Cover Image';
    };
    'x-spotify-docs-category': 'Playlists';
    'x-spotify-docs-display-name': 'playlist-images';
  };
  '/playlists/{playlist_id}/tracks': {
    delete: {
      description: "Remove one or more items from a user's playlist.\n";
      operationId: 'remove-tracks-playlist';
      parameters: [
        {
          $ref: '#/components/parameters/PathPlaylistId';
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              properties: {
                snapshot_id: {
                  description: "The playlist's snapshot ID against which you want to make the changes.\nThe API will validate that the specified items exist and in the specified positions and make the changes,\neven if more recent changes have been made to the playlist.\n";
                  type: 'string';
                };
                tracks: {
                  description: 'An array of objects containing [Spotify URIs](/documentation/web-api/concepts/spotify-uris-ids) of the tracks or episodes to remove.\nFor example: `{ "tracks": [{ "uri": "spotify:track:4iV5W9uYEdYUVa79Axb7Rh" },{ "uri": "spotify:track:1301WleyT98MSxVHPZCA6M" }] }`. A maximum of 100 objects can be sent at once.\n';
                  items: {
                    properties: {
                      uri: {
                        description: 'Spotify URI';
                        type: 'string';
                      };
                    };
                    type: 'object';
                  };
                  type: 'array';
                };
              };
              required: ['tracks'];
              type: 'object';
            };
          };
        };
      };
      responses: {
        '200': {
          $ref: '#/components/responses/PlaylistSnapshotId';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['playlist-modify-public', 'playlist-modify-private'];
        },
      ];
      summary: 'Remove Playlist Items\n';
      tags: ['Playlists', 'Tracks'];
      'x-spotify-docs-console-url': '/console/delete-playlist-tracks/';
      'x-spotify-docs-endpoint-name': 'Remove Items from a Playlist';
    };
    get: {
      description: 'Get full details of the items of a playlist owned by a Spotify user.\n';
      operationId: 'get-playlists-tracks';
      parameters: [
        {
          $ref: '#/components/parameters/PathPlaylistId';
        },
        {
          $ref: '#/components/parameters/QueryMarket';
        },
        {
          in: 'query';
          name: 'fields';
          required: false;
          schema: {
            description: 'Filters for the query: a comma-separated list of the\nfields to return. If omitted, all fields are returned. For example, to get\njust the total number of items and the request limit:<br/>`fields=total,limit`<br/>A\ndot separator can be used to specify non-reoccurring fields, while parentheses\ncan be used to specify reoccurring fields within objects. For example, to\nget just the added date and user ID of the adder:<br/>`fields=items(added_at,added_by.id)`<br/>Use\nmultiple parentheses to drill down into nested objects, for example:<br/>`fields=items(track(name,href,album(name,href)))`<br/>Fields\ncan be excluded by prefixing them with an exclamation mark, for example:<br/>`fields=items.track.album(!external_urls,images)`\n';
            example: 'items(added_by.id,track(name,href,album(name,href)))';
            title: 'Fields';
            type: 'string';
          };
        },
        {
          $ref: '#/components/parameters/QueryLimit';
        },
        {
          $ref: '#/components/parameters/QueryOffset';
        },
        {
          $ref: '#/components/parameters/QueryAdditionalTypes';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/PagingPlaylistTrackObject';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['playlist-read-private'];
        },
      ];
      summary: 'Get Playlist Items\n';
      tags: ['Playlists', 'Tracks'];
      'x-spotify-docs-console-url': '/console/get-playlist-tracks/?playlist_id=21THa8j9TaSGuXYNBU5tsC&amp;user_id=spotify_espa%C3%B1a';
      'x-spotify-docs-endpoint-name': "Get a Playlist's Items";
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/metadataPolicyList';
      };
    };
    post: {
      description: "Add one or more items to a user's playlist.\n";
      operationId: 'add-tracks-to-playlist';
      parameters: [
        {
          $ref: '#/components/parameters/PathPlaylistId';
        },
        {
          in: 'query';
          name: 'position';
          required: false;
          schema: {
            description: 'The position to insert the items, a zero-based index. For example, to insert the items in the first position: `position=0`; to insert the items in the third position: `position=2`. If omitted, the items will be appended to the playlist. Items are added in the order they are listed in the query string or request body.\n';
            example: 0;
            title: 'Position (append by default)';
            type: 'integer';
          };
        },
        {
          in: 'query';
          name: 'uris';
          required: false;
          schema: {
            description: 'A comma-separated list of [Spotify URIs](/documentation/web-api/concepts/spotify-uris-ids) to add, can be track or episode URIs. For example:<br/>`uris=spotify:track:4iV5W9uYEdYUVa79Axb7Rh, spotify:track:1301WleyT98MSxVHPZCA6M, spotify:episode:512ojhOuo1ktJprKbVcKyQ`<br/>A maximum of 100 items can be added in one request. <br/>\n_**Note**: it is likely that passing a large number of item URIs as a query parameter will exceed the maximum length of the request URI. When adding a large number of items, it is recommended to pass them in the request body, see below._\n';
            example: 'spotify:track:4iV5W9uYEdYUVa79Axb7Rh,spotify:track:1301WleyT98MSxVHPZCA6M';
            title: 'Spotify Track URIs';
            type: 'string';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              additionalProperties: true;
              properties: {
                position: {
                  description: 'The position to insert the items, a zero-based index. For example, to insert the items in the first position: `position=0` ; to insert the items in the third position: `position=2`. If omitted, the items will be appended to the playlist. Items are added in the order they appear in the uris array. For example: `{"uris": ["spotify:track:4iV5W9uYEdYUVa79Axb7Rh","spotify:track:1301WleyT98MSxVHPZCA6M"], "position": 3}`\n';
                  type: 'integer';
                };
                uris: {
                  description: 'A JSON array of the [Spotify URIs](/documentation/web-api/concepts/spotify-uris-ids) to add. For example: `{"uris": ["spotify:track:4iV5W9uYEdYUVa79Axb7Rh","spotify:track:1301WleyT98MSxVHPZCA6M", "spotify:episode:512ojhOuo1ktJprKbVcKyQ"]}`<br/>A maximum of 100 items can be added in one request. _**Note**: if the `uris` parameter is present in the query string, any URIs listed here in the body will be ignored._\n';
                  items: {
                    type: 'string';
                  };
                  type: 'array';
                };
              };
              type: 'object';
            };
          };
        };
      };
      responses: {
        '201': {
          $ref: '#/components/responses/PlaylistSnapshotId';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['playlist-modify-public', 'playlist-modify-private'];
        },
      ];
      summary: 'Add Items to Playlist\n';
      tags: ['Playlists', 'Tracks'];
      'x-spotify-docs-console-url': '/console/post-playlist-tracks/';
      'x-spotify-docs-endpoint-name': 'Add Items to a Playlist';
    };
    put: {
      description: "Either reorder or replace items in a playlist depending on the request's parameters.\nTo reorder items, include `range_start`, `insert_before`, `range_length` and `snapshot_id` in the request's body.\nTo replace items, include `uris` as either a query parameter or in the request's body.\nReplacing items in a playlist will overwrite its existing items. This operation can be used for replacing or clearing items in a playlist.\n<br/>\n**Note**: Replace and reorder are mutually exclusive operations which share the same endpoint, but have different parameters.\nThese operations can't be applied together in a single request.\n";
      operationId: 'reorder-or-replace-playlists-tracks';
      parameters: [
        {
          $ref: '#/components/parameters/PathPlaylistId';
        },
        {
          in: 'query';
          name: 'uris';
          required: false;
          schema: {
            description: 'A comma-separated list of [Spotify URIs](/documentation/web-api/concepts/spotify-uris-ids) to set, can be track or episode URIs. For example: `uris=spotify:track:4iV5W9uYEdYUVa79Axb7Rh,spotify:track:1301WleyT98MSxVHPZCA6M,spotify:episode:512ojhOuo1ktJprKbVcKyQ`<br/>A maximum of 100 items can be set in one request.\n';
            title: 'Spotify Track URIs';
            type: 'string';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              additionalProperties: true;
              example: {
                insert_before: 3;
                range_length: 2;
                range_start: 1;
              };
              properties: {
                insert_before: {
                  description: 'The position where the items should be inserted.<br/>To reorder the items to the end of the playlist, simply set _insert_before_ to the position after the last item.<br/>Examples:<br/>To reorder the first item to the last position in a playlist with 10 items, set _range_start_ to 0, and _insert_before_ to 10.<br/>To reorder the last item in a playlist with 10 items to the start of the playlist, set _range_start_ to 9, and _insert_before_ to 0.\n';
                  type: 'integer';
                };
                range_length: {
                  description: 'The amount of items to be reordered. Defaults to 1 if not set.<br/>The range of items to be reordered begins from the _range_start_ position, and includes the _range_length_ subsequent items.<br/>Example:<br/>To move the items at index 9-10 to the start of the playlist, _range_start_ is set to 9, and _range_length_ is set to 2.\n';
                  type: 'integer';
                };
                range_start: {
                  description: 'The position of the first item to be reordered.\n';
                  type: 'integer';
                };
                snapshot_id: {
                  description: "The playlist's snapshot ID against which you want to make the changes.\n";
                  type: 'string';
                };
                uris: {
                  items: {
                    type: 'string';
                  };
                  type: 'array';
                };
              };
              type: 'object';
            };
          };
        };
      };
      responses: {
        '200': {
          $ref: '#/components/responses/PlaylistSnapshotId';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['playlist-modify-public', 'playlist-modify-private'];
        },
      ];
      summary: 'Update Playlist Items\n';
      tags: ['Playlists', 'Tracks'];
      'x-spotify-docs-console-url': '/console/put-playlist-tracks/';
      'x-spotify-docs-endpoint-name': "Reorder or Replace a Playlist's Items";
    };
    'x-spotify-docs-category': 'Playlists';
    'x-spotify-docs-display-name': 'playlist-tracks';
  };
  '/recommendations': {
    get: {
      description: 'Recommendations are generated based on the available information for a given seed entity and matched against similar artists and tracks. If there is sufficient information about the provided seeds, a list of tracks will be returned together with pool size details.\n\nFor artists and tracks that are very new or obscure there might not be enough data to generate a list of tracks.\n';
      operationId: 'get-recommendations';
      parameters: [
        {
          in: 'query';
          name: 'limit';
          required: false;
          schema: {
            default: 20;
            description: 'The target size of the list of recommended tracks. For seeds with unusually small pools or when highly restrictive filtering is applied, it may be impossible to generate the requested number of recommended tracks. Debugging information for such cases is available in the response. Default: 20\\. Minimum: 1\\. Maximum: 100.\n';
            example: 10;
            maximum: 100;
            minimum: 1;
            title: 'Limit';
            type: 'integer';
          };
        },
        {
          $ref: '#/components/parameters/QueryMarket';
        },
        {
          in: 'query';
          name: 'seed_artists';
          required: true;
          schema: {
            description: 'A comma separated list of [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids) for seed artists.  Up to 5 seed values may be provided in any combination of `seed_artists`, `seed_tracks` and `seed_genres`.\n';
            example: '4NHQUGzhtTLFvgF5SZesLK';
            title: 'Spotify Artist ID Seeds';
            type: 'string';
          };
        },
        {
          in: 'query';
          name: 'seed_genres';
          required: true;
          schema: {
            description: 'A comma separated list of any genres in the set of [available genre seeds](#available-genre-seeds).  Up to 5 seed values may be provided in any combination of `seed_artists`, `seed_tracks` and `seed_genres`.\n';
            example: 'classical,country';
            title: 'Genres Seeds';
            type: 'string';
          };
        },
        {
          in: 'query';
          name: 'seed_tracks';
          required: true;
          schema: {
            description: 'A comma separated list of [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids) for a seed track.  Up to 5 seed values may be provided in any combination of `seed_artists`, `seed_tracks` and `seed_genres`.\n';
            example: '0c6xIDDpzE81m2q797ordA';
            title: 'Spotify Track ID Seeds';
            type: 'string';
          };
        },
        {
          in: 'query';
          name: 'min_acousticness';
          required: false;
          schema: {
            description: 'For each tunable track attribute, a hard floor on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `min_tempo=140` would restrict results to only those tracks with a tempo of greater than 140 beats per minute.\n';
            maximum: 1;
            minimum: 0;
            title: 'Min. Acousticness';
            type: 'number';
          };
        },
        {
          in: 'query';
          name: 'max_acousticness';
          required: false;
          schema: {
            description: 'For each tunable track attribute, a hard ceiling on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `max_instrumentalness=0.35` would filter out most tracks that are likely to be instrumental.\n';
            maximum: 1;
            minimum: 0;
            title: 'Max. Acousticness';
            type: 'number';
          };
        },
        {
          in: 'query';
          name: 'target_acousticness';
          required: false;
          schema: {
            description: 'For each of the tunable track attributes (below) a target value may be provided. Tracks with the attribute values nearest to the target values will be preferred. For example, you might request `target_energy=0.6` and `target_danceability=0.8`. All target values will be weighed equally in ranking results.\n';
            maximum: 1;
            minimum: 0;
            title: 'Target Acousticness';
            type: 'number';
          };
        },
        {
          in: 'query';
          name: 'min_danceability';
          required: false;
          schema: {
            description: 'For each tunable track attribute, a hard floor on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `min_tempo=140` would restrict results to only those tracks with a tempo of greater than 140 beats per minute.\n';
            maximum: 1;
            minimum: 0;
            title: 'Min. Danceability';
            type: 'number';
          };
        },
        {
          in: 'query';
          name: 'max_danceability';
          required: false;
          schema: {
            description: 'For each tunable track attribute, a hard ceiling on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `max_instrumentalness=0.35` would filter out most tracks that are likely to be instrumental.\n';
            maximum: 1;
            minimum: 0;
            title: 'Max. Danceability';
            type: 'number';
          };
        },
        {
          in: 'query';
          name: 'target_danceability';
          required: false;
          schema: {
            description: 'For each of the tunable track attributes (below) a target value may be provided. Tracks with the attribute values nearest to the target values will be preferred. For example, you might request `target_energy=0.6` and `target_danceability=0.8`. All target values will be weighed equally in ranking results.\n';
            maximum: 1;
            minimum: 0;
            title: 'Target Danceability';
            type: 'number';
          };
        },
        {
          in: 'query';
          name: 'min_duration_ms';
          required: false;
          schema: {
            description: 'For each tunable track attribute, a hard floor on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `min_tempo=140` would restrict results to only those tracks with a tempo of greater than 140 beats per minute.\n';
            title: 'Min. Duration (ms)';
            type: 'integer';
          };
        },
        {
          in: 'query';
          name: 'max_duration_ms';
          required: false;
          schema: {
            description: 'For each tunable track attribute, a hard ceiling on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `max_instrumentalness=0.35` would filter out most tracks that are likely to be instrumental.\n';
            title: 'Max. Duration (ms)';
            type: 'integer';
          };
        },
        {
          in: 'query';
          name: 'target_duration_ms';
          required: false;
          schema: {
            description: 'Target duration of the track (ms)';
            title: 'Target Duration (ms)';
            type: 'integer';
          };
        },
        {
          in: 'query';
          name: 'min_energy';
          required: false;
          schema: {
            description: 'For each tunable track attribute, a hard floor on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `min_tempo=140` would restrict results to only those tracks with a tempo of greater than 140 beats per minute.\n';
            maximum: 1;
            minimum: 0;
            title: 'Min. Energy';
            type: 'number';
          };
        },
        {
          in: 'query';
          name: 'max_energy';
          required: false;
          schema: {
            description: 'For each tunable track attribute, a hard ceiling on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `max_instrumentalness=0.35` would filter out most tracks that are likely to be instrumental.\n';
            maximum: 1;
            minimum: 0;
            title: 'Max. Energy';
            type: 'number';
          };
        },
        {
          in: 'query';
          name: 'target_energy';
          required: false;
          schema: {
            description: 'For each of the tunable track attributes (below) a target value may be provided. Tracks with the attribute values nearest to the target values will be preferred. For example, you might request `target_energy=0.6` and `target_danceability=0.8`. All target values will be weighed equally in ranking results.\n';
            maximum: 1;
            minimum: 0;
            title: 'Target Energy';
            type: 'number';
          };
        },
        {
          in: 'query';
          name: 'min_instrumentalness';
          required: false;
          schema: {
            description: 'For each tunable track attribute, a hard floor on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `min_tempo=140` would restrict results to only those tracks with a tempo of greater than 140 beats per minute.\n';
            maximum: 1;
            minimum: 0;
            title: 'Min. Instrumentalness';
            type: 'number';
          };
        },
        {
          in: 'query';
          name: 'max_instrumentalness';
          required: false;
          schema: {
            description: 'For each tunable track attribute, a hard ceiling on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `max_instrumentalness=0.35` would filter out most tracks that are likely to be instrumental.\n';
            maximum: 1;
            minimum: 0;
            title: 'Max. Instrumentalness';
            type: 'number';
          };
        },
        {
          in: 'query';
          name: 'target_instrumentalness';
          required: false;
          schema: {
            description: 'For each of the tunable track attributes (below) a target value may be provided. Tracks with the attribute values nearest to the target values will be preferred. For example, you might request `target_energy=0.6` and `target_danceability=0.8`. All target values will be weighed equally in ranking results.\n';
            maximum: 1;
            minimum: 0;
            title: 'Target Instrumentalness';
            type: 'number';
          };
        },
        {
          in: 'query';
          name: 'min_key';
          required: false;
          schema: {
            description: 'For each tunable track attribute, a hard floor on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `min_tempo=140` would restrict results to only those tracks with a tempo of greater than 140 beats per minute.\n';
            maximum: 11;
            minimum: 0;
            title: 'Min. Key';
            type: 'integer';
          };
        },
        {
          in: 'query';
          name: 'max_key';
          required: false;
          schema: {
            description: 'For each tunable track attribute, a hard ceiling on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `max_instrumentalness=0.35` would filter out most tracks that are likely to be instrumental.\n';
            maximum: 11;
            minimum: 0;
            title: 'Max. Key';
            type: 'integer';
          };
        },
        {
          in: 'query';
          name: 'target_key';
          required: false;
          schema: {
            description: 'For each of the tunable track attributes (below) a target value may be provided. Tracks with the attribute values nearest to the target values will be preferred. For example, you might request `target_energy=0.6` and `target_danceability=0.8`. All target values will be weighed equally in ranking results.\n';
            maximum: 11;
            minimum: 0;
            title: 'Target Key';
            type: 'integer';
          };
        },
        {
          in: 'query';
          name: 'min_liveness';
          required: false;
          schema: {
            description: 'For each tunable track attribute, a hard floor on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `min_tempo=140` would restrict results to only those tracks with a tempo of greater than 140 beats per minute.\n';
            maximum: 1;
            minimum: 0;
            title: 'Min. Liveness';
            type: 'number';
          };
        },
        {
          in: 'query';
          name: 'max_liveness';
          required: false;
          schema: {
            description: 'For each tunable track attribute, a hard ceiling on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `max_instrumentalness=0.35` would filter out most tracks that are likely to be instrumental.\n';
            maximum: 1;
            minimum: 0;
            title: 'Max. Liveness';
            type: 'number';
          };
        },
        {
          in: 'query';
          name: 'target_liveness';
          required: false;
          schema: {
            description: 'For each of the tunable track attributes (below) a target value may be provided. Tracks with the attribute values nearest to the target values will be preferred. For example, you might request `target_energy=0.6` and `target_danceability=0.8`. All target values will be weighed equally in ranking results.\n';
            maximum: 1;
            minimum: 0;
            title: 'Target Liveness';
            type: 'number';
          };
        },
        {
          in: 'query';
          name: 'min_loudness';
          required: false;
          schema: {
            description: 'For each tunable track attribute, a hard floor on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `min_tempo=140` would restrict results to only those tracks with a tempo of greater than 140 beats per minute.\n';
            title: 'Min. Loudness';
            type: 'number';
          };
        },
        {
          in: 'query';
          name: 'max_loudness';
          required: false;
          schema: {
            description: 'For each tunable track attribute, a hard ceiling on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `max_instrumentalness=0.35` would filter out most tracks that are likely to be instrumental.\n';
            title: 'Max. Loudness';
            type: 'number';
          };
        },
        {
          in: 'query';
          name: 'target_loudness';
          required: false;
          schema: {
            description: 'For each of the tunable track attributes (below) a target value may be provided. Tracks with the attribute values nearest to the target values will be preferred. For example, you might request `target_energy=0.6` and `target_danceability=0.8`. All target values will be weighed equally in ranking results.\n';
            title: 'Target Loudness';
            type: 'number';
          };
        },
        {
          in: 'query';
          name: 'min_mode';
          required: false;
          schema: {
            description: 'For each tunable track attribute, a hard floor on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `min_tempo=140` would restrict results to only those tracks with a tempo of greater than 140 beats per minute.\n';
            maximum: 1;
            minimum: 0;
            title: 'Min. Mode';
            type: 'integer';
          };
        },
        {
          in: 'query';
          name: 'max_mode';
          required: false;
          schema: {
            description: 'For each tunable track attribute, a hard ceiling on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `max_instrumentalness=0.35` would filter out most tracks that are likely to be instrumental.\n';
            maximum: 1;
            minimum: 0;
            title: 'Max. Mode';
            type: 'integer';
          };
        },
        {
          in: 'query';
          name: 'target_mode';
          required: false;
          schema: {
            description: 'For each of the tunable track attributes (below) a target value may be provided. Tracks with the attribute values nearest to the target values will be preferred. For example, you might request `target_energy=0.6` and `target_danceability=0.8`. All target values will be weighed equally in ranking results.\n';
            maximum: 1;
            minimum: 0;
            title: 'Target Mode';
            type: 'integer';
          };
        },
        {
          in: 'query';
          name: 'min_popularity';
          required: false;
          schema: {
            description: 'For each tunable track attribute, a hard floor on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `min_tempo=140` would restrict results to only those tracks with a tempo of greater than 140 beats per minute.\n';
            maximum: 100;
            minimum: 0;
            title: 'Min. Popularity';
            type: 'integer';
          };
        },
        {
          in: 'query';
          name: 'max_popularity';
          required: false;
          schema: {
            description: 'For each tunable track attribute, a hard ceiling on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `max_instrumentalness=0.35` would filter out most tracks that are likely to be instrumental.\n';
            maximum: 100;
            minimum: 0;
            title: 'Max. Popularity';
            type: 'integer';
          };
        },
        {
          in: 'query';
          name: 'target_popularity';
          required: false;
          schema: {
            description: 'For each of the tunable track attributes (below) a target value may be provided. Tracks with the attribute values nearest to the target values will be preferred. For example, you might request `target_energy=0.6` and `target_danceability=0.8`. All target values will be weighed equally in ranking results.\n';
            maximum: 100;
            minimum: 0;
            title: 'Target Popularity';
            type: 'integer';
          };
        },
        {
          in: 'query';
          name: 'min_speechiness';
          required: false;
          schema: {
            description: 'For each tunable track attribute, a hard floor on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `min_tempo=140` would restrict results to only those tracks with a tempo of greater than 140 beats per minute.\n';
            maximum: 1;
            minimum: 0;
            title: 'Min. Speechiness';
            type: 'number';
          };
        },
        {
          in: 'query';
          name: 'max_speechiness';
          required: false;
          schema: {
            description: 'For each tunable track attribute, a hard ceiling on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `max_instrumentalness=0.35` would filter out most tracks that are likely to be instrumental.\n';
            maximum: 1;
            minimum: 0;
            title: 'Max. Speechiness';
            type: 'number';
          };
        },
        {
          in: 'query';
          name: 'target_speechiness';
          required: false;
          schema: {
            description: 'For each of the tunable track attributes (below) a target value may be provided. Tracks with the attribute values nearest to the target values will be preferred. For example, you might request `target_energy=0.6` and `target_danceability=0.8`. All target values will be weighed equally in ranking results.\n';
            maximum: 1;
            minimum: 0;
            title: 'Target Speechiness';
            type: 'number';
          };
        },
        {
          in: 'query';
          name: 'min_tempo';
          required: false;
          schema: {
            description: 'For each tunable track attribute, a hard floor on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `min_tempo=140` would restrict results to only those tracks with a tempo of greater than 140 beats per minute.\n';
            title: 'Min. Tempo';
            type: 'number';
          };
        },
        {
          in: 'query';
          name: 'max_tempo';
          required: false;
          schema: {
            description: 'For each tunable track attribute, a hard ceiling on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `max_instrumentalness=0.35` would filter out most tracks that are likely to be instrumental.\n';
            title: 'Max. Tempo';
            type: 'number';
          };
        },
        {
          in: 'query';
          name: 'target_tempo';
          required: false;
          schema: {
            description: 'Target tempo (BPM)';
            title: 'Target Tempo';
            type: 'number';
          };
        },
        {
          in: 'query';
          name: 'min_time_signature';
          required: false;
          schema: {
            description: 'For each tunable track attribute, a hard floor on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `min_tempo=140` would restrict results to only those tracks with a tempo of greater than 140 beats per minute.\n';
            maximum: 11;
            title: 'Min. Time Signature';
            type: 'integer';
          };
        },
        {
          in: 'query';
          name: 'max_time_signature';
          required: false;
          schema: {
            description: 'For each tunable track attribute, a hard ceiling on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `max_instrumentalness=0.35` would filter out most tracks that are likely to be instrumental.\n';
            title: 'Max. Time Signature';
            type: 'integer';
          };
        },
        {
          in: 'query';
          name: 'target_time_signature';
          required: false;
          schema: {
            description: 'For each of the tunable track attributes (below) a target value may be provided. Tracks with the attribute values nearest to the target values will be preferred. For example, you might request `target_energy=0.6` and `target_danceability=0.8`. All target values will be weighed equally in ranking results.\n';
            title: 'Target Time Signature';
            type: 'integer';
          };
        },
        {
          in: 'query';
          name: 'min_valence';
          required: false;
          schema: {
            description: 'For each tunable track attribute, a hard floor on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `min_tempo=140` would restrict results to only those tracks with a tempo of greater than 140 beats per minute.\n';
            maximum: 1;
            minimum: 0;
            title: 'Min. Valence';
            type: 'number';
          };
        },
        {
          in: 'query';
          name: 'max_valence';
          required: false;
          schema: {
            description: 'For each tunable track attribute, a hard ceiling on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `max_instrumentalness=0.35` would filter out most tracks that are likely to be instrumental.\n';
            maximum: 1;
            minimum: 0;
            title: 'Max. Valence';
            type: 'number';
          };
        },
        {
          in: 'query';
          name: 'target_valence';
          required: false;
          schema: {
            description: 'For each of the tunable track attributes (below) a target value may be provided. Tracks with the attribute values nearest to the target values will be preferred. For example, you might request `target_energy=0.6` and `target_danceability=0.8`. All target values will be weighed equally in ranking results.\n';
            maximum: 1;
            minimum: 0;
            title: 'Target Valence';
            type: 'number';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/OneRecommendations';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: [];
        },
      ];
      summary: 'Get Recommendations\n';
      tags: ['Tracks'];
      'x-spotify-docs-console-url': '/console/get-recommendations/?seed_artists=4NHQUGzhtTLFvgF5SZesLK&amp;seed_tracks=0c6xIDDpzE81m2q797ordA&amp;min_energy=0.4&amp;min_popularity=50&amp;market=US';
      'x-spotify-docs-endpoint-name': 'Get Recommendations';
    };
    'x-spotify-docs-category': 'Browse';
    'x-spotify-docs-display-name': 'recommendations';
  };
  '/recommendations/available-genre-seeds': {
    get: {
      description: 'Retrieve a list of available genres seed parameter values for [recommendations](/documentation/web-api/reference/get-recommendations).\n';
      operationId: 'get-recommendation-genres';
      responses: {
        '200': {
          $ref: '#/components/responses/ManyGenres';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: [];
        },
      ];
      summary: 'Get Available Genre Seeds\n';
      tags: ['Genres'];
      'x-spotify-docs-console-url': '/console/get-available-genre-seeds/';
      'x-spotify-docs-endpoint-name': 'Get Recommendation Genres';
    };
    'x-spotify-docs-category': 'Browse';
    'x-spotify-docs-display-name': 'available-genre-seeds';
  };
  '/search': {
    get: {
      description: 'Get Spotify catalog information about albums, artists, playlists, tracks, shows, episodes or audiobooks\nthat match a keyword string.<br />\n**Note: Audiobooks are only available for the US, UK, Ireland, New Zealand and Australia markets.**\n';
      operationId: 'search';
      parameters: [
        {
          in: 'query';
          name: 'q';
          required: true;
          schema: {
            description: 'Your search query.\n\nYou can narrow down your search using field filters. The available filters are `album`, `artist`, `track`, `year`, `upc`, `tag:hipster`, `tag:new`, `isrc`, and `genre`. Each field filter only applies to certain result types.\n\nThe `artist` and `year` filters can be used while searching albums, artists and tracks. You can filter on a single `year` or a range (e.g. 1955-1960).<br />\nThe `album` filter can be used while searching albums and tracks.<br />\nThe `genre` filter can be used while searching artists and tracks.<br />\nThe `isrc` and `track` filters can be used while searching tracks.<br />\nThe `upc`, `tag:new` and `tag:hipster` filters can only be used while searching albums. The `tag:new` filter will return albums released in the past two weeks and `tag:hipster` can be used to return only albums with the lowest 10% popularity.<br />\n';
            example: 'remaster%20track:Doxy%20artist:Miles%20Davis';
            title: 'Query';
            type: 'string';
          };
        },
        {
          explode: false;
          in: 'query';
          name: 'type';
          required: true;
          schema: {
            description: 'A comma-separated list of item types to search across. Search results include hits\nfrom all the specified item types. For example: `q=abacab&type=album,track` returns\nboth albums and tracks matching "abacab".\n';
            items: {
              enum: ['album', 'artist', 'playlist', 'track', 'show', 'episode', 'audiobook'];
              type: 'string';
            };
            title: 'Item type';
            type: 'array';
          };
        },
        {
          $ref: '#/components/parameters/QueryMarket';
        },
        {
          in: 'query';
          name: 'limit';
          required: false;
          schema: {
            default: 20;
            description: 'The maximum number of results to return in each item type.\n';
            example: 10;
            maximum: 50;
            minimum: 0;
            title: 'Limit';
            type: 'integer';
          };
        },
        {
          in: 'query';
          name: 'offset';
          required: false;
          schema: {
            default: 0;
            description: 'The index of the first result to return. Use\nwith limit to get the next page of search results.\n';
            example: 5;
            maximum: 1000;
            minimum: 0;
            title: 'Offset';
            type: 'integer';
          };
        },
        {
          in: 'query';
          name: 'include_external';
          required: false;
          schema: {
            description: 'If `include_external=audio` is specified it signals that the client can play externally hosted audio content, and marks\nthe content as playable in the response. By default externally hosted audio content is marked as unplayable in the response.\n';
            enum: ['audio'];
            title: 'Include External';
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/SearchItems';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: [];
        },
      ];
      summary: 'Search for Item\n';
      tags: ['Search'];
      'x-spotify-docs-console-url': '/console/get-search-item/?q=tania+bowra&amp;type=artist';
      'x-spotify-docs-endpoint-name': 'Search for an Item';
    };
    'x-spotify-docs-category': 'Search';
    'x-spotify-docs-display-name': 'search-item';
  };
  '/shows': {
    get: {
      description: 'Get Spotify catalog information for several shows based on their Spotify IDs.\n';
      operationId: 'get-multiple-shows';
      parameters: [
        {
          $ref: '#/components/parameters/QueryMarket';
        },
        {
          $ref: '#/components/parameters/QueryShowIds';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/ManySimplifiedShows';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: [];
        },
      ];
      summary: 'Get Several Shows\n';
      tags: ['Shows'];
      'x-spotify-docs-console-url': '/console/get-several-shows/?ids=5CfCWKI5pZ28U0uOzXkDHe,5as3aKmN2k11yfDDDSrvaZ';
      'x-spotify-docs-endpoint-name': 'Get Multiple Shows';
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/metadataPolicyList';
      };
    };
    'x-spotify-docs-category': 'Shows';
    'x-spotify-docs-display-name': 'several-shows';
  };
  '/shows/{id}': {
    get: {
      description: 'Get Spotify catalog information for a single show identified by its\nunique Spotify ID.\n';
      operationId: 'get-a-show';
      parameters: [
        {
          $ref: '#/components/parameters/QueryMarket';
        },
        {
          $ref: '#/components/parameters/PathShowId';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/OneShow';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['user-read-playback-position'];
        },
      ];
      summary: 'Get Show\n';
      tags: ['Shows'];
      'x-spotify-docs-console-url': '/console/get-show/?id=38bS44xjbVVZ3No3ByF1dJ';
      'x-spotify-docs-endpoint-name': 'Get a Show';
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/metadataPolicyList';
      };
    };
    'x-spotify-docs-category': 'Shows';
    'x-spotify-docs-display-name': 'show';
  };
  '/shows/{id}/episodes': {
    get: {
      description: 'Get Spotify catalog information about an show’s episodes. Optional parameters can be used to limit the number of episodes returned.\n';
      operationId: 'get-a-shows-episodes';
      parameters: [
        {
          $ref: '#/components/parameters/PathShowId';
        },
        {
          $ref: '#/components/parameters/QueryMarket';
        },
        {
          $ref: '#/components/parameters/QueryLimit';
        },
        {
          $ref: '#/components/parameters/QueryOffset';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/PagingSimplifiedEpisodeObject';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['user-read-playback-position'];
        },
      ];
      summary: 'Get Show Episodes\n';
      tags: ['Shows', 'Episodes'];
      'x-spotify-docs-console-url': '/console/get-show-episodes/';
      'x-spotify-docs-endpoint-name': "Get a Show's Episodes";
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/metadataPolicyList';
      };
    };
    'x-spotify-docs-category': 'Shows';
    'x-spotify-docs-display-name': 'show-episodes';
  };
  '/tracks': {
    get: {
      description: 'Get Spotify catalog information for multiple tracks based on their Spotify IDs.\n';
      operationId: 'get-several-tracks';
      parameters: [
        {
          $ref: '#/components/parameters/QueryMarket';
        },
        {
          $ref: '#/components/parameters/QueryTrackIds';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/ManyTracks';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: [];
        },
      ];
      summary: 'Get Several Tracks\n';
      tags: ['Tracks'];
      'x-spotify-docs-console-url': '/console/get-several-tracks/?ids=3n3Ppam7vgaVa1iaRUc9Lp,3twNvmDtFQtAd5gMKedhLD';
      'x-spotify-docs-endpoint-name': 'Get Several Tracks';
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/metadataPolicyList';
      };
    };
    'x-spotify-docs-category': 'Tracks';
    'x-spotify-docs-display-name': 'several-tracks';
  };
  '/tracks/{id}': {
    get: {
      description: 'Get Spotify catalog information for a single track identified by its\nunique Spotify ID.\n';
      operationId: 'get-track';
      parameters: [
        {
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            description: 'The [Spotify ID](/documentation/web-api/concepts/spotify-uris-ids)\nfor the track.\n';
            example: '11dFghVXANMlKmJXsNCbNl';
            title: 'Spotify Track ID';
            type: 'string';
          };
        },
        {
          $ref: '#/components/parameters/QueryMarket';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/OneTrack';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: [];
        },
      ];
      summary: 'Get Track\n';
      tags: ['Tracks'];
      'x-spotify-docs-console-url': '/console/get-track/?id=3n3Ppam7vgaVa1iaRUc9Lp';
      'x-spotify-docs-endpoint-name': 'Get a Track';
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/metadataPolicyList';
      };
    };
    'x-spotify-docs-category': 'Tracks';
    'x-spotify-docs-display-name': 'track';
  };
  '/users/{user_id}': {
    get: {
      description: 'Get public profile information about a Spotify user.\n';
      operationId: 'get-users-profile';
      parameters: [
        {
          $ref: '#/components/parameters/PathUserId';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/OnePublicUser';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: [];
        },
      ];
      summary: "Get User's Profile\n";
      tags: ['Users'];
      'x-spotify-docs-console-url': '/console/get-users-profile/?user_id=wizzler';
      'x-spotify-docs-endpoint-name': "Get a User's Profile";
    };
    'x-spotify-docs-category': 'Users Profile';
    'x-spotify-docs-display-name': 'users-profile';
  };
  '/users/{user_id}/playlists': {
    get: {
      description: 'Get a list of the playlists owned or followed by a Spotify user.\n';
      operationId: 'get-list-users-playlists';
      parameters: [
        {
          $ref: '#/components/parameters/PathUserId';
        },
        {
          $ref: '#/components/parameters/QueryLimit';
        },
        {
          in: 'query';
          name: 'offset';
          required: false;
          schema: {
            default: 0;
            description: 'The index of the first playlist to return. Default:\n0 (the first object). Maximum offset: 100.000\\. Use with `limit` to get the\nnext set of playlists.\n';
            example: 5;
            title: 'Offset';
            type: 'integer';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/PagedPlaylists';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['playlist-read-private', 'playlist-read-collaborative'];
        },
      ];
      summary: "Get User's Playlists\n";
      tags: ['Playlists', 'Users'];
      'x-spotify-docs-console-url': '/console/get-playlists/?user_id=wizzler';
      'x-spotify-docs-endpoint-name': "Get a List of a User's Playlists";
    };
    post: {
      description: 'Create a playlist for a Spotify user. (The playlist will be empty until\nyou [add tracks](/documentation/web-api/reference/add-tracks-to-playlist).)\n';
      operationId: 'create-playlist';
      parameters: [
        {
          $ref: '#/components/parameters/PathUserId';
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              additionalProperties: true;
              example: {
                description: 'New playlist description';
                name: 'New Playlist';
                public: false;
              };
              properties: {
                collaborative: {
                  description: 'Defaults to `false`. If `true` the playlist will be collaborative. _**Note**: to create a collaborative playlist you must also set `public` to `false`. To create collaborative playlists you must have granted `playlist-modify-private` and `playlist-modify-public` [scopes](/documentation/web-api/concepts/scopes/#list-of-scopes)._\n';
                  type: 'boolean';
                };
                description: {
                  description: 'value for playlist description as displayed in Spotify Clients and in the Web API.\n';
                  type: 'string';
                };
                name: {
                  description: 'The name for the new playlist, for example `"Your Coolest Playlist"`. This name does not need to be unique; a user may have several playlists with the same name.\n';
                  type: 'string';
                };
                public: {
                  description: 'Defaults to `true`. If `true` the playlist will be public, if `false` it will be private. To be able to create private playlists, the user must have granted the `playlist-modify-private` [scope](/documentation/web-api/concepts/scopes/#list-of-scopes)\n';
                  type: 'boolean';
                };
              };
              required: ['name'];
              type: 'object';
            };
          };
        };
      };
      responses: {
        '201': {
          $ref: '#/components/responses/OnePlaylist';
        };
        '401': {
          $ref: '#/components/responses/Unauthorized';
        };
        '403': {
          $ref: '#/components/responses/Forbidden';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequests';
        };
      };
      security: [
        {
          oauth_2_0: ['playlist-modify-public', 'playlist-modify-private'];
        },
      ];
      summary: 'Create Playlist\n';
      tags: ['Playlists', 'Library'];
      'x-spotify-docs-console-url': '/console/post-playlists/';
      'x-spotify-docs-endpoint-name': 'Create a Playlist';
    };
    'x-spotify-docs-category': 'Playlists';
    'x-spotify-docs-display-name': 'playlists';
  };
};
export const paths = {
  '/albums': {
    get: {
      description: 'Get Spotify catalog information for multiple albums identified by their Spotify IDs.\n',
      operationId: 'get-multiple-albums',
      parameters: [
        {
          $ref: '#/components/parameters/QueryAlbumIds',
        },
        {
          $ref: '#/components/parameters/QueryMarket',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/ManyAlbums',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: [],
        },
      ],
      summary: 'Get Several Albums\n',
      tags: ['Albums'],
      'x-spotify-docs-console-url': '/console/get-several-albums/',
      'x-spotify-docs-endpoint-name': 'Get Multiple Albums',
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/metadataPolicyList',
      },
    },
    'x-spotify-docs-category': 'Albums',
    'x-spotify-docs-display-name': 'several-albums',
  },
  '/albums/{id}': {
    get: {
      description: 'Get Spotify catalog information for a single album.\n',
      operationId: 'get-an-album',
      parameters: [
        {
          $ref: '#/components/parameters/PathAlbumId',
        },
        {
          $ref: '#/components/parameters/QueryMarket',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/OneAlbum',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: [],
        },
      ],
      summary: 'Get Album\n',
      tags: ['Albums'],
      'x-spotify-docs-console-url': '/console/get-album/?id=0sNOF9WDwhWunNAHPD3Baj',
      'x-spotify-docs-endpoint-name': 'Get an Album',
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/metadataPolicyList',
      },
    },
    'x-spotify-docs-category': 'Albums',
    'x-spotify-docs-display-name': 'album',
  },
  '/albums/{id}/tracks': {
    get: {
      description:
        'Get Spotify catalog information about an album’s tracks.\nOptional parameters can be used to limit the number of tracks returned.\n',
      operationId: 'get-an-albums-tracks',
      parameters: [
        {
          $ref: '#/components/parameters/PathAlbumId',
        },
        {
          $ref: '#/components/parameters/QueryMarket',
        },
        {
          $ref: '#/components/parameters/QueryLimit',
        },
        {
          $ref: '#/components/parameters/QueryOffset',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/PagingSimplifiedTrackObject',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: [],
        },
      ],
      summary: 'Get Album Tracks\n',
      tags: ['Albums', 'Tracks'],
      'x-spotify-docs-console-url': '/console/get-album-tracks/',
      'x-spotify-docs-endpoint-name': "Get an Album's Tracks",
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/metadataPolicyList',
      },
    },
    'x-spotify-docs-category': 'Albums',
    'x-spotify-docs-display-name': 'album-tracks',
  },
  '/artists': {
    get: {
      description: 'Get Spotify catalog information for several artists based on their Spotify IDs.\n',
      operationId: 'get-multiple-artists',
      parameters: [
        {
          in: 'query',
          name: 'ids',
          required: true,
          schema: {
            description:
              'A comma-separated list of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids) for the artists. Maximum: 50 IDs.\n',
            example: '2CIMQHirSU0MQqyYHq0eOx,57dN52uHvrHOxijzpIgu3E,1vCWHaC5f2uS3yhpwWbIA6',
            title: 'Spotify Artist IDs',
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/ManyArtists',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: [],
        },
      ],
      summary: 'Get Several Artists\n',
      tags: ['Artists'],
      'x-spotify-docs-console-url': '/console/get-several-artists/?ids=0oSGxfWSnnOXhD2fKuz2Gy,3dBVyJ7JuOMt4GE9607Qin',
      'x-spotify-docs-endpoint-name': 'Get Multiple Artists',
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/metadataPolicyList',
      },
    },
    'x-spotify-docs-category': 'Artists',
    'x-spotify-docs-display-name': 'several-artists',
  },
  '/artists/{id}': {
    get: {
      description: 'Get Spotify catalog information for a single artist identified by their unique Spotify ID.\n',
      operationId: 'get-an-artist',
      parameters: [
        {
          $ref: '#/components/parameters/PathArtistId',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/OneArtist',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: [],
        },
      ],
      summary: 'Get Artist\n',
      tags: ['Artists'],
      'x-spotify-docs-console-url': '/console/get-artist/?id=0OdUWJ0sBjDrqHygGUXeCF',
      'x-spotify-docs-endpoint-name': 'Get an Artist',
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/metadataPolicyList',
      },
    },
    'x-spotify-docs-category': 'Artists',
    'x-spotify-docs-display-name': 'artist',
  },
  '/artists/{id}/albums': {
    get: {
      description: "Get Spotify catalog information about an artist's albums.\n",
      operationId: 'get-an-artists-albums',
      parameters: [
        {
          $ref: '#/components/parameters/PathArtistId',
        },
        {
          $ref: '#/components/parameters/QueryIncludeGroups',
        },
        {
          $ref: '#/components/parameters/QueryMarket',
        },
        {
          $ref: '#/components/parameters/QueryLimit',
        },
        {
          $ref: '#/components/parameters/QueryOffset',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/PagingSimplifiedAlbumObject',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: [],
        },
      ],
      summary: "Get Artist's Albums\n",
      tags: ['Artists', 'Albums'],
      'x-spotify-docs-console-url':
        '/console/get-artist-albums/?album_type=single&amp;limit=2&amp;market=ES&amp;id=1vCWHaC5f2uS3yhpwWbIA6',
      'x-spotify-docs-endpoint-name': "Get an Artist's Albums",
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/metadataPolicyList',
      },
    },
    'x-spotify-docs-category': 'Artists',
    'x-spotify-docs-display-name': 'artist-albums',
  },
  '/artists/{id}/related-artists': {
    get: {
      description:
        "Get Spotify catalog information about artists similar to a given artist. Similarity is based on analysis of the Spotify community's [listening history](http://news.spotify.com/se/2010/02/03/related-artists/).\n",
      operationId: 'get-an-artists-related-artists',
      parameters: [
        {
          $ref: '#/components/parameters/PathArtistId',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/ManyArtists',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: [],
        },
      ],
      summary: "Get Artist's Related Artists\n",
      tags: ['Artists'],
      'x-spotify-docs-console-url': '/console/get-artist-related-artists/?id=43ZHCT0cAZBISjO8DG9PnE',
      'x-spotify-docs-endpoint-name': "Get an Artist's Related Artists",
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/metadataPolicyList',
      },
    },
    'x-spotify-docs-category': 'Artists',
    'x-spotify-docs-display-name': 'artist-related-artists',
  },
  '/artists/{id}/top-tracks': {
    get: {
      description: "Get Spotify catalog information about an artist's top tracks by country.\n",
      operationId: 'get-an-artists-top-tracks',
      parameters: [
        {
          $ref: '#/components/parameters/PathArtistId',
        },
        {
          $ref: '#/components/parameters/QueryMarket',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/ManyTracks',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: [],
        },
      ],
      summary: "Get Artist's Top Tracks\n",
      tags: ['Artists', 'Tracks'],
      'x-spotify-docs-console-url': '/console/get-artist-top-tracks/?country=SE&amp;id=43ZHCT0cAZBISjO8DG9PnE',
      'x-spotify-docs-endpoint-name': "Get an Artist's Top Tracks",
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/metadataPolicyList',
      },
    },
    'x-spotify-docs-category': 'Artists',
    'x-spotify-docs-display-name': 'artist-top-tracks',
  },
  '/audio-analysis/{id}': {
    get: {
      description:
        'Get a low-level audio analysis for a track in the Spotify catalog. The audio analysis describes the track’s structure and musical content, including rhythm, pitch, and timbre.\n',
      operationId: 'get-audio-analysis',
      parameters: [
        {
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            description: 'The [Spotify ID](/documentation/web-api/concepts/spotify-uris-ids)\nfor the track.\n',
            example: '11dFghVXANMlKmJXsNCbNl',
            title: 'Spotify Track ID',
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/OneAudioAnalysis',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: [],
        },
      ],
      summary: "Get Track's Audio Analysis\n",
      tags: ['Tracks'],
      'x-spotify-docs-console-url': '/console/get-audio-analysis-track/?id=06AKEBrKUckW0KREUWRnvT',
      'x-spotify-docs-endpoint-name': 'Get Audio Analysis for a Track',
    },
    'x-spotify-docs-category': 'Tracks',
    'x-spotify-docs-display-name': 'audio-analysis-track',
  },
  '/audio-features': {
    get: {
      description: 'Get audio features for multiple tracks based on their Spotify IDs.\n',
      operationId: 'get-several-audio-features',
      parameters: [
        {
          in: 'query',
          name: 'ids',
          required: true,
          schema: {
            description:
              'A comma-separated list of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids)\nfor the tracks. Maximum: 100 IDs.\n',
            example: '7ouMYWpwJ422jRcDASZB7P,4VqPOruhp5EdPBeR92t6lQ,2takcwOaAZWiXQijPHIx7B',
            title: 'Spotify Track IDs',
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/ManyAudioFeatures',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: [],
        },
      ],
      summary: "Get Tracks' Audio Features\n",
      tags: ['Tracks'],
      'x-spotify-docs-console-url':
        '/console/get-audio-features-several-tracks/?ids=4JpKVNYnVcJ8tuMKjAj50A,2NRANZE9UCmPAS5XVbXL40,24JygzOLM0EmRQeGtFcIcG',
      'x-spotify-docs-endpoint-name': 'Get Audio Features for Several Tracks',
    },
    'x-spotify-docs-category': 'Tracks',
    'x-spotify-docs-display-name': 'audio-features-several-tracks',
  },
  '/audio-features/{id}': {
    get: {
      description: 'Get audio feature information for a single track identified by its unique\nSpotify ID.\n',
      operationId: 'get-audio-features',
      parameters: [
        {
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            description: 'The [Spotify ID](/documentation/web-api/concepts/spotify-uris-ids) for the track.\n',
            example: '11dFghVXANMlKmJXsNCbNl',
            title: 'Spotify Track ID',
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/OneAudioFeatures',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: [],
        },
      ],
      summary: "Get Track's Audio Features\n",
      tags: ['Tracks'],
      'x-spotify-docs-console-url': '/console/get-audio-features-track/?id=06AKEBrKUckW0KREUWRnvT',
      'x-spotify-docs-endpoint-name': 'Get Audio Features for a Track',
    },
    'x-spotify-docs-category': 'Tracks',
    'x-spotify-docs-display-name': 'audio-features-track',
  },
  '/audiobooks': {
    get: {
      description:
        'Get Spotify catalog information for several audiobooks identified by their Spotify IDs.<br />\n**Note: Audiobooks are only available for the US, UK, Ireland, New Zealand and Australia markets.**\n',
      operationId: 'get-multiple-audiobooks',
      parameters: [
        {
          $ref: '#/components/parameters/QueryAudiobookIds',
        },
        {
          $ref: '#/components/parameters/QueryMarket',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/ManyAudiobooks',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: [],
        },
      ],
      summary: 'Get Several Audiobooks\n',
      tags: ['Audiobooks'],
      'x-spotify-docs-console-url':
        '/console/get-several-audiobooks/?ids=5thw29eqjomhIDMY1XKsLk,2IEBhnu61ieYGFRPEJIO40',
      'x-spotify-docs-endpoint-name': 'Get Several Audiobooks',
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/metadataPolicyList',
      },
    },
    'x-spotify-docs-category': 'Audiobooks',
    'x-spotify-docs-display-name': 'several-audiobooks',
  },
  '/audiobooks/{id}': {
    get: {
      description:
        'Get Spotify catalog information for a single audiobook.<br />\n**Note: Audiobooks are only available for the US, UK, Ireland, New Zealand and Australia markets.**\n',
      operationId: 'get-an-audiobook',
      parameters: [
        {
          $ref: '#/components/parameters/PathAudiobookId',
        },
        {
          $ref: '#/components/parameters/QueryMarket',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/OneAudiobook',
        },
        '400': {
          $ref: '#/components/responses/BadRequest',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '404': {
          $ref: '#/components/responses/NotFound',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: [],
        },
      ],
      summary: 'Get an Audiobook\n',
      tags: ['Audiobooks'],
      'x-spotify-docs-console-url': '/console/get-audiobook/?id=5thw29eqjomhIDMY1XKsLk',
      'x-spotify-docs-endpoint-name': 'Get an Audiobook',
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/metadataPolicyList',
      },
    },
    'x-spotify-docs-category': 'Audiobooks',
    'x-spotify-docs-display-name': 'audiobook',
  },
  '/audiobooks/{id}/chapters': {
    get: {
      description:
        "Get Spotify catalog information about an audiobook's chapters.<br />\n**Note: Audiobooks are only available for the US, UK, Ireland, New Zealand and Australia markets.**\n",
      operationId: 'get-audiobook-chapters',
      parameters: [
        {
          $ref: '#/components/parameters/PathAudiobookId',
        },
        {
          $ref: '#/components/parameters/QueryMarket',
        },
        {
          $ref: '#/components/parameters/QueryLimit',
        },
        {
          $ref: '#/components/parameters/QueryOffset',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/PagingSimplifiedChapterObject',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: [],
        },
      ],
      summary: 'Get Audiobook Chapters\n',
      tags: ['Audiobooks', 'Chapters'],
      'x-spotify-docs-console-url': '/console/get-audiobook-chapters/?id=5thw29eqjomhIDMY1XKsLk',
      'x-spotify-docs-endpoint-name': "Get an Audiobook's Chapters",
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/metadataPolicyList',
      },
    },
    'x-spotify-docs-category': 'Audiobooks',
    'x-spotify-docs-display-name': 'audiobook-chapters',
  },
  '/browse/categories': {
    get: {
      description:
        'Get a list of categories used to tag items in Spotify (on, for example, the Spotify player’s “Browse” tab).\n',
      operationId: 'get-categories',
      parameters: [
        {
          in: 'query',
          name: 'country',
          required: false,
          schema: {
            description:
              'A country: an [ISO 3166-1 alpha-2 country code](http://en.wikipedia.org/wiki/ISO_3166-1_alpha-2). Provide this parameter if you want to narrow the list of returned categories to those relevant to a particular country. If omitted, the returned items will be globally relevant.\n',
            example: 'SE',
            title: 'Country',
            type: 'string',
          },
        },
        {
          in: 'query',
          name: 'locale',
          required: false,
          schema: {
            description:
              'The desired language, consisting of an [ISO 639-1](http://en.wikipedia.org/wiki/ISO_639-1) language code and an [ISO 3166-1 alpha-2 country code](http://en.wikipedia.org/wiki/ISO_3166-1_alpha-2), joined by an underscore. For example: `es_MX`, meaning "Spanish (Mexico)". Provide this parameter if you want the category metadata returned in a particular language. <br/>\n_**Note**: if `locale` is not supplied, or if the specified language is not available, all strings will be returned in the Spotify default language (American English). The `locale` parameter, combined with the `country` parameter, may give odd results if not carefully matched. For example `country=SE&locale=de_DE` will return a list of categories relevant to Sweden but as German language strings._\n',
            example: 'sv_SE',
            title: 'Locale',
            type: 'string',
          },
        },
        {
          $ref: '#/components/parameters/QueryLimit',
        },
        {
          $ref: '#/components/parameters/QueryOffset',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/PagedCategories',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: [],
        },
      ],
      summary: 'Get Several Browse Categories\n',
      tags: ['Categories'],
      'x-spotify-docs-console-url': '/console/get-browse-categories/',
      'x-spotify-docs-endpoint-name': 'Get All Categories',
    },
    'x-spotify-docs-category': 'Browse',
    'x-spotify-docs-display-name': 'browse-categories',
  },
  '/browse/categories/{category_id}': {
    get: {
      description:
        'Get a single category used to tag items in Spotify (on, for example, the Spotify player’s “Browse” tab).\n',
      operationId: 'get-a-category',
      parameters: [
        {
          in: 'path',
          name: 'category_id',
          required: true,
          schema: {
            description:
              'The [Spotify category ID](/documentation/web-api/concepts/spotify-uris-ids) for the category.\n',
            example: 'dinner',
            title: 'Category ID',
            type: 'string',
          },
        },
        {
          in: 'query',
          name: 'country',
          required: false,
          schema: {
            description:
              'A country: an [ISO 3166-1 alpha-2 country code](http://en.wikipedia.org/wiki/ISO_3166-1_alpha-2). Provide this parameter to ensure that the category exists for a particular country.\n',
            example: 'SE',
            title: 'Country',
            type: 'string',
          },
        },
        {
          in: 'query',
          name: 'locale',
          required: false,
          schema: {
            description:
              'The desired language, consisting of an [ISO 639-1](http://en.wikipedia.org/wiki/ISO_639-1) language code and an [ISO 3166-1 alpha-2 country code](http://en.wikipedia.org/wiki/ISO_3166-1_alpha-2), joined by an underscore. For example: `es_MX`, meaning &quot;Spanish (Mexico)&quot;. Provide this parameter if you want the category strings returned in a particular language.<br/> _**Note**: if `locale` is not supplied, or if the specified language is not available, the category strings returned will be in the Spotify default language (American English)._\n',
            example: 'sv_SE',
            title: 'Locale',
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/OneCategory',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: [],
        },
      ],
      summary: 'Get Single Browse Category\n',
      tags: ['Categories'],
      'x-spotify-docs-console-url': '/console/get-browse-category/',
      'x-spotify-docs-endpoint-name': 'Get a Category',
    },
    'x-spotify-docs-category': 'Browse',
    'x-spotify-docs-display-name': 'browse-category',
  },
  '/browse/categories/{category_id}/playlists': {
    get: {
      description: 'Get a list of Spotify playlists tagged with a particular category.\n',
      operationId: 'get-a-categories-playlists',
      parameters: [
        {
          in: 'path',
          name: 'category_id',
          required: true,
          schema: {
            description:
              'The [Spotify category ID](/documentation/web-api/concepts/spotify-uris-ids) for the category.\n',
            example: 'dinner',
            title: 'Category ID',
            type: 'string',
          },
        },
        {
          in: 'query',
          name: 'country',
          required: false,
          schema: {
            description:
              'A country: an [ISO 3166-1 alpha-2 country code](http://en.wikipedia.org/wiki/ISO_3166-1_alpha-2). Provide this parameter to ensure that the category exists for a particular country.\n',
            example: 'SE',
            title: 'Country',
            type: 'string',
          },
        },
        {
          $ref: '#/components/parameters/QueryLimit',
        },
        {
          $ref: '#/components/parameters/QueryOffset',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/PagedFeaturedPlaylists',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: [],
        },
      ],
      summary: "Get Category's Playlists\n",
      tags: ['Playlists', 'Categories'],
      'x-spotify-docs-console-url': '/console/get-category-playlists/?country=BR&amp;category_id=party&amp;limit=2',
      'x-spotify-docs-endpoint-name': "Get a Category's Playlists",
    },
    'x-spotify-docs-category': 'Browse',
    'x-spotify-docs-display-name': 'category-playlists',
  },
  '/browse/featured-playlists': {
    get: {
      description:
        "Get a list of Spotify featured playlists (shown, for example, on a Spotify player's 'Browse' tab).\n",
      operationId: 'get-featured-playlists',
      parameters: [
        {
          in: 'query',
          name: 'country',
          required: false,
          schema: {
            description:
              'A country: an [ISO 3166-1 alpha-2 country code](http://en.wikipedia.org/wiki/ISO_3166-1_alpha-2). Provide this parameter if you want the list of returned items to be relevant to a particular country. If omitted, the returned items will be relevant to all countries.\n',
            example: 'SE',
            title: 'Country',
            type: 'string',
          },
        },
        {
          in: 'query',
          name: 'locale',
          required: false,
          schema: {
            description:
              'The desired language, consisting of a lowercase [ISO 639-1 language code](http://en.wikipedia.org/wiki/ISO_639-1) and an uppercase [ISO 3166-1 alpha-2 country code](http://en.wikipedia.org/wiki/ISO_3166-1_alpha-2), joined by an underscore. For example: `es_MX`, meaning "Spanish (Mexico)". Provide this parameter if you want the results returned in a particular language (where available). <br/>\n_**Note**: if `locale` is not supplied, or if the specified language is not available, all strings will be returned in the Spotify default language (American English). The `locale` parameter, combined with the `country` parameter, may give odd results if not carefully matched. For example `country=SE&locale=de_DE` will return a list of categories relevant to Sweden but as German language strings._\n',
            example: 'sv_SE',
            title: 'Locale',
            type: 'string',
          },
        },
        {
          in: 'query',
          name: 'timestamp',
          required: false,
          schema: {
            description:
              'A timestamp in [ISO 8601 format](http://en.wikipedia.org/wiki/ISO_8601): `yyyy-MM-ddTHH:mm:ss`. Use this parameter to specify the user\'s local time to get results tailored for that specific date and time in the day. If not provided, the response defaults to the current UTC time. Example: "2014-10-23T09:00:00" for a user whose local time is 9AM. If there were no featured playlists (or there is no data) at the specified time, the response will revert to the current UTC time.\n',
            example: '2014-10-23T09:00:00',
            title: 'Timestamp',
            type: 'string',
          },
        },
        {
          $ref: '#/components/parameters/QueryLimit',
        },
        {
          $ref: '#/components/parameters/QueryOffset',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/PagedFeaturedPlaylists',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: [],
        },
      ],
      summary: 'Get Featured Playlists\n',
      tags: ['Playlists'],
      'x-spotify-docs-console-url': '/console/get-featured-playlists/?country=SE&amp;limit=2',
      'x-spotify-docs-endpoint-name': 'Get All Featured Playlists',
      'x-spotify-policy-list': [
        {
          $ref: '#/components/x-spotify-policy/MultipleIntegrations',
        },
      ],
    },
    'x-spotify-docs-category': 'Browse',
    'x-spotify-docs-display-name': 'featured-playlists',
  },
  '/browse/new-releases': {
    get: {
      description:
        'Get a list of new album releases featured in Spotify (shown, for example, on a Spotify player’s “Browse” tab).\n',
      operationId: 'get-new-releases',
      parameters: [
        {
          in: 'query',
          name: 'country',
          required: false,
          schema: {
            description:
              'A country: an [ISO 3166-1 alpha-2 country code](http://en.wikipedia.org/wiki/ISO_3166-1_alpha-2). Provide this parameter if you want the list of returned items to be relevant to a particular country. If omitted, the returned items will be relevant to all countries.\n',
            example: 'SE',
            title: 'Country',
            type: 'string',
          },
        },
        {
          $ref: '#/components/parameters/QueryLimit',
        },
        {
          $ref: '#/components/parameters/QueryOffset',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/PagedAlbums',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: [],
        },
      ],
      summary: 'Get New Releases\n',
      tags: ['Albums'],
      'x-spotify-docs-console-url': '/console/get-new-releases/?country=SE',
      'x-spotify-docs-endpoint-name': 'Get All New Releases',
      'x-spotify-policy-list': [
        {
          $ref: '#/components/x-spotify-policy/MultipleIntegrations',
        },
      ],
    },
    'x-spotify-docs-category': 'Browse',
    'x-spotify-docs-display-name': 'new-releases',
  },
  '/chapters': {
    get: {
      description:
        'Get Spotify catalog information for several chapters identified by their Spotify IDs.<br />\n**Note: Chapters are only available for the US, UK, Ireland, New Zealand and Australia markets.**\n',
      operationId: 'get-several-chapters',
      parameters: [
        {
          $ref: '#/components/parameters/QueryChapterIds',
        },
        {
          $ref: '#/components/parameters/QueryMarket',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/ManyChapters',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: [],
        },
      ],
      summary: 'Get Several Chapters\n',
      tags: ['Chapters'],
      'x-spotify-docs-console-url': '/console/get-several-chapters/?ids=2i47HuOBSV2XaJNy0NCZXM,2GUbORsUnP1qVVlLwd9DzP',
      'x-spotify-docs-endpoint-name': 'Get Several Chapters',
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/metadataPolicyList',
      },
    },
    'x-spotify-docs-category': 'Chapters',
    'x-spotify-docs-display-name': 'several-chapters',
  },
  '/chapters/{id}': {
    get: {
      description:
        'Get Spotify catalog information for a single chapter.<br />\n**Note: Chapters are only available for the US, UK, Ireland, New Zealand and Australia markets.**\n',
      operationId: 'get-a-chapter',
      parameters: [
        {
          $ref: '#/components/parameters/PathChapterId',
        },
        {
          $ref: '#/components/parameters/QueryMarket',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/OneChapter',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: [],
        },
      ],
      summary: 'Get a Chapter\n',
      tags: ['Chapters'],
      'x-spotify-docs-console-url': '/console/get-chapter/?id=2i47HuOBSV2XaJNy0NCZXM',
      'x-spotify-docs-endpoint-name': 'Get a Chapter',
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/metadataPolicyList',
      },
    },
    'x-spotify-docs-category': 'Chapters',
    'x-spotify-docs-display-name': 'chapters',
  },
  '/episodes': {
    get: {
      description: 'Get Spotify catalog information for several episodes based on their Spotify IDs.\n',
      operationId: 'get-multiple-episodes',
      parameters: [
        {
          in: 'query',
          name: 'ids',
          required: true,
          schema: {
            description:
              'A comma-separated list of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids) for the episodes. Maximum: 50 IDs.\n',
            example: '77o6BIVlYM3msb4MMIL1jH,0Q86acNRm6V9GYx55SXKwf',
            title: 'Ids',
            type: 'string',
          },
        },
        {
          $ref: '#/components/parameters/QueryMarket',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/ManyEpisodes',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['user-read-playback-position'],
        },
      ],
      summary: 'Get Several Episodes\n',
      tags: ['Episodes'],
      'x-spotify-docs-console-url': '/console/get-several-episodes/?ids=77o6BIVlYM3msb4MMIL1jH,0Q86acNRm6V9GYx55SXKwf',
      'x-spotify-docs-endpoint-name': 'Get Multiple Episodes',
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/metadataPolicyList',
      },
    },
    'x-spotify-docs-category': 'Episodes',
    'x-spotify-docs-display-name': 'several-episodes',
  },
  '/episodes/{id}': {
    get: {
      description: 'Get Spotify catalog information for a single episode identified by its\nunique Spotify ID.\n',
      operationId: 'get-an-episode',
      parameters: [
        {
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            description: 'The [Spotify ID](/documentation/web-api/concepts/spotify-uris-ids) for the episode.',
            example: '512ojhOuo1ktJprKbVcKyQ',
            title: 'Get an Episode',
            type: 'string',
          },
        },
        {
          $ref: '#/components/parameters/QueryMarket',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/OneEpisode',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['user-read-playback-position'],
        },
      ],
      summary: 'Get Episode\n',
      tags: ['Episodes'],
      'x-spotify-docs-console-url': '/console/get-episode/?id=512ojhOuo1ktJprKbVcKyQ',
      'x-spotify-docs-endpoint-name': 'Get an Episode',
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/metadataPolicyList',
      },
    },
    'x-spotify-docs-category': 'Episodes',
    'x-spotify-docs-display-name': 'episode',
  },
  '/markets': {
    get: {
      description: 'Get the list of markets where Spotify is available.\n',
      operationId: 'get-available-markets',
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                properties: {
                  markets: {
                    example: ['CA', 'BR', 'IT'],
                    items: {
                      type: 'string',
                    },
                    type: 'array',
                  },
                },
                type: 'object',
              },
            },
          },
          description: 'A markets object with an array of country codes',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: [],
        },
      ],
      summary: 'Get Available Markets\n',
      tags: ['Markets'],
      'x-spotify-docs-console-url': '/console/get-available-markets/',
      'x-spotify-docs-endpoint-name': 'Get Available Markets',
    },
    'x-spotify-docs-category': 'Markets',
    'x-spotify-docs-display-name': 'available-markets',
  },
  '/me': {
    get: {
      description:
        "Get detailed profile information about the current user (including the\ncurrent user's username).\n",
      operationId: 'get-current-users-profile',
      responses: {
        '200': {
          $ref: '#/components/responses/OnePrivateUser',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['user-read-private', 'user-read-email'],
        },
      ],
      summary: "Get Current User's Profile\n",
      tags: ['Users'],
      'x-spotify-docs-console-url': '/console/get-current-user/',
      'x-spotify-docs-endpoint-name': "Get Current User's Profile",
    },
    'x-spotify-docs-category': 'Users Profile',
    'x-spotify-docs-display-name': 'current-user',
  },
  '/me/albums': {
    delete: {
      description: "Remove one or more albums from the current user's 'Your Music' library.\n",
      operationId: 'remove-albums-user',
      parameters: [
        {
          $ref: '#/components/parameters/QueryAlbumIds',
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              additionalProperties: true,
              properties: {
                ids: {
                  description:
                    'A JSON array of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids). For example: `["4iV5W9uYEdYUVa79Axb7Rh", "1301WleyT98MSxVHPZCA6M"]`<br/>A maximum of 50 items can be specified in one request. _**Note**: if the `ids` parameter is present in the query string, any IDs listed here in the body will be ignored._\n',
                  items: {
                    type: 'string',
                  },
                  type: 'array',
                },
              },
              type: 'object',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Album(s) have been removed from the library',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['user-library-modify'],
        },
      ],
      summary: "Remove Users' Saved Albums\n",
      tags: ['Albums', 'Library'],
      'x-spotify-docs-console-url':
        '/console/delete-current-user-saved-albums/?ids=07bYtmE3bPsLB6ZbmmFi8d%2C48JYNjh7GMie6NjqYHMmtT%2C27cZdqrQiKt3IT00338dws',
      'x-spotify-docs-endpoint-name': 'Remove Albums for Current User',
    },
    get: {
      description: "Get a list of the albums saved in the current Spotify user's 'Your Music' library.\n",
      operationId: 'get-users-saved-albums',
      parameters: [
        {
          $ref: '#/components/parameters/QueryLimit',
        },
        {
          $ref: '#/components/parameters/QueryOffset',
        },
        {
          $ref: '#/components/parameters/QueryMarket',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/PagingSavedAlbumObject',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['user-library-read'],
        },
      ],
      summary: "Get User's Saved Albums\n",
      tags: ['Albums', 'Library'],
      'x-spotify-docs-console-url': '/console/get-current-user-saved-albums/?limit=1',
      'x-spotify-docs-endpoint-name': "Get User's Saved Albums",
    },
    put: {
      description: "Save one or more albums to the current user's 'Your Music' library.\n",
      operationId: 'save-albums-user',
      parameters: [
        {
          $ref: '#/components/parameters/QueryAlbumIds',
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              additionalProperties: true,
              properties: {
                ids: {
                  description:
                    'A JSON array of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids). For example: `["4iV5W9uYEdYUVa79Axb7Rh", "1301WleyT98MSxVHPZCA6M"]`<br/>A maximum of 50 items can be specified in one request. _**Note**: if the `ids` parameter is present in the query string, any IDs listed here in the body will be ignored._\n',
                  items: {
                    type: 'string',
                  },
                  type: 'array',
                },
              },
              type: 'object',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'The album is saved',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['user-library-modify'],
        },
      ],
      summary: 'Save Albums for Current User\n',
      tags: ['Albums', 'Library'],
      'x-spotify-docs-console-url':
        '/console/put-current-user-saved-albums/?ids=07bYtmE3bPsLB6ZbmmFi8d%2C48JYNjh7GMie6NjqYHMmtT%2C27cZdqrQiKt3IT00338dws',
      'x-spotify-docs-endpoint-name': 'Save Albums for Current User',
    },
    'x-spotify-docs-category': 'Library',
    'x-spotify-docs-display-name': 'current-user-saved-albums',
  },
  '/me/albums/contains': {
    get: {
      description: "Check if one or more albums is already saved in the current Spotify user's 'Your Music' library.\n",
      operationId: 'check-users-saved-albums',
      parameters: [
        {
          $ref: '#/components/parameters/QueryAlbumIds',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/ArrayOfBooleans',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['user-library-read'],
        },
      ],
      summary: "Check User's Saved Albums\n",
      tags: ['Albums', 'Library'],
      'x-spotify-docs-console-url':
        '/console/get-current-user-contains-saved-albums/?ids=0pJJgBzj26qnE1nSQUxaB0%2C5ZAKzV4ZIa5Gt7z29OYHv0',
      'x-spotify-docs-endpoint-name': "Check User's Saved Albums",
    },
    'x-spotify-docs-category': 'Library',
    'x-spotify-docs-display-name': 'current-user-contains-saved-albums',
  },
  '/me/audiobooks': {
    delete: {
      description: "Remove one or more audiobooks from the Spotify user's library.\n",
      operationId: 'remove-audiobooks-user',
      parameters: [
        {
          $ref: '#/components/parameters/QueryAudiobookIds',
        },
      ],
      responses: {
        '200': {
          description: 'Audiobook(s) have been removed from the library',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['user-library-modify'],
        },
      ],
      summary: "Remove User's Saved Audiobooks\n",
      tags: ['Audiobooks', 'Library'],
      'x-spotify-docs-console-url':
        '/console/delete-current-user-saved-audiobooks/?ids=07bYtmE3bPsLB6ZbmmFi8d%2C48JYNjh7GMie6NjqYHMmtT%2C27cZdqrQiKt3IT00338dws',
      'x-spotify-docs-endpoint-name': 'Remove Audiobooks for Current User',
    },
    get: {
      description: "Get a list of the audiobooks saved in the current Spotify user's 'Your Music' library.\n",
      operationId: 'get-users-saved-audiobooks',
      parameters: [
        {
          $ref: '#/components/parameters/QueryLimit',
        },
        {
          $ref: '#/components/parameters/QueryOffset',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/PagingSimplifiedAudiobookObject',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['user-library-read'],
        },
      ],
      summary: "Get User's Saved Audiobooks\n",
      tags: ['Audiobooks', 'Library'],
      'x-spotify-docs-console-url': '/console/get-current-user-saved-audiobooks/?limit=1',
      'x-spotify-docs-endpoint-name': "Get User's Saved Audiobooks",
    },
    put: {
      description: "Save one or more audiobooks to the current Spotify user's library.\n",
      operationId: 'save-audiobooks-user',
      parameters: [
        {
          $ref: '#/components/parameters/QueryAudiobookIds',
        },
      ],
      responses: {
        '200': {
          description: 'Audiobook(s) are saved to the library',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['user-library-modify'],
        },
      ],
      summary: 'Save Audiobooks for Current User\n',
      tags: ['Audiobooks', 'Library'],
      'x-spotify-docs-console-url':
        '/console/put-current-user-saved-audiobooks/?ids=07bYtmE3bPsLB6ZbmmFi8d%2C48JYNjh7GMie6NjqYHMmtT%2C27cZdqrQiKt3IT00338dws',
      'x-spotify-docs-endpoint-name': 'Save Audiobooks for Current User',
    },
    'x-spotify-docs-category': 'Library',
    'x-spotify-docs-display-name': 'current-user-saved-audiobooks',
  },
  '/me/audiobooks/contains': {
    get: {
      description: "Check if one or more audiobooks are already saved in the current Spotify user's library.\n",
      operationId: 'check-users-saved-audiobooks',
      parameters: [
        {
          $ref: '#/components/parameters/QueryAudiobookIds',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/ArrayOfBooleans',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['user-library-read'],
        },
      ],
      summary: "Check User's Saved Audiobooks\n",
      tags: ['Audiobooks', 'Library'],
      'x-spotify-docs-console-url':
        '/console/get-current-user-contains-saved-audiobooks/?ids=0pJJgBzj26qnE1nSQUxaB0%2C5ZAKzV4ZIa5Gt7z29OYHv0',
      'x-spotify-docs-endpoint-name': "Check User's Saved Audiobooks",
    },
    'x-spotify-docs-category': 'Library',
    'x-spotify-docs-display-name': 'current-user-contains-saved-audiobooks',
  },
  '/me/episodes': {
    delete: {
      description:
        "Remove one or more episodes from the current user's library.<br/>\nThis API endpoint is in __beta__ and could change without warning. Please share any feedback that you have, or issues that you discover, in our [developer community forum](https://community.spotify.com/t5/Spotify-for-Developers/bd-p/Spotify_Developer).\n",
      operationId: 'remove-episodes-user',
      parameters: [
        {
          $ref: '#/components/parameters/QueryTrackIds',
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              additionalProperties: true,
              properties: {
                ids: {
                  description:
                    'A JSON array of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids). <br/>A maximum of 50 items can be specified in one request. _**Note**: if the `ids` parameter is present in the query string, any IDs listed here in the body will be ignored._\n',
                  items: {
                    type: 'string',
                  },
                  type: 'array',
                },
              },
              type: 'object',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Episode removed',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['user-library-modify'],
        },
      ],
      summary: "Remove User's Saved Episodes\n",
      tags: ['Episodes', 'Library'],
      'x-spotify-docs-console-url':
        '/console/delete-current-user-saved-episodes/?ids=77o6BIVlYM3msb4MMIL1jH%2C0Q86acNRm6V9GYx55SXKwf',
      'x-spotify-docs-endpoint-name': "Remove User's Saved Episodes",
    },
    get: {
      description:
        "Get a list of the episodes saved in the current Spotify user's library.<br/>\nThis API endpoint is in __beta__ and could change without warning. Please share any feedback that you have, or issues that you discover, in our [developer community forum](https://community.spotify.com/t5/Spotify-for-Developers/bd-p/Spotify_Developer).\n",
      operationId: 'get-users-saved-episodes',
      parameters: [
        {
          $ref: '#/components/parameters/QueryMarket',
        },
        {
          $ref: '#/components/parameters/QueryLimit',
        },
        {
          $ref: '#/components/parameters/QueryOffset',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/PagingSavedEpisodeObject',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['user-library-read', 'user-read-playback-position'],
        },
      ],
      summary: "Get User's Saved Episodes\n",
      tags: ['Episodes', 'Library'],
      'x-spotify-docs-console-url': '/console/get-current-user-saved-episodes/',
      'x-spotify-docs-endpoint-name': "Get User's Saved Episodes",
    },
    put: {
      description:
        "Save one or more episodes to the current user's library.<br/>\nThis API endpoint is in __beta__ and could change without warning. Please share any feedback that you have, or issues that you discover, in our [developer community forum](https://community.spotify.com/t5/Spotify-for-Developers/bd-p/Spotify_Developer).\n",
      operationId: 'save-episodes-user',
      parameters: [
        {
          in: 'query',
          name: 'ids',
          required: true,
          schema: {
            description:
              'A comma-separated list of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids). Maximum: 50 IDs.\n',
            example: '77o6BIVlYM3msb4MMIL1jH,0Q86acNRm6V9GYx55SXKwf',
            title: 'Spotify Episodes IDs',
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              additionalProperties: true,
              properties: {
                ids: {
                  description:
                    'A JSON array of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids). <br/>A maximum of 50 items can be specified in one request. _**Note**: if the `ids` parameter is present in the query string, any IDs listed here in the body will be ignored._\n',
                  items: {
                    type: 'string',
                  },
                  type: 'array',
                },
              },
              required: ['uris'],
              type: 'object',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Episode saved',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['user-library-modify'],
        },
      ],
      summary: 'Save Episodes for Current User\n',
      tags: ['Episodes', 'Library'],
      'x-spotify-docs-console-url':
        '/console/put-current-user-saved-episodes/?ids=77o6BIVlYM3msb4MMIL1jH%2C0Q86acNRm6V9GYx55SXKwf',
      'x-spotify-docs-endpoint-name': 'Save Episodes for Current User',
    },
    'x-spotify-docs-category': 'Library',
    'x-spotify-docs-display-name': 'current-user-saved-episodes',
  },
  '/me/episodes/contains': {
    get: {
      description:
        "Check if one or more episodes is already saved in the current Spotify user's 'Your Episodes' library.<br/>\nThis API endpoint is in __beta__ and could change without warning. Please share any feedback that you have, or issues that you discover, in our [developer community forum](https://community.spotify.com/t5/Spotify-for-Developers/bd-p/Spotify_Developer)..\n",
      operationId: 'check-users-saved-episodes',
      parameters: [
        {
          in: 'query',
          name: 'ids',
          required: true,
          schema: {
            description:
              'A comma-separated list of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids) for the episodes. Maximum: 50 IDs.\n',
            example: '77o6BIVlYM3msb4MMIL1jH,0Q86acNRm6V9GYx55SXKwf',
            title: 'Spotify Episode IDs',
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/ArrayOfBooleans',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['user-library-read'],
        },
      ],
      summary: "Check User's Saved Episodes\n",
      tags: ['Episodes', 'Library'],
      'x-spotify-docs-console-url':
        '/console/get-current-user-contains-saved-episodes/?ids=77o6BIVlYM3msb4MMIL1jH%2C0Q86acNRm6V9GYx55SXKwf',
      'x-spotify-docs-endpoint-name': "Check User's Saved Episodes",
    },
    'x-spotify-docs-category': 'Library',
    'x-spotify-docs-display-name': 'current-user-contains-saved-episodes',
  },
  '/me/following': {
    delete: {
      description: 'Remove the current user as a follower of one or more artists or other Spotify users.\n',
      operationId: 'unfollow-artists-users',
      parameters: [
        {
          in: 'query',
          name: 'type',
          required: true,
          schema: {
            description: 'The ID type: either `artist` or `user`.\n',
            enum: ['artist', 'user'],
            example: 'artist',
            title: 'Item Type',
            type: 'string',
          },
        },
        {
          in: 'query',
          name: 'ids',
          required: true,
          schema: {
            description:
              'A comma-separated list of the artist or the user [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids). For example: `ids=74ASZWbe4lXaubB36ztrGX,08td7MxkoHQkXnWAYD8d6Q`. A maximum of 50 IDs can be sent in one request.\n',
            example: '2CIMQHirSU0MQqyYHq0eOx,57dN52uHvrHOxijzpIgu3E,1vCWHaC5f2uS3yhpwWbIA6',
            title: 'Spotify IDs',
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              additionalProperties: true,
              properties: {
                ids: {
                  description:
                    'A JSON array of the artist or user [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids). For example: `{ids:["74ASZWbe4lXaubB36ztrGX", "08td7MxkoHQkXnWAYD8d6Q"]}`. A maximum of 50 IDs can be sent in one request. _**Note**: if the `ids` parameter is present in the query string, any IDs listed here in the body will be ignored._\n',
                  items: {
                    type: 'string',
                  },
                  type: 'array',
                },
              },
              type: 'object',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Artist or user unfollowed',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['user-follow-modify'],
        },
      ],
      summary: 'Unfollow Artists or Users\n',
      tags: ['Users', 'Artists', 'Library'],
      'x-spotify-docs-console-url': '/console/delete-following/?type=user&amp;ids=exampleuser01',
      'x-spotify-docs-endpoint-name': 'Unfollow Artists or Users',
    },
    get: {
      description: "Get the current user's followed artists.\n",
      operationId: 'get-followed',
      parameters: [
        {
          in: 'query',
          name: 'type',
          required: true,
          schema: {
            description: 'The ID type: currently only `artist` is supported.\n',
            enum: ['artist'],
            example: 'artist',
            title: 'Item Type',
            type: 'string',
          },
        },
        {
          in: 'query',
          name: 'after',
          required: false,
          schema: {
            description: 'The last artist ID retrieved from the previous request.\n',
            example: '0I2XqVXqHScXjHhk6AYYRe',
            title: 'After',
            type: 'string',
          },
        },
        {
          in: 'query',
          name: 'limit',
          required: false,
          schema: {
            default: 20,
            description: 'The maximum number of items to return. Default: 20\\. Minimum: 1\\. Maximum: 50\\.\n',
            example: 10,
            maximum: 50,
            minimum: 0,
            title: 'Limit',
            type: 'integer',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/CursorPagedArtists',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['user-follow-read'],
        },
      ],
      summary: 'Get Followed Artists\n',
      tags: ['Users', 'Library', 'Artists'],
      'x-spotify-docs-console-url': '/console/get-following/?type=artist&amp;limit=20',
      'x-spotify-docs-endpoint-name': "Get User's Followed Artists",
    },
    put: {
      description: 'Add the current user as a follower of one or more artists or other Spotify users.\n',
      operationId: 'follow-artists-users',
      parameters: [
        {
          in: 'query',
          name: 'type',
          required: true,
          schema: {
            description: 'The ID type.\n',
            enum: ['artist', 'user'],
            example: 'artist',
            title: 'Item Type',
            type: 'string',
          },
        },
        {
          in: 'query',
          name: 'ids',
          required: true,
          schema: {
            description:
              'A comma-separated list of the artist or the user [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids).\nA maximum of 50 IDs can be sent in one request.\n',
            example: '2CIMQHirSU0MQqyYHq0eOx,57dN52uHvrHOxijzpIgu3E,1vCWHaC5f2uS3yhpwWbIA6',
            title: 'Spotify IDs',
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              additionalProperties: true,
              properties: {
                ids: {
                  description:
                    'A JSON array of the artist or user [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids).\nFor example: `{ids:["74ASZWbe4lXaubB36ztrGX", "08td7MxkoHQkXnWAYD8d6Q"]}`. A maximum of 50 IDs can be sent in one request. _**Note**: if the `ids` parameter is present in the query string, any IDs listed here in the body will be ignored._\n',
                  items: {
                    type: 'string',
                  },
                  type: 'array',
                },
              },
              required: ['ids'],
              type: 'object',
            },
          },
        },
      },
      responses: {
        '204': {
          description: 'Artist or user followed',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['user-follow-modify'],
        },
      ],
      summary: 'Follow Artists or Users\n',
      tags: ['Users', 'Artists', 'Library'],
      'x-spotify-docs-console-url': '/console/put-following/?type=user&amp;ids=exampleuser01',
      'x-spotify-docs-endpoint-name': 'Follow Artists or Users',
    },
    'x-spotify-docs-category': 'Follow',
    'x-spotify-docs-display-name': 'following',
  },
  '/me/following/contains': {
    get: {
      description: 'Check to see if the current user is following one or more artists or other Spotify users.\n',
      operationId: 'check-current-user-follows',
      parameters: [
        {
          in: 'query',
          name: 'type',
          required: true,
          schema: {
            description: 'The ID type: either `artist` or `user`.\n',
            enum: ['artist', 'user'],
            example: 'artist',
            title: 'Item Type',
            type: 'string',
          },
        },
        {
          in: 'query',
          name: 'ids',
          required: true,
          schema: {
            description:
              'A comma-separated list of the artist or the user [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids) to check. For example: `ids=74ASZWbe4lXaubB36ztrGX,08td7MxkoHQkXnWAYD8d6Q`. A maximum of 50 IDs can be sent in one request.\n',
            example: '2CIMQHirSU0MQqyYHq0eOx,57dN52uHvrHOxijzpIgu3E,1vCWHaC5f2uS3yhpwWbIA6',
            title: 'Spotify IDs',
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/ArrayOfBooleans',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['user-follow-read'],
        },
      ],
      summary: 'Check If User Follows Artists or Users\n',
      tags: ['Users', 'Artists', 'Library'],
      'x-spotify-docs-console-url': '/console/get-following-contains/?type=user&amp;ids=exampleuser01',
      'x-spotify-docs-endpoint-name': 'Get Following State for Artists/Users',
    },
    'x-spotify-docs-category': 'Follow',
    'x-spotify-docs-display-name': 'following-contains',
  },
  '/me/player': {
    get: {
      description:
        'Get information about the user’s current playback state, including track or episode, progress, and active device.\n',
      operationId: 'get-information-about-the-users-current-playback',
      parameters: [
        {
          $ref: '#/components/parameters/QueryMarket',
        },
        {
          $ref: '#/components/parameters/QueryAdditionalTypes',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/OneCurrentlyPlaying',
        },
        '204': {
          description: 'Playback not available or active',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['user-read-playback-state'],
        },
      ],
      summary: 'Get Playback State\n',
      tags: ['Player'],
      'x-spotify-docs-console-url': '/console/get-user-player/',
      'x-spotify-docs-endpoint-name': "Get Information About The User's Current Playback",
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/playerPolicyList',
      },
    },
    put: {
      description: 'Transfer playback to a new device and determine if it should start playing.\n',
      operationId: 'transfer-a-users-playback',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              additionalProperties: true,
              example: {
                device_ids: ['74ASZWbe4lXaubB36ztrGX'],
              },
              properties: {
                device_ids: {
                  description:
                    'A JSON array containing the ID of the device on which playback should be started/transferred.<br/>For example:`{device_ids:["74ASZWbe4lXaubB36ztrGX"]}`<br/>_**Note**: Although an array is accepted, only a single device_id is currently supported. Supplying more than one will return `400 Bad Request`_\n',
                  items: {
                    type: 'string',
                  },
                  type: 'array',
                },
                play: {
                  additionalProperties: true,
                  description:
                    '**true**: ensure playback happens on new device.<br/>**false** or not provided: keep the current playback state.\n',
                  type: 'boolean',
                },
              },
              required: ['device_ids'],
              type: 'object',
            },
          },
        },
      },
      responses: {
        '204': {
          description: 'Playback transferred',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['user-modify-playback-state'],
        },
      ],
      summary: 'Transfer Playback\n',
      tags: ['Player'],
      'x-spotify-docs-console-url': '/console/put-user-player',
      'x-spotify-docs-endpoint-name': "Transfer a User's Playback",
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/playerPolicyList',
      },
    },
    'x-spotify-docs-category': 'Player',
    'x-spotify-docs-display-name': 'user-player',
  },
  '/me/player/currently-playing': {
    get: {
      description: "Get the object currently being played on the user's Spotify account.\n",
      operationId: 'get-the-users-currently-playing-track',
      parameters: [
        {
          $ref: '#/components/parameters/QueryMarket',
        },
        {
          $ref: '#/components/parameters/QueryAdditionalTypes',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/OneCurrentlyPlayingTrack',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['user-read-currently-playing'],
        },
      ],
      summary: 'Get Currently Playing Track\n',
      tags: ['Player'],
      'x-spotify-docs-console-url': '/console/get-users-currently-playing-track/',
      'x-spotify-docs-endpoint-name': "Get the User's Currently Playing Track",
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/playerPolicyList',
      },
    },
    'x-spotify-docs-category': 'Player',
    'x-spotify-docs-display-name': 'users-currently-playing-track',
  },
  '/me/player/devices': {
    get: {
      description: 'Get information about a user’s available devices.\n',
      operationId: 'get-a-users-available-devices',
      responses: {
        '200': {
          $ref: '#/components/responses/ManyDevices',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['user-read-playback-state'],
        },
      ],
      summary: 'Get Available Devices\n',
      tags: ['Player'],
      'x-spotify-docs-console-url': '/console/get-users-available-devices/',
      'x-spotify-docs-endpoint-name': "Get a User's Available Devices",
    },
    'x-spotify-docs-category': 'Player',
    'x-spotify-docs-display-name': 'users-available-devices',
  },
  '/me/player/next': {
    post: {
      description: 'Skips to next track in the user’s queue.\n',
      operationId: 'skip-users-playback-to-next-track',
      parameters: [
        {
          in: 'query',
          name: 'device_id',
          required: false,
          schema: {
            description:
              "The id of the device this command is targeting. If not supplied, the user's currently active device is the target.",
            example: '0d1841b0976bae2a3a310dd74c0f3df354899bc8',
            title: 'Device ID',
            type: 'string',
          },
        },
      ],
      responses: {
        '204': {
          description: 'Command sent',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['user-modify-playback-state'],
        },
      ],
      summary: 'Skip To Next\n',
      tags: ['Player'],
      'x-spotify-docs-console-url': '/console/post-next/',
      'x-spotify-docs-endpoint-name': 'Skip User’s Playback To Next Track',
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/playerPolicyList',
      },
    },
    'x-spotify-docs-category': 'Player',
    'x-spotify-docs-display-name': 'next',
  },
  '/me/player/pause': {
    put: {
      description: "Pause playback on the user's account.\n",
      operationId: 'pause-a-users-playback',
      parameters: [
        {
          in: 'query',
          name: 'device_id',
          required: false,
          schema: {
            description:
              "The id of the device this command is targeting. If not supplied, the user's currently active device is the target.\n",
            example: '0d1841b0976bae2a3a310dd74c0f3df354899bc8',
            title: 'Device ID',
            type: 'string',
          },
        },
      ],
      responses: {
        '204': {
          description: 'Playback paused',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['user-modify-playback-state'],
        },
      ],
      summary: 'Pause Playback\n',
      tags: ['Player'],
      'x-spotify-docs-console-url': '/console/put-pause/',
      'x-spotify-docs-endpoint-name': "Pause a User's Playback",
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/playerPolicyList',
      },
    },
    'x-spotify-docs-category': 'Player',
    'x-spotify-docs-display-name': 'pause',
  },
  '/me/player/play': {
    put: {
      description: "Start a new context or resume current playback on the user's active device.\n",
      operationId: 'start-a-users-playback',
      parameters: [
        {
          in: 'query',
          name: 'device_id',
          required: false,
          schema: {
            description:
              "The id of the device this command is targeting. If not supplied, the user's currently active device is the target.",
            example: '0d1841b0976bae2a3a310dd74c0f3df354899bc8',
            title: 'Device ID',
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              additionalProperties: true,
              example: {
                context_uri: 'spotify:album:5ht7ItJgpBH7W6vJ5BqpPr',
                offset: {
                  position: 5,
                },
                position_ms: 0,
              },
              properties: {
                context_uri: {
                  additionalProperties: true,
                  description:
                    'Optional. Spotify URI of the context to play.\nValid contexts are albums, artists & playlists.\n`{context_uri:"spotify:album:1Je1IMUlBXcx1Fz0WE7oPT"}`\n',
                  type: 'string',
                },
                offset: {
                  additionalProperties: true,
                  description:
                    'Optional. Indicates from where in the context playback should start. Only available when context_uri corresponds to an album or playlist object\n"position" is zero based and can’t be negative. Example: `"offset": {"position": 5}`\n"uri" is a string representing the uri of the item to start at. Example: `"offset": {"uri": "spotify:track:1301WleyT98MSxVHPZCA6M"}`\n',
                  type: 'object',
                },
                position_ms: {
                  additionalProperties: true,
                  description: 'integer',
                  type: 'integer',
                },
                uris: {
                  description:
                    'Optional. A JSON array of the Spotify track URIs to play.\nFor example: `{"uris": ["spotify:track:4iV5W9uYEdYUVa79Axb7Rh", "spotify:track:1301WleyT98MSxVHPZCA6M"]}`\n',
                  items: {
                    type: 'string',
                  },
                  type: 'array',
                },
              },
              type: 'object',
            },
          },
        },
      },
      responses: {
        '204': {
          description: 'Playback started',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['user-modify-playback-state'],
        },
      ],
      summary: 'Start/Resume Playback\n',
      tags: ['Player'],
      'x-spotify-docs-console-url': '/console/put-play/',
      'x-spotify-docs-endpoint-name': "Start/Resume a User's Playback",
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/playerPolicyList',
      },
    },
    'x-spotify-docs-category': 'Player',
    'x-spotify-docs-display-name': 'play',
  },
  '/me/player/previous': {
    post: {
      description: 'Skips to previous track in the user’s queue.\n',
      operationId: 'skip-users-playback-to-previous-track',
      parameters: [
        {
          in: 'query',
          name: 'device_id',
          required: false,
          schema: {
            description:
              "The id of the device this command is targeting. If\nnot supplied, the user's currently active device is the target.\n",
            example: '0d1841b0976bae2a3a310dd74c0f3df354899bc8',
            title: 'Device ID',
            type: 'string',
          },
        },
      ],
      responses: {
        '204': {
          description: 'Command sent',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['user-modify-playback-state'],
        },
      ],
      summary: 'Skip To Previous\n',
      tags: ['Player'],
      'x-spotify-docs-console-url': '/console/post-previous/',
      'x-spotify-docs-endpoint-name': 'Skip User’s Playback To Previous Track',
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/playerPolicyList',
      },
    },
    'x-spotify-docs-category': 'Player',
    'x-spotify-docs-display-name': 'previous',
  },
  '/me/player/queue': {
    get: {
      description: "Get the list of objects that make up the user's queue.\n",
      operationId: 'get-queue',
      responses: {
        '200': {
          $ref: '#/components/responses/Queue',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['user-read-playback-state'],
        },
      ],
      summary: "Get the User's Queue\n",
      tags: ['Player'],
      'x-spotify-docs-console-url': '/console/get-queue/',
      'x-spotify-docs-endpoint-name': "Get the User's Queue",
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/playerPolicyList',
      },
    },
    post: {
      description: "Add an item to the end of the user's current playback queue.\n",
      operationId: 'add-to-queue',
      parameters: [
        {
          in: 'query',
          name: 'uri',
          required: true,
          schema: {
            description: 'The uri of the item to add to the queue. Must be a track or an episode uri.\n',
            example: 'spotify:track:4iV5W9uYEdYUVa79Axb7Rh',
            title: 'Spotify URI',
            type: 'string',
          },
        },
        {
          in: 'query',
          name: 'device_id',
          required: false,
          schema: {
            description:
              "The id of the device this command is targeting. If\nnot supplied, the user's currently active device is the target.\n",
            example: '0d1841b0976bae2a3a310dd74c0f3df354899bc8',
            title: 'Device ID',
            type: 'string',
          },
        },
      ],
      responses: {
        '204': {
          description: 'Command received',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['user-modify-playback-state'],
        },
      ],
      summary: 'Add Item to Playback Queue\n',
      tags: ['Player'],
      'x-spotify-docs-console-url': '/console/post-queue/',
      'x-spotify-docs-endpoint-name': 'Add an item to queue',
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/playerPolicyList',
      },
    },
    'x-spotify-docs-category': 'Player',
    'x-spotify-docs-display-name': 'queue',
  },
  '/me/player/recently-played': {
    get: {
      description:
        "Get tracks from the current user's recently played tracks.\n_**Note**: Currently doesn't support podcast episodes._\n",
      operationId: 'get-recently-played',
      parameters: [
        {
          in: 'query',
          name: 'limit',
          required: false,
          schema: {
            default: 20,
            description: 'The maximum number of items to return. Default: 20. Minimum: 1. Maximum: 50.\n',
            example: 10,
            maximum: 50,
            minimum: 0,
            title: 'Limit',
            type: 'integer',
          },
        },
        {
          in: 'query',
          name: 'after',
          required: false,
          schema: {
            description:
              'A Unix timestamp in milliseconds. Returns all items\nafter (but not including) this cursor position. If `after` is specified, `before`\nmust not be specified.\n',
            example: 1484811043508,
            title: 'After',
            type: 'integer',
          },
        },
        {
          in: 'query',
          name: 'before',
          required: false,
          schema: {
            description:
              'A Unix timestamp in milliseconds. Returns all items\nbefore (but not including) this cursor position. If `before` is specified,\n`after` must not be specified.\n',
            title: 'Before',
            type: 'integer',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/CursorPagedPlayHistory',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['user-read-recently-played'],
        },
      ],
      summary: 'Get Recently Played Tracks\n',
      tags: ['Player'],
      'x-spotify-docs-console-url': '/console/get-recently-played/',
      'x-spotify-docs-endpoint-name': "Get Current User's Recently Played Tracks",
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/playerPolicyList',
      },
    },
    'x-spotify-docs-category': 'Player',
    'x-spotify-docs-display-name': 'recently-played',
  },
  '/me/player/repeat': {
    put: {
      description: "Set the repeat mode for the user's playback. Options are repeat-track,\nrepeat-context, and off.\n",
      operationId: 'set-repeat-mode-on-users-playback',
      parameters: [
        {
          in: 'query',
          name: 'state',
          required: true,
          schema: {
            description:
              '**track**, **context** or **off**.<br/>\n**track** will repeat the current track.<br/>\n**context** will repeat the current context.<br/>\n**off** will turn repeat off.\n',
            example: 'context',
            title: 'State',
            type: 'string',
          },
        },
        {
          in: 'query',
          name: 'device_id',
          required: false,
          schema: {
            description:
              "The id of the device this command is targeting. If\nnot supplied, the user's currently active device is the target.\n",
            example: '0d1841b0976bae2a3a310dd74c0f3df354899bc8',
            title: 'Device ID',
            type: 'string',
          },
        },
      ],
      responses: {
        '204': {
          description: 'Command sent',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['user-modify-playback-state'],
        },
      ],
      summary: 'Set Repeat Mode\n',
      tags: ['Player'],
      'x-spotify-docs-console-url': '/console/put-repeat/',
      'x-spotify-docs-endpoint-name': 'Set Repeat Mode On User’s Playback',
    },
    'x-spotify-docs-category': 'Player',
    'x-spotify-docs-display-name': 'repeat',
  },
  '/me/player/seek': {
    put: {
      description: 'Seeks to the given position in the user’s currently playing track.\n',
      operationId: 'seek-to-position-in-currently-playing-track',
      parameters: [
        {
          in: 'query',
          name: 'position_ms',
          required: true,
          schema: {
            description:
              'The position in milliseconds to seek to. Must be a\npositive number. Passing in a position that is greater than the length of\nthe track will cause the player to start playing the next song.\n',
            example: 25000,
            title: 'Position (ms)',
            type: 'integer',
          },
        },
        {
          in: 'query',
          name: 'device_id',
          required: false,
          schema: {
            description:
              "The id of the device this command is targeting. If\nnot supplied, the user's currently active device is the target.\n",
            example: '0d1841b0976bae2a3a310dd74c0f3df354899bc8',
            title: 'Device ID',
            type: 'string',
          },
        },
      ],
      responses: {
        '204': {
          description: 'Command sent',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['user-modify-playback-state'],
        },
      ],
      summary: 'Seek To Position\n',
      tags: ['Player'],
      'x-spotify-docs-console-url': '/console/put-seek/',
      'x-spotify-docs-endpoint-name': 'Seek To Position In Currently Playing Track',
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/playerPolicyList',
      },
    },
    'x-spotify-docs-category': 'Player',
    'x-spotify-docs-display-name': 'seek',
  },
  '/me/player/shuffle': {
    put: {
      description: 'Toggle shuffle on or off for user’s playback.\n',
      operationId: 'toggle-shuffle-for-users-playback',
      parameters: [
        {
          in: 'query',
          name: 'state',
          required: true,
          schema: {
            description: "**true** : Shuffle user's playback.<br/>\n**false** : Do not shuffle user's playback.\n",
            example: true,
            title: 'State',
            type: 'boolean',
          },
        },
        {
          in: 'query',
          name: 'device_id',
          required: false,
          schema: {
            description:
              "The id of the device this command is targeting. If\nnot supplied, the user's currently active device is the target.\n",
            example: '0d1841b0976bae2a3a310dd74c0f3df354899bc8',
            title: 'Device ID',
            type: 'string',
          },
        },
      ],
      responses: {
        '204': {
          description: 'Command sent',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['user-modify-playback-state'],
        },
      ],
      summary: 'Toggle Playback Shuffle\n',
      tags: ['Player'],
      'x-spotify-docs-console-url': '/console/put-shuffle/?state=true',
      'x-spotify-docs-endpoint-name': 'Toggle Shuffle For User’s Playback',
    },
    'x-spotify-docs-category': 'Player',
    'x-spotify-docs-display-name': 'shuffle',
  },
  '/me/player/volume': {
    put: {
      description: 'Set the volume for the user’s current playback device.\n',
      operationId: 'set-volume-for-users-playback',
      parameters: [
        {
          in: 'query',
          name: 'volume_percent',
          required: true,
          schema: {
            description: 'The volume to set. Must be a value from 0 to 100 inclusive.\n',
            example: 50,
            title: 'Volume %',
            type: 'integer',
          },
        },
        {
          in: 'query',
          name: 'device_id',
          required: false,
          schema: {
            description:
              "The id of the device this command is targeting. If not supplied, the user's currently active device is the target.\n",
            example: '0d1841b0976bae2a3a310dd74c0f3df354899bc8',
            title: 'Device ID',
            type: 'string',
          },
        },
      ],
      responses: {
        '204': {
          description: 'Command sent',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['user-modify-playback-state'],
        },
      ],
      summary: 'Set Playback Volume\n',
      tags: ['Player'],
      'x-spotify-docs-console-url': '/console/put-volume/',
      'x-spotify-docs-endpoint-name': "Set Volume For User's Playback",
    },
    'x-spotify-docs-category': 'Player',
    'x-spotify-docs-display-name': 'volume',
  },
  '/me/playlists': {
    get: {
      description: 'Get a list of the playlists owned or followed by the current Spotify\nuser.\n',
      operationId: 'get-a-list-of-current-users-playlists',
      parameters: [
        {
          $ref: '#/components/parameters/QueryLimit',
        },
        {
          in: 'query',
          name: 'offset',
          required: false,
          schema: {
            default: 0,
            description:
              "'The index of the first playlist to return. Default:\n0 (the first object). Maximum offset: 100.000\\. Use with `limit` to get the\nnext set of playlists.'\n",
            example: 5,
            title: 'Offset',
            type: 'integer',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/PagedPlaylists',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['playlist-read-private'],
        },
      ],
      summary: "Get Current User's Playlists\n",
      tags: ['Playlists', 'Library'],
      'x-spotify-docs-console-url': '/console/get-current-user-playlists/',
      'x-spotify-docs-endpoint-name': "Get a List of Current User's Playlists",
    },
    'x-spotify-docs-category': 'Playlists',
    'x-spotify-docs-display-name': 'current-user-playlists',
  },
  '/me/shows': {
    delete: {
      description: "Delete one or more shows from current Spotify user's library.\n",
      operationId: 'remove-shows-user',
      parameters: [
        {
          $ref: '#/components/parameters/QueryShowIds',
        },
        {
          $ref: '#/components/parameters/QueryMarket',
        },
      ],
      responses: {
        '200': {
          description: 'Show removed',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['user-library-modify'],
        },
      ],
      summary: "Remove User's Saved Shows\n",
      tags: ['Shows', 'Library'],
      'x-spotify-docs-console-url':
        '/console/delete-current-user-saved-shows/?ids=5AvwZVawapvyhJUIx71pdJ%2C6ups0LMt1G8n81XLlkbsPo%2C5AvwZVawapvyhJUIx71pdJ',
      'x-spotify-docs-endpoint-name': "Remove User's Saved Shows",
    },
    get: {
      description:
        "Get a list of shows saved in the current Spotify user's library. Optional parameters can be used to limit the number of shows returned.\n",
      operationId: 'get-users-saved-shows',
      parameters: [
        {
          $ref: '#/components/parameters/QueryLimit',
        },
        {
          $ref: '#/components/parameters/QueryOffset',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/PagingSavedShowObject',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['user-library-read'],
        },
      ],
      summary: "Get User's Saved Shows\n",
      tags: ['Shows', 'Library'],
      'x-spotify-docs-console-url': '/console/get-current-user-saved-shows/',
      'x-spotify-docs-endpoint-name': "Get User's Saved Shows",
    },
    put: {
      description: "Save one or more shows to current Spotify user's library.\n",
      operationId: 'save-shows-user',
      parameters: [
        {
          $ref: '#/components/parameters/QueryShowIds',
        },
      ],
      responses: {
        '200': {
          description: 'Show saved',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['user-library-modify'],
        },
      ],
      summary: 'Save Shows for Current User\n',
      tags: ['Shows', 'Library'],
      'x-spotify-docs-console-url':
        '/console/put-current-user-saved-shows/?ids=5AvwZVawapvyhJUIx71pdJ%2C6ups0LMt1G8n81XLlkbsPo%2C5AvwZVawapvyhJUIx71pdJ',
      'x-spotify-docs-endpoint-name': 'Save Shows for Current User',
    },
    'x-spotify-docs-category': 'Library',
    'x-spotify-docs-display-name': 'current-user-saved-shows',
  },
  '/me/shows/contains': {
    get: {
      description: "Check if one or more shows is already saved in the current Spotify user's library.\n",
      operationId: 'check-users-saved-shows',
      parameters: [
        {
          $ref: '#/components/parameters/QueryShowIds',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/ArrayOfBooleans',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['user-library-read'],
        },
      ],
      summary: "Check User's Saved Shows\n",
      tags: ['Shows', 'Library'],
      'x-spotify-docs-console-url':
        '/console/get-current-user-contains-saved-shows/?ids=5AvwZVawapvyhJUIx71pdJ%2C6ups0LMt1G8n81XLlkbsPo%2C5AvwZVawapvyhJUIx71pdJ',
      'x-spotify-docs-endpoint-name': "Check User's Saved Shows",
    },
    'x-spotify-docs-category': 'Library',
    'x-spotify-docs-display-name': 'current-user-contains-saved-shows',
  },
  '/me/top/{type}': {
    get: {
      description: "Get the current user's top artists or tracks based on calculated affinity.\n",
      operationId: 'get-users-top-artists-and-tracks',
      parameters: [
        {
          in: 'path',
          name: 'type',
          required: true,
          schema: {
            description: 'The type of entity to return. Valid values: `artists` or `tracks`\n',
            enum: ['artists', 'tracks'],
            title: 'Type',
            type: 'string',
          },
        },
        {
          in: 'query',
          name: 'time_range',
          required: false,
          schema: {
            default: 'medium_term',
            description:
              'Over what time frame the affinities are computed. Valid values: `long_term` (calculated from several years of data and including all new data as it becomes available), `medium_term` (approximately last 6 months), `short_term` (approximately last 4 weeks). Default: `medium_term`\n',
            example: 'medium_term',
            title: 'Time Range',
            type: 'string',
          },
        },
        {
          $ref: '#/components/parameters/QueryLimit',
        },
        {
          $ref: '#/components/parameters/QueryOffset',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/PagingArtistOrTrackObject',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['user-top-read'],
        },
      ],
      summary: "Get User's Top Items\n",
      tags: ['Users', 'Tracks', 'Library'],
      'x-spotify-docs-console-url': '/console/get-current-user-top-artists-and-tracks/?type=artists',
      'x-spotify-docs-endpoint-name': "Get a User's Top Artists and Tracks",
    },
    'x-spotify-docs-category': 'Personalization',
    'x-spotify-docs-display-name': 'current-user-top-artists-and-tracks',
  },
  '/me/tracks': {
    delete: {
      description: "Remove one or more tracks from the current user's 'Your Music' library.\n",
      operationId: 'remove-tracks-user',
      parameters: [
        {
          $ref: '#/components/parameters/QueryTrackIds',
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              additionalProperties: true,
              properties: {
                ids: {
                  description:
                    'A JSON array of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids). For example: `["4iV5W9uYEdYUVa79Axb7Rh", "1301WleyT98MSxVHPZCA6M"]`<br/>A maximum of 50 items can be specified in one request. _**Note**: if the `ids` parameter is present in the query string, any IDs listed here in the body will be ignored._\n',
                  items: {
                    type: 'string',
                  },
                  type: 'array',
                },
              },
              type: 'object',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Track removed',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['user-library-modify'],
        },
      ],
      summary: "Remove User's Saved Tracks\n",
      tags: ['Tracks', 'Library'],
      'x-spotify-docs-console-url':
        '/console/delete-current-user-saved-tracks/?ids=7ouMYWpwJ422jRcDASZB7P%2C4VqPOruhp5EdPBeR92t6lQ%2C2takcwOaAZWiXQijPHIx7B',
      'x-spotify-docs-endpoint-name': "Remove User's Saved Tracks",
    },
    get: {
      description: "Get a list of the songs saved in the current Spotify user's 'Your Music' library.\n",
      operationId: 'get-users-saved-tracks',
      parameters: [
        {
          $ref: '#/components/parameters/QueryMarket',
        },
        {
          $ref: '#/components/parameters/QueryLimit',
        },
        {
          $ref: '#/components/parameters/QueryOffset',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/PagingSavedTrackObject',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['user-library-read'],
        },
      ],
      summary: "Get User's Saved Tracks\n",
      tags: ['Tracks', 'Library'],
      'x-spotify-docs-console-url': '/console/get-current-user-saved-tracks/',
      'x-spotify-docs-endpoint-name': "Get User's Saved Tracks",
    },
    put: {
      description: "Save one or more tracks to the current user's 'Your Music' library.\n",
      operationId: 'save-tracks-user',
      parameters: [
        {
          $ref: '#/components/parameters/QueryTrackIds',
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              additionalProperties: true,
              properties: {
                ids: {
                  description:
                    'A JSON array of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids). For example: `["4iV5W9uYEdYUVa79Axb7Rh", "1301WleyT98MSxVHPZCA6M"]`<br/>A maximum of 50 items can be specified in one request. _**Note**: if the `ids` parameter is present in the query string, any IDs listed here in the body will be ignored._\n',
                  items: {
                    type: 'string',
                  },
                  type: 'array',
                },
              },
              required: ['uris'],
              type: 'object',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Track saved',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['user-library-modify'],
        },
      ],
      summary: 'Save Tracks for Current User\n',
      tags: ['Tracks', 'Library'],
      'x-spotify-docs-console-url':
        '/console/put-current-user-saved-tracks/?ids=7ouMYWpwJ422jRcDASZB7P%2C4VqPOruhp5EdPBeR92t6lQ%2C2takcwOaAZWiXQijPHIx7B',
      'x-spotify-docs-endpoint-name': 'Save Tracks for User',
    },
    'x-spotify-docs-category': 'Library',
    'x-spotify-docs-display-name': 'current-user-saved-tracks',
  },
  '/me/tracks/contains': {
    get: {
      description: "Check if one or more tracks is already saved in the current Spotify user's 'Your Music' library.\n",
      operationId: 'check-users-saved-tracks',
      parameters: [
        {
          $ref: '#/components/parameters/QueryTrackIds',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/ArrayOfBooleans',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['user-library-read'],
        },
      ],
      summary: "Check User's Saved Tracks\n",
      tags: ['Tracks', 'Library'],
      'x-spotify-docs-console-url':
        '/console/get-current-user-contains-saved-tracks/?ids=0udZHhCi7p1YzMlvI4fXoK%2C3SF5puV5eb6bgRSxBeMOk9',
      'x-spotify-docs-endpoint-name': "Check User's Saved Tracks",
    },
    'x-spotify-docs-category': 'Library',
    'x-spotify-docs-display-name': 'current-user-contains-saved-tracks',
  },
  '/playlists/{playlist_id}': {
    get: {
      description: 'Get a playlist owned by a Spotify user.\n',
      operationId: 'get-playlist',
      parameters: [
        {
          $ref: '#/components/parameters/PathPlaylistId',
        },
        {
          $ref: '#/components/parameters/QueryMarket',
        },
        {
          in: 'query',
          name: 'fields',
          required: false,
          schema: {
            description:
              "Filters for the query: a comma-separated list of the\nfields to return. If omitted, all fields are returned. For example, to get\njust the playlist''s description and URI: `fields=description,uri`. A dot\nseparator can be used to specify non-reoccurring fields, while parentheses\ncan be used to specify reoccurring fields within objects. For example, to\nget just the added date and user ID of the adder: `fields=tracks.items(added_at,added_by.id)`.\nUse multiple parentheses to drill down into nested objects, for example: `fields=tracks.items(track(name,href,album(name,href)))`.\nFields can be excluded by prefixing them with an exclamation mark, for example:\n`fields=tracks.items(track(name,href,album(!name,href)))`\n",
            example: 'items(added_by.id,track(name,href,album(name,href)))',
            title: 'Fields',
            type: 'string',
          },
        },
        {
          $ref: '#/components/parameters/QueryAdditionalTypes',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/OnePlaylist',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: [],
        },
      ],
      summary: 'Get Playlist\n',
      tags: ['Playlists'],
      'x-spotify-docs-console-url': '/console/get-playlist/?playlist_id=59ZbFPES4DQwEjBpWHzrtC&amp;user_id=spotify',
      'x-spotify-docs-endpoint-name': 'Get a Playlist',
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/metadataPolicyList',
      },
    },
    put: {
      description:
        "Change a playlist's name and public/private state. (The user must, of\ncourse, own the playlist.)\n",
      operationId: 'change-playlist-details',
      parameters: [
        {
          $ref: '#/components/parameters/PathPlaylistId',
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              additionalProperties: true,
              example: {
                description: 'Updated playlist description',
                name: 'Updated Playlist Name',
                public: false,
              },
              properties: {
                collaborative: {
                  description:
                    'If `true`, the playlist will become collaborative and other users will be able to modify the playlist in their Spotify client. <br/>\n_**Note**: You can only set `collaborative` to `true` on non-public playlists._\n',
                  type: 'boolean',
                },
                description: {
                  description: 'Value for playlist description as displayed in Spotify Clients and in the Web API.\n',
                  type: 'string',
                },
                name: {
                  description: 'The new name for the playlist, for example `"My New Playlist Title"`\n',
                  type: 'string',
                },
                public: {
                  description: 'If `true` the playlist will be public, if `false` it will be private.\n',
                  type: 'boolean',
                },
              },
              type: 'object',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Playlist updated',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['playlist-modify-public', 'playlist-modify-private'],
        },
      ],
      summary: 'Change Playlist Details\n',
      tags: ['Playlists', 'Library'],
      'x-spotify-docs-console-url': '/console/put-playlist/',
      'x-spotify-docs-endpoint-name': "Change a Playlist's Details",
    },
    'x-spotify-docs-category': 'Playlists',
    'x-spotify-docs-display-name': 'playlist',
  },
  '/playlists/{playlist_id}/followers': {
    delete: {
      description: 'Remove the current user as a follower of a playlist.\n',
      operationId: 'unfollow-playlist',
      parameters: [
        {
          $ref: '#/components/parameters/PathPlaylistId',
        },
      ],
      responses: {
        '200': {
          description: 'Playlist unfollowed',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['playlist-modify-public', 'playlist-modify-private'],
        },
      ],
      summary: 'Unfollow Playlist\n',
      tags: ['Users', 'Playlists'],
      'x-spotify-docs-console-url':
        '/console/delete-playlist-followers/?playlist_id=2v3iNvBX8Ay1Gt2uXtUKUT&amp;user_id=jmperezperez',
      'x-spotify-docs-endpoint-name': 'Unfollow Playlist',
    },
    put: {
      description: 'Add the current user as a follower of a playlist.\n',
      operationId: 'follow-playlist',
      parameters: [
        {
          $ref: '#/components/parameters/PathPlaylistId',
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              additionalProperties: true,
              example: {
                public: false,
              },
              properties: {
                public: {
                  description:
                    "Defaults to `true`. If `true` the playlist will be included in user's public playlists, if `false` it will remain private.\n",
                  type: 'boolean',
                },
              },
              type: 'object',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Playlist followed',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['playlist-modify-public', 'playlist-modify-private'],
        },
      ],
      summary: 'Follow Playlist\n',
      tags: ['Users', 'Playlists'],
      'x-spotify-docs-console-url':
        '/console/put-playlist-followers/?playlist_id=2v3iNvBX8Ay1Gt2uXtUKUT&amp;body-json=%7B%0D%0A++%22public%22%3A+true%0D%0A%7D&amp;user_id=jmperezperez',
      'x-spotify-docs-endpoint-name': 'Follow a Playlist',
    },
    'x-spotify-docs-category': 'Follow',
    'x-spotify-docs-display-name': 'playlist-followers',
  },
  '/playlists/{playlist_id}/followers/contains': {
    get: {
      description: 'Check to see if one or more Spotify users are following a specified playlist.\n',
      operationId: 'check-if-user-follows-playlist',
      parameters: [
        {
          $ref: '#/components/parameters/PathPlaylistId',
        },
        {
          in: 'query',
          name: 'ids',
          required: true,
          schema: {
            description:
              'A comma-separated list of [Spotify User IDs](/documentation/web-api/concepts/spotify-uris-ids) ; the ids of the users that you want to check to see if they follow the playlist. Maximum: 5 ids.\n',
            example: 'jmperezperez,thelinmichael,wizzler',
            title: 'Spotify user IDs',
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/ArrayOfBooleans',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: [],
        },
      ],
      summary: 'Check if Users Follow Playlist\n',
      tags: ['Users', 'Playlists'],
      'x-spotify-docs-console-url':
        '/console/get-playlist-followers-contains/?ids=possan,elogain&amp;user_id=jmperezperez&amp;playlist_id=2v3iNvBX8Ay1Gt2uXtUKUT',
      'x-spotify-docs-endpoint-name': 'Check if Users Follow a Playlist',
    },
    'x-spotify-docs-category': 'Follow',
    'x-spotify-docs-display-name': 'playlist-followers-contains',
  },
  '/playlists/{playlist_id}/images': {
    get: {
      description: 'Get the current image associated with a specific playlist.\n',
      operationId: 'get-playlist-cover',
      parameters: [
        {
          $ref: '#/components/parameters/PathPlaylistId',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/ArrayOfImages',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: [],
        },
      ],
      summary: 'Get Playlist Cover Image\n',
      tags: ['Playlists'],
      'x-spotify-docs-console-url': '/console/get-playlist-images?playlist_id=3cEYpjA9oz9GiPac4AsH4n',
      'x-spotify-docs-endpoint-name': 'Get a Playlist Cover Image',
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/metadataPolicyList',
      },
    },
    put: {
      description: 'Replace the image used to represent a specific playlist.\n',
      operationId: 'upload-custom-playlist-cover',
      parameters: [
        {
          $ref: '#/components/parameters/PathPlaylistId',
        },
      ],
      requestBody: {
        content: {
          'image/jpeg': {
            schema: {
              description: 'Base64 encoded JPEG image data, maximum payload size is 256 KB.',
              example:
                '/9j/2wCEABoZGSccJz4lJT5CLy8vQkc9Ozs9R0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0cBHCcnMyYzPSYmPUc9Mj1HR0dEREdHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR//dAAQAAf/uAA5BZG9iZQBkwAAAAAH/wAARCAABAAEDACIAAREBAhEB/8QASwABAQAAAAAAAAAAAAAAAAAAAAYBAQAAAAAAAAAAAAAAAAAAAAAQAQAAAAAAAAAAAAAAAAAAAAARAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwAAARECEQA/AJgAH//Z',
              format: 'byte',
              type: 'string',
            },
          },
        },
      },
      responses: {
        '202': {
          description: 'Image uploaded',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['ugc-image-upload', 'playlist-modify-public', 'playlist-modify-private'],
        },
      ],
      summary: 'Add Custom Playlist Cover Image\n',
      tags: ['Playlists'],
      'x-spotify-docs-console-url': '/console/put-playlist-images?playlist_id=3cEYpjA9oz9GiPac4AsH4n',
      'x-spotify-docs-endpoint-name': 'Upload a Custom Playlist Cover Image',
    },
    'x-spotify-docs-category': 'Playlists',
    'x-spotify-docs-display-name': 'playlist-images',
  },
  '/playlists/{playlist_id}/tracks': {
    delete: {
      description: "Remove one or more items from a user's playlist.\n",
      operationId: 'remove-tracks-playlist',
      parameters: [
        {
          $ref: '#/components/parameters/PathPlaylistId',
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              properties: {
                snapshot_id: {
                  description:
                    "The playlist's snapshot ID against which you want to make the changes.\nThe API will validate that the specified items exist and in the specified positions and make the changes,\neven if more recent changes have been made to the playlist.\n",
                  type: 'string',
                },
                tracks: {
                  description:
                    'An array of objects containing [Spotify URIs](/documentation/web-api/concepts/spotify-uris-ids) of the tracks or episodes to remove.\nFor example: `{ "tracks": [{ "uri": "spotify:track:4iV5W9uYEdYUVa79Axb7Rh" },{ "uri": "spotify:track:1301WleyT98MSxVHPZCA6M" }] }`. A maximum of 100 objects can be sent at once.\n',
                  items: {
                    properties: {
                      uri: {
                        description: 'Spotify URI',
                        type: 'string',
                      },
                    },
                    type: 'object',
                  },
                  type: 'array',
                },
              },
              required: ['tracks'],
              type: 'object',
            },
          },
        },
      },
      responses: {
        '200': {
          $ref: '#/components/responses/PlaylistSnapshotId',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['playlist-modify-public', 'playlist-modify-private'],
        },
      ],
      summary: 'Remove Playlist Items\n',
      tags: ['Playlists', 'Tracks'],
      'x-spotify-docs-console-url': '/console/delete-playlist-tracks/',
      'x-spotify-docs-endpoint-name': 'Remove Items from a Playlist',
    },
    get: {
      description: 'Get full details of the items of a playlist owned by a Spotify user.\n',
      operationId: 'get-playlists-tracks',
      parameters: [
        {
          $ref: '#/components/parameters/PathPlaylistId',
        },
        {
          $ref: '#/components/parameters/QueryMarket',
        },
        {
          in: 'query',
          name: 'fields',
          required: false,
          schema: {
            description:
              'Filters for the query: a comma-separated list of the\nfields to return. If omitted, all fields are returned. For example, to get\njust the total number of items and the request limit:<br/>`fields=total,limit`<br/>A\ndot separator can be used to specify non-reoccurring fields, while parentheses\ncan be used to specify reoccurring fields within objects. For example, to\nget just the added date and user ID of the adder:<br/>`fields=items(added_at,added_by.id)`<br/>Use\nmultiple parentheses to drill down into nested objects, for example:<br/>`fields=items(track(name,href,album(name,href)))`<br/>Fields\ncan be excluded by prefixing them with an exclamation mark, for example:<br/>`fields=items.track.album(!external_urls,images)`\n',
            example: 'items(added_by.id,track(name,href,album(name,href)))',
            title: 'Fields',
            type: 'string',
          },
        },
        {
          $ref: '#/components/parameters/QueryLimit',
        },
        {
          $ref: '#/components/parameters/QueryOffset',
        },
        {
          $ref: '#/components/parameters/QueryAdditionalTypes',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/PagingPlaylistTrackObject',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['playlist-read-private'],
        },
      ],
      summary: 'Get Playlist Items\n',
      tags: ['Playlists', 'Tracks'],
      'x-spotify-docs-console-url':
        '/console/get-playlist-tracks/?playlist_id=21THa8j9TaSGuXYNBU5tsC&amp;user_id=spotify_espa%C3%B1a',
      'x-spotify-docs-endpoint-name': "Get a Playlist's Items",
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/metadataPolicyList',
      },
    },
    post: {
      description: "Add one or more items to a user's playlist.\n",
      operationId: 'add-tracks-to-playlist',
      parameters: [
        {
          $ref: '#/components/parameters/PathPlaylistId',
        },
        {
          in: 'query',
          name: 'position',
          required: false,
          schema: {
            description:
              'The position to insert the items, a zero-based index. For example, to insert the items in the first position: `position=0`; to insert the items in the third position: `position=2`. If omitted, the items will be appended to the playlist. Items are added in the order they are listed in the query string or request body.\n',
            example: 0,
            title: 'Position (append by default)',
            type: 'integer',
          },
        },
        {
          in: 'query',
          name: 'uris',
          required: false,
          schema: {
            description:
              'A comma-separated list of [Spotify URIs](/documentation/web-api/concepts/spotify-uris-ids) to add, can be track or episode URIs. For example:<br/>`uris=spotify:track:4iV5W9uYEdYUVa79Axb7Rh, spotify:track:1301WleyT98MSxVHPZCA6M, spotify:episode:512ojhOuo1ktJprKbVcKyQ`<br/>A maximum of 100 items can be added in one request. <br/>\n_**Note**: it is likely that passing a large number of item URIs as a query parameter will exceed the maximum length of the request URI. When adding a large number of items, it is recommended to pass them in the request body, see below._\n',
            example: 'spotify:track:4iV5W9uYEdYUVa79Axb7Rh,spotify:track:1301WleyT98MSxVHPZCA6M',
            title: 'Spotify Track URIs',
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              additionalProperties: true,
              properties: {
                position: {
                  description:
                    'The position to insert the items, a zero-based index. For example, to insert the items in the first position: `position=0` ; to insert the items in the third position: `position=2`. If omitted, the items will be appended to the playlist. Items are added in the order they appear in the uris array. For example: `{"uris": ["spotify:track:4iV5W9uYEdYUVa79Axb7Rh","spotify:track:1301WleyT98MSxVHPZCA6M"], "position": 3}`\n',
                  type: 'integer',
                },
                uris: {
                  description:
                    'A JSON array of the [Spotify URIs](/documentation/web-api/concepts/spotify-uris-ids) to add. For example: `{"uris": ["spotify:track:4iV5W9uYEdYUVa79Axb7Rh","spotify:track:1301WleyT98MSxVHPZCA6M", "spotify:episode:512ojhOuo1ktJprKbVcKyQ"]}`<br/>A maximum of 100 items can be added in one request. _**Note**: if the `uris` parameter is present in the query string, any URIs listed here in the body will be ignored._\n',
                  items: {
                    type: 'string',
                  },
                  type: 'array',
                },
              },
              type: 'object',
            },
          },
        },
      },
      responses: {
        '201': {
          $ref: '#/components/responses/PlaylistSnapshotId',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['playlist-modify-public', 'playlist-modify-private'],
        },
      ],
      summary: 'Add Items to Playlist\n',
      tags: ['Playlists', 'Tracks'],
      'x-spotify-docs-console-url': '/console/post-playlist-tracks/',
      'x-spotify-docs-endpoint-name': 'Add Items to a Playlist',
    },
    put: {
      description:
        "Either reorder or replace items in a playlist depending on the request's parameters.\nTo reorder items, include `range_start`, `insert_before`, `range_length` and `snapshot_id` in the request's body.\nTo replace items, include `uris` as either a query parameter or in the request's body.\nReplacing items in a playlist will overwrite its existing items. This operation can be used for replacing or clearing items in a playlist.\n<br/>\n**Note**: Replace and reorder are mutually exclusive operations which share the same endpoint, but have different parameters.\nThese operations can't be applied together in a single request.\n",
      operationId: 'reorder-or-replace-playlists-tracks',
      parameters: [
        {
          $ref: '#/components/parameters/PathPlaylistId',
        },
        {
          in: 'query',
          name: 'uris',
          required: false,
          schema: {
            description:
              'A comma-separated list of [Spotify URIs](/documentation/web-api/concepts/spotify-uris-ids) to set, can be track or episode URIs. For example: `uris=spotify:track:4iV5W9uYEdYUVa79Axb7Rh,spotify:track:1301WleyT98MSxVHPZCA6M,spotify:episode:512ojhOuo1ktJprKbVcKyQ`<br/>A maximum of 100 items can be set in one request.\n',
            title: 'Spotify Track URIs',
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              additionalProperties: true,
              example: {
                insert_before: 3,
                range_length: 2,
                range_start: 1,
              },
              properties: {
                insert_before: {
                  description:
                    'The position where the items should be inserted.<br/>To reorder the items to the end of the playlist, simply set _insert_before_ to the position after the last item.<br/>Examples:<br/>To reorder the first item to the last position in a playlist with 10 items, set _range_start_ to 0, and _insert_before_ to 10.<br/>To reorder the last item in a playlist with 10 items to the start of the playlist, set _range_start_ to 9, and _insert_before_ to 0.\n',
                  type: 'integer',
                },
                range_length: {
                  description:
                    'The amount of items to be reordered. Defaults to 1 if not set.<br/>The range of items to be reordered begins from the _range_start_ position, and includes the _range_length_ subsequent items.<br/>Example:<br/>To move the items at index 9-10 to the start of the playlist, _range_start_ is set to 9, and _range_length_ is set to 2.\n',
                  type: 'integer',
                },
                range_start: {
                  description: 'The position of the first item to be reordered.\n',
                  type: 'integer',
                },
                snapshot_id: {
                  description: "The playlist's snapshot ID against which you want to make the changes.\n",
                  type: 'string',
                },
                uris: {
                  items: {
                    type: 'string',
                  },
                  type: 'array',
                },
              },
              type: 'object',
            },
          },
        },
      },
      responses: {
        '200': {
          $ref: '#/components/responses/PlaylistSnapshotId',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['playlist-modify-public', 'playlist-modify-private'],
        },
      ],
      summary: 'Update Playlist Items\n',
      tags: ['Playlists', 'Tracks'],
      'x-spotify-docs-console-url': '/console/put-playlist-tracks/',
      'x-spotify-docs-endpoint-name': "Reorder or Replace a Playlist's Items",
    },
    'x-spotify-docs-category': 'Playlists',
    'x-spotify-docs-display-name': 'playlist-tracks',
  },
  '/recommendations': {
    get: {
      description:
        'Recommendations are generated based on the available information for a given seed entity and matched against similar artists and tracks. If there is sufficient information about the provided seeds, a list of tracks will be returned together with pool size details.\n\nFor artists and tracks that are very new or obscure there might not be enough data to generate a list of tracks.\n',
      operationId: 'get-recommendations',
      parameters: [
        {
          in: 'query',
          name: 'limit',
          required: false,
          schema: {
            default: 20,
            description:
              'The target size of the list of recommended tracks. For seeds with unusually small pools or when highly restrictive filtering is applied, it may be impossible to generate the requested number of recommended tracks. Debugging information for such cases is available in the response. Default: 20\\. Minimum: 1\\. Maximum: 100.\n',
            example: 10,
            maximum: 100,
            minimum: 1,
            title: 'Limit',
            type: 'integer',
          },
        },
        {
          $ref: '#/components/parameters/QueryMarket',
        },
        {
          in: 'query',
          name: 'seed_artists',
          required: true,
          schema: {
            description:
              'A comma separated list of [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids) for seed artists.  Up to 5 seed values may be provided in any combination of `seed_artists`, `seed_tracks` and `seed_genres`.\n',
            example: '4NHQUGzhtTLFvgF5SZesLK',
            title: 'Spotify Artist ID Seeds',
            type: 'string',
          },
        },
        {
          in: 'query',
          name: 'seed_genres',
          required: true,
          schema: {
            description:
              'A comma separated list of any genres in the set of [available genre seeds](#available-genre-seeds).  Up to 5 seed values may be provided in any combination of `seed_artists`, `seed_tracks` and `seed_genres`.\n',
            example: 'classical,country',
            title: 'Genres Seeds',
            type: 'string',
          },
        },
        {
          in: 'query',
          name: 'seed_tracks',
          required: true,
          schema: {
            description:
              'A comma separated list of [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids) for a seed track.  Up to 5 seed values may be provided in any combination of `seed_artists`, `seed_tracks` and `seed_genres`.\n',
            example: '0c6xIDDpzE81m2q797ordA',
            title: 'Spotify Track ID Seeds',
            type: 'string',
          },
        },
        {
          in: 'query',
          name: 'min_acousticness',
          required: false,
          schema: {
            description:
              'For each tunable track attribute, a hard floor on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `min_tempo=140` would restrict results to only those tracks with a tempo of greater than 140 beats per minute.\n',
            maximum: 1,
            minimum: 0,
            title: 'Min. Acousticness',
            type: 'number',
          },
        },
        {
          in: 'query',
          name: 'max_acousticness',
          required: false,
          schema: {
            description:
              'For each tunable track attribute, a hard ceiling on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `max_instrumentalness=0.35` would filter out most tracks that are likely to be instrumental.\n',
            maximum: 1,
            minimum: 0,
            title: 'Max. Acousticness',
            type: 'number',
          },
        },
        {
          in: 'query',
          name: 'target_acousticness',
          required: false,
          schema: {
            description:
              'For each of the tunable track attributes (below) a target value may be provided. Tracks with the attribute values nearest to the target values will be preferred. For example, you might request `target_energy=0.6` and `target_danceability=0.8`. All target values will be weighed equally in ranking results.\n',
            maximum: 1,
            minimum: 0,
            title: 'Target Acousticness',
            type: 'number',
          },
        },
        {
          in: 'query',
          name: 'min_danceability',
          required: false,
          schema: {
            description:
              'For each tunable track attribute, a hard floor on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `min_tempo=140` would restrict results to only those tracks with a tempo of greater than 140 beats per minute.\n',
            maximum: 1,
            minimum: 0,
            title: 'Min. Danceability',
            type: 'number',
          },
        },
        {
          in: 'query',
          name: 'max_danceability',
          required: false,
          schema: {
            description:
              'For each tunable track attribute, a hard ceiling on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `max_instrumentalness=0.35` would filter out most tracks that are likely to be instrumental.\n',
            maximum: 1,
            minimum: 0,
            title: 'Max. Danceability',
            type: 'number',
          },
        },
        {
          in: 'query',
          name: 'target_danceability',
          required: false,
          schema: {
            description:
              'For each of the tunable track attributes (below) a target value may be provided. Tracks with the attribute values nearest to the target values will be preferred. For example, you might request `target_energy=0.6` and `target_danceability=0.8`. All target values will be weighed equally in ranking results.\n',
            maximum: 1,
            minimum: 0,
            title: 'Target Danceability',
            type: 'number',
          },
        },
        {
          in: 'query',
          name: 'min_duration_ms',
          required: false,
          schema: {
            description:
              'For each tunable track attribute, a hard floor on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `min_tempo=140` would restrict results to only those tracks with a tempo of greater than 140 beats per minute.\n',
            title: 'Min. Duration (ms)',
            type: 'integer',
          },
        },
        {
          in: 'query',
          name: 'max_duration_ms',
          required: false,
          schema: {
            description:
              'For each tunable track attribute, a hard ceiling on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `max_instrumentalness=0.35` would filter out most tracks that are likely to be instrumental.\n',
            title: 'Max. Duration (ms)',
            type: 'integer',
          },
        },
        {
          in: 'query',
          name: 'target_duration_ms',
          required: false,
          schema: {
            description: 'Target duration of the track (ms)',
            title: 'Target Duration (ms)',
            type: 'integer',
          },
        },
        {
          in: 'query',
          name: 'min_energy',
          required: false,
          schema: {
            description:
              'For each tunable track attribute, a hard floor on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `min_tempo=140` would restrict results to only those tracks with a tempo of greater than 140 beats per minute.\n',
            maximum: 1,
            minimum: 0,
            title: 'Min. Energy',
            type: 'number',
          },
        },
        {
          in: 'query',
          name: 'max_energy',
          required: false,
          schema: {
            description:
              'For each tunable track attribute, a hard ceiling on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `max_instrumentalness=0.35` would filter out most tracks that are likely to be instrumental.\n',
            maximum: 1,
            minimum: 0,
            title: 'Max. Energy',
            type: 'number',
          },
        },
        {
          in: 'query',
          name: 'target_energy',
          required: false,
          schema: {
            description:
              'For each of the tunable track attributes (below) a target value may be provided. Tracks with the attribute values nearest to the target values will be preferred. For example, you might request `target_energy=0.6` and `target_danceability=0.8`. All target values will be weighed equally in ranking results.\n',
            maximum: 1,
            minimum: 0,
            title: 'Target Energy',
            type: 'number',
          },
        },
        {
          in: 'query',
          name: 'min_instrumentalness',
          required: false,
          schema: {
            description:
              'For each tunable track attribute, a hard floor on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `min_tempo=140` would restrict results to only those tracks with a tempo of greater than 140 beats per minute.\n',
            maximum: 1,
            minimum: 0,
            title: 'Min. Instrumentalness',
            type: 'number',
          },
        },
        {
          in: 'query',
          name: 'max_instrumentalness',
          required: false,
          schema: {
            description:
              'For each tunable track attribute, a hard ceiling on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `max_instrumentalness=0.35` would filter out most tracks that are likely to be instrumental.\n',
            maximum: 1,
            minimum: 0,
            title: 'Max. Instrumentalness',
            type: 'number',
          },
        },
        {
          in: 'query',
          name: 'target_instrumentalness',
          required: false,
          schema: {
            description:
              'For each of the tunable track attributes (below) a target value may be provided. Tracks with the attribute values nearest to the target values will be preferred. For example, you might request `target_energy=0.6` and `target_danceability=0.8`. All target values will be weighed equally in ranking results.\n',
            maximum: 1,
            minimum: 0,
            title: 'Target Instrumentalness',
            type: 'number',
          },
        },
        {
          in: 'query',
          name: 'min_key',
          required: false,
          schema: {
            description:
              'For each tunable track attribute, a hard floor on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `min_tempo=140` would restrict results to only those tracks with a tempo of greater than 140 beats per minute.\n',
            maximum: 11,
            minimum: 0,
            title: 'Min. Key',
            type: 'integer',
          },
        },
        {
          in: 'query',
          name: 'max_key',
          required: false,
          schema: {
            description:
              'For each tunable track attribute, a hard ceiling on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `max_instrumentalness=0.35` would filter out most tracks that are likely to be instrumental.\n',
            maximum: 11,
            minimum: 0,
            title: 'Max. Key',
            type: 'integer',
          },
        },
        {
          in: 'query',
          name: 'target_key',
          required: false,
          schema: {
            description:
              'For each of the tunable track attributes (below) a target value may be provided. Tracks with the attribute values nearest to the target values will be preferred. For example, you might request `target_energy=0.6` and `target_danceability=0.8`. All target values will be weighed equally in ranking results.\n',
            maximum: 11,
            minimum: 0,
            title: 'Target Key',
            type: 'integer',
          },
        },
        {
          in: 'query',
          name: 'min_liveness',
          required: false,
          schema: {
            description:
              'For each tunable track attribute, a hard floor on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `min_tempo=140` would restrict results to only those tracks with a tempo of greater than 140 beats per minute.\n',
            maximum: 1,
            minimum: 0,
            title: 'Min. Liveness',
            type: 'number',
          },
        },
        {
          in: 'query',
          name: 'max_liveness',
          required: false,
          schema: {
            description:
              'For each tunable track attribute, a hard ceiling on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `max_instrumentalness=0.35` would filter out most tracks that are likely to be instrumental.\n',
            maximum: 1,
            minimum: 0,
            title: 'Max. Liveness',
            type: 'number',
          },
        },
        {
          in: 'query',
          name: 'target_liveness',
          required: false,
          schema: {
            description:
              'For each of the tunable track attributes (below) a target value may be provided. Tracks with the attribute values nearest to the target values will be preferred. For example, you might request `target_energy=0.6` and `target_danceability=0.8`. All target values will be weighed equally in ranking results.\n',
            maximum: 1,
            minimum: 0,
            title: 'Target Liveness',
            type: 'number',
          },
        },
        {
          in: 'query',
          name: 'min_loudness',
          required: false,
          schema: {
            description:
              'For each tunable track attribute, a hard floor on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `min_tempo=140` would restrict results to only those tracks with a tempo of greater than 140 beats per minute.\n',
            title: 'Min. Loudness',
            type: 'number',
          },
        },
        {
          in: 'query',
          name: 'max_loudness',
          required: false,
          schema: {
            description:
              'For each tunable track attribute, a hard ceiling on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `max_instrumentalness=0.35` would filter out most tracks that are likely to be instrumental.\n',
            title: 'Max. Loudness',
            type: 'number',
          },
        },
        {
          in: 'query',
          name: 'target_loudness',
          required: false,
          schema: {
            description:
              'For each of the tunable track attributes (below) a target value may be provided. Tracks with the attribute values nearest to the target values will be preferred. For example, you might request `target_energy=0.6` and `target_danceability=0.8`. All target values will be weighed equally in ranking results.\n',
            title: 'Target Loudness',
            type: 'number',
          },
        },
        {
          in: 'query',
          name: 'min_mode',
          required: false,
          schema: {
            description:
              'For each tunable track attribute, a hard floor on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `min_tempo=140` would restrict results to only those tracks with a tempo of greater than 140 beats per minute.\n',
            maximum: 1,
            minimum: 0,
            title: 'Min. Mode',
            type: 'integer',
          },
        },
        {
          in: 'query',
          name: 'max_mode',
          required: false,
          schema: {
            description:
              'For each tunable track attribute, a hard ceiling on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `max_instrumentalness=0.35` would filter out most tracks that are likely to be instrumental.\n',
            maximum: 1,
            minimum: 0,
            title: 'Max. Mode',
            type: 'integer',
          },
        },
        {
          in: 'query',
          name: 'target_mode',
          required: false,
          schema: {
            description:
              'For each of the tunable track attributes (below) a target value may be provided. Tracks with the attribute values nearest to the target values will be preferred. For example, you might request `target_energy=0.6` and `target_danceability=0.8`. All target values will be weighed equally in ranking results.\n',
            maximum: 1,
            minimum: 0,
            title: 'Target Mode',
            type: 'integer',
          },
        },
        {
          in: 'query',
          name: 'min_popularity',
          required: false,
          schema: {
            description:
              'For each tunable track attribute, a hard floor on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `min_tempo=140` would restrict results to only those tracks with a tempo of greater than 140 beats per minute.\n',
            maximum: 100,
            minimum: 0,
            title: 'Min. Popularity',
            type: 'integer',
          },
        },
        {
          in: 'query',
          name: 'max_popularity',
          required: false,
          schema: {
            description:
              'For each tunable track attribute, a hard ceiling on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `max_instrumentalness=0.35` would filter out most tracks that are likely to be instrumental.\n',
            maximum: 100,
            minimum: 0,
            title: 'Max. Popularity',
            type: 'integer',
          },
        },
        {
          in: 'query',
          name: 'target_popularity',
          required: false,
          schema: {
            description:
              'For each of the tunable track attributes (below) a target value may be provided. Tracks with the attribute values nearest to the target values will be preferred. For example, you might request `target_energy=0.6` and `target_danceability=0.8`. All target values will be weighed equally in ranking results.\n',
            maximum: 100,
            minimum: 0,
            title: 'Target Popularity',
            type: 'integer',
          },
        },
        {
          in: 'query',
          name: 'min_speechiness',
          required: false,
          schema: {
            description:
              'For each tunable track attribute, a hard floor on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `min_tempo=140` would restrict results to only those tracks with a tempo of greater than 140 beats per minute.\n',
            maximum: 1,
            minimum: 0,
            title: 'Min. Speechiness',
            type: 'number',
          },
        },
        {
          in: 'query',
          name: 'max_speechiness',
          required: false,
          schema: {
            description:
              'For each tunable track attribute, a hard ceiling on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `max_instrumentalness=0.35` would filter out most tracks that are likely to be instrumental.\n',
            maximum: 1,
            minimum: 0,
            title: 'Max. Speechiness',
            type: 'number',
          },
        },
        {
          in: 'query',
          name: 'target_speechiness',
          required: false,
          schema: {
            description:
              'For each of the tunable track attributes (below) a target value may be provided. Tracks with the attribute values nearest to the target values will be preferred. For example, you might request `target_energy=0.6` and `target_danceability=0.8`. All target values will be weighed equally in ranking results.\n',
            maximum: 1,
            minimum: 0,
            title: 'Target Speechiness',
            type: 'number',
          },
        },
        {
          in: 'query',
          name: 'min_tempo',
          required: false,
          schema: {
            description:
              'For each tunable track attribute, a hard floor on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `min_tempo=140` would restrict results to only those tracks with a tempo of greater than 140 beats per minute.\n',
            title: 'Min. Tempo',
            type: 'number',
          },
        },
        {
          in: 'query',
          name: 'max_tempo',
          required: false,
          schema: {
            description:
              'For each tunable track attribute, a hard ceiling on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `max_instrumentalness=0.35` would filter out most tracks that are likely to be instrumental.\n',
            title: 'Max. Tempo',
            type: 'number',
          },
        },
        {
          in: 'query',
          name: 'target_tempo',
          required: false,
          schema: {
            description: 'Target tempo (BPM)',
            title: 'Target Tempo',
            type: 'number',
          },
        },
        {
          in: 'query',
          name: 'min_time_signature',
          required: false,
          schema: {
            description:
              'For each tunable track attribute, a hard floor on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `min_tempo=140` would restrict results to only those tracks with a tempo of greater than 140 beats per minute.\n',
            maximum: 11,
            title: 'Min. Time Signature',
            type: 'integer',
          },
        },
        {
          in: 'query',
          name: 'max_time_signature',
          required: false,
          schema: {
            description:
              'For each tunable track attribute, a hard ceiling on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `max_instrumentalness=0.35` would filter out most tracks that are likely to be instrumental.\n',
            title: 'Max. Time Signature',
            type: 'integer',
          },
        },
        {
          in: 'query',
          name: 'target_time_signature',
          required: false,
          schema: {
            description:
              'For each of the tunable track attributes (below) a target value may be provided. Tracks with the attribute values nearest to the target values will be preferred. For example, you might request `target_energy=0.6` and `target_danceability=0.8`. All target values will be weighed equally in ranking results.\n',
            title: 'Target Time Signature',
            type: 'integer',
          },
        },
        {
          in: 'query',
          name: 'min_valence',
          required: false,
          schema: {
            description:
              'For each tunable track attribute, a hard floor on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `min_tempo=140` would restrict results to only those tracks with a tempo of greater than 140 beats per minute.\n',
            maximum: 1,
            minimum: 0,
            title: 'Min. Valence',
            type: 'number',
          },
        },
        {
          in: 'query',
          name: 'max_valence',
          required: false,
          schema: {
            description:
              'For each tunable track attribute, a hard ceiling on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `max_instrumentalness=0.35` would filter out most tracks that are likely to be instrumental.\n',
            maximum: 1,
            minimum: 0,
            title: 'Max. Valence',
            type: 'number',
          },
        },
        {
          in: 'query',
          name: 'target_valence',
          required: false,
          schema: {
            description:
              'For each of the tunable track attributes (below) a target value may be provided. Tracks with the attribute values nearest to the target values will be preferred. For example, you might request `target_energy=0.6` and `target_danceability=0.8`. All target values will be weighed equally in ranking results.\n',
            maximum: 1,
            minimum: 0,
            title: 'Target Valence',
            type: 'number',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/OneRecommendations',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: [],
        },
      ],
      summary: 'Get Recommendations\n',
      tags: ['Tracks'],
      'x-spotify-docs-console-url':
        '/console/get-recommendations/?seed_artists=4NHQUGzhtTLFvgF5SZesLK&amp;seed_tracks=0c6xIDDpzE81m2q797ordA&amp;min_energy=0.4&amp;min_popularity=50&amp;market=US',
      'x-spotify-docs-endpoint-name': 'Get Recommendations',
    },
    'x-spotify-docs-category': 'Browse',
    'x-spotify-docs-display-name': 'recommendations',
  },
  '/recommendations/available-genre-seeds': {
    get: {
      description:
        'Retrieve a list of available genres seed parameter values for [recommendations](/documentation/web-api/reference/get-recommendations).\n',
      operationId: 'get-recommendation-genres',
      responses: {
        '200': {
          $ref: '#/components/responses/ManyGenres',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: [],
        },
      ],
      summary: 'Get Available Genre Seeds\n',
      tags: ['Genres'],
      'x-spotify-docs-console-url': '/console/get-available-genre-seeds/',
      'x-spotify-docs-endpoint-name': 'Get Recommendation Genres',
    },
    'x-spotify-docs-category': 'Browse',
    'x-spotify-docs-display-name': 'available-genre-seeds',
  },
  '/search': {
    get: {
      description:
        'Get Spotify catalog information about albums, artists, playlists, tracks, shows, episodes or audiobooks\nthat match a keyword string.<br />\n**Note: Audiobooks are only available for the US, UK, Ireland, New Zealand and Australia markets.**\n',
      operationId: 'search',
      parameters: [
        {
          in: 'query',
          name: 'q',
          required: true,
          schema: {
            description:
              'Your search query.\n\nYou can narrow down your search using field filters. The available filters are `album`, `artist`, `track`, `year`, `upc`, `tag:hipster`, `tag:new`, `isrc`, and `genre`. Each field filter only applies to certain result types.\n\nThe `artist` and `year` filters can be used while searching albums, artists and tracks. You can filter on a single `year` or a range (e.g. 1955-1960).<br />\nThe `album` filter can be used while searching albums and tracks.<br />\nThe `genre` filter can be used while searching artists and tracks.<br />\nThe `isrc` and `track` filters can be used while searching tracks.<br />\nThe `upc`, `tag:new` and `tag:hipster` filters can only be used while searching albums. The `tag:new` filter will return albums released in the past two weeks and `tag:hipster` can be used to return only albums with the lowest 10% popularity.<br />\n',
            example: 'remaster%20track:Doxy%20artist:Miles%20Davis',
            title: 'Query',
            type: 'string',
          },
        },
        {
          explode: false,
          in: 'query',
          name: 'type',
          required: true,
          schema: {
            description:
              'A comma-separated list of item types to search across. Search results include hits\nfrom all the specified item types. For example: `q=abacab&type=album,track` returns\nboth albums and tracks matching "abacab".\n',
            items: {
              enum: ['album', 'artist', 'playlist', 'track', 'show', 'episode', 'audiobook'],
              type: 'string',
            },
            title: 'Item type',
            type: 'array',
          },
        },
        {
          $ref: '#/components/parameters/QueryMarket',
        },
        {
          in: 'query',
          name: 'limit',
          required: false,
          schema: {
            default: 20,
            description: 'The maximum number of results to return in each item type.\n',
            example: 10,
            maximum: 50,
            minimum: 0,
            title: 'Limit',
            type: 'integer',
          },
        },
        {
          in: 'query',
          name: 'offset',
          required: false,
          schema: {
            default: 0,
            description:
              'The index of the first result to return. Use\nwith limit to get the next page of search results.\n',
            example: 5,
            maximum: 1000,
            minimum: 0,
            title: 'Offset',
            type: 'integer',
          },
        },
        {
          in: 'query',
          name: 'include_external',
          required: false,
          schema: {
            description:
              'If `include_external=audio` is specified it signals that the client can play externally hosted audio content, and marks\nthe content as playable in the response. By default externally hosted audio content is marked as unplayable in the response.\n',
            enum: ['audio'],
            title: 'Include External',
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/SearchItems',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: [],
        },
      ],
      summary: 'Search for Item\n',
      tags: ['Search'],
      'x-spotify-docs-console-url': '/console/get-search-item/?q=tania+bowra&amp;type=artist',
      'x-spotify-docs-endpoint-name': 'Search for an Item',
    },
    'x-spotify-docs-category': 'Search',
    'x-spotify-docs-display-name': 'search-item',
  },
  '/shows': {
    get: {
      description: 'Get Spotify catalog information for several shows based on their Spotify IDs.\n',
      operationId: 'get-multiple-shows',
      parameters: [
        {
          $ref: '#/components/parameters/QueryMarket',
        },
        {
          $ref: '#/components/parameters/QueryShowIds',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/ManySimplifiedShows',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: [],
        },
      ],
      summary: 'Get Several Shows\n',
      tags: ['Shows'],
      'x-spotify-docs-console-url': '/console/get-several-shows/?ids=5CfCWKI5pZ28U0uOzXkDHe,5as3aKmN2k11yfDDDSrvaZ',
      'x-spotify-docs-endpoint-name': 'Get Multiple Shows',
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/metadataPolicyList',
      },
    },
    'x-spotify-docs-category': 'Shows',
    'x-spotify-docs-display-name': 'several-shows',
  },
  '/shows/{id}': {
    get: {
      description: 'Get Spotify catalog information for a single show identified by its\nunique Spotify ID.\n',
      operationId: 'get-a-show',
      parameters: [
        {
          $ref: '#/components/parameters/QueryMarket',
        },
        {
          $ref: '#/components/parameters/PathShowId',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/OneShow',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['user-read-playback-position'],
        },
      ],
      summary: 'Get Show\n',
      tags: ['Shows'],
      'x-spotify-docs-console-url': '/console/get-show/?id=38bS44xjbVVZ3No3ByF1dJ',
      'x-spotify-docs-endpoint-name': 'Get a Show',
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/metadataPolicyList',
      },
    },
    'x-spotify-docs-category': 'Shows',
    'x-spotify-docs-display-name': 'show',
  },
  '/shows/{id}/episodes': {
    get: {
      description:
        'Get Spotify catalog information about an show’s episodes. Optional parameters can be used to limit the number of episodes returned.\n',
      operationId: 'get-a-shows-episodes',
      parameters: [
        {
          $ref: '#/components/parameters/PathShowId',
        },
        {
          $ref: '#/components/parameters/QueryMarket',
        },
        {
          $ref: '#/components/parameters/QueryLimit',
        },
        {
          $ref: '#/components/parameters/QueryOffset',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/PagingSimplifiedEpisodeObject',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['user-read-playback-position'],
        },
      ],
      summary: 'Get Show Episodes\n',
      tags: ['Shows', 'Episodes'],
      'x-spotify-docs-console-url': '/console/get-show-episodes/',
      'x-spotify-docs-endpoint-name': "Get a Show's Episodes",
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/metadataPolicyList',
      },
    },
    'x-spotify-docs-category': 'Shows',
    'x-spotify-docs-display-name': 'show-episodes',
  },
  '/tracks': {
    get: {
      description: 'Get Spotify catalog information for multiple tracks based on their Spotify IDs.\n',
      operationId: 'get-several-tracks',
      parameters: [
        {
          $ref: '#/components/parameters/QueryMarket',
        },
        {
          $ref: '#/components/parameters/QueryTrackIds',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/ManyTracks',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: [],
        },
      ],
      summary: 'Get Several Tracks\n',
      tags: ['Tracks'],
      'x-spotify-docs-console-url': '/console/get-several-tracks/?ids=3n3Ppam7vgaVa1iaRUc9Lp,3twNvmDtFQtAd5gMKedhLD',
      'x-spotify-docs-endpoint-name': 'Get Several Tracks',
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/metadataPolicyList',
      },
    },
    'x-spotify-docs-category': 'Tracks',
    'x-spotify-docs-display-name': 'several-tracks',
  },
  '/tracks/{id}': {
    get: {
      description: 'Get Spotify catalog information for a single track identified by its\nunique Spotify ID.\n',
      operationId: 'get-track',
      parameters: [
        {
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            description: 'The [Spotify ID](/documentation/web-api/concepts/spotify-uris-ids)\nfor the track.\n',
            example: '11dFghVXANMlKmJXsNCbNl',
            title: 'Spotify Track ID',
            type: 'string',
          },
        },
        {
          $ref: '#/components/parameters/QueryMarket',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/OneTrack',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: [],
        },
      ],
      summary: 'Get Track\n',
      tags: ['Tracks'],
      'x-spotify-docs-console-url': '/console/get-track/?id=3n3Ppam7vgaVa1iaRUc9Lp',
      'x-spotify-docs-endpoint-name': 'Get a Track',
      'x-spotify-policy-list': {
        $ref: '#/components/x-spotify-policy/metadataPolicyList',
      },
    },
    'x-spotify-docs-category': 'Tracks',
    'x-spotify-docs-display-name': 'track',
  },
  '/users/{user_id}': {
    get: {
      description: 'Get public profile information about a Spotify user.\n',
      operationId: 'get-users-profile',
      parameters: [
        {
          $ref: '#/components/parameters/PathUserId',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/OnePublicUser',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: [],
        },
      ],
      summary: "Get User's Profile\n",
      tags: ['Users'],
      'x-spotify-docs-console-url': '/console/get-users-profile/?user_id=wizzler',
      'x-spotify-docs-endpoint-name': "Get a User's Profile",
    },
    'x-spotify-docs-category': 'Users Profile',
    'x-spotify-docs-display-name': 'users-profile',
  },
  '/users/{user_id}/playlists': {
    get: {
      description: 'Get a list of the playlists owned or followed by a Spotify user.\n',
      operationId: 'get-list-users-playlists',
      parameters: [
        {
          $ref: '#/components/parameters/PathUserId',
        },
        {
          $ref: '#/components/parameters/QueryLimit',
        },
        {
          in: 'query',
          name: 'offset',
          required: false,
          schema: {
            default: 0,
            description:
              'The index of the first playlist to return. Default:\n0 (the first object). Maximum offset: 100.000\\. Use with `limit` to get the\nnext set of playlists.\n',
            example: 5,
            title: 'Offset',
            type: 'integer',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/PagedPlaylists',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['playlist-read-private', 'playlist-read-collaborative'],
        },
      ],
      summary: "Get User's Playlists\n",
      tags: ['Playlists', 'Users'],
      'x-spotify-docs-console-url': '/console/get-playlists/?user_id=wizzler',
      'x-spotify-docs-endpoint-name': "Get a List of a User's Playlists",
    },
    post: {
      description:
        'Create a playlist for a Spotify user. (The playlist will be empty until\nyou [add tracks](/documentation/web-api/reference/add-tracks-to-playlist).)\n',
      operationId: 'create-playlist',
      parameters: [
        {
          $ref: '#/components/parameters/PathUserId',
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              additionalProperties: true,
              example: {
                description: 'New playlist description',
                name: 'New Playlist',
                public: false,
              },
              properties: {
                collaborative: {
                  description:
                    'Defaults to `false`. If `true` the playlist will be collaborative. _**Note**: to create a collaborative playlist you must also set `public` to `false`. To create collaborative playlists you must have granted `playlist-modify-private` and `playlist-modify-public` [scopes](/documentation/web-api/concepts/scopes/#list-of-scopes)._\n',
                  type: 'boolean',
                },
                description: {
                  description: 'value for playlist description as displayed in Spotify Clients and in the Web API.\n',
                  type: 'string',
                },
                name: {
                  description:
                    'The name for the new playlist, for example `"Your Coolest Playlist"`. This name does not need to be unique; a user may have several playlists with the same name.\n',
                  type: 'string',
                },
                public: {
                  description:
                    'Defaults to `true`. If `true` the playlist will be public, if `false` it will be private. To be able to create private playlists, the user must have granted the `playlist-modify-private` [scope](/documentation/web-api/concepts/scopes/#list-of-scopes)\n',
                  type: 'boolean',
                },
              },
              required: ['name'],
              type: 'object',
            },
          },
        },
      },
      responses: {
        '201': {
          $ref: '#/components/responses/OnePlaylist',
        },
        '401': {
          $ref: '#/components/responses/Unauthorized',
        },
        '403': {
          $ref: '#/components/responses/Forbidden',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequests',
        },
      },
      security: [
        {
          oauth_2_0: ['playlist-modify-public', 'playlist-modify-private'],
        },
      ],
      summary: 'Create Playlist\n',
      tags: ['Playlists', 'Library'],
      'x-spotify-docs-console-url': '/console/post-playlists/',
      'x-spotify-docs-endpoint-name': 'Create a Playlist',
    },
    'x-spotify-docs-category': 'Playlists',
    'x-spotify-docs-display-name': 'playlists',
  },
} as TPaths;
