const axios = require('axios');

const testCookies = [
    {
        name: 'li_at',
        value: 'EXAMPLE_LI_AT_COOKIE_VALUE_HERE',
        domain: '.linkedin.com'
    },
    {
        name: 'JSESSIONID', 
        value: 'EXAMPLE_JSESSIONID_VALUE_HERE',
        domain: '.linkedin.com'
    }
];

const expectedResponseFormat = {
    success: true,
    count: 25,
    data: [
        {
            author: "Example Author Name",
            postText: "This is an example post text content that would be scraped from LinkedIn...",
            timestamp: "2024-01-15T10:30:00Z",
            externalURL: "https://linkedin.com/posts/example-post-url"
        },
        {
            author: "Another Author",
            postText: "Another example post with different content and structure...",
            timestamp: "1d ago",
            externalURL: "https://linkedin.com/posts/another-example"
        }
    ]
};

async function testScraper() {
    try {
        console.log('Testing LinkedIn scraper service...');
        console.log('Expected response format:');
        console.log(JSON.stringify(expectedResponseFormat, null, 2));
        
        console.log('\nTo test with real cookies, replace the example values in testCookies and run:');
        console.log('node test-example.js');
        
        console.log('\nOr use curl:');
        console.log(`curl -X POST http://localhost:3000/scrape-linkedin-feed \\
  -H "Content-Type: application/json" \\
  -d '{
    "cookies": [
      {
        "name": "li_at",
        "value": "YOUR_ACTUAL_LI_AT_VALUE",
        "domain": ".linkedin.com"
      }
    ]
  }'`);
        
    } catch (error) {
        console.error('Test error:', error.message);
    }
}

if (require.main === module) {
    testScraper();
}

module.exports = { testCookies, expectedResponseFormat };
