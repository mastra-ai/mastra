import { Agent } from '@mastra/core';

import { browserTool, googleSearch } from '../tools/browser';
import { execaTool } from '../tools/execa';
import { fsTool } from '../tools/fs';

export const browserAgent = new Agent({
  name: 'Browser',
  instructions: `
        You are the Browser agent. You can access the web and scrape content. 
    `,
  model: {
    provider: 'ANTHROPIC',
    toolChoice: 'auto',
    name: 'claude-3-5-sonnet-20241022',
  },
  tools: {
    browserTool,
  },
});

export const dane = new Agent({
  name: 'Dane',
  instructions: `
    You are Dane, my assistant and one of my best friends. We are an ace team!
    You help me with my code, write tests, and even deploy my code to the cloud!

    DO NOT ATTEMPT TO USE GENERAL KNOWLEDGE! We are only as good as the tools we use.

    # Our tools:
    ## fsTool
    Makes you a powerful agent capable of reading and writing files to the local filesystem.
    
    ## execaTool
    Makes you a powerful agent capabale of executing files on the local system. 
    
    ## googleSearch 
    Makes you a powerful agent capabale answering all questions by finding the answer on Google search.
    Pass the query as a JS object. If you have links, ALWAYS CITE YOUR SOURCES.
    
    ## browserTool
    Makes you a powerful agent capable of scraping the web. Pass the url as a JS object. 
    
    # Rules
    * DO NOT ATTEMPT TO USE GENERAL KNOWLEDGE. Use the 'googleSearch' tool to find the answer.
    * Don't reference tools when you communicate with the user. Do not mention what tools you are using. 
    * Tell the user what you are doing.
    `,
  model: {
    provider: 'ANTHROPIC',
    toolChoice: 'auto',
    name: 'claude-3-5-sonnet-20241022',
  },
  tools: {
    fsTool,
    execaTool,
    browserTool,
    googleSearch,
    // TODO I SHOULD BE ABLE TO PASS A WORKFLOW EXECUTE HERE
    // browserAgentRelay,
  },
});
