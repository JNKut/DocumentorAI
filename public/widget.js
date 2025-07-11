(function() {
  // AI Chat Widget Embed Script
  
  function createWidget(options = {}) {
    const defaults = {
      apiUrl: window.location.origin,
      position: 'bottom-right',
      width: '400px',
      height: '600px',
      zIndex: 9999
    };
    
    const config = Object.assign(defaults, options);
    
    // Create iframe
    const iframe = document.createElement('iframe');
    iframe.src = config.apiUrl + '/widget';
    iframe.style.cssText = `
      border: none;
      position: fixed;
      ${config.position.includes('bottom') ? 'bottom: 20px;' : 'top: 20px;'}
      ${config.position.includes('right') ? 'right: 20px;' : 'left: 20px;'}
      width: ${config.width};
      height: ${config.height};
      z-index: ${config.zIndex};
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      transition: opacity 0.3s ease;
    `;
    iframe.title = 'AI Chat Widget';
    iframe.id = 'ai-chat-widget';
    
    // Add responsive styles for mobile
    const style = document.createElement('style');
    style.textContent = `
      @media (max-width: 768px) {
        #ai-chat-widget {
          width: 100vw !important;
          height: 100vh !important;
          top: 0 !important;
          left: 0 !important;
          right: auto !important;
          bottom: auto !important;
          border-radius: 0 !important;
        }
      }
    `;
    document.head.appendChild(style);
    
    // Add to page
    document.body.appendChild(iframe);
    
    return {
      show: function() {
        iframe.style.display = 'block';
      },
      hide: function() {
        iframe.style.display = 'none';
      },
      remove: function() {
        iframe.remove();
        style.remove();
      }
    };
  }
  
  // Auto-initialize if data attributes are present
  function autoInit() {
    const scripts = document.querySelectorAll('script[src*="widget.js"]');
    const script = scripts[scripts.length - 1];
    
    if (script && script.dataset.autoInit !== 'false') {
      createWidget({
        position: script.dataset.position || 'bottom-right',
        width: script.dataset.width || '400px',
        height: script.dataset.height || '600px'
      });
    }
  }
  
  // Expose global API
  window.AIWidget = {
    create: createWidget,
    init: createWidget // Alias
  };
  
  // Auto-initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }
})();