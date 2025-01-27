console.log('Popup script starting...');

document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM content loaded');
  
  // Configuration check
  if (!window.CONFIG) {
    console.error('Configuration not loaded!');
    return;
  }
  
  console.log('Initializing PopupController with config:', CONFIG);
  
  class PopupController {
    constructor() {
      console.log('PopupController instance created');
      this.settings = {};
      this.init();
      
      this.debugConsole = document.getElementById('debugConsole');
      this.setupMessageListener();
    }

    async init() {
      console.log('Initializing popup...');
      const stored = await chrome.storage.local.get(['deepseekKey']);
      console.log('[Popup] Stored key:', stored.deepseekKey ? '***REDACTED***' : 'MISSING');
      
      if (!stored.deepseekKey) {
        //this.settings.deepseekKey = '';
        //ignore the issue right now since the user will set the key on the popup
      }
      
      this.settings = { ...CONFIG.DEFAULT_SETTINGS, ...stored };
      document.getElementById('deepseekKey').value = stored.deepseekKey || CONFIG.DEFAULT_SETTINGS.deepseekKey;
      
      this.initializeUI();
      this.attachEventListeners();
      this.checkKeyStatus();
    }

    async checkKeyStatus() {
      const statusElement = document.getElementById('keyStatus');
      if (this.settings.deepseekKey) {
        statusElement.textContent = '✓ API key configured';
        statusElement.style.color = '#28a745';
      } else {
        statusElement.textContent = '⚠️ API key required';
        statusElement.style.color = '#dc3545';
      }
    }

    async attachEventListeners() {
      document.getElementById('deepseekKey').addEventListener('input', async (e) => {
        const newKey = e.target.value;
        this.settings.deepseekKey = newKey;
        
        // Save to storage
        await chrome.storage.local.set({ deepseekKey: newKey });
        console.log('[Popup] Saved API key to storage');
        
        // Update the status
        this.checkKeyStatus();
        
        // Send to content script with retry logic
        await this.sendSettingsToContentScript({
          deepseekKey: newKey
        });
      });
    }

    // Add new method for sending settings with retry
    async sendSettingsToContentScript(settings, maxRetries = 3) {
      const tabs = await chrome.tabs.query({active: true, currentWindow: true});
      if (!tabs[0]?.id) {
        console.error('[Popup] No active tab found');
        return;
      }

      let attempts = 0;
      const sendMessage = async () => {
        try {
          await chrome.tabs.sendMessage(tabs[0].id, {
            type: 'UPDATE_SETTINGS',
            settings: settings
          });
          console.log('[Popup] Successfully sent settings to content script');
        } catch (error) {
          attempts++;
          console.warn(`[Popup] Failed to send settings (attempt ${attempts}/${maxRetries}):`, error);
          
          if (attempts < maxRetries) {
            console.log('[Popup] Retrying in 1 second...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            return sendMessage();
          } else {
            console.error('[Popup] Failed to send settings after', maxRetries, 'attempts');
          }
        }
      };

      await sendMessage();
    }

    initializeUI() {
      console.log('Initializing UI components');
    }

    setupMessageListener() {
    }

    showError(message) {
      console.error(message);
    }
  }

  new PopupController();
});

console.log('Popup script loaded'); 