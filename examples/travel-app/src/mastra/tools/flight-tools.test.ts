// describe.skip('Flight Tools', () => {
//   let searchFlightsTool: any;

//   beforeEach(() => {
//     searchFlightsTool = mastra.getTool('searchFlights');
//   });

//   it('should search for flights between two cities', async () => {
//     const result = await searchFlightsTool.execute({
//       startDate: '2024-12-03',
//       endDate: '2024-12-10',
//       origin: 'ORD.AIRPORT', //Chicago
//       destination: 'SFO.AIRPORT',
//     });

//     expect(result).toBeDefined();
//     // Add more specific assertions based on your expected flight search response
//     expect(Array.isArray(result.flights)).toBe(true);
//     expect(result.flights.length).toBeGreaterThan(0);

//     // Test the structure of a flight result
//     const flight = result.flights[0];
//     expect(flight).toHaveProperty('departure');
//     expect(flight).toHaveProperty('arrival');
//     expect(flight).toHaveProperty('price');
//   }, 15000);
// });
