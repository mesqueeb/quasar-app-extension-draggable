
export default function sortBy (propName, desc = false) {
  return function (a, b) {
    a = a[propName]
    b = b[propName]
    if (!desc || desc === 'asc') {
      return (a > b)
        ? 1
        : ((b > a)
          ? -1
          : 0)
    }
    return (a < b)
      ? 1
      : ((b < a)
        ? -1
        : 0)
  }
}
