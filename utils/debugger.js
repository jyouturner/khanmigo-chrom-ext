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

const tutorDebugger = new TutorDebugger();
export default tutorDebugger;

function logToPage(message) {
  const createLogElement = () => {
    const el = document.createElement('div');
    el.style.position = 'fixed';
    el.style.bottom = '0';
    el.style.right = '0';
    el.style.background = 'black';
    el.style.color = 'white';
    el.style.padding = '10px';
    el.style.zIndex = '999999';
    el.textContent = `[Extension] ${message}`;
    return el;
  };

  const tryAppend = () => {
    if (document.body) {
      document.body.appendChild(createLogElement());
    } else {
      // Wait for DOM if body doesn't exist yet
      document.addEventListener('DOMContentLoaded', () => {
        document.body.appendChild(createLogElement());
      });
    }
  };

  // Use requestAnimationFrame for safer DOM access
  requestAnimationFrame(tryAppend);
}

export { logToPage }; 