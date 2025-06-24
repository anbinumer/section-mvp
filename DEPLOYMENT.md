# Vercel Deployment Guide

## 🚀 Deploy to Vercel

### Prerequisites
- GitHub account with the repository
- Vercel account (free tier available)

### Step 1: Prepare Repository
1. Ensure all changes are committed and pushed to GitHub
2. Verify the repository is public or you have Vercel Pro for private repos

### Step 2: Deploy to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Sign in with your GitHub account
3. Click "New Project"
4. Import your GitHub repository: `anbinumer/section-mvp`
5. Vercel will auto-detect it's a Node.js project
6. Click "Deploy"

### Step 3: Configure Environment Variables (Optional)
In your Vercel project dashboard:
1. Go to Settings → Environment Variables
2. Add any custom environment variables:
   ```
   NODE_ENV=production
   INSTITUTION_NAME=Australian Catholic University
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100
   ```

### Step 4: Test Deployment
1. Your app will be available at: `https://your-project-name.vercel.app`
2. Test the Canvas connection with your API token
3. Verify all functionality works as expected

## 🔧 Vercel-Specific Configuration

### Automatic Deployments
- Every push to `main` branch triggers automatic deployment
- Preview deployments for pull requests
- Automatic HTTPS and CDN

### Environment Variables
- Set in Vercel dashboard under Settings → Environment Variables
- Available in production builds
- No `.env` file needed in production

### Custom Domain (Optional)
1. In Vercel dashboard, go to Settings → Domains
2. Add your custom domain
3. Configure DNS records as instructed

## 🛠️ Troubleshooting

### Common Issues
1. **Build Failures**: Check Vercel build logs
2. **CORS Errors**: Verify CORS configuration in `server.js`
3. **API Errors**: Check Canvas API token and permissions
4. **Static Files**: Ensure `public/` folder is properly served

### Debugging
- Check Vercel function logs in dashboard
- Use `console.log()` for debugging (visible in Vercel logs)
- Test locally first with `npm run dev`

## 📊 Performance

### Vercel Benefits
- Global CDN for static assets
- Serverless functions for API routes
- Automatic scaling
- Built-in analytics

### Optimization Tips
- Keep API responses small
- Use efficient Canvas API calls
- Minimize dependencies

## 🔒 Security

### Production Security
- HTTPS automatically enabled
- Security headers via Helmet.js
- Rate limiting configured
- CORS properly configured

### API Token Security
- Tokens never stored in database
- Only used for Canvas API calls
- User provides tokens through UI

## 📈 Monitoring

### Vercel Analytics
- Function execution times
- Error rates
- Request volumes
- Performance metrics

### Custom Monitoring
- Canvas API call tracking
- Allocation success rates
- User activity patterns

---

**Note**: This Canvas-only approach is perfect for Vercel deployment as it requires no external database setup and uses only Canvas API for all operations. 