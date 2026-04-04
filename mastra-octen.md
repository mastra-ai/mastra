# Mastra agentic search benchmarking: Octen vs OpenAI

## Demonstration 1: Query Comparison
**Query:** "What record did Kendrick Lamar break at the 2026 Grammy Awards?"

### Native Octen API
**Response:**\n## Kendrick Lamar's Record at the 2026 Grammy Awards

At the **68th Annual Grammy Awards** (held on February 1, 2026), Kendrick Lamar broke the record for the **most Grammy Award wins by a rapper**, surpassing **JAY-Z**.

### Key Details:
- **JAY-Z's previous record:** 25 Grammy wins
- **Kendrick Lamar's new total:** 26–27 Grammy wins (accumulating throughout the night)
- Lamar entered the ceremony with **9 nominations** and walked away with **5 wins**
- His wins included:
  - **Record of the Year** for *"luther"* (featuring SZA)
  - **Best Rap Album** for *GNX*
  - Three additional awards during the non-televised premiere ceremony

This milestone cemented Kendrick Lamar's legacy as the **most-awarded rapper in Grammy history**, a record previously held by JAY-Z.

> **Metrics:**
> - **Latency:** 4962.00 ms
> - **Input Tokens:** 2218
> - **Output Tokens:** 231
> - **Total Tokens:** 2449

### Pure OpenAI (No Tools)
**Response:**\nAs of my last update, I don't have information on events or records from the 2026 Grammy Awards. For the latest updates on Kendrick Lamar or any other artist, I recommend checking reliable news sources or the official Grammy Awards website.

> **Metrics:**
> - **Latency:** 1500.44 ms
> - **Input Tokens:** 31
> - **Output Tokens:** 48
> - **Total Tokens:** 79

### OpenAI + Octen Search Tool
**Response:**\nAt the 2026 Grammy Awards, Kendrick Lamar broke the record for the most Grammy wins by a hip-hop artist, bringing his total to 13 awards. This achievement places him alongside other music legends and highlights his significant impact on the industry.

> **Metrics:**
> - **Latency:** 4473.40 ms
> - **Input Tokens:** 3929
> - **Output Tokens:** 125
> - **Total Tokens:** 4054

---

## Demonstration 2: Query Comparison
**Query:** "Who won the latest super bowl? Be specific and concise."

### Native Octen API
**Response:**\nBased on the search results, the **Seattle Seahawks** won the most recent Super Bowl (Super Bowl LX), defeating the **New England Patriots 29-13** on **February 8, 2026**.

> **Metrics:**
> - **Latency:** 2250.36 ms
> - **Input Tokens:** 1946
> - **Output Tokens:** 49
> - **Total Tokens:** 1995

### Pure OpenAI (No Tools)
**Response:**\nThe latest Super Bowl, Super Bowl LVII, was won by the Kansas City Chiefs on February 12, 2023. They defeated the Philadelphia Eagles with a score of 38-35.

> **Metrics:**
> - **Latency:** 4168.51 ms
> - **Input Tokens:** 29
> - **Output Tokens:** 41
> - **Total Tokens:** 70

### OpenAI + Octen Search Tool
**Response:**\nThe Kansas City Chiefs won Super Bowl LVII, defeating the Philadelphia Eagles 38–35 on February 12, 2023.

> **Metrics:**
> - **Latency:** 16382.46 ms
> - **Input Tokens:** 7152
> - **Output Tokens:** 310
> - **Total Tokens:** 7462

---

