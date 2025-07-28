# LinkedIn Feed Scraper Chrome Extension

A Chrome extension that extracts LinkedIn feed posts in real browser context and sends data to your automation service via webhooks.

## Features

- **Runs in real browser context** (bypasses bot detection)
- **Extracts up to 25 LinkedIn feed posts**
- **Configurable webhook URL**
- **Auto-scrape option**
- **Visual feedback and status indicators**
- **Multiple CSS selector fallbacks** for reliability

## Installation

### 1. Download Extension Files
Download all files from the `chrome-extension` folder to your local machine.

### 2. Load Extension in Chrome
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `chrome-extension` folder
5. Extension icon should appear in your toolbar

### 3. Configure Settings
1. Click the extension icon in your toolbar
2. Click "Settings" to expand configuration
3. Set webhook URL (default: `http://localhost:3000/webhook/linkedin-feed`)
4. Adjust max posts if needed (default: 25)
5. Enable auto-scrape if desired (will automatically scrape when you visit LinkedIn feed)
6. Click "Save Settings"

## Usage

### 1. Start Your Node.js Service
```bash
cd /path/to/linkedin-scraper
npm start
```
The service should be running on `http://localhost:3000`

### 2. Navigate to LinkedIn Feed
- Go to https://linkedin.com/feed/
- Make sure you're logged in to your LinkedIn account
- The extension will only work on the LinkedIn feed page

### 3. Scrape Feed Data

You have three ways to trigger scraping:

**Option A: Extension Popup**
- Click the extension icon in your toolbar
- Click "Start Scraping" button
- Monitor progress in the popup

**Option B: Floating Button**
- Look for the blue "📊 Scrape Feed" button in the top-right of the page
- Click it to start scraping
- Button will show progress and results

**Option C: Auto-scrape**
- Enable "Auto-scrape on page load" in extension settings
- Extension will automatically start scraping when you visit LinkedIn feed
- Useful for automated workflows

### 4. Monitor Results
- Extension popup shows real-time scraping status
- Check your Node.js service logs for webhook data reception
- Data is sent to your configured webhook URL in real-time

## Data Format

The extension sends data to your webhook in this format:

```json
{
  "success": true,
  "count": 25,
  "data": [
    {
      "author": "John Smith",
      "postText": "Excited to announce our new product launch...",
      "timestamp": "2h ago",
      "externalURL": "https://linkedin.com/posts/johnsmith_product-launch-activity-123456"
    },
    {
      "author": "Sarah Johnson",
      "postText": "Just completed my certification in cloud architecture...",
      "timestamp": "1d ago", 
      "externalURL": "https://linkedin.com/posts/sarahjohnson_cloud-certification-activity-789012"
    }
  ],
  "source": "chrome-extension",
  "timestamp": "2024-01-28T14:30:00Z",
  "url": "https://linkedin.com/feed/"
}
```

## Extension Components

- **Content Script** (`src/content.js`): Runs on LinkedIn feed pages, extracts post data
- **Popup Interface** (`popup/popup.html`, `popup/popup.js`): User controls and settings
- **Background Script** (`src/background.js`): Extension lifecycle and notifications
- **Manifest** (`manifest.json`): Extension configuration and permissions

## Troubleshooting

### Extension Not Working
- **Check page**: Make sure you're on `linkedin.com/feed/` (not just linkedin.com)
- **Check login**: Ensure you're logged in to LinkedIn
- **Check permissions**: Extension needs permission to access LinkedIn domains

### No Data Received
- **Verify webhook URL**: Check extension settings for correct webhook URL
- **Check service**: Ensure your Node.js service is running on the correct port
- **Check network**: Verify no firewall blocking localhost connections

### Service Not Responding  
- **Start service**: Run `npm start` in the linkedin-scraper directory
- **Check port**: Default is 3000, verify it's not in use by another service
- **Check logs**: Look at Node.js console for webhook reception logs

### Posts Not Found
- **LinkedIn changes**: LinkedIn may have updated their HTML structure
- **Scroll down**: Try scrolling down on the feed to load more posts
- **Refresh page**: Sometimes a page refresh helps load the feed properly

## Security Notes

- Extension only runs on LinkedIn domains (`linkedin.com`)
- No data is stored locally in the extension
- All data sent directly to your configured webhook URL
- Extension respects LinkedIn's rate limiting
- Uses your actual LinkedIn session (no separate authentication needed)

## Advanced Configuration

### Custom Webhook URLs
You can configure the extension to send data to any webhook endpoint:
- Local development: `http://localhost:3000/webhook/linkedin-feed`
- Remote server: `https://your-domain.com/api/linkedin-webhook`
- Automation platforms: Zapier, Make.com, n8n webhook URLs

### Integration with Automation Platforms
The extension works well with:
- **Zapier**: Use webhook trigger to receive LinkedIn data
- **Make.com**: Set up webhook module to process feed data  
- **n8n**: Create webhook node to handle incoming LinkedIn posts
- **Custom APIs**: Any service that accepts JSON webhook data

## Development

To modify the extension:
1. Edit files in the `chrome-extension` folder
2. Go to `chrome://extensions/`
3. Click the refresh icon on your extension
4. Test changes on LinkedIn feed page

The extension uses modern Chrome Extension Manifest V3 format with proper permissions and security practices.
