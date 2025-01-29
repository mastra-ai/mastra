import { Step, Workflow } from "@mastra/core";
import csvParser from "csv-parser";
import fs from "fs";
import path from "path";

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

export const syncCsvDataWorkflow = new Workflow({
  name: "Sync CSV Data",
});

const syncCsvDataStep = new Step({
  id: "sync-csv-data-step",
  description: "Sync data from City CSV",
  execute: async ({ mastra }) => {
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

    if (!mastra?.engine) throw new Error("Mastra is not defined");

    await mastra.engine.syncRecords({
      connectionId: `SYSTEM`,
      name: "City",
      records,
    });

    return {};
  },
});

syncCsvDataWorkflow.step(syncCsvDataStep);
