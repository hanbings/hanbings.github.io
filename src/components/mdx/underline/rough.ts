import {annotate} from 'rough-notation'

type RoughPadding = number | [number, number] | [number, number, number, number]

const parseNumber = (value: string | undefined, fallback: number, minimum = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(minimum, parsed) : fallback
}

const parsePadding = (value: string | undefined): RoughPadding => {
  if (!value) return [0, 0, 1, 0]

  try {
    const parsed = JSON.parse(value)
    if (typeof parsed === 'number') return parsed
    if (!Array.isArray(parsed)) return [0, 0, 1, 0]
    if (parsed.length !== 2 && parsed.length !== 4) return [0, 0, 1, 0]
    if (!parsed.every((item) => typeof item === 'number' && Number.isFinite(item))) {
      return [0, 0, 1, 0]
    }
    return parsed as RoughPadding
  } catch {
    return [0, 0, 1, 0]
  }
}

export const enhanceRoughUnderline = (element: HTMLElement) => {
  if (element.dataset.roughUnderlineReady) return

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const annotation = annotate(element, {
    type: 'underline',
    color: element.dataset.roughUnderlineColor || 'var(--theme-accent)',
    strokeWidth: parseNumber(element.dataset.roughUnderlineStrokeWidth, 2, 0.5),
    iterations: Math.round(parseNumber(element.dataset.roughUnderlineIterations, 2, 1)),
    padding: parsePadding(element.dataset.roughUnderlinePadding),
    animationDuration: parseNumber(element.dataset.roughUnderlineDuration, 500),
    multiline: element.dataset.roughUnderlineMultiline !== 'false',
    animate: !reduceMotion && element.dataset.roughUnderlineAnimate !== 'false',
  })

  const annotationSvg = element.nextElementSibling
  if (annotationSvg?.classList.contains('rough-annotation')) {
    annotationSvg.setAttribute('aria-hidden', 'true')
    annotationSvg.setAttribute('focusable', 'false')
  }

  annotation.show()
  element.dataset.roughUnderlineReady = 'true'
}
