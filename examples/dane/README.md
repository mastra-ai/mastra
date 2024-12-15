# Math Operations Library

A simple JavaScript library that provides basic mathematical operations.

## Available Functions

### add(a, b)

Adds two numbers together.

- **Parameters:**
  - `a` (number): The first number
  - `b` (number): The second number
- **Returns:** The sum of a and b

### subtract(a, b)

Subtracts the second number from the first number.

- **Parameters:**
  - `a` (number): The number to subtract from
  - `b` (number): The number to subtract
- **Returns:** The difference between a and b

### multiply(a, b)

Multiplies two numbers together.

- **Parameters:**
  - `a` (number): The first number
  - `b` (number): The second number
- **Returns:** The product of a and b

### divide(a, b)

Divides the first number by the second number.

- **Parameters:**
  - `a` (number): The dividend
  - `b` (number): The divisor
- **Returns:** The quotient of a divided by b
- **Throws:** Error if the divisor is zero

### power(base, exponent)

Raises a base number to the given exponent.

- **Parameters:**
  - `base` (number): The base number
  - `exponent` (number): The exponent to raise the base to
- **Returns:** The result of base raised to the exponent

## Usage Example

```javascript
const sum = add(5, 3); // Returns 8
const diff = subtract(10, 4); // Returns 6
const prod = multiply(2, 6); // Returns 12
const quot = divide(15, 3); // Returns 5
const exp = power(2, 3); // Returns 8
```
