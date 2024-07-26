// node_modules/.pnpm/@freezm-ltd+event-target-2@https+++codeload.github.com+freezm-ltd+EventTarget2+tar.gz+11ff208_3njyjyppej5icdv7ro2urw6f3a/node_modules/@freezm-ltd/event-target-2/dist/index.js
var EventTarget2 = class extends EventTarget {
  constructor() {
    super(...arguments);
    this.listeners = /* @__PURE__ */ new Map();
    this._bubbleMap = /* @__PURE__ */ new Map();
    this.atomicQueue = /* @__PURE__ */ new Map();
  }
  async waitFor(type, compareValue) {
    return new Promise((resolve) => {
      if (compareValue !== void 0) {
        this.listenOnceOnly(type, (e) => resolve(e.detail), (e) => e.detail === compareValue);
      } else {
        this.listenOnce(type, (e) => resolve(e.detail));
      }
    });
  }
  callback(type, callback) {
    this.waitFor(type).then(callback);
  }
  dispatch(type, detail) {
    this.dispatchEvent(new CustomEvent(type, detail !== void 0 ? { detail } : void 0));
  }
  listen(type, callback, options) {
    if (!this.listeners.has(type)) this.listeners.set(type, /* @__PURE__ */ new Set());
    this.listeners.get(type).add(callback);
    this.addEventListener(type, callback, options);
  }
  remove(type, callback, options) {
    if (!this.listeners.has(type)) this.listeners.set(type, /* @__PURE__ */ new Set());
    this.listeners.get(type).delete(callback);
    this.removeEventListener(type, callback, options);
  }
  destroy() {
    for (let type of this.listeners.keys()) {
      for (let callback of this.listeners.get(type)) {
        this.remove(type, callback);
      }
    }
  }
  listenOnce(type, callback) {
    this.listen(type, callback, { once: true });
  }
  listenOnceOnly(type, callback, only) {
    const wrapper = (e) => {
      if (only(e)) {
        this.remove(type, wrapper);
        callback(e);
      }
    };
    this.listen(type, wrapper);
  }
  listenDebounce(type, callback, options = { timeout: 100, mode: "last" }) {
    switch (options.mode) {
      case "first":
        return this.listenDebounceFirst(type, callback, options);
      case "last":
        return this.listenDebounceLast(type, callback, options);
    }
  }
  listenDebounceFirst(type, callback, options = { timeout: 100 }) {
    let lastMs = 0;
    this.listen(
      type,
      (e) => {
        const currentMs = Date.now();
        if (currentMs - lastMs > options.timeout) {
          callback(e);
        }
        lastMs = currentMs;
      },
      options
    );
  }
  listenDebounceLast(type, callback, options = { timeout: 100 }) {
    let timoutInstance;
    this.listen(
      type,
      (e) => {
        clearTimeout(timoutInstance);
        timoutInstance = window.setTimeout(() => callback(e), options.timeout);
      },
      options
    );
  }
  enableBubble(type) {
    if (this._bubbleMap.has(type)) return;
    const dispatcher = (e) => {
      this.parent?.dispatch(e.type, e.detail);
    };
    this.listen(type, dispatcher);
    this._bubbleMap.set(type, dispatcher);
  }
  disableBubble(type) {
    if (!this._bubbleMap.has(type)) return;
    const dispatcher = this._bubbleMap.get(type);
    this.remove(type, dispatcher);
    this._bubbleMap.delete(type);
  }
  _atomicInit(type) {
    this.atomicQueue.set(type, []);
    const atomicLoop = async () => {
      const queue = this.atomicQueue.get(type);
      while (true) {
        const task = queue.shift();
        if (task) {
          await task();
        } else {
          await this.waitFor("__atomic-add", type);
        }
      }
    };
    atomicLoop();
  }
  atomic(type, func) {
    return new Promise((resolve) => {
      const wrap = async () => resolve(await func());
      if (!this.atomicQueue.has(type)) this._atomicInit(type);
      this.atomicQueue.get(type).push(wrap);
      this.dispatch("__atomic-add", type);
    });
  }
};

