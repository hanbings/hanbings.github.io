import {createSidenoteColor, sidenoteColorCount} from './colors'

const interactiveSelector = 'a, button, input, select, textarea, summary, [role="button"]'
const groupSelector = '[data-sidenote-group]'

const stackPlacements = [
  {x: 0, y: 0, rotation: 0},
  {x: 0.4, y: 0.3, rotation: 1.25},
  {x: -0.3, y: 0.55, rotation: -1.1},
  {x: 0.55, y: 0.75, rotation: 1.8},
]

const setCardDepth = (card: HTMLElement, depth: number, count: number) => {
  const placement = stackPlacements[Math.min(depth, stackPlacements.length - 1)]
  card.style.setProperty('--sidenote-stack-x', `${placement.x}rem`)
  card.style.setProperty('--sidenote-stack-y', `${placement.y}rem`)
  card.style.setProperty('--sidenote-stack-rotation', `${placement.rotation}deg`)
  card.style.setProperty('--sidenote-stack-layer', String(count - depth))
}

const collectCards = (group: HTMLElement): HTMLElement[] => {
  const card = group.querySelector<HTMLElement>(':scope > [data-sidenote-stack-card]')
  if (!card) return []

  const nestedGroups = Array.from(card.querySelectorAll<HTMLElement>(groupSelector)).filter(
    (nested) => nested.parentElement?.closest(groupSelector) === group,
  )
  const cards = [card]
  nestedGroups.forEach((nested) => {
    cards.push(...collectCards(nested))
    nested.remove()
  })
  return cards
}

const ensureDistinctColors = (cards: HTMLElement[]) => {
  const used = new Set<number>()
  cards.forEach((card) => {
    const value = card.dataset.sidenoteColorIndex
    if (value === undefined || card.dataset.sidenoteCustomColor === 'true') return

    let colorIndex = Number.parseInt(value, 10)
    let attempts = 0
    while (used.has(colorIndex) && attempts < sidenoteColorCount) {
      colorIndex = (colorIndex + 1) % sidenoteColorCount
      attempts += 1
    }
    used.add(colorIndex)
    card.dataset.sidenoteColorIndex = String(colorIndex)
    card.style.setProperty('--sidenote-color', createSidenoteColor(colorIndex))
  })
}

export const enhanceSidenote = (stack: HTMLElement) => {
  if (stack.dataset.sidenoteReady || stack.parentElement?.closest(groupSelector)) return

  const cards = collectCards(stack)
  if (cards.length === 0) return
  cards.slice(1).forEach((card) => stack.append(card))
  stack.classList.add('sidenote-stack')
  stack.setAttribute('data-sidenote-stack', '')
  stack.dataset.sidenoteActive = '0'

  const textContainer = stack.nextElementSibling
  const anchors = textContainer
    ? Array.from(textContainer.querySelectorAll<HTMLElement>('[data-sidenote-text]'))
    : []
  ensureDistinctColors(cards)
  anchors.forEach((anchor, index) => {
    const color = cards[index]?.style.getPropertyValue('--sidenote-color')
    if (color) anchor.style.setProperty('--sidenote-color', color)
  })

  const overhang = stackPlacements[Math.min(cards.length - 1, stackPlacements.length - 1)].y
  stack.style.setProperty('--sidenote-stack-overhang', `${overhang}rem`)
  let activeIndex = 0

  const showCard = (nextIndex: number) => {
    activeIndex = (nextIndex + cards.length) % cards.length
    stack.dataset.sidenoteActive = String(activeIndex)

    cards.forEach((card, index) => {
      const depth = (index - activeIndex + cards.length) % cards.length
      const active = depth === 0
      card.classList.toggle('is-active', active)
      card.tabIndex = active ? 0 : -1
      card.toggleAttribute('inert', !active)
      if (active) card.removeAttribute('aria-hidden')
      else card.setAttribute('aria-hidden', 'true')
      setCardDepth(card, depth, cards.length)
    })

    anchors.forEach((anchor, index) => {
      anchor.classList.toggle('is-active', index === activeIndex)
    })
  }

  const showAnchorCard = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return
    const anchor = target.closest<HTMLElement>('[data-sidenote-text]')
    if (!anchor || !textContainer?.contains(anchor)) return
    const index = anchors.indexOf(anchor)
    if (index >= 0 && index < cards.length) showCard(index)
  }

  stack.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof Element)) return
    if (target.closest(interactiveSelector)) return
    if (target.closest('[data-sidenote-stack-card]')) showCard(activeIndex + 1)
  })
  stack.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    if (event.target !== cards[activeIndex]) return
    event.preventDefault()
    showCard(activeIndex + 1)
    cards[activeIndex].focus({preventScroll: true})
  })
  textContainer?.addEventListener('mouseover', (event) => showAnchorCard(event.target))
  textContainer?.addEventListener('focusin', (event) => showAnchorCard(event.target))

  stack.dataset.sidenoteReady = 'true'
  showCard(activeIndex)
}
