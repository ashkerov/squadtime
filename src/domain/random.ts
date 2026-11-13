/** Случайный индекс с весами: weightedIndex([1, 3]) вернёт 1 в 75% случаев. */
export function weightedIndex(weights: number[], random: () => number = Math.random): number {
  const total = weights.reduce((a, b) => a + Math.max(0, b), 0);
  if (total <= 0) return Math.floor(random() * weights.length);
  let r = random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= Math.max(0, weights[i]);
    if (r < 0) return i;
  }
  return weights.length - 1;
}