// src/utils.ts
function generateId() {
  return crypto.randomUUID();
}

// src/message.ts
var IDENTIFIER = "post-together";
function isMessage(data) {
  return data.id && data.type && data.__identifier === IDENTIFIER;
}
function isMessageCustomEvent(e) {
  return "data" in e && isMessage(e.data);
}
function unwrapMessage(e) {
  if (isMessageCustomEvent(e)) {
    return e.data;
  }
}
var Messenger = class {
  constructor(listenFrom, sendTo) {
    this.listenFrom = listenFrom;
    this.sendTo = sendTo;
    //protected readonly sendTarget: MessageSendTarget
    //protected readonly listenTarget: MessageListenTarget
    this.activated = true;
    // wrap message handler (request -> response)
    this.listenerWeakMap = /* @__PURE__ */ new WeakMap();
    this.listenerSet = /* @__PURE__ */ new Set();
  }
  // create request message from type and payload
  createRequest(type, payload, transfer) {
    const id = generateId();
    return { id, type, payload, transfer, __type: "request", __identifier: IDENTIFIER };
  }
  // create response message from request message and payload
  createResponse(request, payload, transfer) {
    const { id, type, __identifier } = request;
    return { id, type, payload, transfer, __type: "response", __identifier };
  }
  // inject informations to message
  async _inject(message) {
  }
  // listen for response
  responseCallback(request, callback) {
    const listener = async (e) => {
      const response = unwrapMessage(e);
      if (response && response.id === request.id && response.type === request.type && response.__type === "response") {
        await this._inject(response);
        this.listenFrom.removeEventListener("message", listener);
        callback(response.payload);
      }
    };
    this.listenFrom.addEventListener("message", listener);
    return () => this.listenFrom.removeEventListener("message", listener);
  }
  _getSendTo(event) {
    let sendTo = this.sendTo;
    if (event) {
      const source = event.source;
      if (source) sendTo = source;
    }
    return sendTo;
  }
  // send message
  async _send(message, event) {
    const option = { transfer: message.transfer };
    if (isIframe()) Object.assign(option, { targetOrigin: "*" });
    this._getSendTo(event).postMessage(message, option);
  }
  // send message and get response
  request(type, payload, transfer, timeout = 5e3) {
    return new Promise(async (resolve, reject) => {
      const message = this.createRequest(type, payload, transfer);
      const rejector = this.responseCallback(message, resolve);
      await this._send(message);
      setTimeout(() => {
        rejector();
        reject(`MessengerRequestTimeoutError: request timeout reached: ${timeout}ms`);
      }, timeout);
    });
  }
  wrapMessageHandler(type, handler) {
    return async (e) => {
      const request = unwrapMessage(e);
      if (request && request.type === type && request.__type === "request" && this.activated) {
        await this._inject(request);
        const result = await handler(request.payload);
        let response;
        if (result instanceof Object && "payload" in result && "transfer" in result) {
          const { payload, transfer } = result;
          response = this.createResponse(request, payload, transfer);
        } else {
          response = this.createResponse(request, result);
        }
        await this._send(response, e);
      }
    };
  }
  // get request and give response
  response(type, handler) {
    if (this.listenerSet.has(handler)) throw new Error("MessengerAddEventListenerError: this message handler already attached");
    const wrapped = this.wrapMessageHandler(type, handler);
    this.listenerWeakMap.set(handler, wrapped);
    this.listenerSet.add(handler);
    this.listenFrom.addEventListener("message", wrapped);
  }
  // remove response handler
  deresponse(handler) {
    const iterator = handler ? [handler] : this.listenerSet;
    for (let handler2 of iterator) {
      const wrapped = this.listenerWeakMap.get(handler2);
      if (wrapped) {
        this.listenFrom.removeEventListener("message", wrapped);
        this.listenerWeakMap.delete(handler2);
      }
      this.listenerSet.delete(handler2);
    }
  }
  // re-activate message handling
  activate() {
    if (this.activated) return;
    this.activated = true;
  }
  // deactivate message handling
  deactivate() {
    if (!this.activated) return;
    this.activated = false;
  }
};

