const isChatBox = (node) => node.type === 'mdxJsxFlowElement' && node.name === 'ChatBox'

const collectChatBoxHeadingIndexes = (tree) => {
  const indexes = []
  let headingIndex = 0

  const visit = (node, insideChatBox = false) => {
    const isInsideChatBox = insideChatBox || isChatBox(node)

    if (node.type === 'heading') {
      if (isInsideChatBox) indexes.push(headingIndex)
      headingIndex += 1
    }

    if (!Array.isArray(node.children)) return

    for (const child of node.children) {
      visit(child, isInsideChatBox)
    }
  }

  visit(tree)
  return indexes
}

export default function remarkChatBoxHeadings() {
  return (tree, file) => {
    const indexes = collectChatBoxHeadingIndexes(tree)
    const astroData = file.data.astro ?? (file.data.astro = {})
    const frontmatter = astroData.frontmatter ?? (astroData.frontmatter = {})

    frontmatter.chatBoxHeadingIndexes = indexes
  }
}
