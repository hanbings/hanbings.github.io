#let paper(body) = context {
  if target() == "paged" {
    set page(
      paper: "a4",
      margin: (x: 25mm, y: 23mm),
      numbering: "1",
    )
    set text(font: "Libertinus Serif", size: 10.5pt, lang: "en")
    set par(justify: true, leading: 0.68em)
    set heading(numbering: "1.")
    show heading.where(level: 1): set text(size: 14pt, weight: "bold")
    show heading.where(level: 2): set text(size: 11.5pt, weight: "bold")

    align(center)[
      #text(size: 18pt, weight: "bold")[A Typst HTML Paper Pipeline for Astro]
      #v(0.35em)
      #text(size: 11pt, style: "italic")[A small architectural note]
      #v(0.9em)
      hanbings \
      #text(size: 9pt)[Independent Researcher] \
      #text(size: 9pt)[hanbings\@hanbings.io]
      #v(0.55em)
      #text(size: 9pt)[August 4, 2026]
    ]

    v(1.2em)
    block(inset: (x: 12mm), width: 100%)[
      #set text(size: 9.5pt)
      #set par(leading: 0.62em)
      *Abstract.* This note demonstrates a dual-target content pipeline in which
      Typst emits semantic HTML for reading inside an Astro blog and a paged PDF
      for archival and print use. The renderer remains distinct from Markdown
      without becoming visually detached from the surrounding website.

      *Keywords:* Typst; Astro; HTML; academic publishing; static sites.
    ]
    body
  } else {
    set heading(numbering: "1.")
    body
  }
}

#show: paper

= Introduction

Academic writing and personal publishing optimize for different reading modes,
but they do not need to live on visually disconnected websites. A paper can use
the blog's navigation, colors, and reading width while retaining its own semantic
structure for equations, figures, references, and academic metadata.

Typst is a programmable typesetting system designed for structured documents and
mathematical notation. Its paged output can preserve expressions such as

$ integral_0^infinity e^(-x^2) dif x = sqrt(pi) / 2 $

as MathML in the browser and as precisely typeset mathematics in PDF. Astro can
therefore remain responsible for the surrounding reading experience without
turning the paper into Markdown.

== Separation of responsibilities

The source tree assigns one job to each layer:

- `paper.typ` owns the paper body and its local project files.
- `paper.json` owns web metadata such as the abstract and canonical date.
- Typst emits semantic HTML for the website and a PDF for download.
- Astro injects the HTML body into the normal blog shell and styles it separately.

This separation follows a familiar principle: source formats should retain their
native semantics instead of being coerced into a shared lowest common denominator.

#context if target() == "paged" { pagebreak() }

= Build model

Let $S$ denote the set of files in one paper project and let $V$ denote the Typst
compiler version. The build artifact can be modeled as

$ A = "compile"("hash"(S), V). $

The content digest makes unchanged papers reusable across repeated Astro checks
and builds. A changed bibliography, image, chapter, or main source invalidates the
same paper without rebuilding unrelated entries.

#figure(
  table(
    columns: (1.2fr, 2.2fr),
    inset: 6pt,
    stroke: 0.4pt,
    [*Layer*], [*Responsibility*],
    [Typst], [Semantic HTML, paged PDF, equations, figures, bibliography],
    [Astro], [Metadata, URLs, navigation, responsive publication shell],
    [Browser], [Native text, links, MathML, and downloadable artifacts],
  ),
  caption: [Responsibilities of the paper pipeline.],
)

= Discussion

Typst currently emits a standalone HTML document rather than an embeddable
fragment. The build loader extracts its body and compiler-provided styles, then
Astro places that semantic output inside the site's own layout. Readers keep the
normal blog navigation and can select text, follow links, and inspect equations.

HTML export is still experimental, so the PDF remains the stable archival
artifact. Target-aware rules keep print-only title geometry and page breaks out of
the flowing web version while allowing both outputs to share the same paper body.

= Conclusion

A paper-style post renderer is a content contract, not a separate visual world.
Markdown remains optimized for essays, while Typst becomes a first-class source
format for academic work inside the same site.