// src/crossoriginwindow.ts
var CrossOriginWindowMessenger = class extends Messenger {
  constructor(listenFrom, sendTo, sendToOrigin) {
    super(listenFrom, sendTo);
    this.listenFrom = listenFrom;
    this.sendTo = sendTo;
    this.sendToOrigin = sendToOrigin;
  }
  async _send(message, event) {
    this._getSendTo(event).postMessage(message, { transfer: message.transfer, targetOrigin: this.sendToOrigin });
  }
};

// src/broadcastchannel.ts
var MessageHubCrossOriginIframeURL = "https://freezm-ltd.github.io/post-together/iframe/";
var MessageHubCrossOriginIframeOrigin = new URL(MessageHubCrossOriginIframeURL).origin;
function isIframe(origin) {
  if (globalThis.constructor === globalThis.Window) {
    if (!origin) origin = window.origin;
    return origin === MessageHubCrossOriginIframeOrigin;
  }
  return false;
}
var MessageStoreMessageType = `${IDENTIFIER}:__store`;
var MessageFetchMessageType = `${IDENTIFIER}:__fetch`;
var BroadcastChannelMessenger = class extends Messenger {
  async _inject(message) {
    if (message.payload) return;
    const { id } = message;
    const response = await MessageHub.fetch(id);
    if (!response.ok) throw new Error("BroadcastChannelMessengerFetchPayloadError: MessageHub fetch failed.");
    message.payload = response.message.payload;
    message.transfer = response.message.transfer;
  }
  async _send(message) {
    if (message.transfer) {
      const { payload, transfer, ...metadata } = message;
      const result = await MessageHub.store(message);
      if (!result.ok) throw new Error("BroadcastChannelMessengerSendError: MessageHub store failed.");
      this._getSendTo().postMessage(metadata);
    } else {
      this._getSendTo().postMessage(message);
    }
  }
};
var AbstractMessageHub = class extends EventTarget2 {
  constructor() {
    super();
    // message store/fetch request target
    this.state = "off";
    this.listenFroms = /* @__PURE__ */ new Set();
    this.init();
  }
  async init() {
    if (this.state === "on") return;
    if (this.state === "initializing") return await this.waitFor("done");
    this.state = "initializing";
    await this._init();
    this.state = "on";
    this.dispatch("done");
  }
  async _init() {
  }
  async store(message) {
    await this.init();
    return await this.target.request(MessageStoreMessageType, message, message.transfer);
  }
  async fetch(id) {
    await this.init();
    return await this.target.request(MessageFetchMessageType, id);
  }
  // listen request
  async addListen(listenFrom) {
    await this.init();
    if (this.listenFroms.has(listenFrom)) return;
    const listenTarget = MessengerFactory.new(listenFrom);
    this.listenFroms.add(listenFrom);
    listenTarget.response(MessageStoreMessageType, async (message) => {
      return await this.store(message);
    });
    listenTarget.response(MessageFetchMessageType, async (id) => {
      const result = await this.fetch(id);
      if (result.ok) {
        return { payload: result, transfer: result.message.transfer };
      }
      return result;
    });
  }
};
var ServiceWorkerMessageHub = class extends AbstractMessageHub {
  constructor() {
    super(...arguments);
    this.storage = /* @__PURE__ */ new Map();
  }
  // add listen; requests from windows -> serviceworker
  async _init() {
    this.addListen(self);
  }
  // service worker is MessageHub storage itself
  async store(message) {
    try {
      this.storage.set(message.id, message);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e };
    }
  }
  async fetch(id) {
    let message = this.storage.get(id);
    if (!message) return { ok: false, error: "Not Found" };
    this.storage.delete(id);
    return { ok: true, message };
  }
};
var DedicatedWorkerMessageHub = class extends AbstractMessageHub {
  // worker -> parent window
  async _init() {
    this.target = MessengerFactory.new(self);
  }
};
var WindowMessageHub = class extends AbstractMessageHub {
  async _initSameOrigin() {
    if (!globalThis.navigator.serviceWorker.controller) {
      setTimeout(() => {
        window.location.assign(window.location.href);
      }, 1e3);
      await new Promise(() => {
      });
    } else {
      this.target = MessengerFactory.new(globalThis.navigator.serviceWorker);
      window.parent.postMessage("loadend", { targetOrigin: "*" });
    }
  }
  async _initCrossOrigin() {
    let iframeload = false;
    const iframe = document.createElement("iframe");
    const listener = (e) => {
      if (isIframe(e.origin) && e.data === "loadend") {
        iframeload = true;
        this.dispatch("iframeloadend");
        window.removeEventListener("message", listener);
      }
    };
    window.addEventListener("message", listener);
    iframe.setAttribute("src", MessageHubCrossOriginIframeURL);
    iframe.style.display = "none";
    document.body.appendChild(iframe);
    if (!iframeload) await this.waitFor("iframeloadend");
    this.target = new CrossOriginWindowMessenger(window, iframe.contentWindow, MessageHubCrossOriginIframeOrigin);
  }
  // worker/window -> window -> iframe/serviceworker -> window -> worker/window
  async _init() {
    if (isIframe()) await this._initSameOrigin();
    else await this._initCrossOrigin();
    this.addListen(window);
  }
};
var MessageHub = class _MessageHub {
  constructor() {
    this.changeHub();
  }
  changeHub() {
    switch (globalThis.constructor) {
      case globalThis.ServiceWorkerGlobalScope:
        this.hub = new ServiceWorkerMessageHub();
        break;
      case globalThis.Window:
        this.hub = new WindowMessageHub();
        break;
      case globalThis.DedicatedWorkerGlobalScope:
        this.hub = new DedicatedWorkerMessageHub();
        break;
      default:
        throw new Error("MessageHubConstructError: Cannot create MessageHub instance in this scope.");
    }
  }
  static init() {
    if (!_MessageHub._instance) _MessageHub._instance = new _MessageHub();
  }
  static get instance() {
    this.init();
    return _MessageHub._instance;
  }
  static async store(message) {
    return this.instance.hub.store(message);
  }
  static async fetch(id) {
    return this.instance.hub.fetch(id);
  }
  static async addListen(listenFrom) {
    return this.instance.hub.addListen(listenFrom);
  }
};

