import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const weatherTool = createTool({
  id: 'weatherTool',
  description: 'Get current weather for a location',
  inputSchema: z.object({
    location: z.string().describe('City name, e.g. "Tokyo, Japan"'),
  }),
  outputSchema: z.object({
    temperature: z.number(),
    condition: z.string(),
    humidity: z.number(),
    windSpeed: z.number(),
    forecast: z.string(),
    location: z.string(),
  }),
  execute: async ({ context }) => {
    // ダミーの天気データを返す
    return {
      location: context.location,
      temperature: 72,
      condition: 'Sunny',
      humidity: 65,
      windSpeed: 5,
      forecast: 'Clear skies for the next 24 hours.',
    };
  },
});

// ラッコキーワードツール
export const rakkoKeywordTool = createTool({
  id: 'rakkoKeywordTool',
  description: 'ラッコキーワードを使って、SEOのためのキーワードリサーチを行います',
  inputSchema: z.object({
    keyword: z.string().describe('検索したいキーワード'),
  }),
  outputSchema: z.object({
    mainKeyword: z.string(),
    relatedKeywords: z.array(z.object({
      keyword: z.string(),
      searchVolume: z.number(),
      competition: z.string(),
      cpc: z.string(),
    })),
    suggestion: z.string(),
  }),
  execute: async ({ context }) => {
    // キーワード検索をシミュレート
    const keyword = context.keyword;
    
    // 学童えすこーと関連のキーワードをシミュレート
    const baseKeywords = [
      "学童 送迎",
      "子供 習い事 送迎",
      "小学生 送り迎え サービス",
      "放課後 見守り",
      "学童保育 民間",
      "共働き 子育て 支援",
      "小学生 放課後 過ごし方",
      "送迎付き 学習塾",
      "子供 安全 見守り",
      "学校終わり 預かり"
    ];
    
    // 入力キーワードに基づいて関連キーワードを生成
    const relatedKeywords = baseKeywords.map(baseKeyword => {
      const searchVolume = Math.floor(Math.random() * 1000) + 100;
      return {
        keyword: baseKeyword,
        searchVolume,
        competition: (Math.random()).toFixed(2),
        cpc: (Math.random() * 5).toFixed(2),
      };
    });
    
    // ソート
    const sortedKeywords = [...relatedKeywords].sort((a, b) => b.searchVolume - a.searchVolume);
    
    // 結果を返す
    return {
      mainKeyword: keyword,
      relatedKeywords: sortedKeywords,
      suggestion: `「${keyword}」に関連する有望なキーワードは「${sortedKeywords[0].keyword}」（検索ボリューム：${sortedKeywords[0].searchVolume}）と「${sortedKeywords[1].keyword}」（検索ボリューム：${sortedKeywords[1].searchVolume}）です。`,
    };
  },
});

export * from './database';
export * from './wordpress';

export { browserTool } from './browser';
