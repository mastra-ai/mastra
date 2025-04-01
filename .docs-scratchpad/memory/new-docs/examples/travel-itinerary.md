# Travel Itinerary Example with Memory

This example demonstrates how to build a travel planning assistant that uses Mastra memory to maintain and update a travel itinerary across multiple conversations.

## Overview

We'll create a travel agent that can:
- Remember travel destinations and dates
- Add activities and reservations to specific days
- Adjust itineraries based on user feedback
- Recall specific details about the trip when asked
- Provide a complete itinerary on request

## Implementation

```typescript
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { openai } from "@ai-sdk/openai";
import { maskStreamTags } from "@mastra/core/utils";
import fs from "fs";

async function main() {
  // Create memory with working memory for travel details
  const memory = new Memory({
    options: {
      workingMemory: {
        enabled: true,
        // Custom template for travel itinerary
        template: `<trip>
  <traveler>
    <name></name>
    <preferences></preferences>
  </traveler>
  <destination></destination>
  <dates>
    <start></start>
    <end></end>
  </dates>
  <itinerary>
    <!-- Format: <day date="YYYY-MM-DD"><activities></activities><accommodations></accommodations></day> -->
  </itinerary>
  <notes></notes>
</trip>`,
        // Use tool-call mode for structured updates
        use: "tool-call",
      },
    },
  });

  // Create a travel planning agent
  const travelAgent = new Agent({
    name: "TravelPlanner",
    instructions: `You are a helpful travel planning assistant that helps users plan and organize their trips.
    
    IMPORTANT INSTRUCTIONS:
    1. Maintain a detailed travel itinerary in working memory
    2. When a user mentions travel dates or destinations, add them to the working memory
    3. Add activities and accommodations under the appropriate day in the itinerary
    4. Remember user preferences and apply them when making suggestions
    5. Provide helpful travel recommendations based on the destination
    
    When asked for the full itinerary, present it in a clear, day-by-day format.
    Always update working memory when new travel information is provided.`,
    model: openai("gpt-4o"),
    memory: memory,
  });

  // User and travel plan identifiers
  const resourceId = "user_jordan";
  const threadId = "japan_trip";

  // First interaction - Initial trip details
  console.log("\n=== Session 1: Initial Trip Planning ===");
  console.log("User: I'm planning a trip to Japan from October 10 to October 17 this year. I'm interested in culture, food, and some nature activities.");
  
  await streamResponse(travelAgent, "I'm planning a trip to Japan from October 10 to October 17 this year. I'm interested in culture, food, and some nature activities.", resourceId, threadId);

  // Second interaction - Tokyo activities
  console.log("\n=== Session 2: Planning Tokyo Activities ===");
  console.log("User: For the first 3 days, I'll be in Tokyo. What are some must-see places and activities?");
  
  await streamResponse(travelAgent, "For the first 3 days, I'll be in Tokyo. What are some must-see places and activities?", resourceId, threadId);

  console.log("\nUser: Those sound great! Please add Tsukiji Fish Market for breakfast on October 11, followed by the teamLab Borderless museum, and dinner in Shibuya.");
  
  await streamResponse(travelAgent, "Those sound great! Please add Tsukiji Fish Market for breakfast on October 11, followed by the teamLab Borderless museum, and dinner in Shibuya.", resourceId, threadId);

  // Third interaction - Kyoto planning
  console.log("\n=== Session 3: Adding Kyoto to the Itinerary ===");
  console.log("User: For October 13-15, I'll be in Kyoto. I'd like to see temples and traditional culture.");
  
  await streamResponse(travelAgent, "For October 13-15, I'll be in Kyoto. I'd like to see temples and traditional culture.", resourceId, threadId);

  // Fourth interaction - Adjusting plans
  console.log("\n=== Session 4: Making Adjustments ===");
  console.log("User: I realized I haven't planned October 16-17 yet. Let's add a day trip to Nara on the 16th, and then return to Tokyo for my flight on the 17th.");
  
  await streamResponse(travelAgent, "I realized I haven't planned October 16-17 yet. Let's add a day trip to Nara on the 16th, and then return to Tokyo for my flight on the 17th.", resourceId, threadId);

  // Fifth interaction - Requesting full itinerary
  console.log("\n=== Session 5: Reviewing Full Itinerary ===");
  console.log("User: Can you show me my complete travel itinerary?");
  
  await streamResponse(travelAgent, "Can you show me my complete travel itinerary?", resourceId, threadId);

  // Sixth interaction - Specific question after a while
  console.log("\n=== Session 6: Specific Question Later ===");
  console.log("User: What was I planning to do in Kyoto again?");
  
  await streamResponse(travelAgent, "What was I planning to do in Kyoto again?", resourceId, threadId);

  // Check working memory
  console.log("\n=== Working Memory State ===");
  const workingMemory = await memory.getWorkingMemory({ resourceId });
  console.log(workingMemory.memory);
  
  // Save for reference
  fs.writeFileSync("travel-itinerary-memory.xml", workingMemory.memory);
  console.log("Working memory saved to travel-itinerary-memory.xml");
}

// Helper function to stream responses with working memory masking
async function streamResponse(agent, message, resourceId, threadId) {
  const response = await agent.stream(message, {
    resourceId,
    threadId,
  });

  process.stdout.write("Agent: ");
  for await (const chunk of maskStreamTags(response.textStream, "working_memory")) {
    process.stdout.write(chunk);
  }
  console.log("\n");
}

// Run the example
main().catch(console.error);
```

