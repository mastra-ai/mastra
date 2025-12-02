import { PromiseQueue } from './promise-queue'

function buildPromise(time: number): Promise<number> {
  return new Promise((res, rej) => setTimeout(() => res(42), time))
}

function buildRecursivePromise(time: number, cb: () => void) {
  return new Promise((res, rej) => {
    setTimeout(() => {
      cb()
      res(42)
    }, time)
  })
}

describe('promise-queue', () => {
  beforeAll(() => jest.useRealTimers())
  afterAll(() => jest.useFakeTimers())

  it('should exit directly if the queue is empty', async () => {
    const queue = new PromiseQueue()
    expect(queue.length).toBe(0)
    expect(queue.join()).resolves.toBe(undefined)
  })

  it('should add a promise to the queue', async () => {
    const queue = new PromiseQueue()
    queue.add(buildPromise(100))
    expect(queue.length).toBe(1)
    await queue.join()
    expect(queue.length).toBe(0)
  })

  it('should wait even when promises create other promises', async () => {
    const queue = new PromiseQueue()
    const addSpy = jest.spyOn(queue, 'add')
    queue.add(
      buildRecursivePromise(100, () => {
        queue.add(buildPromise(100))
      })
    )
    expect(queue.length).toBe(1)
    await queue.join()
    expect(queue.length).toBe(0)
    expect(addSpy).toHaveBeenCalledTimes(2)
  })

  it('it should reject if a promise reject', async () => {
    const queue = new PromiseQueue()
    queue.add(Promise.reject(new Error('test')))
    expect(queue.length).toBe(1)
    await expect(queue.join()).rejects.toHaveProperty('message', 'test')
    expect(queue.length).toBe(0)
  })
})
