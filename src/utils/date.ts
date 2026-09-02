export type DateValue = Date | string

const displayDateFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const asDate = (value: DateValue) => (value instanceof Date ? value : new Date(value))

export const convertDateFormat = (value: DateValue) => displayDateFormatter.format(asDate(value))

export const toDateTime = (value: DateValue) => asDate(value).toISOString()

export const compareDatesDescending = (a: DateValue, b: DateValue) =>
  asDate(b).getTime() - asDate(a).getTime()

export const getPostDate = (data: {created: Date; published?: Date; draft?: boolean}) =>
  data.draft ? data.created : (data.published ?? data.created)
