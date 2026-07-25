export interface FunctionPlotSeriesInput {
  expression: string
  label?: string
}

export interface FunctionPlotSeries {
  expression: string
  label: string
}

export interface FunctionPlotModel {
  title: string
  series: FunctionPlotSeries[]
  xDomain: [number, number]
  yDomain: [number, number]
  height: number
}

interface FunctionPlotOptions {
  title?: string
  expression?: string
  functions?: string | string[] | FunctionPlotSeriesInput[]
  xDomain?: [number, number]
  yDomain?: [number, number]
  height?: number
}

type Evaluator = (x: number) => number

type Token =
  | {type: 'number'; value: number; position: number}
  | {type: 'identifier'; value: string; position: number}
  | {type: 'operator'; value: '+' | '-' | '*' | '/' | '%' | '^'; position: number}
  | {type: 'left-parenthesis' | 'right-parenthesis' | 'comma' | 'end'; position: number}

interface FunctionDefinition {
  minimumArguments: number
  maximumArguments: number
  evaluate: (...values: number[]) => number
}

const functions: Record<string, FunctionDefinition> = {
  abs: {minimumArguments: 1, maximumArguments: 1, evaluate: Math.abs},
  acos: {minimumArguments: 1, maximumArguments: 1, evaluate: Math.acos},
  asin: {minimumArguments: 1, maximumArguments: 1, evaluate: Math.asin},
  atan: {minimumArguments: 1, maximumArguments: 1, evaluate: Math.atan},
  atan2: {minimumArguments: 2, maximumArguments: 2, evaluate: Math.atan2},
  cbrt: {minimumArguments: 1, maximumArguments: 1, evaluate: Math.cbrt},
  ceil: {minimumArguments: 1, maximumArguments: 1, evaluate: Math.ceil},
  clamp: {
    minimumArguments: 3,
    maximumArguments: 3,
    evaluate: (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value)),
  },
  cos: {minimumArguments: 1, maximumArguments: 1, evaluate: Math.cos},
  cosh: {minimumArguments: 1, maximumArguments: 1, evaluate: Math.cosh},
  exp: {minimumArguments: 1, maximumArguments: 1, evaluate: Math.exp},
  floor: {minimumArguments: 1, maximumArguments: 1, evaluate: Math.floor},
  ln: {minimumArguments: 1, maximumArguments: 1, evaluate: Math.log},
  log: {minimumArguments: 1, maximumArguments: 1, evaluate: Math.log},
  log10: {minimumArguments: 1, maximumArguments: 1, evaluate: Math.log10},
  max: {minimumArguments: 1, maximumArguments: Number.POSITIVE_INFINITY, evaluate: Math.max},
  min: {minimumArguments: 1, maximumArguments: Number.POSITIVE_INFINITY, evaluate: Math.min},
  pow: {minimumArguments: 2, maximumArguments: 2, evaluate: Math.pow},
  round: {minimumArguments: 1, maximumArguments: 1, evaluate: Math.round},
  sign: {minimumArguments: 1, maximumArguments: 1, evaluate: Math.sign},
  sin: {minimumArguments: 1, maximumArguments: 1, evaluate: Math.sin},
  sinh: {minimumArguments: 1, maximumArguments: 1, evaluate: Math.sinh},
  sqrt: {minimumArguments: 1, maximumArguments: 1, evaluate: Math.sqrt},
  tan: {minimumArguments: 1, maximumArguments: 1, evaluate: Math.tan},
  tanh: {minimumArguments: 1, maximumArguments: 1, evaluate: Math.tanh},
  trunc: {minimumArguments: 1, maximumArguments: 1, evaluate: Math.trunc},
}

const numberPattern = /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i
const identifierPattern = /^[A-Za-z_][A-Za-z0-9_]*/

