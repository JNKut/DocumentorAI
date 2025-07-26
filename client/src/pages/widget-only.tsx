import CleanAIWidget from "@/components/CleanAIWidget";

export default function WidgetOnlyPage() {
  return (
    <>
      <style>{`
        body { 
          background: transparent !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
        }
        html {
          background: transparent !important;
        }
        #root {
          background: transparent !important;
        }
      `}</style>
      
      {/* Transparent container - only shows the widget */}
      <div 
        className="w-full h-screen overflow-hidden pointer-events-none"
        style={{ backgroundColor: 'transparent' }}
      >
        <CleanAIWidget />
      </div>
    </>
  );
}