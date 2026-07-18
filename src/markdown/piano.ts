const getPressedKeys = (keys: HTMLButtonElement[]) => (
    keys.filter((key) => key.getAttribute('aria-pressed') === 'true')
)

const updatePiano = (
    keys: HTMLButtonElement[],
    status: HTMLOutputElement,
    reset: HTMLButtonElement,
) => {
    const labels = getPressedKeys(keys)
        .map((key) => key.dataset.noteLabel)
        .filter((label): label is string => Boolean(label))

    status.textContent = labels.length > 0
        ? `按下：${labels.join('、')}`
        : '尚未按下音符'
    reset.disabled = labels.length === 0
}

export const enhancePianos = () => {
    document.querySelectorAll<HTMLElement>('.markdown-body .piano-window').forEach((piano) => {
        if (piano.dataset.pianoReady) return

        const keys = Array.from(piano.querySelectorAll<HTMLButtonElement>('.piano-key'))
        const status = piano.querySelector<HTMLOutputElement>('.piano-status')
        const reset = piano.querySelector<HTMLButtonElement>('.piano-reset')
        if (!status || !reset || keys.length === 0) return

        keys.forEach((key) => {
            key.addEventListener('click', () => {
                const pressed = key.getAttribute('aria-pressed') === 'true'
                key.setAttribute('aria-pressed', String(!pressed))
                updatePiano(keys, status, reset)
            })
        })

        reset.addEventListener('click', () => {
            getPressedKeys(keys).forEach((key) => key.setAttribute('aria-pressed', 'false'))
            updatePiano(keys, status, reset)
            keys[0]?.focus()
        })

        piano.dataset.pianoReady = 'true'
        updatePiano(keys, status, reset)
    })
}
