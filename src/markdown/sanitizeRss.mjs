import sanitizeHtml from 'sanitize-html'

const sanitizeOptions = {
  // Buttons must reach exclusiveFilter so RSS can remove their text as well as their tags.
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'button']),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    aside: ['role'],
    ruby: ['title'],
    rt: ['lang'],
  },
  exclusiveFilter: (frame) => {
    const classes = frame.attribs.class?.split(/\s+/) ?? []
    return frame.tag === 'button' || classes.includes('piano-keyboard-scroll')
  },
}

export const sanitizeMarkdownForRss = (html) => sanitizeHtml(html, sanitizeOptions)
