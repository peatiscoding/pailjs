import type { IFetchBuilderOp, MarshalTypeMorpher } from '../interface'
import { RetryRequest } from '../errors'

/**
 * perform retry when predicate returns 'true'
 *
 * @param onRetry the function that allow caller to perform retry operation (e.g. refresh the token).
 * @param predicateOrTargetStatus the function to evaluate if given response should be retried. Or status code to retry.
 */
export const retry = <T>(
  onRetry: () => Promise<void>,
  predicateOrTargetStatus: number[] | number | ((response: Response) => boolean) = [403],
): MarshalTypeMorpher<T, T> => {
  // Need to save current 'op' for comparing the -recalled operation. Otherwise it will create the infinite loop
  // of retrying.
  let retryingOp: IFetchBuilderOp<T> | undefined = undefined
  const blockedOps: ((error: Error | null) => void)[] = []
  const predFn =
    typeof predicateOrTargetStatus === 'number'
      ? (rs: Response) => rs.status === predicateOrTargetStatus
      : predicateOrTargetStatus instanceof Array
        ? (rs: Response) => predicateOrTargetStatus.indexOf(rs.status) !== -1
        : predicateOrTargetStatus

  return async (result: T, response, op): Promise<T> => {
    // if no retry is required.
    if (!predFn(response)) {
      return result
    }
    // if this retry block is being called from the same operation (already invoke retry, no need to call it again)
    if (retryingOp === op) {
      // console.warn('trying again on same OP (', op.context.url, ')')
      return result
    }
    // if this retry block is being called from a different operation, (retryingOp is defined; but not the one invoking), block it.
    if (retryingOp) {
      // console.warn(`blocked ${op.context.url} by pending retryingOp (${retryingOp.context.url})`)
      // Create a fake promise; it will be resolved when the other operation is done.
      const waitForOtherRefresh = new Promise((resolve) => blockedOps.push(resolve))
      const hasRefreshError = await waitForOtherRefresh
      // console.warn('resumed from retryingOp', op.context.url, hasRefreshError)
      if (hasRefreshError) {
        // Throw the same error on all endpoints
        throw hasRefreshError
      }
      // Otherwise, let's retry all other operations!
      throw new RetryRequest()
      //     return op.fetch()
    }

    // console.warn('activate blocking', op.context.url)
    // perform retry operation.
    retryingOp = op
    // only capture refresh's error.
    let refreshError: Error | null = null
    try {
      await onRetry().catch((e) => (refreshError = e))
      // lift blockage.
      retryingOp = undefined
      if (refreshError) {
        // console.info('>> REFRESH ERROR', op.context.url, refreshError)
        throw refreshError
      }
    } catch (e) {
      // console.error('>>>>>>> ON', op.context.url, e)
      // TODO: Log the `e`
      return result // return original result!
    } finally {
      // console.warn('released pending ops by', op.context.url)
      // invoke the rest, using pop + while loop to ensure no race condition.
      do {
        blockedOps.pop()?.(refreshError)
      } while (blockedOps.length > 0)
    }
    // re call last-op
    throw new RetryRequest()
    //    return op.fetch() // This should have the pipeline re-run
  }
}
