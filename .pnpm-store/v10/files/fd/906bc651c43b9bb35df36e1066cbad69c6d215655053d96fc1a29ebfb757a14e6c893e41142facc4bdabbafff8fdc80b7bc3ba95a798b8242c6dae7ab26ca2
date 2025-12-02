// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import { SinglePage } from '../../pagination';

export class Rules extends APIResource {
  /**
   * Only available for the Waiting Room Advanced subscription. Creates a rule for a
   * waiting room.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const waitingRoomRule of client.waitingRooms.rules.create(
   *   '699d98642c564d2e855e9661899b7252',
   *   {
   *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *     rules: {
   *       action: 'bypass_waiting_room',
   *       expression: 'ip.src in {10.20.30.40}',
   *     },
   *   },
   * )) {
   *   // ...
   * }
   * ```
   */
  create(
    waitingRoomId: string,
    params: RuleCreateParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<WaitingRoomRulesSinglePage, WaitingRoomRule> {
    const { zone_id, rules } = params;
    return this._client.getAPIList(
      `/zones/${zone_id}/waiting_rooms/${waitingRoomId}/rules`,
      WaitingRoomRulesSinglePage,
      { body: rules, method: 'post', ...options },
    );
  }

  /**
   * Only available for the Waiting Room Advanced subscription. Replaces all rules
   * for a waiting room.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const waitingRoomRule of client.waitingRooms.rules.update(
   *   '699d98642c564d2e855e9661899b7252',
   *   {
   *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *     rules: [
   *       {
   *         action: 'bypass_waiting_room',
   *         expression: 'ip.src in {10.20.30.40}',
   *       },
   *     ],
   *   },
   * )) {
   *   // ...
   * }
   * ```
   */
  update(
    waitingRoomId: string,
    params: RuleUpdateParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<WaitingRoomRulesSinglePage, WaitingRoomRule> {
    const { zone_id, rules } = params;
    return this._client.getAPIList(
      `/zones/${zone_id}/waiting_rooms/${waitingRoomId}/rules`,
      WaitingRoomRulesSinglePage,
      { body: rules, method: 'put', ...options },
    );
  }

  /**
   * Deletes a rule for a waiting room.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const waitingRoomRule of client.waitingRooms.rules.delete(
   *   '699d98642c564d2e855e9661899b7252',
   *   '25756b2dfe6e378a06b033b670413757',
   *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * )) {
   *   // ...
   * }
   * ```
   */
  delete(
    waitingRoomId: string,
    ruleId: string,
    params: RuleDeleteParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<WaitingRoomRulesSinglePage, WaitingRoomRule> {
    const { zone_id } = params;
    return this._client.getAPIList(
      `/zones/${zone_id}/waiting_rooms/${waitingRoomId}/rules/${ruleId}`,
      WaitingRoomRulesSinglePage,
      { method: 'delete', ...options },
    );
  }

  /**
   * Patches a rule for a waiting room.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const waitingRoomRule of client.waitingRooms.rules.edit(
   *   '699d98642c564d2e855e9661899b7252',
   *   '25756b2dfe6e378a06b033b670413757',
   *   {
   *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *     action: 'bypass_waiting_room',
   *     expression: 'ip.src in {10.20.30.40}',
   *   },
   * )) {
   *   // ...
   * }
   * ```
   */
  edit(
    waitingRoomId: string,
    ruleId: string,
    params: RuleEditParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<WaitingRoomRulesSinglePage, WaitingRoomRule> {
    const { zone_id, ...body } = params;
    return this._client.getAPIList(
      `/zones/${zone_id}/waiting_rooms/${waitingRoomId}/rules/${ruleId}`,
      WaitingRoomRulesSinglePage,
      { body, method: 'patch', ...options },
    );
  }

  /**
   * Lists rules for a waiting room.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const waitingRoomRule of client.waitingRooms.rules.get(
   *   '699d98642c564d2e855e9661899b7252',
   *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * )) {
   *   // ...
   * }
   * ```
   */
  get(
    waitingRoomId: string,
    params: RuleGetParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<WaitingRoomRulesSinglePage, WaitingRoomRule> {
    const { zone_id } = params;
    return this._client.getAPIList(
      `/zones/${zone_id}/waiting_rooms/${waitingRoomId}/rules`,
      WaitingRoomRulesSinglePage,
      options,
    );
  }
}

export class WaitingRoomRulesSinglePage extends SinglePage<WaitingRoomRule> {}

export interface WaitingRoomRule {
  /**
   * The ID of the rule.
   */
  id?: string;

  /**
   * The action to take when the expression matches.
   */
  action?: 'bypass_waiting_room';

  /**
   * The description of the rule.
   */
  description?: string;

  /**
   * When set to true, the rule is enabled.
   */
  enabled?: boolean;

  /**
   * Criteria defining when there is a match for the current rule.
   */
  expression?: string;

  last_updated?: string;

  /**
   * The version of the rule.
   */
  version?: string;
}

export interface RuleCreateParams {
  /**
   * Path param: Identifier.
   */
  zone_id: string;

  /**
   * Body param:
   */
  rules: RuleCreateParams.Rules;
}

export namespace RuleCreateParams {
  export interface Rules {
    /**
     * The action to take when the expression matches.
     */
    action: 'bypass_waiting_room';

    /**
     * Criteria defining when there is a match for the current rule.
     */
    expression: string;

    /**
     * The description of the rule.
     */
    description?: string;

    /**
     * When set to true, the rule is enabled.
     */
    enabled?: boolean;
  }
}

export interface RuleUpdateParams {
  /**
   * Path param: Identifier.
   */
  zone_id: string;

  /**
   * Body param:
   */
  rules: Array<RuleUpdateParams.Rule>;
}

export namespace RuleUpdateParams {
  export interface Rule {
    /**
     * The action to take when the expression matches.
     */
    action: 'bypass_waiting_room';

    /**
     * Criteria defining when there is a match for the current rule.
     */
    expression: string;

    /**
     * The description of the rule.
     */
    description?: string;

    /**
     * When set to true, the rule is enabled.
     */
    enabled?: boolean;
  }
}

export interface RuleDeleteParams {
  /**
   * Identifier.
   */
  zone_id: string;
}

export interface RuleEditParams {
  /**
   * Path param: Identifier.
   */
  zone_id: string;

  /**
   * Body param: The action to take when the expression matches.
   */
  action: 'bypass_waiting_room';

  /**
   * Body param: Criteria defining when there is a match for the current rule.
   */
  expression: string;

  /**
   * Body param: The description of the rule.
   */
  description?: string;

  /**
   * Body param: When set to true, the rule is enabled.
   */
  enabled?: boolean;

  /**
   * Body param: Reorder the position of a rule
   */
  position?: RuleEditParams.Index | RuleEditParams.Before | RuleEditParams.After;
}

export namespace RuleEditParams {
  export interface Index {
    /**
     * Places the rule in the exact position specified by the integer number
     * <POSITION_NUMBER>. Position numbers start with 1. Existing rules in the ruleset
     * from the specified position number onward are shifted one position (no rule is
     * overwritten).
     */
    index?: number;
  }

  export interface Before {
    /**
     * Places the rule before rule <RULE_ID>. Use this argument with an empty rule ID
     * value ("") to set the rule as the first rule in the ruleset.
     */
    before?: string;
  }

  export interface After {
    /**
     * Places the rule after rule <RULE_ID>. Use this argument with an empty rule ID
     * value ("") to set the rule as the last rule in the ruleset.
     */
    after?: string;
  }
}

export interface RuleGetParams {
  /**
   * Identifier.
   */
  zone_id: string;
}

Rules.WaitingRoomRulesSinglePage = WaitingRoomRulesSinglePage;

export declare namespace Rules {
  export {
    type WaitingRoomRule as WaitingRoomRule,
    WaitingRoomRulesSinglePage as WaitingRoomRulesSinglePage,
    type RuleCreateParams as RuleCreateParams,
    type RuleUpdateParams as RuleUpdateParams,
    type RuleDeleteParams as RuleDeleteParams,
    type RuleEditParams as RuleEditParams,
    type RuleGetParams as RuleGetParams,
  };
}
