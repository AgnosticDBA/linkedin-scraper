console.log('LinkedIn Feed Scraper: Content script loaded');

class LinkedInFeedScraper {
    constructor() {
        this.posts = [];
        this.isScrapingActive = false;
        this.webhookUrl = '';
        this.maxPosts = 25;
        this.scrapedPosts = new Set();
        
        this.init();
    }

    async init() {
        const result = await chrome.storage.sync.get(['webhookUrl', 'maxPosts', 'autoScrape']);
        this.webhookUrl = result.webhookUrl || 'http://localhost:3000/webhook/linkedin-feed';
        this.maxPosts = result.maxPosts || 25;
        
        this.addScraperUI();
        
        if (result.autoScrape) {
            setTimeout(() => this.startScraping(), 2000);
        }
        
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'startScraping') {
                this.startScraping();
                sendResponse({success: true});
            } else if (request.action === 'getStatus') {
                sendResponse({
                    isActive: this.isScrapingActive,
                    postsFound: this.posts.length,
                    url: window.location.href
                });
            }
        });
    }

    addScraperUI() {
        const scraperButton = document.createElement('div');
        scraperButton.id = 'linkedin-scraper-button';
        scraperButton.innerHTML = `
            <div style="
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                background: #0073b1;
                color: white;
                padding: 10px 15px;
                border-radius: 5px;
                cursor: pointer;
                font-family: Arial, sans-serif;
                font-size: 12px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                user-select: none;
            ">
                📊 Scrape Feed
            </div>
        `;
        
        scraperButton.addEventListener('click', () => {
            if (!this.isScrapingActive) {
                this.startScraping();
            }
        });
        
        document.body.appendChild(scraperButton);
    }

    async startScraping() {
        if (this.isScrapingActive) {
            console.log('Scraping already in progress');
            return;
        }

        console.log('Starting LinkedIn feed scraping...');
        this.isScrapingActive = true;
        this.posts = [];
        this.scrapedPosts.clear();
        
        const button = document.querySelector('#linkedin-scraper-button div');
        if (button) {
            button.innerHTML = '⏳ Scraping...';
            button.style.background = '#f39c12';
        }

        try {
            await this.scrollAndCollectPosts();
            
            await this.sendToWebhook();
            
            if (button) {
                button.innerHTML = `✅ Found ${this.posts.length} posts`;
                button.style.background = '#27ae60';
                setTimeout(() => {
                    button.innerHTML = '📊 Scrape Feed';
                    button.style.background = '#0073b1';
                }, 3000);
            }
            
        } catch (error) {
            console.error('Scraping error:', error);
            
            if (button) {
                button.innerHTML = '❌ Error';
                button.style.background = '#e74c3c';
                setTimeout(() => {
                    button.innerHTML = '📊 Scrape Feed';
                    button.style.background = '#0073b1';
                }, 3000);
            }
        }
        
        this.isScrapingActive = false;
    }

    async scrollAndCollectPosts() {
        console.log('Scrolling and collecting posts...');
        
        this.collectVisiblePosts();
        
        let scrollAttempts = 0;
        const maxScrollAttempts = 10;
        let lastPostCount = this.posts.length;
        
        while (scrollAttempts < maxScrollAttempts && this.posts.length < this.maxPosts) {
            window.scrollBy(0, 1000);
            
            await this.sleep(2000);
            
            this.collectVisiblePosts();
            
            if (this.posts.length === lastPostCount) {
                scrollAttempts++;
            } else {
                scrollAttempts = 0; // Reset if we found new posts
                lastPostCount = this.posts.length;
            }
            
            console.log(`Scroll attempt ${scrollAttempts}, found ${this.posts.length} posts`);
        }
        
        window.scrollTo(0, 0);
        
        console.log(`Scraping completed. Found ${this.posts.length} posts`);
    }

    collectVisiblePosts() {
        const postSelectors = [
            'div[data-urn*="urn:li:activity"]',
            '.feed-shared-update-v2',
            '[data-id^="urn:li:activity:"]',
            '.scaffold-finite-scroll__content > div[data-urn]',
            '.feed-shared-update-v2__content-wrapper',
            'article[data-urn]',
            '.update-v2-social-activity',
            'article',
            '.scaffold-finite-scroll__content > div > div',
            'div[class*="feed"][class*="update"]',
            '.feed-shared-update-v2 > div'
        ];

        let postElements = [];
        
        for (const selector of postSelectors) {
            postElements = document.querySelectorAll(selector);
            if (postElements.length > 0) {
                console.log(`Using selector: ${selector} (found ${postElements.length} elements)`);
                break;
            }
        }

        if (postElements.length === 0) {
            console.log('No posts found with standard selectors, trying broader approach...');
            postElements = document.querySelectorAll('.scaffold-finite-scroll__content > div');
            console.log(`Fallback selector found ${postElements.length} elements`);
        }

        if (postElements.length === 0) {
            console.log('No post elements found with any selector');
            return;
        }

        console.log(`Processing ${postElements.length} post elements...`);
        
        postElements.forEach((postElement, index) => {
            try {
                const postData = this.extractPostData(postElement);
                
                console.log(`Post ${index + 1} extracted data:`, {
                    author: postData.author,
                    hasText: !!postData.postText && postData.postText !== 'No text content',
                    hasTimestamp: !!postData.timestamp && postData.timestamp !== 'Unknown time',
                    hasURL: !!postData.externalURL && postData.externalURL !== 'No URL available'
                });
                
                const postId = postData.externalURL || `${postData.author}-${postData.postText.substring(0, 50)}`;
                
                if (postData.author && postData.author !== 'Unknown Author' && postData.author.length > 1 && !this.scrapedPosts.has(postId) && this.posts.length < this.maxPosts) {
                    this.posts.push(postData);
                    this.scrapedPosts.add(postId);
                    console.log(`✅ Added post ${this.posts.length}: ${postData.author}`);
                } else {
                    console.log(`❌ Skipped post ${index + 1}:`, {
                        hasValidAuthor: postData.author && postData.author !== 'Unknown Author' && postData.author.length > 1,
                        alreadyScraped: this.scrapedPosts.has(postId),
                        reachedMaxPosts: this.posts.length >= this.maxPosts,
                        authorFound: postData.author
                    });
                }
            } catch (error) {
                console.error(`Error extracting post ${index}:`, error);
            }
        });
        
        console.log(`Collection complete: ${this.posts.length} valid posts found`);
    }

    extractPostData(postElement) {
        const authorSelectors = [
            '.update-components-actor__name .visually-hidden',
            '.feed-shared-actor__name .visually-hidden', 
            '.update-components-actor__name span[aria-hidden="false"]',
            '.feed-shared-actor__name span[aria-hidden="false"]',
            'a[data-control-name="actor_container"] span[aria-hidden="false"]',
            '.feed-shared-actor__name a span[aria-hidden="false"]',
            '.update-components-actor__name',
            '.feed-shared-actor__name',
            '.feed-shared-update-v2__actor-name',
            'a[data-control-name="actor_container"] span',
            '.feed-shared-actor__name a span',
            '[data-control-name="actor_container"] .visually-hidden',
            'a[href*="/in/"] span[aria-hidden="false"]',
            '.update-components-actor__name span',
            '.feed-shared-actor__name span'
        ];

        let author = 'Unknown Author';
        for (const selector of authorSelectors) {
            const element = postElement.querySelector(selector);
            if (element && element.textContent.trim()) {
                author = element.textContent.trim();
                break;
            }
        }

        const textSelectors = [
            '.feed-shared-text .break-words span[dir="ltr"]',
            '.update-components-text .break-words span[dir="ltr"]',
            '.feed-shared-update-v2__commentary .break-words',
            '.feed-shared-text__text-view span',
            '[data-test-id="main-feed-activity-card"] .break-words',
            '.feed-shared-text',
            '.update-components-text', 
            '.feed-shared-update-v2__commentary',
            '.feed-shared-text__text-view',
            '.break-words span[dir="ltr"]',
            '.feed-shared-text span',
            '.update-components-text span',
            '.feed-shared-text .break-words',
            '.update-components-text .break-words',
            '[data-test-id*="post-text"]'
        ];

        let postText = '';
        for (const selector of textSelectors) {
            const element = postElement.querySelector(selector);
            if (element && element.textContent.trim()) {
                postText = element.textContent.trim();
                break;
            }
        }

        const timestampSelectors = [
            '.update-components-actor__sub-description',
            '.feed-shared-actor__sub-description',
            'time',
            '.feed-shared-actor__sub-description time',
            '.update-components-actor__sub-description time',
            '[data-test-id="main-feed-activity-card"] time'
        ];

        let timestamp = '';
        for (const selector of timestampSelectors) {
            const element = postElement.querySelector(selector);
            if (element && element.textContent.trim()) {
                timestamp = element.textContent.trim();
                break;
            }
        }

        let externalURL = '';
        const linkElement = postElement.querySelector('a[href*="/posts/"], a[href*="/feed/update/"]');
        if (linkElement) {
            const href = linkElement.getAttribute('href');
            if (href) {
                externalURL = href.startsWith('http') ? href : `https://linkedin.com${href}`;
            }
        }

        return {
            author,
            postText: postText || 'No text content',
            timestamp: timestamp || 'Unknown time',
            externalURL: externalURL || 'No URL available'
        };
    }

    async sendToWebhook() {
        if (!this.webhookUrl) {
            console.error('No webhook URL configured');
            return;
        }

        const payload = {
            success: true,
            count: this.posts.length,
            data: this.posts,
            source: 'chrome-extension',
            timestamp: new Date().toISOString(),
            url: window.location.href
        };

        try {
            console.log(`Sending ${this.posts.length} posts to webhook:`, this.webhookUrl);
            
            const response = await fetch(this.webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                console.log('Successfully sent data to webhook');
            } else {
                console.error('Webhook request failed:', response.status, response.statusText);
            }
        } catch (error) {
            console.error('Error sending to webhook:', error);
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new LinkedInFeedScraper();
    });
} else {
    new LinkedInFeedScraper();
}
