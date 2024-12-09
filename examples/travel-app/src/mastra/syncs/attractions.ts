import { createSync } from '@mastra/core';
import csvParser from 'csv-parser';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';

// Update the interface to match the new CSV column names
interface CityData {
  airportCode: string;
  airportName: string;
  city: string;
  state: string;
  country: string;
  airportLatitude: number;
  airportLongitude: number;
  cityId: string;
  attractionId: string;
}

export const syncCsvData = createSync({
  label: 'Sync CSV Data',
  description: 'Sync data from City CSV',
  schema: z.object({}),
  executor: async ({ engine }) => {
    const csvFilePath = process.env.CSV_FILE_PATH || path.join(process.cwd(), 'src/data/city-data.csv');
    console.log('Resolved CSV file path:', csvFilePath);
    const records: { data: CityData; externalId: string }[] = [];

    await new Promise((resolve, reject) => {
      fs.createReadStream(csvFilePath)
        .pipe(csvParser())
        .on('data', (row: CityData) => {
          records.push({
            data: row,
            externalId: row.cityId,
          });
        })
        .on('end', resolve)
        .on('error', reject);
    });

    await engine.syncRecords({
      connectionId: `SYSTEM`,
      name: 'City',
      records,
    });

    return {};
  },
});
