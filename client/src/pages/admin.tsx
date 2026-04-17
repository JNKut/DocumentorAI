import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

const STORAGE_KEY = 'admin_token';

export default function AdminPage() {
  const [token, setToken] = useState<string>(() => localStorage.getItem(STORAGE_KEY) || '');
  const [passwordInput, setPasswordInput] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [companyName, setCompanyName] = useState('');
  const [companyDescription, setCompanyDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [widgetGreeting, setWidgetGreeting] = useState('');
  const [kbFile, setKbFile] = useState<File | null>(null);
  const [kbStatus, setKbStatus] = useState('');

  const { toast } = useToast();

  useEffect(() => {
    if (token) {
      fetchSettings(token);
    }
  }, []);

  async function fetchSettings(t: string) {
    try {
      const res = await fetch('/api/admin/settings', {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.status === 401) {
        setIsAuthenticated(false);
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      const data = await res.json();
      setCompanyName(data.companyName || '');
      setCompanyDescription(data.companyDescription || '');
      setSystemPrompt(data.systemPrompt || '');
      setWidgetGreeting(data.widgetGreeting || '');
      setIsAuthenticated(true);
    } catch {
      toast({ title: 'Failed to load settings', variant: 'destructive' });
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    const res = await fetch('/api/admin/settings', {
      headers: { Authorization: `Bearer ${passwordInput}` },
    });
    setIsLoading(false);
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem(STORAGE_KEY, passwordInput);
      setToken(passwordInput);
      setCompanyName(data.companyName || '');
      setCompanyDescription(data.companyDescription || '');
      setSystemPrompt(data.systemPrompt || '');
      setWidgetGreeting(data.widgetGreeting || '');
      setIsAuthenticated(true);
    } else {
      toast({ title: 'Incorrect password', variant: 'destructive' });
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ companyName, companyDescription, systemPrompt, widgetGreeting }),
    });
    setIsLoading(false);
    if (res.ok) {
      toast({ title: 'Settings saved' });
    } else {
      toast({ title: 'Failed to save settings', variant: 'destructive' });
    }
  }

  async function handleKbUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!kbFile) return;
    setIsLoading(true);
    const formData = new FormData();
    formData.append('file', kbFile);
    const res = await fetch('/api/admin/knowledge-base', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    setIsLoading(false);
    if (res.ok) {
      const data = await res.json();
      setKbStatus(`Uploaded: ${data.originalName} (${data.chunks} chunks)`);
      setKbFile(null);
      toast({ title: 'Knowledge base updated' });
    } else {
      const err = await res.json();
      toast({ title: err.error || 'Upload failed', variant: 'destructive' });
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Admin Login</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="password">Admin Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter ADMIN_PASSWORD"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Logging in...' : 'Login'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">AI Widget Admin</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              localStorage.removeItem(STORAGE_KEY);
              setIsAuthenticated(false);
              setToken('');
            }}
          >
            Logout
          </Button>
        </div>

        {/* Company Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Company Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <Label htmlFor="companyName">Company Name</Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme Corp"
                />
                <p className="text-xs text-gray-500 mt-1">Shown in the widget header</p>
              </div>
              <div>
                <Label htmlFor="companyDescription">Company Description</Label>
                <Textarea
                  id="companyDescription"
                  value={companyDescription}
                  onChange={(e) => setCompanyDescription(e.target.value)}
                  placeholder="We sell widgets and provide world-class customer support."
                  rows={3}
                />
                <p className="text-xs text-gray-500 mt-1">Injected into the AI system prompt</p>
              </div>
              <div>
                <Label htmlFor="widgetGreeting">Widget Greeting</Label>
                <Input
                  id="widgetGreeting"
                  value={widgetGreeting}
                  onChange={(e) => setWidgetGreeting(e.target.value)}
                  placeholder="Hi! I'm your AI assistant. How can I help you today?"
                />
                <p className="text-xs text-gray-500 mt-1">First message shown when the widget opens</p>
              </div>
              <div>
                <Label htmlFor="systemPrompt">System Prompt Override (optional)</Label>
                <Textarea
                  id="systemPrompt"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Leave blank to use the default prompt built from company name and description."
                  rows={4}
                />
                <p className="text-xs text-gray-500 mt-1">If set, this replaces the auto-generated system prompt entirely</p>
              </div>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : 'Save Settings'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Knowledge Base */}
        <Card>
          <CardHeader>
            <CardTitle>Knowledge Base</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleKbUpload} className="space-y-4">
              <p className="text-sm text-gray-600">
                Upload a <strong>.txt</strong>, <strong>.pdf</strong>, or <strong>.docx</strong> file containing information about your company — FAQs, product details, policies, etc. The AI will use this as context when answering questions.
              </p>
              {kbStatus && (
                <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded">{kbStatus}</p>
              )}
              <div>
                <Label htmlFor="kbFile">Upload File</Label>
                <Input
                  id="kbFile"
                  type="file"
                  accept=".txt,.pdf,.docx"
                  onChange={(e) => setKbFile(e.target.files?.[0] || null)}
                />
              </div>
              <Button type="submit" disabled={isLoading || !kbFile}>
                {isLoading ? 'Uploading...' : 'Upload Knowledge Base'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
