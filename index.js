const express = require('express');
const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

async function createHeadlessDriver() {
    console.log('Creating Chrome driver with maximum stealth...');
    
    const options = new chrome.Options();
    options.addArguments('--headless=new');
    options.addArguments('--no-sandbox');
    options.addArguments('--disable-dev-shm-usage');
    options.addArguments('--disable-gpu');
    options.addArguments('--window-size=1920,1080');
    options.addArguments('--disable-blink-features=AutomationControlled');
    options.addArguments('--disable-web-security');
    options.addArguments('--disable-features=VizDisplayCompositor');
    options.addArguments('--disable-extensions');
    options.addArguments('--disable-plugins');
    options.addArguments('--disable-images');
    options.addArguments('--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36');
    options.addArguments('--accept-lang=en-US,en;q=0.9');
    options.addArguments('--accept=text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8');
    options.excludeSwitches(['enable-automation', 'enable-logging']);
    options.addArguments('--disable-blink-features=AutomationControlled');
    options.addArguments('--disable-ipc-flooding-protection');
    
    console.log('Building Chrome driver...');
    const driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .build();
    
    console.log('Setting increased timeouts...');
    await driver.manage().setTimeouts({
        implicit: 15000,
        pageLoad: 45000,
        script: 45000
    });
    
    
    console.log('Chrome driver created successfully');
    return driver;
}

async function loginWithCookies(driver, cookies) {
    try {
        console.log('=== LOGIN DEBUG ===');
        console.log('Navigating to LinkedIn...');
        await driver.get('https://www.linkedin.com');
        
        console.log('Adding cookies...');
        for (const cookie of cookies) {
            console.log(`Adding cookie: ${cookie.name}`);
            await driver.manage().addCookie({
                name: cookie.name,
                value: cookie.value,
                domain: cookie.domain || '.linkedin.com',
                path: cookie.path || '/',
                secure: cookie.secure !== false,
                httpOnly: cookie.httpOnly !== false
            });
        }
        
        console.log('Navigating to LinkedIn feed directly...');
        try {
            await driver.get('https://www.linkedin.com/feed/');
            await driver.sleep(5000);
        } catch (navError) {
            console.log('Direct navigation failed, trying refresh approach...');
            await driver.navigate().refresh();
            await driver.sleep(5000);
        }
        
        console.log('Checking authentication...');
        const currentUrl = await driver.getCurrentUrl();
        const pageTitle = await driver.getTitle();
        console.log('Current URL:', currentUrl);
        console.log('Page title:', pageTitle);
        
        if (currentUrl.includes('login') || currentUrl.includes('challenge') || currentUrl.includes('authwall')) {
            console.log('Authentication failed - redirected to login/challenge page');
            return false;
        }
        
        if (currentUrl.includes('linkedin.com/feed') || currentUrl.includes('linkedin.com/in/')) {
            console.log('Authentication successful - on authenticated page');
            return true;
        }
        
        if (currentUrl.includes('linkedin.com') && pageTitle && !pageTitle.toLowerCase().includes('sign in')) {
            console.log('Authentication appears successful - on LinkedIn without sign in page');
            return true;
        }
        
        console.log('Authentication status unclear - assuming failed');
        return false;
    } catch (error) {
        console.error('Error during login:', error);
        return false;
    }
}

