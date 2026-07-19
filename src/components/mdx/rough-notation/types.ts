export type RoughNotationType =
  'underline' | 'box' | 'circle' | 'highlight' | 'strike-through' | 'crossed-off' | 'bracket'

export type RoughNotationPadding = number | [number, number] | [number, number, number, number]
export type RoughNotationBracket = 'left' | 'right' | 'top' | 'bottom'

export interface RoughNotationProps {
  color?: string
  strokeWidth?: number
  iterations?: number
  padding?: RoughNotationPadding
  animationDuration?: number
  animate?: boolean
  multiline?: boolean
  rtl?: boolean
  class?: string
}

export interface BracketProps extends RoughNotationProps {
  brackets?: RoughNotationBracket | RoughNotationBracket[]
  gap?: number | string
}
