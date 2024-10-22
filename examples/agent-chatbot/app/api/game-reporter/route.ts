export const dynamic = 'force-dynamic' // static by default, unless reading the request

export async function GET(request: Request) {
  // Get the day of the week of the last prime time game.
  const daysOfWeek = [
    'sunday',
    'monday',
    'monday',
    'monday',
    'thursday',
    'thursday',
    'thursday'
  ]
  const currentDate = new Date()
  const lastPrimtimeDay = daysOfWeek[currentDate.getDay()]

  // Define the start dates for each week of the NFL season
  const weekStartDates = [
    new Date('2024-09-06'), // Week 1
    new Date('2024-09-12'), // Week 2
    new Date('2024-09-19'), // Week 3
    new Date('2024-09-26'), // Week 4
    new Date('2024-10-03'), // Week 5
    new Date('2024-10-10'), // Week 6
    new Date('2024-10-17'), // Week 7
    new Date('2024-10-24'), // Week 8
    new Date('2024-11-01'), // Week 9
    new Date('2024-11-07'), // Week 10
    new Date('2024-11-14'), // Week 11
    new Date('2024-11-21'), // Week 12
    new Date('2024-11-28'), // Week 13
    new Date('2024-12-05'), // Week 14
    new Date('2024-12-12'), // Week 15
    new Date('2024-12-19'), // Week 16
    new Date('2024-12-26'), // Week 17
    new Date('2025-01-02'), // Week 18
    new Date('2025-01-09') // Playoffs
  ]

  // Find the current week based on the current date
  const currentWeek = weekStartDates.findIndex(
    startDate => currentDate < startDate
  )

  if (!currentWeek || currentWeek > 18) {
    return new Response(`The NFL season is over.`, { status: 400 })
  }

  // If it is a prime time day, we call our workflow.
  const { mastra } = await import('../../../lib/mastra/framework')

  await mastra.triggerEvent({
    key: 'REPORT_GAME_RESULTS',
    data: {
      week: currentWeek.toString(),
      day: lastPrimtimeDay
    },
    user: {
      connectionId: 'SYSTEM'
    }
  })
  return new Response(
    `Game results reported for week ${currentWeek} day ${lastPrimtimeDay}.`
  )
}
