class RequestManager {
  constructor(config) {
    this.config = config;
    this.interceptors = new Map();
    this.originalFetch = window.fetch.bind(window);
  }

  registerInterceptor(name, interceptor) {
    this.interceptors.set(name, interceptor);
  }

  async handleRequest(resource, init) {
    const url = resource instanceof Request ? resource.url : resource;
    const options = this.normalizeOptions(resource, init);

    for (const interceptor of this.interceptors.values()) {
      if (await interceptor.shouldIntercept(url, options)) {
        return interceptor.processRequest(url, options);
      }
    }

    return this.originalFetch(url, options);
  }

  normalizeOptions(resource, init) {
    return resource instanceof Request ? {
      method: resource.method,
      headers: new Headers(resource.headers),
      body: resource.body,
      credentials: resource.credentials,
      mode: resource.mode
    } : init;
  }
}

export default RequestManager; 