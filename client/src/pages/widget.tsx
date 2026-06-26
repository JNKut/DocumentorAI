import CleanAIWidget from "@/components/CleanAIWidget";

const css = `
  .dai-root { font-family: 'Hanken Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #FCFCFA; color: #16150F; }
  .dai-root *, .dai-root *::before, .dai-root *::after { box-sizing: border-box; margin: 0; padding: 0; }
  .dai-root a { color: inherit; text-decoration: none; }
  .dai-root ::selection { background: #FFE14D; color: #16150F; }

  .dai-wrap { max-width: 1080px; margin: 0 auto; padding: 0 clamp(20px, 5vw, 60px); }

  /* NAV */
  .dai-nav { position: sticky; top: 0; z-index: 100; background: rgba(252,252,250,0.88); backdrop-filter: saturate(160%) blur(12px); border-bottom: 1px solid #D8D6CC; }
  .dai-nav-inner { display: flex; align-items: center; justify-content: space-between; height: 60px; }
  .dai-logo { display: flex; align-items: center; gap: 10px; }
  .dai-logo .mark { width: 28px; height: 28px; flex-shrink: 0; color: #16150F; }
  .dai-logo .word { font-family: 'Fraunces', Georgia, serif; font-weight: 600; font-size: 20px; letter-spacing: -0.4px; }
  .dai-logo .ai { background-image: linear-gradient(#FFE14D, #FFE14D); background-repeat: no-repeat; background-position: 0 78%; background-size: 100% 42%; padding: 0 2px; }
  .dai-nav-links { display: flex; align-items: center; gap: 24px; }
  .dai-nav-links a:not(.dai-btn) { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 12px; letter-spacing: 0.3px; color: #57554C; text-transform: uppercase; transition: color .15s; }
  .dai-nav-links a:not(.dai-btn):hover { color: #16150F; }
  .dai-btn { display: inline-flex; align-items: center; justify-content: center; gap: 9px; font-family: 'Hanken Grotesk', sans-serif; font-weight: 600; font-size: 13.5px; border-radius: 2px; cursor: pointer; transition: transform .14s ease, background .15s, box-shadow .15s, color .15s; padding: 9px 18px; border: none; }
  .dai-btn-ink { background: #16150F; color: #FCFCFA; }
  .dai-btn-ink:hover { transform: translateY(-1px); }
  .dai-btn-primary { background: #26235C; color: #FCFCFA; box-shadow: 3px 3px 0 #16150F; }
  .dai-btn-primary:hover { transform: translate(-1px,-1px); box-shadow: 4px 4px 0 #16150F; }
  .dai-btn-ghost { background: transparent; color: #16150F; border: 1px solid #16150F; }
  .dai-btn-ghost:hover { background: #16150F; color: #FCFCFA; }
  .dai-btn-lg { padding: 15px 26px; font-size: 15.5px; }

  /* LAYOUT */
  .dai-doc { display: grid; grid-template-columns: 150px minmax(0, 1fr); }
  .dai-gutter { padding-right: clamp(20px, 3vw, 40px); font-family: 'JetBrains Mono', monospace; font-size: 11.5px; font-weight: 500; letter-spacing: 0.6px; text-transform: uppercase; color: #57554C; padding-top: 4px; }
  .dai-main { border-left: 1px solid #D8D6CC; padding-left: clamp(26px, 4vw, 60px); }

  /* SECTION */
  .dai-section { padding: 80px 0; }
  .dai-section-alt { background: #ECEAE2; }

  /* HERO */
  .dai-tag { display: inline-flex; align-items: center; gap: 8px; font-family: 'JetBrains Mono', monospace; font-size: 12px; text-transform: uppercase; letter-spacing: 0.8px; color: #26235C; margin-bottom: 26px; }
  .dai-tag::before { content: ""; width: 22px; height: 1px; background: #26235C; display: inline-block; }
  .dai-h1 { font-family: 'Fraunces', Georgia, serif; font-weight: 600; font-size: clamp(40px, 6vw, 80px); line-height: 1.0; letter-spacing: -1.5px; max-width: 13ch; margin-bottom: 26px; }
  .dai-lede { font-size: clamp(16px, 2.1vw, 20px); color: #57554C; max-width: 56ch; line-height: 1.6; margin-bottom: 30px; }
  .dai-embed { display: inline-flex; flex-direction: column; gap: 7px; margin-bottom: 34px; }
  .dai-embed-label { font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #57554C; }
  .dai-embed code { font-family: 'JetBrains Mono', monospace; font-size: clamp(12px, 1.5vw, 13.5px); color: #16150F; background: #FFF3B8; border: 1px solid #D8D6CC; padding: 11px 16px; border-radius: 3px; display: inline-block; }
  .dai-embed code .t { color: #26235C; }
  .dai-hero-ctas { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 28px; }
  .dai-hero-checks { display: flex; gap: 22px; flex-wrap: wrap; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #57554C; }
  .dai-hero-checks span { display: flex; align-items: center; gap: 6px; }
  .dai-hero-checks svg { width: 14px; height: 14px; color: #26235C; }

  /* highlight animation */
  .dai-hl { background-image: linear-gradient(#FFE14D, #FFE14D); background-repeat: no-repeat; background-position: 0 82%; background-size: 100% 40%; padding: 0 0.04em; }
  .dai-hl-swipe { background-size: 0% 40%; animation: daiSwipe 0.85s 0.55s cubic-bezier(.22,.61,.36,1) forwards; }
  @keyframes daiSwipe { to { background-size: 100% 40%; } }

  /* STEPS */
  .dai-lead { margin-bottom: 40px; }
  .dai-lead h2 { font-family: 'Fraunces', Georgia, serif; font-weight: 600; font-size: clamp(26px, 4vw, 44px); letter-spacing: -1px; line-height: 1.05; margin-bottom: 12px; }
  .dai-lead p { font-size: 18px; color: #57554C; line-height: 1.6; }
  .dai-step { display: grid; grid-template-columns: 64px minmax(0,1fr); padding: 28px 0; border-top: 1px solid #D8D6CC; }
  .dai-s-num { font-family: 'Fraunces', Georgia, serif; font-weight: 500; font-size: 28px; color: #16150F; line-height: 1; }
  .dai-s-body h3 { font-family: 'Fraunces', Georgia, serif; font-weight: 600; font-size: 22px; letter-spacing: -0.3px; margin-bottom: 8px; }
  .dai-s-body p { font-size: 15px; color: #57554C; line-height: 1.6; max-width: 56ch; }

  /* FEATURES */
  .dai-feat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); border-top: 1px solid #D8D6CC; border-left: 1px solid #D8D6CC; }
  .dai-feat { padding: 26px 24px; border-right: 1px solid #D8D6CC; border-bottom: 1px solid #D8D6CC; transition: background .18s; }
  .dai-feat:hover { background: #FFF3B8; }
  .dai-feat .f-icon { width: 24px; height: 24px; color: #26235C; margin-bottom: 14px; }
  .dai-feat h3 { font-family: 'Fraunces', Georgia, serif; font-weight: 600; font-size: 17px; margin-bottom: 8px; }
  .dai-feat p { font-size: 14px; color: #57554C; line-height: 1.55; }

  /* PRICING */
  .dai-price-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 24px; }
  .dai-price-card { background: #FCFCFA; border: 1px solid #16150F; border-radius: 3px; padding: 32px 30px; position: relative; }
  .dai-price-card.featured { background: #16150F; color: #FCFCFA; }
  .dai-pop { position: absolute; top: -1px; right: -1px; background: #FFE14D; color: #16150F; font-family: 'JetBrains Mono', monospace; font-size: 10.5px; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase; padding: 6px 12px; }
  .dai-plan-name { font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px; color: #57554C; margin-bottom: 16px; }
  .dai-price-card.featured .dai-plan-name { color: #D8D6CC; }
  .dai-price-amount { font-family: 'Fraunces', Georgia, serif; font-weight: 600; font-size: 52px; letter-spacing: -1px; line-height: 1; margin-bottom: 4px; }
  .dai-price-amount span { font-size: 18px; font-weight: 400; color: #57554C; letter-spacing: 0; }
  .dai-price-card.featured .dai-price-amount span { color: #D8D6CC; }
  .dai-plan-desc { font-size: 14px; color: #57554C; margin-bottom: 24px; }
  .dai-price-card.featured .dai-plan-desc { color: #D8D6CC; }
  .dai-flist { list-style: none; margin-bottom: 28px; display: flex; flex-direction: column; gap: 10px; }
  .dai-flist li { display: flex; align-items: flex-start; gap: 9px; font-size: 14px; }
  .dai-ck { width: 14px; height: 14px; flex-shrink: 0; margin-top: 1px; color: #26235C; }
  .dai-price-card.featured .dai-ck { color: #FFE14D; }
  .dai-plan-btn { display: block; text-align: center; font-weight: 600; font-size: 14px; padding: 12px; border-radius: 2px; border: 1px solid #16150F; color: #16150F; transition: background .15s, color .15s; }
  .dai-plan-btn:hover { background: #16150F; color: #FCFCFA; }
  .dai-price-card.featured .dai-plan-btn { background: #26235C; border-color: #26235C; color: #FCFCFA; box-shadow: 3px 3px 0 #FFE14D; }
  .dai-price-card.featured .dai-plan-btn:hover { transform: translate(-1px,-1px); box-shadow: 4px 4px 0 #FFE14D; }

  /* FOOTER */
  .dai-footer { background: #ECEAE2; color: #16150F; border-top: 1px solid #D8D6CC; padding: 48px 0 32px; }
  .dai-foot-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 32px; margin-bottom: 32px; }
  .dai-foot-tag { font-size: 13px; color: #57554C; margin-top: 10px; }
  .dai-foot-links { display: flex; gap: 24px; font-size: 13px; color: #57554C; }
  .dai-foot-links a:hover { color: #16150F; }
  .dai-foot-rule { display: flex; justify-content: space-between; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #57554C; letter-spacing: 0.3px; padding-top: 20px; border-top: 1px solid #D8D6CC; }
  .dai-foot-rule a:hover { color: #16150F; }
`;

