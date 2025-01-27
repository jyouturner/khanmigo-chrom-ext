class ConfigValidator {
  static validateConfig(config) {
    const requiredFields = [
      'API_ENDPOINTS',
      'ENHANCEMENT_TYPES',
      'DEFAULT_SETTINGS',
      'PROMPT_TEMPLATES'
    ];

    for (const field of requiredFields) {
      if (!config[field]) {
        throw new Error(`Missing required config field: ${field}`);
      }
    }

    if (!config.API_ENDPOINTS.DEEPSEEK || !config.API_ENDPOINTS.KHAN_AI) {
      throw new Error('Missing required API endpoints');
    }

    return true;
  }
}

export default ConfigValidator; 