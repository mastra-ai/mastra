// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyToolFilter } from '../../toolset.js';
import { createAdGroupAdTool } from './tools/create-ad-group-ad.js';
import { createAdGroupTool } from './tools/create-ad-group.js';
import { createCampaignBudgetTool } from './tools/create-campaign-budget.js';
import { createCampaignLocationCriterionTool } from './tools/create-campaign-location-criterion.js';
import { createCampaignNegativeKeywordTool } from './tools/create-campaign-negative-keyword.js';
import { createCampaignTool } from './tools/create-campaign.js';
import { createConversionActionTool } from './tools/create-conversion-action.js';
import { createKeywordCriterionTool } from './tools/create-keyword-criterion.js';
import { createNegativeKeywordTool } from './tools/create-negative-keyword.js';
import { generateKeywordIdeasTool } from './tools/generate-keyword-ideas.js';
import { listAccessibleCustomersTool } from './tools/list-accessible-customers.js';
import { removeAdGroupAdTool } from './tools/remove-ad-group-ad.js';
import { removeAdGroupTool } from './tools/remove-ad-group.js';
import { removeCampaignBudgetTool } from './tools/remove-campaign-budget.js';
import { removeCampaignCriterionTool } from './tools/remove-campaign-criterion.js';
import { removeCampaignTool } from './tools/remove-campaign.js';
import { removeConversionActionTool } from './tools/remove-conversion-action.js';
import { removeKeywordCriterionTool } from './tools/remove-keyword-criterion.js';
import { searchGoogleAdsTool } from './tools/search-google-ads.js';
import { searchStreamGoogleAdsTool } from './tools/search-stream-google-ads.js';
import { suggestGeoTargetConstantsTool } from './tools/suggest-geo-target-constants.js';
import { updateAdGroupAdTool } from './tools/update-ad-group-ad.js';
import { updateAdGroupTool } from './tools/update-ad-group.js';
import { updateCampaignBudgetTool } from './tools/update-campaign-budget.js';
import { updateCampaignTool } from './tools/update-campaign.js';
import { updateConversionActionTool } from './tools/update-conversion-action.js';
import { updateKeywordCriterionTool } from './tools/update-keyword-criterion.js';
import { validateGoogleAdsMutateTool } from './tools/validate-google-ads-mutate.js';

export function createGoogleAdsTools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
    google_ads_create_ad_group_ad: createAdGroupAdTool(platformProxy),
    google_ads_create_ad_group: createAdGroupTool(platformProxy),
    google_ads_create_campaign_budget: createCampaignBudgetTool(platformProxy),
    google_ads_create_campaign_location_criterion: createCampaignLocationCriterionTool(platformProxy),
    google_ads_create_campaign_negative_keyword: createCampaignNegativeKeywordTool(platformProxy),
    google_ads_create_campaign: createCampaignTool(platformProxy),
    google_ads_create_conversion_action: createConversionActionTool(platformProxy),
    google_ads_create_keyword_criterion: createKeywordCriterionTool(platformProxy),
    google_ads_create_negative_keyword: createNegativeKeywordTool(platformProxy),
    google_ads_generate_keyword_ideas: generateKeywordIdeasTool(platformProxy),
    google_ads_list_accessible_customers: listAccessibleCustomersTool(platformProxy),
    google_ads_remove_ad_group_ad: removeAdGroupAdTool(platformProxy),
    google_ads_remove_ad_group: removeAdGroupTool(platformProxy),
    google_ads_remove_campaign_budget: removeCampaignBudgetTool(platformProxy),
    google_ads_remove_campaign_criterion: removeCampaignCriterionTool(platformProxy),
    google_ads_remove_campaign: removeCampaignTool(platformProxy),
    google_ads_remove_conversion_action: removeConversionActionTool(platformProxy),
    google_ads_remove_keyword_criterion: removeKeywordCriterionTool(platformProxy),
    google_ads_search_google_ads: searchGoogleAdsTool(platformProxy),
    google_ads_search_stream_google_ads: searchStreamGoogleAdsTool(platformProxy),
    google_ads_suggest_geo_target_constants: suggestGeoTargetConstantsTool(platformProxy),
    google_ads_update_ad_group_ad: updateAdGroupAdTool(platformProxy),
    google_ads_update_ad_group: updateAdGroupTool(platformProxy),
    google_ads_update_campaign_budget: updateCampaignBudgetTool(platformProxy),
    google_ads_update_campaign: updateCampaignTool(platformProxy),
    google_ads_update_conversion_action: updateConversionActionTool(platformProxy),
    google_ads_update_keyword_criterion: updateKeywordCriterionTool(platformProxy),
    google_ads_validate_google_ads_mutate: validateGoogleAdsMutateTool(platformProxy),
  };
  return applyToolFilter(tools, { allowTools: options?.allowTools, disallowTools: options?.disallowTools });
}