async function scrapeHomeFeed(driver) {
    try {
        console.log('=== SCRAPING LINKEDIN FEED ===');
        
        console.log('Navigating to LinkedIn feed...');
        await driver.get('https://www.linkedin.com/feed/');
        
        console.log('Waiting for page to fully load...');
        await driver.sleep(10000);
        
        console.log('Executing JavaScript to hide automation detection...');
        await driver.executeScript(`
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
            delete navigator.__proto__.webdriver;
        `);
        
        console.log('Scrolling to trigger content loading...');
        for (let i = 0; i < 5; i++) {
            await driver.executeScript('window.scrollTo(0, document.body.scrollHeight);');
            await driver.sleep(2000);
            await driver.executeScript('window.scrollTo(0, 0);');
            await driver.sleep(1000);
        }
        
        console.log('Final scroll and wait...');
        await driver.executeScript('window.scrollTo(0, document.body.scrollHeight);');
        await driver.sleep(5000);
        
        console.log('Looking for posts with various selectors...');
        
        console.log('=== DEBUGGING: Analyzing page structure ===');
        const pageTitle = await driver.getTitle();
        const currentUrl = await driver.getCurrentUrl();
        console.log('Page title:', pageTitle);
        console.log('Current URL:', currentUrl);
        
        const containers = await driver.findElements(By.css('div'));
        console.log(`Found ${containers.length} div elements on page`);
        
        const feedElements = await driver.findElements(By.css('[class*="feed"]'));
        console.log(`Found ${feedElements.length} elements with 'feed' in class name`);
        
        const updateElements = await driver.findElements(By.css('[class*="update"]'));
        console.log(`Found ${updateElements.length} elements with 'update' in class name`);
        
        console.log('=== END DEBUGGING ===');
        
        let posts = await driver.findElements(By.css('div[data-urn*="urn:li:activity"]'));
        console.log(`Found ${posts.length} posts with modern data-urn selector`);
        
        if (posts.length === 0) {
            posts = await driver.findElements(By.css('.feed-shared-update-v2'));
            console.log(`Found ${posts.length} posts with feed-shared-update-v2 selector`);
        }
        
        if (posts.length === 0) {
            posts = await driver.findElements(By.css('[data-id^="urn:li:activity:"]'));
            console.log(`Found ${posts.length} posts with data-id selector`);
        }
        
        if (posts.length === 0) {
            posts = await driver.findElements(By.css('article'));
            console.log(`Found ${posts.length} posts with article selector`);
        }
        
        if (posts.length === 0) {
            posts = await driver.findElements(By.css('.scaffold-finite-scroll__content > div > div'));
            console.log(`Found ${posts.length} posts with nested scaffold selector`);
        }
        
        if (posts.length === 0) {
            posts = await driver.findElements(By.css('div[class*="feed"][class*="update"]'));
            console.log(`Found ${posts.length} posts with combined feed-update class selector`);
        }
        
        if (posts.length === 0) {
            posts = await driver.findElements(By.css('.scaffold-finite-scroll__content > div'));
            console.log(`Found ${posts.length} posts with scaffold content selector (fallback)`);
        }
        
        if (posts.length === 0) {
            console.log('No posts found with any selector');
            return [];
        }
        
        console.log(`Processing ${Math.min(posts.length, 25)} posts...`);
        const feedItems = [];
        
        for (let i = 0; i < Math.min(posts.length, 25); i++) {
            const post = posts[i];
            console.log(`Processing post ${i + 1}...`);
            
            try {
                const postClass = await post.getAttribute('class');
                const postDataId = await post.getAttribute('data-id');
                const postDataUrn = await post.getAttribute('data-urn');
                console.log(`Post ${i + 1} attributes:`, { class: postClass, dataId: postDataId, dataUrn: postDataUrn });
            } catch (e) {
                console.log(`Could not get post ${i + 1} attributes`);
            }
            
            try {
                let author = 'Unknown Author';
                const authorSelectors = [
                    '.update-components-actor__name',
                    '.feed-shared-actor__name',
                    'a[data-control-name="actor_container"] span[aria-hidden="false"]',
                    '.feed-shared-actor__name span[aria-hidden="false"]',
                    '.update-components-actor__name span',
                    '.feed-shared-update-v2__actor-name',
                    'a[data-control-name="actor_container"] span',
                    '.feed-shared-actor__name a span',
                    '[data-control-name="actor_container"] .visually-hidden',
                    '.feed-shared-actor__name .visually-hidden',
                    'a[href*="/in/"] span[aria-hidden="false"]',
                    '.update-components-actor__name .visually-hidden'
                ];
                
                for (const selector of authorSelectors) {
                    try {
                        const authorElement = await post.findElement(By.css(selector));
                        const authorText = await authorElement.getText();
                        if (authorText && authorText.trim()) {
                            author = authorText.trim();
                            console.log(`Found author with selector ${selector}: ${author}`);
                            break;
                        }
                    } catch (e) {
                    }
                }
                
                let postText = '';
                const textSelectors = [
                    '.feed-shared-text',
                    '.update-components-text',
                    '[data-test-id="main-feed-activity-card"] .break-words',
                    '.feed-shared-update-v2__commentary',
                    '.feed-shared-text__text-view',
                    '.break-words span[dir="ltr"]',
                    '.feed-shared-text span',
                    '.update-components-text span',
                    '.feed-shared-text .break-words',
                    '.update-components-text .break-words',
                    '[data-test-id*="post-text"]',
                    '.feed-shared-update-v2__commentary .break-words'
                ];
                
                for (const selector of textSelectors) {
                    try {
                        const textElement = await post.findElement(By.css(selector));
                        const text = await textElement.getText();
                        if (text && text.trim()) {
                            postText = text.trim();
                            console.log(`Found text with selector ${selector}: ${postText.substring(0, 100)}...`);
                            break;
                        }
                    } catch (e) {
                    }
                }
                
                let timestamp = new Date().toISOString();
                const timestampSelectors = [
                    '.update-components-actor__sub-description',
                    '.feed-shared-actor__sub-description',
                    'time',
                    '[data-test-id="main-feed-activity-card"] time',
                    '.feed-shared-actor__sub-description time'
                ];
                
                for (const selector of timestampSelectors) {
                    try {
                        const timeElement = await post.findElement(By.css(selector));
                        const timeText = await timeElement.getText();
                        if (timeText && timeText.trim()) {
                            timestamp = timeText.trim();
                            console.log(`Found timestamp with selector ${selector}: ${timestamp}`);
                            break;
                        }
                    } catch (e) {
                    }
                }
                
                let externalURL = 'https://linkedin.com/feed/';
                try {
                    const linkElement = await post.findElement(By.css('a[href*="/posts/"]'));
                    const href = await linkElement.getAttribute('href');
                    if (href) {
                        externalURL = href.startsWith('http') ? href : `https://linkedin.com${href}`;
                        console.log(`Found external URL: ${externalURL}`);
                    }
                } catch (e) {
                }
                
                if (author !== 'Unknown Author' || postText) {
                    feedItems.push({
                        author,
                        postText,
                        timestamp,
                        externalURL
                    });
                    console.log(`Successfully extracted post ${i + 1}`);
                } else {
                    console.log(`Skipping post ${i + 1} - no content found`);
                }
                
            } catch (error) {
                console.error(`Error processing post ${i + 1}:`, error.message);
            }
        }
        
        console.log(`=== SCRAPING COMPLETED: Found ${feedItems.length} posts ===`);
        return feedItems;
        
    } catch (error) {
        console.error('Error in scrapeHomeFeed:', error);
        throw error;
    }
}