// src/index.ts
var MessengerFactory = class {
  constructor() {
  }
  static new(option) {
    if (!option) throw new Error("MessengerFactoryNoOptionError: Cannot create Messenger, argument 'option' is not provided");
    let send;
    let listen;
    switch (option.constructor) {
      case globalThis.ServiceWorker: {
        listen = window.navigator.serviceWorker;
        send = option;
        break;
      }
      case globalThis.ServiceWorkerContainer: {
        listen = option;
        send = option.controller;
        break;
      }
      case globalThis.ServiceWorkerGlobalScope: {
        listen = option;
        send = void 0;
        break;
      }
      case globalThis.Worker: {
        listen = send = option;
        MessageHub.addListen(option);
        break;
      }
      case globalThis.DedicatedWorkerGlobalScope: {
        listen = send = option;
        break;
      }
      case globalThis.Window: {
        const targetWindow = option;
        listen = window;
        send = targetWindow;
        break;
      }
      case globalThis.Client: {
        listen = self;
        send = option;
        break;
      }
      case globalThis.BroadcastChannel: {
        const name = option.name;
        return new BroadcastChannelMessenger(new BroadcastChannel(name), new BroadcastChannel(name));
      }
      case globalThis.MessagePort: {
        listen = send = option;
        break;
      }
    }
    if (listen) {
      return new Messenger(listen, send);
    } else {
      throw new Error("MessengerFactoryError: Cannot create Messenger, arguments not supported");
    }
  }
};
MessageHub.init();
export {
  BroadcastChannelMessenger,
  MessageHub,
  Messenger,
  MessengerFactory
};
