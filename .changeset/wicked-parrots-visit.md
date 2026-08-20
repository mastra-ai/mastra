---
'@mastra/factory': minor
---

Fixed the Factory overview reporting an empty board while the board was full.

"The board right now" counted work-board cards only, while the chart and the attention list directly beneath it counted every card. A Factory whose work all arrives as pull requests read "0 waiting to start, 0 in flight" above a list of seventeen threads waiting on a person. Delivery is split between the two boards because reviewing and building take different amounts of time — but what the board is holding this second is one number, and it is now read once, off the same snapshot the chart and the list are drawn from.

**Empty states**

A window nothing entered says so in one line instead of printing five zeroes and three em dashes. A figure with no history behind it draws no sparkline, where a flat line along the floor used to show a run of zeroes that never happened. The review row appears only on a Factory that reviews. And every caption that restated the number above it is gone.
