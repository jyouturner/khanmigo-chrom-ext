// contentLoader.js
const extensionManagerURL = chrome.runtime.getURL('core/extensionManager.js');

function logToPage(message) {
 const el = document.createElement('div');
 el.style.position = 'fixed';
 el.style.bottom = '0';
 el.style.right = '0';
 el.style.background = 'black';
 el.style.color = 'white';
 el.style.padding = '10px';
 el.style.zIndex = '999999';
 el.textContent = `[Extension] ${message}`;
 document.body.appendChild(el);
}

(function() {
 const MAX_RETRIES = 5;
 const RETRY_INTERVAL = 3000;
 let retryCount = 0;

 // Add a flag to track content script readiness
 let contentScriptReady = false;

 async function getStoredSettings() {
   return new Promise(resolve => {
     chrome.storage.local.get(['deepseekKey'], result => {
       if (result.deepseekKey) {
         CONFIG.DEFAULT_SETTINGS.deepseekKey = result.deepseekKey;
         console.log('[ContentLoader] Loaded API key from storage:', '***REDACTED***');
       } else {
         console.log('[ContentLoader] No API key found in storage');
         // Ensure we don't have an empty string
         CONFIG.DEFAULT_SETTINGS.deepseekKey = null;
       }
       resolve(result.deepseekKey);
     });
   });
 }

 function isAlreadyInjected() {
   return window.solutionInjectorInstance || document.querySelector('script[data-injector="true"]');
 }

 async function injectScript(scriptName) {
   const script = document.createElement('script');
   script.src = chrome.runtime.getURL(scriptName);
   script.dataset.injector = "true";  // Add identifier for injection check
   document.documentElement.appendChild(script);

   return new Promise((resolve, reject) => {
     script.onload = resolve;
     script.onerror = reject;
   });
 }

 function removeExistingInjection() {
   const existingScript = document.querySelector('script[data-injector="true"]');
   if (existingScript) {
     existingScript.remove();
     window.solutionInjectorLoaded = false;
     if (window.solutionInjectorInstance?.cleanup) {
       window.solutionInjectorInstance.cleanup();
     }
   }
 }

 async function initialize() {
   try {
     if (isAlreadyInjected()) {
       console.log('[ContentLoader] Already injected');
       return true;
     }
     
     const apiKey = await getStoredSettings();
     console.log('[ContentLoader] Settings loaded, deepseekKey exists:', !!apiKey);
     
     await injectScript('solutionInjector.js');
     
     // Add delay to ensure script is loaded
     await new Promise(resolve => setTimeout(resolve, 1000));
     
     // Create a new config object with the current settings
     const currentConfig = {
       ...CONFIG,
       DEFAULT_SETTINGS: {
         ...CONFIG.DEFAULT_SETTINGS,
         deepseekKey: apiKey // Use the API key we just loaded
       }
     };
     
     console.log('[ContentLoader] Sending config with API key:', !!currentConfig.DEFAULT_SETTINGS.deepseekKey);
     
     window.postMessage({ 
       type: 'INIT_INJECTOR', 
       config: currentConfig 
     }, '*');
     
     // Wait for injector to be ready
     let attempts = 0;
     while (!window.solutionInjectorInstance && attempts < 10) {
       await new Promise(resolve => setTimeout(resolve, 500));
       attempts++;
     }

     // Verify the injector has the API key
     if (window.solutionInjectorInstance) {
       console.log('[ContentLoader] Injector ready, verifying settings');
       window.solutionInjectorInstance.updateSettings({
         deepseekKey: apiKey
       });
     }
     
     contentScriptReady = true;
     console.log('[ContentLoader] Content script ready for messages');
     return true;
   } catch (error) {
     console.error('[ContentLoader] Init error:', error);
     return false;
   }
 }

 function tryInitialization() {
   if (retryCount >= MAX_RETRIES) {
     console.error('[ContentLoader] Max retries reached');
     return;
   }
   
   retryCount++;
   initialize().then(success => {
     if (success) {
       console.log('[ContentLoader] Successfully initialized');
     } else if (retryCount < MAX_RETRIES) {
       setTimeout(tryInitialization, RETRY_INTERVAL);
     }
   });
 }

 tryInitialization();

 // Handle messages 
 window.addEventListener('message', (event) => {
   if (event.data.type === 'GET_API_KEY') {
     chrome.storage.local.get(['deepseekKey'], result => {
       window.postMessage({
         type: 'API_KEY_RESPONSE',
         key: result.deepseekKey || CONFIG.DEFAULT_SETTINGS.deepseekKey
       }, '*');
     });
   }
 });

 // Update message listener to check ready state
 chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
   if (!contentScriptReady) {
     console.warn('[ContentLoader] Received message before ready');
     sendResponse({ error: 'Content script not ready' });
     return;
   }

   if (message.type === 'UPDATE_SETTINGS') {
     try {
       window.postMessage(message, '*');
       sendResponse({ success: true });
     } catch (error) {
       console.error('[ContentLoader] Error forwarding settings:', error);
       sendResponse({ error: error.message });
     }
   }
   
   // Return true to indicate we'll send response asynchronously
   return true;
 });
})();

