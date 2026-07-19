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

export interface PianoKeyModel {
  note: string
  label: string
  kind: 'white' | 'black'
  pressed: boolean
}

export interface PianoKeySlotModel {
  keys: PianoKeyModel[]
}

export interface PianoModel {
  title: string
  status: string
  hasSelectedNotes: boolean
  slots: PianoKeySlotModel[]
}

interface PianoOptions {
  title?: string
  notes?: string | string[]
  octave?: number
  octaves?: number
}

const assertInteger = (value: number, name: string, minimum: number, maximum: number) => {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`[Piano] ${name} 必须是 ${minimum} 到 ${maximum} 之间的整数`)
  }
}

const parseNote = (value: string) => {
  const match = notePattern.exec(value)
  if (!match) {
    throw new Error(`[Piano] 无法识别音符“${value}”，请使用 C4、C#4 或 Db4 这样的科学音高记号`)
  }

  const [, letterValue, accidental, octaveValue] = match
  const letter = letterValue.toUpperCase()
  const octave = Number(octaveValue)
  const accidentalOffset =
    accidental === '#' || accidental === '♯' ? 1 : accidental === 'b' || accidental === '♭' ? -1 : 0
  const midi = (octave + 1) * 12 + (pitchValues.get(letter) ?? 0) + accidentalOffset

  if (midi < 12 || midi > 107) {
    throw new Error(`[Piano] 音符“${value}”超出支持的 C0 到 B7 音域`)
  }
  return midi
}

const getNoteName = (midi: number, unicode = false) => {
  const pitch = pitchNames[midi % 12]
  const name = unicode ? pitch : pitch.replace('♯', '#')
  return `${name}${Math.floor(midi / 12) - 1}`
}

const normalizeNotes = (notes: string | string[] | undefined) => {
  const values = Array.isArray(notes) ? notes : [notes ?? '']
  return values.flatMap((value) => value.split(/[\s,，、]+/u).filter(Boolean))
}

const createStatus = (selectedNotes: Set<number>) => {
  const labels = [...selectedNotes]
    .sort((left, right) => left - right)
    .map((midi) => getNoteName(midi, true))
  return labels.length > 0 ? `按下：${labels.join('、')}` : '尚未按下音符'
}

export const createPianoModel = ({
  title = '钢琴窗',
  notes,
  octave = 4,
  octaves = 2,
}: PianoOptions): PianoModel => {
  assertInteger(octave, 'octave', 0, 7)
  assertInteger(octaves, 'octaves', 1, 4)
  if (octave + octaves > 8) {
    throw new Error('[Piano] octave 与 octaves 的组合不能超过 B7')
  }

  const normalizedTitle = title.trim() || '钢琴窗'
  const startMidi = (octave + 1) * 12
  const endMidi = startMidi + octaves * 12 - 1
  const selectedNotes = new Set<number>()
  for (const value of normalizeNotes(notes)) {
    const midi = parseNote(value)
    if (midi < startMidi || midi > endMidi) {
      throw new Error(
        `[Piano] 音符“${value}”不在当前钢琴窗的 ${getNoteName(startMidi)} 到 ${getNoteName(endMidi)} 音域内`,
      )
    }
    selectedNotes.add(midi)
  }

  const slots: PianoKeySlotModel[] = []
  for (let currentOctave = octave; currentOctave < octave + octaves; currentOctave += 1) {
    for (const naturalNote of naturalNotes) {
      const midi = (currentOctave + 1) * 12 + naturalNote.semitone
      const keys: PianoKeyModel[] = [
        {
          note: getNoteName(midi),
          label: getNoteName(midi, true),
          kind: 'white',
          pressed: selectedNotes.has(midi),
        },
      ]
      if (naturalNote.hasSharp) {
        keys.push({
          note: getNoteName(midi + 1),
          label: getNoteName(midi + 1, true),
          kind: 'black',
          pressed: selectedNotes.has(midi + 1),
        })
      }
      slots.push({keys})
    }
  }

  return {
    title: normalizedTitle,
    status: createStatus(selectedNotes),
    hasSelectedNotes: selectedNotes.size > 0,
    slots,
  }
}
