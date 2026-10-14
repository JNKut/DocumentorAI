import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface Usage {
  conversationsThisMonth: number;
  monthlyConversationLimit: number | null;
  openaiCostToday: number;
  dailyOpenaiBudget: number;
}

interface ConversationSummary {
  id: number;
  createdAt: string;
  lastMessageAt: string;
  messageCount: number;
  preview: string;
}

interface TranscriptMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

async function adminFetch<T>(token: string, url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { ...init?.headers, Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export function UsageCard({ token }: { token: string }) {
  const [usage, setUsage] = useState<Usage | null>(null);

  useEffect(() => {
    adminFetch<Usage>(token, '/api/admin/usage').then(setUsage).catch(() => {});
  }, [token]);

  if (!usage) return null;

  const pct = usage.monthlyConversationLimit
    ? Math.min(100, Math.round((usage.conversationsThisMonth / usage.monthlyConversationLimit) * 100))
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage this month</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-gray-700">
          <strong>{usage.conversationsThisMonth}</strong>
          {usage.monthlyConversationLimit
            ? <> of {usage.monthlyConversationLimit} conversations included in your plan</>
            : <> conversations</>}
        </p>
        {pct !== null && (
          <div className="h-2 w-full rounded bg-gray-100 overflow-hidden" aria-hidden="true">
            <div
              className={`h-full ${pct >= 100 ? 'bg-amber-500' : 'bg-green-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
        <p className="text-xs text-gray-500">
          A conversation is counted when a visitor sends their first message.
        </p>
      </CardContent>
    </Card>
  );
}

export function ConversationsCard({ token }: { token: string }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: ConversationSummary[]; total: number; pageSize: number } | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const { toast } = useToast();

  const load = useCallback((p: number) => {
    adminFetch<{ items: ConversationSummary[]; total: number; pageSize: number }>(token, `/api/admin/conversations?page=${p}`)
      .then(setData)
      .catch(err => toast({ title: 'Failed to load conversations', description: err.message, variant: 'destructive' }));
  }, [token]);

  useEffect(() => { load(page); }, [page, load]);

  async function toggle(id: number) {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    setTranscript([]);
    try {
      setTranscript(await adminFetch<TranscriptMessage[]>(token, `/api/admin/conversations/${id}/messages`));
    } catch (err) {
      toast({ title: 'Failed to load transcript', description: (err as Error).message, variant: 'destructive' });
    }
  }

  async function remove(id: number) {
    if (!window.confirm('Delete this conversation permanently? This cannot be undone.')) return;
    try {
      await adminFetch(token, `/api/admin/conversations/${id}`, { method: 'DELETE' });
      if (openId === id) setOpenId(null);
      toast({ title: 'Conversation deleted' });
      load(page);
    } catch (err) {
      toast({ title: 'Failed to delete', description: (err as Error).message, variant: 'destructive' });
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-gray-600">
          What visitors have asked your assistant, most recent first. Use these to spot gaps in your knowledge base.
        </p>
        {data && data.items.length === 0 && (
          <p className="text-sm text-gray-500">No conversations yet.</p>
        )}
        <ul className="divide-y divide-gray-100 border border-gray-200 rounded-md">
          {data?.items.map(c => (
            <li key={c.id}>
              <div className="flex items-center gap-3 px-3 py-2">
                <button
                  type="button"
                  onClick={() => toggle(c.id)}
                  aria-expanded={openId === c.id}
                  className="flex-1 min-w-0 text-left"
                >
                  <p className="text-sm text-gray-900 truncate">{c.preview || '(no visitor message)'}</p>
                  <p className="text-xs text-gray-500">
                    {formatDate(c.lastMessageAt)} · {c.messageCount} message{c.messageCount === 1 ? '' : 's'}
                  </p>
                </button>
                <Button variant="ghost" size="sm" onClick={() => remove(c.id)} className="text-red-600 hover:text-red-700">
                  Delete
                </Button>
              </div>
              {openId === c.id && (
                <div className="px-3 pb-3 space-y-2">
                  {transcript.map(m => (
                    <div
                      key={m.id}
                      className={`rounded-md px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                        m.role === 'user' ? 'bg-blue-50 text-gray-900' : 'bg-gray-50 text-gray-700'
                      }`}
                    >
                      <span className="block text-xs font-medium text-gray-500 mb-0.5">
                        {m.role === 'user' ? 'Visitor' : 'Assistant'} · {formatDate(m.createdAt)}
                      </span>
                      {m.content}
                    </div>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              Newer
            </Button>
            <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              Older
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
