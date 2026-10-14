import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import CleanAIWidget from "@/components/CleanAIWidget";

// Landing page of each deployment: a live preview of the widget plus the
// one-line embed snippet to hand to the client.
export default function WidgetPage() {
  const snippet = `<script src="${window.location.origin}/widget.js"></script>`;

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Chat widget preview</h1>
          <p className="text-gray-600">The assistant is in the bottom-right corner. Try asking it a question.</p>
        </header>

        <Card className="text-left">
          <CardHeader>
            <CardTitle className="text-lg">Add it to your website</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">
              Paste this line just before the closing <code>&lt;/body&gt;</code> tag on every page where the chat should appear.
            </p>
            <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm text-gray-700 break-all">
              {snippet}
            </div>
          </CardContent>
        </Card>
      </div>

      <CleanAIWidget />
    </div>
  );
}
