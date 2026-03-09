export const getBadgeType = (tags: any) => {
  if (!tags || tags.length === 0) return null
  if (tags.includes('new')) return 'new'
  if (tags.includes('beta')) return 'beta'
  if (tags.includes('advanced')) return 'advanced'
  if (tags.includes('alpha')) return 'alpha'
  return null
}
