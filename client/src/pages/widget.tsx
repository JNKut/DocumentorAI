import CleanAIWidget from "@/components/CleanAIWidget";
import { Bot, FileText, Code, Clock, Zap, Shield, Headphones, Check } from "lucide-react";

export default function WidgetPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">

      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-6 h-6 text-blue-600" />
            <span className="text-xl font-bold tracking-tight">DocumentorAI</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#pricing" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Pricing</a>
            <a
              href="/admin"
              className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Get Started
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-sm font-medium px-4 py-1.5 rounded-full mb-8">
          <Zap className="w-3.5 h-3.5" />
          AI customer service — live in minutes
        </div>
        <h1 className="text-6xl font-extrabold tracking-tight leading-tight mb-6 max-w-4xl mx-auto">
          Your business deserves an AI that actually knows it.
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10">
          DocumentorAI lets you deploy a custom AI chat assistant trained on your own documents — and embed it on any website with a single line of code.
        </p>
        <div className="flex items-center justify-center gap-4">
          <a
            href="/admin"
            className="bg-blue-600 text-white text-base font-semibold px-7 py-3.5 rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
          >
            Get Started Free
          </a>
          <a
            href="#demo"
            className="text-base font-semibold text-gray-700 px-7 py-3.5 rounded-xl border border-gray-200 hover:border-gray-400 transition-colors"
          >
            See It Live ↓
          </a>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-4 tracking-tight">How it works</h2>
          <p className="text-center text-gray-500 mb-14">Three steps from setup to live.</p>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Train it",
                desc: "Upload a document — your FAQs, product info, policies, or any text. The AI learns your business instantly.",
                icon: <FileText className="w-6 h-6 text-blue-600" />,
              },
              {
                step: "2",
                title: "Embed it",
                desc: "Copy one line of code and paste it into any website. Works on Shopify, Webflow, WordPress, and more.",
                icon: <Code className="w-6 h-6 text-blue-600" />,
              },
              {
                step: "3",
                title: "Let it work",
                desc: "Your AI assistant answers customer questions 24/7 — trained specifically on your business, not generic fluff.",
                icon: <Clock className="w-6 h-6 text-blue-600" />,
              },
            ].map((item) => (
              <div key={item.step} className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mb-5">
                  {item.icon}
                </div>
                <div className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-2">Step {item.step}</div>
                <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                <p className="text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="demo" className="py-20 max-w-6xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-center mb-4 tracking-tight">Everything you need, nothing you don't</h2>
        <p className="text-center text-gray-500 mb-14">Built for small businesses that want real results without the complexity.</p>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              icon: <Zap className="w-5 h-5 text-blue-600" />,
              title: "Instant Setup",
              desc: "Configure your chatbot in minutes from a simple admin panel. No coding required.",
            },
            {
              icon: <FileText className="w-5 h-5 text-blue-600" />,
              title: "Trained on Your Docs",
              desc: "Upload PDFs, Word docs, or text files. The AI answers from your actual content.",
            },
            {
              icon: <Code className="w-5 h-5 text-blue-600" />,
              title: "Embeds Anywhere",
              desc: "One script tag. Works on any website platform without developer help.",
            },
            {
              icon: <Clock className="w-5 h-5 text-blue-600" />,
              title: "Always On",
              desc: "24/7 availability means customers get answers even when you're closed.",
            },
            {
              icon: <Shield className="w-5 h-5 text-blue-600" />,
              title: "Your Brand",
              desc: "Customize the name, greeting, and personality to match your business.",
            },
            {
              icon: <Headphones className="w-5 h-5 text-blue-600" />,
              title: "Handles the Volume",
              desc: "Let the AI handle common questions so your team focuses on what matters.",
            },
            {
              icon: <Bot className="w-5 h-5 text-blue-600" />,
              title: "Powered by GPT-4",
              desc: "Enterprise-grade AI under the hood — the same technology used by top companies.",
            },
            {
              icon: <Zap className="w-5 h-5 text-blue-600" />,
              title: "No Maintenance",
              desc: "Update your knowledge base anytime. Changes go live instantly.",
            },
          ].map((f) => (
            <div key={f.title} className="p-6 rounded-2xl border border-gray-100 hover:border-blue-100 hover:shadow-sm transition-all">
              <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
                {f.icon}
              </div>
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-gray-50 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-4 tracking-tight">Simple, honest pricing</h2>
          <p className="text-center text-gray-500 mb-14">A fraction of what a customer service hire costs. Cancel anytime.</p>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">

            {/* Starter */}
            <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
              <div className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-3">Starter</div>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-5xl font-extrabold">$49</span>
                <span className="text-gray-400 mb-2">/mo</span>
              </div>
              <p className="text-sm text-gray-500 mb-8">Perfect for getting started.</p>
              <ul className="space-y-3 mb-8">
                {["1 AI chatbot", "Up to 500 conversations/month", "PDF, DOCX & TXT training", "Embed on any website", "Email support"].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <a href="/admin" className="block w-full text-center border border-gray-300 text-gray-700 font-semibold py-3 rounded-xl hover:border-blue-400 hover:text-blue-600 transition-colors">
                Get Started
              </a>
            </div>

            {/* Pro */}
            <div className="bg-blue-600 rounded-2xl border border-blue-600 p-8 shadow-lg relative">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-blue-800 text-white text-xs font-bold px-4 py-1 rounded-full">
                MOST POPULAR
              </div>
              <div className="text-sm font-semibold text-blue-200 uppercase tracking-widest mb-3">Pro</div>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-5xl font-extrabold text-white">$99</span>
                <span className="text-blue-300 mb-2">/mo</span>
              </div>
              <p className="text-sm text-blue-200 mb-8">For businesses with real volume.</p>
              <ul className="space-y-3 mb-8">
                {["1 AI chatbot", "Unlimited conversations", "Custom branding & greeting", "Priority support", "PDF, DOCX & TXT training", "Embed on any website"].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-white">
                    <Check className="w-4 h-4 text-blue-300 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <a href="/admin" className="block w-full text-center bg-white text-blue-600 font-semibold py-3 rounded-xl hover:bg-blue-50 transition-colors">
                Get Started
              </a>
            </div>

            {/* Agency */}
            <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
              <div className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-3">Agency</div>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-5xl font-extrabold">$199</span>
                <span className="text-gray-400 mb-2">/mo</span>
              </div>
              <p className="text-sm text-gray-500 mb-8">For agencies managing multiple clients.</p>
              <ul className="space-y-3 mb-8">
                {["Up to 5 AI chatbots", "Unlimited conversations", "White-label (your branding)", "Dedicated support", "PDF, DOCX & TXT training", "Embed on any website"].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <a href="/admin" className="block w-full text-center border border-gray-300 text-gray-700 font-semibold py-3 rounded-xl hover:border-blue-400 hover:text-blue-600 transition-colors">
                Get Started
              </a>
            </div>

          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-10">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-blue-600" />
            <span className="font-bold">DocumentorAI</span>
          </div>
          <p className="text-sm text-gray-400">AI customer service for every business.</p>
        </div>
      </footer>

      {/* Live Demo Widget */}
      <CleanAIWidget />
    </div>
  );
}
