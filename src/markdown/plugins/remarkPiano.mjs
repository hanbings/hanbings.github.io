import { visit } from 'unist-util-visit'

const naturalNotes = [
  {name: 'C', semitone: 0, hasSharp: true},
  {name: 'D', semitone: 2, hasSharp: true},
  {name: 'E', semitone: 4, hasSharp: false},
  {name: 'F', semitone: 5, hasSharp: true},
  {name: 'G', semitone: 7, hasSharp: true},
  {name: 'A', semitone: 9, hasSharp: true},
  {name: 'B', semitone: 11, hasSharp: false},
]
const pitchNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
const pitchValues = new Map(naturalNotes.map(({name, semitone}) => [name, semitone]))
const notePattern = /^([A-Ga-g])([#♯b♭]?)(-?\d+)$/u

const getAttribute = (node, name) => {
  const value = node.attributes?.[name]
  return typeof value === 'string' ? value.trim() : ''
}

const parseIntegerAttribute = (node, name, fallback, minimum, maximum, file) => {
  const value = getAttribute(node, name)
  if (!value) return fallback

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    file.fail(
      `钢琴窗的 ${name} 属性必须是 ${minimum} 到 ${maximum} 之间的整数`,
      node,
      `remark-piano:invalid-${name}`,
    )
  }
  return parsed
}

const parseNote = (value, node, file) => {
  const match = notePattern.exec(value)
  if (!match) {
    file.fail(
      `无法识别音符“${value}”，请使用 C4、C#4 或 Db4 这样的科学音高记号`,
      node,
      'remark-piano:invalid-note',
    )
  }

  const [, letterValue, accidental, octaveValue] = match
  const letter = letterValue.toUpperCase()
  const octave = Number(octaveValue)
  const accidentalOffset = accidental === '#' || accidental === '♯'
    ? 1
    : accidental === 'b' || accidental === '♭'
      ? -1
      : 0
  const midi = (octave + 1) * 12 + pitchValues.get(letter) + accidentalOffset

  if (midi < 12 || midi > 107) {
    file.fail(
      `音符“${value}”超出钢琴窗支持的 C0 到 B7 音域`,
      node,
      'remark-piano:unsupported-note',
    )
  }
  return midi
}

const getNoteName = (midi, unicode = false) => {
  const pitch = pitchNames[midi % 12]
  const name = unicode ? pitch : pitch.replace('♯', '#')
  return `${name}${Math.floor(midi / 12) - 1}`
}

const getText = (node) => {
  if (typeof node.value === 'string') return node.value
  return node.children?.map(getText).join('') ?? ''
}

const createElement = (name, hName, hProperties, children = []) => ({
  type: 'containerDirective',
  name,
  attributes: {},
  children,
  data: {hName, hProperties},
})

const createTextElement = (name, hName, hProperties, text) => ({
  type: 'textDirective',
  name,
  attributes: {},
  children: [{type: 'text', value: text}],
  data: {hName, hProperties},
})

const createKey = (midi, kind, selectedNotes) => {
  const note = getNoteName(midi)
  const label = getNoteName(midi, true)
  return createTextElement(
    `piano-${kind}-key`,
    'button',
    {
      type: 'button',
      className: ['piano-key', `piano-key-${kind}`],
      'data-note': note,
      'data-note-label': label,
      ariaLabel: `${label} 琴键`,
      ariaPressed: selectedNotes.has(midi) ? 'true' : 'false',
    },
    label,
  )
}

const createKeyboard = (startOctave, octaveCount, selectedNotes, title) => {
  const slots = []
  for (let octave = startOctave; octave < startOctave + octaveCount; octave += 1) {
    for (const note of naturalNotes) {
      const midi = (octave + 1) * 12 + note.semitone
      const keys = [createKey(midi, 'white', selectedNotes)]
      if (note.hasSharp) keys.push(createKey(midi + 1, 'black', selectedNotes))
      slots.push(createElement('piano-key-slot', 'div', {className: ['piano-key-slot']}, keys))
    }
  }

  return createElement(
    'piano-keyboard',
    'div',
    {
      className: ['piano-keyboard'],
      role: 'group',
      ariaLabel: `${title}琴键`,
    },
    slots,
  )
}

const createStatusText = (selectedNotes) => {
  const labels = [...selectedNotes].sort((left, right) => left - right).map((midi) => getNoteName(midi, true))
  return labels.length > 0 ? `按下：${labels.join('、')}` : '尚未按下音符'
}

export default function remarkPiano() {
  return (tree, file) => {
    visit(tree, (node) => {
      if (node.name !== 'piano') return
      if (
        node.type !== 'containerDirective' &&
        node.type !== 'leafDirective' &&
        node.type !== 'textDirective'
      ) return

      if (node.type !== 'leafDirective') {
        file.fail(
          '钢琴窗是独立块，请使用 ::piano[标题]{notes="C4 E4 G4"}',
          node,
          'remark-piano:unexpected-directive',
        )
      }

      const startOctave = parseIntegerAttribute(node, 'octave', 4, 0, 7, file)
      const octaveCount = parseIntegerAttribute(node, 'octaves', 2, 1, 4, file)
      if (startOctave + octaveCount > 8) {
        file.fail(
          '钢琴窗的 octave 与 octaves 组合不能超过 B7',
          node,
          'remark-piano:unsupported-range',
        )
      }

      const startMidi = (startOctave + 1) * 12
      const endMidi = startMidi + octaveCount * 12 - 1
      const selectedNotes = new Set()
      const notes = getAttribute(node, 'notes')
      for (const value of notes.split(/[\s,，、]+/u).filter(Boolean)) {
        const midi = parseNote(value, node, file)
        if (midi < startMidi || midi > endMidi) {
          file.fail(
            `音符“${value}”不在当前钢琴窗的 ${getNoteName(startMidi)} 到 ${getNoteName(endMidi)} 音域内`,
            node,
            'remark-piano:note-out-of-range',
          )
        }
        selectedNotes.add(midi)
      }

      const titleChildren = node.children.length > 0
        ? node.children
        : [{type: 'text', value: '钢琴窗'}]
      const title = titleChildren.map(getText).join('').trim() || '钢琴窗'
      const status = createStatusText(selectedNotes)

      node.data = {
        hName: 'figure',
        hProperties: {className: ['piano-window']},
      }
      node.children = [
        createElement('piano-caption', 'figcaption', {className: ['piano-caption']}, titleChildren),
        createElement('piano-toolbar', 'div', {className: ['piano-toolbar']}, [
          createTextElement(
            'piano-status',
            'output',
            {
              className: ['piano-status'],
              ariaLive: 'polite',
              ariaAtomic: 'true',
            },
            status,
          ),
          createTextElement(
            'piano-reset',
            'button',
            {
              type: 'button',
              className: ['piano-reset'],
              disabled: selectedNotes.size === 0,
            },
            '清空',
          ),
        ]),
        createElement('piano-keyboard-scroll', 'div', {className: ['piano-keyboard-scroll']}, [
          createKeyboard(startOctave, octaveCount, selectedNotes, title),
        ]),
      ]
    })
  }
}
