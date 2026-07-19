const colorCount = 64

export const createSidenoteColorIndex = (key: string) => {
  let hash = 2166136261
  for (const character of key.trim() || 'sidenote') {
    hash ^= character.codePointAt(0) ?? 0
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) % colorCount
}

export const createSidenoteColor = (colorIndex: number) => {
  const normalizedIndex = ((colorIndex % colorCount) + colorCount) % colorCount
  const hue = (normalizedIndex * 360) / colorCount
  const saturation = 48 + ((normalizedIndex * 7) % 4) * 4
  const lightness = 88 + ((normalizedIndex * 11) % 3) * 2
  return `hsl(${hue} ${saturation}% ${lightness}%)`
}

export const sidenoteColorCount = colorCount
