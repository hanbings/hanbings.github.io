import vertexShaderSource from './fullscreen-triangle.vert.glsl?raw'

class MdxShaderBox extends HTMLElement {
  private canvas?: HTMLCanvasElement
  private preview?: HTMLElement
  private toolbar?: HTMLElement
  private overlayToggle?: HTMLButtonElement
  private overlayLabel?: HTMLElement
  private fragmentSource?: string
  private gl?: WebGL2RenderingContext
  private program?: WebGLProgram
  private vertexArray?: WebGLVertexArrayObject
  private resolutionUniform: WebGLUniformLocation | null = null
  private timeUniform: WebGLUniformLocation | null = null
  private animationFrame?: number
  private resizeObserver?: ResizeObserver
  private intersectionObserver?: IntersectionObserver
  private motionPreference?: MediaQueryList
  private initialized = false
  private visible = true
  private animated = false
  private overlayActive = false
  private contextLost = false
  private pixelRatio = 1
  private startedAt = 0

  connectedCallback() {
    if (this.initialized) return

    const sourceContainer = this.querySelector('[data-shader-source]')
    if (!(sourceContainer instanceof HTMLElement)) return

    const sourceElement = sourceContainer.querySelector(
      'pre[data-language="glsl"] > code, code.language-glsl',
    )
    const fragmentSource = sourceElement?.textContent?.trim()
    if (!fragmentSource) return

    const preview = this.querySelector('[data-shader-preview]')
    if (!(preview instanceof HTMLElement)) return

    const canvas = preview.querySelector(':scope > canvas')
    if (!(canvas instanceof HTMLCanvasElement)) return

    const toolbar = this.querySelector(':scope > [data-shader-toolbar]')
    const overlayToggle = toolbar?.querySelector('[data-shader-overlay-toggle]')
    const overlayLabel = overlayToggle?.querySelector('[data-shader-overlay-label]')
    if (
      this.dataset.overlay === 'true' &&
      (!(toolbar instanceof HTMLElement) ||
        !(overlayToggle instanceof HTMLButtonElement) ||
        !(overlayLabel instanceof HTMLElement))
    )
      return

    this.canvas = canvas
    this.preview = preview
    this.toolbar = toolbar instanceof HTMLElement ? toolbar : undefined
    this.overlayToggle = overlayToggle instanceof HTMLButtonElement ? overlayToggle : undefined
    this.overlayLabel = overlayLabel instanceof HTMLElement ? overlayLabel : undefined
    this.fragmentSource = fragmentSource
    this.overlayToggle?.addEventListener('click', this.handleOverlayToggle)
    canvas.addEventListener('webglcontextlost', this.handleContextLost)
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored)

