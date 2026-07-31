import {createHash, randomUUID} from 'node:crypto'
import {mkdir, readFile, rename, writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'

interface CacheEntry {
  version: 1
  url: string
  source: string
  fetchedAt: number
  etag?: string
  lastModified?: string
}

const cacheDirectory = resolve('.cache/github-quotes')
const pendingSources = new Map<string, Promise<string>>()

const createCachePath = (url: string) => {
  const key = createHash('sha256').update(url).digest('hex')
  return resolve(cacheDirectory, `${key}.json`)
}

const readCache = async (url: string): Promise<CacheEntry | undefined> => {
  try {
    const entry = JSON.parse(await readFile(createCachePath(url), 'utf8')) as CacheEntry
    if (entry.version !== 1 || entry.url !== url || typeof entry.source !== 'string') return
    return entry
  } catch {
    return undefined
  }
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))

const writeCache = async (entry: CacheEntry) => {
  try {
    await mkdir(cacheDirectory, {recursive: true})
    const cachePath = createCachePath(entry.url)
    const temporaryPath = `${cachePath}.${process.pid}.${randomUUID()}.tmp`
    await writeFile(temporaryPath, JSON.stringify(entry), 'utf8')
    await rename(temporaryPath, cachePath)
  } catch (error) {
    console.warn(`[GitHubQuote] Could not write cache for ${entry.url}: ${errorMessage(error)}`)
  }
}

const fetchSource = async (url: string, ttlMs: number) => {
  const cached = await readCache(url)
  if (cached && Date.now() - cached.fetchedAt <= ttlMs) return cached.source

  const headers: Record<string, string> = {Accept: 'text/plain'}
  if (cached?.etag) headers['If-None-Match'] = cached.etag
  if (cached?.lastModified) headers['If-Modified-Since'] = cached.lastModified

  let response: Response
  try {
    response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(15_000),
    })
  } catch (error) {
    if (cached) {
      console.warn(
        `[GitHubQuote] Using stale cache for ${url} after fetch failed: ${errorMessage(error)}`,
      )
      return cached.source
    }
    throw error
  }

  if (response.status === 304 && cached) {
    const refreshed: CacheEntry = {...cached, fetchedAt: Date.now()}
    await writeCache(refreshed)
    return refreshed.source
  }

  if (!response.ok) {
    if (cached && (response.status === 429 || response.status >= 500)) {
      console.warn(
        `[GitHubQuote] Using stale cache for ${url} after GitHub returned ${response.status}`,
      )
      return cached.source
    }
    throw new Error(`${response.status} ${response.statusText}`)
  }

  const entry: CacheEntry = {
    version: 1,
    url,
    source: await response.text(),
    fetchedAt: Date.now(),
    etag: response.headers.get('etag') ?? undefined,
    lastModified: response.headers.get('last-modified') ?? undefined,
  }
  await writeCache(entry)
  return entry.source
}

export const fetchGitHubSource = (url: string, ttlMs: number) => {
  const pendingKey = `${url}\0${ttlMs}`
  const pending = pendingSources.get(pendingKey)
  if (pending) return pending

  const request = fetchSource(url, ttlMs)
  pendingSources.set(pendingKey, request)
  void request.then(
    () => {
      if (pendingSources.get(pendingKey) === request) pendingSources.delete(pendingKey)
    },
    () => {
      if (pendingSources.get(pendingKey) === request) pendingSources.delete(pendingKey)
    },
  )
  return request
}
