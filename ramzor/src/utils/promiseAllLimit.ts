export async function promiseAllLimit(
  inputs: any[],
  limit: number,
  promiseCreator: (args: any) => Promise<any>,
  rejectionHandler?: (e: any) => void
) {
  if (!inputs.length) {
    return [];
  }

  let count = 0;
  let finished = 0;
  const result: any[] = [];
  let continueFn = (args?: any) => {};
  const waiter = new Promise((res) => {
    continueFn = res;
  });

  const next = async () => {
    if (count >= inputs.length) {
      return;
    }
    const i = count++;
    try {
      result[i] = await promiseCreator(inputs[i]);
    } catch (e) {
      if (rejectionHandler) {
        rejectionHandler(e);
      } else {
        result[i] = e;
      }
    }
    finished++;
    if (finished >= inputs.length) {
      continueFn();
      return;
    }
    next();
  };

  const parallel = Math.min(limit, inputs.length);

  for (let i = 0; i < parallel; i++) {
    next();
  }

  await waiter;
  return result;
}
