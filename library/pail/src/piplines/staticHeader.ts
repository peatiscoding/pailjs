import type { FetchPipeline } from '../interface'

export function staticHeader(header: Record<string, string | undefined>): FetchPipeline
export function staticHeader(name: string, value: string): FetchPipeline
export function staticHeader(
  nameOrHeaderObject: string | Record<string, string | undefined>,
  value?: string,
): FetchPipeline {
  const obj = typeof nameOrHeaderObject === 'string' ? { [nameOrHeaderObject]: value } : nameOrHeaderObject
  return (context) => {
    for (const key in obj) {
      context.headers[key] = obj[key]
    }
    return context
  }
}
