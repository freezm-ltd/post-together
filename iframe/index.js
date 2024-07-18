// node_modules/.pnpm/@freezm-ltd+event-target-2@https+++codeload.github.com+freezm-ltd+EventTarget2+tar.gz+082e882_42iqhccuiyqwyz5j3pxwuadn7a/node_modules/@freezm-ltd/event-target-2/dist/index.js
var EventTarget2 = class extends EventTarget {
  constructor() {
    super(...arguments);
    this._bubbleMap = /* @__PURE__ */ new Map();
  }
  async waitFor(type) {
    return new Promise((resolve) => {
      this.addEventListener(type, resolve, { once: true });
    });
  }
  callback(type, callback) {
    this.waitFor(type).then((result) => callback(result));
  }
  dispatch(type, detail) {
    this.dispatchEvent(new CustomEvent(type, detail ? { detail } : void 0));
  }
  listen(type, callback, options) {
    this.addEventListener(type, callback, options);
  }
  remove(type, callback, options) {
    this.removeEventListener(type, callback, options);
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
};

// src/utils.ts
function generateId() {
  return crypto.randomUUID();
}

// src/message.ts
var IDENTIFIER = "post-together";
function isMessage(data) {
  return data.id && data.type && data.payload && data.__identifier === IDENTIFIER;
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
    this.listenTargetWeakMap = /* @__PURE__ */ new WeakMap();
  }
  // create request message from type and payload
  createRequest(type, payload) {
    const id = generateId();
    return { id, type, payload, __type: "request", __identifier: IDENTIFIER };
  }
  // create response message from request message and payload
  createResponse(request, payload) {
    const { id, type, __identifier } = request;
    return { id, type, payload, __type: "response", __identifier };
  }
  // listen for response
  responseCallback(request, callback) {
    const listener = (e) => {
      const response = unwrapMessage(e);
      if (response && response.id === request.id && response.type === request.type && response.__type === "response") {
        this.listenFrom.removeEventListener("message", listener);
        callback(response.payload);
      }
    };
    this.listenFrom.addEventListener("message", listener);
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
    this._getSendTo(event).postMessage(message, { transfer: message.payload.transfer });
  }
  // send message and get response
  request(type, payload) {
    return new Promise(async (resolve) => {
      const message = this.createRequest(type, payload);
      this.responseCallback(message, resolve);
      await this._send(message);
    });
  }
  wrapMessageHandler(type, handler) {
    return async (e) => {
      const request = unwrapMessage(e);
      if (request && request.type === type && request.__type === "request" && this.activated) {
        const payload = await handler(request.payload, request.payload.transfer);
        const response = this.createResponse(request, payload);
        await this._send(response, e);
      }
    };
  }
  // get request and give response
  response(type, handler) {
    const wrapped = this.wrapMessageHandler(type, handler);
    this.listenTargetWeakMap.set(handler, wrapped);
    this.listenFrom.addEventListener("message", wrapped);
  }
  // remove response handler
  deresponse(handler) {
    const wrapped = this.listenTargetWeakMap.get(handler);
    if (wrapped) this.listenFrom.removeEventListener("message", wrapped);
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

// src/broadcastchannel.ts
var MessageHubCrossOriginIframeURL = "https://freezm-ltd.github.io/post-together/iframe/";
var MessageStoreMessageType = `${IDENTIFIER}:__store`;
var MessageFetchMessageType = `${IDENTIFIER}:__fetch`;
var BroadcastChannelMessenger = class extends Messenger {
  async _send(message) {
    if (message.payload.transfer) {
      const { payload, ...metadata } = message;
      const response = await MessageHub.instance.store(message);
      if (response.data !== "success") throw new Error("BroadcastChannelMessengerSendError: MessageHub store failed.");
      this._getSendTo().postMessage(metadata);
    } else {
      this._getSendTo().postMessage(message);
    }
  }
  wrapMessageHandler(type, handler) {
    return async (e) => {
      const request = unwrapMessage(e);
      if (request && request.type === type && request.__type === "request" && this.activated) {
        if (!request.payload) {
          const { id } = request;
          const payload2 = await MessageHub.instance.fetch(id);
          if (payload2.data === "error") throw new Error("BroadcastChannelMessengerListenError: MessageHub fetch failed.");
          request.payload = payload2;
        }
        const payload = await handler(request.payload, request.payload.transfer);
        const response = this.createResponse(request, payload);
        await this._send(response);
      }
    };
  }
};
var AbstractMessageHub = class extends EventTarget2 {
  constructor() {
    super();
    // message store/fetch request target
    this.initNeed = true;
    this.init();
  }
  async init() {
    await this._init();
    this.initNeed = false;
    this.dispatch("done");
  }
  async _init() {
  }
  async store(message) {
    if (!this.initNeed) await this.waitFor("done");
    const response = await this.target.request(MessageStoreMessageType, { data: message, transfer: message.payload.transfer });
    if (response && response.data === "success") {
      return response;
    } else {
      throw new Error("MessageHubStoreError: MessagHub returned corrupted or unsuccessful response.");
    }
  }
  async fetch(id) {
    if (!this.initNeed) await this.waitFor("done");
    const response = await this.target.request(MessageFetchMessageType, { data: id });
    if (response && response.data !== "error") {
      return response.data;
    } else {
      throw new Error("MessageHubFetchError: MessagHub returned corrupted or unsuccessful response.");
    }
  }
  // listen request
  addListen(listenFrom) {
    const listenTarget = MessengerFactory.new(listenFrom);
    listenTarget.response(MessageStoreMessageType, async (message) => {
      return await this.store(message);
    });
    listenTarget.response(MessageFetchMessageType, async (id) => {
      return await this.fetch(id);
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
    this.storage.set(message.id, message.payload);
    return { data: "success" };
  }
  async fetch(id) {
    let payload = this.storage.get(id);
    if (!payload) payload = { data: "error" };
    return payload;
  }
};
var DedicatedWorkerMessageHub = class extends AbstractMessageHub {
  // worker -> parent window
  async _init() {
    this.target = MessengerFactory.new(self);
  }
};
var WindowMessageHub = class extends AbstractMessageHub {
  // worker/window -> window -> iframe/serviceworker -> window -> worker/window
  async _init() {
    const serviceWorkerContainer = globalThis.navigator.serviceWorker;
    if (serviceWorkerContainer.controller) {
      this.target = MessengerFactory.new(serviceWorkerContainer);
    } else {
      let iframeload = false;
      const _this = this;
      const iframe = document.createElement("iframe");
      iframe.onload = () => {
        const iframeWindow = iframe.contentWindow;
        _this.target = MessengerFactory.new(iframeWindow);
        iframeload = true;
        _this.dispatch("iframeload");
      };
      iframe.setAttribute("src", MessageHubCrossOriginIframeURL);
      iframe.style.display = "none";
      document.body.appendChild(iframe);
      if (!iframeload) await this.waitFor("iframeload");
    }
    this.addListen(window);
  }
};
var MessageHub = class _MessageHub extends AbstractMessageHub {
  constructor() {
    super();
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
  async store(message) {
    return this.hub.store(message);
  }
  async fetch(id) {
    return this.hub.fetch(id);
  }
};

// src/crossoriginwindow.ts
var CrossOriginWindowMessenger = class extends Messenger {
  constructor(listenFrom, sendTo) {
    super(listenFrom, sendTo);
    this.listenFrom = listenFrom;
    this.sendTo = sendTo;
    this.sendToOrigin = sendTo.origin;
  }
  async _send(message, event) {
    this._getSendTo(event).postMessage(message, { transfer: message.payload.transfer, targetOrigin: this.sendToOrigin });
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
        MessageHub.instance.addListen(option);
        break;
      }
      case globalThis.DedicatedWorkerGlobalScope: {
        listen = send = option;
        break;
      }
      case globalThis.Window: {
        const targetWindow = option;
        if (targetWindow.origin !== window.origin) return new CrossOriginWindowMessenger(window, targetWindow);
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
function initMessageHub() {
  MessageHub.init();
}
export {
  BroadcastChannelMessenger,
  MessageHub,
  Messenger,
  MessengerFactory,
  initMessageHub
};
