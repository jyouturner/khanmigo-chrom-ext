console.log('Loading configuration...');

var CONFIG = (function() {
  console.log('Initializing config object');
  
  const config = {
    API_ENDPOINTS: {
      DEEPSEEK: 'https://api.deepseek.com/chat/completions',
      KHAN_AI: '/api/internal/_ai-guide/streaming-chat'
    },
    
    ENHANCEMENT_TYPES: {
      PEDAGOGICAL: 'pedagogical',
      COGNITIVE: 'cognitive',
      ERROR_PREVENTION: 'error_prevention'
    },
    
    DEFAULT_SETTINGS: {
      socraticQuestioning: true,
      errorPrevention: false,
      interactiveChecks: true,
      debugMode: false,
      deepseekKey: ''
    },
    
    PROMPT_TEMPLATES: {
      SYSTEM_PROMPT: "You are the master tutor to help the tutor.",
      ERROR_PREVENTION: 'Common errors to watch for in this type of problem include...'
    },
    
    apiEndpoint: 'https://api.khanacademy.org',
    debugMode: false
  };

  console.log('Config initialization complete');
  return config;
})();

console.log('CONFIG ready:', CONFIG); 