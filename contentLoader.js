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