import {createHash} from 'node:crypto'
import {execFile} from 'node:child_process'
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises'
import {isAbsolute, join, relative, resolve, sep} from 'node:path'
import {fileURLToPath} from 'node:url'
import {promisify} from 'node:util'
import type {Loader} from 'astro/loaders'

interface TypstPostsOptions {
  base?: string
  output?: string
}

interface PaperBuild {
  htmlBody: string
  htmlStyles: string
  typstVersion: string
}

interface BuildCache {
  digest: string
  typstVersion: string
}

const execFileAsync = promisify(execFile)
const typstBinary = process.env.TYPST_BIN?.trim() || 'typst'
let typstVersionPromise: Promise<string> | undefined

const getTypstVersion = async () => {
  if (!typstVersionPromise) {
    typstVersionPromise = execFileAsync(typstBinary, ['--version'])
      .then(({stdout}) => stdout.trim())
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(
          `无法运行 Typst 编译器“${typstBinary}”。请安装 Typst 0.15.1 或设置 TYPST_BIN。\n${message}`,
        )
      })
  }
  return typstVersionPromise
}

const pathExists = async (path: string) => {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

const walkFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, {withFileTypes: true})
  const files: string[] = []
  for (const entry of entries) {
    if (entry.name === '.DS_Store') continue
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await walkFiles(path)))
    else if (entry.isFile()) files.push(path)
  }
  return files.sort()
}

const readBuildCache = async (path: string): Promise<BuildCache | undefined> => {
  try {
    const value = JSON.parse(await readFile(path, 'utf8')) as BuildCache
    if (typeof value.digest !== 'string' || typeof value.typstVersion !== 'string') return
    return value
  } catch {
    return undefined
  }
}

const extractHtml = (document: string, id: string) => {
  const body = document.match(/<body(?:\s[^>]*)?>([\s\S]*?)<\/body>/i)?.[1]
  if (body === undefined) throw new Error(`Typst 论文“${id}”生成的 HTML 缺少 <body>`)

  const styles = [...document.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gi)]
    .map((match) => match[1])
    .join('\n')

  return {htmlBody: body, htmlStyles: styles}
}

const compilePaper = async ({
  id,
  paperDirectory,
  source,
  digest,
  outputRoot,
  cacheRoot,
}: {
  id: string
  paperDirectory: string
  source: string
  digest: string
  outputRoot: string
  cacheRoot: string
}): Promise<PaperBuild> => {
  const outputDirectory = join(outputRoot, id)
  const cacheKey = createHash('sha256').update(id).digest('hex')
  const cachePath = join(cacheRoot, `${cacheKey}.json`)
  const cached = await readBuildCache(cachePath)
  if (
    cached?.digest === digest &&
    (await pathExists(join(outputDirectory, 'paper.pdf'))) &&
    (await pathExists(join(outputDirectory, 'paper.html'))) &&
    (await pathExists(join(outputDirectory, 'source.typ')))
  ) {
    return {
      ...extractHtml(await readFile(join(outputDirectory, 'paper.html'), 'utf8'), id),
      typstVersion: cached.typstVersion,
    }
  }

  const typstVersion = await getTypstVersion()
  await mkdir(outputRoot, {recursive: true})
  await mkdir(cacheRoot, {recursive: true})
  const temporaryDirectory = await mkdtemp(join(outputRoot, `.paper-${cacheKey.slice(0, 10)}-`))

  try {
    const compile = async (output: string, extraArguments: string[] = []) => {
      try {
        await execFileAsync(
          typstBinary,
          ['compile', ...extraArguments, '--root', paperDirectory, source, output],
          {
            cwd: paperDirectory,
            maxBuffer: 10 * 1024 * 1024,
          },
        )
      } catch (error) {
        const details = error as Error & {stderr?: string; stdout?: string}
        throw new Error(
          `Typst 论文“${id}”编译失败。\n${details.stderr || details.stdout || details.message}`,
        )
      }
    }

    await compile(join(temporaryDirectory, 'paper.pdf'))
    await compile(join(temporaryDirectory, 'paper.html'), [
      '--features',
      'html',
      '--format',
      'html',
    ])
    await copyFile(join(paperDirectory, source), join(temporaryDirectory, 'source.typ'))

    const html = extractHtml(await readFile(join(temporaryDirectory, 'paper.html'), 'utf8'), id)

    await rm(outputDirectory, {recursive: true, force: true})
    await rename(temporaryDirectory, outputDirectory)
    await writeFile(cachePath, JSON.stringify({digest, typstVersion}), 'utf8')
    return {...html, typstVersion}
  } catch (error) {
    await rm(temporaryDirectory, {recursive: true, force: true})
    throw error
  }
}

