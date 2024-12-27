/* eslint-disable @typescript-eslint/no-explicit-any */
import csv from "csv-parser";
import fs from "fs";

import { stringify } from "csv-stringify/sync";

import { getHotels, getAttractionList } from "../mastra/tools/attraction-tools";

async function updateCityData() {
  const filePath = "src/data/city-data.csv";
  const cities = [] as Array<any>;

  // Read the CSV file
  fs.createReadStream(filePath)
    .pipe(csv())
    .on("data", (row: Record<string, unknown>) => {
      cities.push(row);
    })
    .on("end", async () => {
      for (const city of cities) {
        const cityName = city["CITY"];
        console.log("Generating data for city:", cityName);

        // Fetch hotel data
        const hotels = await getHotels(cityName);
        if (hotels) {
          const cityData = hotels.find(
            (entry: { name: string; search_type: string }) =>
              entry.name === cityName && entry.search_type === "city",
          );

          if (cityData) {
            city.CITYID = cityData.dest_id; // Use the dest_id
          }
        }

        // Fetch attraction data
        const attractions = await getAttractionList(cityName);
        if (attractions && attractions.destinations) {
          const destination = attractions.destinations.find(
            (dest: any) =>
              dest.cityName === cityName && dest.country === "United States",
          );

          if (destination) {
            city.ATTRACTIONID = destination.id; // Use the destination id
          }
        }
      }

      // Write updated data back to CSV
      const updatedCsv = stringify(cities, { header: true });
      fs.writeFileSync(filePath, updatedCsv);
      console.log("CSV file updated successfully.");
    });
}

updateCityData().catch(console.error);
