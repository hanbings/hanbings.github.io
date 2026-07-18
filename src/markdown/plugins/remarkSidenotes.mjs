import { visit } from 'unist-util-visit'

const colorCount = 8
const labelProperties = {className: ['sidenote-label']}

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

const selectColor = (node) => {
  const key = JSON.stringify(node, (property, value) =>
    property === 'data' || property === 'position' ? undefined : value)
  let hash = 2166136261

  for (const character of key) {
    hash ^= character.codePointAt(0)
    hash = Math.imul(hash, 16777619)
  }

  return `sidenote-color-${(hash >>> 0) % colorCount}`
}

const applyAnchor = (index, parent, color, file, node) => {
  const anchor = typeof index === 'number' ? parent?.children[index + 1] : undefined
  if (anchor?.type !== 'paragraph') {
    file.fail(
      '附记后面必须紧跟与它对应的正文段落',
      node,
      'remark-sidenotes:missing-anchor',
    )
  }

  anchor.children = [{
    type: 'textDirective',
    name: 'sidenote-anchor',
    attributes: {},
    children: anchor.children,
    data: {
      hName: 'span',
      hProperties: {
        className: ['sidenote-anchor-text', color],
        tabIndex: 0,
      },
    },
  }]
}

export default function remarkSidenotes() {
  return (tree, file) => {
    visit(tree, (node, index, parent) => {
      if (node.name !== 'sidenote') return
      if (
        node.type !== 'containerDirective' &&
        node.type !== 'leafDirective' &&
        node.type !== 'textDirective'
      ) return

      if (node.type === 'textDirective') {
        file.fail(
          '附记是块级内容，请使用 :::sidenote 容器或 ::sidenote[] 叶指令',
          node,
          'remark-sidenotes:unexpected-text-directive',
        )
      }

      const color = selectColor(node)
      const data = node.data || (node.data = {})
      data.hName = 'aside'
      data.hProperties = {
        className: ['sidenote', color],
        role: 'note',
        tabIndex: 0,
      }
      applyLabel(node)
      applyAnchor(index, parent, color, file, node)
    })
  }
}