const tokenize = (source: string): Token[] => {
  const tokens: Token[] = []
  let position = 0

  while (position < source.length) {
    const character = source[position]
    if (/\s/u.test(character)) {
      position += 1
      continue
    }

    const remaining = source.slice(position)
    const numberMatch = numberPattern.exec(remaining)
    if (numberMatch) {
      tokens.push({type: 'number', value: Number(numberMatch[0]), position})
      position += numberMatch[0].length
      continue
    }

    const identifierMatch = identifierPattern.exec(remaining)
    if (identifierMatch) {
      tokens.push({
        type: 'identifier',
        value: identifierMatch[0].toLowerCase(),
        position,
      })
      position += identifierMatch[0].length
      continue
    }

    if (character === 'π') {
      tokens.push({type: 'identifier', value: 'pi', position})
      position += 1
      continue
    }

    if ('+-*/%^'.includes(character)) {
      tokens.push({
        type: 'operator',
        value: character as '+' | '-' | '*' | '/' | '%' | '^',
        position,
      })
      position += 1
      continue
    }

    const punctuationType =
      character === '('
        ? 'left-parenthesis'
        : character === ')'
          ? 'right-parenthesis'
          : character === ','
            ? 'comma'
            : undefined
    if (punctuationType) {
      tokens.push({type: punctuationType, position})
      position += 1
      continue
    }

    throw new Error(`[FunctionPlot] 无法识别表达式“${source}”中第 ${position + 1} 个字符`)
  }

  tokens.push({type: 'end', position: source.length})
  return tokens
}

class ExpressionParser {
  private position = 0
  private readonly source: string
  private readonly tokens: Token[]

  constructor(source: string, tokens: Token[]) {
    this.source = source
    this.tokens = tokens
  }

  parse(): Evaluator {
    const evaluator = this.parseAdditive()
    if (this.current.type !== 'end') this.fail('这里有多余的内容')
    return evaluator
  }

  private get current() {
    return this.tokens[this.position]
  }

  private consume() {
    const token = this.current
    this.position += 1
    return token
  }

  private currentIs(type: Token['type']) {
    return this.current.type === type
  }

  private parseAdditive(): Evaluator {
    let left = this.parseMultiplicative()

    while (
      this.current.type === 'operator' &&
      (this.current.value === '+' || this.current.value === '-')
    ) {
      const operator = this.consume()
      const right = this.parseMultiplicative()
      const previous = left
      left =
        operator.type === 'operator' && operator.value === '+'
          ? (x) => previous(x) + right(x)
          : (x) => previous(x) - right(x)
    }

    return left
  }

  private parseMultiplicative(): Evaluator {
    let left = this.parseUnary()

    while (true) {
      const token = this.current
      const hasExplicitOperator =
        token.type === 'operator' &&
        (token.value === '*' || token.value === '/' || token.value === '%')
      const hasImplicitMultiplication =
        token.type === 'number' || token.type === 'identifier' || token.type === 'left-parenthesis'
      if (!hasExplicitOperator && !hasImplicitMultiplication) break

      const operator = hasExplicitOperator ? this.consume() : undefined
      const right = this.parseUnary()
      const previous = left
      left =
        operator?.type !== 'operator' || operator.value === '*'
          ? (x) => previous(x) * right(x)
          : operator.value === '/'
            ? (x) => previous(x) / right(x)
            : (x) => previous(x) % right(x)
    }

    return left
  }

  private parseUnary(): Evaluator {
    if (
      this.current.type === 'operator' &&
      (this.current.value === '+' || this.current.value === '-')
    ) {
      const operator = this.consume()
      const operand = this.parseUnary()
      return operator.type === 'operator' && operator.value === '-' ? (x) => -operand(x) : operand
    }

    return this.parsePower()
  }

  private parsePower(): Evaluator {
    const left = this.parsePrimary()
    if (this.current.type !== 'operator' || this.current.value !== '^') return left

    this.consume()
    const right = this.parseUnary()
    return (x) => Math.pow(left(x), right(x))
  }

