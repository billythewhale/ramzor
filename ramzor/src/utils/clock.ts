export function monotonic(
  opt: {
    nanoseconds?: boolean;
  } = {}
): number {
  const time = process.hrtime.bigint();
  return opt.nanoseconds ? Number(time) : Math.floor(Number(time) / 1000000); // convert to milliseconds
}
