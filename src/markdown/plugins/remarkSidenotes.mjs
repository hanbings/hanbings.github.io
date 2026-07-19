import { visit } from 'unist-util-visit'

const colorCount = 64
const labelProperties = {className: ['sidenote-label']}
const sidenoteBlockTypes = new Set(['containerDirective', 'leafDirective'])

const isSidenoteBlock = (node) =>
  node?.name === 'sidenote' && sidenoteBlockTypes.has(node.type)
const isSidenoteAnchor = (node) =>
  node?.name === 'sidenote' && node.type === 'textDirective'

const createLabel = (block) => ({
  type: block ? 'paragraph' : 'textDirective',
  ...(block ? {} : {name: 'sidenote-label', attributes: {}}),
  children: [{type: 'text', value: '附记'}],
  data: {
    hName: 'span',
    hProperties: labelProperties,
  },
})

const applyLabel = (node) => {
  const firstChild = node.children[0]
  if (node.type === 'containerDirective' && firstChild?.data?.directiveLabel) {
    firstChild.data.hName = 'span'
    firstChild.data.hProperties = labelProperties
    return
  }

  node.children.unshift(createLabel(node.type === 'containerDirective'))
  if (node.type === 'leafDirective') {
    node.children.splice(1, 0, {type: 'text', value: ' '})
  }
}

const getText = (node) => {
  if (typeof node.value === 'string') return node.value
  if (typeof node.alt === 'string') return node.alt
  return node.children?.map(getText).join('') ?? ''
}

const createColorIndex = (node) => {
  const text = getText(node).trim()
  const key = text || JSON.stringify(node, (property, value) =>
    property === 'data' || property === 'position' ? undefined : value)
  let hash = 2166136261

  for (const character of key) {
    hash ^= character.codePointAt(0)
    hash = Math.imul(hash, 16777619)
  }

  return (hash >>> 0) % colorCount
}

const createColorStyle = (colorIndex) => {
  const hue = (colorIndex * 360) / colorCount
  const saturation = 48 + ((colorIndex * 7) % 4) * 4
  const lightness = 88 + ((colorIndex * 11) % 3) * 2
  return `--sidenote-color: hsl(${hue} ${saturation}% ${lightness}%);`
}

const createGroupColorIndexes = (nodes, colorIndexes) => {
  const used = new Set()

  return nodes.map((node) => {
    let colorIndex = colorIndexes.get(node)
    let attempts = 0
    while (used.has(colorIndex) && attempts < colorCount) {
      colorIndex = (colorIndex + 1) % colorCount
      attempts += 1
    }
    used.add(colorIndex)
    return colorIndex
  })
}

const getStackPlacement = (depth) => {
  const placements = [
    {x: 0, y: 0, rotation: 0},
    {x: 0.4, y: 0.3, rotation: 1.25},
    {x: -0.3, y: 0.55, rotation: -1.1},
    {x: 0.55, y: 0.75, rotation: 1.8},
  ]
  return placements[Math.min(depth, placements.length - 1)]
}

const applySidenote = (node, colorStyle, properties = {}) => {
  const data = node.data || (node.data = {})
  data.hName = 'aside'
  data.hProperties = {
    className: ['sidenote'],
    style: colorStyle,
    role: 'note',
    tabIndex: 0,
    ...properties,
  }
}

const applyInlineAnchor = (node, colorStyle, properties = {}) => {
  const data = node.data || (node.data = {})
  data.hName = 'span'
  data.hProperties = {
    className: ['sidenote-anchor-text', 'is-active'],
    style: colorStyle,
    tabIndex: 0,
    ...properties,
  }
}

const wrapParagraphAnchor = (anchor, colorStyle, properties = {}) => {
  anchor.children = [{
    type: 'textDirective',
    name: 'sidenote-anchor',
    attributes: {},
    children: anchor.children,
    data: {
      hName: 'span',
      hProperties: {
        className: ['sidenote-anchor-text', 'is-active'],
        style: colorStyle,
        tabIndex: 0,
        ...properties,
      },
    },
  }]
}

const collectInlineAnchors = (node, anchors = []) => {
  for (const child of node.children ?? []) {
    if (isSidenoteAnchor(child)) anchors.push(child)
    collectInlineAnchors(child, anchors)
  }
  return anchors
}