  private parsePrimary(): Evaluator {
    const token = this.consume()

    if (token.type === 'number') return () => token.value

    if (token.type === 'left-parenthesis') {
      const value = this.parseAdditive()
      if (this.current.type !== 'right-parenthesis') this.fail('缺少右括号')
      this.consume()
      return value
    }

    if (token.type !== 'identifier') this.fail('这里需要数字、变量或函数')

    if (token.value === 'x') return (x) => x
    if (token.value === 'pi') return () => Math.PI
    if (token.value === 'e') return () => Math.E

    const definition = functions[token.value]
    if (!definition) this.fail(`不支持函数或常量“${token.value}”`, token.position)
    if (!this.currentIs('left-parenthesis')) {
      this.fail(`函数“${token.value}”后需要括号`, token.position)
    }
    this.consume()

    const argumentsList: Evaluator[] = []
    if (!this.currentIs('right-parenthesis')) {
      while (true) {
        argumentsList.push(this.parseAdditive())
        if (!this.currentIs('comma')) break
        this.consume()
      }
    }
    if (!this.currentIs('right-parenthesis')) this.fail('缺少右括号')
    this.consume()

    if (
      argumentsList.length < definition.minimumArguments ||
      argumentsList.length > definition.maximumArguments
    ) {
      const expected =
        definition.minimumArguments === definition.maximumArguments
          ? `${definition.minimumArguments} 个`
          : `至少 ${definition.minimumArguments} 个`
      this.fail(`函数“${token.value}”需要${expected}参数`, token.position)
    }

    return (x) => definition.evaluate(...argumentsList.map((argument) => argument(x)))
  }

  private fail(message: string, position = this.current?.position ?? this.source.length): never {
    throw new Error(
      `[FunctionPlot] ${message}（表达式“${this.source}”，第 ${position + 1} 个字符附近）`,
    )
  }
}

export const compileFunctionExpression = (expression: string): Evaluator => {
  const source = expression.trim()
  if (!source) throw new Error('[FunctionPlot] 函数表达式不能为空')
  return new ExpressionParser(source, tokenize(source)).parse()
}

const normalizeDomain = (
  domain: [number, number] | undefined,
  fallback: [number, number],
  name: string,
): [number, number] => {
  if (domain === undefined) return fallback
  if (
    !Array.isArray(domain) ||
    domain.length !== 2 ||
    !domain.every((value) => Number.isFinite(value)) ||
    domain[0] >= domain[1] ||
    !Number.isFinite(domain[1] - domain[0])
  ) {
    throw new Error(`[FunctionPlot] ${name} 必须是从小到大的两个有限数值`)
  }
  return [domain[0], domain[1]]
}

const normalizeSeries = ({
  expression,
  functions: functionInputs,
}: Pick<FunctionPlotOptions, 'expression' | 'functions'>): FunctionPlotSeries[] => {
  const rawSeries =
    functionInputs === undefined
      ? expression === undefined
        ? []
        : [expression]
      : typeof functionInputs === 'string'
        ? [functionInputs]
        : functionInputs

  if (rawSeries.length === 0) {
    throw new Error('[FunctionPlot] 请通过 expression 或 functions 提供至少一个函数')
  }
  if (rawSeries.length > 6) throw new Error('[FunctionPlot] 一张图最多绘制 6 个函数')

  return rawSeries.map((input, index) => {
    const item = typeof input === 'string' ? {expression: input} : input
    if (!item || typeof item.expression !== 'string') {
      throw new Error(`[FunctionPlot] 第 ${index + 1} 个函数缺少 expression`)
    }

    const normalizedExpression = item.expression.trim()
    compileFunctionExpression(normalizedExpression)
    return {
      expression: normalizedExpression,
      label: item.label?.trim() || `y = ${normalizedExpression}`,
    }
  })
}

export const createFunctionPlotModel = ({
  title = '函数图像',
  expression,
  functions: functionInputs,
  xDomain,
  yDomain,
  height = 360,
}: FunctionPlotOptions): FunctionPlotModel => {
  if (!Number.isFinite(height) || height < 240 || height > 560) {
    throw new Error('[FunctionPlot] height 必须是 240 到 560 之间的数值')
  }

  return {
    title: title.trim() || '函数图像',
    series: normalizeSeries({expression, functions: functionInputs}),
    xDomain: normalizeDomain(xDomain, [-10, 10], 'xDomain'),
    yDomain: normalizeDomain(yDomain, [-5, 5], 'yDomain'),
    height: Math.round(height),
  }
}
