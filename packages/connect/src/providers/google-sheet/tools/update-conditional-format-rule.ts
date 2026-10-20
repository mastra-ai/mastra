// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateConditionalFormatRuleInputSchema = z.object({
  spreadsheetId: z.string().describe('The ID of the spreadsheet to update. Example: "1aBcD..."'),
  sheetId: z
    .number()
    .optional()
    .describe('The ID of the sheet to apply the rule to. If not specified, applies to all sheets.'),
  index: z.number().describe('The zero-based index of the rule to update or move.'),
  newIndex: z.number().optional().describe('The zero-based new index to move the rule to. Use this to reorder rules.'),
  rule: z
    .object({
      ranges: z
        .array(
          z.object({
            sheetId: z.number().optional(),
            startRowIndex: z.number().optional(),
            endRowIndex: z.number().optional(),
            startColumnIndex: z.number().optional(),
            endColumnIndex: z.number().optional(),
          }),
        )
        .describe('The ranges to apply the conditional format to.'),
      booleanRule: z
        .object({
          condition: z.object({
            type: z.string().describe('The type of condition. Examples: "BOOLEAN", "NUMBER_GREATER", "TEXT_CONTAINS".'),
            values: z
              .array(
                z.object({
                  userEnteredValue: z.string().optional(),
                }),
              )
              .optional(),
          }),
          format: z
            .object({
              backgroundColor: z
                .object({
                  red: z.number().optional(),
                  green: z.number().optional(),
                  blue: z.number().optional(),
                  alpha: z.number().optional(),
                })
                .optional(),
              textFormat: z
                .object({
                  bold: z.boolean().optional(),
                  italic: z.boolean().optional(),
                  fontFamily: z.string().optional(),
                })
                .optional(),
            })
            .optional(),
        })
        .optional()
        .describe('A boolean rule - formats cells based on true/false condition.'),
      gradientRule: z
        .object({
          minPoint: z
            .object({
              color: z
                .object({
                  red: z.number().optional(),
                  green: z.number().optional(),
                  blue: z.number().optional(),
                })
                .optional(),
              type: z.string().optional(),
              value: z.string().optional(),
            })
            .optional(),
          maxPoint: z
            .object({
              color: z
                .object({
                  red: z.number().optional(),
                  green: z.number().optional(),
                  blue: z.number().optional(),
                })
                .optional(),
              type: z.string().optional(),
              value: z.string().optional(),
            })
            .optional(),
        })
        .optional()
        .describe('A gradient rule - formats cells with color gradients.'),
    })
    .optional()
    .describe(
      'The new conditional format rule. If provided, replaces the existing rule. If omitted, only moves the rule.',
    ),
});

export const updateConditionalFormatRuleOutputSchema = z.object({
  spreadsheetId: z.string(),
  replies: z
    .array(
      z.object({
        updateConditionalFormatRule: z
          .object({
            newIndex: z.number().optional(),
            oldIndex: z.number().optional(),
            newRule: z.any().optional(),
            oldRule: z.any().optional(),
          })
          .optional(),
      }),
    )
    .optional(),
  success: z.boolean(),
});

export function updateConditionalFormatRuleTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_sheet_update_conditional_format_rule',
    description: 'Update or move a conditional format rule',
    inputSchema: updateConditionalFormatRuleInputSchema,
    outputSchema: updateConditionalFormatRuleOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateConditionalFormatRuleOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // Build the UpdateConditionalFormatRuleRequest
      const updateRequest: Record<string, any> = {
        index: input.index,
      };

      if (input.sheetId !== undefined) {
        updateRequest['sheetId'] = input.sheetId;
      }

      if (input.newIndex !== undefined) {
        updateRequest['newIndex'] = input.newIndex;
      }

      if (input.rule !== undefined) {
        // Transform the rule to match Google API format
        const rule: Record<string, any> = {
          ranges: input.rule.ranges.map((range: any) => {
            const result: Record<string, any> = {};
            if (range.sheetId !== undefined) result['sheetId'] = range.sheetId;
            if (range.startRowIndex !== undefined) result['startRowIndex'] = range.startRowIndex;
            if (range.endRowIndex !== undefined) result['endRowIndex'] = range.endRowIndex;
            if (range.startColumnIndex !== undefined) result['startColumnIndex'] = range.startColumnIndex;
            if (range.endColumnIndex !== undefined) result['endColumnIndex'] = range.endColumnIndex;
            return result;
          }),
        };

        if (input.rule.booleanRule) {
          rule['booleanRule'] = {
            condition: {
              type: input.rule.booleanRule.condition.type,
              ...(input.rule.booleanRule.condition.values && {
                values: input.rule.booleanRule.condition.values.map((v: any) => ({
                  userEnteredValue: v.userEnteredValue,
                })),
              }),
            },
            format: input.rule.booleanRule.format,
          };
        }

        if (input.rule.gradientRule) {
          rule['gradientRule'] = input.rule.gradientRule;
        }

        updateRequest['rule'] = rule;
      }

      // https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/batchUpdate
      const response = await platformProxy.post({
        endpoint: `/v4/spreadsheets/${input.spreadsheetId}:batchUpdate`,
        data: {
          requests: [
            {
              updateConditionalFormatRule: updateRequest,
            },
          ],
        },
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'api_error',
          message: 'Failed to update conditional format rule',
        });
      }

      // Map the response to our output format
      const replies = response.data.replies?.map((reply: any) => {
        if (reply.updateConditionalFormatRule) {
          return {
            updateConditionalFormatRule: {
              newIndex: reply.updateConditionalFormatRule.newIndex,
              oldIndex: reply.updateConditionalFormatRule.oldIndex,
              newRule: reply.updateConditionalFormatRule.newRule,
              oldRule: reply.updateConditionalFormatRule.oldRule,
            },
          };
        }
        return reply;
      });

      return {
        spreadsheetId: response.data.spreadsheetId || input.spreadsheetId,
        replies: replies || [],
        success: true,
      };
    },
  });
}