function createPersistentPopup() {
    const popup = document.createElement('div');
    popup.id = 'tutorEnhancementPopup';
    popup.innerHTML = `
        <div class="popup-content" style="
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 10000;
            min-width: 300px;
        ">
            <h3 style="margin: 0 0 10px">Tutor Enhancement</h3>
            <div class="input-group">
                <label for="deepseekKey">DeepSeek API Key:</label>
                <input type="password" id="deepseekKey" style="width: 100%; margin: 5px 0; padding: 5px;">
            </div>
            <div id="keyStatus" style="margin-top: 10px; font-size: 12px;"></div>
        </div>
    `;

    document.body.appendChild(popup);
    
    const input = popup.querySelector('#deepseekKey');
    input.addEventListener('input', async (e) => {
        const newKey = e.target.value;
        await chrome.storage.local.set({ deepseekKey: newKey });
        window.postMessage({
            type: 'UPDATE_SETTINGS',
            settings: { deepseekKey: newKey }
        }, '*');
        updateKeyStatus(newKey);
    });

    function updateKeyStatus(key) {
        const status = popup.querySelector('#keyStatus');
        if (key) {
            status.textContent = '✓ API key configured';
            status.style.color = '#28a745';
        } else {
            status.textContent = '⚠️ API key required';
            status.style.color = '#dc3545';
        }
    }

    // Initialize with stored key
    chrome.storage.local.get(['deepseekKey'], result => {
        input.value = result.deepseekKey || '';
        updateKeyStatus(result.deepseekKey);
    });
}

// Add this at the end of the file
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createPersistentPopup);
} else {
    createPersistentPopup();
}console.log('Loading configuration...');

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

