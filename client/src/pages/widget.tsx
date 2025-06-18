import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import CleanAIWidget from "@/components/CleanAIWidget";
import { Bot, Upload, MessageSquare, Zap } from "lucide-react";

export default function WidgetPage() {
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">AI Assistant Widget Demo</h1>
          <p className="text-lg text-gray-600 mb-8">An embeddable AI chat widget that can be trained with your documents</p>
          
          <Card className="text-left">
            <CardHeader>
              <CardTitle className="text-xl">Integration Code</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm text-gray-700">
                {`<script src="${window.location.origin}/embed.js"></script>
<script>
  AIWidget.init({
    apiKey: 'your-openai-api-key',
    position: 'bottom-right',
    theme: 'light'
  });
</script>`}
              </div>
            </CardContent>
          </Card>
        </header>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Upload className="w-5 h-5 text-primary mr-2" />
                Document Training
              </h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  PDF, DOCX, TXT support
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  Automatic text extraction
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  Smart document chunking
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  Vector embeddings
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Bot className="w-5 h-5 text-primary mr-2" />
                AI Features
              </h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  Context-aware responses
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  Document-based Q&A
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  Conversation memory
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  Multi-language support
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="text-center text-gray-500 mb-8">
          <p className="flex items-center justify-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Check out the AI assistant widget in the bottom-right corner!
          </p>
        </div>

        <Card className="mb-8">
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Zap className="w-5 h-5 text-primary mr-2" />
              Getting Started
            </h3>
            <ol className="space-y-3 text-gray-600">
              <li className="flex items-start">
                <span className="bg-primary text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold mr-3 mt-0.5">1</span>
                Click the chat widget in the bottom-right corner
              </li>
              <li className="flex items-start">
                <span className="bg-primary text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold mr-3 mt-0.5">2</span>
                Upload a document (PDF, DOCX, or TXT file)
              </li>
              <li className="flex items-start">
                <span className="bg-primary text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold mr-3 mt-0.5">3</span>
                Wait for the document to be processed
              </li>
              <li className="flex items-start">
                <span className="bg-primary text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold mr-3 mt-0.5">4</span>
                Ask questions about your document content
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>

      <CleanAIWidget />
    </div>
  );
}
