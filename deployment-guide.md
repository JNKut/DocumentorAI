# Deploy Your AI Widget to Railway (Always-On)

## Step 1: Download Your Code
1. In Replit, go to the three-dot menu (⋯) in the file explorer
2. Click "Download as zip"
3. Extract the zip file on your computer

## Step 2: Deploy to Railway
1. Go to https://railway.app
2. Sign up with GitHub (free)
3. Click "New Project"
4. Click "Deploy from GitHub repo" 
5. Upload your extracted code folder
6. Railway will automatically detect it's a Node.js app

## Step 3: Add Environment Variables
In Railway dashboard, go to Variables tab and add:
- `DATABASE_URL` = (Railway will provide PostgreSQL automatically)
- `OPENAI_API_KEY` = your OpenAI API key
- `NODE_ENV` = production

## Step 4: Deploy
- Railway automatically builds and deploys
- You'll get a URL like: `https://your-app-name.railway.app`

## Step 5: Update Your Embed Code
```html
<iframe 
  src="https://your-app-name.railway.app/widget" 
  width="400" 
  height="600"
  style="border: none; position: fixed; bottom: 0; right: 0; z-index: 9999; background: transparent;"
  title="AI Chat Widget">
</iframe>
```

Your widget will be always-on with Railway's free tier!

## Alternative: Vercel
If Railway doesn't work, try Vercel:
1. Go to https://vercel.com
2. Sign up with GitHub
3. Import your code repository
4. Add the same environment variables
5. Deploy automatically

Both platforms provide always-on hosting for free!