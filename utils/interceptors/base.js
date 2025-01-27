class BaseInterceptor {
  constructor(config) {
    if (this.constructor === BaseInterceptor) {
      throw new Error('BaseInterceptor cannot be instantiated directly');
    }
    this.config = config;
  }

  async processRequest(data) {
    throw new Error('processRequest must be implemented by subclass');
  }

  async handleResponse(response) {
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    return response.json();
  }
}

export default BaseInterceptor; 