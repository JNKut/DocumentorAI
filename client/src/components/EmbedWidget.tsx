import React from 'react';
import CleanAIWidget from './CleanAIWidget';

// This component is used for embedding the widget
export default function EmbedWidget() {
  return (
    <div className="min-h-screen">
      <CleanAIWidget />
    </div>
  );
}