## Expected Output

```
=== Session 1: Initial Trip Planning ===
User: I'm planning a trip to Japan from October 10 to October 17 this year. I'm interested in culture, food, and some nature activities.
Agent: That sounds like a wonderful trip to Japan! October is a great time to visit as the weather is typically pleasant and you might catch some early autumn colors.

Based on your interests in culture, food, and nature, I'll help you plan an itinerary for your 8-day trip from October 10-17.

Here are some initial thoughts:

For culture:
- Tokyo: Meiji Shrine, Senso-ji Temple, Tokyo National Museum
- Kyoto: Fushimi Inari Shrine, Kinkaku-ji (Golden Pavilion), Gion district
- Nara: Todai-ji Temple with the Great Buddha

For food:
- Try sushi at a local restaurant or market
- Experience a traditional kaiseki meal in Kyoto
- Visit local izakayas for casual dining
- Consider a food tour or cooking class

For nature:
- Hakone: Mount Fuji views, hot springs
- Arashiyama Bamboo Grove in Kyoto
- Nara Park with free-roaming deer

Would you like me to suggest a day-by-day breakdown of your trip? Or do you already have certain cities or experiences in mind?

=== Session 2: Planning Tokyo Activities ===
User: For the first 3 days, I'll be in Tokyo. What are some must-see places and activities?
Agent: Great! For your first 3 days in Tokyo (October 10-12), here are some must-see places and activities:

Day 1 (October 10):
- Morning: Meiji Shrine and Yoyogi Park - peaceful cultural start to your trip
- Afternoon: Harajuku (Takeshita Street) for unique Japanese fashion and culture
- Evening: Shinjuku for dinner and the vibrant nightlife, including a visit to the Tokyo Metropolitan Government Building for free night views

Day 2 (October 11):
- Morning: Tsukiji Outer Market for breakfast and food exploration
- Afternoon: Asakusa district with Senso-ji Temple and Nakamise Shopping Street
- Evening: Tokyo Skytree for sunset views, followed by dinner in nearby Solamachi

Day 3 (October 12):
- Morning: Imperial Palace East Gardens
- Afternoon: Akihabara for electronics and anime culture
- Evening: Shibuya Crossing and surrounding area for shopping, dining and entertainment

Additional recommendations based on your interests:
- Culture: Tokyo National Museum, Edo-Tokyo Museum, teamLab Borderless digital art museum
- Food: Try conveyor belt sushi, visit department store food halls (depachika), take a cooking class
- Nature: Shinjuku Gyoen National Garden, Ueno Park, day trip to Kamakura

Would you like me to add any of these specific activities to your itinerary or would you prefer to modify any of these suggestions?

User: Those sound great! Please add Tsukiji Fish Market for breakfast on October 11, followed by the teamLab Borderless museum, and dinner in Shibuya.
Agent: I've updated your itinerary with those activities for October 11th:

Day 2 (October 11):
- Morning: Tsukiji Fish Market for breakfast and fresh seafood
- Afternoon: teamLab Borderless digital art museum for an immersive cultural experience
- Evening: Dinner in Shibuya, followed by exploring the famous Shibuya Crossing and surrounding area

That's a wonderful day with a mix of traditional Japanese culture (morning market), modern Japanese art (teamLab), and contemporary urban experience (Shibuya). The teamLab Borderless museum is incredibly popular, so I recommend booking tickets in advance online.

Would you like me to adjust anything else about your Tokyo itinerary for the first three days?

=== Session 3: Adding Kyoto to the Itinerary ===
User: For October 13-15, I'll be in Kyoto. I'd like to see temples and traditional culture.
Agent: Perfect! Kyoto is the cultural heart of Japan and ideal for temples and traditional experiences. Here's a suggested itinerary for your time in Kyoto (October 13-15):

Day 4 (October 13):
- Morning: Travel from Tokyo to Kyoto via Shinkansen (bullet train) - approximately 2.5 hours
- Afternoon: Visit Kinkaku-ji (Golden Pavilion) and Ryoan-ji Temple with its famous rock garden
- Evening: Explore Gion district for dinner, with the possibility of spotting geiko (Kyoto's geisha)

Day 5 (October 14):
- Morning: Fushimi Inari Shrine with its thousands of vermilion torii gates (go early to avoid crowds)
- Afternoon: Arashiyama area, including the bamboo grove, Tenryu-ji Temple, and Monkey Park
- Evening: Traditional kaiseki dinner experience (multi-course Japanese dinner)

Day 6 (October 15):
- Morning: Kiyomizu-dera Temple with beautiful views of Kyoto
- Afternoon: Nishiki Market ("Kyoto's Kitchen") for food exploration
- Evening: Philosopher's Path and Nanzen-ji Temple area

Traditional cultural experiences to consider adding:
- Tea ceremony at a traditional tea house
- Kimono rental for a day of temple visiting
- Japanese cooking class
- Stay in a ryokan (traditional Japanese inn) for at least one night
- Early morning visit to see Buddhist morning ceremonies

Would you like me to include any of these additional cultural experiences or make any adjustments to the Kyoto portion of your itinerary?

=== Session 4: Making Adjustments ===
User: I realized I haven't planned October 16-17 yet. Let's add a day trip to Nara on the 16th, and then return to Tokyo for my flight on the 17th.
Agent: I've added those final days to your itinerary:

Day 7 (October 16) - Day Trip to Nara:
- Morning: Travel from Kyoto to Nara (about 45 minutes by train)
- Day activities in Nara:
  * Nara Park with the friendly free-roaming deer
  * Todai-ji Temple with the Great Buddha (Daibutsu)
  * Kasuga-Taisha Shrine with its famous stone lanterns
  * Isuien Garden for beautiful Japanese landscaping
- Evening: Return to Kyoto for one final night, or optionally start heading back to Tokyo if your flight is early on the 17th

Day 8 (October 17) - Return to Tokyo:
- Morning: Travel from Kyoto to Tokyo via Shinkansen
- Depending on your flight time:
  * Last-minute shopping in Tokyo (perhaps at Asakusa or Shibuya)
  * Visit any spots you missed earlier
  * Relax at a café to reflect on your trip
- Airport transfer: Allow at least 2-3 hours to get to either Narita or Haneda airports from central Tokyo

This completes your 8-day itinerary in Japan! It offers a good balance of Tokyo's modernity (3 days), Kyoto's traditional culture (3 days), a cultural day trip to Nara, and buffer time to return to Tokyo for your departure.

Is there anything else you'd like to adjust or any other specific activities you want to include on these final days?

=== Session 5: Reviewing Full Itinerary ===
Agent: Here's your complete 8-day Japan itinerary from October 10-17:

TOKYO (Days 1-3):
Day 1 (October 10):
- Morning: Arrival in Tokyo, hotel check-in
- Afternoon: Meiji Shrine and Yoyogi Park
- Evening: Explore Harajuku and dinner in Shinjuku

Day 2 (October 11):
- Morning: Tsukiji Fish Market for breakfast and seafood exploration
- Afternoon: teamLab Borderless digital art museum
- Evening: Dinner in Shibuya and see the famous Shibuya Crossing

Day 3 (October 12):
- Morning: Imperial Palace East Gardens
- Afternoon: Asakusa district with Senso-ji Temple
- Evening: Akihabara for electronics and anime culture

KYOTO (Days 4-6):
Day 4 (October 13):
- Morning: Travel from Tokyo to Kyoto via Shinkansen
- Afternoon: Kinkaku-ji (Golden Pavilion) and Ryoan-ji Temple
- Evening: Gion district exploration and dinner

Day 5 (October 14):
- Morning: Fushimi Inari Shrine (thousand torii gates)
- Afternoon: Arashiyama Bamboo Grove and Tenryu-ji Temple
- Evening: Traditional kaiseki dinner experience

Day 6 (October 15):
- Morning: Kiyomizu-dera Temple
- Afternoon: Nishiki Market food exploration
- Evening: Philosopher's Path and Nanzen-ji Temple area

NARA & RETURN (Days 7-8):
Day 7 (October 16):
- Full day trip to Nara:
  * Nara Park and friendly deer
  * Todai-ji Temple with Great Buddha
  * Kasuga-Taisha Shrine
  * Isuien Garden
- Evening: Return to Kyoto

Day 8 (October 17):
- Morning: Travel from Kyoto to Tokyo
- Afternoon: Last-minute shopping or sightseeing in Tokyo
- Evening: Departure from Japan

This itinerary covers your interests in culture (temples, museums, traditional districts), food (markets, special dining experiences), and nature (parks, gardens, bamboo grove).

Would you like any recommendations for specific restaurants, transportation passes, or other practical information for your trip?

=== Session 6: Specific Question Later ===
User: What was I planning to do in Kyoto again?
Agent: In Kyoto (October 13-15), you're planning to:

Day 4 (October 13):
- Morning: Travel from Tokyo to Kyoto via Shinkansen
- Afternoon: Visit Kinkaku-ji (Golden Pavilion) and Ryoan-ji Temple with its famous rock garden
- Evening: Explore Gion district (the geisha district) for dinner

Day 5 (October 14):
- Morning: Fushimi Inari Shrine with its thousands of vermilion torii gates
- Afternoon: Arashiyama area, including the bamboo grove and Tenryu-ji Temple
- Evening: Traditional kaiseki multi-course dinner

Day 6 (October 15):
- Morning: Kiyomizu-dera Temple with its wooden terrace and city views
- Afternoon: Nishiki Market ("Kyoto's Kitchen") for food exploration
- Evening: Philosopher's Path and Nanzen-ji Temple area

These activities focus on your interests in temples and traditional Japanese culture, with plenty of opportunities to experience Kyoto's famous sites, cuisine, and atmosphere.

=== Working Memory State ===
<trip>
  <traveler>
    <name>Jordan</name>
    <preferences>culture, food, nature activities</preferences>
  </traveler>
  <destination>Japan</destination>
  <dates>
    <start>October 10</start>
    <end>October 17</end>
  </dates>
  <itinerary>
    <day date="2023-10-10">
      <activities>
        <activity>Arrival in Tokyo, hotel check-in</activity>
        <activity>Meiji Shrine and Yoyogi Park</activity>
        <activity>Explore Harajuku</activity>
      </activities>
      <accommodations>Tokyo hotel</accommodations>
    </day>
    <day date="2023-10-11">
      <activities>
        <activity>Tsukiji Fish Market for breakfast</activity>
        <activity>teamLab Borderless digital art museum</activity>
        <activity>Dinner in Shibuya and Shibuya Crossing</activity>
      </activities>
      <accommodations>Tokyo hotel</accommodations>
    </day>
    <day date="2023-10-12">
      <activities>
        <activity>Imperial Palace East Gardens</activity>
        <activity>Asakusa district with Senso-ji Temple</activity>
        <activity>Akihabara for electronics and anime culture</activity>
      </activities>
      <accommodations>Tokyo hotel</accommodations>
    </day>
    <day date="2023-10-13">
      <activities>
        <activity>Travel from Tokyo to Kyoto via Shinkansen</activity>
        <activity>Kinkaku-ji (Golden Pavilion) and Ryoan-ji Temple</activity>
        <activity>Gion district exploration and dinner</activity>
      </activities>
      <accommodations>Kyoto hotel</accommodations>
    </day>
    <day date="2023-10-14">
      <activities>
        <activity>Fushimi Inari Shrine (thousand torii gates)</activity>
        <activity>Arashiyama Bamboo Grove and Tenryu-ji Temple</activity>
        <activity>Traditional kaiseki dinner experience</activity>
      </activities>
      <accommodations>Kyoto hotel</accommodations>
    </day>
    <day date="2023-10-15">
      <activities>
        <activity>Kiyomizu-dera Temple</activity>
        <activity>Nishiki Market food exploration</activity>
        <activity>Philosopher's Path and Nanzen-ji Temple</activity>
      </activities>
      <accommodations>Kyoto hotel</accommodations>
    </day>
    <day date="2023-10-16">
      <activities>
        <activity>Day trip to Nara</activity>
        <activity>Nara Park and friendly deer</activity>
        <activity>Todai-ji Temple with Great Buddha</activity>
        <activity>Kasuga-Taisha Shrine</activity>
        <activity>Isuien Garden</activity>
      </activities>
      <accommodations>Kyoto hotel</accommodations>
    </day>
    <day date="2023-10-17">
      <activities>
        <activity>Travel from Kyoto to Tokyo</activity>
        <activity>Last-minute shopping or sightseeing in Tokyo</activity>
        <activity>Departure from Japan</activity>
      </activities>
      <accommodations>None (departure day)</accommodations>
    </day>
  </itinerary>
  <notes>Flight arrives and departs from Tokyo. Japan Rail Pass might be worthwhile for the inter-city travel.</notes>
</trip>

Working memory saved to travel-itinerary-memory.xml
```

