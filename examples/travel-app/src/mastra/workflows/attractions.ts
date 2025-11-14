import { createStep, createWorkflow } from "@mastra/core/workflows";
import csvParser from "csv-parser";
import fs from "fs";
import path from "path";
import { z } from "zod";

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

const syncCsvDataStep = createStep({
  id: "sync-csv-data-step",
  description: "Sync data from City CSV",
  inputSchema: z.object({}),
  outputSchema: z.object({
    records: z.array(
      z.object({
        data: z.any(),
        externalId: z.string(),
      }),
    ),
  }),
  execute: async () => {
    const csvFilePath =
      process.env.CSV_FILE_PATH ||
      path.join(process.cwd(), "src/data/city-data.csv");
    console.log("Resolved CSV file path:", csvFilePath);
    const records: { data: CityData; externalId: string }[] = [];

    await new Promise((resolve, reject) => {
      fs.createReadStream(csvFilePath)
        .pipe(csvParser())
        .on("data", (row: CityData) => {
          records.push({
            data: row,
            externalId: row.cityId,
          });
        })
        .on("end", resolve)
        .on("error", reject);
    });

    return {
      records,
    };
  },
});

export const syncCsvDataWorkflow = createWorkflow({
  id: "sync-csv-data",
  inputSchema: z.object({}),
  outputSchema: z.object({
    records: z.array(
      z.object({
        data: z.any(),
        externalId: z.string(),
      }),
    ),
  }),
})
  .then(syncCsvDataStep)
  .commit();
