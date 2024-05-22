export const filterBadHttpStatus =
  (
    onError: (response: Response) => Promise<Error> = (rs) => rs.text().then((t) => new Error(t)),
    isErrornous: (httpStatus: number) => boolean = (s) => s >= 400,
  ) =>
  async <T>(result: T, response: Response): Promise<T> => {
    if (!isErrornous(response.status)) {
      return result
    }

    // Handle error and throw
    const error = await onError(response)
    throw error
  }
