
const isBrowser = typeof window !== 'undefined' && window.addEventListener

const timers = new Map()

/**
 * Ready check for initialization
 *
 * @returns {Boolean}
 */
const isReady = () => isBrowser && window.__WEB3_INITIALIZED__

/**
 * Utility method allowing to throttle a user action based on a key and a minimum delay.
 *
 * @param key {String} A unique key
 * @param delay {Number} The minimal delay to throttle
 * @returns {Boolean}
 */
const throttle = (key, delay) => {
  const time = timers.get(key)
  const now = Date.now()
  if (time && now - time < delay) { return true }
  timers.set(key, now)
  return false
}

const replacer = seen => (key, value) => {
  if (value && typeof value === 'object' && seen.has(value)) { return }
  seen.add(value)
  const isArray = Object.prototype.toString.call(value).slice(8, -1).includes('Array')
  if (isArray) { return Array.prototype.slice.call(value, 0, 20) }
  return value
}

/**
 * Low-level api leveraging window.postMessage
 *
 * @param type {String} The action type
 * @param payload {Any} The action payload
 */
const send = (type, data = {}) => {
  if (!isBrowser || !isReady()) { return }

  const seen = new Set()
  const payload = JSON.stringify(data, replacer(seen))

  try {
    window.postMessage({ type, payload, source: 'web3-agent' }, '*')
  } catch (e) {
    if (throttle('web3-log', 2E3)) { return }
    console.log(e) // eslint-disable-line
  }
}

const listeners = new Map()

const listener = message => {
  if (!message || !message.data || message.data.source !== 'web3env-core') { return }
  const { type, payload } = message.data

  const typeListeners = listeners.get(type)
  if (typeListeners) {
    typeListeners.forEach(cb => cb(payload))
  }
}

/**
 * Initialize window listener. There will be only one for the whole process
 * to prevent too many registrations.
 *
 * This method will be called automatically if you use the `listenFor` method.
 */
const init = () => {
  if (!isBrowser || window.__WEB3_LISTENER__) { return }
  window.addEventListener('message', listener)
  window.__WEB3_LISTENER__ = true
}

/**
 * Clean listener. Can be useful in case you want to unregister upcoming events
 * or liberate memory.
 */
const clean = () => {
  if (!isBrowser || !window.__WEB3_LISTENER__) { return }
  window.removeEventListener('message', listener)
  delete window.__WEB3_LISTENER__
}

/**
 * Create a listener that will be called upon events of the given key.
 *
 * @param key {String} The unique tab key
 * @param cb {Function} A callback that will receive the message payload
 */
const listenFor = (type, cb) => {
  if (!isBrowser) { return }
  if (!type || !cb) { throw new Error('Please provide a type and callback') }
  if (!listeners.has(type)) { listeners.set(type, []) }
  if (!window.__WEB3_LISTENER__) { init() }
  listeners.get(type).push(cb)
}

/**
 * Remove an identity listener
 *
 * @param cb {Function} The callback to remove
 */
const removeListener = cb => {
  listeners.forEach((typeListeners, key) => {
    listeners.set(key, typeListeners.filter(l => l !== cb))
  })
}

/**
 * Creates a new indexed list.
 * It works by index to get O(1) accessing and performance.
 *
 * @param key {String} The key of the tab
 * @param data {Object} The indexed object
 */
const list = (key, data) => send('LIST', { key, data })

/**
 * Creates an element in the indexed list, based on the itemKey.
 *
 * @param key {String} The key of the tab
 * @param itemKey {String} The key of the item
 * @param data {Any} The value of the item
 */
const listItem = (key, itemKey, data = {}) => send('LIST_ITEM', { key, itemKey, data })

/**
 * Update an item property, can be deeply nested.
 *
 * @param key {String} The key of the tab
 * @param itemKey {String} The key of the item
 * @param path {String} The path of the variable you want to update
 * @param data {Object} The new value
 */
const updateItem = (key, itemKey, path, data) => send('UPDATE_ITEM', { key, itemKey, path, data })

/**
 * Similar to updateItem, but allows to pass an array with {path,data} pairs for
 * multiple update of the same item without having to send multiple messages.
 *
 * @param key {String} The key of the tab
 * @param itemKey {String} The key of the item
 * @param array {Array} The array of updates
 * @param array.path {String} The path for this update
 * @param array.data {Object} The value of this update
 */
const multiUpdate = (key, itemKey, array) => send('MULTI_UPDATE_ITEM', { key, itemKey, array })

/**
 * Remove a specific item in a specific tab.
 *
 * @param key {String} They key of the tab
 * @param itemKey {String} The key of the item
 */
const deleteItem = (key, itemKey) => send('DELETE_ITEM', { key, itemKey })

/**
 * Will create a log message to an item, that will be displayde with the current time.
 *
 * @param key {String} The key of the tab
 * @param itemKey {String} The key of the item
 * @param msg {String} The message to display
 */
const addLog = (key, itemKey, msg) => send('ADD_LOG', { key, itemKey, msg })

export default {

  send,
  throttle,
  isReady,

  list,
  listItem,
  updateItem,
  multiUpdate,
  deleteItem,
  addLog,

  listeners,
  listenFor,
  removeListener,
  init,
  clean,

}
