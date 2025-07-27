# Create GitHub Repository and Deploy to Vercel

## Step 1: Create GitHub Account (if you don't have one)
1. Go to https://github.com
2. Click "Sign up"
3. Choose a username and password
4. Verify your email

## Step 2: Create New Repository
1. Click the green "New" button (or go to https://github.com/new)
2. Repository name: `ai-chat-widget`
3. Description: `Customer service chat widget for business websites`
4. Choose "Public" (required for free Vercel)
5. Check "Add a README file"
6. Click "Create repository"

## Step 3: Upload Your Code
**Option A: Using GitHub Web Interface (Easiest)**
1. Download your code from Replit:
   - Click three dots (⋯) in file explorer
   - Click "Download as zip"
   - Extract the zip file
2. In your new GitHub repo, click "uploading an existing file"
3. Drag all your project files into the upload area
4. Write commit message: "Initial upload of AI chat widget"
5. Click "Commit changes"

**Option B: Using Git Commands (if you prefer)**
```bash
git clone https://github.com/yourusername/ai-chat-widget.git
cd ai-chat-widget
# Copy your files here
git add .
git commit -m "Initial upload of AI chat widget"
git push
```

## Step 4: Deploy to Vercel (Always-On Hosting)
1. Go to https://vercel.com
2. Click "Sign up" and choose "Continue with GitHub"
3. Click "Import Project"
4. Select your `ai-chat-widget` repository
5. Vercel will auto-detect it's a Node.js app
6. Click "Deploy"

## Step 5: Add Environment Variables in Vercel
1. In Vercel dashboard, go to your project
2. Click "Settings" → "Environment Variables"
3. Add these variables:
   - `OPENAI_API_KEY` = your OpenAI API key
   - `NODE_ENV` = production
   - `DATABASE_URL` = (Vercel will provide or use Neon)

## Step 6: Your Always-On Widget URL
After deployment, you'll get a URL like:
`https://ai-chat-widget.vercel.app/widget`

Use this in your embed code:
```html
<iframe 
  src="https://ai-chat-widget.vercel.app/widget" 
  width="400" 
  height="600"
  style="border: none; position: fixed; bottom: 0; right: 0; z-index: 9999; background: transparent;"
  title="AI Chat Widget">
</iframe>
```

## Benefits of This Setup:
✅ Always-on (never sleeps)
✅ Free hosting
✅ Automatic deployments when you update code
✅ Professional URL
✅ SSL certificate included
✅ Global CDN for fast loading

Total setup time: 10-15 minutes