export const typstPosts = ({
  base = './src/content/posts/',
  output = './public/generated/posts/',
}: TypstPostsOptions = {}): Loader => ({
  name: 'typst-posts',
  load: async (context) => {
    const rootDirectory = fileURLToPath(context.config.root)
    const baseDirectory = fileURLToPath(new URL(base, context.config.root))
    const outputRoot = fileURLToPath(new URL(output, context.config.root))
    const cacheRoot = fileURLToPath(new URL('./.cache/typst-posts/', context.config.root))

    const syncAll = async () => {
      await mkdir(baseDirectory, {recursive: true})
      const directories = (await readdir(baseDirectory, {withFileTypes: true})).filter((entry) =>
        entry.isDirectory(),
      )
      const activeIds = new Set<string>()

      for (const directory of directories) {
        const id = directory.name
        const paperDirectory = join(baseDirectory, id)
        const manifestPath = join(paperDirectory, 'paper.json')
        if (!(await pathExists(manifestPath))) continue
        if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
          throw new Error(`Typst 论文目录“${id}”必须使用小写字母、数字和连字符`)
        }

        const rawManifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<
          string,
          unknown
        >
        const source =
          typeof rawManifest.source === 'string' && rawManifest.source.trim()
            ? rawManifest.source.trim()
            : 'paper.typ'
        const sourcePath = resolve(paperDirectory, source)
        const relativeSource = relative(paperDirectory, sourcePath)
        if (
          isAbsolute(relativeSource) ||
          relativeSource.startsWith(`..${sep}`) ||
          relativeSource === '..'
        ) {
          throw new Error(`Typst 论文“${id}”的 source 必须位于自己的论文目录内`)
        }
        if (!(await pathExists(sourcePath))) {
          throw new Error(`Typst 论文“${id}”缺少源文件：${source}`)
        }

        const projectFiles = await walkFiles(paperDirectory)
        const digestParts = await Promise.all(
          projectFiles.map(async (path) => {
            const name = relative(paperDirectory, path).split(sep).join('/')
            const contents = await readFile(path)
            return `${name}\0${contents.toString('base64')}`
          }),
        )
        const digest = String(context.generateDigest(digestParts.join('\0')))
        const build = await compilePaper({
          id,
          paperDirectory,
          source,
          digest,
          outputRoot,
          cacheRoot,
        })
        const assetBase = `/generated/posts/${encodeURIComponent(id)}`
        const data = await context.parseData({
          id,
          filePath: manifestPath,
          data: {
            ...rawManifest,
            source,
            pdfUrl: `${assetBase}/paper.pdf`,
            sourceUrl: `${assetBase}/source.typ`,
            htmlBody: build.htmlBody,
            htmlStyles: build.htmlStyles,
            typstVersion: build.typstVersion,
          },
        })

        activeIds.add(id)
        context.store.set({
          id,
          data,
          body: await readFile(sourcePath, 'utf8'),
          filePath: relative(rootDirectory, manifestPath).split(sep).join('/'),
          digest,
        })
      }

      for (const id of context.store.keys()) {
        if (activeIds.has(id)) continue
        context.store.delete(id)
        await rm(join(outputRoot, id), {recursive: true, force: true})
      }
    }

    await syncAll()
    if (!context.watcher) return

    context.watcher.add(baseDirectory)
    let reload = Promise.resolve()
    const handleChange = (changedPath: string) => {
      const localPath = relative(baseDirectory, changedPath)
      if (localPath.startsWith(`..${sep}`) || localPath === '..') return
      reload = reload
        .then(syncAll)
        .then(() => context.logger.info(`已重新编译 Typst 论文：${localPath}`))
        .catch((error) =>
          context.logger.error(error instanceof Error ? error.message : String(error)),
        )
    }
    context.watcher.on('add', handleChange)
    context.watcher.on('change', handleChange)
    context.watcher.on('unlink', handleChange)
  },
})
