# Deploy to Render (Always-On) - Simple & Reliable

## Why Render Instead of Vercel?
- More reliable for Node.js full-stack apps
- Simpler configuration
- Better error messages
- Free tier with always-on hosting

## Step-by-Step Deployment

### Step 1: Create Render Account
1. Go to https://render.com
2. Click "Get Started for Free"
3. Sign up with GitHub (connect your account)

### Step 2: Create New Web Service
1. In Render dashboard, click "New +"
2. Select "Web Service"
3. Click "Connect a repository"
4. Find and select your `ai-chat-widget` repository
5. Click "Connect"

### Step 3: Configure Web Service
**Name:** `ai-chat-widget`
**Environment:** `Node`
**Region:** `Oregon (US West)` or closest to you
**Branch:** `main` (or your default branch)
**Build Command:** `npm run build`
**Start Command:** `npm start`

### Step 4: Add Environment Variables
In the Environment Variables section, add:

1. **OPENAI_API_KEY**
   - Value: [Your OpenAI API key starting with sk-]

2. **DATABASE_URL**
   - Value: `postgresql://neondb_owner:npg_UydFo23lSkHv@ep-square-boat-aec1lg3d.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require`

3. **NODE_ENV**
   - Value: `production`

### Step 5: Deploy
1. Click "Create Web Service"
2. Render will automatically:
   - Clone your repository
   - Install dependencies
   - Build your application
   - Deploy to a live URL
3. Wait 5-10 minutes for first deployment

### Step 6: Get Your Widget URL
After successful deployment, you'll get a URL like:
`https://ai-chat-widget.onrender.com`

Your widget will be available at:
`https://ai-chat-widget.onrender.com/widget`

### Step 7: Test Your Widget
Visit your widget URL directly to make sure it works, then use this embed code:

```html
<iframe 
  src="https://ai-chat-widget.onrender.com/widget" 
  width="400" 
  height="600"
  style="border: none; position: fixed; bottom: 20px; right: 20px; z-index: 9999; background: transparent; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);"
  title="AI Chat Widget">
</iframe>
```

## Benefits of Render
✅ Always-on (never sleeps)
✅ Free tier available
✅ Automatic deployments from GitHub
✅ Better Node.js support than Vercel
✅ Clear error logs if issues occur
✅ SSL certificate included
✅ Simple configuration

## If You Need Help
1. Check build logs in Render dashboard
2. Verify environment variables are set correctly
3. Ensure your GitHub repository has all files

This approach is much more reliable than Vercel for full-stack Node.js applications.