## How It Works

1. **Travel Information Storage**: We use working memory with a custom template structured for travel planning.
2. **Itinerary Structure**: The XML template organizes travel information into traveler details, dates, and a day-by-day itinerary.
3. **Incremental Building**: The itinerary is built up incrementally across multiple conversations as the user provides more details.
4. **Complex Data Relationships**: The system maintains relationships between dates, locations, and activities.
5. **Contextual Memory**: Even after several exchanges, the agent can recall specific parts of the itinerary when asked.

## Web Application Integration

In a travel planning web application, you could extend this example:

```typescript
// API endpoint for travel planning
async function travelPlannerHandler(req, res) {
  const { message, userId, tripId } = req.body;
  
  // Use userId and tripId to maintain separate itineraries for different trips
  const resourceId = `user_${userId}`;
  const threadId = `trip_${tripId}`;
  
  const response = await travelAgent.stream(message, {
    resourceId, 
    threadId
  });
  
  // Stream response to client with working memory masked
  return streamToResponse(
    maskStreamTags(response.textStream, "working_memory"),
    res
  );
}

// Function to extract itinerary data for UI display
async function getItinerary(userId, tripId) {
  const resourceId = `user_${userId}`;
  const { memory: workingMemory } = await memory.getWorkingMemory({ 
    resourceId,
    threadId: `trip_${tripId}`
  });
  
  // Parse XML to extract itinerary data
  const tripData = parseItineraryFromXML(workingMemory);
  
  return {
    destination: tripData.destination,
    dates: tripData.dates,
    dayByDay: tripData.itinerary,
    notes: tripData.notes
  };
}
```

