(function() {
  // AI Chat Widget Embed Script
  //
  // The iframe is only as large as what it shows: launcher-sized while closed,
  // chat-window-sized while open (full screen on phones). The widget inside
  // tells us which state it is in via postMessage. A transparent iframe still
  // swallows clicks, so keeping it small leaves the host page usable.

  var CLOSED_SIZE = 96; // 64px launcher + 16px margin on each side
  var MOBILE_QUERY = '(max-width: 768px)';

  function createWidget(options) {
    var defaults = {
      apiUrl: (window.location.origin === 'null' || !window.location.origin) ? 'http://localhost:3000' : window.location.origin,
      position: 'bottom-right',
      width: '400px',
      height: '600px',
      zIndex: 9999
    };

    var config = Object.assign({}, defaults, options || {});
    if (!config.apiUrl) config.apiUrl = defaults.apiUrl;
    var apiOrigin = new URL(config.apiUrl, window.location.href).origin;
    var isOpen = false;

    var iframe = document.createElement('iframe');
    iframe.src = config.apiUrl.replace(/\/$/, '') + '/widget';
    iframe.title = 'Chat assistant';
    iframe.id = 'ai-chat-widget';
    iframe.setAttribute('allowtransparency', 'true');
    iframe.style.cssText = [
      'border: none',
      'position: fixed',
      config.position.indexOf('top') !== -1 ? 'top: 0' : 'bottom: 0',
      config.position.indexOf('left') !== -1 ? 'left: 0' : 'right: 0',
      'z-index: ' + config.zIndex,
      'background: transparent',
      'color-scheme: normal'
    ].join(';');

    function applySize() {
      if (!isOpen) {
        iframe.style.width = CLOSED_SIZE + 'px';
        iframe.style.height = CLOSED_SIZE + 'px';
      } else if (window.matchMedia(MOBILE_QUERY).matches) {
        iframe.style.width = '100vw';
        iframe.style.height = '100vh';
        iframe.style.height = '100dvh'; // ignored by browsers without dvh support
      } else {
        iframe.style.width = 'min(' + config.width + ', 100vw)';
        iframe.style.height = 'min(' + config.height + ', 100vh)';
      }
    }

    function onMessage(event) {
      if (event.source !== iframe.contentWindow || event.origin !== apiOrigin) return;
      var data = event.data;
      if (!data || data.source !== 'documentorai') return;
      if (data.type === 'open' || data.type === 'close') {
        isOpen = data.type === 'open';
        applySize();
      }
    }

    applySize();
    window.addEventListener('message', onMessage);
    window.addEventListener('resize', applySize);
    document.body.appendChild(iframe);

    return {
      show: function() {
        iframe.style.display = 'block';
      },
      hide: function() {
        iframe.style.display = 'none';
      },
      remove: function() {
        window.removeEventListener('message', onMessage);
        window.removeEventListener('resize', applySize);
        iframe.remove();
      }
    };
  }

  // Auto-initialize if data attributes are present
  function autoInit() {
    if (document.getElementById('ai-chat-widget')) return; // script included twice

    var scripts = document.querySelectorAll('script[src*="widget.js"]');
    var script = scripts[scripts.length - 1];

    if (script && script.dataset.autoInit !== 'false') {
      var scriptOrigin = script.src ? new URL(script.src).origin : null;
      createWidget({
        apiUrl: script.dataset.apiUrl || scriptOrigin || undefined,
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
