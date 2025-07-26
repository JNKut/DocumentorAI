# AI Chat Widget Integration Guide

## Method 1: Direct Iframe Embedding (Recommended)

Add this iframe to any website where you want the chat widget to appear:

```html
<iframe 
  src="https://your-replit-app.replit.app/widget" 
  width="400" 
  height="600"
  style="border: none; position: fixed; bottom: 0; right: 0; z-index: 9999; background: transparent;"
  title="AI Chat Widget">
</iframe>
```

**Note:** The widget has a transparent background and will only show the circular chat button floating on your website. The widget components are fully clickable and interactive.

## Method 2: JavaScript Widget Script (Easy)

Add this single line to your website's HTML:

```html
<script src="https://your-replit-app.replit.app/widget.js"></script>
```

### With Custom Options:

```html
<script src="https://your-replit-app.replit.app/widget.js" 
        data-position="bottom-right" 
        data-width="400px" 
        data-height="600px">
</script>
```

## Method 3: Dynamic JavaScript Integration

Add this script for more control:

```html
<script>
(function() {
  // Create iframe dynamically
  var iframe = document.createElement('iframe');
  iframe.src = 'https://your-replit-app.replit.app/widget';
  iframe.style.cssText = 'border:none;position:fixed;bottom:0;right:0;width:400px;height:600px;z-index:9999;background:transparent;pointer-events:none;';
  iframe.title = 'AI Chat Widget';
  
  // Add to page when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      document.body.appendChild(iframe);
    });
  } else {
    document.body.appendChild(iframe);
  }
})();
</script>
```

## Method 3: Advanced Integration with API

For more control, you can communicate with the widget:

```html
<script>
// Global widget API
window.AIWidget = {
  show: function() {
    var widget = document.getElementById('ai-chat-widget');
    if (widget) widget.style.display = 'block';
  },
  hide: function() {
    var widget = document.getElementById('ai-chat-widget');
    if (widget) widget.style.display = 'none';
  }
};

// Create widget
var iframe = document.createElement('iframe');
iframe.id = 'ai-chat-widget';
iframe.src = 'https://your-replit-app.replit.app/embed';
iframe.style.cssText = 'border:none;position:fixed;bottom:20px;right:20px;width:400px;height:600px;z-index:9999;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.1);';
document.body.appendChild(iframe);
</script>
```

## Customization Options

### Size
- Small: `width="320px" height="480px"`
- Medium: `width="400px" height="600px"` (default)
- Large: `width="480px" height="720px"`

### Position
- Bottom right: `bottom:20px;right:20px;`
- Bottom left: `bottom:20px;left:20px;`
- Top right: `top:20px;right:20px;`

### Mobile Responsive
```css
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
```

## Notes
- Replace `your-replit-app.replit.app` with your actual Replit deployment URL
- The widget is responsive and works on mobile devices
- No external dependencies required
- HTTPS required for deployment