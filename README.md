# LinkedIn Feed Scraper

A Node.js service that headless-browses LinkedIn, logs in with supplied cookies, fetches the last 25 home-feed items, and returns structured JSON data.

## Features

- Headless browsing using Selenium WebDriver and Chrome
- Cookie-based authentication (no username/password required)
- Fetches up to 25 home feed items
- Returns structured JSON with author, postText, timestamp, and externalURL
- RESTful API endpoint

## Installation

```bash
npm install
```

## Usage

### Start the service

```bash
npm start
```

The service will run on `http://localhost:3000` by default.

### API Endpoints

#### POST /scrape-linkedin-feed

Scrapes LinkedIn home feed using provided cookies.

**Request Body:**
```json
{
  "cookies": [
    {
      "name": "li_at",
      "value": "your_li_at_cookie_value",
      "domain": ".linkedin.com"
    },
    {
      "name": "JSESSIONID",
      "value": "your_jsessionid_value",
      "domain": ".linkedin.com"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "count": 25,
  "data": [
    {
      "author": "John Doe",
      "postText": "Excited to share my latest project...",
      "timestamp": "2024-01-15T10:30:00Z",
      "externalURL": "https://linkedin.com/posts/johndoe_project-123456"
    }
  ]
}
```

#### GET /health

Health check endpoint.

#### GET /

API documentation and usage information.

## Getting LinkedIn Cookies

To use this service, you need to extract cookies from your LinkedIn session:

1. Log into LinkedIn in your browser
2. Open Developer Tools (F12)
3. Go to Application/Storage tab
4. Find Cookies for linkedin.com
5. Copy the `li_at` cookie value (most important)
6. Optionally copy other session cookies like `JSESSIONID`

## Important Notes

- This service runs in headless mode and won't interfere with your browser
- Cookies expire, so you may need to refresh them periodically
- The service respects LinkedIn's structure but web scraping should be done responsibly
- Rate limiting and respectful usage is recommended

## Development

```bash
npm run dev  # Run with nodemon for development
```

## Dependencies

- express: Web server framework
- selenium-webdriver: Browser automation
- chromedriver: Chrome WebDriver

## Chrome Extension Alternative

For better reliability and to bypass LinkedIn's bot detection, use the included Chrome extension:

### Installation
1. Load the `chrome-extension` folder as an unpacked extension in Chrome
2. Configure the webhook URL in extension settings  
3. Navigate to LinkedIn feed and click the extension icon

### Advantages
- Runs in real browser context (no bot detection)
- Uses your actual LinkedIn session
- More reliable post extraction
- Visual feedback and controls
- Multiple extraction methods (popup, floating button, auto-scrape)

See `chrome-extension/README.md` for detailed instructions.

## Error Handling

The service includes comprehensive error handling for:
- Invalid or missing cookies
- Authentication failures
- Network issues
- Element not found scenarios
- Driver initialization problems
