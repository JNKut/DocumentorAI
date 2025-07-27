# Railway Deployment Quick Checklist

## Pre-Deployment Checklist
- [ ] Download code from Replit (three dots → Download as zip)
- [ ] Create GitHub account if needed
- [ ] Have OpenAI API key ready
- [ ] Know your database URL

## GitHub Setup (5 minutes)
- [ ] Create new repository: `ai-chat-widget-production`
- [ ] Set to Public visibility
- [ ] Upload ALL project files (drag contents, not folder)
- [ ] Commit changes

## Railway Deployment (10 minutes)
- [ ] Go to https://railway.app
- [ ] Sign up with GitHub
- [ ] New Project → Deploy from GitHub repo
- [ ] Select your repository
- [ ] Add environment variables:
  - [ ] `NODE_ENV` = `production`
  - [ ] `OPENAI_API_KEY` = `[your key]`
  - [ ] `DATABASE_URL` = `[your database URL]`

## Testing (5 minutes)
- [ ] Wait for deployment to complete
- [ ] Get your Railway URL from Settings → Domains
- [ ] Test widget at: `https://your-app.railway.app/widget`
- [ ] Verify AI responses work
- [ ] Check knowledge base integration

## Website Integration (2 minutes)
- [ ] Add iframe code to your website before `</body>`:
```html
<iframe 
  src="https://your-app.railway.app/widget" 
  width="400" 
  height="600"
  style="border: none; position: fixed; bottom: 20px; right: 20px; z-index: 9999; background: transparent;"
  title="AI Chat Widget">
</iframe>
```

## Final Verification
- [ ] Widget appears on your website
- [ ] Widget responds to messages
- [ ] Widget stays online 24/7
- [ ] No sleep/downtime issues

**Total Time:** 22 minutes
**Result:** Always-on AI chat widget with professional hosting