app.post('/scrape-linkedin-feed', async (req, res) => {
    let driver;
    
    try {
        const { cookies } = req.body;
        
        if (!cookies || !Array.isArray(cookies) || cookies.length === 0) {
            return res.status(400).json({
                error: 'Cookies array is required in request body and must not be empty'
            });
        }
        
        console.log('=== STARTING SCRAPE REQUEST ===');
        console.log('Creating driver...');
        
        driver = await createHeadlessDriver();
        console.log('Driver created successfully');
        
        console.log('Attempting login...');
        const loginSuccess = await loginWithCookies(driver, cookies);
        console.log('Login result:', loginSuccess);
        
        if (!loginSuccess) {
            return res.status(401).json({
                error: 'Failed to authenticate with provided cookies'
            });
        }
        
        console.log('Starting feed scraping...');
        const feedItems = await scrapeHomeFeed(driver);
        console.log('Feed scraping completed, items:', feedItems.length);
        
        res.json({
            success: true,
            count: feedItems.length,
            data: feedItems
        });
        
    } catch (error) {
        console.error('Scraping error:', error);
        res.status(500).json({
            error: 'Failed to scrape LinkedIn feed',
            message: error.message
        });
    } finally {
        if (driver) {
            console.log('Quitting driver...');
            await driver.quit();
            console.log('Driver quit successfully');
        }
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'LinkedIn scraper service is running' });
});