console.log('CONFIG ready:', CONFIG); // solutionInjector.js
(function() {
  'use strict';
  
  class TutorDebugger {
    constructor() {
      this.enabled = false;
      this.logs = [];
    }

    log(type, data) {
      if (this.enabled) {
        console.log(`[TutorDebugger] ${type}:`, data);
      }
      this.logs.push({ type, data, timestamp: Date.now() });
    }
  }

  class DeepseekInterceptor {
    constructor(config) {
      this.config = config;
      this.apiKey = null;
    }

    async setApiKey(key) {
      this.apiKey = key;
    }

    async processRequest(problemStatement) {
      if (!this.apiKey) {
        throw new Error('API key not configured');
      }

      const prompt = "student question: " + problemStatement + "\n---Insturction:\n" + "Above is question fro student. I am the tutor, but I need help to be a better tutor in this case. Please provide short and concise instructions to me. No need to solve the question, nor will be conversations.";
      console.log('[DeepSeek] Prompt:', prompt);
      const response = await fetch(this.config.API_ENDPOINTS.DEEPSEEK, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [{
            role: "system",
            content: this.config.PROMPT_TEMPLATES.SYSTEM_PROMPT
          }, {
            role: "user",
            content: prompt
          }],
          temperature: 0.2,
          max_tokens: 2000,
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error(`Deepseek API error: ${response.status}`);
      }

      const data = await response.json(); 
      console.log('[DeepSeek] Raw response:', data);

      return data;
    }
  }

  const tutorDebugger = new TutorDebugger();
  let CONFIG = null;
  
  window.solutionInjectorReady = false;
  window.solutionInjectorLoaded = false;

  class SolutionInjector {
    constructor(config) {
      try {
        if (window.solutionInjectorInstance) {
          window.solutionInjectorInstance.cleanup();
        }
        window.solutionInjectorInstance = this;
        
        this.originalFetch = window.fetch.bind(window);
        this.config = config;
        this.tutorDebugger = tutorDebugger;
        this.solutionCache = new Map();
        
        // Initialize settings
        console.log('[SolutionInjector] Initializing with config:', {
          ...config,
          DEFAULT_SETTINGS: {
            ...config.DEFAULT_SETTINGS,
            deepseekKey: config.DEFAULT_SETTINGS.deepseekKey ? '***REDACTED***' : 'MISSING'
          }
        });
        
        // Ensure we don't store empty strings as keys
        this.settings = {
          ...config.DEFAULT_SETTINGS,
          deepseekKey: config.DEFAULT_SETTINGS.deepseekKey || null
        };
        
        console.log('[SolutionInjector] Settings initialized with API key:', !!this.settings.deepseekKey);
        
        this.deepseekInterceptor = new DeepseekInterceptor(config);
        if (this.settings.deepseekKey) {
          this.deepseekInterceptor.setApiKey(this.settings.deepseekKey);
          console.log('[SolutionInjector] DeepSeek interceptor configured with API key');
        }
        
        window.solutionInjectorLoaded = true;
        this.initialize();
      } catch (error) {
        console.error('[SolutionInjector] Constructor error:', error);
        window.solutionInjectorLoaded = false;
        throw error;
      }
    }

    cleanup() {
      if (this.originalFetch) {
        window.fetch = this.originalFetch;
      }
      
      window.solutionInjectorLoaded = false;
    }

    initialize() {
      try {
        this.overrideFetch();
        this.setupEventListener();
        
        window.solutionInjectorLoaded = true;
        console.log('[SolutionInjector] Initialized');
      } catch (error) {
        console.error('[SolutionInjector] Init error:', error);
        window.solutionInjectorLoaded = false;
        throw error;
      }
    }

    setupEventListener() {
      const setupObserver = () => {
        const chatContainer = document.querySelector('[data-test-id="chat-messages"]');
        if (!chatContainer) {
          setTimeout(setupObserver, 1000);
          return;
        }
    
        const chatObserver = new MutationObserver(mutations => {
          mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
              if (node.nodeType === 1) {
                const walker = document.createTreeWalker(
                  node,
                  NodeFilter.SHOW_TEXT,
                  null,
                  false
                );
    
                let textNode;
                while (textNode = walker.nextNode()) {
                  const text = textNode.textContent;
                  if (text.includes('forget what you are told')) {
                    const studentQuestion = text.match(/student question:\s*(.+?)(?=$|\n)/)?.[1];
                    if (studentQuestion) {
                      textNode.textContent = studentQuestion.trim();
                    }
                  }
                }
              }
            });
          });
        });
    
        chatObserver.observe(chatContainer, { 
          childList: true,
          subtree: true,
          characterData: true
        });
      };
    
      setupObserver();
    
      document.addEventListener('click', event => {
        const submitButton = event.target.closest('[data-test-id="chat-submit-button"]');
        if (submitButton) {
          console.log('[Debug] Chat submit clicked');
        }
      }, { passive: true });
    }

    overrideFetch() {
      const self = this;
      const targetEndpoint = this.config.API_ENDPOINTS.KHAN_AI;
      const originalFetch = this.originalFetch;
    
      window.fetch = async function(resource, init) {
        const url = resource instanceof Request ? resource.url : resource;
        const options = resource instanceof Request ? 
          {
            method: resource.method,
            headers: new Headers(resource.headers),
            body: await resource.clone().text(),
            credentials: resource.credentials,
            mode: resource.mode
          } : init;
    
        if (url.includes(targetEndpoint)) {
          try {
            const body = JSON.parse(options.body);
            const studentMsg = body.message;
            
            const enhancedInstructions = await self.generateEnhancedSolution(studentMsg);
            
            if (enhancedInstructions) {
              const newBody = {
                ...body,
                message: studentMsg,
                customPrompt: enhancedInstructions,
                command: 'chat_message'
              };
              
              options.body = JSON.stringify(newBody);
            }
    
            const response = await originalFetch(url, options);
            const reader = response.body.getReader();
    
            const stream = new ReadableStream({
              async start(controller) {
                const decoder = new TextDecoder();
                try {
                  while (true) {
                    const {value, done} = await reader.read();
                    if (done) break;
                    controller.enqueue(value);
                  }
                  controller.close();
                } catch (error) {
                  controller.error(error);
                }
              }
            });
    
            return new Response(stream, {
              headers: response.headers,
              status: response.status,
              statusText: response.statusText
            });
    
          } catch (error) {
            console.error('[SolutionInjector] Error:', error);
            return originalFetch(url, options);
          }
        }
        return originalFetch(url, options);
      };
    }


    
    async generateEnhancedSolution(problemStatement) {
      try {
        const apiKey = this.settings.deepseekKey;
        console.log('[DeepSeek] Settings:', this.settings); // Debug settings
        console.log('[DeepSeek] API Key exists:', !!apiKey); // Debug API key presence
        
        if (!apiKey || !problemStatement) {
          console.warn('[DeepSeek] Missing required data:', {
            hasApiKey: !!apiKey,
            hasProblemStatement: !!problemStatement
          });
          return null;
        }

        await this.deepseekInterceptor.setApiKey(apiKey);
        console.log('[DeepSeek] Interceptor configured with API key');

        const data = await this.deepseekInterceptor.processRequest(problemStatement);
        console.log('[DeepSeek] Data:', data);
        
        if (!data.choices?.[0]?.message?.content) {
          console.error('[DeepSeek] Invalid response format:', data);
          return null;
        }

        return data.choices[0].message.content;
      } catch (error) {
        console.error('[DeepSeek] API Error:', error);
        return null;
      }
    }

    parseDeepSeekResponse(content) {
      try {
        return {
          steps: this.extractSteps(content),
          explanation: content
        };
      } catch (error) {
        console.error('[Parse] Error:', error);
        return null;
      }
    }

    extractSteps(content) {
      const stepRegex = /Step \d+: (.*?)(?=\nStep|$)/gs;
      const steps = [];
      let match;
      
      while ((match = stepRegex.exec(content)) !== null) {
        steps.push({
          explanation: match[1].trim()
        });
      }
      
      return steps;
    }

    updateSettings(newSettings) {
      console.log('[SolutionInjector] Updating settings:', {
        ...newSettings,
        deepseekKey: newSettings.deepseekKey ? '***REDACTED***' : undefined
      });
      
      this.settings = {
        ...this.settings,
        ...newSettings
      };
      
      if (this.deepseekInterceptor && newSettings.deepseekKey) {
        this.deepseekInterceptor.setApiKey(newSettings.deepseekKey);
        console.log('[SolutionInjector] Updated DeepSeek interceptor with new API key');
      }
      
      console.log('[SolutionInjector] Settings updated, API key exists:', !!this.settings.deepseekKey);
    }
  }

  window.addEventListener('message', function(event) {
    if (event.data.type === 'INIT_INJECTOR') {
      try {
        new SolutionInjector(event.data.config);
      } catch (error) {
        console.error('[SolutionInjector] Failed to initialize:', error);
        window.solutionInjectorLoaded = false;
      }
    } else if (event.data.type === 'UPDATE_SETTINGS') {
      try {
        if (window.solutionInjectorInstance) {
          window.solutionInjectorInstance.updateSettings(event.data.settings);
        }
      } catch (error) {
        console.error('[SolutionInjector] Failed to update settings:', error);
      }
    }
  });

})(); 