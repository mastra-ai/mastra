import type { ScavioClientOptions } from './client.js';
import { createScavioAmazonProductTool, createScavioAmazonSearchTool } from './amazon.js';
import { createScavioGoogleSearchTool } from './google.js';
import { createScavioInstagramProfileTool, createScavioInstagramSearchTool } from './instagram.js';
import { createScavioRedditPostTool, createScavioRedditSearchTool } from './reddit.js';
import { createScavioTiktokProfileTool, createScavioTiktokSearchTool } from './tiktok.js';
import { createScavioWalmartProductTool, createScavioWalmartSearchTool } from './walmart.js';
import { createScavioYoutubeMetadataTool, createScavioYoutubeSearchTool } from './youtube.js';

export function createScavioTools(config?: ScavioClientOptions) {
  return {
    scavioGoogleSearch: createScavioGoogleSearchTool(config),
    scavioAmazonSearch: createScavioAmazonSearchTool(config),
    scavioAmazonProduct: createScavioAmazonProductTool(config),
    scavioWalmartSearch: createScavioWalmartSearchTool(config),
    scavioWalmartProduct: createScavioWalmartProductTool(config),
    scavioYoutubeSearch: createScavioYoutubeSearchTool(config),
    scavioYoutubeMetadata: createScavioYoutubeMetadataTool(config),
    scavioRedditSearch: createScavioRedditSearchTool(config),
    scavioRedditPost: createScavioRedditPostTool(config),
    scavioTiktokSearch: createScavioTiktokSearchTool(config),
    scavioTiktokProfile: createScavioTiktokProfileTool(config),
    scavioInstagramSearch: createScavioInstagramSearchTool(config),
    scavioInstagramProfile: createScavioInstagramProfileTool(config),
  };
}