    try {
      this.initializeRenderer()
      this.initialized = true
      this.dataset.shaderState = 'ready'
    } catch (error) {
      this.dataset.shaderState = 'error'
      this.destroyRenderer()
      console.error('[ShaderBox] WebGL initialization failed.', error)
    }
  }

  disconnectedCallback() {
    const {canvas, overlayToggle} = this
    this.restoreInlineLayout()
    overlayToggle?.removeEventListener('click', this.handleOverlayToggle)
    canvas?.removeEventListener('webglcontextlost', this.handleContextLost)
    canvas?.removeEventListener('webglcontextrestored', this.handleContextRestored)
    this.destroyRenderer()

    this.canvas = undefined
    this.preview = undefined
    this.toolbar = undefined
    this.overlayToggle = undefined
    this.overlayLabel = undefined
    this.fragmentSource = undefined
    this.initialized = false
    delete this.dataset.shaderState
  }

  private handleOverlayToggle = () => {
    if (this.overlayActive) this.deactivateOverlay()
    else this.activateOverlay()
  }

  private handleKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !this.overlayActive) return
    this.deactivateOverlay()
    this.overlayToggle?.focus({preventScroll: true})
  }

  private activateOverlay() {
    const {canvas, toolbar, overlayToggle} = this
    if (this.overlayActive || !canvas || !toolbar || !overlayToggle) return

    const siteRoot = this.closest<HTMLElement>('[data-site-root]')
    const overlayRoot = siteRoot?.querySelector<HTMLElement>('[data-site-region="overlay"]')
    if (!siteRoot || !overlayRoot) return

    for (const shaderBox of siteRoot.querySelectorAll('mdx-shader-box[data-overlay-active]')) {
      if (shaderBox instanceof MdxShaderBox && shaderBox !== this) {
        shaderBox.deactivateOverlay()
      }
    }

    const restoreFocus = document.activeElement === overlayToggle
    overlayRoot.append(canvas)
    this.updateOverlayState(true)
    document.addEventListener('keydown', this.handleKeydown)
    this.resizeCanvas()
    this.startRendering()
    if (restoreFocus) overlayToggle.focus({preventScroll: true})
  }

  private deactivateOverlay() {
    if (!this.overlayActive) return

    const restoreFocus = document.activeElement === this.overlayToggle
    this.restoreInlineLayout()
    this.resizeCanvas()
    this.startRendering()
    if (restoreFocus) this.overlayToggle?.focus({preventScroll: true})
  }

  private restoreInlineLayout() {
    const {canvas, preview, toolbar, overlayToggle} = this
    if (canvas && preview && canvas.parentElement !== preview) preview.append(canvas)
    if (toolbar && toolbar.parentElement !== this) this.append(toolbar)

    this.updateOverlayState(false)
    document.removeEventListener('keydown', this.handleKeydown)
    overlayToggle?.setAttribute('aria-pressed', 'false')
  }

  private updateOverlayState(active: boolean) {
    this.overlayActive = active
    this.toggleAttribute('data-overlay-active', active)
    this.canvas?.toggleAttribute('data-overlay-active', active)
    this.toolbar?.toggleAttribute('data-overlay-active', active)
    this.overlayToggle?.setAttribute('aria-pressed', String(active))
    if (this.overlayLabel) {
      this.overlayLabel.textContent = active ? '关闭效果' : '应用到页面'
    }
  }

  private initializeRenderer() {
    const {canvas, fragmentSource} = this
    if (!canvas || !fragmentSource) throw new Error('Canvas or fragment shader source is missing.')

    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    })
    if (!gl) throw new Error('WebGL2 is not available.')

    this.gl = gl
    this.program = this.createProgram(gl, fragmentSource)
    this.vertexArray = gl.createVertexArray() ?? undefined
    if (!this.vertexArray) throw new Error('Unable to create a vertex array.')

    this.resolutionUniform = gl.getUniformLocation(this.program, 'u_resolution')
    this.timeUniform = gl.getUniformLocation(this.program, 'u_time')
    this.startedAt = performance.now()
    this.motionPreference = matchMedia('(prefers-reduced-motion: reduce)')
    this.animated = this.timeUniform !== null && !this.motionPreference.matches
    this.contextLost = false

    gl.clearColor(0, 0, 0, 0)
    this.resizeCanvas()

    this.resizeObserver = new ResizeObserver(this.handleResize)
    this.resizeObserver.observe(canvas)

    this.intersectionObserver = new IntersectionObserver(this.handleIntersection)
    this.intersectionObserver.observe(canvas)

    this.motionPreference.addEventListener('change', this.handleMotionPreference)
    window.addEventListener('resize', this.handleResize)
    document.addEventListener('visibilitychange', this.handleVisibilityChange)
    this.startRendering()
  }

  private createProgram(gl: WebGL2RenderingContext, fragmentSource: string) {
    const vertexShader = this.compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource, 'Vertex')
    let fragmentShader: WebGLShader | undefined

    try {
      fragmentShader = this.compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource, 'Fragment')
      const program = gl.createProgram()
      if (!program) throw new Error('Unable to create a WebGL program.')

      gl.attachShader(program, vertexShader)
      gl.attachShader(program, fragmentShader)
      gl.linkProgram(program)

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const message = gl.getProgramInfoLog(program)?.trim() || 'Unknown link error.'
        gl.deleteProgram(program)
        throw new Error(`WebGL program linking failed:\n${message}`)
      }

      return program
    } finally {
      gl.deleteShader(vertexShader)
      if (fragmentShader) gl.deleteShader(fragmentShader)
    }
  }

  private compileShader(gl: WebGL2RenderingContext, type: number, source: string, label: string) {
    const shader = gl.createShader(type)
    if (!shader) throw new Error(`Unable to create the ${label.toLowerCase()} shader.`)

    gl.shaderSource(shader, source)
    gl.compileShader(shader)

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader)?.trim() || 'Unknown compilation error.'
      gl.deleteShader(shader)
      throw new Error(`${label} shader compilation failed:\n${message}`)
    }

    return shader
  }

  private resizeCanvas() {
    const {canvas, gl} = this
    if (!canvas || !gl) return

    const bounds = canvas.getBoundingClientRect()
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    this.pixelRatio = pixelRatio
    const width = Math.max(1, Math.round(bounds.width * pixelRatio))
    const height = Math.max(1, Math.round(bounds.height * pixelRatio))

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }

    gl.viewport(0, 0, width, height)
  }

  private startRendering() {
    if (this.animationFrame !== undefined || !this.visible || this.contextLost || document.hidden)
      return
    this.animationFrame = requestAnimationFrame(this.renderFrame)
  }

  private stopRendering() {
    if (this.animationFrame === undefined) return
    cancelAnimationFrame(this.animationFrame)
    this.animationFrame = undefined
  }

  private renderFrame = (timestamp: number) => {
    this.animationFrame = undefined
    if (!this.visible || this.contextLost || document.hidden) return

    const {canvas, gl, program, vertexArray} = this
    if (!canvas || !gl || !program || !vertexArray) return

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    if (pixelRatio !== this.pixelRatio) this.resizeCanvas()

    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(program)
    gl.bindVertexArray(vertexArray)

    if (this.resolutionUniform) {
      gl.uniform2f(this.resolutionUniform, canvas.width, canvas.height)
    }
    if (this.timeUniform) {
      gl.uniform1f(this.timeUniform, (timestamp - this.startedAt) / 1000)
    }

    gl.drawArrays(gl.TRIANGLES, 0, 3)
    gl.bindVertexArray(null)

    if (this.animated) this.startRendering()
  }

  private handleResize = () => {
    this.resizeCanvas()
    if (!this.animated) this.startRendering()
  }

  private handleIntersection: IntersectionObserverCallback = ([entry]) => {
    this.visible = entry?.isIntersecting ?? false
    if (this.visible) this.startRendering()
    else this.stopRendering()
  }

  private handleVisibilityChange = () => {
    if (document.hidden) this.stopRendering()
    else this.startRendering()
  }

  private handleMotionPreference = (event: MediaQueryListEvent) => {
    this.animated = this.timeUniform !== null && !event.matches
    this.stopRendering()
    this.startRendering()
  }

  private handleContextLost = (event: Event) => {
    event.preventDefault()
    this.contextLost = true
    this.stopRendering()
    this.dataset.shaderState = 'lost'
  }

  private handleContextRestored = () => {
    this.destroyRenderer()

    try {
      this.initializeRenderer()
      this.dataset.shaderState = 'ready'
    } catch (error) {
      this.dataset.shaderState = 'error'
      this.destroyRenderer()
      console.error('[ShaderBox] WebGL restoration failed.', error)
    }
  }

  private destroyRenderer() {
    this.stopRendering()
    this.resizeObserver?.disconnect()
    this.intersectionObserver?.disconnect()
    this.motionPreference?.removeEventListener('change', this.handleMotionPreference)
    window.removeEventListener('resize', this.handleResize)
    document.removeEventListener('visibilitychange', this.handleVisibilityChange)

    if (this.gl) {
      this.gl.bindVertexArray(null)
      this.gl.useProgram(null)
      if (this.vertexArray) this.gl.deleteVertexArray(this.vertexArray)
      if (this.program) this.gl.deleteProgram(this.program)
    }

    this.gl = undefined
    this.program = undefined
    this.vertexArray = undefined
    this.resolutionUniform = null
    this.timeUniform = null
    this.resizeObserver = undefined
    this.intersectionObserver = undefined
    this.motionPreference = undefined
    this.visible = true
    this.animated = false
    this.contextLost = false
    this.pixelRatio = 1
  }
}

if (!customElements.get('mdx-shader-box')) customElements.define('mdx-shader-box', MdxShaderBox)