app.post('/webhook/linkedin-feed', (req, res) => {
    try {
        console.log('=== WEBHOOK REQUEST RECEIVED ===');
        console.log('Source:', req.body.source);
        console.log('Posts count:', req.body.count);
        console.log('Timestamp:', req.body.timestamp);
        
        if (!req.body.data || !Array.isArray(req.body.data)) {
            return res.status(400).json({
                error: 'Invalid webhook payload - data array required'
            });
        }
        
        console.log(`Webhook processed successfully: ${req.body.count} posts received`);
        
        res.json({
            success: true,
            message: 'Webhook data received successfully',
            processed: req.body.count
        });
        
    } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).json({
            error: 'Failed to process webhook data',
            message: error.message
        });
    }
});

function createBearNote(linkedinPost) {
    const title = `LinkedIn: ${linkedinPost.author}`;
    const text = `${linkedinPost.postText}\n\n**Source:** ${linkedinPost.externalURL}\n**Posted:** ${linkedinPost.timestamp}`;
    const tags = 'linkedin,social-media';
    
    const bearUrl = `bear://x-callback-url/create?` +
        `title=${encodeURIComponent(title)}&` +
        `text=${encodeURIComponent(text)}&` +
        `tags=${encodeURIComponent(tags)}`;
    
    return bearUrl;
}

app.post('/webhook/linkedin-to-bear', (req, res) => {
    try {
        console.log('=== BEAR INTEGRATION REQUEST RECEIVED ===');
        console.log('Posts count:', req.body.count);
        
        if (!req.body.data || !Array.isArray(req.body.data)) {
            return res.status(400).json({
                error: 'Invalid payload - data array required'
            });
        }
        
        const bearNotes = req.body.data.map(post => createBearNote(post));
        
        bearNotes.forEach((bearUrl, index) => {
            console.log(`Creating Bear note ${index + 1}: ${bearUrl}`);
            
            exec(`open "${bearUrl}"`, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error creating Bear note ${index + 1}:`, error);
                } else {
                    console.log(`Bear note ${index + 1} created successfully`);
                }
            });
        });
        
        res.json({
            success: true,
            message: 'LinkedIn posts processed for Bear',
            notesCreated: bearNotes.length,
            bearUrls: bearNotes
        });
        
    } catch (error) {
        console.error('Bear integration error:', error);
        res.status(500).json({
            error: 'Failed to process LinkedIn posts for Bear',
            message: error.message
        });
    }
});

app.get('/', (req, res) => {
    res.json({
        message: 'LinkedIn Feed Scraper API',
        endpoints: {
            'POST /scrape-linkedin-feed': 'Scrape LinkedIn home feed with cookies',
            'POST /webhook/linkedin-feed': 'Webhook endpoint for Chrome extension data',
            'POST /webhook/linkedin-to-bear': 'Process LinkedIn posts and create Bear notes',
            'GET /health': 'Health check endpoint'
        },
        usage: {
            method: 'POST',
            url: '/scrape-linkedin-feed',
            body: {
                cookies: [
                    {
                        name: 'li_at',
                        value: 'your_li_at_cookie_value',
                        domain: '.linkedin.com'
                    }
                ]
            }
        }
    });
});

app.listen(PORT, () => {
    console.log(`LinkedIn scraper service running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`API endpoint: POST http://localhost:${PORT}/scrape-linkedin-feed`);
});
