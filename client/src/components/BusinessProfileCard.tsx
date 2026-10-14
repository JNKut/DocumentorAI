import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

const MAX_FAQS = 12;

type Tone = 'professional' | 'friendly' | 'casual';

export interface BusinessProfile {
  tone: Tone;
  suggestNextStep: boolean;
  callToAction: string;
  contactEmail: string;
  contactPhone: string;
  website: string;
  hours: string;
  location: string;
  faqs: { q: string; a: string }[];
  avoidTopics: string;
}

const EMPTY_PROFILE: BusinessProfile = {
  tone: 'professional',
  suggestNextStep: true,
  callToAction: '',
  contactEmail: '',
  contactPhone: '',
  website: '',
  hours: '',
  location: '',
  faqs: [],
  avoidTopics: '',
};

const TONES: { value: Tone; label: string; hint: string }[] = [
  { value: 'professional', label: 'Professional', hint: 'Polite, clear and direct' },
  { value: 'friendly', label: 'Friendly', hint: 'Warm and upbeat' },
  { value: 'casual', label: 'Casual', hint: 'Relaxed and conversational' },
];

export function withProfileDefaults(profile: Partial<BusinessProfile> | null | undefined): BusinessProfile {
  return { ...EMPTY_PROFILE, ...(profile ?? {}), faqs: profile?.faqs ?? [] };
}

export default function BusinessProfileCard({ token, initial }: { token: string; initial: BusinessProfile }) {
  const [profile, setProfile] = useState<BusinessProfile>(initial);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const set = <K extends keyof BusinessProfile>(key: K, value: BusinessProfile[K]) =>
    setProfile(p => ({ ...p, [key]: value }));

  function setFaq(index: number, field: 'q' | 'a', value: string) {
    setProfile(p => ({ ...p, faqs: p.faqs.map((f, i) => (i === index ? { ...f, [field]: value } : f)) }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    // Half-filled FAQ rows are dropped rather than rejected
    const faqs = profile.faqs.filter(f => f.q.trim() && f.a.trim());
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ profile: { ...profile, faqs } }),
    });
    setIsSaving(false);
    if (res.ok) {
      setProfile(p => ({ ...p, faqs }));
      toast({ title: 'Business profile saved' });
    } else {
      const err = await res.json().catch(() => ({}));
      toast({ title: 'Failed to save profile', description: err.error, variant: 'destructive' });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Business profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-5">
          <p className="text-sm text-gray-600">
            The assistant always knows these details, and already follows built-in rules for answering briefly,
            staying on topic and pointing visitors to you when it doesn't know something. Fill in what applies and
            leave the rest blank.
          </p>

          <fieldset>
            <legend className="text-sm font-medium mb-2">Tone</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {TONES.map(t => (
                <label
                  key={t.value}
                  className={`cursor-pointer rounded-md border px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-blue-500 ${
                    profile.tone === t.value ? 'border-gray-900 bg-gray-50' : 'border-gray-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="tone"
                    value={t.value}
                    checked={profile.tone === t.value}
                    onChange={() => set('tone', t.value)}
                    className="sr-only"
                  />
                  <span className="font-medium block">{t.label}</span>
                  <span className="text-xs text-gray-500">{t.hint}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="suggestNextStep">Suggest a next step when it fits</Label>
              <Switch
                id="suggestNextStep"
                checked={profile.suggestNextStep}
                onCheckedChange={v => set('suggestNextStep', v)}
              />
            </div>
            <Input
              id="callToAction"
              aria-label="Next step to suggest"
              value={profile.callToAction}
              maxLength={200}
              disabled={!profile.suggestNextStep}
              onChange={e => set('callToAction', e.target.value)}
              placeholder="e.g. Book a free consultation at acme.com/book"
            />
            <p className="text-xs text-gray-500">
              After relevant answers, the assistant adds one short sentence pointing here. Never on every message.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="contactEmail">Contact email</Label>
              <Input id="contactEmail" type="email" maxLength={200} value={profile.contactEmail}
                onChange={e => set('contactEmail', e.target.value)} placeholder="help@acme.com" />
            </div>
            <div>
              <Label htmlFor="contactPhone">Phone</Label>
              <Input id="contactPhone" maxLength={50} value={profile.contactPhone}
                onChange={e => set('contactPhone', e.target.value)} placeholder="(555) 123-4567" />
            </div>
            <div>
              <Label htmlFor="website">Website</Label>
              <Input id="website" maxLength={200} value={profile.website}
                onChange={e => set('website', e.target.value)} placeholder="acme.com" />
            </div>
            <div>
              <Label htmlFor="hours">Hours</Label>
              <Input id="hours" maxLength={300} value={profile.hours}
                onChange={e => set('hours', e.target.value)} placeholder="Mon–Fri 9am–5pm ET" />
            </div>
          </div>
          <div>
            <Label htmlFor="location">Location or service area</Label>
            <Input id="location" maxLength={300} value={profile.location}
              onChange={e => set('location', e.target.value)}
              placeholder="e.g. 12 Main St, Springfield. We deliver within 20 miles." />
          </div>
          <p className="text-xs text-gray-500 -mt-3">
            When the assistant can't answer something, it points visitors to your email, or your phone or website if there's no email.
          </p>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Top questions customers ask</span>
              <span className="text-xs text-gray-500">{profile.faqs.length} / {MAX_FAQS}</span>
            </div>
            {profile.faqs.map((f, i) => (
              <div key={i} className="rounded-md border border-gray-200 p-3 space-y-2">
                <Input aria-label={`Question ${i + 1}`} maxLength={200} value={f.q}
                  onChange={e => setFaq(i, 'q', e.target.value)} placeholder="Question, e.g. Do you offer gift cards?" />
                <Textarea aria-label={`Answer ${i + 1}`} maxLength={500} rows={2} value={f.a}
                  onChange={e => setFaq(i, 'a', e.target.value)} placeholder="Your answer" />
                <Button type="button" variant="ghost" size="sm" className="text-red-600 hover:text-red-700"
                  onClick={() => setProfile(p => ({ ...p, faqs: p.faqs.filter((_, j) => j !== i) }))}>
                  Remove
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" disabled={profile.faqs.length >= MAX_FAQS}
              onClick={() => setProfile(p => ({ ...p, faqs: [...p.faqs, { q: '', a: '' }] }))}>
              + Add a question
            </Button>
          </div>

          <div>
            <Label htmlFor="avoidTopics">Topics the assistant should not discuss (optional)</Label>
            <Textarea id="avoidTopics" maxLength={1000} rows={2} value={profile.avoidTopics}
              onChange={e => set('avoidTopics', e.target.value)}
              placeholder="e.g. Competitors, upcoming products, staff names" />
          </div>

          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Business Profile'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
