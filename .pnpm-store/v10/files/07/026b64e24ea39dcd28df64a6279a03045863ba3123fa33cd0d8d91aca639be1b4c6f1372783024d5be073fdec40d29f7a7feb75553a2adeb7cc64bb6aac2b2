/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * The OpenSearch Contributors require contributions made to
 * this file be licensed under the Apache-2.0 license or a
 * compatible open source license.
 *
 */

/*
 * This file was generated from the OpenSearch API Spec. Do NOT edit it
 * manually. If you want to make changes, either update the spec or
 * modify the API generator.
 */

import * as Common from './_common'
import * as Common_QueryDsl from './_common.query_dsl'

export type DocumentRating = {
  _id: Common.Id;
  _index: Common.IndexName;
  rating: number;
}

export type RankEvalHit = {
  _id: Common.Id;
  _index: Common.IndexName;
  _score: number;
  _type?: Common.Type;
}

export type RankEvalHitItem = {
  hit: RankEvalHit;
  rating?: number;
}

export type RankEvalMetric = {
  dcg?: RankEvalMetricDiscountedCumulativeGain;
  expected_reciprocal_rank?: RankEvalMetricExpectedReciprocalRank;
  mean_reciprocal_rank?: RankEvalMetricMeanReciprocalRank;
  precision?: RankEvalMetricPrecision;
  recall?: RankEvalMetricRecall;
}

export type RankEvalMetricBase = {
  k?: number;
}

export type RankEvalMetricDetail = {
  hits: RankEvalHitItem[];
  metric_details: Record<string, Record<string, any>>;
  metric_score: number;
  unrated_docs: UnratedDocument[];
}

export type RankEvalMetricDiscountedCumulativeGain = RankEvalMetricBase & {
  normalize?: boolean;
}

export type RankEvalMetricExpectedReciprocalRank = RankEvalMetricBase & {
  maximum_relevance: number;
}

export type RankEvalMetricMeanReciprocalRank = RankEvalMetricRatingThreshold & Record<string, any>

export type RankEvalMetricPrecision = RankEvalMetricRatingThreshold & {
  ignore_unlabeled?: boolean;
}

export type RankEvalMetricRatingThreshold = RankEvalMetricBase & {
  relevant_rating_threshold?: number;
}

export type RankEvalMetricRecall = RankEvalMetricRatingThreshold & Record<string, any>

export type RankEvalQuery = {
  query: Common_QueryDsl.QueryContainer;
  size?: number;
}

export type RankEvalRequestItem = {
  id: Common.Id;
  params?: Record<string, any>;
  ratings: DocumentRating[];
  request?: RankEvalQuery;
  template_id?: Common.Id;
}

export type UnratedDocument = {
  _id: Common.Id;
  _index: Common.IndexName;
}

