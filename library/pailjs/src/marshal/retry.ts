import { release } from 'os'
import type { IFetchBuilderOp, MarshalTypeMorpher } from '../interface'

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
      return result
    }
    // if this retry block is being called from a different operation, (retryingOp is defined; but not the one invoking), block it.
    if (retryingOp) {
      // Create a fake promise; it will be resolved when the other operation is done.
      const waitForOtherRefresh = new Promise((resolve) => blockedOps.push(resolve))
      const hasRefreshError = await waitForOtherRefresh
      if (hasRefreshError) {
        // Throw the same error on all endpoints
        throw hasRefreshError
      }
      // Otherwise, let's retry all other operations!
      return op.fetch()
    }
    // perform retry operation.
    retryingOp = op
    // only capture refresh's error.
    let refreshError: Error | null = null
    try {
      await onRetry().catch((e) => (refreshError = e))
      if (refreshError) {
        throw refreshError
      }
      // lift blockage.
      retryingOp = undefined
      // re call last-op
      return op.fetch() // This should have the pipeline re-run
    } catch (e) {
      // TODO: Log the `e`
      return result // return original result!
    } finally {
      // invoke the rest, using pop + while loop to ensure no race condition.
      do {
        blockedOps.pop()?.(refreshError)
      } while (blockedOps.length > 0)
    }
  }
}
