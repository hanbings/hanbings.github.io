import { visit } from 'unist-util-visit'

const directiveTypes = new Set([
  'containerDirective',
  'leafDirective',
  'textDirective',
])

export default function remarkValidateDirectives() {
  return (tree, file) => {
    visit(tree, (node) => {
      if (!directiveTypes.has(node.type) || node.data?.hName) return

      file.fail(
        `未知的 Markdown 指令：${node.name}`,
        node,
        'remark-directives:unknown-directive',
      )
    })
  }
}
