import React from 'react';
import AIWidget from './AIWidget';

// This component is used for embedding the widget
export default function EmbedWidget() {
  return (
    <div className="min-h-screen">
      <AIWidget />
    </div>
  );
}
