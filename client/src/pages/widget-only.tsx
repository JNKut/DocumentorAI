import CleanAIWidget from "@/components/CleanAIWidget";

export default function WidgetOnlyPage() {
  return (
    <>
      <style>{`
        body { 
          background: white !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
        }
        html {
          background: white !important;
        }
        #root {
          background: white !important;
        }
      `}</style>
      
      {/* Pure white background container for widget */}
      <div 
        className="widget-only-container w-full h-screen overflow-hidden"
        style={{ backgroundColor: 'white', color: '#333' }}
      >
        <CleanAIWidget />
      </div>
    </>
  );
}