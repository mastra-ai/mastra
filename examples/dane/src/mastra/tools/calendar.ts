import { createTool } from '@mastra/core/tools';
import chalk from 'chalk';
import { execSync } from 'child_process';
import Table from 'cli-table3';
import { z } from 'zod';

interface CalendarEvent {
  title: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  description?: string;
}

class LocalCalendarReader {
  async getEvents(): Promise<CalendarEvent[]> {
    const script = `
          tell application "Calendar"
            set eventList to {}
            set startDate to (current date) - 7 * days
            set endDate to (current date) + 365 * days
            
            repeat with calendarAccount in calendars
              set eventList to eventList & (every event of calendarAccount whose start date is greater than or equal to startDate and start date is less than or equal to endDate)
            end repeat
            
            set output to ""
            repeat with anEvent in eventList
              set theTitle to summary of anEvent
              set theStart to start date of anEvent as string
              set theEnd to end date of anEvent as string
              set theLoc to location of anEvent
              set theDesc to description of anEvent
              
              if theLoc is missing value then
                set theLoc to ""
              end if
              if theDesc is missing value then
                set theDesc to ""
              end if
              
              set output to output & theTitle & "|" & theStart & "|" & theEnd & "|" & theLoc & "|" & theDesc & "
    "
            end repeat
            
            return output
          end tell
        `;

    try {
      const result = execSync(`osascript -e '${script}'`).toString();
      return this.parseAppleScriptOutput(result);
    } catch (error) {
      if (error instanceof Error) {
        console.error('Raw AppleScript error:', error.message);
        throw new Error(`Failed to read Mac calendar: ${error.message}`);
      } else {
        console.error('An unknown error occurred:', error);
        throw new Error('Failed to read Mac calendar');
      }
    }
  }

  private parseAppleScriptOutput(output: string): CalendarEvent[] {
    const events: CalendarEvent[] = [];

    const lines = output.split('\n').filter(line => line.trim());

    for (const line of lines) {
      try {
        const [title, startDateStr, endDateStr, location, description] = line.split('|');

        const startStandardized = startDateStr
          ?.split(',')?.[1] // Remove day name
          ?.replace(' at ', ' ') // Remove 'at'
          ?.trim(); // 'January 3, 2025 9:00:00 AM'

        const startDate = new Date(startStandardized || '');

        const endStandardized = endDateStr
          ?.split(',')?.[1] // Remove day name
          ?.replace(' at ', ' ') // Remove 'at'
          ?.trim(); // 'January 3, 2025 9:00:00 AM'
        const endDate = new Date(endStandardized || '');

        const event: CalendarEvent = {
          title: title?.trim()!,
          startDate,
          endDate,
          location: location?.trim() || '',
          description: description?.trim() || '',
        };

        events.push(event);
      } catch (error) {
        console.error('Failed to parse event line:', line, error);
      }
    }

    return events.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }
}

const reader = new LocalCalendarReader();

export const listEvents = createTool({
  id: 'listEvents',
  description: 'List calendar events',
  inputSchema: z.object({
    startDate: z.string(),
  }),
  outputSchema: z.object({
    content: z.string(),
  }),
  execute: async () => {
    try {
      const events = await reader.getEvents();
      const table = new Table({
        head: [
          chalk.blue('Start'),
          chalk.blue('End'),
          chalk.blue('Title'),
          chalk.blue('Location'),
          chalk.blue('Description'),
        ],
        colWidths: [12, 15, 30, 20, 40],
      });

      events.forEach(event => {
        if (event.title) {
          table.push([
            event.startDate.toISOString(),
            event.endDate.toISOString(),
            event.title || '',
            event.location || '',
            (event.description || '').substring(0, 37) + '...',
          ]);
        }
      });

      // console.log(chalk.blue(table.toString()));

      return {
        content: JSON.stringify(events, null, 2),
      };
    } catch (e) {
      if (e instanceof Error) {
        console.log(`\n${chalk.red(e.message)}`);
      }
      return { content: 'Error' };
    }
  },
});
