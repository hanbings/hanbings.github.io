import { visit } from 'unist-util-visit'

const getAttribute = (node, name) => {
  const value = node.attributes?.[name]
  return typeof value === 'string' ? value.trim() : ''
}

const createOriginal = (original, lang) => ({
  type: 'textDirective',
  name: 'term-original',
  attributes: {},
  children: [{type: 'text', value: original}],
  data: {
    hName: 'rt',
    hProperties: lang ? {lang} : {},
  },
})

export default function remarkTerms() {
  return (tree, file) => {
    visit(tree, (node) => {
      if (node.name !== 'term') return
      if (
        node.type !== 'containerDirective' &&
        node.type !== 'leafDirective' &&
        node.type !== 'textDirective'
      ) return

      if (node.type !== 'textDirective') {
        file.fail(
          '术语标注是行内内容，请使用 :term[] 而不是块级指令',
          node,
          'remark-terms:unexpected-block-directive',
        )
      }

      const original = getAttribute(node, 'original')
      if (!original) {
        file.fail(
          '术语标注需要 original 属性，例如 :term[虚拟机]{original="virtual machine"}',
          node,
          'remark-terms:missing-original',
        )
      }
      if (node.children.length === 0) {
        file.fail(
          '术语标注需要显示名称，例如 :term[虚拟机]{original="virtual machine"}',
          node,
          'remark-terms:missing-term',
        )
      }

      const lang = getAttribute(node, 'lang')
      const data = node.data || (node.data = {})
      data.hName = 'ruby'
      data.hProperties = {
        className: ['term-with-original'],
        title: `原文：${original}`,
      }
      node.children.push(createOriginal(original, lang))
    })
  }
}
