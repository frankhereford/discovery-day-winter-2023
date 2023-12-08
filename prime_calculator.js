// Function to check if a number is prime
function isPrime(num) {
  // Check if number is less than 2, then it's not prime
  if (num < 2) return false;

  // Check from 2 to the square root of the number
  for (let i = 2; i <= Math.sqrt(num); i++) {
    // If divisible by any number, then it's not prime
    if (num % i === 0) return false;
  }

  // If it passes all checks, it's prime
  return true;
}

// Function to calculate the first 20 prime numbers
function first20Primes() {
  let primes = [];
  let num = 2; // Start checking from 2

  // Continue until we find 20 prime numbers
  while (primes.length < 20) {
    // If the number is prime, add it to the array
    if (isPrime(num)) primes.push(num);
    num++; // Move to the next number
  }
  return primes;
}

// Display the first 20 prime numbers
console.log(first20Primes());