const LogoMark = () => (
  <svg className="mark" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17 4H8a2 2 0 0 0-2 2v20a2 2 0 0 0 2 2h8"/>
    <path d="M17 4l6 6"/><path d="M17 4v6h6"/>
    <line x1="10" y1="15" x2="17" y2="15"/><line x1="10" y1="19" x2="14" y2="19"/>
    <path d="M18 18h8a1.5 1.5 0 0 1 1.5 1.5V24a1.5 1.5 0 0 1-1.5 1.5h-4l-3 2.5v-2.5h-1A1.5 1.5 0 0 1 16.5 24v-4.5A1.5 1.5 0 0 1 18 18Z"/>
  </svg>
);

const Check = () => (
  <svg className="dai-ck" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

export default function WidgetPage() {
  return (
    <div className="dai-root">
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* NAV */}
      <nav className="dai-nav">
        <div className="dai-wrap dai-nav-inner">
          <a href="/" className="dai-logo" aria-label="DocumentorAI home">
            <LogoMark />
            <span className="word">Documentor<span className="ai">AI</span></span>
          </a>
          <div className="dai-nav-links">
            <a href="#how-it-works">How it works</a>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="/admin" className="dai-btn dai-btn-ink">Get Started</a>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="dai-section">
        <div className="dai-wrap">
          <div className="dai-doc">
            <div className="dai-gutter">trained<br/>on your<br/>docs</div>
            <div className="dai-main">
              <div className="dai-tag">AI customer service — live in minutes</div>
              <h1 className="dai-h1">Your business deserves an AI that <em><span className="dai-hl dai-hl-swipe">actually knows it.</span></em></h1>
              <p className="dai-lede">DocumentorAI lets you deploy a custom AI chat assistant trained on your own documents — and embed it on any website with a single line of code.</p>
              <div className="dai-embed">
                <span className="dai-embed-label">one line, any site</span>
                <code>&lt;<span className="t">script</span> src="documentorai.org/widget.js"&gt;&lt;/<span className="t">script</span>&gt;</code>
              </div>
              <div className="dai-hero-ctas">
                <a href="/admin" className="dai-btn dai-btn-primary dai-btn-lg">Get Started</a>
                <a href="#how-it-works" className="dai-btn dai-btn-ghost dai-btn-lg">See How It Works ↓</a>
              </div>
              <div className="dai-hero-checks">
                <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg> No code required</span>
                <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg> Set up the same day</span>
                <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg> Cancel anytime</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="dai-section dai-section-alt" id="how-it-works">
        <div className="dai-wrap">
          <div className="dai-doc">
            <div className="dai-gutter">§ 01–03<br/>the process</div>
            <div className="dai-main">
              <div className="dai-lead">
                <h2>Three steps from setup to live</h2>
                <p>No developers needed. No complicated setup.</p>
              </div>
              {[
                { num: "01", title: "Train it", desc: "Upload a document — your FAQs, product info, or policies. The AI learns your business instantly." },
                { num: "02", title: "Embed it", desc: "Copy one line of code and paste it into any website. Works on Shopify, Webflow, WordPress, and more." },
                { num: "03", title: "Let it work", desc: "Your AI answers customer questions 24/7 — trained specifically on your business, not generic fluff." },
              ].map(s => (
                <div key={s.num} className="dai-step">
                  <div className="dai-s-num">{s.num}</div>
                  <div className="dai-s-body">
                    <h3>{s.title}</h3>
                    <p>{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="dai-section" id="features">
        <div className="dai-wrap">
          <div className="dai-doc">
            <div className="dai-gutter">the<br/>margins</div>
            <div className="dai-main">
              <div className="dai-lead">
                <h2>Everything you need, nothing you don't</h2>
                <p>Built for small businesses that want real results without the complexity.</p>
              </div>
              <div className="dai-feat-grid">
                {[
                  { title: "Instant Setup", desc: "Configure your chatbot in minutes from a simple admin panel. No coding required." },
                  { title: "Trained on Your Docs", desc: "Upload PDFs, Word docs, or text files. The AI answers from your actual content." },
                  { title: "Embeds Anywhere", desc: "One script tag. Works on any website platform without developer help." },
                  { title: "Always On", desc: "24/7 availability means customers get answers even when you're closed." },
                  { title: "Your Brand", desc: "Customize the name, greeting, color, and personality to match your business." },
                  { title: "Handles the Volume", desc: "Let the AI handle common questions so your team focuses on what matters." },
                  { title: "Powered by GPT-4", desc: "Enterprise-grade AI — the same technology used by top companies worldwide." },
                  { title: "No Maintenance", desc: "Update your knowledge base anytime. Changes go live instantly." },
                ].map(f => (
                  <div key={f.title} className="dai-feat">
                    <svg className="f-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" width="24" height="24" style={{ color: '#26235C', marginBottom: 14 }}>
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                    </svg>
                    <h3>{f.title}</h3>
                    <p>{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="dai-section dai-section-alt" id="pricing">
        <div className="dai-wrap">
          <div className="dai-doc">
            <div className="dai-gutter">rates<br/>per month</div>
            <div className="dai-main">
              <div className="dai-lead">
                <h2>Simple, honest pricing</h2>
                <p>A fraction of what a customer service hire costs. Cancel anytime.</p>
              </div>
              <div className="dai-price-grid">
                <div className="dai-price-card">
                  <div className="dai-plan-name">Starter</div>
                  <div className="dai-price-amount">$49<span>/mo</span></div>
                  <div className="dai-plan-desc">Perfect for getting started.</div>
                  <ul className="dai-flist">
                    {["1 AI chatbot", "Up to 500 conversations/month", "PDF, DOCX & TXT training", "Embed on any website", "Email support"].map(f => (
                      <li key={f}><Check />{f}</li>
                    ))}
                  </ul>
                  <a href="/admin" className="dai-plan-btn">Get Started</a>
                </div>
                <div className="dai-price-card featured">
                  <div className="dai-pop">Most Popular</div>
                  <div className="dai-plan-name">Pro</div>
                  <div className="dai-price-amount">$99<span>/mo</span></div>
                  <div className="dai-plan-desc">For businesses with real volume.</div>
                  <ul className="dai-flist">
                    {["1 AI chatbot", "Unlimited conversations", "Custom branding & greeting", "Priority support", "PDF, DOCX & TXT training", "Embed on any website"].map(f => (
                      <li key={f}><Check />{f}</li>
                    ))}
                  </ul>
                  <a href="/admin" className="dai-plan-btn">Get Started</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="dai-footer">
        <div className="dai-wrap">
          <div className="dai-doc">
            <div className="dai-gutter" style={{ paddingTop: 0 }}>colophon</div>
            <div className="dai-main">
              <div className="dai-foot-top">
                <div>
                  <a href="/" className="dai-logo" aria-label="DocumentorAI home">
                    <LogoMark />
                    <span className="word">Documentor<span className="ai">AI</span></span>
                  </a>
                  <p className="dai-foot-tag">AI customer service for every business.</p>
                </div>
                <nav className="dai-foot-links" aria-label="Footer">
                  <a href="#how-it-works">How it works</a>
                  <a href="#pricing">Pricing</a>
                  <a href="/admin">Get Started</a>
                </nav>
              </div>
              <div className="dai-foot-rule">
                <span>© 2026 DocumentorAI</span>
                <a href="mailto:jonahkutikov@gmail.com">jonahkutikov@gmail.com</a>
              </div>
            </div>
          </div>
        </div>
      </footer>

      <CleanAIWidget />
    </div>
  );
}
