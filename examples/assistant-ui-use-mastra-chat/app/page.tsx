"use client";
import { Assistant } from "./assistant";
import { MastraReactProvider } from "@mastra/react-hooks";
import {
  MastraClientProvider,
  PlaygroundQueryClient,
} from "@mastra/playground-ui";

export default function Home() {
  return (
    <PlaygroundQueryClient>
      <MastraClientProvider baseUrl="http://localhost:4111">
        <MastraReactProvider baseUrl="http://localhost:4111">
          <Assistant />
        </MastraReactProvider>
      </MastraClientProvider>
    </PlaygroundQueryClient>
  );
}
