import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { UsageCard, ConversationsCard } from '@/components/AdminActivity';
import BusinessProfileCard, { withProfileDefaults, type BusinessProfile } from '@/components/BusinessProfileCard';

const STORAGE_KEY = 'admin_token';

interface KnowledgeBaseInfo {
  originalName: string;
  size: number;
  chunks: number;
  createdAt: string;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const int = parseInt(clean, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

export default function AdminPage() {
  const [token, setToken] = useState<string>(() => localStorage.getItem(STORAGE_KEY) || '');
  const [passwordInput, setPasswordInput] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [companyName, setCompanyName] = useState('');
  const [companyDescription, setCompanyDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [widgetGreeting, setWidgetGreeting] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#2194f3');
  const [hexInput, setHexInput] = useState('#2194f3');
  const [kbFile, setKbFile] = useState<File | null>(null);
  const [kbInfo, setKbInfo] = useState<KnowledgeBaseInfo | null>(null);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    if (token) {
      fetchSettings(token);
    }
  }, []);

  async function fetchKnowledgeBase(t: string) {
    try {
      const res = await fetch('/api/admin/knowledge-base', {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.ok) setKbInfo(await res.json());
    } catch {}
  }

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
      const color = data.primaryColor || '#2194f3';
      setPrimaryColor(color);
      setHexInput(color);
      setProfile(withProfileDefaults(data.profile));
      setIsAuthenticated(true);
      fetchKnowledgeBase(t);
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
      const color = data.primaryColor || '#2194f3';
      setPrimaryColor(color);
      setHexInput(color);
      setProfile(withProfileDefaults(data.profile));
      setIsAuthenticated(true);
      fetchKnowledgeBase(passwordInput);
    } else if (res.status === 429) {
      toast({ title: 'Too many failed attempts. Try again in 15 minutes.', variant: 'destructive' });
    } else {
      toast({ title: 'Incorrect password', variant: 'destructive' });
    }
  }

  async function handleSaveSettings(e?: React.FormEvent | React.MouseEvent) {
    e?.preventDefault();
    setIsLoading(true);
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ companyName, companyDescription, systemPrompt, widgetGreeting, primaryColor }),
    });
    setIsLoading(false);
    if (res.ok) {
      toast({ title: 'Settings saved' });
    } else {
      const err = await res.json().catch(() => ({}));
      toast({ title: 'Failed to save settings', description: err.error, variant: 'destructive' });
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
      setKbInfo({ originalName: data.originalName, size: data.size, chunks: data.chunks, createdAt: data.createdAt });
      setKbFile(null);
      toast({ title: 'Knowledge base updated' });
    } else {
      const err = await res.json().catch(() => ({}));
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
          <div className="flex items-center gap-2">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm px-3 py-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-50"
          >
            Test your assistant ↗
          </a>
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
        </div>

        <UsageCard token={token} />

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
                <p className="text-xs text-gray-500 mt-1">A sentence or two about what you do. The assistant always knows this.</p>
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
                <Label htmlFor="systemPrompt">Additional instructions (optional)</Label>
                <Textarea
                  id="systemPrompt"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="e.g. Mention our free shipping on orders over $50 when relevant."
                  rows={4}
                />
                <p className="text-xs text-gray-500 mt-1">Added on top of the built-in rules (short answers, stay on topic, no guessing). You don't need to repeat those.</p>
              </div>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : 'Save Settings'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {profile && <BusinessProfileCard token={token} initial={profile} />}

        {/* Brand Color */}
        <Card>
          <CardHeader>
            <CardTitle>Brand Color</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Sets the primary color for the chat widget — the button, header, and message bubbles.
            </p>
            <div className="flex items-center gap-4">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => {
                  setPrimaryColor(e.target.value);
                  setHexInput(e.target.value);
                }}
                className="h-10 w-14 cursor-pointer rounded border border-gray-300 p-0.5"
                title="Color picker"
              />
              <div className="flex items-center gap-1">
                {(['r', 'g', 'b'] as const).map((ch, i) => {
                  const rgb = hexToRgb(primaryColor);
                  return (
                    <div key={ch} className="flex flex-col items-center gap-1">
                      <span className="text-xs font-medium text-gray-500 uppercase">{ch}</span>
                      <input
                        type="number"
                        min={0}
                        max={255}
                        value={rgb[ch]}
                        onChange={(e) => {
                          const current = hexToRgb(primaryColor);
                          const val = Math.min(255, Math.max(0, parseInt(e.target.value) || 0));
                          const next = { ...current, [ch]: val };
                          const hex = rgbToHex(next.r, next.g, next.b);
                          setPrimaryColor(hex);
                          setHexInput(hex);
                        }}
                        className="w-16 rounded border border-gray-300 px-2 py-1.5 text-sm text-center"
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-gray-500">HEX</span>
                <input
                  type="text"
                  value={hexInput}
                  onChange={(e) => {
                    setHexInput(e.target.value);
                    const v = e.target.value.trim();
                    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
                      setPrimaryColor(v);
                    }
                  }}
                  onBlur={() => setHexInput(primaryColor)}
                  className="w-24 rounded border border-gray-300 px-2 py-1.5 text-sm font-mono"
                  placeholder="#2194f3"
                />
              </div>
            </div>
            <div
              className="h-10 w-full rounded-md border border-gray-200"
              style={{ backgroundColor: primaryColor }}
              title="Color preview"
            />
            <Button onClick={handleSaveSettings} disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Color'}
            </Button>
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
                Upload a <strong>.txt</strong>, <strong>.pdf</strong>, or <strong>.docx</strong> file (up to 10 MB) containing information about your company — FAQs, product details, policies, etc. The AI will use this as context when answering questions. Uploading a new file replaces the current one.
              </p>
              <p className="text-sm text-gray-600">
                Not sure what to include?{' '}
                <a href="/knowledge-base-template.txt" download className="underline text-blue-700">
                  Download the starter template
                </a>
                , fill in the sections that apply, and upload it. Stick to facts about your business; how the assistant talks is already built in.
              </p>
              {kbInfo ? (
                <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded">
                  Current: <strong>{kbInfo.originalName}</strong> ({formatBytes(kbInfo.size)}, {kbInfo.chunks} section{kbInfo.chunks === 1 ? "" : "s"}), uploaded {new Date(kbInfo.createdAt).toLocaleString()}
                </p>
              ) : (
                <p className="text-sm text-amber-800 bg-amber-50 px-3 py-2 rounded">
                  No knowledge base uploaded yet. The assistant has nothing to answer from until you upload one.
                </p>
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

        <ConversationsCard token={token} />
      </div>
    </div>
  );
}