## UI Example

A React component for a travel planning interface:

```jsx
function TravelPlannerApp() {
  const [itinerary, setItinerary] = useState(null);
  const [input, setInput] = useState("");
  const [activeDay, setActiveDay] = useState(null);
  
  // Load itinerary data
  useEffect(() => {
    async function loadItinerary() {
      const data = await getItinerary(userId, tripId);
      setItinerary(data);
    }
    
    loadItinerary();
  }, [userId, tripId]);
  
  // Send message to travel agent
  const handleSend = async () => {
    // Show that the assistant is thinking
    setIsLoading(true);
    
    // Send message to API
    await sendTravelMessage(input, userId, tripId);
    
    // Reload itinerary data
    const updatedItinerary = await getItinerary(userId, tripId);
    setItinerary(updatedItinerary);
    
    setInput("");
    setIsLoading(false);
  };
  
  return (
    <div className="travel-planner">
      <header>
        <h1>Travel Planner</h1>
        {itinerary && (
          <div className="trip-overview">
            <h2>{itinerary.destination}</h2>
            <p>{itinerary.dates.start} - {itinerary.dates.end}</p>
          </div>
        )}
      </header>
      
      <div className="main-content">
        <div className="itinerary-sidebar">
          {itinerary && itinerary.dayByDay.map(day => (
            <div 
              key={day.date} 
              className={`day-item ${activeDay === day.date ? 'active' : ''}`}
              onClick={() => setActiveDay(day.date)}
            >
              <span className="date">{formatDate(day.date)}</span>
              <span className="location">{getDayLocation(day)}</span>
            </div>
          ))}
        </div>
        
        <div className="day-details">
          {activeDay && itinerary && (
            <DayDetails 
              day={itinerary.dayByDay.find(d => d.date === activeDay)} 
            />
          )}
        </div>
      </div>
      
      <div className="assistant-chat">
        <div className="messages">
          {messages.map(msg => (
            <div key={msg.id} className={`message ${msg.role}`}>
              {msg.content}
            </div>
          ))}
        </div>
        
        <div className="input-area">
          <input 
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about your trip or add to your itinerary..."
          />
          <button onClick={handleSend} disabled={isLoading}>
            {isLoading ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

## Related Examples

- [Working Memory Example](./working-memory.md): More details on working memory
- [Conversation Example](./conversation.md): Basic memory usage
- [Todo List Example](./todo-list.md): Similar approach for task management
``` 