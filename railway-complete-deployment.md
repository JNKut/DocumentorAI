# Complete Railway Deployment Guide - Always-On AI Chat Widget

## Why Railway is the Best Choice

Railway is superior for your use case because:
- ✅ **Always-on hosting** (never sleeps, even on free tier)
- ✅ **Built for full-stack Node.js apps** like yours
- ✅ **Automatic PostgreSQL database** provisioning
- ✅ **Git-based deployments** (updates automatically)
- ✅ **Professional URLs** with SSL certificates
- ✅ **Better reliability** than Vercel/Render for Node.js
- ✅ **Simple configuration** (no complex build settings)

## Complete Step-by-Step Deployment

### Phase 1: Prepare Your Code (5 minutes)

#### Step 1: Download Your Current Code
1. In your Replit project, click the **three dots (⋯)** in the file explorer
2. Select **"Download as zip"**
3. Save to your computer and **extract the zip file**
4. You should see all your project files (package.json, server folder, client folder, etc.)

#### Step 2: Create GitHub Repository
1. Go to **https://github.com**
2. Sign in or create account if needed
3. Click the green **"New"** button
4. Repository settings:
   - **Name:** `ai-chat-widget-production`
   - **Description:** `Always-on AI customer service chat widget`
   - **Visibility:** Public (required for free deployment)
   - **Check:** "Add a README file"
5. Click **"Create repository"**

#### Step 3: Upload Your Code to GitHub
1. In your new repository, click **"uploading an existing file"**
2. **Drag ALL files** from your extracted Replit folder into the upload area
   - Include: package.json, server/, client/, shared/, all config files
   - Do NOT drag the parent folder, drag the contents
3. Scroll down to commit section:
   - **Commit message:** `Initial deployment of AI chat widget`
4. Click **"Commit changes"**
5. Wait for upload to complete (may take 2-3 minutes)

### Phase 2: Deploy to Railway (10 minutes)

#### Step 4: Create Railway Account
1. Go to **https://railway.app**
2. Click **"Sign up"**
3. Choose **"Continue with GitHub"** (this connects your accounts)
4. Grant Railway permission to access your repositories
5. Complete any additional verification steps

#### Step 5: Create New Project
1. In Railway dashboard, click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Find and click on **`ai-chat-widget-production`** repository
4. Click **"Deploy Now"**

Railway will immediately start analyzing your code and begin deployment.

#### Step 6: Configure Environment Variables
While deployment is running:
1. Click on your project in Railway dashboard
2. Click **"Variables"** tab
3. Add these environment variables by clicking **"New Variable"**:

**Variable 1:**
- **Name:** `NODE_ENV`
- **Value:** `production`

**Variable 2:**
- **Name:** `OPENAI_API_KEY`
- **Value:** `[Your actual OpenAI API key - starts with sk-]`

**Variable 3:**
- **Name:** `DATABASE_URL`
- **Value:** `postgresql://neondb_owner:npg_UydFo23lSkHv@ep-square-boat-aec1lg3d.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require`

#### Step 7: Add PostgreSQL Database (Optional - if you want Railway's database)
If you prefer Railway's database instead of your current one:
1. In your Railway project, click **"New Service"**
2. Select **"Database"** → **"PostgreSQL"**
3. Railway creates database automatically
4. Copy the new `DATABASE_URL` from the database service
5. Update your `DATABASE_URL` variable with the new value

### Phase 3: Verify Deployment (5 minutes)

#### Step 8: Check Deployment Status
1. In Railway dashboard, click **"Deployments"** tab
2. Watch the build logs - should show:
   - "Installing dependencies..."
   - "Building application..."
   - "Deployment successful"
3. This takes 5-10 minutes for first deployment

#### Step 9: Get Your Live URL
1. Once deployment succeeds, click **"Settings"** tab
2. Under **"Domains"**, you'll see your Railway URL
3. It looks like: `https://ai-chat-widget-production.railway.app`
4. Your widget URL: `https://ai-chat-widget-production.railway.app/widget`

#### Step 10: Test Your Widget
1. Open your widget URL in a new browser tab
2. You should see your chat widget interface
3. Test sending a message to ensure AI responses work
4. Verify it knows about your "Class of 2026 collection"

### Phase 4: Implement on Your Website (2 minutes)

#### Step 11: Add Widget to Your Website
Use this exact embed code on any webpage:

```html
<iframe 
  src="https://ai-chat-widget-production.railway.app/widget" 
  width="400" 
  height="600"
  style="border: none; position: fixed; bottom: 20px; right: 20px; z-index: 9999; background: transparent; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);"
  title="AI Chat Widget">
</iframe>
```

**Where to add this:**
- **HTML websites:** Before closing `</body>` tag
- **WordPress:** Theme Editor → footer.php → before `</body>`
- **Shopify:** Online Store → Themes → Edit Code → theme.liquid → before `</body>`
- **Squarespace:** Settings → Advanced → Code Injection → Footer

### Phase 5: Ongoing Management

#### Automatic Updates
- When you update code in GitHub, Railway automatically redeploys
- Your widget URL stays the same
- Zero downtime deployments

#### Monitoring
- Railway dashboard shows uptime, logs, and performance
- Built-in error tracking and alerts
- Usage analytics available

#### Scaling
- Free tier handles thousands of conversations
- Automatic scaling if traffic increases
- No manual intervention needed

## Troubleshooting Common Issues

### Build Errors
**Symptom:** Deployment fails with build errors
**Solution:**
1. Check build logs in Railway dashboard
2. Ensure all files uploaded correctly to GitHub
3. Verify package.json has correct scripts

### Widget Not Loading
**Symptom:** 404 or blank page at widget URL
**Solution:**
1. Verify deployment completed successfully
2. Check environment variables are set correctly
3. Review application logs in Railway dashboard

### AI Not Responding
**Symptom:** Widget loads but AI doesn't answer
**Solution:**
1. Verify `OPENAI_API_KEY` is correct and has credits
2. Check `DATABASE_URL` connects successfully
3. Review server logs for specific errors

### Database Connection Issues
**Symptom:** Error messages about database
**Solution:**
1. Test database URL connectivity
2. Ensure database allows external connections
3. Consider using Railway's PostgreSQL instead

## Final Configuration Summary

**Your Production Setup:**
- **Always-on hosting:** Railway free tier
- **Domain:** `https://your-app.railway.app`
- **Widget URL:** `https://your-app.railway.app/widget`
- **Database:** Your current Neon PostgreSQL (or Railway's)
- **AI Model:** OpenAI GPT-4o with your knowledge base
- **Automatic deployments:** From GitHub updates

**Expected Performance:**
- **Uptime:** 99.9% (always-on)
- **Response time:** <2 seconds globally
- **Concurrent users:** Thousands supported
- **Storage:** Unlimited conversations
- **SSL:** Automatic HTTPS certificate

## Total Deployment Time
- **Preparation:** 5 minutes
- **GitHub upload:** 5 minutes  
- **Railway deployment:** 10 minutes
- **Testing & implementation:** 5 minutes
- **Total:** 25 minutes

Your widget will be live 24/7 with professional hosting that never sleeps, automatic SSL, and global CDN delivery - exactly like having Replit Core but with guaranteed always-on reliability.