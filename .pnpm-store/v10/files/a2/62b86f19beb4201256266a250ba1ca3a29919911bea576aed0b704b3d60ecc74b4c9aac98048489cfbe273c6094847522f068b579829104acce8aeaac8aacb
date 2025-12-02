// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import * as ZarazAPI from './zaraz';

export class Config extends APIResource {
  /**
   * Updates Zaraz configuration for a zone.
   *
   * @example
   * ```ts
   * const configuration = await client.zaraz.config.update({
   *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *   dataLayer: true,
   *   debugKey: 'debugKey',
   *   settings: { autoInjectScript: true },
   *   tools: {
   *     foo: { ... },
   *   },
   *   triggers: {
   *     foo: { ... },
   *   },
   *   variables: {
   *     foo: { ... },
   *   },
   *   zarazVersion: 0,
   * });
   * ```
   */
  update(params: ConfigUpdateParams, options?: Core.RequestOptions): Core.APIPromise<Configuration> {
    const { zone_id, ...body } = params;
    return (
      this._client.put(`/zones/${zone_id}/settings/zaraz/config`, { body, ...options }) as Core.APIPromise<{
        result: Configuration;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Gets latest Zaraz configuration for a zone. It can be preview or published
   * configuration, whichever was the last updated. Secret variables values will not
   * be included.
   *
   * @example
   * ```ts
   * const configuration = await client.zaraz.config.get({
   *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   * });
   * ```
   */
  get(params: ConfigGetParams, options?: Core.RequestOptions): Core.APIPromise<Configuration> {
    const { zone_id } = params;
    return (
      this._client.get(`/zones/${zone_id}/settings/zaraz/config`, options) as Core.APIPromise<{
        result: Configuration;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

/**
 * Zaraz configuration
 */
export interface Configuration {
  /**
   * Data layer compatibility mode enabled.
   */
  dataLayer: boolean;

  /**
   * The key for Zaraz debug mode.
   */
  debugKey: string;

  /**
   * General Zaraz settings.
   */
  settings: Configuration.Settings;

  /**
   * Tools set up under Zaraz configuration, where key is the alpha-numeric tool ID
   * and value is the tool configuration object.
   */
  tools: { [key: string]: Configuration.ZarazManagedComponent | Configuration.Worker };

  /**
   * Triggers set up under Zaraz configuration, where key is the trigger
   * alpha-numeric ID and value is the trigger configuration.
   */
  triggers: { [key: string]: Configuration.Triggers };

  /**
   * Variables set up under Zaraz configuration, where key is the variable
   * alpha-numeric ID and value is the variable configuration. Values of variables of
   * type secret are not included.
   */
  variables: {
    [key: string]:
      | Configuration.ZarazStringVariable
      | Configuration.ZarazSecretVariable
      | Configuration.ZarazWorkerVariable;
  };

  /**
   * Zaraz internal version of the config.
   */
  zarazVersion: number;

  /**
   * Cloudflare Monitoring settings.
   */
  analytics?: Configuration.Analytics;

  /**
   * Consent management configuration.
   */
  consent?: Configuration.Consent;

  /**
   * Single Page Application support enabled.
   */
  historyChange?: boolean;
}

export namespace Configuration {
  /**
   * General Zaraz settings.
   */
  export interface Settings {
    /**
     * Automatic injection of Zaraz scripts enabled.
     */
    autoInjectScript: boolean;

    /**
     * Details of the worker that receives and edits Zaraz Context object.
     */
    contextEnricher?: Settings.ContextEnricher;

    /**
     * The domain Zaraz will use for writing and reading its cookies.
     */
    cookieDomain?: string;

    /**
     * Ecommerce API enabled.
     */
    ecommerce?: boolean;

    /**
     * Custom endpoint for server-side track events.
     */
    eventsApiPath?: string;

    /**
     * Hiding external referrer URL enabled.
     */
    hideExternalReferer?: boolean;

    /**
     * Trimming IP address enabled.
     */
    hideIPAddress?: boolean;

    /**
     * Removing URL query params enabled.
     */
    hideQueryParams?: boolean;

    /**
     * Removing sensitive data from User Aagent string enabled.
     */
    hideUserAgent?: boolean;

    /**
     * Custom endpoint for Zaraz init script.
     */
    initPath?: string;

    /**
     * Injection of Zaraz scripts into iframes enabled.
     */
    injectIframes?: boolean;

    /**
     * Custom path for Managed Components server functionalities.
     */
    mcRootPath?: string;

    /**
     * Custom endpoint for Zaraz main script.
     */
    scriptPath?: string;

    /**
     * Custom endpoint for Zaraz tracking requests.
     */
    trackPath?: string;
  }

  export namespace Settings {
    /**
     * Details of the worker that receives and edits Zaraz Context object.
     */
    export interface ContextEnricher {
      escapedWorkerName: string;

      workerTag: string;
    }
  }

  export interface ZarazManagedComponent {
    /**
     * List of blocking trigger IDs
     */
    blockingTriggers: Array<string>;

    /**
     * Tool's internal name
     */
    component: string;

    /**
     * Default fields for tool's actions
     */
    defaultFields: { [key: string]: string | boolean };

    /**
     * Whether tool is enabled
     */
    enabled: boolean;

    /**
     * Tool's name defined by the user
     */
    name: string;

    /**
     * List of permissions granted to the component
     */
    permissions: Array<string>;

    /**
     * Tool's settings
     */
    settings: { [key: string]: string | boolean };

    type: 'component';

    /**
     * Actions configured on a tool. Either this or neoEvents field is required.
     */
    actions?: { [key: string]: ZarazAPI.NeoEvent };

    /**
     * Default consent purpose ID
     */
    defaultPurpose?: string;

    /**
     * DEPRECATED - List of actions configured on a tool. Either this or actions field
     * is required. If both are present, actions field will take precedence.
     */
    neoEvents?: Array<ZarazAPI.NeoEvent>;

    /**
     * Vendor name for TCF compliant consent modal, required for Custom Managed
     * Components and Custom HTML tool with a defaultPurpose assigned
     */
    vendorName?: string;

    /**
     * Vendor's Privacy Policy URL for TCF compliant consent modal, required for Custom
     * Managed Components and Custom HTML tool with a defaultPurpose assigned
     */
    vendorPolicyUrl?: string;
  }

  export interface Worker {
    /**
     * List of blocking trigger IDs
     */
    blockingTriggers: Array<string>;

    /**
     * Tool's internal name
     */
    component: string;

    /**
     * Default fields for tool's actions
     */
    defaultFields: { [key: string]: string | boolean };

    /**
     * Whether tool is enabled
     */
    enabled: boolean;

    /**
     * Tool's name defined by the user
     */
    name: string;

    /**
     * List of permissions granted to the component
     */
    permissions: Array<string>;

    /**
     * Tool's settings
     */
    settings: { [key: string]: string | boolean };

    type: 'custom-mc';

    /**
     * Cloudflare worker that acts as a managed component
     */
    worker: Worker.Worker;

    /**
     * Actions configured on a tool. Either this or neoEvents field is required.
     */
    actions?: { [key: string]: ZarazAPI.NeoEvent };

    /**
     * Default consent purpose ID
     */
    defaultPurpose?: string;

    /**
     * DEPRECATED - List of actions configured on a tool. Either this or actions field
     * is required. If both are present, actions field will take precedence.
     */
    neoEvents?: Array<ZarazAPI.NeoEvent>;

    /**
     * Vendor name for TCF compliant consent modal, required for Custom Managed
     * Components and Custom HTML tool with a defaultPurpose assigned
     */
    vendorName?: string;

    /**
     * Vendor's Privacy Policy URL for TCF compliant consent modal, required for Custom
     * Managed Components and Custom HTML tool with a defaultPurpose assigned
     */
    vendorPolicyUrl?: string;
  }

  export namespace Worker {
    /**
     * Cloudflare worker that acts as a managed component
     */
    export interface Worker {
      escapedWorkerName: string;

      workerTag: string;
    }
  }

  export interface Triggers {
    /**
     * Rules defining when the trigger is not fired.
     */
    excludeRules: Array<
      | Triggers.ZarazLoadRule
      | Triggers.ZarazClickListenerRule
      | Triggers.ZarazTimerRule
      | Triggers.ZarazFormSubmissionRule
      | Triggers.ZarazVariableMatchRule
      | Triggers.ZarazScrollDepthRule
      | Triggers.ZarazElementVisibilityRule
    >;

    /**
     * Rules defining when the trigger is fired.
     */
    loadRules: Array<
      | Triggers.ZarazLoadRule
      | Triggers.ZarazClickListenerRule
      | Triggers.ZarazTimerRule
      | Triggers.ZarazFormSubmissionRule
      | Triggers.ZarazVariableMatchRule
      | Triggers.ZarazScrollDepthRule
      | Triggers.ZarazElementVisibilityRule
    >;

    /**
     * Trigger name.
     */
    name: string;

    /**
     * Trigger description.
     */
    description?: string;

    system?: 'pageload';
  }

  export namespace Triggers {
    export interface ZarazLoadRule {
      id: string;

      match: string;

      op:
        | 'CONTAINS'
        | 'EQUALS'
        | 'STARTS_WITH'
        | 'ENDS_WITH'
        | 'MATCH_REGEX'
        | 'NOT_MATCH_REGEX'
        | 'GREATER_THAN'
        | 'GREATER_THAN_OR_EQUAL'
        | 'LESS_THAN'
        | 'LESS_THAN_OR_EQUAL';

      value: string;
    }

    export interface ZarazClickListenerRule {
      id: string;

      action: 'clickListener';

      settings: ZarazClickListenerRule.Settings;
    }

    export namespace ZarazClickListenerRule {
      export interface Settings {
        selector: string;

        type: 'xpath' | 'css';

        waitForTags: number;
      }
    }

    export interface ZarazTimerRule {
      id: string;

      action: 'timer';

      settings: ZarazTimerRule.Settings;
    }

    export namespace ZarazTimerRule {
      export interface Settings {
        interval: number;

        limit: number;
      }
    }

    export interface ZarazFormSubmissionRule {
      id: string;

      action: 'formSubmission';

      settings: ZarazFormSubmissionRule.Settings;
    }

    export namespace ZarazFormSubmissionRule {
      export interface Settings {
        selector: string;

        validate: boolean;
      }
    }

    export interface ZarazVariableMatchRule {
      id: string;

      action: 'variableMatch';

      settings: ZarazVariableMatchRule.Settings;
    }

    export namespace ZarazVariableMatchRule {
      export interface Settings {
        match: string;

        variable: string;
      }
    }

    export interface ZarazScrollDepthRule {
      id: string;

      action: 'scrollDepth';

      settings: ZarazScrollDepthRule.Settings;
    }

    export namespace ZarazScrollDepthRule {
      export interface Settings {
        positions: string;
      }
    }

    export interface ZarazElementVisibilityRule {
      id: string;

      action: 'elementVisibility';

      settings: ZarazElementVisibilityRule.Settings;
    }

    export namespace ZarazElementVisibilityRule {
      export interface Settings {
        selector: string;
      }
    }

    export interface ZarazLoadRule {
      id: string;

      match: string;

      op:
        | 'CONTAINS'
        | 'EQUALS'
        | 'STARTS_WITH'
        | 'ENDS_WITH'
        | 'MATCH_REGEX'
        | 'NOT_MATCH_REGEX'
        | 'GREATER_THAN'
        | 'GREATER_THAN_OR_EQUAL'
        | 'LESS_THAN'
        | 'LESS_THAN_OR_EQUAL';

      value: string;
    }

    export interface ZarazClickListenerRule {
      id: string;

      action: 'clickListener';

      settings: ZarazClickListenerRule.Settings;
    }

    export namespace ZarazClickListenerRule {
      export interface Settings {
        selector: string;

        type: 'xpath' | 'css';

        waitForTags: number;
      }
    }

    export interface ZarazTimerRule {
      id: string;

      action: 'timer';

      settings: ZarazTimerRule.Settings;
    }

    export namespace ZarazTimerRule {
      export interface Settings {
        interval: number;

        limit: number;
      }
    }

    export interface ZarazFormSubmissionRule {
      id: string;

      action: 'formSubmission';

      settings: ZarazFormSubmissionRule.Settings;
    }

    export namespace ZarazFormSubmissionRule {
      export interface Settings {
        selector: string;

        validate: boolean;
      }
    }

    export interface ZarazVariableMatchRule {
      id: string;

      action: 'variableMatch';

      settings: ZarazVariableMatchRule.Settings;
    }

    export namespace ZarazVariableMatchRule {
      export interface Settings {
        match: string;

        variable: string;
      }
    }

    export interface ZarazScrollDepthRule {
      id: string;

      action: 'scrollDepth';

      settings: ZarazScrollDepthRule.Settings;
    }

    export namespace ZarazScrollDepthRule {
      export interface Settings {
        positions: string;
      }
    }

    export interface ZarazElementVisibilityRule {
      id: string;

      action: 'elementVisibility';

      settings: ZarazElementVisibilityRule.Settings;
    }

    export namespace ZarazElementVisibilityRule {
      export interface Settings {
        selector: string;
      }
    }
  }

  export interface ZarazStringVariable {
    name: string;

    type: 'string';

    value: string;
  }

  export interface ZarazSecretVariable {
    name: string;

    type: 'secret';

    value: string;
  }

  export interface ZarazWorkerVariable {
    name: string;

    type: 'worker';

    value: ZarazWorkerVariable.Value;
  }

  export namespace ZarazWorkerVariable {
    export interface Value {
      escapedWorkerName: string;

      workerTag: string;
    }
  }

  /**
   * Cloudflare Monitoring settings.
   */
  export interface Analytics {
    /**
     * Consent purpose assigned to Monitoring.
     */
    defaultPurpose?: string;

    /**
     * Whether Advanced Monitoring reports are enabled.
     */
    enabled?: boolean;

    /**
     * Session expiration time (seconds).
     */
    sessionExpTime?: number;
  }

  /**
   * Consent management configuration.
   */
  export interface Consent {
    enabled: boolean;

    buttonTextTranslations?: ZarazAPI.ButtonTextTranslation;

    companyEmail?: string;

    companyName?: string;

    companyStreetAddress?: string;

    consentModalIntroHTML?: string;

    /**
     * Object where keys are language codes
     */
    consentModalIntroHTMLWithTranslations?: { [key: string]: string };

    cookieName?: string;

    customCSS?: string;

    customIntroDisclaimerDismissed?: boolean;

    defaultLanguage?: string;

    hideModal?: boolean;

    /**
     * Object where keys are purpose alpha-numeric IDs
     */
    purposes?: { [key: string]: Consent.Purposes };

    /**
     * Object where keys are purpose alpha-numeric IDs
     */
    purposesWithTranslations?: { [key: string]: Consent.PurposesWithTranslations };

    tcfCompliant?: boolean;
  }

  export namespace Consent {
    export interface Purposes {
      description: string;

      name: string;
    }

    export interface PurposesWithTranslations {
      /**
       * Object where keys are language codes
       */
      description: { [key: string]: string };

      /**
       * Object where keys are language codes
       */
      name: { [key: string]: string };

      order: number;
    }
  }
}

export interface ConfigUpdateParams {
  /**
   * Path param: Identifier.
   */
  zone_id: string;

  /**
   * Body param: Data layer compatibility mode enabled.
   */
  dataLayer: boolean;

  /**
   * Body param: The key for Zaraz debug mode.
   */
  debugKey: string;

  /**
   * Body param: General Zaraz settings.
   */
  settings: ConfigUpdateParams.Settings;

  /**
   * Body param: Tools set up under Zaraz configuration, where key is the
   * alpha-numeric tool ID and value is the tool configuration object.
   */
  tools: { [key: string]: ConfigUpdateParams.ZarazManagedComponent | ConfigUpdateParams.Worker };

  /**
   * Body param: Triggers set up under Zaraz configuration, where key is the trigger
   * alpha-numeric ID and value is the trigger configuration.
   */
  triggers: { [key: string]: ConfigUpdateParams.Triggers };

  /**
   * Body param: Variables set up under Zaraz configuration, where key is the
   * variable alpha-numeric ID and value is the variable configuration. Values of
   * variables of type secret are not included.
   */
  variables: {
    [key: string]:
      | ConfigUpdateParams.ZarazStringVariable
      | ConfigUpdateParams.ZarazSecretVariable
      | ConfigUpdateParams.ZarazWorkerVariable;
  };

  /**
   * Body param: Zaraz internal version of the config.
   */
  zarazVersion: number;

  /**
   * Body param: Cloudflare Monitoring settings.
   */
  analytics?: ConfigUpdateParams.Analytics;

  /**
   * Body param: Consent management configuration.
   */
  consent?: ConfigUpdateParams.Consent;

  /**
   * Body param: Single Page Application support enabled.
   */
  historyChange?: boolean;
}

export namespace ConfigUpdateParams {
  /**
   * General Zaraz settings.
   */
  export interface Settings {
    /**
     * Automatic injection of Zaraz scripts enabled.
     */
    autoInjectScript: boolean;

    /**
     * Details of the worker that receives and edits Zaraz Context object.
     */
    contextEnricher?: Settings.ContextEnricher;

    /**
     * The domain Zaraz will use for writing and reading its cookies.
     */
    cookieDomain?: string;

    /**
     * Ecommerce API enabled.
     */
    ecommerce?: boolean;

    /**
     * Custom endpoint for server-side track events.
     */
    eventsApiPath?: string;

    /**
     * Hiding external referrer URL enabled.
     */
    hideExternalReferer?: boolean;

    /**
     * Trimming IP address enabled.
     */
    hideIPAddress?: boolean;

    /**
     * Removing URL query params enabled.
     */
    hideQueryParams?: boolean;

    /**
     * Removing sensitive data from User Aagent string enabled.
     */
    hideUserAgent?: boolean;

    /**
     * Custom endpoint for Zaraz init script.
     */
    initPath?: string;

    /**
     * Injection of Zaraz scripts into iframes enabled.
     */
    injectIframes?: boolean;

    /**
     * Custom path for Managed Components server functionalities.
     */
    mcRootPath?: string;

    /**
     * Custom endpoint for Zaraz main script.
     */
    scriptPath?: string;

    /**
     * Custom endpoint for Zaraz tracking requests.
     */
    trackPath?: string;
  }

  export namespace Settings {
    /**
     * Details of the worker that receives and edits Zaraz Context object.
     */
    export interface ContextEnricher {
      escapedWorkerName: string;

      workerTag: string;
    }
  }

  export interface ZarazManagedComponent {
    /**
     * List of blocking trigger IDs
     */
    blockingTriggers: Array<string>;

    /**
     * Tool's internal name
     */
    component: string;

    /**
     * Default fields for tool's actions
     */
    defaultFields: { [key: string]: string | boolean };

    /**
     * Whether tool is enabled
     */
    enabled: boolean;

    /**
     * Tool's name defined by the user
     */
    name: string;

    /**
     * List of permissions granted to the component
     */
    permissions: Array<string>;

    /**
     * Tool's settings
     */
    settings: { [key: string]: string | boolean };

    type: 'component';

    /**
     * Actions configured on a tool. Either this or neoEvents field is required.
     */
    actions?: { [key: string]: ZarazAPI.NeoEventParam };

    /**
     * Default consent purpose ID
     */
    defaultPurpose?: string;

    /**
     * DEPRECATED - List of actions configured on a tool. Either this or actions field
     * is required. If both are present, actions field will take precedence.
     */
    neoEvents?: Array<ZarazAPI.NeoEventParam>;

    /**
     * Vendor name for TCF compliant consent modal, required for Custom Managed
     * Components and Custom HTML tool with a defaultPurpose assigned
     */
    vendorName?: string;

    /**
     * Vendor's Privacy Policy URL for TCF compliant consent modal, required for Custom
     * Managed Components and Custom HTML tool with a defaultPurpose assigned
     */
    vendorPolicyUrl?: string;
  }

  export interface Worker {
    /**
     * List of blocking trigger IDs
     */
    blockingTriggers: Array<string>;

    /**
     * Tool's internal name
     */
    component: string;

    /**
     * Default fields for tool's actions
     */
    defaultFields: { [key: string]: string | boolean };

    /**
     * Whether tool is enabled
     */
    enabled: boolean;

    /**
     * Tool's name defined by the user
     */
    name: string;

    /**
     * List of permissions granted to the component
     */
    permissions: Array<string>;

    /**
     * Tool's settings
     */
    settings: { [key: string]: string | boolean };

    type: 'custom-mc';

    /**
     * Cloudflare worker that acts as a managed component
     */
    worker: Worker.Worker;

    /**
     * Actions configured on a tool. Either this or neoEvents field is required.
     */
    actions?: { [key: string]: ZarazAPI.NeoEventParam };

    /**
     * Default consent purpose ID
     */
    defaultPurpose?: string;

    /**
     * DEPRECATED - List of actions configured on a tool. Either this or actions field
     * is required. If both are present, actions field will take precedence.
     */
    neoEvents?: Array<ZarazAPI.NeoEventParam>;

    /**
     * Vendor name for TCF compliant consent modal, required for Custom Managed
     * Components and Custom HTML tool with a defaultPurpose assigned
     */
    vendorName?: string;

    /**
     * Vendor's Privacy Policy URL for TCF compliant consent modal, required for Custom
     * Managed Components and Custom HTML tool with a defaultPurpose assigned
     */
    vendorPolicyUrl?: string;
  }

  export namespace Worker {
    /**
     * Cloudflare worker that acts as a managed component
     */
    export interface Worker {
      escapedWorkerName: string;

      workerTag: string;
    }
  }

  export interface Triggers {
    /**
     * Rules defining when the trigger is not fired.
     */
    excludeRules: Array<
      | Triggers.ZarazLoadRule
      | Triggers.ZarazClickListenerRule
      | Triggers.ZarazTimerRule
      | Triggers.ZarazFormSubmissionRule
      | Triggers.ZarazVariableMatchRule
      | Triggers.ZarazScrollDepthRule
      | Triggers.ZarazElementVisibilityRule
    >;

    /**
     * Rules defining when the trigger is fired.
     */
    loadRules: Array<
      | Triggers.ZarazLoadRule
      | Triggers.ZarazClickListenerRule
      | Triggers.ZarazTimerRule
      | Triggers.ZarazFormSubmissionRule
      | Triggers.ZarazVariableMatchRule
      | Triggers.ZarazScrollDepthRule
      | Triggers.ZarazElementVisibilityRule
    >;

    /**
     * Trigger name.
     */
    name: string;

    /**
     * Trigger description.
     */
    description?: string;

    system?: 'pageload';
  }

  export namespace Triggers {
    export interface ZarazLoadRule {
      id: string;

      match: string;

      op:
        | 'CONTAINS'
        | 'EQUALS'
        | 'STARTS_WITH'
        | 'ENDS_WITH'
        | 'MATCH_REGEX'
        | 'NOT_MATCH_REGEX'
        | 'GREATER_THAN'
        | 'GREATER_THAN_OR_EQUAL'
        | 'LESS_THAN'
        | 'LESS_THAN_OR_EQUAL';

      value: string;
    }

    export interface ZarazClickListenerRule {
      id: string;

      action: 'clickListener';

      settings: ZarazClickListenerRule.Settings;
    }

    export namespace ZarazClickListenerRule {
      export interface Settings {
        selector: string;

        type: 'xpath' | 'css';

        waitForTags: number;
      }
    }

    export interface ZarazTimerRule {
      id: string;

      action: 'timer';

      settings: ZarazTimerRule.Settings;
    }

    export namespace ZarazTimerRule {
      export interface Settings {
        interval: number;

        limit: number;
      }
    }

    export interface ZarazFormSubmissionRule {
      id: string;

      action: 'formSubmission';

      settings: ZarazFormSubmissionRule.Settings;
    }

    export namespace ZarazFormSubmissionRule {
      export interface Settings {
        selector: string;

        validate: boolean;
      }
    }

    export interface ZarazVariableMatchRule {
      id: string;

      action: 'variableMatch';

      settings: ZarazVariableMatchRule.Settings;
    }

    export namespace ZarazVariableMatchRule {
      export interface Settings {
        match: string;

        variable: string;
      }
    }

    export interface ZarazScrollDepthRule {
      id: string;

      action: 'scrollDepth';

      settings: ZarazScrollDepthRule.Settings;
    }

    export namespace ZarazScrollDepthRule {
      export interface Settings {
        positions: string;
      }
    }

    export interface ZarazElementVisibilityRule {
      id: string;

      action: 'elementVisibility';

      settings: ZarazElementVisibilityRule.Settings;
    }

    export namespace ZarazElementVisibilityRule {
      export interface Settings {
        selector: string;
      }
    }

    export interface ZarazLoadRule {
      id: string;

      match: string;

      op:
        | 'CONTAINS'
        | 'EQUALS'
        | 'STARTS_WITH'
        | 'ENDS_WITH'
        | 'MATCH_REGEX'
        | 'NOT_MATCH_REGEX'
        | 'GREATER_THAN'
        | 'GREATER_THAN_OR_EQUAL'
        | 'LESS_THAN'
        | 'LESS_THAN_OR_EQUAL';

      value: string;
    }

    export interface ZarazClickListenerRule {
      id: string;

      action: 'clickListener';

      settings: ZarazClickListenerRule.Settings;
    }

    export namespace ZarazClickListenerRule {
      export interface Settings {
        selector: string;

        type: 'xpath' | 'css';

        waitForTags: number;
      }
    }

    export interface ZarazTimerRule {
      id: string;

      action: 'timer';

      settings: ZarazTimerRule.Settings;
    }

    export namespace ZarazTimerRule {
      export interface Settings {
        interval: number;

        limit: number;
      }
    }

    export interface ZarazFormSubmissionRule {
      id: string;

      action: 'formSubmission';

      settings: ZarazFormSubmissionRule.Settings;
    }

    export namespace ZarazFormSubmissionRule {
      export interface Settings {
        selector: string;

        validate: boolean;
      }
    }

    export interface ZarazVariableMatchRule {
      id: string;

      action: 'variableMatch';

      settings: ZarazVariableMatchRule.Settings;
    }

    export namespace ZarazVariableMatchRule {
      export interface Settings {
        match: string;

        variable: string;
      }
    }

    export interface ZarazScrollDepthRule {
      id: string;

      action: 'scrollDepth';

      settings: ZarazScrollDepthRule.Settings;
    }

    export namespace ZarazScrollDepthRule {
      export interface Settings {
        positions: string;
      }
    }

    export interface ZarazElementVisibilityRule {
      id: string;

      action: 'elementVisibility';

      settings: ZarazElementVisibilityRule.Settings;
    }

    export namespace ZarazElementVisibilityRule {
      export interface Settings {
        selector: string;
      }
    }
  }

  export interface ZarazStringVariable {
    name: string;

    type: 'string';

    value: string;
  }

  export interface ZarazSecretVariable {
    name: string;

    type: 'secret';

    value: string;
  }

  export interface ZarazWorkerVariable {
    name: string;

    type: 'worker';

    value: ZarazWorkerVariable.Value;
  }

  export namespace ZarazWorkerVariable {
    export interface Value {
      escapedWorkerName: string;

      workerTag: string;
    }
  }

  /**
   * Cloudflare Monitoring settings.
   */
  export interface Analytics {
    /**
     * Consent purpose assigned to Monitoring.
     */
    defaultPurpose?: string;

    /**
     * Whether Advanced Monitoring reports are enabled.
     */
    enabled?: boolean;

    /**
     * Session expiration time (seconds).
     */
    sessionExpTime?: number;
  }

  /**
   * Consent management configuration.
   */
  export interface Consent {
    enabled: boolean;

    buttonTextTranslations?: ZarazAPI.ButtonTextTranslationParam;

    companyEmail?: string;

    companyName?: string;

    companyStreetAddress?: string;

    consentModalIntroHTML?: string;

    /**
     * Object where keys are language codes
     */
    consentModalIntroHTMLWithTranslations?: { [key: string]: string };

    cookieName?: string;

    customCSS?: string;

    customIntroDisclaimerDismissed?: boolean;

    defaultLanguage?: string;

    hideModal?: boolean;

    /**
     * Object where keys are purpose alpha-numeric IDs
     */
    purposes?: { [key: string]: Consent.Purposes };

    /**
     * Object where keys are purpose alpha-numeric IDs
     */
    purposesWithTranslations?: { [key: string]: Consent.PurposesWithTranslations };

    tcfCompliant?: boolean;
  }

  export namespace Consent {
    export interface Purposes {
      description: string;

      name: string;
    }

    export interface PurposesWithTranslations {
      /**
       * Object where keys are language codes
       */
      description: { [key: string]: string };

      /**
       * Object where keys are language codes
       */
      name: { [key: string]: string };

      order: number;
    }
  }
}

export interface ConfigGetParams {
  /**
   * Identifier.
   */
  zone_id: string;
}

export declare namespace Config {
  export {
    type Configuration as Configuration,
    type ConfigUpdateParams as ConfigUpdateParams,
    type ConfigGetParams as ConfigGetParams,
  };
}