const applyAnchors = (
  anchor,
  colorStyles,
  file,
  usedAnchors,
  stackId,
) => {
  const inlineAnchors = collectInlineAnchors(anchor)
  if (inlineAnchors.length === 0) {
    wrapParagraphAnchor(anchor, colorStyles[0], stackId ? {
      className: ['sidenote-anchor-text', 'sidenote-stack-anchor-text', 'is-active'],
      dataSidenoteStackAnchor: stackId,
      dataSidenoteStackShared: 'true',
    } : {})
    return
  }

  if (inlineAnchors.length !== colorStyles.length) {
    file.fail(
      `这里有 ${colorStyles.length} 条附记，因此对应正文需要同样数量的 :sidenote[] 行内标记；当前找到 ${inlineAnchors.length} 个`,
      anchor,
      'remark-sidenotes:anchor-count-mismatch',
    )
  }

  inlineAnchors.forEach((inlineAnchor, index) => {
    usedAnchors.add(inlineAnchor)
    applyInlineAnchor(inlineAnchor, colorStyles[index], stackId ? {
      className: [
        'sidenote-anchor-text',
        'sidenote-stack-anchor-text',
        ...(index === 0 ? ['is-active'] : []),
      ],
      dataSidenoteStackAnchor: stackId,
      dataSidenoteStackIndex: String(index),
    } : {})
  })
}

const createStack = (nodes, colorIndexes, stackId) => {
  const visibleDepth = Math.min(nodes.length - 1, 3)
  const overhang = getStackPlacement(visibleDepth).y

  nodes.forEach((node, index) => {
    const placement = getStackPlacement(index)
    const colorStyle = createColorStyle(colorIndexes[index])
    const stackStyle = [
      colorStyle,
      `--sidenote-stack-x: ${placement.x}rem;`,
      `--sidenote-stack-y: ${placement.y}rem;`,
      `--sidenote-stack-rotation: ${placement.rotation}deg;`,
      `--sidenote-stack-layer: ${nodes.length - index};`,
    ].join(' ')

    applySidenote(node, stackStyle, {
      className: [
        'sidenote',
        'sidenote-stack-card',
        ...(index === 0 ? ['is-active'] : []),
      ],
      tabIndex: index === 0 ? 0 : -1,
      dataSidenoteStackCard: stackId,
      dataSidenoteStackIndex: String(index),
      ...(index === 0 ? {} : {ariaHidden: 'true', inert: true}),
    })
  })

  return {
    type: 'containerDirective',
    name: 'sidenote-stack',
    attributes: {},
    children: nodes,
    data: {
      hName: 'div',
      hProperties: {
        className: ['sidenote-stack'],
        dataSidenoteStack: stackId,
        dataSidenoteActive: '0',
        style: `--sidenote-stack-overhang: ${overhang}rem;`,
      },
      sidenoteStackGenerated: true,
    },
  }
}

const processSidenoteGroups = (
  parent,
  file,
  colorIndexes,
  usedAnchors,
  nextStackId,
) => {
  if (!Array.isArray(parent.children) || parent.data?.sidenoteStackGenerated) return

  for (let index = 0; index < parent.children.length;) {
    if (!colorIndexes.has(parent.children[index])) {
      index += 1
      continue
    }

    const start = index
    while (index < parent.children.length && colorIndexes.has(parent.children[index])) {
      index += 1
    }

    const notes = parent.children.slice(start, index)
    const anchor = parent.children[index]
    if (anchor?.type !== 'paragraph') {
      file.fail(
        '附记后面必须紧跟与它对应的正文段落',
        notes[0],
        'remark-sidenotes:missing-anchor',
      )
    }

    if (notes.length === 1) {
      const colorStyle = createColorStyle(colorIndexes.get(notes[0]))
      applySidenote(notes[0], colorStyle)
      applyAnchors(anchor, [colorStyle], file, usedAnchors)
      index += 1
      continue
    }

    const stackId = nextStackId()
    const groupColorIndexes = createGroupColorIndexes(notes, colorIndexes)
    const colorStyles = groupColorIndexes.map(createColorStyle)
    const stack = createStack(notes, groupColorIndexes, stackId)
    parent.children.splice(start, notes.length, stack)
    applyAnchors(anchor, colorStyles, file, usedAnchors, stackId)
    index = start + 2
  }

  for (const child of parent.children) {
    processSidenoteGroups(child, file, colorIndexes, usedAnchors, nextStackId)
  }
}

export default function remarkSidenotes() {
  return (tree, file) => {
    const colorIndexes = new Map()
    const usedAnchors = new Set()
    let stackSequence = 0

    visit(tree, (node) => {
      if (!isSidenoteBlock(node)) return
      colorIndexes.set(node, createColorIndex(node))
      applyLabel(node)
    })

    processSidenoteGroups(
      tree,
      file,
      colorIndexes,
      usedAnchors,
      () => `sidenote-stack-${++stackSequence}`,
    )

    visit(tree, (node) => {
      if (!isSidenoteAnchor(node) || usedAnchors.has(node)) return
      file.fail(
        '行内 :sidenote[] 必须位于一条或一组块级附记后面的正文段落中',
        node,
        'remark-sidenotes:orphan-anchor',
      )
    })
  }
}
