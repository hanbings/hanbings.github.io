const interactiveSelector = 'a, button, input, select, textarea, summary, [role="button"]'

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

export const enhanceSidenoteStacks = () => {
    document.querySelectorAll<HTMLElement>('[data-sidenote-stack]').forEach((stack) => {
        if (stack.dataset.sidenoteReady) return

        const stackId = stack.dataset.sidenoteStack
        if (!stackId) return

        const cards = Array.from(
            stack.querySelectorAll<HTMLElement>(':scope > [data-sidenote-stack-card]'),
        )
        const anchors = Array.from(document.querySelectorAll<HTMLElement>(
            `[data-sidenote-stack-anchor="${CSS.escape(stackId)}"]`,
        ))
        if (cards.length < 2 || anchors.length === 0) return

        let activeIndex = Number.parseInt(stack.dataset.sidenoteActive || '0', 10)
        if (!Number.isInteger(activeIndex) || activeIndex < 0 || activeIndex >= cards.length) {
            activeIndex = 0
        }

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

            const activeCard = cards[activeIndex]
            const activeColor = activeCard.style.getPropertyValue('--sidenote-color')
            anchors.forEach((anchor) => {
                const shared = anchor.dataset.sidenoteStackShared === 'true'
                const anchorIndex = Number.parseInt(anchor.dataset.sidenoteStackIndex || '-1', 10)
                anchor.classList.toggle('is-active', shared || anchorIndex === activeIndex)
                if (shared && activeColor) {
                    anchor.style.setProperty('--sidenote-color', activeColor)
                }
            })
        }

        const showNext = () => showCard(activeIndex + 1)

        stack.addEventListener('click', (event) => {
            const target = event.target
            if (!(target instanceof Element)) return
            if (target.closest(interactiveSelector)) return
            if (target.closest('[data-sidenote-stack-card]')) showNext()
        })
        stack.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return
            if (event.target !== cards[activeIndex]) return
            event.preventDefault()
            showNext()
            cards[activeIndex].focus({preventScroll: true})
        })

        anchors.forEach((anchor) => {
            const anchorIndex = Number.parseInt(anchor.dataset.sidenoteStackIndex || '-1', 10)
            if (anchorIndex < 0 || anchorIndex >= cards.length) return
            anchor.addEventListener('mouseover', (event) => {
                const target = event.target
                if (!(target instanceof Element)) return
                if (target.closest('[data-sidenote-stack-anchor]') !== anchor) return
                showCard(anchorIndex)
            })
            anchor.addEventListener('focus', () => showCard(anchorIndex))
        })

        stack.dataset.sidenoteReady = 'true'
        showCard(activeIndex)
    })
}
