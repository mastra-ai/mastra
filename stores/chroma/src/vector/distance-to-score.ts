export function distanceToScore(distance: number, metric: 'cosine' | 'euclidean' | 'dotproduct'): number {
  switch (metric) {
    case 'euclidean':
      return 1 / (1 + Math.sqrt(distance));
    case 'dotproduct':
    case 'cosine':
    default:
      return 1 - distance;
  }
}
