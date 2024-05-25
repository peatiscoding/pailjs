export class RetryRequest extends Error {
  constructor() {
    super('retry-please')
  }
}
