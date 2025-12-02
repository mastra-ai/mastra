// This file contains setup code for tests
import { vi } from "vitest";

// Set up global mocks if needed
// Using a fixed date to avoid recursive calls
const OriginalDate = global.Date;
const fixedDate = new OriginalDate("2023-01-01");
global.Date = vi.fn(() => fixedDate) as any;
global.Date.now = vi.fn(() => fixedDate.getTime());

// Add any other global setup needed for tests
